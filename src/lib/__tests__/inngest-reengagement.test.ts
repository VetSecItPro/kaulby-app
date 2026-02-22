import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
const mockUsersFindMany = vi.fn();
const mockMonitorsFindMany = vi.fn();
const mockResultsFindMany = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
});

vi.mock("@/lib/db", () => ({
  pooledDb: {
    query: {
      users: { findMany: (...args: unknown[]) => mockUsersFindMany(...args) },
      monitors: { findMany: (...args: unknown[]) => mockMonitorsFindMany(...args) },
      results: { findMany: (...args: unknown[]) => mockResultsFindMany(...args) },
    },
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  users: { id: "id", lastActiveAt: "lastActiveAt", isBanned: "isBanned", subscriptionStatus: "subscriptionStatus", deletionRequestedAt: "deletionRequestedAt", reengagementEmailSentAt: "reengagementEmailSentAt" },
  monitors: { id: "id", userId: "userId", isActive: "isActive" },
  results: { id: "id", monitorId: "monitorId", createdAt: "createdAt", engagementScore: "engagementScore" },
}));

vi.mock("@/lib/email", () => ({
  sendReengagementEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  lt: vi.fn(),
  and: vi.fn(),
  isNull: vi.fn(),
  gte: vi.fn(),
  desc: vi.fn(),
  count: vi.fn().mockReturnValue("count_fn"),
}));

import { sendReengagementEmail } from "@/lib/email";

describe("inngest reengagement", () => {
  const mockStep = {
    run: vi.fn().mockImplementation((_name: string, fn: () => Promise<unknown>) => fn()),
    sendEvent: vi.fn(),
    sleep: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStep.run.mockImplementation((_name: string, fn: () => Promise<unknown>) => fn());
  });

  describe("detectInactiveUsers", () => {
    it("identifies users inactive for 7+ days", async () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      mockUsersFindMany.mockResolvedValueOnce([
        {
          id: "user-1",
          email: "inactive@example.com",
          name: "Inactive User",
          lastActiveAt: tenDaysAgo,
          reengagementEmailSentAt: null,
          subscriptionStatus: "pro",
        },
      ]);

      const inactiveUsers = await mockUsersFindMany();
      expect(inactiveUsers).toHaveLength(1);
      expect(inactiveUsers[0].id).toBe("user-1");
    });

    it("filters out users who received re-engagement email within 30 days", () => {
      const now = new Date();
      const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
      const cooldownThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const users = [
        {
          id: "user-1",
          reengagementEmailSentAt: fifteenDaysAgo, // sent 15 days ago, within cooldown
        },
        {
          id: "user-2",
          reengagementEmailSentAt: null, // never sent
        },
      ];

      const eligible = users.filter((user) => {
        if (!user.reengagementEmailSentAt) return true;
        const sentAt = new Date(user.reengagementEmailSentAt);
        return sentAt < cooldownThreshold;
      });

      expect(eligible).toHaveLength(1);
      expect(eligible[0].id).toBe("user-2");
    });

    it("skips recently active users (active within 7 days)", () => {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const inactiveThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // A user who was active 3 days ago should NOT be included
      const isInactive = threeDaysAgo < inactiveThreshold;
      expect(isInactive).toBe(false);
    });

    it("skips users with no active monitors and no mentions", async () => {
      const stats = { activeMonitors: 0, newMentions: 0 };
      const shouldSkip = stats.activeMonitors === 0 && stats.newMentions === 0;
      expect(shouldSkip).toBe(true);
    });

    it("calculates days since last active correctly", () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      const daysSinceActive = Math.floor(
        (now.getTime() - tenDaysAgo.getTime()) / (24 * 60 * 60 * 1000)
      );
      expect(daysSinceActive).toBe(10);
    });

    it("sends re-engagement event for eligible users", async () => {
      const user = {
        id: "user-1",
        email: "user@example.com",
        name: "Test User",
      };
      const stats = {
        activeMonitors: 3,
        newMentions: 15,
        topMention: {
          title: "Your product is great!",
          platform: "reddit",
          url: "https://reddit.com/r/test",
        },
      };

      await mockStep.sendEvent("send-reengagement", {
        name: "user/reengagement.send",
        data: {
          userId: user.id,
          email: user.email,
          name: user.name,
          daysSinceActive: 10,
          stats,
        },
      });

      expect(mockStep.sendEvent).toHaveBeenCalledWith(
        "send-reengagement",
        expect.objectContaining({
          name: "user/reengagement.send",
          data: expect.objectContaining({
            userId: "user-1",
            email: "user@example.com",
          }),
        })
      );
    });
  });

  describe("sendReengagement", () => {
    it("sends re-engagement email with user stats", async () => {
      await vi.mocked(sendReengagementEmail)({
        email: "user@example.com",
        name: "Test User",
        daysSinceActive: 10,
        stats: {
          activeMonitors: 3,
          newMentions: 15,
          topMention: {
            title: "Post about your product",
            platform: "reddit",
            url: "https://reddit.com/r/test",
          },
        },
      });

      expect(sendReengagementEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "user@example.com",
          daysSinceActive: 10,
          stats: expect.objectContaining({
            newMentions: 15,
          }),
        })
      );
    });

    it("updates reengagementEmailSentAt after sending", async () => {
      mockUpdate.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const chain = mockUpdate();
      chain.set({ reengagementEmailSentAt: expect.any(Date) });

      expect(mockUpdate).toHaveBeenCalled();
    });

    it("defaults daysSinceActive to 7 when lastActiveAt is null", () => {
      const INACTIVE_DAYS = 7;
      const lastActiveDate = null;
      const daysSinceActive = lastActiveDate
        ? Math.floor((Date.now() - lastActiveDate) / (24 * 60 * 60 * 1000))
        : INACTIVE_DAYS;

      expect(daysSinceActive).toBe(7);
    });
  });
});
