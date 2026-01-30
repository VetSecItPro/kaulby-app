import { jsonCompletion } from "../openrouter";
import { buildAnalysisPrompt } from "../prompts";

export type ConversationCategory =
  | "pain_point"
  | "solution_request"
  | "advice_request"
  | "money_talk"
  | "hot_discussion";

interface ConversationCategoryResult {
  category: ConversationCategory;
  confidence: number;
  signals: string[];
  reasoning: string;
}

interface ConversationCategoryMeta {
  model: string;
  cost: number;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
}

/**
 * Categorize a conversation using GummySearch-style categories.
 *
 * Categories:
 * - pain_point: User expressing frustration or problem
 * - solution_request: Actively seeking recommendations (HIGHEST VALUE)
 * - advice_request: Looking for guidance/how-to
 * - money_talk: Budget/pricing discussions
 * - hot_discussion: Trending/viral content
 */
export async function categorizeConversation(
  content: string,
  metadata?: {
    upvotes?: number;
    commentCount?: number;
  }
): Promise<{ result: ConversationCategoryResult; meta: ConversationCategoryMeta }> {
  // Add engagement context for hot_discussion detection
  let contentWithContext = content;
  if (metadata?.upvotes || metadata?.commentCount) {
    contentWithContext = `[Engagement: ${metadata.upvotes || 0} upvotes, ${metadata.commentCount || 0} comments]\n\n${content}`;
  }

  const { system, user } = buildAnalysisPrompt("conversationCategorization", contentWithContext);

  const { data, meta } = await jsonCompletion<ConversationCategoryResult>({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  // Validate the category is one of our valid values
  const validCategories: ConversationCategory[] = [
    "pain_point",
    "solution_request",
    "advice_request",
    "money_talk",
    "hot_discussion"
  ];

  if (!validCategories.includes(data.category)) {
    // Default to advice_request if AI returns invalid category
    data.category = "advice_request";
    data.confidence = 0.3;
  }

  return {
    result: data,
    meta: {
      model: meta.model,
      cost: meta.cost,
      latencyMs: meta.latencyMs,
      promptTokens: meta.promptTokens,
      completionTokens: meta.completionTokens,
    },
  };
}
