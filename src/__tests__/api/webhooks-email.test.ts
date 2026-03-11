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

import { POST } from "@/app/api/webhooks/email/route";
import { NextRequest } from "next/server";

function makeRequest(method: string, url: string, body?: unknown): NextRequest {
  const init: { method: string; body?: string; headers?: Record<string, string> } = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest(`http://localhost${url}`, init);
}

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
    const req = new NextRequest("http://localhost/api/webhooks/email", {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        "resend-signature": "test-webhook-secret",
      },
    });

    // Mock Resend emails.send
    vi.mock("resend", () => ({
      Resend: class {
        constructor() {}
        emails = {
          send: vi.fn().mockResolvedValue({ error: null }),
        };
      },
    }));

    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
