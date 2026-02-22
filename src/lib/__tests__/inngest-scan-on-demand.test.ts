import { describe, it, expect, vi } from "vitest";

const mockQuery = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  pooledDb: {
    query: {
      monitors: { findFirst: (...args: unknown[]) => mockQuery(...args) },
    },
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  monitors: {},
  results: {},
}));

vi.mock("@/lib/limits", () => ({
  getUserPlan: vi.fn().mockResolvedValue({ tier: "pro", platformAccess: ["reddit", "hackernews"] }),
  canAccessPlatformWithPlan: vi.fn().mockReturnValue(true),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

describe("inngest/scan-on-demand", () => {
  it("marks monitor as scanning before starting", async () => {
    mockQuery.mockResolvedValue({
      id: "monitor1",
      userId: "user1",
      platforms: ["reddit"],
      keywords: ["test"],
      companyName: "Test Co",
      audienceId: null,
      monitorType: "keyword",
      discoveryPrompt: null,
    });

    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await mockUpdate().set({ isScanning: true }).where("monitor1");

    expect(mockUpdate).toHaveBeenCalled();
  });

  it("resets isScanning to false after completion", async () => {
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await mockUpdate().set({ isScanning: false }).where("monitor1");

    expect(mockUpdate).toHaveBeenCalled();
  });

  it("returns error if monitor not found", async () => {
    mockQuery.mockResolvedValue(null);

    const monitor = await mockQuery();

    expect(monitor).toBeNull();
  });

  it("returns error if user unauthorized", async () => {
    mockQuery.mockResolvedValue({
      id: "monitor1",
      userId: "different_user",
    });

    const monitor = await mockQuery();

    expect(monitor.userId).not.toBe("user1");
  });

  it("returns success with platform results", async () => {
    const result = {
      success: true,
      monitorId: "monitor1",
      totalResults: 15,
      platformResults: {
        reddit: 10,
        hackernews: 5,
      },
    };

    expect(result.success).toBe(true);
    expect(result.totalResults).toBe(15);
    expect(result.platformResults.reddit).toBe(10);
  });
});
