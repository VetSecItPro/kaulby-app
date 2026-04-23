import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the underlying posthog module so no real network calls happen.
// We capture calls on this mock to assert shape + distinctId mapping.
vi.mock("@/lib/posthog", () => ({
  captureEvent: vi.fn(),
}));

import { track } from "../analytics";
import { captureEvent } from "@/lib/posthog";

const mockCaptureEvent = vi.mocked(captureEvent);

describe("analytics.track", () => {
  beforeEach(() => {
    mockCaptureEvent.mockClear();
  });

  it("fires captureEvent exactly once per track call", () => {
    track("monitor.created", {
      userId: "user_1",
      monitorId: "mon_1",
      platform: "reddit",
      plan: "solo",
    });
    expect(mockCaptureEvent).toHaveBeenCalledTimes(1);
  });

  it("maps userId to distinctId and strips it from properties", () => {
    track("monitor.created", {
      userId: "user_abc",
      monitorId: "mon_1",
      platform: "reddit",
      plan: "free",
    });
    const call = mockCaptureEvent.mock.calls[0][0];
    expect(call.distinctId).toBe("user_abc");
    expect(call.event).toBe("monitor.created");
    // properties MUST NOT contain userId — that's PostHog's distinctId
    expect(call.properties).not.toHaveProperty("userId");
    expect(call.properties).toEqual({
      monitorId: "mon_1",
      platform: "reddit",
      plan: "free",
    });
  });

  it("scan.completed shape", () => {
    track("scan.completed", {
      userId: "u",
      monitorId: "m",
      platform: "reddit",
      resultsFound: 5,
      durationMs: 1234,
    });
    const call = mockCaptureEvent.mock.calls[0][0];
    expect(call.event).toBe("scan.completed");
    expect(call.properties).toEqual({
      monitorId: "m",
      platform: "reddit",
      resultsFound: 5,
      durationMs: 1234,
    });
  });

  it("scan.failed shape", () => {
    track("scan.failed", {
      userId: "u",
      monitorId: "m",
      platform: "github",
      errorType: "TimeoutError",
    });
    expect(mockCaptureEvent.mock.calls[0][0].properties).toEqual({
      monitorId: "m",
      platform: "github",
      errorType: "TimeoutError",
    });
  });

  it("ai_analysis.completed shape with null sentiment", () => {
    track("ai_analysis.completed", {
      userId: "u",
      resultId: "r",
      sentiment: null,
      tier: "solo",
      costUsd: 0.0012,
    });
    const call = mockCaptureEvent.mock.calls[0][0];
    expect(call.event).toBe("ai_analysis.completed");
    expect(call.properties).toEqual({
      resultId: "r",
      sentiment: null,
      tier: "solo",
      costUsd: 0.0012,
    });
  });

  it("ai_analysis.failed shape", () => {
    track("ai_analysis.failed", {
      userId: "u",
      resultId: "r",
      errorType: "ZodError",
    });
    expect(mockCaptureEvent.mock.calls[0][0].properties).toEqual({
      resultId: "r",
      errorType: "ZodError",
    });
  });

  it("payment.succeeded shape", () => {
    track("payment.succeeded", {
      userId: "u",
      tier: "growth",
      interval: "annual",
    });
    const call = mockCaptureEvent.mock.calls[0][0];
    expect(call.event).toBe("payment.succeeded");
    expect(call.distinctId).toBe("u");
    expect(call.properties).toEqual({ tier: "growth", interval: "annual" });
  });

  it("result.action_taken shape for each action variant", () => {
    const actions = ["hide", "mark_read", "save", "unsave"] as const;
    for (const action of actions) {
      track("result.action_taken", {
        userId: "u",
        resultId: "r",
        action,
      });
    }
    expect(mockCaptureEvent).toHaveBeenCalledTimes(actions.length);
    for (let i = 0; i < actions.length; i++) {
      expect(mockCaptureEvent.mock.calls[i][0].properties).toEqual({
        resultId: "r",
        action: actions[i],
      });
    }
  });
});
