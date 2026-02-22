import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the database module
vi.mock("@/lib/db", () => ({
  db: {
    query: {
      apiKeys: { findFirst: vi.fn(), findMany: vi.fn() },
      users: { findFirst: vi.fn() },
    },
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "key-1" }]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "key-1" }]),
      }),
    }),
  },
  apiKeys: {},
  users: {},
}));

vi.mock("@/lib/db/schema", () => ({
  apiKeys: {
    keyHash: "keyHash",
    isActive: "isActive",
    id: "id",
    userId: "userId",
    dailyRequestCount: "dailyRequestCount",
    requestCount: "requestCount",
    lastUsedAt: "lastUsedAt",
    dailyRequestResetAt: "dailyRequestResetAt",
  },
  users: {
    id: "id",
  },
}));

import { withApiAuth } from "../api-auth";

describe("api-auth", () => {
  describe("withApiAuth", () => {
    it("returns 401 when no API key is provided", async () => {
      const request = new NextRequest("http://localhost/api/test", {
        method: "GET",
      });

      const handler = vi.fn();
      const response = await withApiAuth(request, handler);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBe("Missing API key");
      expect(handler).not.toHaveBeenCalled();
    });

    it("extracts API key from Authorization Bearer header", async () => {
      const { db } = await import("@/lib/db");

      // Mock finding the API key
      vi.mocked(db.query.apiKeys.findFirst).mockResolvedValueOnce({
        id: "key-1",
        userId: "user-1",
        expiresAt: null,
        dailyRequestResetAt: null,
        dailyRequestCount: 0,
      } as any);

      // Mock finding the user
      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
        id: "user-1",
        subscriptionStatus: "enterprise",
        isBanned: false,
      } as any);

      const request = new NextRequest("http://localhost/api/test", {
        method: "GET",
        headers: {
          Authorization: "Bearer kaulby_live_testkey123456789012",
        },
      });

      const handler = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );

      await withApiAuth(request, handler);
      expect(handler).toHaveBeenCalledWith("user-1");
    });

    it("extracts API key from X-API-Key header", async () => {
      const { db } = await import("@/lib/db");

      vi.mocked(db.query.apiKeys.findFirst).mockResolvedValueOnce({
        id: "key-1",
        userId: "user-1",
        expiresAt: null,
        dailyRequestResetAt: null,
        dailyRequestCount: 0,
      } as any);

      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
        id: "user-1",
        subscriptionStatus: "enterprise",
        isBanned: false,
      } as any);

      const request = new NextRequest("http://localhost/api/test", {
        method: "GET",
        headers: {
          "X-API-Key": "kaulby_live_testkey123456789012",
        },
      });

      const handler = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );

      await withApiAuth(request, handler);
      expect(handler).toHaveBeenCalledWith("user-1");
    });

    it("returns 401 for invalid API key format", async () => {
      const request = new NextRequest("http://localhost/api/test", {
        method: "GET",
        headers: {
          Authorization: "Bearer invalid-key-format",
        },
      });

      const handler = vi.fn();
      const response = await withApiAuth(request, handler);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBe("Invalid API key format");
      expect(handler).not.toHaveBeenCalled();
    });

    it("returns 401 when API key not found in database", async () => {
      const { db } = await import("@/lib/db");

      vi.mocked(db.query.apiKeys.findFirst).mockResolvedValueOnce(undefined as any);

      const request = new NextRequest("http://localhost/api/test", {
        method: "GET",
        headers: {
          Authorization: "Bearer kaulby_live_testkey123456789012",
        },
      });

      const handler = vi.fn();
      const response = await withApiAuth(request, handler);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBe("Invalid or revoked API key");
    });

    it("returns 401 for banned user", async () => {
      const { db } = await import("@/lib/db");

      vi.mocked(db.query.apiKeys.findFirst).mockResolvedValueOnce({
        id: "key-1",
        userId: "user-1",
        expiresAt: null,
        dailyRequestResetAt: null,
      } as any);

      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
        id: "user-1",
        subscriptionStatus: "enterprise",
        isBanned: true,
      } as any);

      const request = new NextRequest("http://localhost/api/test", {
        method: "GET",
        headers: {
          Authorization: "Bearer kaulby_live_testkey123456789012",
        },
      });

      const handler = vi.fn();
      const response = await withApiAuth(request, handler);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBe("Account is suspended");
    });

    it("returns 401 for non-enterprise subscription", async () => {
      const { db } = await import("@/lib/db");

      vi.mocked(db.query.apiKeys.findFirst).mockResolvedValueOnce({
        id: "key-1",
        userId: "user-1",
        expiresAt: null,
        dailyRequestResetAt: null,
      } as any);

      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
        id: "user-1",
        subscriptionStatus: "pro",
        isBanned: false,
      } as any);

      const request = new NextRequest("http://localhost/api/test", {
        method: "GET",
        headers: {
          Authorization: "Bearer kaulby_live_testkey123456789012",
        },
      });

      const handler = vi.fn();
      const response = await withApiAuth(request, handler);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBe("API access requires Team plan");
    });
  });
});
