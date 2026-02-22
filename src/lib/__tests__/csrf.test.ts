import { describe, it, expect, vi } from "vitest";
import type { NextRequest } from "next/server";

// We can't easily construct real NextRequest/NextResponse objects in unit tests,
// so we'll test the functions that are testable: verifyCsrfToken, hasCsrfCookie, getCsrfToken

/** Helper to create a mock NextRequest with cookies and headers */
function makeMockRequest(opts: {
  cookieValue?: { value: string } | undefined;
  headerValue?: string | null;
}): NextRequest {
  return {
    cookies: {
      get: vi.fn().mockReturnValue(opts.cookieValue),
    },
    headers: {
      get: vi.fn().mockReturnValue(opts.headerValue ?? null),
    },
  } as unknown as NextRequest;
}

describe("csrf", () => {
  describe("verifyCsrfToken", () => {
    it("returns true when cookie and header match", async () => {
      const { verifyCsrfToken } = await import("../csrf");
      const token = "test-csrf-token-12345";

      const mockRequest = makeMockRequest({
        cookieValue: { value: token },
        headerValue: token,
      });

      expect(verifyCsrfToken(mockRequest)).toBe(true);
    });

    it("returns false when cookie and header do not match", async () => {
      const { verifyCsrfToken } = await import("../csrf");

      const mockRequest = makeMockRequest({
        cookieValue: { value: "token-a" },
        headerValue: "token-b",
      });

      expect(verifyCsrfToken(mockRequest)).toBe(false);
    });

    it("returns false when cookie is missing", async () => {
      const { verifyCsrfToken } = await import("../csrf");

      const mockRequest = makeMockRequest({
        cookieValue: undefined,
        headerValue: "some-token",
      });

      expect(verifyCsrfToken(mockRequest)).toBe(false);
    });

    it("returns false when header is missing", async () => {
      const { verifyCsrfToken } = await import("../csrf");

      const mockRequest = makeMockRequest({
        cookieValue: { value: "some-token" },
        headerValue: null,
      });

      expect(verifyCsrfToken(mockRequest)).toBe(false);
    });

    it("returns false when both cookie and header are missing", async () => {
      const { verifyCsrfToken } = await import("../csrf");

      const mockRequest = makeMockRequest({
        cookieValue: undefined,
        headerValue: null,
      });

      expect(verifyCsrfToken(mockRequest)).toBe(false);
    });

    it("returns false when tokens have different lengths", async () => {
      const { verifyCsrfToken } = await import("../csrf");

      const mockRequest = makeMockRequest({
        cookieValue: { value: "short" },
        headerValue: "much-longer-token",
      });

      expect(verifyCsrfToken(mockRequest)).toBe(false);
    });
  });

  describe("hasCsrfCookie", () => {
    it("returns true when CSRF cookie is present", async () => {
      const { hasCsrfCookie } = await import("../csrf");

      const mockRequest = makeMockRequest({
        cookieValue: { value: "some-token" },
      });

      expect(hasCsrfCookie(mockRequest)).toBe(true);
    });

    it("returns false when CSRF cookie is absent", async () => {
      const { hasCsrfCookie } = await import("../csrf");

      const mockRequest = makeMockRequest({
        cookieValue: undefined,
      });

      expect(hasCsrfCookie(mockRequest)).toBe(false);
    });

    it("returns false when CSRF cookie has empty value", async () => {
      const { hasCsrfCookie } = await import("../csrf");

      const mockRequest = makeMockRequest({
        cookieValue: { value: "" },
      });

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
