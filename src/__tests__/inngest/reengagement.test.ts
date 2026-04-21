import { describe, it, expect, vi, beforeEach } from "vitest";

// ────────────────────────────────────────────────────────────────────────────
// Task DL.1 — fix N+1 in reengagement.ts.
// The old handler ran 3 DB queries per eligible user (300+ roundtrips for 100
// users). The new handler issues 3 aggregate queries total (GROUP BY / DISTINCT
// ON user_id), then does in-memory lookups per user.
//
// These tests mock pooledDb and drive the extracted runDetectInactiveUsers
// handler directly with a stub Inngest step. They verify:
//   (a) only 3 aggregate DB calls execute regardless of eligible user count
//   (b) monitorCount / mentionCount / topMention are sourced from the
//       aggregate maps and correctly populated
//   (c) users missing from the maps (zero monitors, zero mentions) are
//       handled as zero and skipped (no event sent)
// ────────────────────────────────────────────────────────────────────────────

type InactiveUser = {
  id: string;
  email: string;
  name: string | null;
  lastActiveAt: Date | null;
  reengagementEmailSentAt: Date | null;
  reengagementOptOut: boolean;
  subscriptionStatus: string;
};

const shared = vi.hoisted(() => {
  const state = {
    // Controlled by each test.
    inactiveUsers: [] as InactiveUser[],
    // Aggregate-query results keyed by userId.
    monitorCountRows: [] as Array<{ userId: string; count: number }>,
    mentionCountRows: [] as Array<{ userId: string; count: number }>,
    topMentionRows: [] as Array<{
      userId: string;
      title: string;
      platform: string;
      sourceUrl: string;
    }>,
    // Call tracking.
    selectCalls: 0,
    executeCalls: 0,
    executeQueries: [] as string[],
  };

  // .select().from().where().groupBy() → resolves to monitorCountRows
  function makeSelectChain() {
    state.selectCalls += 1;
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.where = () => chain;
    chain.groupBy = () => Promise.resolve(state.monitorCountRows);
    return chain;
  }

  // .execute(sql) → returns {rows: [...]} alternating mentionCounts then topMentions
  function execute(query: unknown): Promise<{ rows: unknown[] }> {
    state.executeCalls += 1;
    const q = String(query);
    state.executeQueries.push(q);
    // The mention-counts query uses COUNT(r.id). The top-mention query uses
    // DISTINCT ON. We dispatch by call order because string inspection of a
    // drizzle sql`` object in tests is fragile.
    if (state.executeCalls === 1) {
      return Promise.resolve({ rows: state.mentionCountRows });
    }
    return Promise.resolve({ rows: state.topMentionRows });
  }

  const pooledDbMock = {
    query: {
      users: {
        findMany: async () => state.inactiveUsers,
      },
    },
    select: () => makeSelectChain(),
    execute,
    // Not used by the handler under test but harmless to stub.
    update: () => ({
      set: () => ({ where: async () => undefined }),
    }),
  };

  return { state, pooledDbMock };
});

vi.mock("@/lib/db", () => ({
  pooledDb: shared.pooledDbMock,
  db: shared.pooledDbMock,
}));

vi.mock("../../lib/inngest/client", () => ({
  inngest: {
    createFunction: (_cfg: unknown, _trigger: unknown, handler: unknown) =>
      handler,
  },
}));

vi.mock("@/lib/email", () => ({
  sendReengagementEmail: vi.fn(async () => undefined),
}));

// Import AFTER mocks are registered.
import { runDetectInactiveUsers } from "@/lib/inngest/functions/reengagement";

function makeStep() {
  const ran: string[] = [];
  const events: Array<{ id: string; payload: unknown }> = [];
  return {
    ran,
    events,
    step: {
      run: async <T,>(id: string, fn: () => Promise<T>): Promise<T> => {
        ran.push(id);
        return fn();
      },
      sendEvent: async (id: string, payload: unknown) => {
        events.push({ id, payload });
        return { ids: [id] };
      },
    },
  };
}

beforeEach(() => {
  shared.state.inactiveUsers = [];
  shared.state.monitorCountRows = [];
  shared.state.mentionCountRows = [];
  shared.state.topMentionRows = [];
  shared.state.selectCalls = 0;
  shared.state.executeCalls = 0;
  shared.state.executeQueries = [];
});

describe("runDetectInactiveUsers — Task DL.1 N+1 fix", () => {
  it("runs only 3 aggregate queries for N eligible users (not 3N)", async () => {
    // 3 eligible users, all never received a reengagement email.
    const lastActive = new Date("2026-04-01T00:00:00Z");
    shared.state.inactiveUsers = [
      {
        id: "u1",
        email: "a@x.com",
        name: "A",
        lastActiveAt: lastActive,
        reengagementEmailSentAt: null,
        reengagementOptOut: false,
        subscriptionStatus: "pro",
      },
      {
        id: "u2",
        email: "b@x.com",
        name: null,
        lastActiveAt: lastActive,
        reengagementEmailSentAt: null,
        reengagementOptOut: false,
        subscriptionStatus: "team",
      },
      {
        id: "u3",
        email: "c@x.com",
        name: "C",
        lastActiveAt: null,
        reengagementEmailSentAt: null,
        reengagementOptOut: false,
        subscriptionStatus: "pro",
      },
    ];
    shared.state.monitorCountRows = [
      { userId: "u1", count: 3 },
      { userId: "u2", count: 1 },
      // u3 missing → should default to 0
    ];
    shared.state.mentionCountRows = [
      { userId: "u1", count: 7 },
      { userId: "u2", count: 0 },
    ];
    shared.state.topMentionRows = [
      {
        userId: "u1",
        title: "Great thread",
        platform: "reddit",
        sourceUrl: "https://reddit.com/x",
      },
    ];

    const { step } = makeStep();
    await runDetectInactiveUsers({ step });

    // Exactly 1 .select() call (monitor counts) + 2 .execute() calls
    // (mention counts, top mentions). Total 3 aggregate roundtrips.
    expect(shared.state.selectCalls).toBe(1);
    expect(shared.state.executeCalls).toBe(2);
  });

  it("populates per-user stats from aggregate maps and sends events", async () => {
    const lastActive = new Date("2026-04-01T00:00:00Z");
    shared.state.inactiveUsers = [
      {
        id: "u1",
        email: "a@x.com",
        name: "A",
        lastActiveAt: lastActive,
        reengagementEmailSentAt: null,
        reengagementOptOut: false,
        subscriptionStatus: "pro",
      },
    ];
    shared.state.monitorCountRows = [{ userId: "u1", count: 5 }];
    shared.state.mentionCountRows = [{ userId: "u1", count: 9 }];
    shared.state.topMentionRows = [
      {
        userId: "u1",
        title: "Hot discussion",
        platform: "hackernews",
        sourceUrl: "https://news.ycombinator.com/item?id=1",
      },
    ];

    const { step, events } = makeStep();
    const out = await runDetectInactiveUsers({ step });

    expect(out.processed).toBe(1);
    expect(out.skipped).toBe(0);
    expect(events).toHaveLength(1);
    const payload = events[0].payload as {
      name: string;
      data: {
        userId: string;
        stats: {
          activeMonitors: number;
          newMentions: number;
          topMention?: { title: string; platform: string; url: string };
        };
      };
    };
    expect(payload.name).toBe("user/reengagement.send");
    expect(payload.data.userId).toBe("u1");
    expect(payload.data.stats.activeMonitors).toBe(5);
    expect(payload.data.stats.newMentions).toBe(9);
    expect(payload.data.stats.topMention).toEqual({
      title: "Hot discussion",
      platform: "hackernews",
      url: "https://news.ycombinator.com/item?id=1",
    });
  });

  it("skips users with zero monitors AND zero mentions (no event sent)", async () => {
    const lastActive = new Date("2026-04-01T00:00:00Z");
    shared.state.inactiveUsers = [
      {
        id: "u1",
        email: "a@x.com",
        name: "A",
        lastActiveAt: lastActive,
        reengagementEmailSentAt: null,
        reengagementOptOut: false,
        subscriptionStatus: "pro",
      },
      {
        id: "u2",
        email: "b@x.com",
        name: "B",
        lastActiveAt: lastActive,
        reengagementEmailSentAt: null,
        reengagementOptOut: false,
        subscriptionStatus: "pro",
      },
    ];
    // u1 has 2 monitors + 0 mentions → eligible (activeMonitors>0).
    // u2 has no monitor/mention rows at all → skipped.
    shared.state.monitorCountRows = [{ userId: "u1", count: 2 }];
    shared.state.mentionCountRows = [];
    shared.state.topMentionRows = [];

    const { step, events } = makeStep();
    const out = await runDetectInactiveUsers({ step });

    expect(out.processed).toBe(1);
    expect(out.skipped).toBe(1);
    expect(events).toHaveLength(1);
    const payload = events[0].payload as { data: { userId: string } };
    expect(payload.data.userId).toBe("u1");
  });

  it("filters opted-out users and cooldown users before any aggregate query", async () => {
    const lastActive = new Date("2026-04-01T00:00:00Z");
    const recentSend = new Date(); // within 30d cooldown
    shared.state.inactiveUsers = [
      {
        id: "opted-out",
        email: "o@x.com",
        name: null,
        lastActiveAt: lastActive,
        reengagementEmailSentAt: null,
        reengagementOptOut: true,
        subscriptionStatus: "pro",
      },
      {
        id: "cooldown",
        email: "c@x.com",
        name: null,
        lastActiveAt: lastActive,
        reengagementEmailSentAt: recentSend,
        reengagementOptOut: false,
        subscriptionStatus: "pro",
      },
    ];

    const { step } = makeStep();
    const out = await runDetectInactiveUsers({ step });

    // No eligible users → no aggregate queries executed at all.
    expect(out.eligible).toBe(0);
    expect(shared.state.selectCalls).toBe(0);
    expect(shared.state.executeCalls).toBe(0);
  });

  it("returns zero counts when no inactive users match", async () => {
    shared.state.inactiveUsers = [];
    const { step } = makeStep();
    const out = await runDetectInactiveUsers({ step });
    expect(out).toEqual({
      totalInactive: 0,
      eligible: 0,
      processed: 0,
      skipped: 0,
      processedUserIds: [],
    });
    expect(shared.state.selectCalls).toBe(0);
    expect(shared.state.executeCalls).toBe(0);
  });
});
