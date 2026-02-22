import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock env vars before importing
vi.stubEnv("SLACK_CLIENT_ID", "test-client-id");
vi.stubEnv("SLACK_CLIENT_SECRET", "test-client-secret");
vi.stubEnv("SLACK_REDIRECT_URI", "https://example.com/callback");

// We need to dynamically import after env is set, but the module reads env at load time.
// So we mock fetch globally and re-import for each test.

describe("Slack Integration", () => {
  let slackModule: typeof import("../integrations/slack");

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("SLACK_CLIENT_ID", "test-client-id");
    vi.stubEnv("SLACK_CLIENT_SECRET", "test-client-secret");
    vi.stubEnv("SLACK_REDIRECT_URI", "https://example.com/callback");
    slackModule = await import("../integrations/slack");
  });

  describe("getAuthorizationUrl", () => {
    it("returns a valid Slack OAuth URL with correct params", () => {
      const url = slackModule.getAuthorizationUrl("my-state");
      expect(url).toContain("https://slack.com/oauth/v2/authorize");
      expect(url).toContain("client_id=test-client-id");
      expect(url).toContain("state=my-state");
      expect(url).toContain("redirect_uri=");
    });

    it("throws when SLACK_CLIENT_ID is not set", async () => {
      vi.resetModules();
      vi.stubEnv("SLACK_CLIENT_ID", "");
      const mod = await import("../integrations/slack");
      expect(() => mod.getAuthorizationUrl("state")).toThrow(
        "SLACK_CLIENT_ID not configured"
      );
    });
  });

  describe("isSlackConfigured", () => {
    it("returns true when both client id and secret are set", () => {
      expect(slackModule.isSlackConfigured()).toBe(true);
    });

    it("returns false when credentials are missing", async () => {
      vi.resetModules();
      vi.stubEnv("SLACK_CLIENT_ID", "");
      vi.stubEnv("SLACK_CLIENT_SECRET", "");
      const mod = await import("../integrations/slack");
      expect(mod.isSlackConfigured()).toBe(false);
    });
  });

  describe("exchangeCodeForTokens", () => {
    it("returns tokens on successful exchange", async () => {
      const mockResponse = {
        ok: true,
        access_token: "xoxb-test-token",
        team: { id: "T123", name: "Test Team" },
        incoming_webhook: {
          url: "https://hooks.slack.com/services/xxx",
          channel: "#general",
          channel_id: "C123",
        },
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        })
      );

      const tokens = await slackModule.exchangeCodeForTokens("auth-code");
      expect(tokens.accessToken).toBe("xoxb-test-token");
      expect(tokens.teamId).toBe("T123");
      expect(tokens.teamName).toBe("Test Team");
      expect(tokens.webhookUrl).toBe("https://hooks.slack.com/services/xxx");
    });

    it("throws on HTTP error", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          text: () => Promise.resolve("Bad request"),
        })
      );

      await expect(
        slackModule.exchangeCodeForTokens("bad-code")
      ).rejects.toThrow("Failed to exchange code");
    });

    it("throws on Slack API error response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ ok: false, error: "invalid_code" }),
        })
      );

      await expect(
        slackModule.exchangeCodeForTokens("bad-code")
      ).rejects.toThrow("Slack OAuth error: invalid_code");
    });

    it("throws when credentials are missing", async () => {
      vi.resetModules();
      vi.stubEnv("SLACK_CLIENT_ID", "");
      vi.stubEnv("SLACK_CLIENT_SECRET", "");
      const mod = await import("../integrations/slack");

      await expect(mod.exchangeCodeForTokens("code")).rejects.toThrow(
        "Slack credentials not configured"
      );
    });
  });
});
