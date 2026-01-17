/**
 * Slack and Discord webhook notification helpers
 *
 * Formats result notifications for both platforms following their respective APIs:
 * - Slack: Block Kit format with attachments
 * - Discord: Embed format with rich content
 */

// Category styling for notifications
const conversationCategoryConfig = {
  solution_request: { color: "#22c55e", emoji: "🎯", label: "Looking for Solution" },
  money_talk: { color: "#f59e0b", emoji: "💰", label: "Budget Talk" },
  pain_point: { color: "#ef4444", emoji: "😤", label: "Pain Point" },
  advice_request: { color: "#3b82f6", emoji: "❓", label: "Seeking Advice" },
  hot_discussion: { color: "#8b5cf6", emoji: "🔥", label: "Trending" },
} as const;

const sentimentConfig = {
  positive: { color: "#22c55e", emoji: "👍" },
  negative: { color: "#ef4444", emoji: "👎" },
  neutral: { color: "#6b7280", emoji: "➖" },
} as const;

type ConversationCategory = keyof typeof conversationCategoryConfig;

interface NotificationResult {
  id: string;
  title: string;
  content?: string | null;
  sourceUrl: string;
  platform: string;
  author?: string | null;
  postedAt?: Date | string | null;
  sentiment?: "positive" | "negative" | "neutral" | null;
  conversationCategory?: ConversationCategory | null;
  aiSummary?: string | null;
}

interface WebhookPayload {
  monitorName: string;
  results: NotificationResult[];
  dashboardUrl?: string;
}

// ============================================================================
// SLACK WEBHOOK
// ============================================================================

interface SlackTextElement {
  type: string;
  text: string;
  emoji?: boolean;
}

interface SlackMrkdwnElement {
  type: "mrkdwn";
  text: string;
}

interface SlackBlock {
  type: string;
  text?: SlackTextElement | SlackMrkdwnElement;
  elements?: Array<SlackMrkdwnElement>;
  accessory?: {
    type: string;
    text: SlackTextElement;
    url: string;
  };
}

interface SlackAttachment {
  color: string;
  blocks: SlackBlock[];
}

interface SlackPayload {
  text: string;
  blocks: SlackBlock[];
  attachments: SlackAttachment[];
}

/**
 * Format a Slack webhook payload using Block Kit
 * @see https://api.slack.com/reference/surfaces/formatting
 */
export function formatSlackPayload(payload: WebhookPayload): SlackPayload {
  const { monitorName, results, dashboardUrl } = payload;

  // Header block
  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `📡 ${monitorName} - ${results.length} new mention${results.length !== 1 ? "s" : ""}`,
        emoji: true,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Kaulby Monitor Alert • ${new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`,
        },
      ],
    },
    {
      type: "divider",
    },
  ];

  // Create attachments for each result (up to 5)
  const attachments: SlackAttachment[] = results.slice(0, 5).map((result) => {
    const category = result.conversationCategory
      ? conversationCategoryConfig[result.conversationCategory]
      : null;
    const sentiment = result.sentiment
      ? sentimentConfig[result.sentiment]
      : null;

    const color = category?.color || sentiment?.color || "#0ea5e9";

    const attachmentBlocks: SlackBlock[] = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*<${result.sourceUrl}|${escapeSlackText(result.title)}>*`,
        },
        accessory: {
          type: "button",
          text: {
            type: "plain_text",
            text: "View",
            emoji: true,
          },
          url: result.sourceUrl,
        },
      },
    ];

    // Add category and sentiment badges
    const badges: string[] = [];
    badges.push(`\`${result.platform}\``);
    if (category) {
      badges.push(`${category.emoji} ${category.label}`);
    }
    if (sentiment) {
      badges.push(`${sentiment.emoji} ${result.sentiment}`);
    }

    attachmentBlocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: badges.join(" • "),
        },
      ],
    });

    // Add AI summary if available
    if (result.aiSummary) {
      attachmentBlocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `> ${escapeSlackText(result.aiSummary.slice(0, 200))}${result.aiSummary.length > 200 ? "..." : ""}`,
        },
      });
    }

    // Add author/date context
    const meta: string[] = [];
    if (result.author) {
      meta.push(`by ${result.author}`);
    }
    if (result.postedAt) {
      meta.push(new Date(result.postedAt).toLocaleDateString());
    }
    if (meta.length > 0) {
      attachmentBlocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: meta.join(" • "),
          },
        ],
      });
    }

    return {
      color,
      blocks: attachmentBlocks,
    };
  });

  // Add footer with dashboard link
  if (dashboardUrl) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `<${dashboardUrl}|View all results in Kaulby Dashboard>`,
      },
    });
  }

  return {
    text: `${results.length} new mention${results.length !== 1 ? "s" : ""} for ${monitorName}`,
    blocks,
    attachments,
  };
}

/**
 * Send a Slack webhook notification
 */
export async function sendSlackWebhook(
  webhookUrl: string,
  payload: WebhookPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const slackPayload = formatSlackPayload(payload);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(slackPayload),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `Slack webhook failed: ${response.status} - ${text}` };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// DISCORD WEBHOOK
// ============================================================================

interface DiscordEmbed {
  title: string;
  url: string;
  description?: string;
  color: number;
  fields: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  footer?: {
    text: string;
  };
  timestamp?: string;
}

interface DiscordPayload {
  content: string;
  embeds: DiscordEmbed[];
}

/**
 * Format a Discord webhook payload using embeds
 * @see https://discord.com/developers/docs/resources/channel#embed-object
 */
export function formatDiscordPayload(payload: WebhookPayload): DiscordPayload {
  const { monitorName, results, dashboardUrl } = payload;

  // Create embeds for each result (up to 5, Discord limit is 10)
  const embeds: DiscordEmbed[] = results.slice(0, 5).map((result) => {
    const category = result.conversationCategory
      ? conversationCategoryConfig[result.conversationCategory]
      : null;
    const sentiment = result.sentiment
      ? sentimentConfig[result.sentiment]
      : null;

    // Discord colors are decimal integers
    const colorHex = category?.color || sentiment?.color || "#0ea5e9";
    const color = parseInt(colorHex.replace("#", ""), 16);

    const fields: DiscordEmbed["fields"] = [
      {
        name: "Platform",
        value: result.platform.charAt(0).toUpperCase() + result.platform.slice(1),
        inline: true,
      },
    ];

    if (category) {
      fields.push({
        name: "Category",
        value: `${category.emoji} ${category.label}`,
        inline: true,
      });
    }

    if (sentiment) {
      fields.push({
        name: "Sentiment",
        value: `${sentiment.emoji} ${result.sentiment}`,
        inline: true,
      });
    }

    const embed: DiscordEmbed = {
      title: result.title.slice(0, 256), // Discord title limit
      url: result.sourceUrl,
      color,
      fields,
    };

    // Add AI summary as description
    if (result.aiSummary) {
      embed.description = result.aiSummary.slice(0, 300) +
        (result.aiSummary.length > 300 ? "..." : "");
    }

    // Add footer with author/date
    const footerParts: string[] = [];
    if (result.author) {
      footerParts.push(`by ${result.author}`);
    }
    if (result.postedAt) {
      embed.timestamp = new Date(result.postedAt).toISOString();
    }
    if (footerParts.length > 0) {
      embed.footer = { text: footerParts.join(" • ") };
    }

    return embed;
  });

  // Add a summary embed at the end if there are more results
  if (results.length > 5) {
    embeds.push({
      title: `+ ${results.length - 5} more mentions`,
      url: dashboardUrl || "https://kaulbyapp.com/dashboard",
      color: 0x0ea5e9,
      fields: [],
      footer: {
        text: "View all in Kaulby Dashboard",
      },
    });
  }

  return {
    content: `📡 **${monitorName}** - ${results.length} new mention${results.length !== 1 ? "s" : ""} found!`,
    embeds,
  };
}

/**
 * Send a Discord webhook notification
 */
export async function sendDiscordWebhook(
  webhookUrl: string,
  payload: WebhookPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const discordPayload = formatDiscordPayload(payload);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(discordPayload),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `Discord webhook failed: ${response.status} - ${text}` };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Escape special Slack mrkdwn characters
 */
function escapeSlackText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Detect webhook type from URL
 */
export function detectWebhookType(url: string): "slack" | "discord" | "unknown" {
  if (url.includes("hooks.slack.com") || url.includes("slack.com/services")) {
    return "slack";
  }
  if (url.includes("discord.com/api/webhooks") || url.includes("discordapp.com/api/webhooks")) {
    return "discord";
  }
  return "unknown";
}

/**
 * Send notification to a webhook (auto-detects Slack or Discord)
 */
export async function sendWebhookNotification(
  webhookUrl: string,
  payload: WebhookPayload
): Promise<{ success: boolean; error?: string; type: string }> {
  const type = detectWebhookType(webhookUrl);

  if (type === "slack") {
    const result = await sendSlackWebhook(webhookUrl, payload);
    return { ...result, type: "slack" };
  }

  if (type === "discord") {
    const result = await sendDiscordWebhook(webhookUrl, payload);
    return { ...result, type: "discord" };
  }

  // For unknown webhook types, try a simple POST with JSON
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        monitorName: payload.monitorName,
        resultsCount: payload.results.length,
        results: payload.results.map((r) => ({
          title: r.title,
          url: r.sourceUrl,
          platform: r.platform,
          sentiment: r.sentiment,
          category: r.conversationCategory,
          summary: r.aiSummary,
        })),
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `Webhook failed: ${response.status} - ${text}`, type: "generic" };
    }

    return { success: true, type: "generic" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      type: "generic",
    };
  }
}

// Export types
export type { WebhookPayload, NotificationResult };
