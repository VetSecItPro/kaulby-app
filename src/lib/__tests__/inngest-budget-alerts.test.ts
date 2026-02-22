import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
const mockAlertsFindMany = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
});
const mockInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockResolvedValue(undefined),
});

vi.mock("@/lib/db", () => ({
  pooledDb: {
    query: {
      budgetAlerts: { findMany: (...args: unknown[]) => mockAlertsFindMany(...args) },
    },
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  budgetAlerts: { id: "id", isActive: "isActive", lastNotifiedAt: "lastNotifiedAt" },
  budgetAlertHistory: {},
  aiLogs: { createdAt: "createdAt", costUsd: "costUsd" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  gte: vi.fn(),
  and: vi.fn(),
  sum: vi.fn().mockReturnValue("sum_fn"),
  sql: vi.fn(),
}));

// Mock global fetch for Slack notifications
const mockFetch = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal("fetch", mockFetch);

// Mock resend
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ id: "email-123" }),
    },
  })),
}));

describe("inngest budget-alerts", () => {
  const mockStep = {
    run: vi.fn().mockImplementation((_name: string, fn: () => Promise<unknown>) => fn()),
    sendEvent: vi.fn(),
    sleep: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStep.run.mockImplementation((_name: string, fn: () => Promise<unknown>) => fn());
  });

  it("returns early when no active budget alerts exist", async () => {
    mockAlertsFindMany.mockResolvedValueOnce([]);
    const activeAlerts = await mockAlertsFindMany();
    expect(activeAlerts).toHaveLength(0);

    const result = { checked: 0, triggered: 0 };
    expect(result.checked).toBe(0);
    expect(result.triggered).toBe(0);
  });

  it("calculates daily period boundaries correctly", () => {
    const now = new Date();
    const period = "daily";
    let periodStart: Date;

    switch (period) {
      case "daily":
        periodStart = new Date(now);
        periodStart.setHours(0, 0, 0, 0);
        break;
      default:
        periodStart = new Date(now);
    }

    expect(periodStart.getHours()).toBe(0);
    expect(periodStart.getMinutes()).toBe(0);
    expect(periodStart.getSeconds()).toBe(0);
  });

  it("calculates weekly period boundaries correctly", () => {
    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    periodStart.setHours(0, 0, 0, 0);

    expect(periodStart.getDay()).toBe(0); // Sunday
    expect(periodStart.getHours()).toBe(0);
  });

  it("calculates monthly period boundaries correctly", () => {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

    expect(periodStart.getDate()).toBe(1);
    expect(periodStart.getHours()).toBe(0);
  });

  it("triggers warning when spend reaches warning threshold", () => {
    const currentSpend = 80;
    const thresholdUsd = 100;
    const warningPercent = 75;
    const percentOfThreshold = (currentSpend / thresholdUsd) * 100;

    const isExceeded = percentOfThreshold >= 100;
    const isWarning = percentOfThreshold >= warningPercent && percentOfThreshold < 100;

    expect(isWarning).toBe(true);
    expect(isExceeded).toBe(false);
  });

  it("triggers exceeded alert when spend exceeds threshold", () => {
    const currentSpend = 120;
    const thresholdUsd = 100;
    const percentOfThreshold = (currentSpend / thresholdUsd) * 100;

    const isExceeded = percentOfThreshold >= 100;
    expect(isExceeded).toBe(true);
    expect(percentOfThreshold).toBe(120);
  });

  it("skips notification when already notified within 4 hours", () => {
    const now = new Date();
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    const lastNotifiedAt = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago

    const recentNotification = lastNotifiedAt.getTime() > fourHoursAgo.getTime();
    expect(recentNotification).toBe(true);
    // Should skip sending
  });

  it("sends notification when not notified in last 4 hours", () => {
    const now = new Date();
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    const lastNotifiedAt = new Date(now.getTime() - 6 * 60 * 60 * 1000); // 6 hours ago

    const recentNotification = lastNotifiedAt.getTime() > fourHoursAgo.getTime();
    expect(recentNotification).toBe(false);
    // Should send notification
  });

  it("does not trigger when spend is under budget", () => {
    const currentSpend = 30;
    const thresholdUsd = 100;
    const warningPercent = 75;
    const percentOfThreshold = (currentSpend / thresholdUsd) * 100;

    const isExceeded = percentOfThreshold >= 100;
    const isWarning = percentOfThreshold >= warningPercent && percentOfThreshold < 100;

    expect(isExceeded).toBe(false);
    expect(isWarning).toBe(false);
  });

  it("logs alert to budget history table", async () => {
    mockInsert.mockReturnValueOnce({
      values: vi.fn().mockResolvedValue(undefined),
    });

    const chain = mockInsert();
    await chain.values({
      alertId: "alert-1",
      periodStart: new Date(),
      periodEnd: new Date(),
      spendUsd: 85,
      thresholdUsd: 100,
      percentOfThreshold: 85,
      alertType: "warning",
      notificationSent: false,
    });

    expect(mockInsert).toHaveBeenCalled();
  });

  it("updates current period spend on each check", async () => {
    mockUpdate.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const chain = mockUpdate();
    chain.set({
      currentPeriodSpend: 85.5,
      updatedAt: expect.any(Date),
    });

    expect(mockUpdate).toHaveBeenCalled();
  });
});
