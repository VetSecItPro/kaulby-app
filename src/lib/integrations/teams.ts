/**
 * Microsoft Teams Integration
 *
 * Enables sending real-time alerts to Microsoft Teams channels.
 * Uses incoming webhooks (no OAuth required - users paste their webhook URL).
 *
 * @see https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook
 */

export interface TeamsMessageCard {
  "@type": "MessageCard";
  "@context": "http://schema.org/extensions";
  themeColor: string;
  summary: string;
  sections: Array<{
    activityTitle: string;
    activitySubtitle?: string;
    activityImage?: string;
    facts?: Array<{ name: string; value: string }>;
    markdown?: boolean;
    text?: string;
  }>;
  potentialAction?: Array<{
    "@type": "OpenUri";
    name: string;
    targets: Array<{ os: string; uri: string }>;
  }>;
}

// Sentiment theme colors for Teams MessageCards (hex without #)
const SENTIMENT_COLORS: Record<string, string> = {
  positive: "22c55e",
  negative: "ef4444",
  neutral: "3b82f6",
  mixed: "f59e0b",
};

/**
 * Validate that a URL looks like a valid Microsoft Teams incoming webhook URL.
 *
 * Teams webhook URLs follow one of these patterns:
 * - https://<tenant>.webhook.office.com/webhookb2/...
 * - https://outlook.office.com/webhook/...  (legacy)
 * - Power Automate / Workflows URLs
 */
export function isValidTeamsWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;

    return (
      parsed.hostname.endsWith(".webhook.office.com") ||
      parsed.hostname === "outlook.office.com" ||
      parsed.hostname.endsWith(".logic.azure.com") ||
      parsed.hostname.endsWith(".webhook.office365.com")
    );
  } catch {
    return false;
  }
}

/**
 * Send a MessageCard to Microsoft Teams via incoming webhook.
 */
export async function sendTeamsMessage(
  webhookUrl: string,
  card: TeamsMessageCard
): Promise<{ success: boolean; error?: string }> {
  if (!webhookUrl) {
    return { success: false, error: "Webhook URL is required" };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        error: `Teams webhook failed: ${response.status} - ${text}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error sending Teams message",
    };
  }
}

/**
 * Format a Kaulby alert as a Teams MessageCard.
 */
export function formatTeamsAlert(params: {
  monitorName: string;
  results: Array<{
    title: string;
    platform: string;
    sourceUrl: string;
    sentiment?: string | null;
    aiSummary?: string | null;
  }>;
  dashboardUrl: string;
}): TeamsMessageCard {
  const { monitorName, results, dashboardUrl } = params;

  const sentimentKey =
    results[0]?.sentiment?.toLowerCase() ?? "neutral";
  const themeColor = SENTIMENT_COLORS[sentimentKey] ?? SENTIMENT_COLORS.neutral;

  const sections = results.slice(0, 5).map((result) => {
    const facts: Array<{ name: string; value: string }> = [
      {
        name: "Platform",
        value:
          result.platform.charAt(0).toUpperCase() + result.platform.slice(1),
      },
    ];

    if (result.sentiment) {
      facts.push({
        name: "Sentiment",
        value:
          result.sentiment.charAt(0).toUpperCase() + result.sentiment.slice(1),
      });
    }

    const section: TeamsMessageCard["sections"][number] = {
      activityTitle: `[${result.title.slice(0, 150)}](${result.sourceUrl})`,
      facts,
      markdown: true,
    };

    if (result.aiSummary) {
      section.text =
        result.aiSummary.slice(0, 300) +
        (result.aiSummary.length > 300 ? "..." : "");
    }

    return section;
  });

  // Add overflow section if more than 5 results
  if (results.length > 5) {
    sections.push({
      activityTitle: `+ ${results.length - 5} more mentions`,
      text: "View all mentions in the Kaulby dashboard.",
      markdown: true,
    });
  }

  return {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor,
    summary: `${monitorName} - ${results.length} new mention${results.length !== 1 ? "s" : ""}`,
    sections,
    potentialAction: [
      {
        "@type": "OpenUri",
        name: "View in Kaulby",
        targets: [{ os: "default", uri: dashboardUrl }],
      },
    ],
  };
}
