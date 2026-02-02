import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, results, monitors } from "@/lib/db";
import { eq, desc, and, inArray, gte } from "drizzle-orm";
import { completion, MODELS, flushAI } from "@/lib/ai/openrouter";
import { getUserPlan } from "@/lib/limits";
import {
  checkAllRateLimits,
  checkTokenBudget,
  sanitizeInput,
  validateInput,
  getCachedAnswer,
  cacheAnswer,
} from "@/lib/ai/rate-limit";

interface AskRequest {
  question: string;
  monitorIds?: string[];
  audienceIds?: string[];
  conversationHistory?: { role: "user" | "assistant"; content: string }[];
}

interface Citation {
  id: string;
  title: string;
  platform: string;
  sourceUrl: string;
  snippet: string;
  monitorName: string;
}

interface SearchResult {
  id: string;
  title: string;
  content: string | null;
  platform: string;
  sourceUrl: string;
  sentiment: string | null;
  conversationCategory: string | null;
  aiSummary: string | null;
  engagementScore: number | null;
  leadScore: number | null;
  postedAt: Date | null;
  monitorId: string;
  monitorName: string;
  companyName: string | null;
  relevanceScore?: number;
}

// Stop words for keyword extraction
const STOP_WORDS = new Set([
  "what", "where", "when", "which", "that", "this", "they", "their", "about",
  "from", "with", "have", "been", "were", "being", "show", "find", "looking",
  "people", "saying", "tell", "give", "want", "need", "could", "would", "should",
  "most", "more", "some", "many", "much", "very", "also", "just", "only",
]);

/**
 * Extract keywords from question
 */
function extractKeywords(question: string): string[] {
  return question
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
}

/**
 * Search for relevant results (optimized)
 */
async function searchRelevantResults(
  userId: string,
  question: string,
  monitorIds?: string[]
): Promise<SearchResult[]> {
  const keywords = extractKeywords(question);
  const lowerQuestion = question.toLowerCase();

  // Get user's monitors with names
  const userMonitors = await db.query.monitors.findMany({
    where: eq(monitors.userId, userId),
    columns: { id: true, name: true, companyName: true },
  });

  const monitorMap = new Map(userMonitors.map((m) => [m.id, { name: m.name, companyName: m.companyName }]));

  const validMonitorIds = monitorIds?.length
    ? monitorIds.filter((id) => userMonitors.some((m) => m.id === id))
    : userMonitors.map((m) => m.id);

  if (validMonitorIds.length === 0) return [];

  // Determine time filter from question
  let daysBack = 30;
  if (lowerQuestion.includes("last 7 days") || lowerQuestion.includes("this week") || lowerQuestion.includes("last week")) {
    daysBack = 7;
  } else if (lowerQuestion.includes("today") || lowerQuestion.includes("24 hours")) {
    daysBack = 1;
  } else if (lowerQuestion.includes("last 90 days") || lowerQuestion.includes("3 months")) {
    daysBack = 90;
  }

  const dateFilter = gte(results.createdAt, new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000));

  // Fetch results (limited columns for efficiency)
  const searchResults = await db.query.results.findMany({
    where: and(
      inArray(results.monitorId, validMonitorIds),
      dateFilter,
      eq(results.isHidden, false)
    ),
    orderBy: [desc(results.engagementScore), desc(results.createdAt)],
    limit: 50,
    columns: {
      id: true,
      title: true,
      content: true,
      platform: true,
      sourceUrl: true,
      sentiment: true,
      conversationCategory: true,
      aiSummary: true,
      engagementScore: true,
      leadScore: true,
      postedAt: true,
      monitorId: true,
    },
  });

  // Score and rank results, adding monitor info
  const scored = searchResults.map((r) => {
    let score = 0;
    const text = `${r.title} ${r.aiSummary || ""}`.toLowerCase();
    const monitorInfo = monitorMap.get(r.monitorId) || { name: "Unknown", companyName: null };

    // Keyword matching (use summary, not full content for efficiency)
    keywords.forEach((kw) => { if (text.includes(kw)) score += 10; });

    // Intent matching
    if (lowerQuestion.includes("solution") && r.conversationCategory === "solution_request") score += 20;
    if (lowerQuestion.includes("pain") && r.conversationCategory === "pain_point") score += 20;
    if (lowerQuestion.includes("pricing") && r.conversationCategory === "money_talk") score += 20;
    if ((lowerQuestion.includes("hot") || lowerQuestion.includes("lead")) && (r.leadScore || 0) > 50) score += 15;
    if (lowerQuestion.includes("negative") && r.sentiment === "negative") score += 15;
    if (lowerQuestion.includes("positive") && r.sentiment === "positive") score += 15;
    if (r.engagementScore && r.engagementScore > 50) score += 5;

    return {
      ...r,
      monitorName: monitorInfo.name,
      companyName: monitorInfo.companyName,
      relevanceScore: score,
    };
  });

  return scored.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0)).slice(0, 15);
}

/**
 * Format results context with monitor names for actionable insights
 */
function formatResultsContext(results: SearchResult[]): string {
  if (results.length === 0) return "No relevant results found.";

  return results.map((r, i) => {
    // Use aiSummary if available, otherwise truncate content
    const summary = r.aiSummary || (r.content ? r.content.slice(0, 150) + "..." : "");
    // Include monitor/brand name prominently
    const brandLabel = r.companyName || r.monitorName;
    const meta = [
      r.sentiment,
      r.conversationCategory?.replace(/_/g, " "),
      r.leadScore && r.leadScore > 50 ? `lead score: ${r.leadScore}` : null,
    ].filter(Boolean).join(", ");

    return `[${i + 1}] MONITOR: "${brandLabel}" | PLATFORM: ${r.platform}${meta ? ` | ${meta}` : ""}
TITLE: "${r.title}"
SUMMARY: ${summary}`;
  }).join("\n\n");
}

// Conversational system prompt with actionable focus
const SYSTEM_PROMPT = `You are Kaulby AI, a helpful assistant that analyzes the user's social listening data.

CRITICAL RULES:
1. ALWAYS mention which monitor/brand each insight comes from. The user may have multiple monitors.
2. ALWAYS cite sources as [1], [2], etc. linking to specific mentions.
3. Be conversational and actionable - this is a chat, not a report.
4. When summarizing complaints or feedback, specify: "For [Monitor Name], customers on [Platform] are saying..."
5. If lead score > 70, call it out as a "hot lead" worth responding to.
6. Keep responses focused and scannable - use bullet points for multiple items.
7. If no relevant data exists, say so clearly.

FORMAT EXAMPLE:
"Looking at your monitors, here's what I found:

**For Dunkin** (from Google Reviews):
- Multiple customers complaining about slow service [1][3]
- One hot lead asking about franchise opportunities [2]

**For Starbucks** (from Reddit):
- Discussion about new seasonal drinks getting mixed reviews [4]"

Results from user's monitors:`;

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user plan
    const plan = await getUserPlan(userId);
    if (plan !== "pro" && plan !== "enterprise") {
      return NextResponse.json(
        { error: "This feature requires a Pro subscription" },
        { status: 403 }
      );
    }

    // Rate limiting
    const rateLimitCheck = await checkAllRateLimits(userId, plan);
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        { error: rateLimitCheck.reason },
        {
          status: 429,
          headers: rateLimitCheck.retryAfter
            ? { "Retry-After": String(rateLimitCheck.retryAfter) }
            : undefined,
        }
      );
    }

    // Token budget check
    const budgetCheck = await checkTokenBudget(userId, plan);
    if (!budgetCheck.allowed) {
      return NextResponse.json(
        {
          error: `Daily token budget exceeded (${budgetCheck.used.toLocaleString()}/${budgetCheck.limit.toLocaleString()} tokens). Resets at midnight.`,
        },
        { status: 429 }
      );
    }

    const body: AskRequest = await req.json();
    const { monitorIds, conversationHistory = [] } = body;

    // Input validation
    const inputValidation = validateInput(body.question || "");
    if (!inputValidation.valid) {
      return NextResponse.json({ error: inputValidation.reason }, { status: 400 });
    }

    // Sanitize input
    const question = sanitizeInput(body.question, 500);

    // Check cache for repeated questions
    const cached = getCachedAnswer(userId, question);
    if (cached) {
      return NextResponse.json({
        answer: cached.answer,
        citations: cached.citations,
        meta: { model: "cache", resultsSearched: 0, cached: true },
      });
    }

    // Search relevant results
    const relevantResults = await searchRelevantResults(userId, question, monitorIds);
    const resultsContext = formatResultsContext(relevantResults);

    // Build messages (limited conversation history for token efficiency)
    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: `${SYSTEM_PROMPT}\n\n${resultsContext}` },
    ];

    // Add last 4 messages only (not 6)
    conversationHistory.slice(-4).forEach((msg) => {
      messages.push({ role: msg.role, content: sanitizeInput(msg.content, 300) });
    });

    messages.push({ role: "user", content: question });

    // Generate AI response (use primary model for cost efficiency, premium for enterprise)
    const response = await completion({
      messages,
      model: plan === "enterprise" ? MODELS.premium : MODELS.primary,
      maxTokens: 512, // Reduced from 1024 for cost control
      temperature: 0.5, // Lower temperature for more focused responses
    });

    await flushAI();

    // Extract citations with monitor names
    const citedNumbers = response.content.match(/\[(\d+)\]/g) || [];
    const citedIndices = Array.from(new Set(citedNumbers.map((n) => parseInt(n.slice(1, -1)) - 1)));

    const citations: Citation[] = citedIndices
      .filter((i) => i >= 0 && i < relevantResults.length)
      .slice(0, 5) // Limit citations
      .map((i) => {
        const r = relevantResults[i];
        return {
          id: r.id,
          title: r.title,
          platform: r.platform,
          sourceUrl: r.sourceUrl,
          snippet: r.aiSummary?.slice(0, 80) || r.title,
          monitorName: r.companyName || r.monitorName,
        };
      });

    // Cache the response
    cacheAnswer(userId, question, response.content, citations);

    return NextResponse.json({
      answer: response.content,
      citations,
      meta: {
        model: response.model,
        resultsSearched: relevantResults.length,
        tokensUsed: response.promptTokens + response.completionTokens,
        budgetRemaining: budgetCheck.remaining - (response.promptTokens + response.completionTokens),
      },
    });
  } catch (error) {
    console.error("AI Ask error:", error);
    return NextResponse.json(
      { error: "Failed to process your question" },
      { status: 500 }
    );
  }
}
