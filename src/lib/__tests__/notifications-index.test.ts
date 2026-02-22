import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  formatSlackPayload,
  formatDiscordPayload,
  detectWebhookType,
  sendWebhookNotification,
} from "../notifications/webhooks";

describe("notifications/webhooks", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // detectWebhookType
  // =========================================================================
  describe("detectWebhookType", () => {
    it("detects Slack webhook URLs", () => {
      expect(detectWebhookType("https://hooks.slack.com/services/T123/B456/abc")).toBe("slack");
    });

    it("detects Slack webhook URLs with slack.com/services", () => {
      expect(detectWebhookType("https://slack.com/services/T123")).toBe("slack");
    });

    it("detects Discord webhook URLs", () => {
      expect(detectWebhookType("https://discord.com/api/webhooks/123/abc")).toBe("discord");
    });

    it("detects discordapp.com webhook URLs", () => {
      expect(detectWebhookType("https://discordapp.com/api/webhooks/123/abc")).toBe("discord");
    });

    it("returns unknown for unrecognized URLs", () => {
      expect(detectWebhookType("https://example.com/webhook")).toBe("unknown");
    });

    it("returns unknown for empty string", () => {
      expect(detectWebhookType("")).toBe("unknown");
    });
  });

  // =========================================================================
  // formatSlackPayload
  // =========================================================================
  describe("formatSlackPayload", () => {
    const basePayload = {
      monitorName: "Test Monitor",
      results: [
        {
          id: "r1",
          title: "Test Post",
          sourceUrl: "https://reddit.com/r/test/1",
          platform: "reddit",
          sentiment: "positive" as const,
          conversationCategory: "solution_request" as const,
          aiSummary: "A user looking for solutions",
        },
      ],
      dashboardUrl: "https://kaulbyapp.com/dash",
    };

    it("includes monitor name in header", () => {
      const payload = formatSlackPayload(basePayload);
      const header = payload.blocks[0];
      expect((header.text as { text: string }).text).toContain("Test Monitor");
    });

    it("includes mention count in header", () => {
      const payload = formatSlackPayload(basePayload);
      const header = payload.blocks[0];
      expect((header.text as { text: string }).text).toContain("1 new mention");
    });

    it("pluralizes mentions correctly", () => {
      const payload = formatSlackPayload({
        ...basePayload,
        results: [
          ...basePayload.results,
          { ...basePayload.results[0], id: "r2", title: "Second Post" },
        ],
      });
      const header = payload.blocks[0];
      expect((header.text as { text: string }).text).toContain("2 new mentions");
    });

    it("creates attachments for results (up to 5)", () => {
      const payload = formatSlackPayload(basePayload);
      expect(payload.attachments).toHaveLength(1);
    });

    it("limits attachments to 5 results", () => {
      const manyResults = Array.from({ length: 8 }, (_, i) => ({
        ...basePayload.results[0],
        id: `r${i}`,
        title: `Post ${i}`,
      }));
      const payload = formatSlackPayload({ ...basePayload, results: manyResults });
      expect(payload.attachments).toHaveLength(5);
    });

    it("includes dashboard URL link when provided", () => {
      const payload = formatSlackPayload(basePayload);
      const lastBlock = payload.blocks[payload.blocks.length - 1];
      expect((lastBlock.text as { text: string }).text).toContain("kaulbyapp.com/dash");
    });

    it("includes fallback text field", () => {
      const payload = formatSlackPayload(basePayload);
      expect(payload.text).toContain("1 new mention");
      expect(payload.text).toContain("Test Monitor");
    });
  });

  // =========================================================================
  // formatDiscordPayload
  // =========================================================================
  describe("formatDiscordPayload", () => {
    const basePayload = {
      monitorName: "Brand Monitor",
      results: [
        {
          id: "r1",
          title: "A great review",
          sourceUrl: "https://reddit.com/r/test/1",
          platform: "reddit",
          sentiment: "negative" as const,
          aiSummary: "User complained about speed",
          author: "testuser",
          postedAt: "2025-01-15T10:00:00Z",
        },
      ],
      dashboardUrl: "https://kaulbyapp.com/dash",
    };

    it("includes monitor name in content", () => {
      const payload = formatDiscordPayload(basePayload);
      expect(payload.content).toContain("Brand Monitor");
    });

    it("creates embeds for results", () => {
      const payload = formatDiscordPayload(basePayload);
      expect(payload.embeds).toHaveLength(1);
      expect(payload.embeds[0].title).toBe("A great review");
      expect(payload.embeds[0].url).toBe("https://reddit.com/r/test/1");
    });

    it("includes platform field in embed", () => {
      const payload = formatDiscordPayload(basePayload);
      const platformField = payload.embeds[0].fields.find((f) => f.name === "Platform");
      expect(platformField?.value).toBe("Reddit");
    });

    it("includes sentiment field when present", () => {
      const payload = formatDiscordPayload(basePayload);
      const sentimentField = payload.embeds[0].fields.find((f) => f.name === "Sentiment");
      expect(sentimentField).toBeDefined();
      expect(sentimentField?.value).toContain("negative");
    });

    it("adds overflow embed when more than 5 results", () => {
      const manyResults = Array.from({ length: 7 }, (_, i) => ({
        ...basePayload.results[0],
        id: `r${i}`,
        title: `Post ${i}`,
      }));
      const payload = formatDiscordPayload({ ...basePayload, results: manyResults });
      expect(payload.embeds).toHaveLength(6); // 5 results + 1 overflow
      expect(payload.embeds[5].title).toContain("+ 2 more mentions");
    });

    it("includes author in footer", () => {
      const payload = formatDiscordPayload(basePayload);
      expect(payload.embeds[0].footer?.text).toContain("testuser");
    });

    it("includes AI summary as description", () => {
      const payload = formatDiscordPayload(basePayload);
      expect(payload.embeds[0].description).toContain("complained about speed");
    });
  });

  // =========================================================================
  // sendWebhookNotification
  // =========================================================================
  describe("sendWebhookNotification", () => {
    const payload = {
      monitorName: "Test",
      results: [
        {
          id: "r1",
          title: "Post",
          sourceUrl: "https://example.com",
          platform: "reddit",
        },
      ],
    };

    it("sends to Slack webhook successfully", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true } as never)
      );

      const result = await sendWebhookNotification(
        "https://hooks.slack.com/services/T/B/x",
        payload
      );
      expect(result.success).toBe(true);
      expect(result.type).toBe("slack");
    });

    it("sends to Discord webhook successfully", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true } as never)
      );

      const result = await sendWebhookNotification(
        "https://discord.com/api/webhooks/123/abc",
        payload
      );
      expect(result.success).toBe(true);
      expect(result.type).toBe("discord");
    });

    it("sends generic JSON for unknown webhook types", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true } as never)
      );

      const result = await sendWebhookNotification(
        "https://example.com/webhook",
        payload
      );
      expect(result.success).toBe(true);
      expect(result.type).toBe("generic");
    });

    it("returns error on fetch failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("Network error"))
      );

      const result = await sendWebhookNotification(
        "https://example.com/webhook",
        payload
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });

    it("returns error on non-ok response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          text: () => Promise.resolve("Forbidden"),
        } as never)
      );

      const result = await sendWebhookNotification(
        "https://hooks.slack.com/services/T/B/x",
        payload
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("403");
    });
  });
});
