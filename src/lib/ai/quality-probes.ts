/**
 * AI summary quality probes — shared between the manual audit script and the
 * periodic canary. Kept here so a single change ripples to both consumers.
 *
 * The probes are intentionally broad: they catch the ANALYST VOICE we bake
 * into SYSTEM_PROMPTS.summarize via pattern matching, rather than running
 * another LLM to score quality. The tradeoff is false positives when real
 * analyst-style phrases appear in robotic output, but in practice these
 * patterns are distinctive enough that collisions are rare.
 *
 * Calibration reference: 2026-04-23 smoke test showed 76% persona / 24%
 * generic / 0% robotic on real production output against the "inngest"
 * keyword over 67 summaries.
 */

export const PERSONA_PROBES = [
  // BROAD first-person conditional: "I'd VERB" where VERB is any word.
  // The variance probe (2026-04-23) showed the LLM naturally uses dozens
  // of "I'd" variants ("I'd engage", "I'd consider reaching out", "I'd
  // assign", "I'd reply", "I'd escalate") that previous narrow probes
  // missed. A single word-boundary-bounded pattern catches all of them
  // without false positives because summaries are short and "I'd" is a
  // distinctively analyst marker.
  /\bI'd \w+/i,
  // Explicit recommendation verbs
  /\bI recommend\b/i,
  /\bI noticed\b/i,
  /\bI saw\b/i,
  /\bI think\b/i,
  /\bI suggest\b/i,
  // Specificity markers — concrete details > vague descriptions
  /\bThree users\b/i,
  /\bTwo users\b/i,
  /\bHere's what stood out\b/i,
  /\bThis week\b/i,
  // Analyst observations (lead-quality, mention-type framings)
  /\bhigh[- ]intent\b/i,
  /\bunsolicited\b/i,
  /\bactively seeking\b/i,
  /\bshopping (?:for |around)/i,
  // Audience-aware recommendation phrasing
  /\bworth keeping an eye\b/i,
  /\bworth a look\b/i,
  /\bteam should\b/i,
  /\bteam must\b/i,
  /\bneeds (immediate )?(?:escalation|review|attention)\b/i,
  /\bno (?:action|immediate action) (?:is )?(?:required|needed)\b/i,
  /\bworth (?:monitoring|noting|logging)\b/i,
];

export const ROBOTIC_ANTIPATTERNS = [
  /^Sentiment: /im,
  /^Topic: /im,
  /^\s*Summary:\s*$/im,
  /^Category: /im,
];

// Banned openers per SYSTEM_PROMPTS.summarize. Matching ANY of these as the
// first 2-3 words is a persona regression — the whole point of the rewrite
// was to lead with findings, not "This is a..." descriptive preambles.
export const BANNED_OPENERS = [
  /^This (is|was) an?/i,
  /^The (post|user|author|article) /i,
  /^A user /i,
  /^Sentiment: /i,
];

export type QualityMetrics = {
  total: number;
  persona: number;
  generic: number;
  robotic: number;
  bannedOpener: number;
  personaRate: number;
  genericRate: number;
  roboticRate: number;
  bannedOpenerRate: number;
  avgLength: number;
};

/**
 * Run all probes against a list of AI summaries, return aggregate metrics.
 * An individual summary can be persona + banned-opener simultaneously;
 * the counters track independent dimensions rather than mutually-exclusive
 * buckets.
 */
export function runQualityProbes(summaries: string[]): QualityMetrics {
  let persona = 0;
  let robotic = 0;
  let bannedOpener = 0;
  let totalLength = 0;

  for (const s of summaries) {
    const hasPersona = PERSONA_PROBES.some((p) => p.test(s));
    const hasRobotic = ROBOTIC_ANTIPATTERNS.some((p) => p.test(s));
    const hasBannedOpener = BANNED_OPENERS.some((p) => p.test(s));
    if (hasPersona) persona++;
    if (hasRobotic) robotic++;
    if (hasBannedOpener) bannedOpener++;
    totalLength += s.length;
  }

  const total = summaries.length;
  const generic = total - persona - robotic;
  return {
    total,
    persona,
    generic: Math.max(0, generic),
    robotic,
    bannedOpener,
    personaRate: total === 0 ? 0 : persona / total,
    genericRate: total === 0 ? 0 : Math.max(0, generic) / total,
    roboticRate: total === 0 ? 0 : robotic / total,
    bannedOpenerRate: total === 0 ? 0 : bannedOpener / total,
    avgLength: total === 0 ? 0 : totalLength / total,
  };
}
