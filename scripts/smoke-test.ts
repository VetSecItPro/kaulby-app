/**
 * Smoke test runner for Kaulby dev server.
 * Hits dashboard pages, API routes, and marketing pages via HTTP.
 * Reports pass/fail summary.
 *
 * Usage: npx tsx scripts/smoke-test.ts [port]
 * Default port: 6761
 */

const PORT = process.argv[2] || '6761';
const BASE = `http://localhost:${PORT}`;

interface TestResult {
  url: string;
  category: string;
  status: number | null;
  ok: boolean;
  skipped?: boolean;
  error?: string;
  responseShape?: string;
}

const results: TestResult[] = [];

async function testUrl(url: string, category: string, options?: {
  expectJson?: boolean;
  describeShape?: (body: any) => string;
  skipReason?: string;
}) {
  if (options?.skipReason) {
    results.push({
      url,
      category,
      status: null,
      ok: true,
      skipped: true,
      error: options.skipReason,
    });
    return;
  }

  const fullUrl = `${BASE}${url}`;
  try {
    const res = await fetch(fullUrl, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
      headers: { 'Accept': options?.expectJson ? 'application/json' : 'text/html' },
    });

    let responseShape: string | undefined;
    if (options?.expectJson && options?.describeShape) {
      try {
        const body = await res.json();
        responseShape = options.describeShape(body);
      } catch {
        responseShape = 'non-JSON response';
      }
    }

    // Always consume the body to free the connection
    if (!options?.expectJson || !options?.describeShape) {
      await res.text();
    }

    // In dev mode, Clerk middleware may redirect marketing pages to add dev browser JWT.
    // 200 = served directly, 307 = Clerk dev browser handshake (expected in dev).
    const ok = res.status >= 200 && res.status < 400;

    results.push({
      url,
      category,
      status: res.status,
      ok,
      responseShape,
    });
  } catch (err: any) {
    const cause = err.cause ? ` [cause: ${err.cause?.code || err.cause?.message || err.cause}]` : '';
    results.push({
      url,
      category,
      status: null,
      ok: false,
      error: (err.code || err.message) + cause,
    });
  }
}

async function runSequential(tests: Array<() => Promise<void>>) {
  for (const test of tests) {
    await test();
  }
}

async function run() {
  // Verify server is running
  try {
    await fetch(`${BASE}/`, { signal: AbortSignal.timeout(5000) });
  } catch {
    console.error(`Server not reachable at ${BASE}`);
    console.error(`Start the dev server first: PORT=${PORT} pnpm dev`);
    process.exit(1);
  }

  console.log(`Smoke testing ${BASE}\n`);

  // Dashboard pages (expect 200 with empty states)
  // Middleware bypasses Clerk auth in dev mode for /dashboard/*
  const dashboardPages = [
    '/dashboard',
    '/dashboard/monitors',
    '/dashboard/results',
    '/dashboard/analytics',
    '/dashboard/insights',
    '/dashboard/audiences',
    '/dashboard/settings',
    '/dashboard/ask',
  ];

  // API routes require Clerk session (auth()), so they can't be tested via curl.
  // Mark as skipped with explanation.
  const apiRoutes = [
    '/api/results',
    '/api/dashboard/insights',
    '/api/insights?range=30d',
  ];

  // Marketing pages (public, no auth)
  const marketingPages = [
    '/',
    '/pricing',
    '/articles',
    '/privacy',
    '/terms',
  ];

  // Run sequentially to avoid overwhelming the dev server
  await runSequential(
    dashboardPages.map((url) => () => testUrl(url, 'dashboard'))
  );

  await runSequential(
    apiRoutes.map((url) => () =>
      testUrl(url, 'api', { skipReason: 'requires Clerk session (auth())' })
    )
  );

  // Brief pause to let the dev server settle after dashboard SSR
  await new Promise((r) => setTimeout(r, 2000));

  await runSequential(
    marketingPages.map((url) => () => testUrl(url, 'marketing'))
  );

  // Print results
  const categories = ['dashboard', 'api', 'marketing'];
  for (const cat of categories) {
    const catResults = results.filter((r) => r.category === cat);
    console.log(`--- ${cat.toUpperCase()} ---`);
    for (const r of catResults) {
      if (r.skipped) {
        console.log(`  [SKIP] --- ${r.url} (${r.error})`);
        continue;
      }
      const statusStr = r.status ? String(r.status) : 'ERR';
      const icon = r.ok ? 'PASS' : 'FAIL';
      const extra = r.responseShape ? ` -> ${r.responseShape}` : '';
      const errStr = r.error ? ` (${r.error})` : '';
      console.log(`  [${icon}] ${statusStr} ${r.url}${extra}${errStr}`);
    }
    console.log();
  }

  // Summary (skipped tests don't count as failures)
  const tested = results.filter((r) => !r.skipped);
  const skipped = results.filter((r) => r.skipped);
  const passed = tested.filter((r) => r.ok).length;
  const failed = tested.filter((r) => !r.ok).length;

  console.log(`=== SUMMARY ===`);
  console.log(`Passed: ${passed}/${tested.length} (${skipped.length} skipped)`);
  if (failed > 0) {
    console.log(`Failed: ${failed}`);
    tested.filter((r) => !r.ok).forEach((r) => {
      console.log(`  - ${r.url}: ${r.status || r.error}`);
    });
  }
  console.log();

  process.exit(failed > 0 ? 1 : 0);
}

run();
