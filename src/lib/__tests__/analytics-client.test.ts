import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock posthog-js: the default export is the posthog singleton.
// We assert on capture() to verify the typed wrapper routes correctly.
const captureMock = vi.fn();

vi.mock("posthog-js", () => ({
  default: {
    __loaded: true,
    capture: captureMock,
    init: vi.fn(),
  },
}));

// Mock cookie-consent: default to consent granted so tests can see captures.
// Individual tests can override via vi.doMock if needed.
vi.mock("@/components/shared/cookie-consent", () => ({
  hasAnalyticsConsent: vi.fn(() => true),
}));

describe("analytics-client.track", () => {
  beforeEach(() => {
    captureMock.mockClear();
    vi.resetModules();
    // Force production so track() actually fires. In non-production it is a
    // silent no-op by design.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key_123");
    // Ensure `typeof window !== 'undefined'` in node env — stub global.
    // vitest runs in node, so emulate a browser-ish window.
    if (typeof globalThis.window === "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).window = {};
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("routes ui.monitor_card_clicked with fromPage + monitorId", async () => {
    const { track } = await import("../analytics-client");
    await track("ui.monitor_card_clicked", {
      fromPage: "monitors_list_desktop",
      monitorId: "mon_abc",
    });
    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(captureMock).toHaveBeenCalledWith("ui.monitor_card_clicked", {
      fromPage: "monitors_list_desktop",
      monitorId: "mon_abc",
    });
  });

  it("routes ui.result_card_clicked with resultId + platform", async () => {
    const { track } = await import("../analytics-client");
    await track("ui.result_card_clicked", {
      resultId: "res_1",
      platform: "reddit",
    });
    expect(captureMock).toHaveBeenCalledWith("ui.result_card_clicked", {
      resultId: "res_1",
      platform: "reddit",
    });
  });

  it("routes ui.filter_applied for each filterType variant", async () => {
    const { track } = await import("../analytics-client");
    const variants = [
      { filterType: "sentiment", value: "positive" },
      { filterType: "platform", value: "reddit" },
      { filterType: "category", value: "pain_points" },
      { filterType: "time_range", value: "7d" },
      { filterType: "sort", value: "asc" },
    ] as const;
    for (const v of variants) {
      await track("ui.filter_applied", v);
    }
    expect(captureMock).toHaveBeenCalledTimes(variants.length);
    for (let i = 0; i < variants.length; i++) {
      expect(captureMock.mock.calls[i]).toEqual(["ui.filter_applied", variants[i]]);
    }
  });

  it("routes ui.tab_switched with pageSection + tabName", async () => {
    const { track } = await import("../analytics-client");
    await track("ui.tab_switched", {
      pageSection: "insights",
      tabName: "recommendations",
    });
    expect(captureMock).toHaveBeenCalledWith("ui.tab_switched", {
      pageSection: "insights",
      tabName: "recommendations",
    });
  });

  it("routes ui.cta_clicked with ctaName + location", async () => {
    const { track } = await import("../analytics-client");
    await track("ui.cta_clicked", {
      ctaName: "upgrade_pro",
      location: "pricing_page",
    });
    expect(captureMock).toHaveBeenCalledWith("ui.cta_clicked", {
      ctaName: "upgrade_pro",
      location: "pricing_page",
    });
  });

  it("no-ops in non-production env", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { track } = await import("../analytics-client");
    await track("ui.cta_clicked", { ctaName: "x", location: "y" });
    expect(captureMock).not.toHaveBeenCalled();
  });

  it("no-ops when posthog key is absent", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    const { track } = await import("../analytics-client");
    await track("ui.cta_clicked", { ctaName: "x", location: "y" });
    expect(captureMock).not.toHaveBeenCalled();
  });

  it("no-ops when posthog key has invalid prefix", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "not_a_real_key");
    const { track } = await import("../analytics-client");
    await track("ui.cta_clicked", { ctaName: "x", location: "y" });
    expect(captureMock).not.toHaveBeenCalled();
  });

  it("no-ops when consent is denied", async () => {
    vi.doMock("@/components/shared/cookie-consent", () => ({
      hasAnalyticsConsent: vi.fn(() => false),
    }));
    const { track } = await import("../analytics-client");
    await track("ui.cta_clicked", { ctaName: "x", location: "y" });
    expect(captureMock).not.toHaveBeenCalled();
    vi.doUnmock("@/components/shared/cookie-consent");
  });

  it("never throws even if capture blows up", async () => {
    captureMock.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    const { track } = await import("../analytics-client");
    await expect(
      track("ui.cta_clicked", { ctaName: "x", location: "y" })
    ).resolves.toBeUndefined();
  });
});
