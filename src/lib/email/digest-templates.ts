/**
 * Email Digest Templates - Newsletter-quality email digests
 *
 * Two types:
 * - Daily Digest (Pro): Quick morning scan of yesterday's mentions
 * - Weekly Intelligence Report (Team): Full executive briefing
 *
 * Both designed to be:
 * - Mobile-first and responsive
 * - Scannable with clear hierarchy
 * - Newsletter-quality design (like Morning Brew)
 */

import type { WeeklyInsightsResult } from "../ai/analyzers/weekly-insights";
import { escapeHtml, escapeRegExp, sanitizeUrl } from "../security/sanitize";

// ============================================================================
// TYPES
// ============================================================================

export interface DigestMention {
  id: string;
  title: string;
  url: string;
  platform: string;
  subreddit?: string;
  sentiment: "positive" | "negative" | "neutral" | null;
  category: string | null;
  summary: string | null;
  urgency?: "high" | "medium" | "low";
  intentScore?: number;
  shouldRespond?: boolean;
  monitorName: string;
  // Keywords that matched this result (for highlighting)
  matchedKeywords?: string[];
}

export interface DailyDigestData {
  userName: string;
  date: Date;
  mentions: DigestMention[];
  stats: {
    total: number;
    needsAttention: number;
    salesOpportunities: number;
    positive: number;
    negative: number;
    neutral: number;
  };
  dashboardUrl: string;
}

export interface WeeklyReportData {
  userName: string;
  dateRange: { start: Date; end: Date };
  mentions: DigestMention[];
  stats: {
    total: number;
    previousWeekTotal?: number;
    needsAttention: number;
    salesOpportunities: number;
    testimonialCandidates: number;
    featureRequests: number;
    positive: number;
    negative: number;
    neutral: number;
  };
  aiInsights?: WeeklyInsightsResult;
  dashboardUrl: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatDateRange(start: Date, end: Date): string {
  return `${formatShortDate(start)} – ${formatShortDate(end)}, ${end.getFullYear()}`;
}

const CATEGORY_DISPLAY: Record<string, { emoji: string; label: string; color: string }> = {
  competitor_mention: { emoji: "💼", label: "Sales Opportunity", color: "#10B981" },
  pricing_concern: { emoji: "💰", label: "Pricing Discussion", color: "#F59E0B" },
  feature_request: { emoji: "✨", label: "Feature Request", color: "#8B5CF6" },
  support_need: { emoji: "🆘", label: "Support Needed", color: "#EF4444" },
  negative_experience: { emoji: "⚠️", label: "Negative Experience", color: "#EF4444" },
  positive_feedback: { emoji: "⭐", label: "Positive Feedback", color: "#10B981" },
  general_discussion: { emoji: "💬", label: "General Discussion", color: "#6B7280" },
};

const SENTIMENT_DISPLAY: Record<string, { emoji: string; color: string }> = {
  positive: { emoji: "🟢", color: "#10B981" },
  negative: { emoji: "🔴", color: "#EF4444" },
  neutral: { emoji: "🟡", color: "#F59E0B" },
};

/**
 * Highlight matched keywords in text for HTML emails
 * Wraps keywords in a styled span with background highlight
 *
 * SECURITY: Text is HTML-escaped first, then keywords are highlighted.
 * Keywords are regex-escaped to prevent ReDoS attacks.
 */
function highlightKeywordsHtml(text: string, keywords?: string[]): string {
  if (!text) return "";

  // SECURITY: Escape HTML first to prevent XSS
  let result = escapeHtml(text);

  if (!keywords || keywords.length === 0) return result;

  // Sort by length descending to match longer phrases first
  const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);

  for (const keyword of sortedKeywords) {
    // SECURITY: Escape special regex characters to prevent ReDoS
    const escapedKeyword = escapeRegExp(keyword);
    // Also need to escape the keyword for matching against HTML-escaped text
    const htmlEscapedKeyword = escapeHtml(keyword);
    const escapedHtmlKeyword = escapeRegExp(htmlEscapedKeyword);

    // Case-insensitive match, preserve original casing
    const regex = new RegExp(`(${escapedHtmlKeyword})`, "gi");
    result = result.replace(
      regex,
      '<span style="background-color: #fef08a; color: #854d0e; padding: 1px 4px; border-radius: 3px; font-weight: 500;">$1</span>'
    );
  }

  return result;
}

/**
 * Highlight matched keywords in plain text
 * Wraps keywords in **asterisks** for emphasis
 *
 * SECURITY: Keywords are regex-escaped to prevent ReDoS attacks.
 */
function highlightKeywordsText(text: string, keywords?: string[]): string {
  if (!text) return "";
  if (!keywords || keywords.length === 0) return text;

  let result = text;
  // Sort by length descending to match longer phrases first
  const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);

  for (const keyword of sortedKeywords) {
    // SECURITY: Escape special regex characters to prevent ReDoS
    const escapedKeyword = escapeRegExp(keyword);
    // Case-insensitive match, preserve original casing
    const regex = new RegExp(`(${escapedKeyword})`, "gi");
    result = result.replace(regex, "**$1**");
  }

  return result;
}

// ============================================================================
// DAILY DIGEST (PRO TIER) - TEXT VERSION
// ============================================================================

export function generateDailyDigestText(data: DailyDigestData): string {
  const { userName, date, mentions, stats, dashboardUrl } = data;

  const topMentions = mentions.slice(0, 5);
  const hasMore = mentions.length > 5;

  let digest = `
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║              ☀️  YOUR DAILY MONITORING DIGEST                    ║
║                  ${formatDate(date).padEnd(40)}║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝

Good morning, ${userName}! Here's what happened with your monitors
in the last 24 hours.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📊 TODAY AT A GLANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ${stats.total} new mentions across your monitors

  ⚡ ${stats.needsAttention} need your attention
  💼 ${stats.salesOpportunities} sales opportunities
  🟢 ${stats.positive} positive  •  🔴 ${stats.negative} negative  •  🟡 ${stats.neutral} neutral

`;

  // Top mentions
  topMentions.forEach((mention, index) => {
    const categoryInfo = CATEGORY_DISPLAY[mention.category || "general_discussion"];
    const sentimentInfo = SENTIMENT_DISPLAY[mention.sentiment || "neutral"];
    const urgencyLabel = mention.urgency === "high" ? "⚡ High Priority" :
                         mention.urgency === "medium" ? "📌 Medium" : "";

    const highlightedTitle = highlightKeywordsText(mention.title, mention.matchedKeywords);
    const highlightedSummary = highlightKeywordsText(mention.summary || "No summary available.", mention.matchedKeywords);

    digest += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  #${index + 1} │ ${highlightedTitle.substring(0, 50).toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      ${urgencyLabel ? urgencyLabel + " • " : ""}${categoryInfo.emoji} ${categoryInfo.label}

      ${highlightedSummary}

      ${sentimentInfo.emoji} ${mention.sentiment?.toUpperCase() || "Unknown"} • ${mention.platform}${mention.subreddit ? ` • ${mention.subreddit}` : ""}
      → View mention: ${mention.url}
`;
  });

  if (hasMore) {
    digest += `
─────────────────────────────────────────────────────────────────────
              + ${mentions.length - 5} more mentions in your dashboard
                    → ${dashboardUrl}
─────────────────────────────────────────────────────────────────────
`;
  }

  digest += `

That's your daily briefing! Questions? Reply to this email.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                     Powered by Kaulby Pro
                      ${dashboardUrl}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  return digest.trim();
}

// ============================================================================
// WEEKLY INTELLIGENCE REPORT (TEAM TIER) - TEXT VERSION
// ============================================================================

export function generateWeeklyReportText(data: WeeklyReportData): string {
  const { userName, dateRange, mentions, stats, aiInsights, dashboardUrl } = data;

  const weekChange = stats.previousWeekTotal
    ? Math.round(((stats.total - stats.previousWeekTotal) / stats.previousWeekTotal) * 100)
    : null;

  const topMentions = mentions
    .filter(m => m.urgency === "high" || m.category === "competitor_mention" || m.category === "positive_feedback")
    .slice(0, 5);

  let report = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║                    📊 WEEKLY INTELLIGENCE REPORT                             ║
║                       ${formatDateRange(dateRange.start, dateRange.end).padEnd(48)}║
║                       Prepared for ${userName.padEnd(42)}║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  EXECUTIVE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${aiInsights?.headline || `This week you received ${stats.total} mentions across your monitors.`}

${aiInsights?.executiveSummary || `${stats.salesOpportunities} sales opportunities were identified, and ${stats.needsAttention} mentions require your attention.`}


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  THIS WEEK BY THE NUMBERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ${stats.total} Total Mentions${weekChange !== null ? ` (${weekChange >= 0 ? "↑" : "↓"} ${Math.abs(weekChange)}% vs last week)` : ""}

  Sentiment Breakdown:
  🟢 Positive    ${generateTextBar(stats.positive, stats.total)}  ${stats.positive} (${Math.round((stats.positive / stats.total) * 100)}%)
  🔴 Negative    ${generateTextBar(stats.negative, stats.total)}  ${stats.negative} (${Math.round((stats.negative / stats.total) * 100)}%)
  🟡 Neutral     ${generateTextBar(stats.neutral, stats.total)}  ${stats.neutral} (${Math.round((stats.neutral / stats.total) * 100)}%)

  ─────────────────────────────────────────────────────────────────────────────

  💼 ${stats.salesOpportunities} Sales Opportunities
  ⭐ ${stats.testimonialCandidates} Testimonial Candidates
  ✨ ${stats.featureRequests} Feature Requests
  ⚡ ${stats.needsAttention} Require Attention

`;

  // Key Trends (if AI insights available)
  if (aiInsights?.keyTrends && aiInsights.keyTrends.length > 0) {
    report += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  KEY TRENDS THIS WEEK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
    aiInsights.keyTrends.forEach((trend, i) => {
      report += `
  ${i + 1}. ${trend.trend.toUpperCase()}

     ${trend.evidence}
${trend.implication ? `\n     💡 Implication: ${trend.implication}` : ""}
`;
    });
  }

  // Top Mentions
  if (topMentions.length > 0) {
    report += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TOP MENTIONS REQUIRING ACTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
    topMentions.forEach((mention, index) => {
      const categoryInfo = CATEGORY_DISPLAY[mention.category || "general_discussion"];
      const urgencyLabel = mention.urgency === "high" ? "⚡ HIGH PRIORITY" :
                           mention.category === "positive_feedback" ? "⭐ TESTIMONIAL OPPORTUNITY" :
                           mention.category === "competitor_mention" ? "💼 SALES LEAD" : "";

      const highlightedTitle = highlightKeywordsText(mention.title, mention.matchedKeywords);
      const highlightedSummary = highlightKeywordsText(mention.summary || "View full analysis for details.", mention.matchedKeywords);

      report += `
#${index + 1} │ ${urgencyLabel}
───┴──────────────────────────────────────────────────────────────────────────
    "${highlightedTitle.substring(0, 60)}"

    ${highlightedSummary}
${mention.intentScore ? `\n    Intent Score: ${mention.intentScore}/100` : ""}

    📍 ${mention.platform}${mention.subreddit ? ` • ${mention.subreddit}` : ""} • ${categoryInfo.label}
    → View full brief: ${mention.url}

`;
    });
  }

  // Recommendations (if AI insights available)
  if (aiInsights?.recommendations && aiInsights.recommendations.length > 0) {
    report += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  THIS WEEK'S RECOMMENDATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${aiInsights.recommendations.map((rec, i) => `  ${i + 1}. ${rec}`).join("\n\n")}
`;
  }

  // Action Items
  report += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ACTION ITEMS FOR THIS WEEK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${stats.salesOpportunities > 0 ? `  □ Respond to ${stats.salesOpportunities} high-intent sales leads (Sales)\n` : ""}${stats.testimonialCandidates > 0 ? `  □ Reach out to ${stats.testimonialCandidates} testimonial candidates (Marketing)\n` : ""}${stats.featureRequests > 0 ? `  □ Review ${stats.featureRequests} feature requests for roadmap (Product)\n` : ""}${stats.needsAttention > 0 ? `  □ Address ${stats.needsAttention} mentions requiring attention\n` : ""}
`;

  // Content Opportunities (if AI insights available)
  if (aiInsights?.opportunities && aiInsights.opportunities.length > 0) {
    report += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CONTENT OPPORTUNITIES IDENTIFIED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
    aiInsights.opportunities.forEach((opp) => {
      if (typeof opp === "string") {
        report += `  • ${opp}\n`;
      } else {
        report += `  ${opp.type === "content" ? "📝" : opp.type === "engagement" ? "💬" : opp.type === "sales" ? "💼" : "💡"} ${opp.description}\n`;
        if (opp.suggestedAction) {
          report += `     → ${opp.suggestedAction}\n`;
        }
      }
    });
  }

  report += `

─────────────────────────────────────────────────────────────────────────────────

That's your weekly intelligence report!

Your team processed ${stats.total} mentions this week.
${stats.salesOpportunities > 0 ? `Top opportunity: ${stats.salesOpportunities} high-intent sales leads ready for outreach.` : ""}

→ View all mentions in dashboard: ${dashboardUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                        KAULBY TEAM INTELLIGENCE
                           ${dashboardUrl}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  return report.trim();
}

function generateTextBar(value: number, total: number, width: number = 15): string {
  const percentage = total > 0 ? value / total : 0;
  const filled = Math.round(percentage * width);
  const empty = width - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

// ============================================================================
// DAILY DIGEST (PRO TIER) - HTML VERSION
// ============================================================================

export function generateDailyDigestHtml(data: DailyDigestData): string {
  const { userName, date, mentions, stats, dashboardUrl } = data;
  const topMentions = mentions.slice(0, 5);
  const hasMore = mentions.length > 5;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Daily Monitoring Digest</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; color: #18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">

          <!-- Header with Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 100%); padding: 24px 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="60" style="vertical-align: middle;">
                    <img src="https://kaulbyapp.com/logo-email.jpg" alt="Kaulby" width="48" height="48" style="display: block; border-radius: 10px;" />
                  </td>
                  <td style="vertical-align: middle; padding-left: 16px;">
                    <h1 style="margin: 0 0 4px 0; font-size: 22px; font-weight: 700; color: #ffffff;">Your Daily Digest</h1>
                    <p style="margin: 0; font-size: 13px; color: rgba(255, 255, 255, 0.6);">${formatDate(date)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 32px 40px 16px 40px;">
              <p style="margin: 0; font-size: 16px; color: #52525b;">Good morning, <strong>${userName}</strong>! Here's what happened with your monitors in the last 24 hours.</p>
            </td>
          </tr>

          <!-- Stats -->
          <tr>
            <td style="padding: 0 40px 32px 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; border-radius: 8px; padding: 20px;">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <p style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Today at a Glance</p>
                    <p style="margin: 0 0 16px 0; font-size: 32px; font-weight: 700; color: #18181b;">${stats.total} <span style="font-size: 16px; font-weight: 400; color: #6b7280;">new mentions</span></p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="text-align: center; padding: 8px;">
                          <span style="display: inline-block; padding: 6px 12px; background-color: #fee2e2; border-radius: 20px; font-size: 13px; color: #dc2626; font-weight: 500;">${stats.needsAttention} need attention</span>
                        </td>
                        <td style="text-align: center; padding: 8px;">
                          <span style="display: inline-block; padding: 6px 12px; background-color: #d1fae5; border-radius: 20px; font-size: 13px; color: #059669; font-weight: 500;">${stats.salesOpportunities} opportunities</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Mentions -->
          ${topMentions.map((mention, index) => {
            const categoryInfo = CATEGORY_DISPLAY[mention.category || "general_discussion"];
            const sentimentInfo = SENTIMENT_DISPLAY[mention.sentiment || "neutral"];
            const isHighPriority = mention.urgency === "high";
            const highlightedTitle = highlightKeywordsHtml(mention.title, mention.matchedKeywords);
            const highlightedSummary = highlightKeywordsHtml(mention.summary || "Click to view full analysis.", mention.matchedKeywords);

            return `
          <tr>
            <td style="padding: 0 40px 24px 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid ${isHighPriority ? "#fecaca" : "#e5e7eb"}; border-radius: 8px; overflow: hidden; ${isHighPriority ? "border-left: 4px solid #ef4444;" : ""}">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td>
                          <span style="font-size: 12px; font-weight: 600; color: #6b7280;">#${index + 1}</span>
                          ${isHighPriority ? '<span style="display: inline-block; margin-left: 8px; padding: 2px 8px; background-color: #fef2f2; border-radius: 4px; font-size: 11px; font-weight: 600; color: #dc2626;">HIGH PRIORITY</span>' : ""}
                        </td>
                        <td style="text-align: right;">
                          <span style="display: inline-block; padding: 4px 10px; background-color: ${categoryInfo.color}15; border-radius: 4px; font-size: 12px; color: ${categoryInfo.color}; font-weight: 500;">${categoryInfo.emoji} ${categoryInfo.label}</span>
                        </td>
                      </tr>
                    </table>
                    <h3 style="margin: 12px 0 8px 0; font-size: 16px; font-weight: 600; color: #18181b; line-height: 1.4;">${highlightedTitle.substring(0, 80)}${mention.title.length > 80 ? "..." : ""}</h3>
                    <p style="margin: 0 0 16px 0; font-size: 14px; color: #52525b; line-height: 1.5;">${highlightedSummary}</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td>
                          <span style="font-size: 12px; color: #6b7280;">${sentimentInfo.emoji} ${mention.sentiment?.charAt(0).toUpperCase()}${mention.sentiment?.slice(1) || "Unknown"} &bull; ${mention.platform}${mention.subreddit ? ` &bull; ${mention.subreddit}` : ""}</span>
                        </td>
                        <td style="text-align: right;">
                          <a href="${dashboardUrl}/results?id=${mention.id}" style="font-size: 13px; color: #6366f1; text-decoration: none; font-weight: 500;">View mention &rarr;</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
          }).join("")}

          ${hasMore ? `
          <!-- More Link -->
          <tr>
            <td style="padding: 0 40px 32px 40px; text-align: center;">
              <a href="${dashboardUrl}/results" style="display: inline-block; padding: 12px 24px; background-color: #f4f4f5; border-radius: 8px; font-size: 14px; color: #6366f1; text-decoration: none; font-weight: 500;">+ ${mentions.length - 5} more mentions in your dashboard &rarr;</a>
            </td>
          </tr>` : ""}

          <!-- Footer -->
          <tr>
            <td style="padding: 32px 40px; background-color: #f9fafb; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">That's your daily briefing! Questions? Reply to this email.</p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">Powered by <a href="${dashboardUrl}" style="color: #6366f1; text-decoration: none;">Kaulby Pro</a></p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

// ============================================================================
// WEEKLY INTELLIGENCE REPORT (TEAM TIER) - HTML VERSION
// ============================================================================

export function generateWeeklyReportHtml(data: WeeklyReportData): string {
  const { userName, dateRange, mentions, stats, aiInsights, dashboardUrl } = data;

  const weekChange = stats.previousWeekTotal
    ? Math.round(((stats.total - stats.previousWeekTotal) / stats.previousWeekTotal) * 100)
    : null;

  const topMentions = mentions
    .filter(m => m.urgency === "high" || m.category === "competitor_mention" || m.category === "positive_feedback")
    .slice(0, 5);

  const positivePercent = stats.total > 0 ? Math.round((stats.positive / stats.total) * 100) : 0;
  const negativePercent = stats.total > 0 ? Math.round((stats.negative / stats.total) * 100) : 0;
  const neutralPercent = stats.total > 0 ? Math.round((stats.neutral / stats.total) * 100) : 0;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Intelligence Report</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; color: #18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">

          <!-- Header with Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 100%); padding: 24px 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="60" style="vertical-align: middle;">
                    <img src="https://kaulbyapp.com/logo-email.jpg" alt="Kaulby" width="48" height="48" style="display: block; border-radius: 10px;" />
                  </td>
                  <td style="vertical-align: middle; padding-left: 16px;">
                    <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; color: rgba(255, 255, 255, 0.5); text-transform: uppercase; letter-spacing: 1px;">Weekly Intelligence Report</p>
                    <h1 style="margin: 0 0 4px 0; font-size: 22px; font-weight: 700; color: #ffffff;">${formatDateRange(dateRange.start, dateRange.end)}</h1>
                    <p style="margin: 0; font-size: 13px; color: rgba(255, 255, 255, 0.6);">Executive Summary for ${userName}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Executive Summary -->
          <tr>
            <td style="padding: 32px 40px;">
              <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #18181b; border-bottom: 2px solid #6366f1; padding-bottom: 8px;">Executive Summary</h2>
              <p style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #18181b; line-height: 1.4;">${aiInsights?.headline || `${stats.total} mentions processed this week.`}</p>
              <p style="margin: 0; font-size: 15px; color: #52525b; line-height: 1.6;">${aiInsights?.recommendations?.[0] || `${stats.salesOpportunities} sales opportunities were identified.`}</p>
            </td>
          </tr>

          <!-- Stats Grid -->
          <tr>
            <td style="padding: 0 40px 32px 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="50%" style="padding-right: 8px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; border-radius: 8px;">
                      <tr>
                        <td style="padding: 20px; text-align: center;">
                          <p style="margin: 0 0 4px 0; font-size: 36px; font-weight: 700; color: #18181b;">${stats.total}</p>
                          <p style="margin: 0; font-size: 13px; color: #6b7280;">Total Mentions</p>
                          ${weekChange !== null ? `<p style="margin: 8px 0 0 0; font-size: 12px; color: ${weekChange >= 0 ? "#059669" : "#dc2626"};">${weekChange >= 0 ? "&uarr;" : "&darr;"} ${Math.abs(weekChange)}% vs last week</p>` : ""}
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="50%" style="padding-left: 8px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; border-radius: 8px;">
                      <tr>
                        <td style="padding: 20px; text-align: center;">
                          <p style="margin: 0 0 4px 0; font-size: 36px; font-weight: 700; color: #10b981;">${stats.salesOpportunities}</p>
                          <p style="margin: 0; font-size: 13px; color: #6b7280;">Sales Opportunities</p>
                          <p style="margin: 8px 0 0 0; font-size: 12px; color: #6b7280;">Ready for outreach</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Sentiment Bar -->
          <tr>
            <td style="padding: 0 40px 32px 40px;">
              <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Sentiment Breakdown</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="background-color: #10b981; width: ${positivePercent}%; height: 24px;"></td>
                  <td style="background-color: #ef4444; width: ${negativePercent}%; height: 24px;"></td>
                  <td style="background-color: #f59e0b; width: ${neutralPercent}%; height: 24px;"></td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 8px;">
                <tr>
                  <td style="font-size: 12px; color: #6b7280;">${stats.positive} positive (${positivePercent}%)</td>
                  <td style="font-size: 12px; color: #6b7280; text-align: center;">${stats.negative} negative (${negativePercent}%)</td>
                  <td style="font-size: 12px; color: #6b7280; text-align: right;">${stats.neutral} neutral (${neutralPercent}%)</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Key Insights -->
          ${aiInsights?.keyTrends && aiInsights.keyTrends.length > 0 ? `
          <tr>
            <td style="padding: 0 40px 32px 40px;">
              <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #18181b; border-bottom: 2px solid #6366f1; padding-bottom: 8px;">Key Trends This Week</h2>
              ${aiInsights.keyTrends.map((trend, i) => `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 16px; background-color: #f9fafb; border-radius: 8px; border-left: 4px solid #6366f1;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0 0 8px 0; font-size: 15px; font-weight: 600; color: #18181b;">${i + 1}. ${trend.trend}</p>
                    <p style="margin: 0; font-size: 14px; color: #52525b; line-height: 1.5;">${trend.evidence}</p>
                    ${trend.implication ? `<p style="margin: 12px 0 0 0; font-size: 13px; color: #6366f1;">${trend.implication}</p>` : ""}
                  </td>
                </tr>
              </table>
              `).join("")}
            </td>
          </tr>` : ""}

          <!-- Top Mentions -->
          ${topMentions.length > 0 ? `
          <tr>
            <td style="padding: 0 40px 32px 40px;">
              <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #18181b; border-bottom: 2px solid #6366f1; padding-bottom: 8px;">Top Mentions Requiring Action</h2>
              ${topMentions.map((mention, i) => {
                const categoryInfo = CATEGORY_DISPLAY[mention.category || "general_discussion"];
                const priorityLabel = mention.urgency === "high" ? "HIGH PRIORITY" :
                                     mention.category === "positive_feedback" ? "TESTIMONIAL" :
                                     mention.category === "competitor_mention" ? "SALES LEAD" : "";
                const priorityColor = mention.urgency === "high" ? "#dc2626" :
                                     mention.category === "positive_feedback" ? "#10b981" :
                                     mention.category === "competitor_mention" ? "#6366f1" : "#6b7280";
                const highlightedTitle = highlightKeywordsHtml(mention.title, mention.matchedKeywords);
                const highlightedSummary = highlightKeywordsHtml(mention.summary || "View full analysis for details.", mention.matchedKeywords);

                return `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 16px; border: 1px solid #e5e7eb; border-radius: 8px; border-left: 4px solid ${priorityColor};">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td>
                          <span style="font-size: 12px; font-weight: 700; color: ${priorityColor};">#${i + 1} | ${priorityLabel}</span>
                        </td>
                      </tr>
                    </table>
                    <h3 style="margin: 12px 0 8px 0; font-size: 15px; font-weight: 600; color: #18181b; line-height: 1.4;">"${highlightedTitle.substring(0, 70)}${mention.title.length > 70 ? "..." : ""}"</h3>
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: #52525b; line-height: 1.5;">${highlightedSummary}</p>
                    ${mention.intentScore ? `<p style="margin: 0 0 12px 0; font-size: 13px; color: #18181b;"><strong>Intent Score:</strong> ${mention.intentScore}/100</p>` : ""}
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td><span style="font-size: 12px; color: #6b7280;">${mention.platform}${mention.subreddit ? ` &bull; ${mention.subreddit}` : ""} &bull; ${categoryInfo.label}</span></td>
                        <td style="text-align: right;"><a href="${dashboardUrl}/results?id=${mention.id}" style="font-size: 13px; color: #6366f1; text-decoration: none; font-weight: 500;">View full brief &rarr;</a></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>`;
              }).join("")}
            </td>
          </tr>` : ""}

          <!-- Action Items -->
          <tr>
            <td style="padding: 0 40px 32px 40px;">
              <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #18181b; border-bottom: 2px solid #6366f1; padding-bottom: 8px;">Action Items for This Week</h2>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fefce8; border-radius: 8px; border: 1px solid #fef08a;">
                <tr>
                  <td style="padding: 20px;">
                    ${stats.salesOpportunities > 0 ? `<p style="margin: 0 0 12px 0; font-size: 14px; color: #18181b;">&#9744; <strong>Sales:</strong> Respond to ${stats.salesOpportunities} high-intent leads</p>` : ""}
                    ${stats.testimonialCandidates > 0 ? `<p style="margin: 0 0 12px 0; font-size: 14px; color: #18181b;">&#9744; <strong>Marketing:</strong> Reach out to ${stats.testimonialCandidates} testimonial candidates</p>` : ""}
                    ${stats.featureRequests > 0 ? `<p style="margin: 0 0 12px 0; font-size: 14px; color: #18181b;">&#9744; <strong>Product:</strong> Review ${stats.featureRequests} feature requests</p>` : ""}
                    ${stats.needsAttention > 0 ? `<p style="margin: 0; font-size: 14px; color: #18181b;">&#9744; <strong>Support:</strong> Address ${stats.needsAttention} mentions requiring attention</p>` : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 0 40px 32px 40px; text-align: center;">
              <a href="${dashboardUrl}/results" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 8px; font-size: 15px; color: #ffffff; text-decoration: none; font-weight: 600;">View All Mentions in Dashboard &rarr;</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 32px 40px; background-color: #1e1b4b; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: rgba(255, 255, 255, 0.8);">Your team processed <strong>${stats.total}</strong> mentions this week.</p>
              <p style="margin: 0; font-size: 12px; color: rgba(255, 255, 255, 0.6);">Powered by <a href="${dashboardUrl}" style="color: #a5b4fc; text-decoration: none;">Kaulby Team Intelligence</a></p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}
