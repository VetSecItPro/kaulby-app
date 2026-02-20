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
          eq(users.subscriptionStatus, "enterprise"),
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
            user.reportSchedule || "weekly"
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

// PERF-DX-001: Extracted from generateReportPdf
// Helper type for PDF generation context
interface PdfContext {
  doc: InstanceType<typeof import("jspdf").jsPDF>;
  pageWidth: number;
  margin: number;
  contentWidth: number;
  y: number; // current y position, mutated by helpers
}

// PERF-DX-001: Extracted from generateReportPdf — page break check
function checkPageBreak(ctx: PdfContext, neededHeight: number): void {
  if (ctx.y + neededHeight > 270) {
    ctx.doc.addPage();
    ctx.y = 20;
  }
}

// PERF-DX-001: Extracted from generateReportPdf — dark header with title and date
function drawHeader(ctx: PdfContext, days: number, schedule: string): void {
  const periodLabel = schedule === "weekly" ? "Weekly" : "Monthly";
  ctx.doc.setFillColor(15, 23, 42); // slate-900
  ctx.doc.rect(0, 0, ctx.pageWidth, 40, "F");
  ctx.doc.setTextColor(20, 184, 166); // teal-500
  ctx.doc.setFontSize(22);
  ctx.doc.setFont("helvetica", "bold");
  ctx.doc.text(`Kaulby ${periodLabel} Report`, ctx.margin, 18);
  ctx.doc.setTextColor(148, 163, 184); // slate-400
  ctx.doc.setFontSize(11);
  ctx.doc.setFont("helvetica", "normal");
  ctx.doc.text(
    `Last ${days} days of community monitoring — Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    ctx.margin,
    28
  );
  ctx.y = 50;
}

// PERF-DX-001: Extracted from generateReportPdf — user greeting and intro text
function drawGreeting(ctx: PdfContext, userName: string, schedule: string): void {
  ctx.doc.setTextColor(55, 65, 81); // gray-700
  ctx.doc.setFontSize(12);
  ctx.doc.text(`Hi ${userName},`, ctx.margin, ctx.y);
  ctx.y += 6;
  ctx.doc.setFontSize(10);
  ctx.doc.text(
    `Here's your community monitoring summary for the past ${schedule === "weekly" ? "week" : "month"}.`,
    ctx.margin,
    ctx.y
  );
  ctx.y += 14;
}

// PERF-DX-001: Extracted from generateReportPdf — 2-column summary stat cards
function drawSummaryStats(ctx: PdfContext, data: ReportData): void {
  const positivePercent =
    data.totals.mentions > 0
      ? Math.round((data.totals.positive / data.totals.mentions) * 100)
      : 0;

  ctx.doc.setFillColor(248, 250, 252); // slate-50
  ctx.doc.roundedRect(ctx.margin, ctx.y, ctx.contentWidth / 2 - 4, 30, 3, 3, "F");
  ctx.doc.roundedRect(ctx.margin + ctx.contentWidth / 2 + 4, ctx.y, ctx.contentWidth / 2 - 4, 30, 3, 3, "F");

  ctx.doc.setTextColor(15, 23, 42);
  ctx.doc.setFontSize(24);
  ctx.doc.setFont("helvetica", "bold");
  ctx.doc.text(
    data.totals.mentions.toLocaleString(),
    ctx.margin + ctx.contentWidth / 4 - 2,
    ctx.y + 14,
    { align: "center" }
  );
  ctx.doc.setTextColor(100, 116, 139);
  ctx.doc.setFontSize(9);
  ctx.doc.setFont("helvetica", "normal");
  ctx.doc.text("Total Mentions", ctx.margin + ctx.contentWidth / 4 - 2, ctx.y + 22, {
    align: "center",
  });

  ctx.doc.setTextColor(22, 163, 74); // green-600
  ctx.doc.setFontSize(24);
  ctx.doc.setFont("helvetica", "bold");
  ctx.doc.text(
    `${positivePercent}%`,
    ctx.margin + (ctx.contentWidth * 3) / 4 + 2,
    ctx.y + 14,
    { align: "center" }
  );
  ctx.doc.setTextColor(100, 116, 139);
  ctx.doc.setFontSize(9);
  ctx.doc.setFont("helvetica", "normal");
  ctx.doc.text(
    "Positive Sentiment",
    ctx.margin + (ctx.contentWidth * 3) / 4 + 2,
    ctx.y + 22,
    { align: "center" }
  );
  ctx.y += 38;
}

// PERF-DX-001: Extracted from generateReportPdf — horizontal bar chart with counts
function drawSentimentBreakdown(ctx: PdfContext, data: ReportData): void {
  ctx.doc.setTextColor(15, 23, 42);
  ctx.doc.setFontSize(13);
  ctx.doc.setFont("helvetica", "bold");
  ctx.doc.text("Sentiment Breakdown", ctx.margin, ctx.y);
  ctx.y += 8;

  const barY = ctx.y;
  const total = data.totals.positive + data.totals.neutral + data.totals.negative || 1;
  const posW = (data.totals.positive / total) * ctx.contentWidth;
  const neuW = (data.totals.neutral / total) * ctx.contentWidth;
  const negW = (data.totals.negative / total) * ctx.contentWidth;

  ctx.doc.setFillColor(34, 197, 94); // green
  ctx.doc.rect(ctx.margin, barY, posW, 8, "F");
  ctx.doc.setFillColor(148, 163, 184); // gray
  ctx.doc.rect(ctx.margin + posW, barY, neuW, 8, "F");
  ctx.doc.setFillColor(239, 68, 68); // red
  ctx.doc.rect(ctx.margin + posW + neuW, barY, negW, 8, "F");
  ctx.y += 12;

  ctx.doc.setFontSize(9);
  ctx.doc.setFont("helvetica", "normal");
  ctx.doc.setTextColor(34, 197, 94);
  ctx.doc.text(`Positive: ${data.totals.positive}`, ctx.margin, ctx.y);
  ctx.doc.setTextColor(100, 116, 139);
  ctx.doc.text(`Neutral: ${data.totals.neutral}`, ctx.margin + 50, ctx.y);
  ctx.doc.setTextColor(239, 68, 68);
  ctx.doc.text(`Negative: ${data.totals.negative}`, ctx.margin + 95, ctx.y);
  ctx.y += 14;
}

// PERF-DX-001: Extracted from generateReportPdf — bar chart of top 5 platforms
function drawTopPlatforms(ctx: PdfContext, data: ReportData): void {
  if (data.platforms.length === 0) return;

  ctx.doc.setTextColor(15, 23, 42);
  ctx.doc.setFontSize(13);
  ctx.doc.setFont("helvetica", "bold");
  ctx.doc.text("Top Platforms", ctx.margin, ctx.y);
  ctx.y += 8;

  const maxMentions = Math.max(...data.platforms.map((p) => p.mentions));
  for (const p of data.platforms.slice(0, 5)) {
    const barWidth = (p.mentions / maxMentions) * (ctx.contentWidth - 70);
    ctx.doc.setFillColor(20, 184, 166);
    ctx.doc.rect(ctx.margin, ctx.y, barWidth, 6, "F");
    ctx.doc.setTextColor(55, 65, 81);
    ctx.doc.setFontSize(9);
    ctx.doc.setFont("helvetica", "normal");
    const platformName = p.platform.charAt(0).toUpperCase() + p.platform.slice(1);
    ctx.doc.text(platformName, ctx.margin + barWidth + 4, ctx.y + 5);
    ctx.doc.setTextColor(20, 184, 166);
    ctx.doc.text(`${p.mentions}`, ctx.pageWidth - ctx.margin, ctx.y + 5, {
      align: "right",
    });
    ctx.y += 10;
  }
  ctx.y += 6;
}

// PERF-DX-001: Extracted from generateReportPdf — bulleted list of top 6 categories
function drawCategories(ctx: PdfContext, data: ReportData): void {
  if (data.categories.length === 0) return;

  ctx.doc.setTextColor(15, 23, 42);
  ctx.doc.setFontSize(13);
  ctx.doc.setFont("helvetica", "bold");
  ctx.doc.text("Top Categories", ctx.margin, ctx.y);
  ctx.y += 8;

  for (const c of data.categories.slice(0, 6)) {
    ctx.doc.setTextColor(55, 65, 81);
    ctx.doc.setFontSize(9);
    ctx.doc.setFont("helvetica", "normal");
    const catLabel = c.category.replace(/_/g, " ");
    ctx.doc.text(`• ${catLabel}`, ctx.margin + 2, ctx.y);
    ctx.doc.setTextColor(20, 184, 166);
    ctx.doc.text(`${c.count}`, ctx.pageWidth - ctx.margin, ctx.y, { align: "right" });
    ctx.y += 6;
  }
  ctx.y += 8;
}

// PERF-DX-001: Extracted from generateReportPdf — top 5 engaging posts with pagination
function drawTopPosts(ctx: PdfContext, data: ReportData): void {
  if (data.topPosts.length === 0) return;

  checkPageBreak(ctx, 30);

  ctx.doc.setTextColor(15, 23, 42);
  ctx.doc.setFontSize(13);
  ctx.doc.setFont("helvetica", "bold");
  ctx.doc.text("Top Engaging Posts", ctx.margin, ctx.y);
  ctx.y += 8;

  for (const p of data.topPosts.slice(0, 5)) {
    checkPageBreak(ctx, 0);

    const title = p.title.length > 90 ? p.title.slice(0, 87) + "..." : p.title;
    ctx.doc.setTextColor(15, 23, 42);
    ctx.doc.setFontSize(10);
    ctx.doc.setFont("helvetica", "bold");
    ctx.doc.text(title, ctx.margin + 2, ctx.y, { maxWidth: ctx.contentWidth - 4 });
    ctx.y += 5;
    ctx.doc.setTextColor(100, 116, 139);
    ctx.doc.setFontSize(8);
    ctx.doc.setFont("helvetica", "normal");
    const platformName = p.platform.charAt(0).toUpperCase() + p.platform.slice(1);
    ctx.doc.text(`${platformName} · ${p.sentiment}`, ctx.margin + 2, ctx.y);
    ctx.y += 4;
    ctx.doc.setTextColor(20, 184, 166);
    ctx.doc.setFontSize(7);
    const urlDisplay = p.url.length > 80 ? p.url.slice(0, 77) + "..." : p.url;
    ctx.doc.text(urlDisplay, ctx.margin + 2, ctx.y);
    ctx.y += 8;
  }
}

// PERF-DX-001: Extracted from generateReportPdf — branding and page numbers
function drawFooter(ctx: PdfContext): void {
  const footerY = ctx.doc.internal.pageSize.getHeight() - 12;
  ctx.doc.setDrawColor(226, 232, 240);
  ctx.doc.line(ctx.margin, footerY - 4, ctx.pageWidth - ctx.margin, footerY - 4);
  ctx.doc.setTextColor(148, 163, 184);
  ctx.doc.setFontSize(8);
  ctx.doc.setFont("helvetica", "normal");
  ctx.doc.text("Generated by Kaulby · kaulbyapp.com", ctx.margin, footerY);
  ctx.doc.text(
    `Page ${ctx.doc.getNumberOfPages()}`,
    ctx.pageWidth - ctx.margin,
    footerY,
    { align: "right" }
  );
}

// PERF-BUNDLE-002: Dynamic import jsPDF only when generating PDFs
async function generateReportPdf(
  userName: string,
  data: ReportData,
  days: number,
  schedule: string
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

  drawHeader(ctx, days, schedule);
  drawGreeting(ctx, userName, schedule);
  drawSummaryStats(ctx, data);
  drawSentimentBreakdown(ctx, data);
  drawTopPlatforms(ctx, data);
  drawCategories(ctx, data);
  drawTopPosts(ctx, data);
  drawFooter(ctx);

  return Buffer.from(doc.output("arraybuffer"));
}
