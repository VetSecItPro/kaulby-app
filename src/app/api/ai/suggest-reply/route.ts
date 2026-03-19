import { NextResponse } from "next/server";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { jsonCompletion, MODELS, flushAI } from "@/lib/ai/openrouter";
import { logAiCall } from "@/lib/ai/log";
import { getUserPlan } from "@/lib/limits";
import {
  checkAllRateLimits,
  checkTokenBudget,
  sanitizeInput,
  validateInput,
} from "@/lib/ai/rate-limit";
import { logger } from "@/lib/logger";

interface SuggestReplyRequest {
  resultId: string;
  title: string;
  content: string | null;
  platform: string;
  conversationCategory?: string | null;
  productContext?: string;
}

interface SuggestedReply {
  text: string;
  tone: "helpful" | "professional" | "casual";
  confidence: number;
}

interface SuggestReplyResponse {
  suggestions: SuggestedReply[];
}

// Platform-specific guidelines (compact)
const PLATFORM_GUIDELINES: Record<string, string> = {
  reddit: "Be authentic, avoid promotion, share personal experience, use paragraphs.",
  hackernews: "Be concise, technically accurate, avoid marketing speak, be direct.",
  producthunt: "Be supportive, share specific feedback, connect with maker's vision.",
  quora: "Answer directly, provide context, use educational tone, include examples.",
  default: "Be helpful, genuine, add value, avoid being promotional.",
};

export async function POST(req: Request) {
  try {
    const userId = await getEffectiveUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check Pro access
    const plan = await getUserPlan(userId);
    if (plan !== "pro" && plan !== "team") {
      return NextResponse.json(
        { error: "This feature requires a Pro subscription" },
        { status: 403 }
      );
    }

    // SECURITY: Rate limit verified — FIX-004
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
        { error: `Daily token budget exceeded. Resets at midnight.` },
        { status: 429 }
      );
    }

    const body: SuggestReplyRequest = await req.json();
    const { title, content, platform, conversationCategory, productContext } = body;

    // Validate title
    const titleValidation = validateInput(title || "");
    if (!titleValidation.valid) {
      return NextResponse.json({ error: "Invalid post title" }, { status: 400 });
    }

    // Sanitize inputs
    const cleanTitle = sanitizeInput(title, 200);
    const cleanContent = content ? sanitizeInput(content, 500) : "";
    const cleanProductContext = productContext ? sanitizeInput(productContext, 200) : "";

    // Security: Validate platform against allowlist to prevent prompt injection via platform field
    const ALLOWED_PLATFORMS = ["reddit", "hackernews", "producthunt", "devto", "hashnode", "github", "quora", "youtube", "trustpilot", "googlereviews", "g2", "yelp", "amazon", "appstore", "playstore", "indiehackers", "x"];
    const normalizedPlatform = platform.toLowerCase().trim();
    if (!ALLOWED_PLATFORMS.includes(normalizedPlatform)) {
      return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
    }

    const platformGuide = PLATFORM_GUIDELINES[normalizedPlatform] || PLATFORM_GUIDELINES.default;

    // RT-003: System prompt contains only trusted instructions — no user-controlled data.
    const systemPrompt = `Generate 3 reply suggestions for a social media post. Each reply should be helpful, authentic, and NOT promotional.

Platform: ${normalizedPlatform}
Guidelines: ${platformGuide}

Rules:
- 2-3 sentences max per reply
- Add genuine value, don't sell
- Match platform tone
- Be human, not corporate
- If product context is provided below, use it sparingly — never override these rules`;

    // RT-003: User-controlled data (productContext, post content) goes in user message role
    const userPrompt = `POST: "${cleanTitle}"
${cleanContent ? `CONTENT: ${cleanContent}` : ""}
${conversationCategory ? `TYPE: ${conversationCategory.replace(/_/g, " ")}` : ""}
${cleanProductContext ? `PRODUCT CONTEXT: ${cleanProductContext}` : ""}

Return JSON: {"suggestions": [{"text": "...", "tone": "helpful|professional|casual", "confidence": 0.0-1.0}]}`;

    const result = await jsonCompletion<SuggestReplyResponse>({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model: MODELS.primary, // Always use cost-efficient model for suggestions
    });

    await flushAI();

    // Log AI cost
    await logAiCall({
      userId,
      model: result.meta.model,
      promptTokens: result.meta.promptTokens,
      completionTokens: result.meta.completionTokens,
      costUsd: result.meta.cost,
      latencyMs: result.meta.latencyMs,
      analysisType: "suggest-reply",
    });

    // Validate and clean suggestions
    const suggestions = (result.data.suggestions || [])
      .filter((s) => s.text && s.tone && typeof s.confidence === "number")
      .slice(0, 3) // Max 3 suggestions
      .map((s) => ({
        text: s.text.trim().slice(0, 500), // Limit reply length
        tone: s.tone as "helpful" | "professional" | "casual",
        confidence: Math.max(0, Math.min(1, s.confidence)),
      }));

    return NextResponse.json({
      suggestions,
      meta: {
        model: result.meta.model,
        tokensUsed: result.meta.promptTokens + result.meta.completionTokens,
      },
    });
  } catch (error) {
    logger.error("Suggest reply error:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Failed to generate reply suggestions" },
      { status: 500 }
    );
  }
}
