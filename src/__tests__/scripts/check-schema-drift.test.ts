import { describe, it, expect } from "vitest";
import {
  DESTRUCTIVE_RULES,
  scanSql,
  runScan,
} from "../../../scripts/check-schema-drift";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("check-schema-drift: scanSql", () => {
  it("flags DROP COLUMN", () => {
    const sql = `ALTER TABLE "users" DROP COLUMN "legacy";`;
    const findings = scanSql("x.sql", sql);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe("DROP_COLUMN");
    expect(findings[0].line).toBe(1);
  });

  it("flags DROP TABLE at statement start", () => {
    const sql = `DROP TABLE "old_sessions";`;
    const findings = scanSql("x.sql", sql);
    expect(findings.map((f) => f.rule)).toContain("DROP_TABLE");
  });

  it("flags SET NOT NULL even when wrapped across lines", () => {
    const sql = `ALTER TABLE "monitors"\n  ALTER COLUMN "keyword"\n  SET NOT NULL;`;
    const findings = scanSql("x.sql", sql);
    expect(findings.map((f) => f.rule)).toContain("SET_NOT_NULL");
  });

  it("flags ALTER COLUMN TYPE", () => {
    const sql = `ALTER TABLE "alerts" ALTER COLUMN "count" SET DATA TYPE smallint;`;
    const findings = scanSql("x.sql", sql);
    expect(findings.map((f) => f.rule)).toContain("ALTER_COLUMN_TYPE");
  });

  it("flags DROP CONSTRAINT", () => {
    const sql = `ALTER TABLE "users" DROP CONSTRAINT "users_email_key";`;
    const findings = scanSql("x.sql", sql);
    expect(findings.map((f) => f.rule)).toContain("DROP_CONSTRAINT");
  });

  it("does NOT flag additive changes (CREATE TABLE, ADD COLUMN, CREATE INDEX)", () => {
    const sql = [
      `CREATE TABLE "widgets" ("id" uuid PRIMARY KEY, "name" text NOT NULL);`,
      `ALTER TABLE "users" ADD COLUMN "tier" text NOT NULL DEFAULT 'free';`,
      `CREATE INDEX "widgets_name_idx" ON "widgets" USING btree ("name");`,
      `CREATE TYPE "public"."status" AS ENUM('active', 'archived');`,
    ].join("\n--> statement-breakpoint\n");
    const findings = scanSql("x.sql", sql);
    expect(findings).toHaveLength(0);
  });

  it("does NOT flag a NOT NULL that is part of a fresh CREATE TABLE", () => {
    // The rule is scoped to ALTER COLUMN ... SET NOT NULL, so declaring a
    // NOT NULL column inside CREATE TABLE should be ignored.
    const sql = `CREATE TABLE "x" ("id" uuid PRIMARY KEY, "name" text NOT NULL);`;
    expect(scanSql("x.sql", sql)).toHaveLength(0);
  });

  it("splits drizzle statement-breakpoint markers even when inline", () => {
    // Regression: all four statements must be detected, not just the last.
    const sql = [
      `ALTER TABLE "users" DROP COLUMN "legacy_email";--> statement-breakpoint`,
      `ALTER TABLE "monitors" ALTER COLUMN "keyword" SET NOT NULL;--> statement-breakpoint`,
      `ALTER TABLE "alerts" ALTER COLUMN "count" SET DATA TYPE smallint;--> statement-breakpoint`,
      `DROP TABLE "old_sessions";`,
    ].join("\n");
    const findings = scanSql("x.sql", sql);
    const rules = findings.map((f) => f.rule).sort();
    expect(rules).toEqual([
      "ALTER_COLUMN_TYPE",
      "DROP_COLUMN",
      "DROP_TABLE",
      "SET_NOT_NULL",
    ]);
  });

  it("covers every rule with at least one pattern", () => {
    // Sanity: ensure we haven't dropped a rule from the exported list.
    expect(DESTRUCTIVE_RULES.length).toBeGreaterThanOrEqual(5);
  });
});

describe("check-schema-drift: runScan (integration)", () => {
  function makeTmpRepo(fileContent: string): string {
    const dir = mkdtempSync(join(tmpdir(), "drift-check-"));
    mkdirSync(join(dir, "drizzle"), { recursive: true });
    writeFileSync(join(dir, "drizzle", "0001_test.sql"), fileContent);
    return dir;
  }

  it("returns no findings for additive migration", () => {
    const cwd = makeTmpRepo(
      `CREATE TABLE "x" ("id" uuid PRIMARY KEY);\n--> statement-breakpoint\nALTER TABLE "y" ADD COLUMN "z" text;`,
    );
    try {
      const r = runScan({
        cwd,
        baseRef: "origin/main",
        explicitFiles: ["drizzle/0001_test.sql"],
        scanAll: false,
        allowDestructiveEnv: false,
        commitMessages: "",
      });
      expect(r.findings).toHaveLength(0);
      expect(r.bypassed).toBe(false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("fails on destructive migration without bypass", () => {
    const cwd = makeTmpRepo(`DROP TABLE "users";`);
    try {
      const r = runScan({
        cwd,
        baseRef: "origin/main",
        explicitFiles: ["drizzle/0001_test.sql"],
        scanAll: false,
        allowDestructiveEnv: false,
        commitMessages: "chore: clean up",
      });
      expect(r.findings.length).toBeGreaterThan(0);
      expect(r.bypassed).toBe(false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("bypasses via commit message token", () => {
    const cwd = makeTmpRepo(`DROP TABLE "users";`);
    try {
      const r = runScan({
        cwd,
        baseRef: "origin/main",
        explicitFiles: ["drizzle/0001_test.sql"],
        scanAll: false,
        allowDestructiveEnv: false,
        commitMessages:
          "chore(db): remove legacy users\n\n[approve-destructive-migration]",
      });
      expect(r.findings.length).toBeGreaterThan(0);
      expect(r.bypassed).toBe(true);
      expect(r.bypassReason).toMatch(/approve-destructive-migration/);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("bypasses via env flag", () => {
    const cwd = makeTmpRepo(`DROP TABLE "users";`);
    try {
      const r = runScan({
        cwd,
        baseRef: "origin/main",
        explicitFiles: ["drizzle/0001_test.sql"],
        scanAll: false,
        allowDestructiveEnv: true,
        commitMessages: "",
      });
      expect(r.bypassed).toBe(true);
      expect(r.bypassReason).toMatch(/KAULBY_ALLOW_DESTRUCTIVE/);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
