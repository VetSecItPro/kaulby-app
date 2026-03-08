/**
 * AI Visibility Checker
 *
 * Queries AI models to determine whether a brand is mentioned in AI-generated
 * responses to relevant industry queries. Tracks position (primary recommendation
 * vs secondary mention) and identifies competitors.
 */

import { completion, MODELS, calculateCost } from "./openrouter";
import { createTrace } from "./langfuse";
import { logger } from "@/lib/logger";

export interface AIVisibilityResult {
  model: string;
  query: string;
  mentioned: boolean;
  context: string | null;
  position: "primary" | "secondary" | "not_found";
  competitors: string[];
  checkedAt: Date;
}

/**
 * Generate relevant queries for a given industry to test AI visibility.
 */
function generateQueries(brandName: string, industry: string): string[] {
  return [
    `What are the best ${industry} tools available right now?`,
    `Recommend a ${industry} solution for a small business.`,
    `What ${industry} software should I use in 2025?`,
    `Compare the top ${industry} platforms on the market.`,
    `Which ${industry} tool is the most popular and why?`,
  ];
}

/**
 * Parse an AI response to determine if a brand is mentioned and extract details.
 */
function parseVisibility(
  response: string,
  brandName: string
): {
  mentioned: boolean;
  position: "primary" | "secondary" | "not_found";
  context: string | null;
  competitors: string[];
} {
  const lowerResponse = response.toLowerCase();
  const lowerBrand = brandName.toLowerCase();
  const mentioned = lowerResponse.includes(lowerBrand);

  if (!mentioned) {
    // Extract competitor names from numbered/bulleted lists
    const competitors = extractCompetitorNames(response);
    return { mentioned: false, position: "not_found", context: null, competitors };
  }

  // Extract the snippet around the brand mention
  const idx = lowerResponse.indexOf(lowerBrand);
  const snippetStart = Math.max(0, idx - 100);
  const snippetEnd = Math.min(response.length, idx + brandName.length + 100);
  const context = response.slice(snippetStart, snippetEnd).trim();

  // Determine position: primary if mentioned in the first recommendation or as #1
  const firstMentionIdx = idx;
  const isPrimary =
    firstMentionIdx < response.length * 0.3 || // Mentioned in first 30% of response
    /(?:#\s*1|^1[.)]\s|first|top pick|best overall|recommend)/im.test(
      response.slice(Math.max(0, idx - 200), idx + brandName.length + 50)
    );

  const competitors = extractCompetitorNames(response).filter(
    (c) => c.toLowerCase() !== lowerBrand
  );

  return {
    mentioned: true,
    position: isPrimary ? "primary" : "secondary",
    context,
    competitors,
  };
}

/**
 * Extract likely product/brand names from an AI response.
 * Looks for names in numbered lists, bold text, and headers.
 */
function extractCompetitorNames(response: string): string[] {
  const names = new Set<string>();

  // Match bold text (**Name** or __Name__)
  const boldMatches = response.matchAll(/\*\*([A-Z][A-Za-z0-9. ]{1,30})\*\*/g);
  for (const m of boldMatches) {
    const name = m[1].trim();
    // Filter out generic phrases
    if (name.length > 1 && name.length < 30 && !/^(Key Features|Pros|Cons|Price|Summary|Conclusion|Overview|Why|How|What|Best|Top)/i.test(name)) {
      names.add(name);
    }
  }

  // Match numbered list items: "1. ProductName" or "1) ProductName"
  const listMatches = response.matchAll(/\d+[.)]\s+\*{0,2}([A-Z][A-Za-z0-9. ]{1,30})\*{0,2}/g);
  for (const m of listMatches) {
    const name = m[1].trim();
    if (name.length > 1 && name.length < 30) {
      names.add(name);
    }
  }

  return Array.from(names).slice(0, 10);
}

/**
 * Check if a brand is mentioned in AI responses for relevant industry queries.
 *
 * @param brandName - The brand/company name to check for
 * @param industry - The industry/category (e.g., "community monitoring", "project management")
 * @param queries - Optional custom queries; defaults to 5 auto-generated queries
 * @returns Array of visibility results, one per query
 */
export async function checkAIVisibility(
  brandName: string,
  industry: string,
  queries?: string[]
): Promise<AIVisibilityResult[]> {
  const effectiveQueries = queries?.length ? queries : generateQueries(brandName, industry);
  const results: AIVisibilityResult[] = [];

  const trace = createTrace({
    name: "ai-visibility-check",
    metadata: { brandName, industry, queryCount: effectiveQueries.length },
    tags: ["ai-visibility"],
  });

  for (const query of effectiveQueries) {
    try {
      const response = await completion({
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant. Answer the user's question with specific product/tool recommendations. Be thorough and mention multiple options.",
          },
          { role: "user", content: query },
        ],
        model: MODELS.primary,
        temperature: 0.7,
        maxTokens: 1024,
      });

      const parsed = parseVisibility(response.content, brandName);

      results.push({
        model: response.model,
        query,
        mentioned: parsed.mentioned,
        context: parsed.context,
        position: parsed.position,
        competitors: parsed.competitors,
        checkedAt: new Date(),
      });

      logger.debug("AI visibility check completed", {
        brandName,
        query: query.slice(0, 60),
        mentioned: parsed.mentioned,
        position: parsed.position,
        cost: response.cost,
      });
    } catch (error) {
      logger.error("AI visibility check failed for query", {
        brandName,
        query: query.slice(0, 60),
        error: error instanceof Error ? error.message : String(error),
        traceId: trace.id,
      });

      // Record as not found on error so the check still produces a row
      results.push({
        model: MODELS.primary,
        query,
        mentioned: false,
        context: null,
        position: "not_found",
        competitors: [],
        checkedAt: new Date(),
      });
    }
  }

  return results;
}
