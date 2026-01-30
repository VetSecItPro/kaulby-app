import OpenAI from "openai";
import { observeOpenAI } from "langfuse";
import { langfuse } from "./langfuse";

// Models - ALL Gemini 2.5 Flash for maximum cost efficiency
// Gemini 2.5 Flash is 40-50x cheaper than Claude Sonnet 4 and handles 95%+ of tasks well
// Switching from Claude Sonnet 4 saves ~97% on AI costs ($7/day → $0.20/day)
export const MODELS = {
  // Standard tier - fast and cost-effective
  primary: "google/gemini-2.5-flash",
  // Fallback - same model, retry logic handles transient failures
  fallback: "google/gemini-2.5-flash",
  // Premium tier - ALSO Flash for cost optimization
  // Flash handles comprehensive analysis well for 95%+ of content
  premium: "google/gemini-2.5-flash",
} as const;

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

// AI completion with fallback
export async function completion(params: {
  messages: OpenAI.ChatCompletionMessageParam[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}) {
  const {
    messages,
    model = MODELS.primary,
    temperature = 0.7,
    maxTokens = 1024,
  } = params;

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
      console.warn(`Primary model ${model} failed, trying fallback...`);
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
  const result = await completion({
    ...params,
    temperature: 0.3, // Lower temperature for structured output
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
    throw new Error(`Failed to parse JSON response: ${result.content}`);
  }
}

// Flush Langfuse events (call at end of request)
export async function flushAI() {
  // Only flush if Langfuse is configured
  if (process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY) {
    await langfuse.flushAsync();
  }
}
