import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDbUpdate, mockDbInsert } = vi.hoisted(() => {
  return {
    mockDbUpdate: vi.fn(),
    mockDbInsert: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    update: () => mockDbUpdate(),
    insert: (...args: unknown[]) => mockDbInsert(...args),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  webhookEvents: { eventId: "event_id", eventType: "event_type", provider: "provider" },
  users: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  relations: vi.fn(),
  sql: vi.fn(),
}));

vi.mock("@/lib/security", () => ({
  escapeHtml: (s: string) => s,
  sanitizeForLog: (s: string) => s,
}));

// vi.mock calls are hoisted to the top regardless of where they're written.
// Keeping this at the top surfaces that fact and silences the vitest warning.
vi.mock("resend", () => ({
  Resend: class {
    constructor() {}
    emails = {
      send: vi.fn().mockResolvedValue({ error: null }),
    };
  },
}));

import { POST } from "@/app/api/webhooks/email/route";
import { NextRequest } from "next/server";
import crypto from "crypto";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("RESEND_WEBHOOK_SECRET", "test-webhook-secret");
});

describe("POST /api/webhooks/email", () => {
  it("returns 200 for valid webhook", async () => {
    // Mock db.insert for idempotency guard (webhookEvents insert)
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    mockDbUpdate.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });

    // Create request with valid signature header and email data
    const body = {
      type: "email.received",
      data: {
        email_id: "test-email-id",
        from: "sender@example.com",
        to: ["support@kaulbyapp.com"],
        subject: "Test",
        text: "Hello",
      },
    };
    const rawBody = JSON.stringify(body);
    const signature = crypto.createHmac("sha256", "test-webhook-secret").update(rawBody).digest("hex");
    const req = new NextRequest("http://localhost/api/webhooks/email", {
      method: "POST",
      body: rawBody,
      headers: {
        "Content-Type": "application/json",
        "resend-signature": signature,
      },
    });

    // Resend is mocked at the top level (see vi.mock above).
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
