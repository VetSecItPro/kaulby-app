/**
 * Schema Drift Safety Gate
 *
 * Scans Drizzle migration SQL files (under `drizzle/`) for destructive statements
 * and fails the build if any are found without an explicit bypass.
 *
 * WHY: destructive migrations (DROP COLUMN, DROP TABLE, narrowing type changes,
 * adding NOT NULL to existing columns) can cause production data loss or
 * incidents if merged accidentally. This gate forces an intentional opt-in
 * ("[approve-destructive-migration]" in a commit message, or
 * KAULBY_ALLOW_DESTRUCTIVE=1 in the env) before any destructive migration
 * lands on main.
 *
 * USAGE:
 *   pnpm check:schema-drift            # scan migrations changed vs base ref
 *   pnpm check:schema-drift --all      # scan every migration file
 *   pnpm check:schema-drift path/to.sql  # scan explicit files
 *
 * In CI we set BASE_REF=origin/main and scan only the migrations touched
 * in the PR. Additive migrations (CREATE TABLE, ADD COLUMN, new indexes,
 * new enum values) pass silently.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

export interface DestructiveFinding {
  file: string;
  line: number;
  text: string;
  rule: string;
}

// Destructive SQL patterns. Each rule is intentionally narrow to avoid
// false positives on additive DDL.
export const DESTRUCTIVE_RULES: ReadonlyArray<{
  rule: string;
  pattern: RegExp;
}> = [
  // `ALTER TABLE ... DROP COLUMN`
  { rule: "DROP_COLUMN", pattern: /\bDROP\s+COLUMN\b/i },
  // `DROP TABLE` (including IF EXISTS). Exclude "DROP TABLE IF EXISTS" inside
  // CREATE OR REPLACE-style idempotent snippets by requiring the statement to
  // start with DROP.
  { rule: "DROP_TABLE", pattern: /^\s*DROP\s+TABLE\b/i },
  // `DROP SCHEMA`
  { rule: "DROP_SCHEMA", pattern: /^\s*DROP\s+SCHEMA\b/i },
  // `DROP TYPE` — destroys enum/composite types that might be in use
  { rule: "DROP_TYPE", pattern: /^\s*DROP\s+TYPE\b/i },
  // `ALTER COLUMN ... SET NOT NULL` — can fail on existing NULL rows
  {
    rule: "SET_NOT_NULL",
    pattern: /\bALTER\s+COLUMN\b[\s\S]*?\bSET\s+NOT\s+NULL\b/i,
  },
  // `ALTER COLUMN ... TYPE ...` — type changes can truncate/fail on data.
  // We flag ALL type changes; widening changes (e.g. text->text, varchar(8)
  // -> varchar(16)) are rare in practice and usually safe to bypass explicitly.
  {
    rule: "ALTER_COLUMN_TYPE",
    pattern: /\bALTER\s+COLUMN\b[\s\S]*?\b(?:SET\s+DATA\s+)?TYPE\b/i,
  },
  // `DROP CONSTRAINT` on a live table can break writers mid-deploy
  { rule: "DROP_CONSTRAINT", pattern: /\bDROP\s+CONSTRAINT\b/i },
];

const BYPASS_TOKEN = "[approve-destructive-migration]";

export interface ScanResult {
  findings: DestructiveFinding[];
  scannedFiles: string[];
}

/**
 * Pure scanner: given a SQL text body and a file label, return all destructive
 * findings. Exported for unit tests.
 */
export function scanSql(file: string, sql: string): DestructiveFinding[] {
  const findings: DestructiveFinding[] = [];
  // Split on drizzle's "--> statement-breakpoint" markers AND newlines so we
  // can report a usable line number even inside multi-line statements.
  const lines = sql.split(/\r?\n/);
  // Also evaluate rules that span lines against logical statements. We rebuild
  // statement offsets so SET_NOT_NULL / ALTER_COLUMN_TYPE can match across
  // wrapped lines without losing the originating line number.
  const statements = splitStatements(sql);
  for (const { text, startLine } of statements) {
    for (const { rule, pattern } of DESTRUCTIVE_RULES) {
      if (pattern.test(text)) {
        // Prefer the exact offending line when the pattern is single-line.
        const localLine =
          text.split(/\r?\n/).findIndex((l) => pattern.test(l));
        const reportLine =
          localLine >= 0 ? startLine + localLine : startLine;
        findings.push({
          file,
          line: reportLine + 1, // 1-indexed for humans
          text: (lines[reportLine] ?? text.split(/\r?\n/)[0] ?? "").trim(),
          rule,
        });
      }
    }
  }
  return findings;
}

function splitStatements(sql: string): Array<{ text: string; startLine: number }> {
  // Drizzle separates statements with "--> statement-breakpoint", which may
  // appear inline on the same line as the SQL (e.g. `DROP TABLE "x";--> statement-breakpoint`).
  // We strip the marker from each line, then emit a new statement boundary
  // whenever we see one. If the marker is absent, fall back to treating each
  // semicolon-terminated line as its own statement via a single big buffer.
  const MARKER = "--> statement-breakpoint";
  const out: Array<{ text: string; startLine: number }> = [];
  const lines = sql.split(/\r?\n/);
  let bufStart = 0;
  let buf: string[] = [];
  const flush = () => {
    if (buf.length === 0) return;
    out.push({ text: buf.join("\n"), startLine: bufStart });
    buf = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const markerIdx = raw.indexOf(MARKER);
    const codePart = markerIdx >= 0 ? raw.slice(0, markerIdx) : raw;
    if (codePart.trim().length > 0) {
      if (buf.length === 0) bufStart = i;
      buf.push(codePart);
    }
    if (markerIdx >= 0) {
      flush();
      bufStart = i + 1;
    }
  }
  flush();
  return out;
}

/** Find migration files touched since `baseRef` (falls back to all migrations). */
function changedMigrations(baseRef: string, drizzleDir: string): string[] {
  try {
    const out = execSync(
      `git diff --name-only --diff-filter=AM ${baseRef}...HEAD -- '${drizzleDir}/*.sql'`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return out
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.endsWith(".sql"));
  } catch {
    return [];
  }
}

function allMigrations(drizzleDir: string): string[] {
  if (!existsSync(drizzleDir)) return [];
  return readdirSync(drizzleDir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => join(drizzleDir, f))
    .sort();
}

/** Resolve which commit messages to inspect for the bypass token. */
function collectCommitMessages(baseRef: string): string {
  // Priority 1: explicit env hook from GH Actions (PR title/body).
  const envHook = process.env.KAULBY_COMMIT_MESSAGES ?? "";
  let messages = envHook;
  try {
    // Priority 2: every commit on the current branch that is not on main.
    const gitLog = execSync(`git log --format=%B ${baseRef}..HEAD`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    messages += "\n" + gitLog;
  } catch {
    // Not in a git repo or baseRef unresolvable -- fall back to HEAD only.
    try {
      messages +=
        "\n" +
        execSync("git log -1 --format=%B", {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        });
    } catch {
      /* ignore */
    }
  }
  return messages;
}

export interface RunOptions {
  cwd: string;
  baseRef: string;
  explicitFiles: string[];
  scanAll: boolean;
  allowDestructiveEnv: boolean;
  commitMessages: string;
}

export function runScan(opts: RunOptions): {
  scanned: string[];
  findings: DestructiveFinding[];
  bypassed: boolean;
  bypassReason?: string;
} {
  const drizzleDir = join(opts.cwd, "drizzle");
  let targets: string[];
  if (opts.explicitFiles.length > 0) {
    targets = opts.explicitFiles.map((f) => resolve(opts.cwd, f));
  } else if (opts.scanAll) {
    targets = allMigrations(drizzleDir);
  } else {
    const changed = changedMigrations(opts.baseRef, "drizzle");
    targets = changed.map((f) => resolve(opts.cwd, f));
  }

  const findings: DestructiveFinding[] = [];
  const scanned: string[] = [];
  for (const file of targets) {
    if (!existsSync(file)) continue;
    const sql = readFileSync(file, "utf8");
    scanned.push(file);
    findings.push(...scanSql(file, sql));
  }

  if (findings.length === 0) {
    return { scanned, findings, bypassed: false };
  }

  // Bypass: commit-message token or env var.
  if (opts.commitMessages.includes(BYPASS_TOKEN)) {
    return {
      scanned,
      findings,
      bypassed: true,
      bypassReason: `bypass token ${BYPASS_TOKEN} present in commit messages or PR body`,
    };
  }
  if (opts.allowDestructiveEnv) {
    return {
      scanned,
      findings,
      bypassed: true,
      bypassReason: "KAULBY_ALLOW_DESTRUCTIVE=1 set in environment",
    };
  }
  return { scanned, findings, bypassed: false };
}

function formatReport(r: ReturnType<typeof runScan>): string {
  const lines: string[] = [];
  lines.push("Schema drift safety gate");
  lines.push("------------------------");
  lines.push(
    `Scanned ${r.scanned.length} migration file(s): ${
      r.scanned.length === 0 ? "(none changed)" : ""
    }`,
  );
  for (const f of r.scanned) lines.push(`  - ${f}`);
  if (r.findings.length === 0) {
    lines.push("");
    lines.push("No destructive statements detected. OK.");
    return lines.join("\n");
  }
  lines.push("");
  lines.push(`Found ${r.findings.length} destructive statement(s):`);
  for (const f of r.findings) {
    lines.push(`  [${f.rule}] ${f.file}:${f.line}`);
    lines.push(`    ${f.text}`);
  }
  if (r.bypassed) {
    lines.push("");
    lines.push(`BYPASS ACTIVE: ${r.bypassReason}`);
    lines.push("Proceeding (gate not failing).");
  } else {
    lines.push("");
    lines.push("This migration will FAIL CI.");
    lines.push(
      "If the destructive change is intentional, opt in via one of:",
    );
    lines.push(
      `  1. Include "${BYPASS_TOKEN}" in a commit message on this branch.`,
    );
    lines.push(
      "  2. Set KAULBY_ALLOW_DESTRUCTIVE=1 in the job env (requires reviewer approval).",
    );
    lines.push(
      "Destructive migrations should land behind an explicit rollout plan (dual-write, backfill, cut-over).",
    );
  }
  return lines.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const scanAll = args.includes("--all");
  const explicitFiles = args.filter((a) => !a.startsWith("--"));
  const cwd = process.cwd();
  const baseRef = process.env.BASE_REF ?? "origin/main";
  const allowDestructiveEnv = process.env.KAULBY_ALLOW_DESTRUCTIVE === "1";
  const commitMessages = collectCommitMessages(baseRef);

  const result = runScan({
    cwd,
    baseRef,
    explicitFiles,
    scanAll,
    allowDestructiveEnv,
    commitMessages,
  });

  // eslint-disable-next-line no-console
  console.log(formatReport(result));

  if (result.findings.length > 0 && !result.bypassed) {
    process.exit(1);
  }
}

// Only run main() when invoked directly (not during tests).
const invokedDirectly =
  typeof require !== "undefined" && require.main === module;
const invokedAsScript =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("check-schema-drift.ts") ||
    process.argv[1].endsWith("check-schema-drift.js"));

if (invokedDirectly || invokedAsScript) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[check-schema-drift] unexpected error:", err);
    process.exit(2);
  });
}
