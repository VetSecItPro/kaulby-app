import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { jsonCompletion, MODELS, flushAI } from "@/lib/ai/openrouter";
import { getUserPlan } from "@/lib/limits";
import {
  checkAllRateLimits,
  checkTokenBudget,
  sanitizeInput,
  validateInput,
} from "@/lib/ai/rate-limit";

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
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check Pro access
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

    const platformGuide = PLATFORM_GUIDELINES[platform.toLowerCase()] || PLATFORM_GUIDELINES.default;

    // Optimized compact prompt
    const systemPrompt = `Generate 3 reply suggestions for a social media post. Each reply should be helpful, authentic, and NOT promotional.

Platform: ${platform}
Guidelines: ${platformGuide}
${cleanProductContext ? `Product context (use sparingly): ${cleanProductContext}` : ""}

Rules:
- 2-3 sentences max per reply
- Add genuine value, don't sell
- Match platform tone
- Be human, not corporate`;

    const userPrompt = `POST: "${cleanTitle}"
${cleanContent ? `CONTENT: ${cleanContent}` : ""}
${conversationCategory ? `TYPE: ${conversationCategory.replace(/_/g, " ")}` : ""}

Return JSON: {"suggestions": [{"text": "...", "tone": "helpful|professional|casual", "confidence": 0.0-1.0}]}`;

    const result = await jsonCompletion<SuggestReplyResponse>({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model: MODELS.primary, // Always use cost-efficient model for suggestions
    });

    await flushAI();

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
    console.error("Suggest reply error:", error);
    return NextResponse.json(
      { error: "Failed to generate reply suggestions" },
      { status: 500 }
    );
  }
}
