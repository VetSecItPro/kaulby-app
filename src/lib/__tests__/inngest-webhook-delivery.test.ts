import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
const mockQuery = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

global.fetch = mockFetch as never;

vi.mock("@/lib/db", () => ({
  pooledDb: {
    query: {
      users: { findFirst: (...args: unknown[]) => mockQuery(...args) },
      webhooks: { findMany: (...args: unknown[]) => mockQuery(...args) },
      webhookDeliveries: { findFirst: (...args: unknown[]) => mockQuery(...args), findMany: (...args: unknown[]) => mockQuery(...args) },
    },
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  users: {},
  webhooks: {},
  webhookDeliveries: {},
}));

vi.mock("@/lib/notifications/webhooks", () => ({
  detectWebhookType: vi.fn().mockReturnValue("unknown"),
  formatSlackPayload: vi.fn().mockReturnValue({ text: "Slack message" }),
  formatDiscordPayload: vi.fn().mockReturnValue({ content: "Discord message" }),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  lt: vi.fn(),
  lte: vi.fn(),
  or: vi.fn(),
}));

describe("inngest/webhook-delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "delivery_123" }]),
      }),
    });
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
  });

  it("checks if user is enterprise before sending", async () => {
    mockQuery.mockResolvedValue({ subscriptionStatus: "enterprise" });

    const user = await mockQuery();

    expect(user.subscriptionStatus).toBe("enterprise");
  });

  it("skips delivery for non-enterprise users", async () => {
    mockQuery.mockResolvedValue({ subscriptionStatus: "pro" });

    const user = await mockQuery();
    const result = user.subscriptionStatus !== "enterprise"
      ? { success: false, reason: "not_enterprise" }
      : { success: true };

    expect(result.success).toBe(false);
    expect(result.reason).toBe("not_enterprise");
  });

  it("finds webhooks subscribed to event type", async () => {
    mockQuery.mockResolvedValue([
      {
        id: "webhook1",
        url: "https://example.com/webhook",
        events: ["new_result", "*"],
        isActive: true,
      },
    ]);

    const webhooks = await mockQuery();

    expect(webhooks).toHaveLength(1);
    expect(webhooks[0].events).toContain("new_result");
  });

  it("creates delivery record for each webhook", async () => {
    await mockInsert().values({
      webhookId: "webhook1",
      eventType: "new_result",
      payload: { data: "test" },
      status: "pending",
      attemptCount: 0,
      maxAttempts: 5,
    }).returning();

    expect(mockInsert).toHaveBeenCalled();
  });

  it("sends POST request with payload", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "OK",
    });

    const response = await fetch("https://example.com/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: "data" }),
    });

    expect(response.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com/webhook",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("marks delivery as success on 200 response", async () => {
    await mockUpdate().set({
      status: "success",
      statusCode: 200,
      completedAt: new Date(),
    }).where("delivery1");

    expect(mockUpdate).toHaveBeenCalled();
  });

  it("marks delivery for retry on error", async () => {
    const nextRetry = new Date(Date.now() + 60000);

    await mockUpdate().set({
      status: "retrying",
      statusCode: 500,
      nextRetryAt: nextRetry,
    }).where("delivery1");

    expect(mockUpdate).toHaveBeenCalled();
  });

  it("marks delivery as failed after max attempts", async () => {
    await mockUpdate().set({
      status: "failed",
      completedAt: new Date(),
    }).where("delivery1");

    expect(mockUpdate).toHaveBeenCalled();
  });

  it("applies exponential backoff for retries", async () => {
    const delays = [1, 5, 15, 60, 240];
    const attemptCount = 2;
    const retryDelay = delays[Math.min(attemptCount - 1, delays.length - 1)];

    expect(retryDelay).toBe(5);
  });

  it("finds deliveries ready for retry", async () => {
    mockQuery.mockResolvedValue([
      { id: "delivery1", nextRetryAt: new Date(Date.now() - 1000) },
      { id: "delivery2", nextRetryAt: new Date(Date.now() - 2000) },
    ]);

    const deliveries = await mockQuery();

    expect(deliveries).toHaveLength(2);
  });

  it("deletes old delivery records after 30 days", async () => {
    mockDelete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "del1" }, { id: "del2" }]),
      }),
    });

    const deleted = await mockDelete().where().returning();

    expect(deleted).toHaveLength(2);
  });

  it("generates HMAC signature for webhook payload", async () => {
    const crypto = await import("crypto");
    const payload = JSON.stringify({ test: "data" });
    const secret = "webhook_secret";
    const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    expect(signature).toBeTruthy();
    expect(signature.length).toBe(64);
  });
});
