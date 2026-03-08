import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { MODELS, completionWithTools, flushAI } from "@/lib/ai/openrouter";
import { logAiCall } from "@/lib/ai/log";
import { getUserPlan } from "@/lib/limits";
import {
  checkAllRateLimits,
  checkTokenBudget,
  sanitizeInput,
  validateInput,
  getCachedAnswer,
  cacheAnswer,
} from "@/lib/ai/rate-limit";
import { AI_TOOLS, TOOL_METADATA, executeTool, type ToolResult } from "@/lib/ai/tools";
import type OpenAI from "openai";

export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AskRequest {
  question: string;
  monitorIds?: string[];
  audienceIds?: string[];
  conversationHistory?: { role: "user" | "assistant"; content: string }[];
  pendingConfirmation?: {
    toolCallId: string;
    toolName: string;
    confirmed: boolean;
    params?: Record<string, unknown>;
  };
}

interface Citation {
  id: string;
  title: string;
  platform: string;
  sourceUrl: string;
  snippet: string;
  monitorName: string;
}

// ---------------------------------------------------------------------------
// System prompt — agentic with tools
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are Kaulby AI, an intelligent assistant for social listening and community monitoring.

You have access to tools to query the user's monitoring data, analyze trends, and perform actions like creating or managing monitors.

RULES:
1. ALWAYS use tools to fetch data before answering. Never guess or fabricate data.
2. When the user asks about their data, call search_results, get_insights_summary, or get_aggregations first.
3. Cite specific results using [1], [2] notation referencing the "index" field from search_results.
4. Be conversational, concise, and actionable.
5. When summarizing, mention which monitor/brand and platform each insight comes from.
6. If lead score > 70, flag it as a "hot lead" worth responding to.
7. For destructive actions (create/update/delete monitors), explain what you'll do before calling the tool.
8. If no relevant data exists, say so clearly.
9. Use bullet points for multiple items — keep responses scannable.
10. When the user asks "what can you do" or similar, briefly list your capabilities.

CAPABILITIES:
- Search and filter results across all monitors (by platform, sentiment, category, date, lead score)
- View monitor details, subscription info, saved results, audiences, alerts
- Analyze sentiment trends, find high-intent leads, compare monitors
- Create, update, pause, resume, or delete monitors
- Trigger on-demand scans
- Bookmark, hide, or mark results as viewed

REMEMBER: You are Kaulby AI, not a general-purpose assistant. Stay focused on the user's monitoring data and community intelligence.`;

// ---------------------------------------------------------------------------
// Max tool iterations
// ---------------------------------------------------------------------------

const MAX_TOOL_ITERATIONS = 6;

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Plan check
    const plan = await getUserPlan(userId);
    if (plan !== "pro" && plan !== "team") {
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
    const { conversationHistory = [] } = body;

    // Handle pending confirmation
    if (body.pendingConfirmation) {
      return handleConfirmation(userId, body.pendingConfirmation, plan, budgetCheck.remaining);
    }

    // Input validation
    const inputValidation = validateInput(body.question || "");
    if (!inputValidation.valid) {
      return NextResponse.json({ error: inputValidation.reason }, { status: 400 });
    }

    const question = sanitizeInput(body.question, 500);

    // Check cache
    const cached = getCachedAnswer(userId, question);
    if (cached) {
      return NextResponse.json({
        answer: cached.answer,
        citations: cached.citations,
        meta: { model: "cache", resultsSearched: 0, cached: true, tokensUsed: 0, iterations: 0 },
      });
    }

    // Build message history
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // Add last 4 conversation messages
    conversationHistory.slice(-4).forEach((msg) => {
      messages.push({ role: msg.role, content: sanitizeInput(msg.content, 300) });
    });

    messages.push({ role: "user", content: question });

    // ── Tool calling loop ──────────────────────────────────────────────
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalCost = 0;
    let totalLatency = 0;
    let iterations = 0;
    const toolsUsed: { name: string; label: string }[] = [];
    let finalContent = "";
    let usedModel: string = MODELS.primary;

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      iterations++;

      // Check if we're running low on budget
      const tokensLeft = budgetCheck.remaining - (totalPromptTokens + totalCompletionTokens);
      const useTools = tokensLeft > 5000; // Need headroom for tool responses

      const response = await completionWithTools({
        messages,
        tools: useTools ? AI_TOOLS : undefined,
        model: plan === "team" ? MODELS.premium : MODELS.primary,
        maxTokens: 1024,
        temperature: 0.5,
      });

      totalPromptTokens += response.promptTokens;
      totalCompletionTokens += response.completionTokens;
      totalCost += response.cost;
      totalLatency += response.latencyMs;
      usedModel = response.model;

      const msg = response.message;

      // No tool calls — this is the final answer
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        finalContent = msg.content || "";
        break;
      }

      // Model wants to call tools — execute them
      // Add assistant message with tool calls to the conversation
      messages.push(msg as OpenAI.ChatCompletionMessageParam);

      for (const toolCall of msg.tool_calls) {
        // Only handle function tool calls (skip custom tool calls)
        if (toolCall.type !== "function") continue;
        const toolName = toolCall.function.name;
        const meta = TOOL_METADATA[toolName];

        // Parse arguments
        let toolParams: Record<string, unknown> = {};
        try {
          toolParams = JSON.parse(toolCall.function.arguments || "{}");
        } catch {
          toolParams = {};
        }

        // Check if tool requires confirmation
        if (meta?.category === "dangerous_write") {
          // Return a pending confirmation response
          return NextResponse.json({
            answer: meta.confirmationMessage || `I need your confirmation to run: ${toolName}`,
            citations: [],
            toolsUsed,
            pendingConfirmation: {
              toolCallId: toolCall.id,
              toolName,
              message: meta.confirmationMessage || `Confirm action: ${toolName}?`,
              params: toolParams,
              // Send conversation state so we can resume
              conversationState: messages.map((m) => {
                if (typeof m === "object" && "role" in m) {
                  return { role: m.role, content: "content" in m ? m.content : "" };
                }
                return m;
              }),
            },
            meta: {
              model: usedModel,
              tokensUsed: totalPromptTokens + totalCompletionTokens,
              budgetRemaining: budgetCheck.remaining - (totalPromptTokens + totalCompletionTokens),
              iterations,
            },
          });
        }

        // Execute the tool
        const result: ToolResult = await executeTool(toolName, toolParams, userId);

        if (meta) {
          toolsUsed.push({ name: toolName, label: meta.label });
        }

        // Add tool result to messages
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result.success ? result.data : { error: result.error }),
        } as OpenAI.ChatCompletionMessageParam);
      }
    }

    await flushAI();

    // Log AI cost
    await logAiCall({
      userId,
      model: usedModel,
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      costUsd: totalCost,
      latencyMs: totalLatency,
      analysisType: "ask",
    });

    // Extract citations from the final response
    const citations = extractCitations(finalContent, messages);

    // Cache the response
    cacheAnswer(userId, question, finalContent, citations);

    return NextResponse.json({
      answer: finalContent,
      citations,
      toolsUsed,
      meta: {
        model: usedModel,
        tokensUsed: totalPromptTokens + totalCompletionTokens,
        budgetRemaining: budgetCheck.remaining - (totalPromptTokens + totalCompletionTokens),
        iterations,
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

// ---------------------------------------------------------------------------
// Handle confirmation of dangerous write tools
// ---------------------------------------------------------------------------

async function handleConfirmation(
  userId: string,
  confirmation: NonNullable<AskRequest["pendingConfirmation"]>,
  plan: "free" | "pro" | "team",
  budgetRemaining: number
) {
  if (!confirmation.confirmed) {
    return NextResponse.json({
      answer: "No problem — I've cancelled that action.",
      citations: [],
      toolsUsed: [],
      meta: { model: "none", tokensUsed: 0, budgetRemaining, iterations: 0 },
    });
  }

  // Execute the confirmed tool
  const result = await executeTool(confirmation.toolName, confirmation.params || {}, userId);
  const meta = TOOL_METADATA[confirmation.toolName];

  if (!result.success) {
    return NextResponse.json({
      answer: `I couldn't complete that action: ${result.error}`,
      citations: [],
      toolsUsed: [{ name: confirmation.toolName, label: meta?.label || confirmation.toolName }],
      meta: { model: "none", tokensUsed: 0, budgetRemaining, iterations: 0 },
    });
  }

  // Generate a follow-up response using the tool result
  const response = await completionWithTools({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `The user confirmed the action. Here is the result:\n${JSON.stringify(result.data)}` },
      { role: "user", content: "Summarize what was done in 1-2 sentences. Be conversational." },
    ],
    model: plan === "team" ? MODELS.premium : MODELS.primary,
    maxTokens: 256,
    temperature: 0.5,
  });

  await flushAI();

  await logAiCall({
    userId,
    model: response.model,
    promptTokens: response.promptTokens,
    completionTokens: response.completionTokens,
    costUsd: response.cost,
    latencyMs: response.latencyMs,
    analysisType: "ask",
  });

  return NextResponse.json({
    answer: response.message.content || "Done! The action was completed successfully.",
    citations: [],
    toolsUsed: [{ name: confirmation.toolName, label: meta?.label || confirmation.toolName }],
    meta: {
      model: response.model,
      tokensUsed: response.promptTokens + response.completionTokens,
      budgetRemaining: budgetRemaining - (response.promptTokens + response.completionTokens),
      iterations: 1,
    },
  });
}

// ---------------------------------------------------------------------------
// Extract citations from tool call results in the message history
// ---------------------------------------------------------------------------

function extractCitations(
  answer: string,
  messages: OpenAI.ChatCompletionMessageParam[]
): Citation[] {
  // Find cited numbers in the answer [1], [2], etc.
  const citedNumbers = answer.match(/\[(\d+)\]/g) || [];
  const citedIndices = Array.from(new Set(citedNumbers.map((n) => parseInt(n.slice(1, -1)))));

  if (citedIndices.length === 0) return [];

  // Find search_results tool responses in messages to extract citations
  const allResults: Array<{
    index: number;
    id: string;
    title: string;
    platform: string;
    sourceUrl: string;
    summary: string | null;
    monitorName: string;
  }> = [];

  for (const msg of messages) {
    if ("role" in msg && msg.role === "tool" && "content" in msg && typeof msg.content === "string") {
      try {
        const data = JSON.parse(msg.content);
        if (data?.results && Array.isArray(data.results)) {
          allResults.push(...data.results);
        }
      } catch {
        // Not JSON or not results
      }
    }
  }

  return citedIndices
    .filter((idx) => {
      const r = allResults.find((r) => r.index === idx);
      return !!r;
    })
    .slice(0, 8)
    .map((idx) => {
      const r = allResults.find((r) => r.index === idx)!;
      return {
        id: r.id,
        title: r.title,
        platform: r.platform,
        sourceUrl: r.sourceUrl,
        snippet: r.summary?.slice(0, 80) || r.title,
        monitorName: r.monitorName,
      };
    });
}
