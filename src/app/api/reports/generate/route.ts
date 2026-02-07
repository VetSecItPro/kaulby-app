/**
 * Report Generation API
 *
 * POST - Generate analytics report (HTML or PDF-ready)
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, monitors, results } from "@/lib/db";
import { eq, and, gte, inArray, desc, sql } from "drizzle-orm";
import { getUserPlan } from "@/lib/limits";
import { checkApiRateLimit, parseJsonBody, BodyTooLargeError } from "@/lib/rate-limit";

// FIX-212: Add maxDuration for long-running report generation
export const maxDuration = 60;

interface ReportConfig {
  title: string;
  dateRange: "7d" | "30d" | "90d";
  sections: Array<{
    id: string;
    enabled: boolean;
  }>;
  branding: {
    logoUrl?: string;
    primaryColor: string;
    companyName: string;
  };
  format: "pdf" | "html";
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
    engagement: number;
  }>;
  categories: Array<{
    category: string;
    count: number;
  }>;
  topPosts: Array<{
    title: string;
    platform: string;
    sentiment: string;
    engagement: number;
    url: string;
  }>;
  trends: Array<{
    date: string;
    mentions: number;
  }>;
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting check
    const rateLimit = await checkApiRateLimit(userId, "write");
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } });
    }

    // Check if user has Team tier
    const plan = await getUserPlan(userId);
    if (plan !== "enterprise") {
      return NextResponse.json(
        { error: "Report generation requires Team subscription" },
        { status: 403 }
      );
    }

    const config: ReportConfig = await parseJsonBody(req, 262144); // 256KB for report config
    const { title, dateRange, sections, branding, format } = config;

    // Calculate date range
    const days = dateRange === "7d" ? 7 : dateRange === "90d" ? 90 : 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get user's monitors
    const userMonitors = await db.query.monitors.findMany({
      where: eq(monitors.userId, userId),
      columns: { id: true, name: true },
    });

    if (userMonitors.length === 0) {
      return NextResponse.json(
        { error: "No monitors found. Create monitors to generate reports." },
        { status: 400 }
      );
    }

    const monitorIds = userMonitors.map((m) => m.id);

    // Fetch report data in parallel
    const [mentionData, platformData, categoryData, topPostsData] = await Promise.all([
      // Total mentions with sentiment breakdown
      db
        .select({
          total: sql<number>`count(*)`,
          positive: sql<number>`count(*) filter (where ${results.sentiment} = 'positive')`,
          neutral: sql<number>`count(*) filter (where ${results.sentiment} = 'neutral')`,
          negative: sql<number>`count(*) filter (where ${results.sentiment} = 'negative')`,
        })
        .from(results)
        .where(
          and(
            inArray(results.monitorId, monitorIds),
            gte(results.createdAt, startDate)
          )
        ),

      // Platform breakdown
      db
        .select({
          platform: results.platform,
          mentions: sql<number>`count(*)`,
          engagement: sql<number>`coalesce(sum(${results.engagementScore}), 0)`,
        })
        .from(results)
        .where(
          and(
            inArray(results.monitorId, monitorIds),
            gte(results.createdAt, startDate)
          )
        )
        .groupBy(results.platform)
        .orderBy(sql`count(*) desc`),

      // Category breakdown
      db
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
        .orderBy(sql`count(*) desc`),

      // FIX-207: Add limit to top posts query to prevent unbounded query
      db.query.results.findMany({
        where: and(
          inArray(results.monitorId, monitorIds),
          gte(results.createdAt, startDate)
        ),
        orderBy: [desc(results.engagementScore)],
        limit: 10,
        columns: {
          title: true,
          platform: true,
          sentiment: true,
          engagementScore: true,
          sourceUrl: true,
        },
      }),
    ]);

    // Build report data
    const reportData: ReportData = {
      totals: {
        mentions: Number(mentionData[0]?.total || 0),
        positive: Number(mentionData[0]?.positive || 0),
        neutral: Number(mentionData[0]?.neutral || 0),
        negative: Number(mentionData[0]?.negative || 0),
      },
      platforms: platformData.map((p) => ({
        platform: p.platform,
        mentions: Number(p.mentions),
        engagement: Number(p.engagement),
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
        engagement: p.engagementScore || 0,
        url: p.sourceUrl,
      })),
      trends: [], // Would require daily aggregation
    };

    // Check which sections are enabled
    const enabledSections = new Set(
      sections.filter((s) => s.enabled).map((s) => s.id)
    );

    // Generate HTML report
    const html = generateHtmlReport(title, branding, reportData, enabledSections, days);

    if (format === "html") {
      return new NextResponse(html, {
        headers: {
          "Content-Type": "text/html",
          "Content-Disposition": `attachment; filename="${title.replace(/[^a-z0-9]/gi, "_")}_report.html"`,
        },
      });
    }

    // For PDF, return HTML that can be printed
    // In production, you'd use a PDF library like @react-pdf/renderer or puppeteer
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html",
      },
    });
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 });
    }
    console.error("Report generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}

function generateHtmlReport(
  title: string,
  branding: ReportConfig["branding"],
  data: ReportData,
  enabledSections: Set<string>,
  days: number
): string {
  const primaryColor = branding.primaryColor || "#6366f1";
  const companyName = branding.companyName || "Your Company";

  const sentimentPercentage = data.totals.mentions > 0
    ? Math.round((data.totals.positive / data.totals.mentions) * 100)
    : 0;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }
    .header {
      border-bottom: 4px solid ${primaryColor};
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 { font-size: 28px; margin-bottom: 5px; }
    .header .meta { color: #6b7280; font-size: 14px; }
    .section { margin-bottom: 30px; }
    .section h2 {
      font-size: 18px;
      color: ${primaryColor};
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 8px;
      margin-bottom: 15px;
    }
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
    }
    .stat-card {
      background: #f9fafb;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-card .value { font-size: 28px; font-weight: bold; color: ${primaryColor}; }
    .stat-card .label { font-size: 12px; color: #6b7280; }
    .bar-chart { margin-top: 10px; }
    .bar-row { display: flex; align-items: center; margin-bottom: 8px; }
    .bar-label { width: 120px; font-size: 14px; }
    .bar-container { flex: 1; background: #e5e7eb; height: 24px; border-radius: 4px; overflow: hidden; }
    .bar-fill { height: 100%; background: ${primaryColor}; display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; }
    .bar-value { color: white; font-size: 12px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; }
    .sentiment-positive { color: #059669; }
    .sentiment-negative { color: #dc2626; }
    .sentiment-neutral { color: #6b7280; }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
    }
    @media print {
      body { padding: 20px; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <div class="meta">
      ${companyName} &bull; Last ${days} days &bull; Generated ${new Date().toLocaleDateString()}
    </div>
  </div>

  ${enabledSections.has("executive_summary") ? `
  <div class="section">
    <h2>Executive Summary</h2>
    <p>
      Over the past ${days} days, you received <strong>${data.totals.mentions.toLocaleString()}</strong> mentions
      across ${data.platforms.length} platforms.
      ${sentimentPercentage >= 60 ? "Sentiment is predominantly positive." :
        sentimentPercentage <= 40 ? "There are sentiment concerns to address." :
        "Sentiment is mixed."}
    </p>
  </div>
  ` : ""}

  ${enabledSections.has("mention_volume") ? `
  <div class="section">
    <h2>Mention Overview</h2>
    <div class="stat-grid">
      <div class="stat-card">
        <div class="value">${data.totals.mentions.toLocaleString()}</div>
        <div class="label">Total Mentions</div>
      </div>
      <div class="stat-card">
        <div class="value sentiment-positive">${data.totals.positive.toLocaleString()}</div>
        <div class="label">Positive</div>
      </div>
      <div class="stat-card">
        <div class="value sentiment-neutral">${data.totals.neutral.toLocaleString()}</div>
        <div class="label">Neutral</div>
      </div>
      <div class="stat-card">
        <div class="value sentiment-negative">${data.totals.negative.toLocaleString()}</div>
        <div class="label">Negative</div>
      </div>
    </div>
  </div>
  ` : ""}

  ${enabledSections.has("sentiment_analysis") ? `
  <div class="section">
    <h2>Sentiment Analysis</h2>
    <div class="bar-chart">
      <div class="bar-row">
        <div class="bar-label">Positive</div>
        <div class="bar-container">
          <div class="bar-fill" style="width: ${Math.round((data.totals.positive / Math.max(data.totals.mentions, 1)) * 100)}%; background: #059669;">
            <span class="bar-value">${data.totals.positive}</span>
          </div>
        </div>
      </div>
      <div class="bar-row">
        <div class="bar-label">Neutral</div>
        <div class="bar-container">
          <div class="bar-fill" style="width: ${Math.round((data.totals.neutral / Math.max(data.totals.mentions, 1)) * 100)}%; background: #6b7280;">
            <span class="bar-value">${data.totals.neutral}</span>
          </div>
        </div>
      </div>
      <div class="bar-row">
        <div class="bar-label">Negative</div>
        <div class="bar-container">
          <div class="bar-fill" style="width: ${Math.round((data.totals.negative / Math.max(data.totals.mentions, 1)) * 100)}%; background: #dc2626;">
            <span class="bar-value">${data.totals.negative}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
  ` : ""}

  ${enabledSections.has("platform_breakdown") ? `
  <div class="section">
    <h2>Platform Breakdown</h2>
    <div class="bar-chart">
      ${data.platforms.map((p) => `
      <div class="bar-row">
        <div class="bar-label">${p.platform}</div>
        <div class="bar-container">
          <div class="bar-fill" style="width: ${Math.round((p.mentions / Math.max(data.totals.mentions, 1)) * 100)}%;">
            <span class="bar-value">${p.mentions}</span>
          </div>
        </div>
      </div>
      `).join("")}
    </div>
  </div>
  ` : ""}

  ${enabledSections.has("category_analysis") && data.categories.length > 0 ? `
  <div class="section">
    <h2>Category Analysis</h2>
    <div class="bar-chart">
      ${data.categories.map((c) => `
      <div class="bar-row">
        <div class="bar-label">${c.category.replace(/_/g, " ")}</div>
        <div class="bar-container">
          <div class="bar-fill" style="width: ${Math.round((c.count / Math.max(data.totals.mentions, 1)) * 100)}%;">
            <span class="bar-value">${c.count}</span>
          </div>
        </div>
      </div>
      `).join("")}
    </div>
  </div>
  ` : ""}

  ${enabledSections.has("top_posts") && data.topPosts.length > 0 ? `
  <div class="section">
    <h2>Top Posts</h2>
    <table>
      <thead>
        <tr>
          <th>Title</th>
          <th>Platform</th>
          <th>Sentiment</th>
          <th>Engagement</th>
        </tr>
      </thead>
      <tbody>
        ${data.topPosts.slice(0, 10).map((p) => `
        <tr>
          <td><a href="${p.url}" target="_blank">${p.title.slice(0, 60)}${p.title.length > 60 ? "..." : ""}</a></td>
          <td>${p.platform}</td>
          <td class="sentiment-${p.sentiment}">${p.sentiment}</td>
          <td>${p.engagement.toLocaleString()}</td>
        </tr>
        `).join("")}
      </tbody>
    </table>
  </div>
  ` : ""}

  <div class="footer">
    Generated with Kaulby &bull; ${new Date().toISOString()}
  </div>
</body>
</html>
  `.trim();
}
