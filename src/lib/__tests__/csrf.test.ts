import { describe, it, expect, vi } from "vitest";

// We can't easily construct real NextRequest/NextResponse objects in unit tests,
// so we'll test the functions that are testable: verifyCsrfToken, hasCsrfCookie, getCsrfToken

describe("csrf", () => {
  describe("verifyCsrfToken", () => {
    it("returns true when cookie and header match", async () => {
      const { verifyCsrfToken } = await import("../csrf");
      const token = "test-csrf-token-12345";

      const mockRequest = {
        cookies: {
          get: vi.fn().mockReturnValue({ value: token }),
        },
        headers: {
          get: vi.fn().mockReturnValue(token),
        },
      } as any;

      expect(verifyCsrfToken(mockRequest)).toBe(true);
    });

    it("returns false when cookie and header do not match", async () => {
      const { verifyCsrfToken } = await import("../csrf");

      const mockRequest = {
        cookies: {
          get: vi.fn().mockReturnValue({ value: "token-a" }),
        },
        headers: {
          get: vi.fn().mockReturnValue("token-b"),
        },
      } as any;

      expect(verifyCsrfToken(mockRequest)).toBe(false);
    });

    it("returns false when cookie is missing", async () => {
      const { verifyCsrfToken } = await import("../csrf");

      const mockRequest = {
        cookies: {
          get: vi.fn().mockReturnValue(undefined),
        },
        headers: {
          get: vi.fn().mockReturnValue("some-token"),
        },
      } as any;

      expect(verifyCsrfToken(mockRequest)).toBe(false);
    });

    it("returns false when header is missing", async () => {
      const { verifyCsrfToken } = await import("../csrf");

      const mockRequest = {
        cookies: {
          get: vi.fn().mockReturnValue({ value: "some-token" }),
        },
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
      } as any;

      expect(verifyCsrfToken(mockRequest)).toBe(false);
    });

    it("returns false when both cookie and header are missing", async () => {
      const { verifyCsrfToken } = await import("../csrf");

      const mockRequest = {
        cookies: {
          get: vi.fn().mockReturnValue(undefined),
        },
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
      } as any;

      expect(verifyCsrfToken(mockRequest)).toBe(false);
    });

    it("returns false when tokens have different lengths", async () => {
      const { verifyCsrfToken } = await import("../csrf");

      const mockRequest = {
        cookies: {
          get: vi.fn().mockReturnValue({ value: "short" }),
        },
        headers: {
          get: vi.fn().mockReturnValue("much-longer-token"),
        },
      } as any;

      expect(verifyCsrfToken(mockRequest)).toBe(false);
    });
  });

  describe("hasCsrfCookie", () => {
    it("returns true when CSRF cookie is present", async () => {
      const { hasCsrfCookie } = await import("../csrf");

      const mockRequest = {
        cookies: {
          get: vi.fn().mockReturnValue({ value: "some-token" }),
        },
      } as any;

      expect(hasCsrfCookie(mockRequest)).toBe(true);
    });

    it("returns false when CSRF cookie is absent", async () => {
      const { hasCsrfCookie } = await import("../csrf");

      const mockRequest = {
        cookies: {
          get: vi.fn().mockReturnValue(undefined),
        },
      } as any;

      expect(hasCsrfCookie(mockRequest)).toBe(false);
    });

    it("returns false when CSRF cookie has empty value", async () => {
      const { hasCsrfCookie } = await import("../csrf");

      const mockRequest = {
        cookies: {
          get: vi.fn().mockReturnValue({ value: "" }),
        },
      } as any;

      expect(hasCsrfCookie(mockRequest)).toBe(false);
    });
  });

  describe("getCsrfToken", () => {
    it("returns null when document is undefined (server-side)", async () => {
      const { getCsrfToken } = await import("../csrf");
      // In Node.js test environment, document is undefined
      expect(getCsrfToken()).toBeNull();
    });
  });

  describe("exported constants", () => {
    it("exports correct cookie and header names", async () => {
      const { CSRF_COOKIE, CSRF_HEADER } = await import("../csrf");
      expect(CSRF_COOKIE).toBe("kaulby_csrf");
      expect(CSRF_HEADER).toBe("x-csrf-token");
    });
  });
});
