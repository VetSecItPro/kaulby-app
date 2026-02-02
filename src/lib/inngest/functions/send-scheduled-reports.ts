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
import { jsPDF } from "jspdf";

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

    let sentCount = 0;
    let skippedCount = 0;

    for (const user of eligibleUsers) {
      // Check if today is the right day for this user
      const isWeekly = user.reportSchedule === "weekly" && dayOfWeek === (user.reportDay || 1);
      const isMonthly = user.reportSchedule === "monthly" && dayOfMonth === (user.reportDay || 1);

      if (!isWeekly && !isMonthly) {
        skippedCount++;
        continue;
      }

      // Prevent duplicate sends (check if already sent today)
      if (user.reportLastSentAt) {
        const lastSentDate = new Date(user.reportLastSentAt);
        if (
          lastSentDate.getFullYear() === now.getFullYear() &&
          lastSentDate.getMonth() === now.getMonth() &&
          lastSentDate.getDate() === now.getDate()
        ) {
          logger.info(`Skipping ${user.email} - already sent today`);
          skippedCount++;
          continue;
        }
      }

      // Generate and send report
      await step.run(`send-report-${user.id}`, async () => {
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

          const pdfBuffer = generateReportPdf(
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
      });
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

function generateReportPdf(
  userName: string,
  data: ReportData,
  days: number,
  schedule: string
): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const periodLabel = schedule === "weekly" ? "Weekly" : "Monthly";
  const positivePercent =
    data.totals.mentions > 0
      ? Math.round((data.totals.positive / data.totals.mentions) * 100)
      : 0;

  // Header
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 40, "F");
  doc.setTextColor(20, 184, 166); // teal-500
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(`Kaulby ${periodLabel} Report`, margin, 18);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Last ${days} days of community monitoring — Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    margin,
    28
  );
  y = 50;

  // Greeting
  doc.setTextColor(55, 65, 81); // gray-700
  doc.setFontSize(12);
  doc.text(`Hi ${userName},`, margin, y);
  y += 6;
  doc.setFontSize(10);
  doc.text(
    `Here's your community monitoring summary for the past ${schedule === "weekly" ? "week" : "month"}.`,
    margin,
    y
  );
  y += 14;

  // Summary Stats
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(margin, y, contentWidth / 2 - 4, 30, 3, 3, "F");
  doc.roundedRect(margin + contentWidth / 2 + 4, y, contentWidth / 2 - 4, 30, 3, 3, "F");

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text(
    data.totals.mentions.toLocaleString(),
    margin + contentWidth / 4 - 2,
    y + 14,
    { align: "center" }
  );
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Total Mentions", margin + contentWidth / 4 - 2, y + 22, {
    align: "center",
  });

  doc.setTextColor(22, 163, 74); // green-600
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text(
    `${positivePercent}%`,
    margin + (contentWidth * 3) / 4 + 2,
    y + 14,
    { align: "center" }
  );
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Positive Sentiment",
    margin + (contentWidth * 3) / 4 + 2,
    y + 22,
    { align: "center" }
  );
  y += 38;

  // Sentiment Breakdown
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Sentiment Breakdown", margin, y);
  y += 8;

  const barY = y;
  const total = data.totals.positive + data.totals.neutral + data.totals.negative || 1;
  const posW = (data.totals.positive / total) * contentWidth;
  const neuW = (data.totals.neutral / total) * contentWidth;
  const negW = (data.totals.negative / total) * contentWidth;

  doc.setFillColor(34, 197, 94); // green
  doc.rect(margin, barY, posW, 8, "F");
  doc.setFillColor(148, 163, 184); // gray
  doc.rect(margin + posW, barY, neuW, 8, "F");
  doc.setFillColor(239, 68, 68); // red
  doc.rect(margin + posW + neuW, barY, negW, 8, "F");
  y += 12;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(34, 197, 94);
  doc.text(`Positive: ${data.totals.positive}`, margin, y);
  doc.setTextColor(100, 116, 139);
  doc.text(`Neutral: ${data.totals.neutral}`, margin + 50, y);
  doc.setTextColor(239, 68, 68);
  doc.text(`Negative: ${data.totals.negative}`, margin + 95, y);
  y += 14;

  // Top Platforms
  if (data.platforms.length > 0) {
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Top Platforms", margin, y);
    y += 8;

    const maxMentions = Math.max(...data.platforms.map((p) => p.mentions));
    for (const p of data.platforms.slice(0, 5)) {
      const barWidth = (p.mentions / maxMentions) * (contentWidth - 70);
      doc.setFillColor(20, 184, 166);
      doc.rect(margin, y, barWidth, 6, "F");
      doc.setTextColor(55, 65, 81);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const platformName = p.platform.charAt(0).toUpperCase() + p.platform.slice(1);
      doc.text(platformName, margin + barWidth + 4, y + 5);
      doc.setTextColor(20, 184, 166);
      doc.text(`${p.mentions}`, pageWidth - margin, y + 5, {
        align: "right",
      });
      y += 10;
    }
    y += 6;
  }

  // Categories
  if (data.categories.length > 0) {
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Top Categories", margin, y);
    y += 8;

    for (const c of data.categories.slice(0, 6)) {
      doc.setTextColor(55, 65, 81);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const catLabel = c.category.replace(/_/g, " ");
      doc.text(`• ${catLabel}`, margin + 2, y);
      doc.setTextColor(20, 184, 166);
      doc.text(`${c.count}`, pageWidth - margin, y, { align: "right" });
      y += 6;
    }
    y += 8;
  }

  // Top Posts
  if (data.topPosts.length > 0) {
    // Check if we need a new page
    if (y > 240) {
      doc.addPage();
      y = margin;
    }

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Top Engaging Posts", margin, y);
    y += 8;

    for (const p of data.topPosts.slice(0, 5)) {
      if (y > 270) {
        doc.addPage();
        y = margin;
      }

      const title = p.title.length > 90 ? p.title.slice(0, 87) + "..." : p.title;
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(title, margin + 2, y, { maxWidth: contentWidth - 4 });
      y += 5;
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const platformName = p.platform.charAt(0).toUpperCase() + p.platform.slice(1);
      doc.text(`${platformName} · ${p.sentiment}`, margin + 2, y);
      y += 4;
      doc.setTextColor(20, 184, 166);
      doc.setFontSize(7);
      const urlDisplay = p.url.length > 80 ? p.url.slice(0, 77) + "..." : p.url;
      doc.text(urlDisplay, margin + 2, y);
      y += 8;
    }
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 12;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Generated by Kaulby · kaulbyapp.com", margin, footerY);
  doc.text(
    `Page ${doc.getNumberOfPages()}`,
    pageWidth - margin,
    footerY,
    { align: "right" }
  );

  // Return as Buffer
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
