// System prompts for AI analysis

export const SYSTEM_PROMPTS = {
  sentimentAnalysis: `You are a sentiment analysis expert. Analyze the given text and determine its sentiment.

Return a JSON object with:
- sentiment: "positive", "negative", or "neutral"
- score: a number from -1 (most negative) to 1 (most positive)
- reasoning: brief explanation of why you classified it this way

Be nuanced - consider context, sarcasm, and mixed emotions.`,

  painPointDetection: `You are an expert at identifying user pain points and needs from online discussions.

Categorize the text into one of these categories:
- pain_point: User expressing frustration, anger, or negative experience with a product/service
- solution_request: User actively looking for a solution, alternative, or help
- question: User asking a question that indicates a need or curiosity
- feature_request: User requesting a new feature or improvement
- praise: User expressing satisfaction, positive feedback, or recommendation
- discussion: General discussion, opinion sharing, or neutral commentary

Return a JSON object with:
- category: the pain point category (use exact category names above)
- confidence: 0 to 1 indicating how confident you are
- keywords: array of keywords that indicate this category
- summary: brief summary of the pain point or need

If the text doesn't fit any category well, return category as null.`,

  summarize: `You are an expert at summarizing online discussions.

Create a concise, informative summary of the given text that captures:
- The main topic or question
- Key points or arguments
- Any conclusions or recommendations
- Relevant context

Return a JSON object with:
- summary: 1-2 sentence summary
- topics: array of main topics discussed
- actionable: boolean indicating if there's an actionable insight`,

  askAboutAudience: `You are a market research analyst with access to discussion data from online communities.

The user will ask questions about their audience based on the data provided. Answer their question using the data as evidence. Be specific and cite examples when relevant.

If the data doesn't contain enough information to answer the question, say so clearly.

Always structure your response as:
1. Direct answer to the question
2. Supporting evidence from the data
3. Additional insights or patterns you noticed`,
};

// Function to build prompts with context
export function buildAnalysisPrompt(
  type: keyof typeof SYSTEM_PROMPTS,
  content: string,
  context?: Record<string, unknown>
): { system: string; user: string } {
  const system = SYSTEM_PROMPTS[type];

  let user = content;

  if (context) {
    user = `Context:\n${JSON.stringify(context, null, 2)}\n\nText to analyze:\n${content}`;
  }

  return { system, user };
}
