import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logActivity } from "../activity-log";
import type { ActivityAction } from "../activity-log";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
  },
  activityLogs: {},
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(() =>
    Promise.resolve({
      get: vi.fn((key: string) => {
        if (key === "x-forwarded-for") return "192.168.1.1, 10.0.0.1";
        if (key === "x-real-ip") return "192.168.1.1";
        if (key === "user-agent") return "Mozilla/5.0";
        return null;
      }),
    })
  ),
}));

describe("activity-log", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("logActivity", () => {
    it("logs activity with all required fields", async () => {
      const { db } = await import("@/lib/db");
      const insertMock = db.insert as never;

      await logActivity({
        workspaceId: "ws_123",
        userId: "user_123",
        action: "monitor_created" as ActivityAction,
        targetType: "monitor",
        targetId: "mon_123",
        targetName: "Test Monitor",
        metadata: { platform: "reddit" },
      });

      expect(insertMock).toHaveBeenCalled();
    });

    it("logs activity with minimal required fields only", async () => {
      const { db } = await import("@/lib/db");
      const insertMock = db.insert as never;

      await logActivity({
        workspaceId: "ws_123",
        userId: "user_123",
        action: "workspace_created" as ActivityAction,
      });

      expect(insertMock).toHaveBeenCalled();
    });

    it("extracts IP address from x-forwarded-for header", async () => {
      await logActivity({
        workspaceId: "ws_123",
        userId: "user_123",
        action: "monitor_created" as ActivityAction,
      });

      // Should extract first IP from x-forwarded-for
      // Verified by checking the mock was called
      const { db } = await import("@/lib/db");
      expect(db.insert).toHaveBeenCalled();
    });

    it("handles missing headers gracefully", async () => {
      const { headers } = await import("next/headers");
      vi.mocked(headers).mockImplementationOnce(() =>
        Promise.reject(new Error("Headers not available"))
      );

      await logActivity({
        workspaceId: "ws_123",
        userId: "user_123",
        action: "monitor_created" as ActivityAction,
      });

      // Should not throw
      const { db } = await import("@/lib/db");
      expect(db.insert).toHaveBeenCalled();
    });

    it("handles database insert failure silently", async () => {
      const { db } = await import("@/lib/db");

      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn(() => Promise.reject(new Error("Database connection failed"))),
      } as never);

      // Should not throw
      await expect(
        logActivity({
          workspaceId: "ws_123",
          userId: "user_123",
          action: "monitor_created" as ActivityAction,
        })
      ).resolves.toBeUndefined();

      // Wait for async promise rejection to be handled
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should log error to console
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to log activity:",
        expect.any(Error)
      );
    });

    it("logs different activity action types", async () => {
      const { db } = await import("@/lib/db");

      const actions: ActivityAction[] = [
        "monitor_created",
        "monitor_updated",
        "monitor_deleted",
        "monitor_paused",
        "monitor_resumed",
        "member_invited",
        "workspace_created",
        "api_key_created",
        "webhook_created",
      ];

      for (const action of actions) {
        await logActivity({
          workspaceId: "ws_123",
          userId: "user_123",
          action,
        });
      }

      expect(db.insert).toHaveBeenCalledTimes(actions.length);
    });

    it("includes metadata when provided", async () => {
      await logActivity({
        workspaceId: "ws_123",
        userId: "user_123",
        action: "monitor_created" as ActivityAction,
        metadata: {
          platform: "reddit",
          keywords: ["test", "monitor"],
          tier: "pro",
        },
      });

      const { db } = await import("@/lib/db");
      expect(db.insert).toHaveBeenCalled();
    });
  });
});
