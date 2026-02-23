import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { findUserWithFallback } from "../auth-utils";

// Mock dependencies
vi.mock("@clerk/nextjs/server", () => ({
  currentUser: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
  },
}));

describe("auth-utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("findUserWithFallback", () => {
    it("returns user when found by Clerk ID", async () => {
      const { db } = await import("@/lib/db");
      const mockUser = {
        id: "user_123",
        email: "test@example.com",
        name: "Test User",
      };

      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(mockUser as never);

      const result = await findUserWithFallback("user_123");

      expect(result).toEqual(mockUser);
      expect(db.query.users.findFirst).toHaveBeenCalledWith({
        where: expect.anything(),
      });
    });

    it("falls back to email lookup when user not found by Clerk ID", async () => {
      const { db } = await import("@/lib/db");
      const { currentUser } = await import("@clerk/nextjs/server");

      const mockClerkUser = {
        emailAddresses: [{ emailAddress: "test@example.com" }],
      };

      const mockDbUser = {
        id: "user_456",
        email: "test@example.com",
        name: "Test User",
      };

      // First call returns null (not found by ID)
      // Second call returns user (found by email)
      vi.mocked(db.query.users.findFirst)
        .mockResolvedValueOnce(null as never)
        .mockResolvedValueOnce(mockDbUser as never);

      vi.mocked(currentUser).mockResolvedValueOnce(mockClerkUser as never);

      const result = await findUserWithFallback("user_123");

      expect(result).toEqual(mockDbUser);
      expect(db.query.users.findFirst).toHaveBeenCalledTimes(2);
      expect(currentUser).toHaveBeenCalled();
    });

    it("returns null when user not found by ID and Clerk user has no email", async () => {
      const { db } = await import("@/lib/db");
      const { currentUser } = await import("@clerk/nextjs/server");

      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(null as never);
      vi.mocked(currentUser).mockResolvedValueOnce({
        emailAddresses: [],
      } as never);

      const result = await findUserWithFallback("user_123");

      expect(result).toBeNull();
    });

    it("returns null when user not found by ID and currentUser returns null", async () => {
      const { db } = await import("@/lib/db");
      const { currentUser } = await import("@clerk/nextjs/server");

      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(null as never);
      vi.mocked(currentUser).mockResolvedValueOnce(null as never);

      const result = await findUserWithFallback("user_123");

      expect(result).toBeNull();
    });

    it("returns null when user not found by ID and email", async () => {
      const { db } = await import("@/lib/db");
      const { currentUser } = await import("@clerk/nextjs/server");

      const mockClerkUser = {
        emailAddresses: [{ emailAddress: "test@example.com" }],
      };

      vi.mocked(db.query.users.findFirst)
        .mockResolvedValueOnce(null as never)
        .mockResolvedValueOnce(null as never);

      vi.mocked(currentUser).mockResolvedValueOnce(mockClerkUser as never);

      const result = await findUserWithFallback("user_123");

      expect(result).toBeNull();
    });

    it("handles multiple email addresses by using first one", async () => {
      const { db } = await import("@/lib/db");
      const { currentUser } = await import("@clerk/nextjs/server");

      const mockClerkUser = {
        emailAddresses: [
          { emailAddress: "primary@example.com" },
          { emailAddress: "secondary@example.com" },
        ],
      };

      const mockDbUser = {
        id: "user_456",
        email: "primary@example.com",
        name: "Test User",
      };

      vi.mocked(db.query.users.findFirst)
        .mockResolvedValueOnce(null as never)
        .mockResolvedValueOnce(mockDbUser as never);

      vi.mocked(currentUser).mockResolvedValueOnce(mockClerkUser as never);

      const result = await findUserWithFallback("user_123");

      expect(result).toEqual(mockDbUser);
    });
  });
});
