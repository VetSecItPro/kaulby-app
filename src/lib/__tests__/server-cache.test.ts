import { describe, it, expect } from "vitest";

// Note: server-cache uses Next.js unstable_cache which is difficult to test in isolation
// We verify the module structure and exports
describe("server-cache", () => {
  it("exports getCachedMonitors", async () => {
    const mod = await import("../server-cache");
    expect(mod.getCachedMonitors).toBeDefined();
    expect(typeof mod.getCachedMonitors).toBe("function");
  });

  it("exports getCachedMonitorIds", async () => {
    const mod = await import("../server-cache");
    expect(mod.getCachedMonitorIds).toBeDefined();
    expect(typeof mod.getCachedMonitorIds).toBe("function");
  });

  it("exports getCachedUserPlan", async () => {
    const mod = await import("../server-cache");
    expect(mod.getCachedUserPlan).toBeDefined();
    expect(typeof mod.getCachedUserPlan).toBe("function");
  });

  it("exports getCachedResultsCount", async () => {
    const mod = await import("../server-cache");
    expect(mod.getCachedResultsCount).toBeDefined();
    expect(typeof mod.getCachedResultsCount).toBe("function");
  });
});
