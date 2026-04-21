import { describe, it, expect, vi, beforeEach } from "vitest";

// ────────────────────────────────────────────────────────────────────────────
// Task 2.1 Phase A — cross-monitor result dedup.
//
// Verifies saveNewResults():
//   (1) new URL + new monitor → inserts BOTH results and monitor_results rows
//   (2) existing URL owned by another monitor of the SAME user → inserts only
//       a monitor_results link (no second results row, no extra usage bump)
//   (3) idempotent re-call with same items → returns 0 new ids (no new AI)
//   (4) cross-user isolation: another user's results must NOT be treated as
//       existing — both users get their own canonical row
//
// The test uses a hand-rolled in-memory pooledDb shim that models the minimal
// surface saveNewResults touches: select().from().innerJoin().where(),
// insert(results).values().returning(), and insert(monitor_results).values()
// .onConflictDoNothing().returning(). That's enough to observe the behavior
// contract without standing up a real Postgres.
// ────────────────────────────────────────────────────────────────────────────

type ResultRow = {
  id: string;
  monitorId: string;
  sourceUrl: string;
  title: string;
};
type MonitorResultRow = { monitorId: string; resultId: string };
type MonitorRow = { id: string; userId: string };

const shared = vi.hoisted(() => {
  const state = {
    resultsRows: [] as ResultRow[],
    monitorResultsRows: [] as MonitorResultRow[],
    monitorsRows: [] as MonitorRow[],
    usageIncrements: [] as { userId: string; count: number }[],
    nextId: 1,
  };

  function resetState() {
    state.resultsRows = [];
    state.monitorResultsRows = [];
    state.monitorsRows = [];
    state.usageIncrements = [];
    state.nextId = 1;
  }

  // The query is: select from results inner join monitors where
  // monitors.userId=? and results.sourceUrl in (...). We capture the filter
  // values via the where clause predicate function the shim passes through.
  type SelectCtx = {
    userId?: string;
    urls?: string[];
  };

  function makeSelectChain() {
    const ctx: SelectCtx = {};
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.innerJoin = () => chain;
    chain.where = (_clauseMarker: unknown) => {
      // _clauseMarker is an opaque object from drizzle; we recover filters via
      // the side-channel set by the mock `eq`/`and`/`inArray` helpers below.
      const rows = state.resultsRows.filter((r) => {
        const monitor = state.monitorsRows.find((m) => m.id === r.monitorId);
        if (!monitor) return false;
        if (ctx.userId && monitor.userId !== ctx.userId) return false;
        if (ctx.urls && !ctx.urls.includes(r.sourceUrl)) return false;
        return true;
      });
      return Promise.resolve(
        rows.map((r) => ({ id: r.id, sourceUrl: r.sourceUrl }))
      );
    };
    return { chain, ctx };
  }

  type InsertResultsCtx = {
    values?: Array<Omit<ResultRow, "id"> & { id?: string }>;
  };
  type InsertMonitorResultsCtx = {
    values?: MonitorResultRow[];
    onConflict?: boolean;
  };

  let lastSelectCtx: SelectCtx | null = null;

  const pooledDbMock = {
    select: () => {
      const { chain, ctx } = makeSelectChain();
      lastSelectCtx = ctx;
      return chain;
    },
    insert: (table: unknown) => {
      // Dispatch by the `_TableName` drizzle attaches; in this mock we use the
      // passed-in table ref identity.
      if (table === resultsTableRef) {
        const ctx: InsertResultsCtx = {};
        const chain: Record<string, unknown> = {};
        chain.values = (vals: InsertResultsCtx["values"]) => {
          ctx.values = vals;
          return chain;
        };
        chain.returning = () => {
          const rows = (ctx.values ?? []).map((v) => {
            const id = `r${state.nextId++}`;
            const row: ResultRow = {
              id,
              monitorId: v.monitorId!,
              sourceUrl: v.sourceUrl!,
              title: v.title ?? "",
            };
            state.resultsRows.push(row);
            return { id, sourceUrl: v.sourceUrl! };
          });
          return Promise.resolve(rows);
        };
        return chain;
      }
      if (table === monitorResultsTableRef) {
        const ctx: InsertMonitorResultsCtx = {};
        const chain: Record<string, unknown> = {};
        chain.values = (vals: MonitorResultRow[]) => {
          ctx.values = vals;
          return chain;
        };
        chain.onConflictDoNothing = () => {
          ctx.onConflict = true;
          return chain;
        };
        chain.returning = () => {
          const inserted: { resultId: string }[] = [];
          for (const v of ctx.values ?? []) {
            const exists = state.monitorResultsRows.some(
              (r) => r.monitorId === v.monitorId && r.resultId === v.resultId
            );
            if (!exists) {
              state.monitorResultsRows.push(v);
              inserted.push({ resultId: v.resultId });
            }
          }
          return Promise.resolve(inserted);
        };
        return chain;
      }
      throw new Error("insert: unknown table");
    },
  };

  // Sentinel refs so the insert dispatcher can tell which table is targeted.
  // Set after imports resolve.
  let resultsTableRef: unknown = null;
  let monitorResultsTableRef: unknown = null;
  function bindTableRefs(r: unknown, mr: unknown) {
    resultsTableRef = r;
    monitorResultsTableRef = mr;
  }

  // Capture filter args so the select shim can apply them. We override the
  // drizzle operators via vi.mock below to route into this capture.
  function colName(col: unknown): string | undefined {
    const c = col as { name?: string; _?: { name?: string } };
    return c?.name ?? c?._?.name;
  }
  function captureEq(col: unknown, val: unknown) {
    // Only track the two we care about: monitors.userId, results.sourceUrl.
    const name = colName(col);
    if (name === "user_id" && lastSelectCtx) {
      lastSelectCtx.userId = val as string;
    }
    return { __eq: true, col, val };
  }
  function captureInArray(col: unknown, vals: unknown) {
    const name = colName(col);
    if (name === "source_url" && lastSelectCtx) {
      lastSelectCtx.urls = vals as string[];
    }
    return { __in: true, col, vals };
  }

  return {
    state,
    pooledDbMock,
    bindTableRefs,
    captureEq,
    captureInArray,
    resetState,
  };
});

vi.mock("@/lib/db", () => ({
  pooledDb: shared.pooledDbMock,
  db: shared.pooledDbMock,
}));

// Route drizzle-orm operators into our capture so the mock select can honor
// them. `and` just flattens — we don't need its structure.
vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>(
    "drizzle-orm"
  );
  return {
    ...actual,
    eq: (col: unknown, val: unknown) => shared.captureEq(col, val),
    inArray: (col: unknown, vals: unknown) => shared.captureInArray(col, vals),
    and: (...args: unknown[]) => ({ __and: true, args }),
  };
});

// Usage increment is a DB write in real code; here we just record calls.
vi.mock("@/lib/limits", () => ({
  incrementResultsCount: async (userId: string, count: number) => {
    shared.state.usageIncrements.push({ userId, count });
  },
  prefetchUserPlans: async () => new Map(),
  canAccessPlatformWithPlan: () => true,
  shouldProcessMonitorWithPlan: () => true,
}));

import { saveNewResults } from "@/lib/inngest/utils/monitor-helpers";
import { results, monitorResults } from "@/lib/db/schema";

// Bind the sentinel table refs now that schema module has loaded.
shared.bindTableRefs(results, monitorResults);

function makeStep() {
  return {
    run: async <T,>(_id: string, fn: () => Promise<T>): Promise<T> => fn(),
    sleep: async () => undefined,
  };
}

type FakeItem = { url: string; title: string };

function mapToResult(monitorId: string) {
  return (item: FakeItem) => ({
    monitorId,
    platform: "reddit" as const,
    sourceUrl: item.url,
    title: item.title,
  });
}

describe("saveNewResults — cross-monitor dedup (Task 2.1 Phase A)", () => {
  beforeEach(() => {
    shared.resetState();
  });

  it("new URL + new monitor: inserts both results and monitor_results rows", async () => {
    shared.state.monitorsRows.push({ id: "m1", userId: "u1" });

    const { count, ids } = await saveNewResults<FakeItem>({
      items: [
        { url: "https://reddit.com/a", title: "A" },
        { url: "https://reddit.com/b", title: "B" },
      ],
      monitorId: "m1",
      userId: "u1",
      getSourceUrl: (i) => i.url,
      mapToResult: mapToResult("m1"),
      step: makeStep(),
    });

    expect(count).toBe(2);
    expect(ids).toHaveLength(2);
    expect(shared.state.resultsRows).toHaveLength(2);
    expect(shared.state.monitorResultsRows).toHaveLength(2);
    expect(
      shared.state.monitorResultsRows.every((r) => r.monitorId === "m1")
    ).toBe(true);
    expect(shared.state.usageIncrements).toEqual([
      { userId: "u1", count: 2 },
    ]);
  });

  it("existing URL owned by another monitor of same user: inserts only the link row", async () => {
    shared.state.monitorsRows.push(
      { id: "m1", userId: "u1" },
      { id: "m2", userId: "u1" }
    );
    // Pretend m1 already saved the post.
    shared.state.resultsRows.push({
      id: "r-existing",
      monitorId: "m1",
      sourceUrl: "https://reddit.com/shared",
      title: "Shared",
    });
    shared.state.monitorResultsRows.push({
      monitorId: "m1",
      resultId: "r-existing",
    });

    const { count, ids } = await saveNewResults<FakeItem>({
      items: [{ url: "https://reddit.com/shared", title: "Shared" }],
      monitorId: "m2",
      userId: "u1",
      getSourceUrl: (i) => i.url,
      mapToResult: mapToResult("m2"),
      step: makeStep(),
    });

    expect(count).toBe(1);
    expect(ids).toEqual(["r-existing"]);
    // No new results row inserted.
    expect(shared.state.resultsRows).toHaveLength(1);
    // New link for m2 → r-existing.
    expect(shared.state.monitorResultsRows).toContainEqual({
      monitorId: "m2",
      resultId: "r-existing",
    });
    // No usage bump — this was a reuse, not a new analyzable row.
    expect(shared.state.usageIncrements).toEqual([]);
  });

  it("idempotent re-call with same inputs: returns 0 new ids the second time", async () => {
    shared.state.monitorsRows.push({ id: "m1", userId: "u1" });
    const items = [{ url: "https://reddit.com/x", title: "X" }];

    const first = await saveNewResults<FakeItem>({
      items,
      monitorId: "m1",
      userId: "u1",
      getSourceUrl: (i) => i.url,
      mapToResult: mapToResult("m1"),
      step: makeStep(),
    });
    expect(first.count).toBe(1);

    const second = await saveNewResults<FakeItem>({
      items,
      monitorId: "m1",
      userId: "u1",
      getSourceUrl: (i) => i.url,
      mapToResult: mapToResult("m1"),
      step: makeStep(),
    });
    expect(second.count).toBe(0);
    expect(second.ids).toEqual([]);

    // Only one results row, one link row, one usage bump — the replay is a no-op.
    expect(shared.state.resultsRows).toHaveLength(1);
    expect(shared.state.monitorResultsRows).toHaveLength(1);
    expect(shared.state.usageIncrements).toEqual([
      { userId: "u1", count: 1 },
    ]);
  });

  it("cross-user isolation: another user's existing result is NOT reused", async () => {
    shared.state.monitorsRows.push(
      { id: "m-u1", userId: "u1" },
      { id: "m-u2", userId: "u2" }
    );
    // u1 already has this URL saved.
    shared.state.resultsRows.push({
      id: "r-u1",
      monitorId: "m-u1",
      sourceUrl: "https://reddit.com/same",
      title: "Same",
    });
    shared.state.monitorResultsRows.push({
      monitorId: "m-u1",
      resultId: "r-u1",
    });

    const { count, ids } = await saveNewResults<FakeItem>({
      items: [{ url: "https://reddit.com/same", title: "Same" }],
      monitorId: "m-u2",
      userId: "u2",
      getSourceUrl: (i) => i.url,
      mapToResult: mapToResult("m-u2"),
      step: makeStep(),
    });

    expect(count).toBe(1);
    expect(ids).toHaveLength(1);
    // u2 got a brand-new results row (not r-u1).
    expect(ids[0]).not.toBe("r-u1");
    expect(shared.state.resultsRows).toHaveLength(2);
    // u2 got a usage bump for the fresh row.
    expect(shared.state.usageIncrements).toEqual([
      { userId: "u2", count: 1 },
    ]);
  });
});
