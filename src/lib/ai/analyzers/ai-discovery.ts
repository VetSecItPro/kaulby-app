/**
 * AI Discovery Analyzer
 *
 * Performs semantic content matching for AI Discovery monitors.
 * Instead of keyword matching, this uses natural language understanding
 * to find content that matches the user's discovery intent.
 */

import { jsonCompletion, MODELS } from "../openrouter";
import { SYSTEM_PROMPTS } from "../prompts";

export interface AIDiscoveryResult {
  isMatch: boolean;
  relevanceScore: number;
  matchType: "direct" | "semantic" | "contextual" | "none";
  reasoning: string;
  signals: string[];
  suggestedKeywords: string[];
}

export interface AIDiscoveryMeta {
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

/**
 * Batch check multiple content items against AI discovery intent.
 * More efficient for processing multiple items at once.
 *
 * @param contents - Array of content items to evaluate
 * @param discoveryPrompt - The user's natural language description
 * @param companyName - Optional company name
 * @returns Array of results matching the input order
 */
export async function batchCheckAIDiscoveryMatch(
  contents: Array<{ title: string; body?: string; author?: string; platform?: string }>,
  discoveryPrompt: string,
  companyName?: string | null
): Promise<Array<{ result: AIDiscoveryResult; meta: AIDiscoveryMeta }>> {
  // Process in parallel with concurrency limit to avoid rate limits
  const CONCURRENCY = 5;
  const results: Array<{ result: AIDiscoveryResult; meta: AIDiscoveryMeta }> = [];

  for (let i = 0; i < contents.length; i += CONCURRENCY) {
    const batch = contents.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((content) => checkAIDiscoveryMatch(content, discoveryPrompt, companyName))
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Quick check using a lightweight prompt for high-volume processing.
 * Less accurate but much cheaper for initial filtering.
 *
 * @param content - The content to evaluate
 * @param discoveryPrompt - The user's discovery intent
 * @returns Simple match/no-match result
 */
export async function quickAIDiscoveryCheck(
  content: { title: string; body?: string },
  discoveryPrompt: string
): Promise<{ isMatch: boolean; confidence: number }> {
  const contentText = `${content.title} ${content.body || ""}`.slice(0, 500);

  const response = await jsonCompletion<{ match: boolean; c: number }>({
    messages: [
      {
        role: "system",
        content: `Match content to intent? JSON: {"match":true/false,"c":<0-1 confidence>}`,
      },
      {
        role: "user",
        content: `Intent: ${discoveryPrompt.slice(0, 200)}\nContent: ${contentText}`,
      },
    ],
    model: MODELS.primary,
  });

  return {
    isMatch: response.data.match,
    confidence: response.data.c,
  };
}
