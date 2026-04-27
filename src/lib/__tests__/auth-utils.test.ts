import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { findUserWithFallback, reconcileClerkUserId } from "../auth-utils";

// Mock dependencies
vi.mock("@clerk/nextjs/server", () => ({
  currentUser: vi.fn(),
}));

const mockDbUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
    update: () => ({
      set: () => ({
        where: mockDbUpdate,
      }),
    }),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("auth-utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbUpdate.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("findUserWithFallback", () => {
    it("returns user when found by Clerk ID (fast path)", async () => {
      const { db } = await import("@/lib/db");
      const mockUser = { id: "user_123", email: "test@example.com" };

      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(mockUser as never);

      const result = await findUserWithFallback("user_123");

      expect(result).toEqual(mockUser);
      expect(db.query.users.findFirst).toHaveBeenCalledTimes(1);
      // Reconcile should NOT be called when fast path hits
      expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it("returns null when no email available and ID lookup misses", async () => {
      const { db } = await import("@/lib/db");
      const { currentUser } = await import("@clerk/nextjs/server");

      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(null as never);
      vi.mocked(currentUser).mockResolvedValueOnce(null as never);

      const result = await findUserWithFallback("user_123");

      expect(result).toBeNull();
    });

    it("returns null when no DB row matches the email either", async () => {
      const { db } = await import("@/lib/db");
      const { currentUser } = await import("@clerk/nextjs/server");

      vi.mocked(currentUser).mockResolvedValueOnce({
        emailAddresses: [{ emailAddress: "ghost@example.com" }],
      } as never);

      vi.mocked(db.query.users.findFirst)
        .mockResolvedValueOnce(null as never) // ID lookup miss
        .mockResolvedValueOnce(null as never); // email lookup miss

      const result = await findUserWithFallback("user_123");

      expect(result).toBeNull();
    });

    it("self-heals when email-fallback finds a user with a stale id (Clerk drift)", async () => {
      const { db } = await import("@/lib/db");
      const { currentUser } = await import("@clerk/nextjs/server");

      const newClerkId = "user_NEW_38EETH";
      const oldDbId = "user_OLD_38cUc";

      vi.mocked(currentUser).mockResolvedValueOnce({
        emailAddresses: [{ emailAddress: "you@example.com" }],
      } as never);

      // 3 findFirst calls expected:
      // 1. ID lookup (miss) — returns null
      // 2. email lookup (hit) — returns row at oldDbId
      // 3. post-reconcile re-fetch — returns row at newClerkId
      vi.mocked(db.query.users.findFirst)
        .mockResolvedValueOnce(null as never)
        .mockResolvedValueOnce({ id: oldDbId, email: "you@example.com" } as never)
        .mockResolvedValueOnce({ id: newClerkId, email: "you@example.com" } as never);

      const result = await findUserWithFallback(newClerkId);

      // The returned user has the NEW Clerk id — confirming reconcile ran
      expect(result).toEqual({ id: newClerkId, email: "you@example.com" });
      // db.update was called once (the cascading UPDATE)
      expect(mockDbUpdate).toHaveBeenCalledTimes(1);
      // Logger warning fired
      const { logger } = await import("@/lib/logger");
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("ID drift"),
        expect.objectContaining({ oldId: oldDbId, newId: newClerkId }),
      );
    });

    it("returns the email-matched user with stale id when reconcile throws", async () => {
      const { db } = await import("@/lib/db");
      const { currentUser } = await import("@clerk/nextjs/server");

      const oldDbId = "user_OLD";
      vi.mocked(currentUser).mockResolvedValueOnce({
        emailAddresses: [{ emailAddress: "you@example.com" }],
      } as never);
      vi.mocked(db.query.users.findFirst)
        .mockResolvedValueOnce(null as never)
        .mockResolvedValueOnce({ id: oldDbId, email: "you@example.com" } as never);

      // Reconcile fails (e.g., concurrent collision)
      mockDbUpdate.mockRejectedValueOnce(new Error("FK collision"));

      const result = await findUserWithFallback("user_NEW");

      // Returns the user via email match anyway — request still succeeds
      expect(result).toEqual({ id: oldDbId, email: "you@example.com" });

      const { logger } = await import("@/lib/logger");
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Reconciliation failed"),
        expect.any(Object),
      );
    });

    it("does NOT trigger reconcile when ids already match (just returns the user)", async () => {
      const { db } = await import("@/lib/db");
      const { currentUser } = await import("@clerk/nextjs/server");

      vi.mocked(currentUser).mockResolvedValueOnce({
        emailAddresses: [{ emailAddress: "test@example.com" }],
      } as never);

      // ID lookup misses (e.g., due to read replica lag), then email lookup
      // finds the SAME user — no drift, no reconcile.
      vi.mocked(db.query.users.findFirst)
        .mockResolvedValueOnce(null as never)
        .mockResolvedValueOnce({ id: "user_123", email: "test@example.com" } as never);

      const result = await findUserWithFallback("user_123");

      expect(result).toEqual({ id: "user_123", email: "test@example.com" });
      expect(mockDbUpdate).not.toHaveBeenCalled();
    });
  });

  describe("reconcileClerkUserId", () => {
    it("is a no-op when oldId === newId", async () => {
      const { db } = await import("@/lib/db");
      const sameId = "user_123";
      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
        id: sameId,
        email: "x@example.com",
      } as never);

      const result = await reconcileClerkUserId(sameId, sameId);

      expect(result).toEqual({ id: sameId, email: "x@example.com" });
      // No UPDATE issued — same id is a no-op
      expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it("issues a single UPDATE that cascades via FK ON UPDATE CASCADE", async () => {
      const { db } = await import("@/lib/db");
      const oldId = "user_OLD";
      const newId = "user_NEW";

      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
        id: newId,
        email: "x@example.com",
      } as never);

      await reconcileClerkUserId(oldId, newId);

      // Exactly one UPDATE issued — the cascade does the rest at the DB layer
      expect(mockDbUpdate).toHaveBeenCalledTimes(1);
    });

    it("returns the migrated row at the new id", async () => {
      const { db } = await import("@/lib/db");
      const newId = "user_NEW_id";
      const expectedRow = { id: newId, email: "you@example.com", subscriptionStatus: "growth" };

      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(expectedRow as never);

      const result = await reconcileClerkUserId("user_OLD_id", newId);

      expect(result).toEqual(expectedRow);
    });
  });
});
