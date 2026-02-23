import { describe, it, expect, vi } from "vitest";

// Mock dependencies that server-cache imports
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    query: {
      monitors: { findMany: vi.fn().mockResolvedValue([]) },
      results: { findMany: vi.fn().mockResolvedValue([]) },
    },
  },
}));

vi.mock("@/lib/db/schema", () => ({
  monitors: {},
  results: {},
  users: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  count: vi.fn(),
  sql: vi.fn(),
}));

vi.mock("@/lib/limits", () => ({
  getUserPlan: vi.fn().mockResolvedValue({ plan: "free" }),
}));

// Note: server-cache uses Next.js unstable_cache which is difficult to test in isolation
// We verify the module structure and exports
describe("server-cache", () => {
  it("exports getCachedMonitors", async () => {
    const mod = await import("../server-cache");
    expect(mod.getCachedMonitors).toBeDefined();
    expect(typeof mod.getCachedMonitors).toBe("function");
  });

  it("exports getCachedMonitorIds", async () => {
    const mod = await import("../server-cache");
    expect(mod.getCachedMonitorIds).toBeDefined();
    expect(typeof mod.getCachedMonitorIds).toBe("function");
  });

  it("exports getCachedUserPlan", async () => {
    const mod = await import("../server-cache");
    expect(mod.getCachedUserPlan).toBeDefined();
    expect(typeof mod.getCachedUserPlan).toBe("function");
  });

  it("exports getCachedResultsCount", async () => {
    const mod = await import("../server-cache");
    expect(mod.getCachedResultsCount).toBeDefined();
    expect(typeof mod.getCachedResultsCount).toBe("function");
  });
});
