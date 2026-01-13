/**
 * Centralized platform styling utilities
 * All platform-related colors and styling should be defined here
 */

export const platforms = ["reddit", "hackernews", "producthunt", "devto", "twitter"] as const;
export type Platform = (typeof platforms)[number];

/**
 * Platform colors for different contexts
 */
export const platformColors = {
  reddit: {
    badge: "bg-orange-500/10 text-orange-500",
    badgeLight: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    bar: "bg-orange-500",
    icon: "text-orange-500",
  },
  hackernews: {
    badge: "bg-amber-500/10 text-amber-500",
    badgeLight: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    bar: "bg-amber-500",
    icon: "text-amber-500",
  },
  producthunt: {
    badge: "bg-red-500/10 text-red-500",
    badgeLight: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    bar: "bg-red-500",
    icon: "text-red-500",
  },
  devto: {
    badge: "bg-purple-500/10 text-purple-500",
    badgeLight: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
    bar: "bg-violet-500",
    icon: "text-purple-500",
  },
  twitter: {
    badge: "bg-sky-500/10 text-sky-500",
    badgeLight: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400",
    bar: "bg-sky-500",
    icon: "text-sky-500",
  },
} as const;

/**
 * Get platform badge color class
 * @param platform - The platform name
 * @param variant - 'default' for dark mode optimized, 'light' for light/dark adaptive
 */
export function getPlatformBadgeColor(
  platform: string,
  variant: "default" | "light" = "default"
): string {
  const colors = platformColors[platform as Platform];
  if (!colors) return "bg-muted text-muted-foreground";
  return variant === "light" ? colors.badgeLight : colors.badge;
}

/**
 * Get platform bar color class (for charts/progress bars)
 */
export function getPlatformBarColor(platform: string): string {
  const colors = platformColors[platform as Platform];
  return colors?.bar || "bg-primary";
}

/**
 * Sentiment colors for different contexts
 */
export const sentimentColors = {
  positive: {
    badge: "bg-green-500/10 text-green-500",
    badgeLight: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    bar: "bg-green-500",
  },
  negative: {
    badge: "bg-red-500/10 text-red-500",
    badgeLight: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    bar: "bg-red-500",
  },
  neutral: {
    badge: "bg-gray-500/10 text-gray-400",
    badgeLight: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
    bar: "bg-gray-500",
  },
} as const;

export type Sentiment = keyof typeof sentimentColors;

/**
 * Get sentiment badge color class
 */
export function getSentimentBadgeColor(
  sentiment: string | null,
  variant: "default" | "light" = "default"
): string {
  if (!sentiment) return "bg-muted text-muted-foreground";
  const colors = sentimentColors[sentiment as Sentiment];
  if (!colors) return "bg-muted text-muted-foreground";
  return variant === "light" ? colors.badgeLight : colors.badge;
}

/**
 * Get sentiment bar color class
 */
export function getSentimentBarColor(sentiment: string | null): string {
  if (!sentiment) return "bg-muted";
  const colors = sentimentColors[sentiment as Sentiment];
  return colors?.bar || "bg-muted";
}
