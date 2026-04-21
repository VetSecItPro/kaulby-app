import { describe, it, expect, vi, beforeEach } from "vitest";

// ────────────────────────────────────────────────────────────────────────────
// Task 1.2 — retention for aiVisibilityChecks, emailEvents, errorLogs, chatMessages.
// These tests mock pooledDb and drive the extracted runDataRetention handler
// directly with a stub Inngest step/logger. They verify: (a) each of the 8 new
// steps runs, (b) the returned breakdown aggregates per-table deletion counts,
// (c) the soft-delete step path invokes both select+update while the
// hard-delete step path invokes both select+delete.
// ────────────────────────────────────────────────────────────────────────────

// vi.mock is hoisted; shared state must live inside vi.hoisted so the mock
// factory can reach it safely.
const shared = vi.hoisted(() => {
  const state = {
    stepCounts: {} as Record<string, number>,
    writeOps: [] as Array<{ stepId: string; kind: "update" | "delete" }>,
    currentStepId: "",
  };
  function makeChain(opType: "select" | "update" | "delete") {
    const chain: Record<string, unknown> = {};
    const noop = (): Record<string, unknown> => chain;
    chain.from = noop;
    chain.where = (..._args: unknown[]) => {
      if (opType === "select") {
        const value = state.stepCounts[state.currentStepId] ?? 0;
        return Promise.resolve([{ value }]);
      }
      state.writeOps.push({
        stepId: state.currentStepId,
        kind: opType as "update" | "delete",
      });
      return Promise.resolve(undefined);
    };
    chain.set = noop;
    return chain;
  }
  const pooledDbMock = {
    select: () => makeChain("select"),
    update: () => makeChain("update"),
    delete: () => makeChain("delete"),
  };
  return { state, pooledDbMock };
});

vi.mock("@/lib/db", () => ({
  pooledDb: shared.pooledDbMock,
  db: shared.pooledDbMock,
}));

// Inngest client isn't used by runDataRetention directly, but is imported at
// module top-level so it needs to be mockable enough to not explode.
vi.mock("../../lib/inngest/client", () => ({
  inngest: {
    createFunction: (_cfg: unknown, _trigger: unknown, handler: unknown) => handler,
  },
}));

// Import AFTER mocks are registered.
import { runDataRetention } from "@/lib/inngest/functions/data-retention";

function makeStep() {
  const ran: string[] = [];
  return {
    ran,
    step: {
      run: async <T,>(id: string, fn: () => Promise<T>): Promise<T> => {
        ran.push(id);
        shared.state.currentStepId = id;
        const result = await fn();
        shared.state.currentStepId = "";
        return result;
      },
    },
  };
}

const silentLogger = { info: () => {}, error: () => {} };

function setCounts(counts: Record<string, number>) {
  shared.state.stepCounts = counts;
}

beforeEach(() => {
  shared.state.stepCounts = {};
  shared.state.writeOps = [];
  shared.state.currentStepId = "";
});

describe("runDataRetention — Task 1.2 unbounded-table cleanup", () => {
  it("runs all 8 new retention steps in addition to existing results/orphaned cleanup", async () => {
    const { step, ran } = makeStep();
    await runDataRetention({ step, logger: silentLogger });

    // Existing steps (sanity)
    expect(ran).toContain("cleanup-free-tier");
    expect(ran).toContain("cleanup-pro-tier");
    expect(ran).toContain("cleanup-team-tier");
    expect(ran).toContain("cleanup-orphaned-results");

    // 8 new steps from Task 1.2 (4 soft + 4 hard)
    expect(ran).toContain("soft-delete-ai-visibility");
    expect(ran).toContain("hard-delete-ai-visibility");
    expect(ran).toContain("soft-delete-email-events");
    expect(ran).toContain("hard-delete-email-events");
    expect(ran).toContain("soft-delete-error-logs");
    expect(ran).toContain("hard-delete-error-logs");
    expect(ran).toContain("soft-delete-chat-messages");
    expect(ran).toContain("hard-delete-chat-messages");
  });

  it("aggregates aiVisibilityChecks soft/hard deletion counts into the return payload", async () => {
    setCounts({
      "soft-delete-ai-visibility": 12,
      "hard-delete-ai-visibility": 3,
    });
    const { step } = makeStep();
    const out = await runDataRetention({ step, logger: silentLogger });
    expect(out.unboundedTables.aiVisibilityChecks).toEqual({
      softDeleted: 12,
      hardDeleted: 3,
    });
    // Soft-delete should emit UPDATE, hard-delete should emit DELETE.
    expect(shared.state.writeOps).toContainEqual({ stepId: "soft-delete-ai-visibility", kind: "update" });
    expect(shared.state.writeOps).toContainEqual({ stepId: "hard-delete-ai-visibility", kind: "delete" });
  });

  it("aggregates emailEvents soft/hard deletion counts into the return payload", async () => {
    setCounts({
      "soft-delete-email-events": 55,
      "hard-delete-email-events": 7,
    });
    const { step } = makeStep();
    const out = await runDataRetention({ step, logger: silentLogger });
    expect(out.unboundedTables.emailEvents).toEqual({ softDeleted: 55, hardDeleted: 7 });
    expect(shared.state.writeOps).toContainEqual({ stepId: "soft-delete-email-events", kind: "update" });
    expect(shared.state.writeOps).toContainEqual({ stepId: "hard-delete-email-events", kind: "delete" });
  });

  it("aggregates errorLogs soft/hard deletion counts into the return payload", async () => {
    setCounts({
      "soft-delete-error-logs": 4,
      "hard-delete-error-logs": 1,
    });
    const { step } = makeStep();
    const out = await runDataRetention({ step, logger: silentLogger });
    expect(out.unboundedTables.errorLogs).toEqual({ softDeleted: 4, hardDeleted: 1 });
    expect(shared.state.writeOps).toContainEqual({ stepId: "soft-delete-error-logs", kind: "update" });
    expect(shared.state.writeOps).toContainEqual({ stepId: "hard-delete-error-logs", kind: "delete" });
  });

  it("aggregates chatMessages soft/hard deletion counts into the return payload", async () => {
    setCounts({
      "soft-delete-chat-messages": 100,
      "hard-delete-chat-messages": 25,
    });
    const { step } = makeStep();
    const out = await runDataRetention({ step, logger: silentLogger });
    expect(out.unboundedTables.chatMessages).toEqual({ softDeleted: 100, hardDeleted: 25 });
    expect(shared.state.writeOps).toContainEqual({ stepId: "soft-delete-chat-messages", kind: "update" });
    expect(shared.state.writeOps).toContainEqual({ stepId: "hard-delete-chat-messages", kind: "delete" });
  });

  it("skips UPDATE/DELETE writes when a step has 0 rows to process", async () => {
    // All 8 new step counts default to 0 via beforeEach.
    const { step } = makeStep();
    const out = await runDataRetention({ step, logger: silentLogger });
    // With zero counts, no write ops should fire for the 8 new steps.
    const newStepIds = new Set([
      "soft-delete-ai-visibility",
      "hard-delete-ai-visibility",
      "soft-delete-email-events",
      "hard-delete-email-events",
      "soft-delete-error-logs",
      "hard-delete-error-logs",
      "soft-delete-chat-messages",
      "hard-delete-chat-messages",
    ]);
    const newWrites = shared.state.writeOps.filter((w) => newStepIds.has(w.stepId));
    expect(newWrites).toHaveLength(0);
    // All four table breakdowns should be zero.
    expect(out.unboundedTables.aiVisibilityChecks).toEqual({ softDeleted: 0, hardDeleted: 0 });
    expect(out.unboundedTables.emailEvents).toEqual({ softDeleted: 0, hardDeleted: 0 });
    expect(out.unboundedTables.errorLogs).toEqual({ softDeleted: 0, hardDeleted: 0 });
    expect(out.unboundedTables.chatMessages).toEqual({ softDeleted: 0, hardDeleted: 0 });
  });
});
