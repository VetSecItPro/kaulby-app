import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Discord Integration", () => {
  let discordModule: typeof import("../integrations/discord");

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("DISCORD_CLIENT_ID", "test-discord-id");
    vi.stubEnv("DISCORD_CLIENT_SECRET", "test-discord-secret");
    vi.stubEnv("DISCORD_BOT_TOKEN", "test-bot-token");
    vi.stubEnv("DISCORD_REDIRECT_URI", "https://example.com/discord/callback");
    discordModule = await import("../integrations/discord");
  });

  describe("getAuthorizationUrl", () => {
    it("returns a valid Discord OAuth URL", () => {
      const url = discordModule.getAuthorizationUrl("my-state");
      expect(url).toContain("https://discord.com/api/oauth2/authorize");
      expect(url).toContain("client_id=test-discord-id");
      expect(url).toContain("state=my-state");
      expect(url).toContain("response_type=code");
    });

    it("throws when DISCORD_CLIENT_ID is not set", async () => {
      vi.resetModules();
      vi.stubEnv("DISCORD_CLIENT_ID", "");
      const mod = await import("../integrations/discord");
      expect(() => mod.getAuthorizationUrl("state")).toThrow(
        "DISCORD_CLIENT_ID not configured"
      );
    });
  });

  describe("isDiscordConfigured", () => {
    it("returns true when all credentials are set", () => {
      expect(discordModule.isDiscordConfigured()).toBe(true);
    });

    it("returns false when bot token is missing", async () => {
      vi.resetModules();
      vi.stubEnv("DISCORD_CLIENT_ID", "id");
      vi.stubEnv("DISCORD_CLIENT_SECRET", "secret");
      vi.stubEnv("DISCORD_BOT_TOKEN", "");
      const mod = await import("../integrations/discord");
      expect(mod.isDiscordConfigured()).toBe(false);
    });
  });

  describe("exchangeCodeForTokens", () => {
    it("returns tokens on success", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: "discord-access",
              refresh_token: "discord-refresh",
              expires_in: 604800,
              guild: { id: "G123", name: "Test Guild" },
            }),
        })
      );

      const tokens = await discordModule.exchangeCodeForTokens("auth-code");
      expect(tokens.accessToken).toBe("discord-access");
      expect(tokens.refreshToken).toBe("discord-refresh");
      expect(tokens.expiresIn).toBe(604800);
      expect(tokens.guildId).toBe("G123");
      expect(tokens.guildName).toBe("Test Guild");
    });

    it("throws on HTTP error", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          text: () => Promise.resolve("Unauthorized"),
        })
      );

      await expect(
        discordModule.exchangeCodeForTokens("bad")
      ).rejects.toThrow("Failed to exchange code");
    });

    it("throws when credentials missing", async () => {
      vi.resetModules();
      vi.stubEnv("DISCORD_CLIENT_ID", "");
      vi.stubEnv("DISCORD_CLIENT_SECRET", "");
      vi.stubEnv("DISCORD_BOT_TOKEN", "tok");
      const mod = await import("../integrations/discord");
      await expect(mod.exchangeCodeForTokens("code")).rejects.toThrow(
        "Discord credentials not configured"
      );
    });
  });

  describe("listGuildTextChannels", () => {
    it("returns filtered text channels sorted alphabetically", async () => {
      const channels = [
        { id: "1", name: "general", type: 0 },
        { id: "2", name: "voice-chat", type: 2 },
        { id: "3", name: "announcements", type: 0 },
      ];

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(channels),
        })
      );

      const result = await discordModule.listGuildTextChannels("G123");
      expect(result.channels).toHaveLength(2);
      expect(result.channels[0].name).toBe("announcements");
      expect(result.channels[1].name).toBe("general");
      expect(result.error).toBeUndefined();
    });

    it("returns error when bot token is missing", async () => {
      vi.resetModules();
      vi.stubEnv("DISCORD_CLIENT_ID", "id");
      vi.stubEnv("DISCORD_CLIENT_SECRET", "secret");
      vi.stubEnv("DISCORD_BOT_TOKEN", "");
      const mod = await import("../integrations/discord");

      const result = await mod.listGuildTextChannels("G123");
      expect(result.channels).toHaveLength(0);
      expect(result.error).toContain("DISCORD_BOT_TOKEN not configured");
    });

    it("returns error on API failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          text: () => Promise.resolve("Forbidden"),
        })
      );

      const result = await discordModule.listGuildTextChannels("G123");
      expect(result.channels).toHaveLength(0);
      expect(result.error).toContain("Failed to list channels");
    });

    it("returns error on network failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("Network down"))
      );

      const result = await discordModule.listGuildTextChannels("G123");
      expect(result.channels).toHaveLength(0);
      expect(result.error).toBe("Network down");
    });
  });

  describe("sendDiscordBotMessage", () => {
    const payload = {
      monitorName: "Test Monitor",
      results: [
        {
          title: "Test Post",
          sourceUrl: "https://example.com",
          platform: "reddit",
          sentiment: "positive" as const,
          aiSummary: "A summary",
        },
      ],
      dashboardUrl: "https://kaulbyapp.com/dash",
    };

    it("sends message successfully", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true })
      );

      const result = await discordModule.sendDiscordBotMessage("C123", payload);
      expect(result.success).toBe(true);
    });

    it("returns error when bot token is missing", async () => {
      vi.resetModules();
      vi.stubEnv("DISCORD_CLIENT_ID", "id");
      vi.stubEnv("DISCORD_CLIENT_SECRET", "secret");
      vi.stubEnv("DISCORD_BOT_TOKEN", "");
      const mod = await import("../integrations/discord");

      const result = await mod.sendDiscordBotMessage("C123", payload);
      expect(result.success).toBe(false);
      expect(result.error).toContain("DISCORD_BOT_TOKEN not configured");
    });

    it("returns error when channelId is empty", async () => {
      const result = await discordModule.sendDiscordBotMessage("", payload);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Channel ID is required");
    });

    it("returns error when no results", async () => {
      const result = await discordModule.sendDiscordBotMessage("C123", {
        ...payload,
        results: [],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("No results to send");
    });

    it("returns error on API failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: () => Promise.resolve("Server error"),
        })
      );

      const result = await discordModule.sendDiscordBotMessage("C123", payload);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Discord bot message failed");
    });
  });

  describe("sendDiscordMessage (webhook)", () => {
    const payload = {
      monitorName: "Test Monitor",
      results: [
        {
          title: "Post Title",
          sourceUrl: "https://example.com",
          platform: "hackernews",
          sentiment: null,
          aiSummary: null,
        },
      ],
      dashboardUrl: "https://kaulbyapp.com/dash",
    };

    it("sends webhook message successfully", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true })
      );

      const result = await discordModule.sendDiscordMessage(
        "https://discord.com/api/webhooks/123/abc",
        payload
      );
      expect(result.success).toBe(true);
    });

    it("returns error when webhookUrl is empty", async () => {
      const result = await discordModule.sendDiscordMessage("", payload);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Webhook URL is required");
    });

    it("returns error when no results", async () => {
      const result = await discordModule.sendDiscordMessage(
        "https://discord.com/api/webhooks/123/abc",
        { ...payload, results: [] }
      );
      expect(result.success).toBe(false);
    });

    it("handles more than 5 results (overflow embed)", async () => {
      const manyResults = Array.from({ length: 7 }, (_, i) => ({
        title: `Post ${i}`,
        sourceUrl: `https://example.com/${i}`,
        platform: "reddit",
        sentiment: null,
        aiSummary: null,
      }));

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true })
      );

      const result = await discordModule.sendDiscordMessage(
        "https://discord.com/api/webhooks/123/abc",
        { ...payload, results: manyResults }
      );
      expect(result.success).toBe(true);

      // Verify the fetch body contains the overflow embed
      const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.embeds.length).toBe(6); // 5 results + 1 overflow
      expect(body.embeds[5].title).toContain("+ 2 more mentions");
    });
  });
});
