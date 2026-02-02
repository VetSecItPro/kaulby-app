import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  escapeHtmlPreserveSafe,
  stripHtml,
  escapeRegExp,
  isSafeRegexPattern,
  createSafeRegExp,
  sanitizeForLog,
  safeLog,
  sanitizeUrl,
  sanitizeMonitorInput,
  isValidKeyword,
  isValidEmail,
  isValidUuid,
  truncate,
} from "../security/sanitize";

describe("escapeHtml", () => {
  it("escapes script tags", () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
    );
  });

  it("escapes ampersands", () => {
    expect(escapeHtml("foo & bar")).toBe("foo &amp; bar");
  });

  it("escapes all dangerous characters", () => {
    expect(escapeHtml('<>"\'`=/')).toBe(
      "&lt;&gt;&quot;&#x27;&#x60;&#x3D;&#x2F;"
    );
  });

  it("handles null/undefined", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("passes through safe text unchanged", () => {
    expect(escapeHtml("Hello World")).toBe("Hello World");
  });
});

describe("escapeHtmlPreserveSafe", () => {
  it("preserves bold tags", () => {
    expect(escapeHtmlPreserveSafe("<b>Bold</b>")).toBe("<b>Bold</b>");
  });

  it("preserves italic and em tags", () => {
    expect(escapeHtmlPreserveSafe("<i>Italic</i>")).toBe("<i>Italic</i>");
    expect(escapeHtmlPreserveSafe("<em>Emphasis</em>")).toBe("<em>Emphasis</em>");
  });

  it("preserves br tags", () => {
    expect(escapeHtmlPreserveSafe("Line 1<br>Line 2")).toBe("Line 1<br>Line 2");
  });

  it("escapes script tags while preserving safe tags", () => {
    const input = '<b>Hello</b><script>alert("xss")</script>';
    const result = escapeHtmlPreserveSafe(input);
    expect(result).toContain("<b>Hello</b>");
    expect(result).toContain("&lt;script&gt;");
    expect(result).not.toContain("<script>");
  });

  it("handles null/undefined", () => {
    expect(escapeHtmlPreserveSafe(null)).toBe("");
  });
});

describe("stripHtml", () => {
  it("removes all HTML tags", () => {
    expect(stripHtml("<b>Bold</b> <script>bad</script> text")).toBe(
      "Bold bad text"
    );
  });

  it("collapses whitespace", () => {
    expect(stripHtml("Hello   World")).toBe("Hello World");
  });

  it("handles null/undefined", () => {
    expect(stripHtml(null)).toBe("");
    expect(stripHtml(undefined)).toBe("");
  });
});

describe("escapeRegExp", () => {
  it("escapes regex special characters", () => {
    expect(escapeRegExp("hello (world)")).toBe("hello \\(world\\)");
    expect(escapeRegExp("a.b*c+d")).toBe("a\\.b\\*c\\+d");
    expect(escapeRegExp("[test]")).toBe("\\[test\\]");
  });

  it("handles null/undefined", () => {
    expect(escapeRegExp(null)).toBe("");
    expect(escapeRegExp(undefined)).toBe("");
  });

  it("produces valid regex patterns", () => {
    const escaped = escapeRegExp("hello (world)");
    const regex = new RegExp(escaped);
    expect(regex.test("hello (world)")).toBe(true);
    expect(regex.test("hello world")).toBe(false);
  });
});

describe("isSafeRegexPattern", () => {
  it("accepts simple patterns", () => {
    expect(isSafeRegexPattern("hello")).toBe(true);
    expect(isSafeRegexPattern("a+b")).toBe(true);
  });

  it("rejects nested quantifiers", () => {
    expect(isSafeRegexPattern("(a+)+")).toBe(false);
    expect(isSafeRegexPattern("(a*)*")).toBe(false);
  });

  it("rejects overly long patterns", () => {
    expect(isSafeRegexPattern("a".repeat(501))).toBe(false);
  });

  it("accepts empty pattern", () => {
    expect(isSafeRegexPattern("")).toBe(true);
  });
});

describe("createSafeRegExp", () => {
  it("creates regex from safe input", () => {
    const regex = createSafeRegExp("hello world", "gi");
    expect(regex).toBeInstanceOf(RegExp);
    expect(regex!.test("Hello World")).toBe(true);
  });

  it("returns null for null/undefined input", () => {
    expect(createSafeRegExp(null)).toBeNull();
    expect(createSafeRegExp(undefined)).toBeNull();
  });

  it("escapes special characters in input", () => {
    const regex = createSafeRegExp("hello (world)");
    expect(regex).toBeInstanceOf(RegExp);
    expect(regex!.test("hello (world)")).toBe(true);
  });
});

describe("sanitizeForLog", () => {
  it("removes control characters", () => {
    expect(sanitizeForLog("hello\nworld\r\ntabs\there")).toBe(
      "hello world tabs here"
    );
  });

  it("limits length", () => {
    const long = "a".repeat(1000);
    expect(sanitizeForLog(long, 100).length).toBe(100);
  });

  it("handles null/undefined", () => {
    expect(sanitizeForLog(null)).toBe("");
    expect(sanitizeForLog(undefined)).toBe("");
  });

  it("collapses multiple spaces", () => {
    expect(sanitizeForLog("hello    world")).toBe("hello world");
  });
});

describe("safeLog", () => {
  it("interpolates string values safely", () => {
    expect(safeLog("User %s did %s", ["john", "login"])).toBe(
      "User john did login"
    );
  });

  it("handles null values", () => {
    expect(safeLog("Value: %s", [null])).toBe("Value: [null]");
  });

  it("handles numbers", () => {
    expect(safeLog("Count: %d", [42])).toBe("Count: 42");
  });

  it("sanitizes string values", () => {
    expect(safeLog("User: %s", ["hello\nworld"])).toBe("User: hello world");
  });
});

describe("sanitizeUrl", () => {
  it("accepts valid https URLs", () => {
    expect(sanitizeUrl("https://example.com")).toBe("https://example.com");
  });

  it("accepts valid http URLs", () => {
    expect(sanitizeUrl("http://example.com")).toBe("http://example.com");
  });

  it("rejects javascript: protocol", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBeNull();
  });

  it("rejects data: protocol", () => {
    expect(sanitizeUrl("data:text/html,<script>")).toBeNull();
  });

  it("rejects vbscript: protocol", () => {
    expect(sanitizeUrl("vbscript:msgbox")).toBeNull();
  });

  it("handles case-insensitive dangerous protocols", () => {
    expect(sanitizeUrl("JAVASCRIPT:alert(1)")).toBeNull();
    expect(sanitizeUrl("JavaScript:alert(1)")).toBeNull();
  });

  it("accepts relative paths", () => {
    expect(sanitizeUrl("/dashboard")).toBe("/dashboard");
  });

  it("rejects protocol-relative URLs", () => {
    expect(sanitizeUrl("//evil.com")).toBeNull();
  });

  it("returns null for null/undefined", () => {
    expect(sanitizeUrl(null)).toBeNull();
    expect(sanitizeUrl(undefined)).toBeNull();
  });

  it("rejects invalid URLs", () => {
    expect(sanitizeUrl("not a url")).toBeNull();
  });

  it("rejects ftp protocol", () => {
    expect(sanitizeUrl("ftp://files.example.com")).toBeNull();
  });
});

describe("sanitizeMonitorInput", () => {
  it("strips HTML tags", () => {
    expect(sanitizeMonitorInput('<script>alert("xss")</script>monitor')).toBe(
      'alert("xss")monitor'
    );
  });

  it("strips javascript: URLs", () => {
    expect(sanitizeMonitorInput("javascript:alert(1)")).toBe("alert(1)");
  });

  it("strips event handlers", () => {
    expect(sanitizeMonitorInput("onclick=alert(1)")).toBe("alert(1)");
  });

  it("removes null bytes", () => {
    expect(sanitizeMonitorInput("hello\0world")).toBe("helloworld");
  });

  it("trims whitespace", () => {
    expect(sanitizeMonitorInput("  monitor  ")).toBe("monitor");
  });

  it("limits to 100 characters", () => {
    const long = "a".repeat(200);
    expect(sanitizeMonitorInput(long).length).toBe(100);
  });
});

describe("isValidKeyword", () => {
  it("accepts valid keywords", () => {
    expect(isValidKeyword("monitoring")).toBe(true);
    expect(isValidKeyword("social listening")).toBe(true);
    expect(isValidKeyword("a")).toBe(true);
  });

  it("rejects empty keywords", () => {
    expect(isValidKeyword("")).toBe(false);
    expect(isValidKeyword("   ")).toBe(false);
  });

  it("accepts keywords at max length", () => {
    expect(isValidKeyword("a".repeat(100))).toBe(true);
  });
});

describe("isValidEmail", () => {
  it("accepts valid emails", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("user+tag@domain.co.uk")).toBe(true);
    expect(isValidEmail("test@sub.domain.com")).toBe(true);
  });

  it("rejects invalid emails", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("@domain.com")).toBe(false);
    expect(isValidEmail("user@")).toBe(false);
    expect(isValidEmail("user@domain")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("isValidUuid", () => {
  it("accepts valid UUIDs", () => {
    expect(isValidUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isValidUuid("6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(true);
  });

  it("rejects invalid UUIDs", () => {
    expect(isValidUuid("not-a-uuid")).toBe(false);
    expect(isValidUuid("550e8400-e29b-41d4-a716")).toBe(false);
    expect(isValidUuid("")).toBe(false);
    expect(isValidUuid("550e8400-e29b-61d4-a716-446655440000")).toBe(false); // version 6 not valid
  });

  it("is case-insensitive", () => {
    expect(isValidUuid("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });
});

describe("truncate", () => {
  it("truncates long strings with ellipsis", () => {
    expect(truncate("Hello World", 8)).toBe("Hello...");
  });

  it("does not truncate short strings", () => {
    expect(truncate("Hello", 10)).toBe("Hello");
  });

  it("handles exact length", () => {
    expect(truncate("Hello", 5)).toBe("Hello");
  });

  it("handles null/undefined", () => {
    expect(truncate(null, 10)).toBe("");
    expect(truncate(undefined, 10)).toBe("");
  });
});
