import OpenAI from "openai";
import { logger } from "@/lib/logger";
import { observeOpenAI } from "langfuse";
import { langfuse } from "./langfuse";

// Models — tiered routing per COA 4 W1.6.
//
// Post-2026-04-22 revert: MODELS.team currently points at Gemini 2.5 Flash
// (the same model as MODELS.primary). Reason: routing Team tier to Claude
// Sonnet 4.5 made the unit economics unworkable — at ~$0.013/call × ~500
// results/day per Team user the AI cost exceeded the $3.30/day revenue
// share. See scripts/eval-shootout.ts for the cross-model comparison that
// will pick the actual production Team-tier model.
//
// Plumbing is preserved intentionally: analyze-content.ts, /ai/ask, and
// weekly-insights-helper.ts all still route via MODELS.team. When the
// shootout picks a winner, flip this one constant and the routing wakes up.
//
// MODELS.teamCandidate is the currently-paused Sonnet 4.5 id, kept here as
// documentation of the intended upgrade target and so the shootout script
// can reference it without hard-coding strings.
export const MODELS = {
  // Standard tier (Free + Pro) — cost-optimized.
  primary: "google/gemini-2.5-flash",
  // Fallback used by both tiers when primary fails.
  fallback: "google/gemini-2.5-flash",
  // Team tier — TEMPORARILY Flash pending shootout-winner selection.
  // To re-enable Sonnet 4.5: change this to MODELS.teamCandidate.
  team: "google/gemini-2.5-flash",
  // Paused upgrade target. Not used in production routing today.
  teamCandidate: "anthropic/claude-sonnet-4-5",
  // @deprecated — retained for backwards compat.
  premium: "google/gemini-2.5-flash",
} as const;

// Plan tier → model routing. Callers pass the user's plan; get back the model ID
// to pass to OpenRouter. Unknown/free plans fall back to Flash.
export type PlanTier = "free" | "pro" | "team";

export function getModelForTier(plan: PlanTier | string): string {
  if (plan === "team") return MODELS.team;
  // Free + Pro + anything unknown → Flash.
  return MODELS.primary;
}

// Lazy-initialized OpenRouter client to avoid build-time errors
let _openrouter: OpenAI | ReturnType<typeof observeOpenAI> | null = null;

function getOpenRouter(): OpenAI {
  if (!_openrouter) {
    const openrouterClient = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY || "placeholder-for-build",
      defaultHeaders: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Kaulby",
      },
    });

    // Only wrap with Langfuse if keys are available
    if (process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY) {
      _openrouter = observeOpenAI(openrouterClient, {
        clientInitParams: {
          publicKey: process.env.LANGFUSE_PUBLIC_KEY,
          secretKey: process.env.LANGFUSE_SECRET_KEY,
          baseUrl: process.env.LANGFUSE_HOST || "https://cloud.langfuse.com",
        },
      });
    } else {
      // Use client without observability during build or when keys are missing
      _openrouter = openrouterClient;
    }
  }
  return _openrouter as OpenAI;
}

// Model pricing (per 1M tokens) - for cost tracking
// Using ONLY Gemini 2.5 Flash for maximum cost savings
// Flash costs: $0.075 input, $0.30 output = 40-50x cheaper than Claude
const MODEL_PRICING = {
  // Primary model - used for ALL tiers
  "google/gemini-2.5-flash": {
    input: 0.075,
    output: 0.3,
  },
  // Legacy models - kept for historical cost tracking of old AI calls
  "google/gemini-2.5-pro-preview-05-06": {
    input: 1.25,
    output: 5.0,
  },
  "openai/gpt-4o-mini": {
    input: 0.15,
    output: 0.6,
  },
  "anthropic/claude-sonnet-4": {
    input: 3.0,
    output: 15.0,
  },
  "anthropic/claude-sonnet-4-5": {
    input: 3.0,
    output: 15.0,
  },
  // Added 2026-04-23 after shootout surfaced missing entries — see
  // .mdmp/SHOOTOUT_RESULTS_2026-04-23.md. Without these, calculateCost()
  // silently returned 0 for Haiku + Pro runs, making cost comparisons useless.
  "anthropic/claude-haiku-4-5": {
    input: 1.0,
    output: 5.0,
  },
  "google/gemini-2.5-pro": {
    input: 1.25,
    output: 5.0,
  },
} as const;

// Calculate cost
export function calculateCost(
  model: keyof typeof MODEL_PRICING,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;

  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;

  return inputCost + outputCost;
}

/**
 * When set, OPENROUTER_MODEL_OVERRIDE forces every completion call to use the
 * named model regardless of what the caller passed in. Used by
 * scripts/eval-shootout.ts to pin all analyzers to a single candidate model
 * per round. DO NOT set this in production — it defeats tier routing.
 */
function resolveModel(requested: string): string {
  return process.env.OPENROUTER_MODEL_OVERRIDE?.trim() || requested;
}

// AI completion with fallback
export async function completion(params: {
  messages: OpenAI.ChatCompletionMessageParam[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}) {
  const {
    messages,
    model: requestedModel = MODELS.primary,
    temperature = 0.7,
    maxTokens = 1024,
  } = params;
  const model = resolveModel(requestedModel);

  const startTime = Date.now();

  try {
    // Try primary model
    const response = await getOpenRouter().chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    });

    const latencyMs = Date.now() - startTime;
    const usage = response.usage;

    return {
      content: response.choices[0]?.message?.content || "",
      model,
      promptTokens: usage?.prompt_tokens || 0,
      completionTokens: usage?.completion_tokens || 0,
      latencyMs,
      cost: calculateCost(
        model as keyof typeof MODEL_PRICING,
        usage?.prompt_tokens || 0,
        usage?.completion_tokens || 0
      ),
    };
  } catch (error) {
    // If primary fails, try fallback
    if (model === MODELS.primary) {
      logger.warn("Primary model failed, trying fallback", { model });
      return completion({
        ...params,
        model: MODELS.fallback,
      });
    }
    throw error;
  }
}

// Structured JSON completion
export async function jsonCompletion<T>(params: {
  messages: OpenAI.ChatCompletionMessageParam[];
  model?: string;
}): Promise<{ data: T; meta: Omit<Awaited<ReturnType<typeof completion>>, "content"> }> {
  // 2026-04-23 shootout found Gemini 2.5 Pro had 45/90 errors (50% failure
  // rate) on JSON analyzer calls — root cause was Pro's verbose reasoning
  // truncating at the default 1024-token ceiling mid-JSON. Bumping to 2048
  // for JSON paths; plain `completion()` keeps 1024 since it's used for
  // shorter prose responses. Cost impact at Flash rates: +$0.0003/call
  // worst-case, negligible.
  const result = await completion({
    ...params,
    temperature: 0.3, // Lower temperature for structured output
    maxTokens: 2048,
  });

  try {
    // Try to parse JSON from the response
    const jsonMatch = result.content.match(/```json\n?([\s\S]*?)\n?```/) ||
                      result.content.match(/\{[\s\S]*\}/);

    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : result.content;
    const data = JSON.parse(jsonStr) as T;

    return {
      data,
      meta: {
        model: result.model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        latencyMs: result.latencyMs,
        cost: result.cost,
      },
    };
  } catch {
    // SECURITY: Don't leak raw AI response content in error messages
    throw new Error("Failed to parse JSON response from AI model");
  }
}

// AI completion with tool calling support
export async function completionWithTools(params: {
  messages: OpenAI.ChatCompletionMessageParam[];
  tools?: OpenAI.ChatCompletionTool[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}) {
  const {
    messages,
    tools,
    model: requestedModel = MODELS.primary,
    temperature = 0.5,
    maxTokens = 1024,
  } = params;
  const model = resolveModel(requestedModel);

  const startTime = Date.now();

  try {
    const response = await getOpenRouter().chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      ...(tools && tools.length > 0 ? { tools, tool_choice: "auto" as const } : {}),
    });

    const latencyMs = Date.now() - startTime;
    const usage = response.usage;
    const message = response.choices[0]?.message;

    return {
      message: message || { role: "assistant" as const, content: "" },
      model,
      promptTokens: usage?.prompt_tokens || 0,
      completionTokens: usage?.completion_tokens || 0,
      latencyMs,
      cost: calculateCost(
        model as keyof typeof MODEL_PRICING,
        usage?.prompt_tokens || 0,
        usage?.completion_tokens || 0
      ),
    };
  } catch (error) {
    // If primary fails, try fallback without tools (tools may be the issue)
    if (model === MODELS.primary) {
      logger.warn("Primary model with tools failed, trying fallback", { model });
      return completionWithTools({
        ...params,
        model: MODELS.fallback,
      });
    }
    throw error;
  }
}

// Flush Langfuse events (call at end of request)
export async function flushAI() {
  // Only flush if Langfuse is configured
  if (process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY) {
    await langfuse.flushAsync();
  }
}
