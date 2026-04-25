/**
 * SEC-LLM-005: extract URLs from AI-generated text so the UI can surface
 * a "verify before posting" warning.
 *
 * Why this exists:
 * AI suggested replies (suggestedResponse.draft, /ai/suggest-reply suggestions)
 * are copy-pasted by users to public platforms. If a successful prompt
 * injection slips a phishing link or attacker-controlled URL into the AI
 * output, the user's brand voice gets weaponized.
 *
 * The mitigation isn't to strip URLs (that would alter intended replies
 * legitimately containing references). The mitigation is to surface the
 * URLs separately so the user sees them deliberately and verifies before
 * posting.
 *
 * Returns:
 *   - urls: deduplicated list of URLs found
 *   - hasExternalUrls: convenience boolean for UI gating
 *   - warningMessage: ready-to-render copy
 */

const URL_PATTERN = /https?:\/\/[^\s<>"')]+/gi;

export interface UrlExtractionResult {
  urls: string[];
  hasExternalUrls: boolean;
  warningMessage: string | null;
}

/**
 * Allowlist of hostnames considered "safe" — links to our own product
 * surfaces don't trip the warning. Add to this list as new first-party
 * surfaces (docs, blog, public dashboards) come online.
 */
const FIRST_PARTY_HOSTS = new Set<string>([
  "kaulbyapp.com",
  "www.kaulbyapp.com",
  "docs.kaulbyapp.com",
]);

function isFirstPartyUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return FIRST_PARTY_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function extractUrlsFromAiOutput(text: string): UrlExtractionResult {
  if (!text) {
    return { urls: [], hasExternalUrls: false, warningMessage: null };
  }

  const matches = text.match(URL_PATTERN) ?? [];
  // Deduplicate, trim trailing punctuation that the pattern often grabs
  const cleaned = Array.from(
    new Set(matches.map((u) => u.replace(/[.,;:!?]+$/, ""))),
  );

  const externalUrls = cleaned.filter((u) => !isFirstPartyUrl(u));
  const hasExternal = externalUrls.length > 0;

  return {
    urls: cleaned,
    hasExternalUrls: hasExternal,
    warningMessage: hasExternal
      ? `This AI-generated reply contains ${externalUrls.length === 1 ? "an external link" : `${externalUrls.length} external links`} — verify each one before posting publicly.`
      : null,
  };
}

/**
 * Convenience for batched suggestions: returns one result per suggestion
 * plus a top-level "any contain external URLs" flag.
 */
export function extractUrlsFromSuggestions(
  suggestions: Array<{ text: string }>,
): {
  perSuggestion: UrlExtractionResult[];
  anyHasExternalUrls: boolean;
} {
  const perSuggestion = suggestions.map((s) => extractUrlsFromAiOutput(s.text));
  return {
    perSuggestion,
    anyHasExternalUrls: perSuggestion.some((r) => r.hasExternalUrls),
  };
}
