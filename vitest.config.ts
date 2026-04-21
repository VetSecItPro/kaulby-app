import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Exclude Playwright, all nested node_modules (remotion has its own),
    // and the remotion sub-project (it has its own tests/build pipeline).
    exclude: [
      "e2e/**",
      "**/node_modules/**",
      "remotion/**",
      ".next/**",
      "dist/**",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
