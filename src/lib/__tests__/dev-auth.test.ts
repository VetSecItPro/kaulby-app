import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getEffectiveUserId, isLocalDev } from "../dev-auth";

// Mock dependencies
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
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

describe("dev-auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all env vars to defaults
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_DEV_AUTH_BYPASS", "false");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("CI", "");
    vi.stubEnv("GITHUB_ACTIONS", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("isLocalDev", () => {
    it("returns false in production", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("ALLOW_DEV_AUTH_BYPASS", "true");

      expect(isLocalDev()).toBe(false);
    });

    it("returns false when ALLOW_DEV_AUTH_BYPASS is false", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("ALLOW_DEV_AUTH_BYPASS", "false");

      expect(isLocalDev()).toBe(false);
    });

    it("returns false when on Vercel", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("ALLOW_DEV_AUTH_BYPASS", "true");
      vi.stubEnv("VERCEL", "1");

      expect(isLocalDev()).toBe(false);
    });

    it("returns false when VERCEL_ENV is set", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("ALLOW_DEV_AUTH_BYPASS", "true");
      vi.stubEnv("VERCEL_ENV", "preview");

      expect(isLocalDev()).toBe(false);
    });

    it("returns true when all conditions are met", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("ALLOW_DEV_AUTH_BYPASS", "true");
      vi.stubEnv("VERCEL", "");
      vi.stubEnv("VERCEL_ENV", "");

      expect(isLocalDev()).toBe(true);
    });

    it("returns false when ALLOW_DEV_AUTH_BYPASS is not set", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("ALLOW_DEV_AUTH_BYPASS", "");

      expect(isLocalDev()).toBe(false);
    });

    it("returns true in CI (CI=true) with opt-in, NODE_ENV=production", () => {
      // Simulates GitHub Actions e2e job: production build, CI set, opt-in set.
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("ALLOW_DEV_AUTH_BYPASS", "true");
      vi.stubEnv("CI", "true");

      expect(isLocalDev()).toBe(true);
    });

    it("returns true in CI (GITHUB_ACTIONS=true) with opt-in", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("ALLOW_DEV_AUTH_BYPASS", "true");
      vi.stubEnv("GITHUB_ACTIONS", "true");

      expect(isLocalDev()).toBe(true);
    });

    it("returns false in CI WITHOUT the explicit opt-in", () => {
      // CI alone is not enough — ALLOW_DEV_AUTH_BYPASS is the safety gate.
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("ALLOW_DEV_AUTH_BYPASS", "false");
      vi.stubEnv("CI", "true");

      expect(isLocalDev()).toBe(false);
    });

    it("returns false in CI when on Vercel (defense in depth)", () => {
      // Even if CI=true and opt-in is set, Vercel must still block.
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("ALLOW_DEV_AUTH_BYPASS", "true");
      vi.stubEnv("CI", "true");
      vi.stubEnv("VERCEL", "1");

      expect(isLocalDev()).toBe(false);
    });
  });

  describe("getEffectiveUserId", () => {
    it("returns Clerk user ID in production", async () => {
      vi.stubEnv("NODE_ENV", "production");

      const { auth } = await import("@clerk/nextjs/server");
      vi.mocked(auth).mockResolvedValueOnce({
        userId: "clerk_user_123",
      } as never);

      const userId = await getEffectiveUserId();

      expect(userId).toBe("clerk_user_123");
    });

    it("returns null when not authenticated in production", async () => {
      vi.stubEnv("NODE_ENV", "production");

      const { auth } = await import("@clerk/nextjs/server");
      vi.mocked(auth).mockResolvedValueOnce({
        userId: null,
      } as never);

      const userId = await getEffectiveUserId();

      expect(userId).toBeNull();
    });

    it("returns first user ID in local dev mode", async () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("ALLOW_DEV_AUTH_BYPASS", "true");
      vi.stubEnv("VERCEL", "");
      vi.stubEnv("VERCEL_ENV", "");

      const { db } = await import("@/lib/db");
      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
        id: "dev_user_123",
      } as never);

      const userId = await getEffectiveUserId();

      expect(userId).toBe("dev_user_123");
      expect(db.query.users.findFirst).toHaveBeenCalled();
    });

    it("returns null when no dev user found in local dev mode", async () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("ALLOW_DEV_AUTH_BYPASS", "true");
      vi.stubEnv("VERCEL", "");
      vi.stubEnv("VERCEL_ENV", "");

      const { db } = await import("@/lib/db");
      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(null as never);

      const userId = await getEffectiveUserId();

      expect(userId).toBeNull();
    });

    it("does not use dev bypass when on Vercel", async () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("ALLOW_DEV_AUTH_BYPASS", "true");
      vi.stubEnv("VERCEL", "1");

      const { auth } = await import("@clerk/nextjs/server");
      const { db } = await import("@/lib/db");

      vi.mocked(auth).mockResolvedValueOnce({
        userId: "clerk_user_456",
      } as never);

      const userId = await getEffectiveUserId();

      expect(userId).toBe("clerk_user_456");
      expect(db.query.users.findFirst).not.toHaveBeenCalled();
    });

    it("does not use dev bypass when ALLOW_DEV_AUTH_BYPASS is false", async () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("ALLOW_DEV_AUTH_BYPASS", "false");

      const { auth } = await import("@clerk/nextjs/server");
      const { db } = await import("@/lib/db");

      vi.mocked(auth).mockResolvedValueOnce({
        userId: "clerk_user_789",
      } as never);

      const userId = await getEffectiveUserId();

      expect(userId).toBe("clerk_user_789");
      expect(db.query.users.findFirst).not.toHaveBeenCalled();
    });
  });

  describe("security", () => {
    it("dev bypass requires explicit opt-in", async () => {
      vi.stubEnv("NODE_ENV", "development");
      // Don't set ALLOW_DEV_AUTH_BYPASS

      const { auth } = await import("@clerk/nextjs/server");
      vi.mocked(auth).mockResolvedValueOnce({
        userId: "clerk_user_secure",
      } as never);

      const userId = await getEffectiveUserId();

      expect(userId).toBe("clerk_user_secure");
    });

    it("CI with opt-in returns admin user (production NODE_ENV)", async () => {
      // GitHub Actions e2e scenario: `pnpm start` sets NODE_ENV=production
      // but CI=true + ALLOW_DEV_AUTH_BYPASS=true should still bypass.
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("ALLOW_DEV_AUTH_BYPASS", "true");
      vi.stubEnv("CI", "true");

      const { db } = await import("@/lib/db");
      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
        id: "e2e-admin-user",
      } as never);

      const userId = await getEffectiveUserId();

      expect(userId).toBe("e2e-admin-user");
      expect(db.query.users.findFirst).toHaveBeenCalled();
    });

    it("CI WITHOUT opt-in falls through to Clerk auth", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("ALLOW_DEV_AUTH_BYPASS", "false");
      vi.stubEnv("CI", "true");

      const { auth } = await import("@clerk/nextjs/server");
      const { db } = await import("@/lib/db");
      vi.mocked(auth).mockResolvedValueOnce({
        userId: "clerk_ci_no_optin",
      } as never);

      const userId = await getEffectiveUserId();

      expect(userId).toBe("clerk_ci_no_optin");
      expect(db.query.users.findFirst).not.toHaveBeenCalled();
    });

    it("CI + opt-in but on Vercel falls through to Clerk (prod safety)", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("ALLOW_DEV_AUTH_BYPASS", "true");
      vi.stubEnv("CI", "true");
      vi.stubEnv("VERCEL", "1");

      const { auth } = await import("@clerk/nextjs/server");
      const { db } = await import("@/lib/db");
      vi.mocked(auth).mockResolvedValueOnce({
        userId: "clerk_vercel_prod",
      } as never);

      const userId = await getEffectiveUserId();

      expect(userId).toBe("clerk_vercel_prod");
      expect(db.query.users.findFirst).not.toHaveBeenCalled();
    });

    it("dev bypass disabled on any Vercel environment", async () => {
      const vercelEnvs = ["production", "preview", "development"];

      for (const env of vercelEnvs) {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("ALLOW_DEV_AUTH_BYPASS", "true");
        vi.stubEnv("VERCEL_ENV", env);

        const { auth } = await import("@clerk/nextjs/server");
        vi.mocked(auth).mockResolvedValueOnce({
          userId: `clerk_user_${env}`,
        } as never);

        const userId = await getEffectiveUserId();

        expect(userId).toBe(`clerk_user_${env}`);
      }
    });
  });
});
