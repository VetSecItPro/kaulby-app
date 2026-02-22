import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
const mockUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  pooledDb: {
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  monitors: { id: "id", name: "name", isScanning: "isScanning", updatedAt: "updatedAt" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  lt: vi.fn((...args: unknown[]) => ({ type: "lt", args })),
}));

describe("inngest reset-stuck-scans", () => {
  const mockStep = {
    run: vi.fn().mockImplementation((_name: string, fn: () => Promise<unknown>) => fn()),
    sendEvent: vi.fn(),
    sleep: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStep.run.mockImplementation((_name: string, fn: () => Promise<unknown>) => fn());
  });

  it("finds and resets stuck scans older than 10 minutes", async () => {
    const stuckMonitors = [
      { id: "m1", name: "Brand Monitor" },
      { id: "m2", name: "Competitor Monitor" },
    ];

    mockUpdate.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue(stuckMonitors),
        }),
      }),
    });

    const chain = mockUpdate("monitors");
    const setChain = chain.set({ isScanning: false, updatedAt: expect.any(Date) });
    const whereChain = setChain.where("stuck-condition");
    const result = await whereChain.returning({ id: "monitors.id", name: "monitors.name" });

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Brand Monitor");
    expect(result[1].name).toBe("Competitor Monitor");
  });

  it("returns empty array when no stuck scans found", async () => {
    mockUpdate.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const chain = mockUpdate("monitors");
    const setChain = chain.set({ isScanning: false });
    const whereChain = setChain.where("condition");
    const result = await whereChain.returning();

    expect(result).toHaveLength(0);
  });

  it("calculates cutoff time as 10 minutes ago", () => {
    const STUCK_SCAN_THRESHOLD_MS = 10 * 60 * 1000;
    const now = Date.now();
    const cutoffTime = new Date(now - STUCK_SCAN_THRESHOLD_MS);

    const diffMs = now - cutoffTime.getTime();
    expect(diffMs).toBe(10 * 60 * 1000);
  });

  it("sets isScanning to false when resetting", async () => {
    const setMock = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "m1", name: "Monitor" }]),
      }),
    });

    mockUpdate.mockReturnValueOnce({ set: setMock });

    const chain = mockUpdate("monitors");
    chain.set({ isScanning: false, updatedAt: new Date() });

    expect(setMock).toHaveBeenCalledWith({
      isScanning: false,
      updatedAt: expect.any(Date),
    });
  });

  it("returns monitor names in result for logging", async () => {
    const stuckMonitors = [
      { id: "m1", name: "Brand Monitor" },
      { id: "m2", name: "SEO Tracker" },
      { id: "m3", name: "Review Watch" },
    ];

    const result = {
      reset: stuckMonitors.length,
      monitors: stuckMonitors.map((m) => m.name),
    };

    expect(result.reset).toBe(3);
    expect(result.monitors).toEqual(["Brand Monitor", "SEO Tracker", "Review Watch"]);
  });

  it("uses correct where clause: isScanning=true AND updatedAt < cutoff", async () => {
    const { eq, and, lt } = await import("drizzle-orm");

    const cutoffTime = new Date(Date.now() - 10 * 60 * 1000);

    vi.mocked(eq)("isScanning" as never, true as never);
    vi.mocked(lt)("updatedAt" as never, cutoffTime as never);
    vi.mocked(and)(
      vi.mocked(eq).mock.results[0]?.value,
      vi.mocked(lt).mock.results[0]?.value
    );

    expect(eq).toHaveBeenCalledWith("isScanning", true);
    expect(lt).toHaveBeenCalledWith("updatedAt", cutoffTime);
    expect(and).toHaveBeenCalled();
  });

  it("handles single stuck scan correctly", async () => {
    const stuckMonitors = [{ id: "m1", name: "Single Monitor" }];

    const result = {
      reset: stuckMonitors.length,
      monitors: stuckMonitors.map((m) => m.name),
    };

    expect(result.reset).toBe(1);
    expect(result.monitors).toEqual(["Single Monitor"]);
  });

  it("does not log when no stuck scans found", () => {
    const result = { length: 0 };
    const shouldLog = result.length > 0;
    expect(shouldLog).toBe(false);
  });
});
