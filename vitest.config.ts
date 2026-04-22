import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Exclude Playwright, all nested node_modules (remotion has its own), the remotion
    // sub-project (its own tests/build), and .claude/ (contains stale worktrees from
    // ultrareview runs that carry outdated test copies — not part of the repo).
    exclude: [
      "e2e/**",
      "**/node_modules/**",
      "remotion/**",
      ".next/**",
      "dist/**",
      ".claude/**",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
