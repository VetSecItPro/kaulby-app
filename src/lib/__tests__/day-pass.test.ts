import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  db: {
    query: {
      users: { findFirst: vi.fn() },
    },
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
  users: {
    id: "id",
  },
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
}));

import { activateDayPass, checkDayPassStatus, getDayPassHistory } from "../day-pass";

describe("day-pass", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe("activateDayPass", () => {
    it("activates a day pass that expires 24 hours from now", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
        dayPassPurchaseCount: 0,
      } as any);

      const before = Date.now();
      const result = await activateDayPass("user-1");
      const after = Date.now();

      expect(result.purchaseCount).toBe(1);
      // Expiry should be ~24 hours from now
      const expectedMs = 24 * 60 * 60 * 1000;
      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(before + expectedMs - 100);
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(after + expectedMs + 100);
    });

    it("increments purchase count for returning users", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
        dayPassPurchaseCount: 3,
      } as any);

      const result = await activateDayPass("user-1");
      expect(result.purchaseCount).toBe(4);
    });

    it("handles first-time user with no existing record", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
        dayPassPurchaseCount: null,
      } as any);

      const result = await activateDayPass("user-1");
      expect(result.purchaseCount).toBe(1);
    });
  });

  describe("checkDayPassStatus", () => {
    it("returns active status with time remaining", async () => {
      const { db } = await import("@/lib/db");
      const futureDate = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours from now

      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
        dayPassExpiresAt: futureDate,
      } as any);

      const result = await checkDayPassStatus("user-1");
      expect(result.active).toBe(true);
      expect(result.expiresAt).toEqual(futureDate);
      expect(result.hoursRemaining).toBeGreaterThanOrEqual(11);
      expect(result.hoursRemaining).toBeLessThanOrEqual(12);
      expect(result.minutesRemaining).toBeDefined();
    });

    it("returns inactive when day pass has expired", async () => {
      const { db } = await import("@/lib/db");
      const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
        dayPassExpiresAt: pastDate,
      } as any);

      const result = await checkDayPassStatus("user-1");
      expect(result.active).toBe(false);
      expect(result.expiresAt).toBeNull();
      expect(result.hoursRemaining).toBeNull();
      expect(result.minutesRemaining).toBeNull();
    });

    it("returns inactive when user has no day pass", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
        dayPassExpiresAt: null,
      } as any);

      const result = await checkDayPassStatus("user-1");
      expect(result.active).toBe(false);
      expect(result.expiresAt).toBeNull();
      expect(result.hoursRemaining).toBeNull();
      expect(result.minutesRemaining).toBeNull();
    });

    it("returns inactive when user not found", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined as any);

      const result = await checkDayPassStatus("nonexistent");
      expect(result.active).toBe(false);
    });

    it("calculates hours and minutes remaining correctly", async () => {
      const { db } = await import("@/lib/db");
      // Set to exactly 3 hours and 30 minutes from now
      const futureDate = new Date(Date.now() + (3 * 60 + 30) * 60 * 1000);

      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
        dayPassExpiresAt: futureDate,
      } as any);

      const result = await checkDayPassStatus("user-1");
      expect(result.active).toBe(true);
      expect(result.hoursRemaining).toBe(3);
      expect(result.minutesRemaining).toBeGreaterThanOrEqual(29);
      expect(result.minutesRemaining).toBeLessThanOrEqual(30);
    });
  });

  describe("getDayPassHistory", () => {
    it("returns purchase history for existing user", async () => {
      const { db } = await import("@/lib/db");
      const lastPurchased = new Date("2025-06-15T12:00:00Z");

      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
        dayPassPurchaseCount: 5,
        lastDayPassPurchasedAt: lastPurchased,
      } as any);

      const result = await getDayPassHistory("user-1");
      expect(result.totalPurchases).toBe(5);
      expect(result.lastPurchasedAt).toEqual(lastPurchased);
    });

    it("returns zero purchases for new user", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
        dayPassPurchaseCount: null,
        lastDayPassPurchasedAt: null,
      } as any);

      const result = await getDayPassHistory("user-1");
      expect(result.totalPurchases).toBe(0);
      expect(result.lastPurchasedAt).toBeNull();
    });

    it("returns zero purchases when user not found", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined as any);

      const result = await getDayPassHistory("nonexistent");
      expect(result.totalPurchases).toBe(0);
      expect(result.lastPurchasedAt).toBeNull();
    });
  });
});
