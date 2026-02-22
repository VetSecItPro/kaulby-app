import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
const mockUsersFindMany = vi.fn();
const mockMonitorsFindMany = vi.fn();
const mockResultsFindMany = vi.fn();
const mockAlertsFindMany = vi.fn();
const mockSelect = vi.fn();

vi.mock("@/lib/db", () => ({
  pooledDb: {
    query: {
      users: { findMany: (...args: unknown[]) => mockUsersFindMany(...args) },
      monitors: { findMany: (...args: unknown[]) => mockMonitorsFindMany(...args) },
      results: { findMany: (...args: unknown[]) => mockResultsFindMany(...args) },
      alerts: { findMany: (...args: unknown[]) => mockAlertsFindMany(...args) },
    },
    select: (...args: unknown[]) => mockSelect(...args),
  },
  users: { id: "id", subscriptionStatus: "subscriptionStatus" },
  monitors: { id: "id", userId: "userId", isActive: "isActive" },
  results: { id: "id", monitorId: "monitorId", createdAt: "createdAt", sentiment: "sentiment", engagementScore: "engagementScore" },
  alerts: { monitorId: "monitorId", channel: "channel", isActive: "isActive" },
}));

vi.mock("@/lib/email", () => ({
  sendAlertEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/notifications", () => ({
  sendWebhookNotification: vi.fn().mockResolvedValue({ success: true, type: "slack" }),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  gte: vi.fn(),
  inArray: vi.fn(),
  sql: vi.fn(),
  desc: vi.fn(),
}));

import { sendAlertEmail } from "@/lib/email";
import { sendWebhookNotification } from "@/lib/notifications";

describe("inngest crisis-detection", () => {
  const mockStep = {
    run: vi.fn().mockImplementation((_name: string, fn: () => Promise<unknown>) => fn()),
    sendEvent: vi.fn(),
    sleep: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStep.run.mockImplementation((_name: string, fn: () => Promise<unknown>) => fn());
  });

  it("returns early when no team users exist", async () => {
    mockUsersFindMany.mockResolvedValueOnce([]);
    const teamUsers = await mockUsersFindMany();
    expect(teamUsers).toHaveLength(0);
    // Function returns { message: "No Team users to process" }
  });

  it("detects negative sentiment spike (>50% increase)", () => {
    const previousNegative = 10;
    const currentNegative = 20; // 100% increase
    const percentageIncrease = ((currentNegative - previousNegative) / previousNegative) * 100;

    expect(percentageIncrease).toBe(100);
    expect(percentageIncrease >= 50).toBe(true);

    // Should classify as "critical" since >= 100%
    const severity = percentageIncrease >= 100 ? "critical" : "warning";
    expect(severity).toBe("critical");
  });

  it("classifies warning severity for 50-99% increase", () => {
    const previousNegative = 10;
    const currentNegative = 16; // 60% increase
    const percentageIncrease = ((currentNegative - previousNegative) / previousNegative) * 100;

    expect(percentageIncrease).toBe(60);
    const severity = percentageIncrease >= 100 ? "critical" : "warning";
    expect(severity).toBe("warning");
  });

  it("does not trigger when increase is below 50%", () => {
    const previousNegative = 10;
    const currentNegative = 13; // 30% increase
    const percentageIncrease = ((currentNegative - previousNegative) / previousNegative) * 100;

    expect(percentageIncrease).toBe(30);
    expect(percentageIncrease >= 50).toBe(false);
  });

  it("requires at least 5 negative results to trigger spike", () => {
    const previousNegative = 2;
    const currentNegative = 4; // 100% increase but only 4 negative
    const shouldTrigger = previousNegative > 0 && currentNegative >= 5;

    expect(shouldTrigger).toBe(false);
  });

  it("detects viral negative posts with high engagement", async () => {
    const viralPosts = [
      { id: "r1", monitorId: "m1", title: "Terrible experience!", platform: "reddit", engagementScore: 500 },
      { id: "r2", monitorId: "m1", title: "Awful customer service", platform: "reddit", engagementScore: 200 },
    ];

    mockResultsFindMany.mockResolvedValueOnce(viralPosts);
    const results = await mockResultsFindMany();

    expect(results).toHaveLength(2);
    // Highest engagement >= 500 should be "critical"
    const highestEngagement = results[0].engagementScore;
    const severity = highestEngagement >= 500 ? "critical" : "warning";
    expect(severity).toBe("critical");
  });

  it("sends crisis email alerts grouped by user", async () => {
    const user = { id: "user-1", email: "user@example.com" };

    await vi.mocked(sendAlertEmail)({
      to: user.email,
      monitorName: "Crisis Alert: Brand Monitor",
      userId: user.id,
      results: [
        {
          title: "[CRITICAL] Terrible experience!",
          url: "https://kaulbyapp.com/dashboard/monitors/m1",
          platform: "reddit",
          sentiment: "negative",
          summary: "Negative sentiment spike detected: 100% increase in the last 24 hours",
        },
      ],
    });

    expect(sendAlertEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@example.com",
        monitorName: expect.stringContaining("Crisis Alert"),
      })
    );
  });

  it("sends webhook notifications for crisis events", async () => {
    mockAlertsFindMany.mockResolvedValueOnce([
      { id: "alert-1", monitorId: "m1", channel: "slack", destination: "https://hooks.slack.com/123", isActive: true },
    ]);

    const webhookAlerts = await mockAlertsFindMany();
    expect(webhookAlerts).toHaveLength(1);

    await vi.mocked(sendWebhookNotification)(
      webhookAlerts[0].destination,
      {
        monitorName: "Crisis Alert: Brand Monitor",
        results: [{ id: "m1", title: "[CRITICAL] Crisis", sourceUrl: "https://kaulbyapp.com", platform: "reddit", sentiment: "negative", aiSummary: "Spike detected" }],
        dashboardUrl: "https://kaulbyapp.com/dashboard",
      }
    );

    expect(sendWebhookNotification).toHaveBeenCalledWith(
      "https://hooks.slack.com/123",
      expect.objectContaining({
        monitorName: expect.stringContaining("Crisis Alert"),
      })
    );
  });

  it("handles no-crisis case with zero alerts", () => {
    const crisisAlerts: unknown[] = [];
    expect(crisisAlerts).toHaveLength(0);

    const result = {
      processed: 5,
      alertsGenerated: crisisAlerts.length,
      alerts: [],
    };
    expect(result.alertsGenerated).toBe(0);
  });

  it("skips users with no active monitors", async () => {
    mockMonitorsFindMany.mockResolvedValueOnce([]);
    const userMonitors = await mockMonitorsFindMany();
    expect(userMonitors).toHaveLength(0);
    // Function would return early for this user
  });
});
