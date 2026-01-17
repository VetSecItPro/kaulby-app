/**
 * Report Formatter - Transforms raw AI analysis into elegant, executive-ready reports
 *
 * These reports are designed to be:
 * - Scannable at a glance
 * - Actionable with clear next steps
 * - Professional enough to print and share with executives
 *
 * Two tiers:
 * - Pro ($29/mo): What Happened → Why It Matters → Recommended Action
 * - Team ($99/mo): Full Intelligence Brief with response drafts, competitive intel, etc.
 */

import type { ComprehensiveAnalysisResult } from "./analyzers/comprehensive";
import type { SentimentResult } from "./analyzers/sentiment";
import type { PainPointResult } from "./analyzers/pain-points";
import type { SummaryResult } from "./analyzers/summarize";

// ============================================================================
// SHARED TYPES & UTILITIES
// ============================================================================

export interface MentionMetadata {
  platform: string;
  title: string;
  url: string;
  keywords: string[];
  monitorName: string;
  analyzedAt: Date;
  subreddit?: string;
  authorName?: string;
  postScore?: number;
}

const CATEGORY_LABELS: Record<string, { emoji: string; label: string; description: string }> = {
  competitor_mention: { emoji: "💼", label: "Sales Opportunity", description: "User comparing or considering alternatives" },
  pricing_concern: { emoji: "💰", label: "Pricing Discussion", description: "User discussing cost or value" },
  feature_request: { emoji: "✨", label: "Feature Request", description: "User requesting new functionality" },
  support_need: { emoji: "🆘", label: "Support Needed", description: "User needs help or has questions" },
  negative_experience: { emoji: "⚠️", label: "Negative Experience", description: "User expressing frustration" },
  positive_feedback: { emoji: "⭐", label: "Positive Feedback", description: "User praising or recommending" },
  general_discussion: { emoji: "💬", label: "General Discussion", description: "Neutral mention or commentary" },
};

const SENTIMENT_DISPLAY = {
  positive: { emoji: "🟢", label: "Positive" },
  negative: { emoji: "🔴", label: "Negative" },
  neutral: { emoji: "🟡", label: "Neutral" },
};

const URGENCY_DISPLAY = {
  high: { emoji: "⚡", label: "HIGH PRIORITY" },
  medium: { emoji: "📌", label: "MEDIUM PRIORITY" },
  low: { emoji: "📋", label: "LOW PRIORITY" },
};

const ACTION_LABELS: Record<string, string> = {
  respond: "Respond to this mention",
  monitor: "Continue monitoring",
  escalate: "Escalate to team lead",
  log: "Log for reference",
  respond_now: "RESPOND IMMEDIATELY",
  respond_soon: "Respond when possible",
  assign_to_team: "Assign to team member",
};

function generateProgressBar(value: number, max: number = 100, width: number = 10): string {
  const percentage = Math.min(value / max, 1);
  const filled = Math.round(percentage * width);
  const empty = width - filled;
  return `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
}

function wrapText(text: string, maxWidth: number): string {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + " " + word).trim().length <= maxWidth) {
      currentLine = (currentLine + " " + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines.join("\n");
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ============================================================================
// PRO TIER REPORT - "Worth Every Penny at $29/mo"
// ============================================================================

export interface ProAnalysisData {
  sentiment: SentimentResult;
  painPoint: PainPointResult;
  summary: SummaryResult;
  metadata: MentionMetadata;
}

export function formatProReport(data: ProAnalysisData): string {
  const { sentiment, painPoint, summary, metadata } = data;

  const sentimentInfo = SENTIMENT_DISPLAY[sentiment.sentiment];
  const urgencyInfo = URGENCY_DISPLAY[summary.urgency || "low"];
  const categoryInfo = CATEGORY_LABELS[painPoint.category || "general_discussion"];
  const actionText = ACTION_LABELS[painPoint.businessAction || "monitor"];

  // Build the "Why It Matters" section based on category
  let whyItMatters = "";
  switch (painPoint.category) {
    case "competitor_mention":
      whyItMatters = `This is a qualified sales opportunity. The user is actively evaluating
alternatives, which means they're in buying mode. Their stated needs may
align with your product offering.`;
      break;
    case "pricing_concern":
      whyItMatters = `Pricing discussions can indicate either a sales opportunity (if about
competitors) or a retention risk (if about your product). Monitor closely
and consider whether a response could address their concerns.`;
      break;
    case "feature_request":
      whyItMatters = `Feature requests are valuable product feedback. This user cares enough
to share what they need. Consider logging this for your product roadmap
and responding to show you're listening.`;
      break;
    case "support_need":
      whyItMatters = `A user needs help. Quick, helpful responses to support questions build
trust and can turn frustrated users into advocates. This is an engagement
opportunity.`;
      break;
    case "negative_experience":
      whyItMatters = `Negative experiences shared publicly can influence others. A thoughtful,
empathetic response can turn this around and show potential customers
how you handle issues.`;
      break;
    case "positive_feedback":
      whyItMatters = `Positive mentions are opportunities for testimonials, case studies, and
social proof. Consider thanking this user and asking if you can feature
their feedback.`;
      break;
    default:
      whyItMatters = `This mention provides visibility into how your brand is being discussed.
While no immediate action may be required, it's valuable market intelligence.`;
  }

  // Build recommended action guidance
  let actionGuidance = "";
  if (summary.actionable && painPoint.businessAction === "respond") {
    actionGuidance = `Consider a helpful, non-salesy response that adds value to the
conversation. Be genuine and focus on being useful rather than promotional.`;
  } else if (painPoint.businessAction === "escalate") {
    actionGuidance = `This mention may require attention from a team lead or manager.
Review the full context before taking action.`;
  } else {
    actionGuidance = `No immediate response needed. Continue monitoring for follow-up
discussions or changes in sentiment.`;
  }

  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                           MENTION ANALYSIS
                         ${metadata.monitorName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${urgencyInfo.emoji} ${urgencyInfo.label}                      ${sentimentInfo.emoji} ${sentimentInfo.label.toUpperCase()}


┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  WHAT HAPPENED                                                            ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

${wrapText(summary.summary, 72)}

  ${categoryInfo.emoji} ${categoryInfo.label}
  ${categoryInfo.description}

  Keywords: ${painPoint.keywords.slice(0, 5).join(", ")}


┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  WHY IT MATTERS                                                           ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

${wrapText(whyItMatters, 72)}


┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  RECOMMENDED ACTION                                                       ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

  → ${actionText}

${wrapText(actionGuidance, 72)}


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ${metadata.platform}${metadata.subreddit ? ` • ${metadata.subreddit}` : ""} • ${formatDate(metadata.analyzedAt)}

  → View original: ${metadata.url}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                            Kaulby Pro
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim();
}

// ============================================================================
// TEAM TIER REPORT - "The Full Intelligence Brief"
// ============================================================================

export function formatTeamReport(
  analysis: ComprehensiveAnalysisResult,
  metadata: MentionMetadata
): string {
  const {
    sentiment,
    classification,
    opportunity,
    competitive,
    actions,
    suggestedResponse,
    contentOpportunity,
    platformContext,
    executiveSummary,
  } = analysis;

  const priorityLabels: Record<string, string> = {
    critical: "🚨 CRITICAL",
    high: "⚡ HIGH PRIORITY",
    medium: "📌 MEDIUM",
    low: "📋 LOW",
  };

  const departmentEmojis: Record<string, string> = {
    sales: "💼",
    support: "🎧",
    product: "🔧",
    marketing: "📢",
    leadership: "👔",
  };

  const opportunityLabels: Record<string, string> = {
    sales_lead: "🎯 Active Sales Lead",
    testimonial: "⭐ Testimonial Opportunity",
    content_idea: "📝 Content Opportunity",
    product_feedback: "💡 Product Insight",
    crisis: "🚨 Crisis Alert",
    engagement: "💬 Engagement Opportunity",
    none: "📋 For Reference",
  };

  const timelineLabels: Record<string, string> = {
    immediate: "Ready to buy/act now",
    short_term: "Likely within 1-3 months",
    exploring: "Early research phase",
    none: "No purchase intent detected",
  };

  const deadlineLabels: Record<string, string> = {
    immediate: "Act now",
    within_24h: "Within 24 hours",
    within_week: "This week",
    no_rush: "When convenient",
  };

  const categoryInfo = CATEGORY_LABELS[classification.category] || CATEGORY_LABELS.general_discussion;
  const sentimentBar = generateProgressBar(Math.abs(sentiment.score) * 100, 100, 10);

  let report = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║                          INTELLIGENCE BRIEF                                  ║
║                                                                              ║
║  ${metadata.monitorName.substring(0, 40).padEnd(40)}    ${formatDate(metadata.analyzedAt).padStart(20)}  ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

${priorityLabels[actions.primary.priority]}                          ${departmentEmojis[classification.department]} Assign to: ${classification.department.toUpperCase()}


┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  EXECUTIVE SUMMARY                                                           ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

${wrapText(executiveSummary, 76)}


┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  CLASSIFICATION & SENTIMENT                                                  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

  ${categoryInfo.emoji} ${categoryInfo.label}
  ${categoryInfo.description}

  Subcategory:  ${classification.subcategory}
  Impact:       ${classification.businessImpact.toUpperCase()}

  ─────────────────────────────────────────────────────────────────────────────

  Sentiment:    ${SENTIMENT_DISPLAY[sentiment.label].emoji} ${sentiment.label.toUpperCase()} (${sentiment.score > 0 ? "+" : ""}${sentiment.score.toFixed(1)})
                ${sentimentBar}

  Intensity:    ${sentiment.intensity.charAt(0).toUpperCase() + sentiment.intensity.slice(1)}
  Emotions:     ${sentiment.emotions.join(", ")}


┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  OPPORTUNITY ANALYSIS                                                        ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

  ${opportunityLabels[opportunity.type]}

  ┌────────────────────────────────────────────────────────────────────────────┐
  │                                                                            │
  │  Intent Score     ${generateProgressBar(opportunity.intentScore, 100, 12)}  ${opportunity.intentScore}/100
  │  Product Fit      ${generateProgressBar(opportunity.fitScore, 100, 12)}  ${opportunity.fitScore}/100
  │                                                                            │
  │  Timeline:        ${timelineLabels[opportunity.timeline]}
  │                                                                            │
  └────────────────────────────────────────────────────────────────────────────┘

  Analysis:
  ${wrapText(opportunity.reasoning, 74)}
`;

  // Competitive Intelligence Section (only if competitor mentioned)
  if (competitive.competitorMentioned) {
    report += `

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  COMPETITIVE INTELLIGENCE                                                    ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

  Competitor:          ${competitive.competitorMentioned}
  Switching Risk:      ${(competitive.switchingLikelihood || "unknown").toUpperCase()}

  Their Weakness (from user's perspective):
  ┌────────────────────────────────────────────────────────────────────────────┐
  │  "${competitive.theirWeakness || "Not specified"}"
  └────────────────────────────────────────────────────────────────────────────┘

  Our Advantage:
  ${wrapText(competitive.ourAdvantage || "Position on value and features.", 74)}
`;
  }

  // Recommended Response Section
  if (suggestedResponse.shouldRespond) {
    report += `

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  RECOMMENDED RESPONSE                                                        ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

  ✓ RESPOND — Tone: ${suggestedResponse.tone}

  Key Points to Address:
${suggestedResponse.keyPoints.map((p, i) => `    ${i + 1}. ${p}`).join("\n")}

  ╭────────────────────────────────────────────────────────────────────────────╮
  │  SUGGESTED DRAFT (ready to customize)                                      │
  ├────────────────────────────────────────────────────────────────────────────┤
  │                                                                            │
${wrapText(suggestedResponse.draft, 70).split("\n").map(line => `  │  ${line.padEnd(72)}│`).join("\n")}
  │                                                                            │
  ╰────────────────────────────────────────────────────────────────────────────╯

  ⚠️  Avoid:
${suggestedResponse.doNot.map(d => `      • ${d}`).join("\n")}
`;
  } else {
    report += `

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  RESPONSE RECOMMENDATION                                                     ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

  ○ NO RESPONSE NEEDED — Monitor only

  This mention doesn't require a direct response at this time.
  Continue monitoring for any follow-up discussions.
`;
  }

  // Action Items Section
  report += `

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  ACTION ITEMS                                                                ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

  PRIMARY ACTION
  ─────────────────────────────────────────────────────────────────────────────
  → ${ACTION_LABELS[actions.primary.action] || actions.primary.action}

  Owner:    ${actions.primary.owner.toUpperCase()}
  Deadline: ${deadlineLabels[actions.primary.deadline]}
`;

  if (actions.secondary && actions.secondary.length > 0) {
    report += `
  FOLLOW-UP ACTIONS
  ─────────────────────────────────────────────────────────────────────────────
${actions.secondary.map(a => `  □ ${a.action}\n    └─ ${a.reason}`).join("\n\n")}
`;
  }

  // Content Opportunities Section
  const hasContentOpps = contentOpportunity.blogIdea || contentOpportunity.faqToAdd ||
                         contentOpportunity.caseStudy || contentOpportunity.socialProof;

  if (hasContentOpps) {
    report += `

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  CONTENT OPPORTUNITIES                                                       ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
`;
    if (contentOpportunity.blogIdea) {
      report += `
  📝 Blog Post Idea
     "${contentOpportunity.blogIdea}"
`;
    }
    if (contentOpportunity.faqToAdd) {
      report += `
  ❓ FAQ to Add
     "${contentOpportunity.faqToAdd}"
`;
    }
    if (contentOpportunity.caseStudy) {
      report += `
  📊 Case Study Opportunity
     ${contentOpportunity.caseStudy}
`;
    }
    if (contentOpportunity.socialProof) {
      report += `
  ⭐ Social Proof
     ${contentOpportunity.socialProof}
`;
    }
  }

  // Footer
  report += `

══════════════════════════════════════════════════════════════════════════════
  Source: ${metadata.platform}${metadata.subreddit ? ` • ${metadata.subreddit}` : ""}
  Keywords: ${metadata.keywords.join(", ")}

  Community Relevance: ${platformContext.communityRelevance.toUpperCase()}
  Engagement Potential: ${platformContext.engagementPotential.toUpperCase()}
  Viral Risk: ${platformContext.viralRisk.toUpperCase()}

  → View original: ${metadata.url}
══════════════════════════════════════════════════════════════════════════════
                            KAULBY TEAM INTELLIGENCE
══════════════════════════════════════════════════════════════════════════════
`;

  return report.trim();
}

// ============================================================================
// EXPORT HELPER TYPES
// ============================================================================

export type { MentionMetadata as TeamAnalysisMetadata };
