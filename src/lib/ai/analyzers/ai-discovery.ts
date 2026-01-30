/**
 * AI Discovery Analyzer
 *
 * Performs semantic content matching for AI Discovery monitors.
 * Instead of keyword matching, this uses natural language understanding
 * to find content that matches the user's discovery intent.
 */

import { jsonCompletion, MODELS } from "../openrouter";
import { SYSTEM_PROMPTS } from "../prompts";

interface AIDiscoveryResult {
  isMatch: boolean;
  relevanceScore: number;
  matchType: "direct" | "semantic" | "contextual" | "none";
  reasoning: string;
  signals: string[];
  suggestedKeywords: string[];
}

interface AIDiscoveryMeta {
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  cost: number;
}

/**
 * Check if content matches the user's AI discovery intent.
 *
 * @param content - The content to evaluate (title + body)
 * @param discoveryPrompt - The user's natural language description of what they want to find
 * @param companyName - Optional company name for additional context
 * @returns Whether the content matches and detailed analysis
 */
export async function checkAIDiscoveryMatch(
  content: { title: string; body?: string; author?: string; platform?: string },
  discoveryPrompt: string,
  companyName?: string | null
): Promise<{ result: AIDiscoveryResult; meta: AIDiscoveryMeta }> {
  // Limit content to prevent overly long prompts
  const truncatedBody = (content.body || "").slice(0, 1500);

  const contextInfo = companyName
    ? `Company/Brand being monitored: ${companyName}\n\n`
    : "";

  const userMessage = `${contextInfo}DISCOVERY INTENT: ${discoveryPrompt}

CONTENT TO EVALUATE:
Platform: ${content.platform || "unknown"}
Author: ${content.author || "unknown"}
Title: ${content.title}
Body: ${truncatedBody || "(no body)"}

Does this content match the discovery intent? Analyze and respond with JSON.`;

  const response = await jsonCompletion<AIDiscoveryResult>({
    messages: [
      { role: "system", content: SYSTEM_PROMPTS.aiDiscovery },
      { role: "user", content: userMessage },
    ],
    model: MODELS.primary,
  });

  return {
    result: response.data,
    meta: response.meta,
  };
}

