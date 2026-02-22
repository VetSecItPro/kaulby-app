import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  formatSlackPayload,
  formatDiscordPayload,
  detectWebhookType,
  sendWebhookNotification,
} from "../notifications/webhooks";
import type { WebhookPayload, NotificationResult } from "../notifications/webhooks";

describe("Webhook Notifications", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const makeResult = (overrides?: Partial<NotificationResult>): NotificationResult => ({
    id: "r1",
    title: "Test Post Title",
    sourceUrl: "https://reddit.com/r/test/123",
    platform: "reddit",
    sentiment: "positive",
    conversationCategory: "solution_request",
    aiSummary: "This is an AI summary of the post.",
    engagement: 42,
    commentCount: 10,
    author: "testuser",
    postedAt: new Date("2025-01-15T12:00:00Z"),
    ...overrides,
  });

  const makePayload = (overrides?: Partial<WebhookPayload>): WebhookPayload => ({
    monitorName: "Brand Monitor",
    results: [makeResult()],
    dashboardUrl: "https://kaulbyapp.com/dashboard",
    ...overrides,
  });

  describe("detectWebhookType", () => {
    it("detects Slack hooks.slack.com URLs", () => {
      expect(
        detectWebhookType("https://hooks.slack.com/services/T123/B456/xxx")
      ).toBe("slack");
    });

    it("detects Slack slack.com/services URLs", () => {
      expect(
        detectWebhookType("https://slack.com/services/T123/B456")
      ).toBe("slack");
    });

    it("detects Discord webhook URLs", () => {
      expect(
        detectWebhookType("https://discord.com/api/webhooks/123/abc")
      ).toBe("discord");
    });

    it("detects discordapp.com webhook URLs", () => {
      expect(
        detectWebhookType("https://discordapp.com/api/webhooks/123/abc")
      ).toBe("discord");
    });

    it("returns unknown for other URLs", () => {
      expect(detectWebhookType("https://example.com/webhook")).toBe("unknown");
    });
  });

  describe("formatSlackPayload", () => {
    it("creates a valid Slack Block Kit payload", () => {
      const payload = formatSlackPayload(makePayload());
      expect(payload.text).toContain("1 new mention");
      expect(payload.text).toContain("Brand Monitor");
      expect(payload.blocks).toBeDefined();
      expect(payload.blocks.length).toBeGreaterThan(0);
      expect(payload.attachments).toHaveLength(1);
    });

    it("includes header block", () => {
      const payload = formatSlackPayload(makePayload());
      const header = payload.blocks.find((b) => b.type === "header");
      expect(header).toBeDefined();
      expect(header!.text!.text).toContain("Brand Monitor");
    });

    it("includes dashboard link when provided", () => {
      const payload = formatSlackPayload(makePayload());
      const sectionBlocks = payload.blocks.filter((b) => b.type === "section");
      const dashLink = sectionBlocks.find((b) =>
        b.text?.text?.includes("kaulbyapp.com/dashboard")
      );
      expect(dashLink).toBeDefined();
    });

    it("limits to 5 result attachments", () => {
      const results = Array.from({ length: 8 }, (_, i) =>
        makeResult({ id: `r${i}`, title: `Post ${i}` })
      );
      const payload = formatSlackPayload(makePayload({ results }));
      expect(payload.attachments).toHaveLength(5);
    });

    it("includes AI summary in attachment", () => {
      const payload = formatSlackPayload(makePayload());
      const firstAttachment = payload.attachments[0];
      const summaryBlock = firstAttachment.blocks.find(
        (b) => b.text?.text?.includes("AI summary")
      );
      expect(summaryBlock).toBeDefined();
    });

    it("includes category and sentiment badges", () => {
      const payload = formatSlackPayload(makePayload());
      const attachment = payload.attachments[0];
      const contextBlock = attachment.blocks.find(
        (b) =>
          b.type === "context" &&
          b.elements?.some((e) => e.text.includes("reddit"))
      );
      expect(contextBlock).toBeDefined();
    });

    it("pluralizes mentions correctly for single result", () => {
      const payload = formatSlackPayload(makePayload());
      expect(payload.text).toContain("1 new mention for");
      expect(payload.text).not.toContain("mentions");
    });

    it("pluralizes mentions correctly for multiple results", () => {
      const payload = formatSlackPayload(
        makePayload({
          results: [makeResult(), makeResult({ id: "r2" })],
        })
      );
      expect(payload.text).toContain("2 new mentions");
    });
  });

  describe("formatDiscordPayload", () => {
    it("creates a valid Discord embed payload", () => {
      const payload = formatDiscordPayload(makePayload());
      expect(payload.content).toContain("Brand Monitor");
      expect(payload.embeds).toHaveLength(1);
      expect(payload.embeds[0].title).toBe("Test Post Title");
    });

    it("includes platform field", () => {
      const payload = formatDiscordPayload(makePayload());
      const platformField = payload.embeds[0].fields.find(
        (f) => f.name === "Platform"
      );
      expect(platformField).toBeDefined();
      expect(platformField!.value).toBe("Reddit");
    });

    it("includes category and sentiment fields", () => {
      const payload = formatDiscordPayload(makePayload());
      const fields = payload.embeds[0].fields;
      expect(fields.find((f) => f.name === "Category")).toBeDefined();
      expect(fields.find((f) => f.name === "Sentiment")).toBeDefined();
    });

    it("includes engagement and comment fields", () => {
      const payload = formatDiscordPayload(makePayload());
      const fields = payload.embeds[0].fields;
      expect(fields.find((f) => f.name === "Engagement")).toBeDefined();
      expect(fields.find((f) => f.name === "Comments")).toBeDefined();
    });

    it("truncates title at 256 characters", () => {
      const longTitle = "A".repeat(300);
      const payload = formatDiscordPayload(
        makePayload({ results: [makeResult({ title: longTitle })] })
      );
      expect(payload.embeds[0].title.length).toBe(256);
    });

    it("adds overflow embed for > 5 results", () => {
      const results = Array.from({ length: 7 }, (_, i) =>
        makeResult({ id: `r${i}` })
      );
      const payload = formatDiscordPayload(makePayload({ results }));
      expect(payload.embeds).toHaveLength(6); // 5 + 1 overflow
      expect(payload.embeds[5].title).toContain("+ 2 more");
    });

    it("includes AI summary as description", () => {
      const payload = formatDiscordPayload(makePayload());
      expect(payload.embeds[0].description).toContain("AI summary");
    });

    it("truncates long AI summary", () => {
      const longSummary = "X".repeat(400);
      const payload = formatDiscordPayload(
        makePayload({
          results: [makeResult({ aiSummary: longSummary })],
        })
      );
      expect(payload.embeds[0].description!.length).toBeLessThanOrEqual(303); // 300 + "..."
    });

    it("includes author in footer", () => {
      const payload = formatDiscordPayload(makePayload());
      expect(payload.embeds[0].footer?.text).toContain("testuser");
    });

    it("includes timestamp from postedAt", () => {
      const payload = formatDiscordPayload(makePayload());
      expect(payload.embeds[0].timestamp).toBe("2025-01-15T12:00:00.000Z");
    });
  });

  describe("sendWebhookNotification", () => {
    it("sends to Slack when URL is a Slack webhook", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve("ok"),
        })
      );

      const result = await sendWebhookNotification(
        "https://hooks.slack.com/services/T123/B456/xxx",
        makePayload()
      );
      expect(result.success).toBe(true);
      expect(result.type).toBe("slack");
    });

    it("sends to Discord when URL is a Discord webhook", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve(""),
        })
      );

      const result = await sendWebhookNotification(
        "https://discord.com/api/webhooks/123/abc",
        makePayload()
      );
      expect(result.success).toBe(true);
      expect(result.type).toBe("discord");
    });

    it("sends generic JSON for unknown webhook URLs", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve(""),
        })
      );

      const result = await sendWebhookNotification(
        "https://example.com/my-webhook",
        makePayload()
      );
      expect(result.success).toBe(true);
      expect(result.type).toBe("generic");
    });

    it("returns error on Slack webhook failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: () => Promise.resolve("Internal Server Error"),
        })
      );

      const result = await sendWebhookNotification(
        "https://hooks.slack.com/services/T123/B456/xxx",
        makePayload()
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Slack webhook failed");
    });

    it("returns error on Discord webhook failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          text: () => Promise.resolve("Bad Request"),
        })
      );

      const result = await sendWebhookNotification(
        "https://discord.com/api/webhooks/123/abc",
        makePayload()
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Discord webhook failed");
    });

    it("returns error on generic webhook failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          text: () => Promise.resolve("Not Found"),
        })
      );

      const result = await sendWebhookNotification(
        "https://example.com/webhook",
        makePayload()
      );
      expect(result.success).toBe(false);
      expect(result.type).toBe("generic");
    });

    it("handles network errors gracefully", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("Connection refused"))
      );

      const result = await sendWebhookNotification(
        "https://hooks.slack.com/services/T/B/x",
        makePayload()
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe("Connection refused");
    });

    it("handles non-Error throws gracefully", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue("string error")
      );

      const result = await sendWebhookNotification(
        "https://example.com/webhook",
        makePayload()
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error");
    });
  });
});
