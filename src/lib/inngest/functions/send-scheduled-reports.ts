/**
 * Send Scheduled PDF Reports
 *
 * Cron job that runs daily at 6 AM UTC to send weekly/monthly PDF reports
 * to Team tier users who have enabled scheduled reports.
 */

import { inngest } from "../client";
import { pooledDb, users, monitors, results } from "@/lib/db";
import { eq, and, gte, inArray, sql, desc } from "drizzle-orm";
import { Resend } from "resend";

// Lazy init to avoid build-time errors when RESEND_API_KEY is not set
let resend: Resend | null = null;
function getResend(): Resend {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

interface ReportBranding {
  companyName?: string;
  logoUrl?: string;
  primaryColor?: string;
  footerText?: string;
  hideKaulbyBranding?: boolean;
}

/**
 * Parse a hex color string (e.g. "#14b8a6") into an RGB tuple.
 * Returns null if the format is invalid.
 */
function hexToRgb(hex: string): readonly [number, number, number] | null {
  const match = hex.replace(/^#/, "").match(/^([0-9a-fA-F]{6})$/);
  if (!match) return null;
  const val = parseInt(match[1], 16);
  return [val >> 16, (val >> 8) & 0xff, val & 0xff] as const;
}

interface ReportData {
  totals: {
    mentions: number;
    positive: number;
    neutral: number;
    negative: number;
  };
  platforms: Array<{
    platform: string;
    mentions: number;
  }>;
  categories: Array<{
    category: string;
    count: number;
  }>;
  topPosts: Array<{
    title: string;
    platform: string;
    sentiment: string;
    url: string;
  }>;
}

export const sendScheduledReports = inngest.createFunction(
  {
    id: "send-scheduled-reports",
    name: "Send Scheduled PDF Reports",
    timeouts: { finish: "30m" },
  },
  { cron: "0 6 * * *" }, // Daily at 6 AM UTC
  async ({ step, logger }) => {
    const now = new Date();
    const dayOfWeek = now.getDay() || 7; // 1-7 (Mon-Sun)
    const dayOfMonth = now.getDate();

    // Find users who should receive reports today
    const eligibleUsers = await step.run("fetch-eligible-users", async () => {
      return pooledDb.query.users.findMany({
        where: and(
          eq(users.subscriptionStatus, "team"),
          sql`${users.reportSchedule} != 'off'`
        ),
        columns: {
          id: true,
          email: true,
          name: true,
          timezone: true,
          reportSchedule: true,
          reportDay: true,
          reportLastSentAt: true,
          reportBranding: true,
        },
      });
    });

    logger.info(`Found ${eligibleUsers.length} users with scheduled reports`);

    // Pre-filter users who should receive reports today
    const usersToSend = eligibleUsers.filter(user => {
      const isWeekly = user.reportSchedule === "weekly" && dayOfWeek === (user.reportDay || 1);
      const isMonthly = user.reportSchedule === "monthly" && dayOfMonth === (user.reportDay || 1);

      if (!isWeekly && !isMonthly) return false;

      // Prevent duplicate sends (check if already sent today)
      if (user.reportLastSentAt) {
        const lastSentDate = new Date(user.reportLastSentAt);
        if (
          lastSentDate.getFullYear() === now.getFullYear() &&
          lastSentDate.getMonth() === now.getMonth() &&
          lastSentDate.getDate() === now.getDate()
        ) {
          logger.info(`Skipping ${user.email} - already sent today`);
          return false;
        }
      }

      return true;
    });

    const skippedCount = eligibleUsers.length - usersToSend.length;
    let sentCount = 0;

    // Send reports in parallel batches of 5 to respect email rate limits
    const BATCH_SIZE = 5;
    for (let i = 0; i < usersToSend.length; i += BATCH_SIZE) {
      const batch = usersToSend.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(user => step.run(`send-report-${user.id}`, async () => {
        try {
          const days = user.reportSchedule === "weekly" ? 7 : 30;
          const reportData = await generateReportData(user.id, days);

          if (reportData.totals.mentions === 0) {
            logger.info(`Skipping ${user.email} - no mentions in period`);
            return;
          }

          const html = generateReportEmail(
            user.name || "there",
            reportData,
            days,
            user.reportSchedule || "weekly"
          );

          const pdfBuffer = await generateReportPdf(
            user.name || "there",
            reportData,
            days,
            user.reportSchedule || "weekly",
            (user.reportBranding as ReportBranding | null) ?? undefined
          );

          const periodLabel = user.reportSchedule === "weekly" ? "weekly" : "monthly";
          const dateStr = now.toISOString().slice(0, 10);

          await getResend().emails.send({
            from: "Kaulby Reports <reports@kaulbyapp.com>",
            to: user.email,
            subject: `Your ${user.reportSchedule === "weekly" ? "Weekly" : "Monthly"} Community Monitoring Report`,
            html,
            attachments: [
              {
                filename: `kaulby-${periodLabel}-report-${dateStr}.pdf`,
                content: pdfBuffer,
              },
            ],
          });

          // Update last sent timestamp
          await pooledDb
            .update(users)
            .set({ reportLastSentAt: now })
            .where(eq(users.id, user.id));

          sentCount++;
          logger.info(`Sent ${user.reportSchedule} report to ${user.email}`);
        } catch (error) {
          logger.error(`Failed to send report to ${user.email}:`, error);
        }
      })));
    }

    return {
      success: true,
      sentCount,
      skippedCount,
      totalEligible: eligibleUsers.length,
    };
  }
);

async function generateReportData(userId: string, days: number): Promise<ReportData> {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Get user's monitors
  const userMonitors = await pooledDb.query.monitors.findMany({
    where: eq(monitors.userId, userId),
    columns: { id: true },
  });

  if (userMonitors.length === 0) {
    return {
      totals: { mentions: 0, positive: 0, neutral: 0, negative: 0 },
      platforms: [],
      categories: [],
      topPosts: [],
    };
  }

  const monitorIds = userMonitors.map((m) => m.id);

  // Fetch data in parallel
  const [mentionData, platformData, categoryData, topPostsData] = await Promise.all([
    // Totals
    pooledDb
      .select({
        total: sql<number>`count(*)`,
        positive: sql<number>`count(*) filter (where ${results.sentiment} = 'positive')`,
        neutral: sql<number>`count(*) filter (where ${results.sentiment} = 'neutral')`,
        negative: sql<number>`count(*) filter (where ${results.sentiment} = 'negative')`,
      })
      .from(results)
      .where(and(inArray(results.monitorId, monitorIds), gte(results.createdAt, startDate))),

    // Platform breakdown
    pooledDb
      .select({
        platform: results.platform,
        mentions: sql<number>`count(*)`,
      })
      .from(results)
      .where(and(inArray(results.monitorId, monitorIds), gte(results.createdAt, startDate)))
      .groupBy(results.platform)
      .orderBy(sql`count(*) desc`)
      .limit(10),

    // Category breakdown
    pooledDb
      .select({
        category: results.conversationCategory,
        count: sql<number>`count(*)`,
      })
      .from(results)
      .where(
        and(
          inArray(results.monitorId, monitorIds),
          gte(results.createdAt, startDate),
          sql`${results.conversationCategory} is not null`
        )
      )
      .groupBy(results.conversationCategory)
      .orderBy(sql`count(*) desc`)
      .limit(6),

    // Top posts
    pooledDb.query.results.findMany({
      where: and(inArray(results.monitorId, monitorIds), gte(results.createdAt, startDate)),
      orderBy: [desc(results.engagementScore)],
      limit: 5,
      columns: {
        title: true,
        platform: true,
        sentiment: true,
        sourceUrl: true,
      },
    }),
  ]);

  return {
    totals: {
      mentions: Number(mentionData[0]?.total || 0),
      positive: Number(mentionData[0]?.positive || 0),
      neutral: Number(mentionData[0]?.neutral || 0),
      negative: Number(mentionData[0]?.negative || 0),
    },
    platforms: platformData.map((p) => ({
      platform: p.platform,
      mentions: Number(p.mentions),
    })),
    categories: categoryData
      .filter((c) => c.category)
      .map((c) => ({
        category: c.category!,
        count: Number(c.count),
      })),
    topPosts: topPostsData.map((p) => ({
      title: p.title,
      platform: p.platform,
      sentiment: p.sentiment || "neutral",
      url: p.sourceUrl,
    })),
  };
}

function generateReportEmail(
  userName: string,
  data: ReportData,
  days: number,
  schedule: string
): string {
  const periodLabel = schedule === "weekly" ? "week" : "month";
  const positivePercent = data.totals.mentions > 0
    ? Math.round((data.totals.positive / data.totals.mentions) * 100)
    : 0;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <h1 style="color: #14b8a6; margin: 0 0 8px 0; font-size: 24px;">📊 Your ${schedule === "weekly" ? "Weekly" : "Monthly"} Report</h1>
      <p style="color: #94a3b8; margin: 0; font-size: 14px;">Last ${days} days of community monitoring</p>
    </div>

    <!-- Main Content -->
    <div style="background: #ffffff; padding: 32px; border-radius: 0 0 16px 16px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">
        Hi ${userName},
      </p>
      <p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">
        Here's your community monitoring summary for the past ${periodLabel}.
      </p>

      <!-- Stats Grid -->
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px;">
        <div style="background: #f8fafc; border-radius: 12px; padding: 20px; text-align: center;">
          <div style="color: #0f172a; font-size: 32px; font-weight: bold;">${data.totals.mentions.toLocaleString()}</div>
          <div style="color: #64748b; font-size: 14px;">Total Mentions</div>
        </div>
        <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; text-align: center;">
          <div style="color: #16a34a; font-size: 32px; font-weight: bold;">${positivePercent}%</div>
          <div style="color: #64748b; font-size: 14px;">Positive Sentiment</div>
        </div>
      </div>

      <!-- Sentiment Breakdown -->
      <div style="margin-bottom: 24px;">
        <h3 style="color: #0f172a; font-size: 16px; margin: 0 0 12px 0;">Sentiment Breakdown</h3>
        <div style="display: flex; gap: 8px;">
          <div style="flex: 1; background: #dcfce7; padding: 12px; border-radius: 8px; text-align: center;">
            <div style="color: #16a34a; font-weight: bold;">${data.totals.positive}</div>
            <div style="color: #16a34a; font-size: 12px;">Positive</div>
          </div>
          <div style="flex: 1; background: #f1f5f9; padding: 12px; border-radius: 8px; text-align: center;">
            <div style="color: #64748b; font-weight: bold;">${data.totals.neutral}</div>
            <div style="color: #64748b; font-size: 12px;">Neutral</div>
          </div>
          <div style="flex: 1; background: #fee2e2; padding: 12px; border-radius: 8px; text-align: center;">
            <div style="color: #dc2626; font-weight: bold;">${data.totals.negative}</div>
            <div style="color: #dc2626; font-size: 12px;">Negative</div>
          </div>
        </div>
      </div>

      <!-- Top Platforms -->
      ${data.platforms.length > 0 ? `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #0f172a; font-size: 16px; margin: 0 0 12px 0;">Top Platforms</h3>
        ${data.platforms.slice(0, 5).map(p => `
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
          <span style="color: #374151; text-transform: capitalize;">${p.platform}</span>
          <span style="color: #14b8a6; font-weight: 600;">${p.mentions} mentions</span>
        </div>
        `).join('')}
      </div>
      ` : ''}

      <!-- Top Posts -->
      ${data.topPosts.length > 0 ? `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #0f172a; font-size: 16px; margin: 0 0 12px 0;">Top Engaging Posts</h3>
        ${data.topPosts.slice(0, 3).map(p => `
        <div style="background: #f8fafc; border-radius: 8px; padding: 12px; margin-bottom: 8px;">
          <a href="${p.url}" style="color: #0f172a; text-decoration: none; font-weight: 500; display: block; margin-bottom: 4px;">
            ${p.title.slice(0, 80)}${p.title.length > 80 ? '...' : ''}
          </a>
          <span style="color: #64748b; font-size: 12px; text-transform: capitalize;">${p.platform} • ${p.sentiment}</span>
        </div>
        `).join('')}
      </div>
      ` : ''}

      <!-- CTA -->
      <div style="text-align: center; padding-top: 16px;">
        <a href="https://kaulbyapp.com/dashboard" style="display: inline-block; background: #14b8a6; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600;">
          View Full Dashboard
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 24px; color: #64748b; font-size: 12px;">
      <p style="margin: 0 0 8px 0;">
        You're receiving this because you enabled ${schedule} reports in Kaulby.
      </p>
      <p style="margin: 0;">
        <a href="https://kaulbyapp.com/dashboard/settings" style="color: #14b8a6;">Manage report settings</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// ─── PDF Color Palette ───────────────────────────────────────────────────────
const COLORS = {
  primary: [20, 184, 166] as const,      // teal-500
  primaryDark: [13, 148, 136] as const,   // teal-600
  headerBg: [15, 23, 42] as const,        // slate-900
  headerBgLight: [30, 41, 59] as const,   // slate-800
  text: [55, 65, 81] as const,            // gray-700
  textDark: [15, 23, 42] as const,        // slate-900
  textMuted: [100, 116, 139] as const,    // slate-500
  textLight: [148, 163, 184] as const,    // slate-400
  positive: [22, 163, 74] as const,       // green-600
  positiveBg: [220, 252, 231] as const,   // green-100
  neutral: [100, 116, 139] as const,      // slate-500
  neutralBg: [241, 245, 249] as const,    // slate-100
  negative: [220, 38, 38] as const,       // red-600
  negativeBg: [254, 226, 226] as const,   // red-100
  cardBg: [248, 250, 252] as const,       // slate-50
  border: [226, 232, 240] as const,       // slate-200
  white: [255, 255, 255] as const,
} as const;

// ─── PDF Context ─────────────────────────────────────────────────────────────
interface PdfContext {
  doc: InstanceType<typeof import("jspdf").jsPDF>;
  pageWidth: number;
  margin: number;
  contentWidth: number;
  y: number; // current y position, mutated by helpers
}

// ─── Utility Helpers ─────────────────────────────────────────────────────────

function checkPageBreak(ctx: PdfContext, neededHeight: number): void {
  const pageHeight = ctx.doc.internal.pageSize.getHeight();
  if (ctx.y + neededHeight > pageHeight - 20) {
    ctx.doc.addPage();
    ctx.y = 20;
  }
}

function drawSectionDivider(ctx: PdfContext): void {
  ctx.doc.setDrawColor(...COLORS.border);
  ctx.doc.setLineWidth(0.3);
  ctx.doc.line(ctx.margin, ctx.y, ctx.pageWidth - ctx.margin, ctx.y);
  ctx.y += 8;
}

function drawSectionTitle(ctx: PdfContext, title: string): void {
  checkPageBreak(ctx, 20);
  ctx.doc.setTextColor(...COLORS.textDark);
  ctx.doc.setFontSize(14);
  ctx.doc.setFont("helvetica", "bold");
  ctx.doc.text(title, ctx.margin, ctx.y);
  // Teal accent underline
  ctx.doc.setDrawColor(...COLORS.primary);
  ctx.doc.setLineWidth(0.8);
  ctx.doc.line(ctx.margin, ctx.y + 2, ctx.margin + ctx.doc.getTextWidth(title), ctx.y + 2);
  ctx.y += 10;
}

function getReportPeriodDates(days: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return { start: fmt(start), end: fmt(end) };
}

// ─── Header ──────────────────────────────────────────────────────────────────

function drawHeader(ctx: PdfContext, days: number, schedule: string, branding?: ReportBranding): void {
  const periodLabel = schedule === "weekly" ? "Weekly" : "Monthly";
  const headerHeight = 52;

  // Resolve branding overrides
  const brandName = branding?.companyName || "KAULBY";
  const accentColor: readonly [number, number, number] =
    (branding?.primaryColor && hexToRgb(branding.primaryColor)) || COLORS.primary;

  // Gradient-like effect: darker bottom band overlaid on slate-900
  ctx.doc.setFillColor(...COLORS.headerBg);
  ctx.doc.rect(0, 0, ctx.pageWidth, headerHeight, "F");
  // Lighter stripe at top for subtle gradient feel
  ctx.doc.setFillColor(...COLORS.headerBgLight);
  ctx.doc.rect(0, 0, ctx.pageWidth, 18, "F");

  // Company branding
  ctx.doc.setTextColor(...accentColor);
  ctx.doc.setFontSize(10);
  ctx.doc.setFont("helvetica", "bold");
  ctx.doc.text(brandName.toUpperCase(), ctx.margin, 12);

  // Main title
  ctx.doc.setTextColor(...COLORS.white);
  ctx.doc.setFontSize(20);
  ctx.doc.setFont("helvetica", "bold");
  ctx.doc.text(`${periodLabel} Report`, ctx.margin, 30);

  // Subtitle
  ctx.doc.setTextColor(...COLORS.textLight);
  ctx.doc.setFontSize(9);
  ctx.doc.setFont("helvetica", "normal");
  ctx.doc.text("COMMUNITY MONITORING REPORT", ctx.margin, 37);

  // Period dates on the right
  const { start, end } = getReportPeriodDates(days);
  ctx.doc.setTextColor(...COLORS.textLight);
  ctx.doc.setFontSize(9);
  ctx.doc.setFont("helvetica", "normal");
  ctx.doc.text(`${start} — ${end}`, ctx.pageWidth - ctx.margin, 30, { align: "right" });

  // Thin accent line below header (uses custom color if provided)
  ctx.doc.setDrawColor(...accentColor);
  ctx.doc.setLineWidth(1);
  ctx.doc.line(0, headerHeight, ctx.pageWidth, headerHeight);

  ctx.y = headerHeight + 10;
}

// ─── Table of Contents (monthly reports only) ────────────────────────────────

function drawTableOfContents(ctx: PdfContext, data: ReportData): void {
  drawSectionTitle(ctx, "Table of Contents");

  const sections = [
    "Executive Summary",
    "Key Metrics",
    "Sentiment Breakdown",
  ];
  if (data.platforms.length > 0) sections.push("Top Platforms");
  if (data.categories.length > 0) sections.push("Top Categories");
  if (data.topPosts.length > 0) sections.push("Top Engaging Posts");

  for (let i = 0; i < sections.length; i++) {
    ctx.doc.setTextColor(...COLORS.text);
    ctx.doc.setFontSize(10);
    ctx.doc.setFont("helvetica", "normal");
    const num = `${i + 1}.`;
    ctx.doc.text(num, ctx.margin + 4, ctx.y);
    ctx.doc.text(sections[i], ctx.margin + 14, ctx.y);

    // Dotted leader line
    ctx.doc.setDrawColor(...COLORS.border);
    ctx.doc.setLineWidth(0.2);
    const textEnd = ctx.margin + 14 + ctx.doc.getTextWidth(sections[i]) + 2;
    const lineEnd = ctx.pageWidth - ctx.margin;
    if (textEnd < lineEnd - 10) {
      for (let x = textEnd; x < lineEnd; x += 2) {
        ctx.doc.line(x, ctx.y, x + 0.5, ctx.y);
      }
    }
    ctx.y += 7;
  }

  ctx.y += 6;
  drawSectionDivider(ctx);
}

// ─── Greeting ────────────────────────────────────────────────────────────────

function drawGreeting(ctx: PdfContext, userName: string, schedule: string): void {
  ctx.doc.setTextColor(...COLORS.text);
  ctx.doc.setFontSize(12);
  ctx.doc.setFont("helvetica", "normal");
  ctx.doc.text(`Hi ${userName},`, ctx.margin, ctx.y);
  ctx.y += 6;
  ctx.doc.setFontSize(10);
  ctx.doc.text(
    `Here's your community monitoring summary for the past ${schedule === "weekly" ? "week" : "month"}.`,
    ctx.margin,
    ctx.y
  );
  ctx.y += 12;
}

// ─── Executive Summary (NEW) ─────────────────────────────────────────────────

function drawExecutiveSummary(ctx: PdfContext, data: ReportData): void {
  checkPageBreak(ctx, 40);
  drawSectionTitle(ctx, "Executive Summary");

  const platformCount = data.platforms.length;
  const summaryText = `You received ${data.totals.mentions.toLocaleString()} mention${data.totals.mentions === 1 ? "" : "s"} across ${platformCount} platform${platformCount === 1 ? "" : "s"} this period.`;

  ctx.doc.setTextColor(...COLORS.text);
  ctx.doc.setFontSize(10);
  ctx.doc.setFont("helvetica", "normal");
  ctx.doc.text(summaryText, ctx.margin, ctx.y, { maxWidth: ctx.contentWidth });
  ctx.y += 8;

  // Sentiment callout box
  const positivePercent =
    data.totals.mentions > 0
      ? Math.round((data.totals.positive / data.totals.mentions) * 100)
      : 0;
  const negativePercent =
    data.totals.mentions > 0
      ? Math.round((data.totals.negative / data.totals.mentions) * 100)
      : 0;

  if (positivePercent >= 60) {
    // Positive callout
    ctx.doc.setFillColor(...COLORS.positiveBg);
    ctx.doc.roundedRect(ctx.margin, ctx.y, ctx.contentWidth, 14, 3, 3, "F");
    ctx.doc.setDrawColor(...COLORS.positive);
    ctx.doc.setLineWidth(0.4);
    ctx.doc.roundedRect(ctx.margin, ctx.y, ctx.contentWidth, 14, 3, 3, "S");
    ctx.doc.setTextColor(...COLORS.positive);
    ctx.doc.setFontSize(9);
    ctx.doc.setFont("helvetica", "bold");
    ctx.doc.text(
      `Strong positive sentiment — ${positivePercent}% of mentions are positive.`,
      ctx.margin + 6,
      ctx.y + 9
    );
    ctx.y += 20;
  } else if (data.totals.negative > 0 && negativePercent >= 20) {
    // Negative attention callout
    ctx.doc.setFillColor(...COLORS.negativeBg);
    ctx.doc.roundedRect(ctx.margin, ctx.y, ctx.contentWidth, 14, 3, 3, "F");
    ctx.doc.setDrawColor(...COLORS.negative);
    ctx.doc.setLineWidth(0.4);
    ctx.doc.roundedRect(ctx.margin, ctx.y, ctx.contentWidth, 14, 3, 3, "S");
    ctx.doc.setTextColor(...COLORS.negative);
    ctx.doc.setFontSize(9);
    ctx.doc.setFont("helvetica", "bold");
    ctx.doc.text(
      `Attention: ${data.totals.negative} negative mention${data.totals.negative === 1 ? "" : "s"} detected (${negativePercent}%). Review recommended.`,
      ctx.margin + 6,
      ctx.y + 9
    );
    ctx.y += 20;
  } else {
    ctx.y += 4;
  }

  drawSectionDivider(ctx);
}

// ─── Summary Stats (3-column cards) ──────────────────────────────────────────

function drawSummaryStats(ctx: PdfContext, data: ReportData): void {
  checkPageBreak(ctx, 50);
  drawSectionTitle(ctx, "Key Metrics");

  const positivePercent =
    data.totals.mentions > 0
      ? Math.round((data.totals.positive / data.totals.mentions) * 100)
      : 0;
  const platformCount = data.platforms.length;

  const cardGap = 6;
  const cardWidth = (ctx.contentWidth - cardGap * 2) / 3;
  const cardHeight = 34;

  const cards = [
    { value: data.totals.mentions.toLocaleString(), label: "Total Mentions", color: COLORS.textDark },
    { value: `${positivePercent}%`, label: "Positive Sentiment", color: COLORS.positive },
    { value: `${platformCount}`, label: "Platforms Active", color: COLORS.primaryDark },
  ];

  for (let i = 0; i < cards.length; i++) {
    const cardX = ctx.margin + i * (cardWidth + cardGap);

    // Card background with subtle border
    ctx.doc.setFillColor(...COLORS.cardBg);
    ctx.doc.roundedRect(cardX, ctx.y, cardWidth, cardHeight, 3, 3, "F");
    ctx.doc.setDrawColor(...COLORS.border);
    ctx.doc.setLineWidth(0.3);
    ctx.doc.roundedRect(cardX, ctx.y, cardWidth, cardHeight, 3, 3, "S");

    // Label above number
    ctx.doc.setTextColor(...COLORS.textMuted);
    ctx.doc.setFontSize(7);
    ctx.doc.setFont("helvetica", "bold");
    ctx.doc.text(cards[i].label.toUpperCase(), cardX + cardWidth / 2, ctx.y + 10, {
      align: "center",
    });

    // Value
    const [cr, cg, cb] = cards[i].color;
    ctx.doc.setTextColor(cr, cg, cb);
    ctx.doc.setFontSize(22);
    ctx.doc.setFont("helvetica", "bold");
    ctx.doc.text(cards[i].value, cardX + cardWidth / 2, ctx.y + 26, {
      align: "center",
    });
  }

  ctx.y += cardHeight + 10;
  drawSectionDivider(ctx);
}

// ─── Sentiment Breakdown ─────────────────────────────────────────────────────

function drawSentimentBreakdown(ctx: PdfContext, data: ReportData): void {
  checkPageBreak(ctx, 45);
  drawSectionTitle(ctx, "Sentiment Breakdown");

  const total = data.totals.positive + data.totals.neutral + data.totals.negative || 1;
  const posPercent = Math.round((data.totals.positive / total) * 100);
  const neuPercent = Math.round((data.totals.neutral / total) * 100);
  const negPercent = 100 - posPercent - neuPercent;

  const posW = (data.totals.positive / total) * ctx.contentWidth;
  const neuW = (data.totals.neutral / total) * ctx.contentWidth;
  const negW = ctx.contentWidth - posW - neuW; // ensure full width coverage

  const barHeight = 10;
  const barY = ctx.y;
  const barRadius = 3;

  // Draw full rounded background first
  ctx.doc.setFillColor(...COLORS.neutralBg);
  ctx.doc.roundedRect(ctx.margin, barY, ctx.contentWidth, barHeight, barRadius, barRadius, "F");

  // Positive segment (left, with left rounded corners)
  if (posW > 0) {
    ctx.doc.setFillColor(...COLORS.positive);
    if (neuW === 0 && negW <= 0) {
      ctx.doc.roundedRect(ctx.margin, barY, posW, barHeight, barRadius, barRadius, "F");
    } else {
      ctx.doc.roundedRect(ctx.margin, barY, Math.max(posW, barRadius * 2), barHeight, barRadius, barRadius, "F");
      // Overlap to square off the right side
      if (posW > barRadius * 2) {
        ctx.doc.rect(ctx.margin + posW - barRadius, barY, barRadius, barHeight, "F");
      }
    }
  }

  // Neutral segment (middle)
  if (neuW > 0) {
    ctx.doc.setFillColor(...COLORS.neutral);
    ctx.doc.rect(ctx.margin + posW, barY, neuW, barHeight, "F");
  }

  // Negative segment (right, with right rounded corners)
  if (negW > 0) {
    ctx.doc.setFillColor(...COLORS.negative);
    if (posW === 0 && neuW === 0) {
      ctx.doc.roundedRect(ctx.margin, barY, negW, barHeight, barRadius, barRadius, "F");
    } else {
      const negX = ctx.margin + posW + neuW;
      ctx.doc.roundedRect(negX - barRadius, barY, negW + barRadius, barHeight, barRadius, barRadius, "F");
      // Square off the left side
      if (negW > barRadius * 2) {
        ctx.doc.rect(negX, barY, barRadius, barHeight, "F");
      }
    }
  }

  // Percentage labels on bar (only if segment is wide enough)
  ctx.doc.setFontSize(7);
  ctx.doc.setFont("helvetica", "bold");
  if (posW > 20) {
    ctx.doc.setTextColor(...COLORS.white);
    ctx.doc.text(`${posPercent}%`, ctx.margin + posW / 2, barY + 6.5, { align: "center" });
  }
  if (neuW > 20) {
    ctx.doc.setTextColor(...COLORS.white);
    ctx.doc.text(`${neuPercent}%`, ctx.margin + posW + neuW / 2, barY + 6.5, { align: "center" });
  }
  if (negW > 20) {
    ctx.doc.setTextColor(...COLORS.white);
    ctx.doc.text(`${negPercent}%`, ctx.margin + posW + neuW + negW / 2, barY + 6.5, { align: "center" });
  }

  ctx.y = barY + barHeight + 6;

  // Legend row with colored dots
  const legends = [
    { label: `Positive (${data.totals.positive})`, color: COLORS.positive },
    { label: `Neutral (${data.totals.neutral})`, color: COLORS.neutral },
    { label: `Negative (${data.totals.negative})`, color: COLORS.negative },
  ];

  let legendX = ctx.margin;
  for (const legend of legends) {
    const [lr, lg, lb] = legend.color;
    ctx.doc.setFillColor(lr, lg, lb);
    ctx.doc.circle(legendX + 2, ctx.y - 1, 1.5, "F");
    ctx.doc.setTextColor(...COLORS.text);
    ctx.doc.setFontSize(8);
    ctx.doc.setFont("helvetica", "normal");
    ctx.doc.text(legend.label, legendX + 6, ctx.y);
    legendX += ctx.doc.getTextWidth(legend.label) + 16;
  }

  ctx.y += 10;
  drawSectionDivider(ctx);
}

// ─── Top Platforms ───────────────────────────────────────────────────────────

function drawTopPlatforms(ctx: PdfContext, data: ReportData): void {
  if (data.platforms.length === 0) return;

  const platformsToShow = data.platforms.slice(0, 5);
  checkPageBreak(ctx, 20 + platformsToShow.length * 12);
  drawSectionTitle(ctx, "Top Platforms");

  const maxMentions = Math.max(...platformsToShow.map((p) => p.mentions));
  const totalMentions = data.totals.mentions || 1;

  for (let i = 0; i < platformsToShow.length; i++) {
    const p = platformsToShow[i];
    checkPageBreak(ctx, 12);

    const rowY = ctx.y;
    const rowHeight = 10;

    // Alternating row background
    if (i % 2 === 0) {
      ctx.doc.setFillColor(...COLORS.cardBg);
      ctx.doc.rect(ctx.margin, rowY - 2, ctx.contentWidth, rowHeight, "F");
    }

    // Rank number
    ctx.doc.setTextColor(...COLORS.textMuted);
    ctx.doc.setFontSize(9);
    ctx.doc.setFont("helvetica", "bold");
    ctx.doc.text(`${i + 1}`, ctx.margin + 4, rowY + 4, { align: "center" });

    // Platform name
    const platformName = p.platform.charAt(0).toUpperCase() + p.platform.slice(1);
    ctx.doc.setTextColor(...COLORS.textDark);
    ctx.doc.setFontSize(9);
    ctx.doc.setFont("helvetica", "normal");
    ctx.doc.text(platformName, ctx.margin + 10, rowY + 4);

    // Bar
    const barLeft = ctx.margin + 50;
    const barMaxWidth = ctx.contentWidth - 100;
    const barWidth = Math.max((p.mentions / maxMentions) * barMaxWidth, 2);
    ctx.doc.setFillColor(...COLORS.primary);
    ctx.doc.roundedRect(barLeft, rowY, barWidth, 5, 2, 2, "F");

    // Mention count + percentage
    const percent = Math.round((p.mentions / totalMentions) * 100);
    ctx.doc.setTextColor(...COLORS.primaryDark);
    ctx.doc.setFontSize(9);
    ctx.doc.setFont("helvetica", "bold");
    ctx.doc.text(`${p.mentions}`, ctx.pageWidth - ctx.margin - 18, rowY + 4, { align: "right" });
    ctx.doc.setTextColor(...COLORS.textMuted);
    ctx.doc.setFontSize(7);
    ctx.doc.setFont("helvetica", "normal");
    ctx.doc.text(`(${percent}%)`, ctx.pageWidth - ctx.margin, rowY + 4, { align: "right" });

    ctx.y += rowHeight + 2;
  }

  ctx.y += 4;
  drawSectionDivider(ctx);
}

// ─── Categories (pill-shaped tags) ───────────────────────────────────────────

function drawCategories(ctx: PdfContext, data: ReportData): void {
  if (data.categories.length === 0) return;

  const categoriesToShow = data.categories.slice(0, 6);
  checkPageBreak(ctx, 20 + categoriesToShow.length * 10);
  drawSectionTitle(ctx, "Top Categories");

  for (const c of categoriesToShow) {
    checkPageBreak(ctx, 10);

    const catLabel = c.category
      .replace(/_/g, " ")
      .replace(/\b\w/g, (ch) => ch.toUpperCase());

    // Pill background for category name
    const textWidth = Math.min(ctx.doc.getTextWidth(catLabel) + 8, ctx.contentWidth - 40);
    const pillHeight = 7;
    const pillY = ctx.y - 4.5;

    ctx.doc.setFillColor(...COLORS.neutralBg);
    ctx.doc.roundedRect(ctx.margin, pillY, textWidth, pillHeight, 3, 3, "F");

    ctx.doc.setTextColor(...COLORS.textDark);
    ctx.doc.setFontSize(8);
    ctx.doc.setFont("helvetica", "normal");
    ctx.doc.text(catLabel, ctx.margin + 4, ctx.y);

    // Count badge
    const countStr = `${c.count}`;
    const badgeWidth = ctx.doc.getTextWidth(countStr) + 6;
    const badgeX = ctx.pageWidth - ctx.margin - badgeWidth;

    ctx.doc.setFillColor(...COLORS.primary);
    ctx.doc.roundedRect(badgeX, pillY, badgeWidth, pillHeight, 3, 3, "F");
    ctx.doc.setTextColor(...COLORS.white);
    ctx.doc.setFontSize(7);
    ctx.doc.setFont("helvetica", "bold");
    ctx.doc.text(countStr, badgeX + badgeWidth / 2, ctx.y, { align: "center" });

    ctx.y += 10;
  }

  ctx.y += 4;
  drawSectionDivider(ctx);
}

// ─── Top Posts (ranked with sentiment badges) ────────────────────────────────

function drawTopPosts(ctx: PdfContext, data: ReportData): void {
  if (data.topPosts.length === 0) return;

  checkPageBreak(ctx, 40);
  drawSectionTitle(ctx, "Top Engaging Posts");

  for (let i = 0; i < Math.min(data.topPosts.length, 5); i++) {
    const p = data.topPosts[i];
    checkPageBreak(ctx, 28);

    // Ranking number circle
    ctx.doc.setFillColor(...COLORS.primary);
    ctx.doc.circle(ctx.margin + 4, ctx.y + 1, 3.5, "F");
    ctx.doc.setTextColor(...COLORS.white);
    ctx.doc.setFontSize(8);
    ctx.doc.setFont("helvetica", "bold");
    ctx.doc.text(`${i + 1}`, ctx.margin + 4, ctx.y + 2.2, { align: "center" });

    // Title
    const title = p.title.length > 85 ? p.title.slice(0, 82) + "..." : p.title;
    ctx.doc.setTextColor(...COLORS.textDark);
    ctx.doc.setFontSize(10);
    ctx.doc.setFont("helvetica", "bold");
    ctx.doc.text(title, ctx.margin + 12, ctx.y + 1.5, { maxWidth: ctx.contentWidth - 14 });
    ctx.y += 6;

    // Platform + sentiment pill
    const platformName = p.platform.charAt(0).toUpperCase() + p.platform.slice(1);
    ctx.doc.setTextColor(...COLORS.textMuted);
    ctx.doc.setFontSize(8);
    ctx.doc.setFont("helvetica", "normal");
    ctx.doc.text(`${platformName}`, ctx.margin + 12, ctx.y);

    // Sentiment colored dot + text
    const sentimentColor: readonly [number, number, number] =
      p.sentiment === "positive" ? COLORS.positive :
      p.sentiment === "negative" ? COLORS.negative :
      COLORS.neutral;
    const sentLabel = p.sentiment.charAt(0).toUpperCase() + p.sentiment.slice(1);
    const dotX = ctx.margin + 12 + ctx.doc.getTextWidth(platformName) + 6;
    ctx.doc.setFillColor(...sentimentColor);
    ctx.doc.circle(dotX, ctx.y - 1, 1.2, "F");
    ctx.doc.setTextColor(...sentimentColor);
    ctx.doc.setFontSize(8);
    ctx.doc.text(sentLabel, dotX + 3, ctx.y);
    ctx.y += 5;

    // URL (truncated, clean display)
    const cleanUrl = p.url.replace(/^https?:\/\/(www\.)?/, "");
    const urlDisplay = cleanUrl.length > 70 ? cleanUrl.slice(0, 67) + "..." : cleanUrl;
    ctx.doc.setTextColor(...COLORS.primary);
    ctx.doc.setFontSize(7);
    ctx.doc.text(urlDisplay, ctx.margin + 12, ctx.y);
    ctx.y += 4;

    // Separator between posts (except after last)
    if (i < Math.min(data.topPosts.length, 5) - 1) {
      ctx.doc.setDrawColor(...COLORS.border);
      ctx.doc.setLineWidth(0.15);
      ctx.doc.line(ctx.margin + 12, ctx.y + 1, ctx.pageWidth - ctx.margin, ctx.y + 1);
      ctx.y += 5;
    } else {
      ctx.y += 3;
    }
  }

  ctx.y += 4;
}

// ─── Footer (all pages) ─────────────────────────────────────────────────────

function drawFooter(ctx: PdfContext, branding?: ReportBranding): void {
  const totalPages = ctx.doc.getNumberOfPages();
  const pageHeight = ctx.doc.internal.pageSize.getHeight();
  const timestamp = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const accentColor: readonly [number, number, number] =
    (branding?.primaryColor && hexToRgb(branding.primaryColor)) || COLORS.primary;

  for (let page = 1; page <= totalPages; page++) {
    ctx.doc.setPage(page);
    const footerY = pageHeight - 10;

    // Top border line
    ctx.doc.setDrawColor(...COLORS.border);
    ctx.doc.setLineWidth(0.3);
    ctx.doc.line(ctx.margin, footerY - 5, ctx.pageWidth - ctx.margin, footerY - 5);

    // Left: branding (custom footer text, company name, or default Kaulby)
    if (branding?.footerText) {
      ctx.doc.setTextColor(...COLORS.textLight);
      ctx.doc.setFontSize(7);
      ctx.doc.setFont("helvetica", "normal");
      ctx.doc.text(branding.footerText, ctx.margin, footerY);
    } else if (branding?.hideKaulbyBranding) {
      // No branding text in footer when Kaulby branding is hidden
      if (branding.companyName) {
        ctx.doc.setTextColor(...accentColor);
        ctx.doc.setFontSize(8);
        ctx.doc.setFont("helvetica", "bold");
        ctx.doc.text(branding.companyName.toUpperCase(), ctx.margin, footerY);
      }
    } else {
      // Default Kaulby branding
      ctx.doc.setTextColor(...accentColor);
      ctx.doc.setFontSize(8);
      ctx.doc.setFont("helvetica", "bold");
      ctx.doc.text("KAULBY", ctx.margin, footerY);
      ctx.doc.setTextColor(...COLORS.textLight);
      ctx.doc.setFontSize(7);
      ctx.doc.setFont("helvetica", "normal");
      ctx.doc.text("  |  kaulbyapp.com", ctx.margin + ctx.doc.getTextWidth("KAULBY") + 1, footerY);
    }

    // Center: confidential + timestamp
    ctx.doc.setTextColor(...COLORS.textLight);
    ctx.doc.setFontSize(6);
    ctx.doc.setFont("helvetica", "normal");
    ctx.doc.text(`Confidential — Generated ${timestamp}`, ctx.pageWidth / 2, footerY, {
      align: "center",
    });

    // Right: page numbers
    ctx.doc.setTextColor(...COLORS.textMuted);
    ctx.doc.setFontSize(8);
    ctx.doc.setFont("helvetica", "normal");
    ctx.doc.text(`Page ${page} of ${totalPages}`, ctx.pageWidth - ctx.margin, footerY, {
      align: "right",
    });
  }
}

// ─── Main PDF Generator ─────────────────────────────────────────────────────
// PERF-BUNDLE-002: Dynamic import jsPDF only when generating PDFs

async function generateReportPdf(
  userName: string,
  data: ReportData,
  days: number,
  schedule: string,
  branding?: ReportBranding
): Promise<Buffer> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const ctx: PdfContext = {
    doc,
    pageWidth: doc.internal.pageSize.getWidth(),
    margin: 20,
    contentWidth: doc.internal.pageSize.getWidth() - 40,
    y: 20,
  };

  drawHeader(ctx, days, schedule, branding);

  // Table of contents for monthly reports
  if (days >= 30) {
    drawTableOfContents(ctx, data);
  }

  drawGreeting(ctx, userName, schedule);
  drawExecutiveSummary(ctx, data);
  drawSummaryStats(ctx, data);
  drawSentimentBreakdown(ctx, data);
  drawTopPlatforms(ctx, data);
  drawCategories(ctx, data);
  drawTopPosts(ctx, data);

  // Footer applied last so it covers all pages
  drawFooter(ctx, branding);

  return Buffer.from(doc.output("arraybuffer"));
}
