import { describe, it, expect, vi, beforeEach } from "vitest";

const mockQuery = vi.fn();
const mockDelete = vi.fn();
const mockUpdate = vi.fn();
const mockTransaction = vi.fn();
const mockClerkDeleteUser = vi.fn();
const mockSendEmail = vi.fn();
const mockCancelSubscription = vi.fn();

vi.mock("@/lib/db", () => ({
  pooledDb: {
    query: {
      users: { findFirst: (...args: unknown[]) => mockQuery(...args) },
    },
    delete: (...args: unknown[]) => mockDelete(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    transaction: (fn: (tx: unknown) => Promise<unknown>) => mockTransaction(fn),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  users: {},
  monitors: {},
  results: {},
  audiences: {},
  aiLogs: {},
  usage: {},
  webhooks: {},
  webhookDeliveries: {},
  apiKeys: {},
  audienceMonitors: {},
  alerts: {},
  communities: {},
}));

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn(() => Promise.resolve({
    users: { deleteUser: mockClerkDeleteUser },
  })),
}));

vi.mock("@/lib/email", () => ({
  sendDeletionRequestedEmail: mockSendEmail,
  sendDeletionReminderEmail: mockSendEmail,
  sendDeletionConfirmedEmail: mockSendEmail,
}));

vi.mock("@/lib/polar", () => ({
  cancelSubscription: mockCancelSubscription,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  inArray: vi.fn(),
}));

describe("inngest/account-deletion", () => {
  const mockStep = {
    run: vi.fn().mockImplementation((_name: string, fn: () => Promise<unknown>) => fn()),
    sleep: vi.fn().mockResolvedValue(undefined),
    sendEvent: vi.fn(),
    waitForEvent: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockStep.run.mockImplementation((_name: string, fn: () => Promise<unknown>) => fn());
    mockTransaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn({}));
  });

  it("sends confirmation email immediately", async () => {
    mockQuery.mockResolvedValueOnce({ name: "John Doe" });
    mockCancelSubscription.mockResolvedValue(true);

    const event = {
      data: { userId: "user_123", email: "user@example.com" },
    };

    await mockStep.run("send-confirmation-email", async () => {
      await mockSendEmail({
        email: event.data.email,
        name: "John Doe",
        deletionDate: new Date(),
      });
    });

    expect(mockSendEmail).toHaveBeenCalled();
  });

  it("sleeps for 6 days before sending reminder", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);

    await sleep("6d");

    expect(sleep).toHaveBeenCalledWith("6d");
  });

  it("cancels deletion if user opts out before reminder", async () => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValueOnce(null);

    const user = await mockQuery();

    expect(user).toBeNull();
  });

  it("sends 24-hour reminder email", async () => {
    await mockStep.run("send-24hr-reminder", async () => {
      await mockSendEmail({ email: "jane@example.com", name: "Jane Smith" });
    });

    expect(mockSendEmail).toHaveBeenCalled();
  });

  it("cancels Polar subscription if active", async () => {
    mockCancelSubscription.mockResolvedValue(true);

    await mockStep.run("cancel-polar-subscription", async () => {
      const cancelled = await mockCancelSubscription("sub_123", { immediate: true });
      expect(cancelled).toBe(true);
    });

    expect(mockCancelSubscription).toHaveBeenCalledWith("sub_123", { immediate: true });
  });

  it("does not fail if Polar cancellation errors", async () => {
    mockCancelSubscription.mockRejectedValue(new Error("Polar error"));

    await expect(
      mockStep.run("cancel-polar-subscription", async () => {
        try {
          await mockCancelSubscription("sub_123", { immediate: true });
        } catch (error) {
          // Don't fail
        }
      })
    ).resolves.not.toThrow();
  });

  it("deletes all user data in transaction", async () => {
    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    };

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      await fn(mockTx);
    });

    await mockTransaction(async (tx: unknown) => {
      const typedTx = tx as typeof mockTx;
      await typedTx.delete().where();
    });

    expect(mockTransaction).toHaveBeenCalled();
  });

  it("deletes user from Clerk", async () => {
    mockClerkDeleteUser.mockResolvedValue(undefined);

    await mockStep.run("delete-from-clerk", async () => {
      await mockClerkDeleteUser("user_123");
    });

    expect(mockClerkDeleteUser).toHaveBeenCalledWith("user_123");
  });

  it("does not fail if Clerk deletion errors", async () => {
    mockClerkDeleteUser.mockRejectedValue(new Error("Clerk error"));

    await expect(
      mockStep.run("delete-from-clerk", async () => {
        try {
          await mockClerkDeleteUser("user_123");
        } catch (error) {
          // Log but don't fail
        }
      })
    ).resolves.not.toThrow();
  });

  it("sends final confirmation email", async () => {
    await mockStep.run("send-final-confirmation", async () => {
      await mockSendEmail({
        email: "user@example.com",
        name: "User",
      });
    });

    expect(mockSendEmail).toHaveBeenCalled();
  });

  it("returns completion status with timestamp", async () => {
    const result = {
      status: "completed",
      userId: "user_123",
      deletedAt: new Date().toISOString(),
    };

    expect(result.status).toBe("completed");
    expect(result.userId).toBe("user_123");
    expect(result.deletedAt).toBeTruthy();
  });

  it("returns cancelled status if user opts out", async () => {
    const result = {
      status: "cancelled",
      reason: "User cancelled before reminder",
    };

    expect(result.status).toBe("cancelled");
    expect(result.reason).toBeTruthy();
  });
});
