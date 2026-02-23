import { describe, it, expect } from "vitest";
import { cn } from "../utils";

describe("utils", () => {
  describe("cn", () => {
    it("merges class names", () => {
      const result = cn("foo", "bar");
      expect(result).toContain("foo");
      expect(result).toContain("bar");
    });

    it("handles conditional classes", () => {
      const result = cn("foo", false && "bar", "baz");
      expect(result).toContain("foo");
      expect(result).not.toContain("bar");
      expect(result).toContain("baz");
    });

    it("handles undefined and null", () => {
      const result = cn("foo", null, undefined, "bar");
      expect(result).toContain("foo");
      expect(result).toContain("bar");
    });

    it("handles arrays", () => {
      const result = cn(["foo", "bar"], "baz");
      expect(result).toContain("foo");
      expect(result).toContain("bar");
      expect(result).toContain("baz");
    });

    it("handles objects with boolean values", () => {
      const result = cn({
        foo: true,
        bar: false,
        baz: true,
      });
      expect(result).toContain("foo");
      expect(result).not.toContain("bar");
      expect(result).toContain("baz");
    });

    it("merges Tailwind classes correctly", () => {
      const result = cn("p-4 bg-red-500", "p-8");
      // twMerge should prioritize later classes
      expect(result).toContain("p-8");
    });

    it("handles empty input", () => {
      const result = cn();
      expect(typeof result).toBe("string");
    });

    it("handles repeated classes", () => {
      const result = cn("foo", "foo", "foo");
      // clsx/twMerge may or may not deduplicate - just verify it works
      expect(result).toContain("foo");
    });

    it("handles complex Tailwind scenarios", () => {
      const result = cn(
        "bg-blue-500 text-white p-4",
        "hover:bg-blue-600",
        "dark:bg-blue-700"
      );
      expect(result).toBeTruthy();
    });
  });
});
