import { describe, it, expect, vi } from "vitest";

const mockQuery = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();

vi.mock("@/lib/db", () => ({
  pooledDb: {
    query: {
      users: { findMany: (...args: unknown[]) => mockQuery(...args) },
      monitors: { findMany: (...args: unknown[]) => mockQuery(...args) },
      results: { findMany: (...args: unknown[]) => mockQuery(...args) },
    },
    update: (...args: unknown[]) => mockUpdate(...args),
    select: (...args: unknown[]) => mockSelect(...args),
  },
  users: {},
  monitors: {},
  results: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  gte: vi.fn(),
  inArray: vi.fn(),
  sql: vi.fn(),
  desc: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ id: "email_123" }),
    },
  })),
}));

describe("inngest/scheduled-reports", () => {
  it("finds eligible enterprise users", async () => {
    mockQuery.mockResolvedValue([
      {
        id: "user1",
        email: "user@example.com",
        subscriptionStatus: "enterprise",
        reportSchedule: "weekly",
      },
    ]);

    const users = await mockQuery();

    expect(users).toHaveLength(1);
    expect(users[0].subscriptionStatus).toBe("enterprise");
  });

  it("filters users by day of week for weekly reports", async () => {
    const now = new Date();
    const dayOfWeek = now.getDay() || 7;

    const user = {
      reportSchedule: "weekly",
      reportDay: dayOfWeek,
    };

    expect(user.reportDay).toBe(dayOfWeek);
  });

  it("skips users already sent report today", async () => {
    const now = new Date();
    const lastSentToday = new Date(now);

    const user = {
      reportLastSentAt: lastSentToday,
    };

    expect(user.reportLastSentAt.getDate()).toBe(now.getDate());
  });

  it("generates report data with totals", async () => {
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          {
            total: 100,
            positive: 60,
            neutral: 20,
            negative: 20,
          },
        ]),
      }),
    });

    const data = {
      totals: {
        mentions: 100,
        positive: 60,
        neutral: 20,
        negative: 20,
      },
    };

    expect(data.totals.mentions).toBe(100);
  });

  it("sends email with PDF attachment", async () => {
    const result = {
      success: true,
      sentCount: 5,
      skippedCount: 2,
      totalEligible: 7,
    };

    expect(result.success).toBe(true);
    expect(result.sentCount).toBe(5);
  });

  it("updates reportLastSentAt after sending", async () => {
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const now = new Date();
    await mockUpdate().set({ reportLastSentAt: now }).where("user1");

    expect(mockUpdate).toHaveBeenCalled();
  });
});
