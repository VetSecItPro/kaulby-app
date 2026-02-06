/**
 * Staggering utilities for Inngest cron jobs
 *
 * Prevents "thundering herd" problem by spreading monitor execution
 * over a time window instead of processing all at once.
 */

/**
 * Calculate stagger delay for a monitor based on its position in the queue
 *
 * @param index - Position of this monitor in the queue (0-based)
 * @param totalMonitors - Total number of monitors to process
 * @param windowMs - Time window to spread execution over (default: 10 minutes)
 * @returns Delay in milliseconds for this monitor
 */
export function calculateStaggerDelay(
  index: number,
  totalMonitors: number,
  windowMs: number = 10 * 60 * 1000 // 10 minutes default
): number {
  if (totalMonitors <= 1) return 0;

  // Spread monitors evenly across the window
  const delayPerMonitor = windowMs / totalMonitors;
  return Math.floor(index * delayPerMonitor);
}

/**
 * Format stagger delay for Inngest step.sleep
 * Inngest accepts strings like "5m", "30s", "1h"
 *
 * @param delayMs - Delay in milliseconds
 * @returns Formatted duration string
 */
export function formatStaggerDuration(delayMs: number): string {
  if (delayMs === 0) return "0s";

  const seconds = Math.floor(delayMs / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (remainingSeconds === 0) return `${minutes}m`;
  return `${minutes}m${remainingSeconds}s`;
}

/**
 * Add jitter to prevent exact timing collisions
 * Useful when multiple monitors have similar stagger positions
 *
 * @param delayMs - Base delay in milliseconds
 * @param jitterPercent - Maximum jitter as percentage (default: 10%)
 * @returns Delay with random jitter added
 */
export function addJitter(delayMs: number, jitterPercent: number = 10): number {
  const maxJitter = delayMs * (jitterPercent / 100);
  const jitter = Math.random() * maxJitter;
  return Math.floor(delayMs + jitter);
}

/**
 * Configuration for different platforms
 * Higher-volume platforms get longer stagger windows
 */
const STAGGER_CONFIG = {
  // Low-volume platforms: 5 minute window
  reddit: 5 * 60 * 1000,
  hackernews: 5 * 60 * 1000,
  producthunt: 5 * 60 * 1000,
  quora: 5 * 60 * 1000,

  // Medium-volume platforms: 8 minute window
  trustpilot: 8 * 60 * 1000,
  googlereviews: 8 * 60 * 1000,
  g2: 8 * 60 * 1000,
  yelp: 8 * 60 * 1000,
  appstore: 8 * 60 * 1000,
  playstore: 8 * 60 * 1000,

  // High-volume platforms: 10 minute window
  youtube: 10 * 60 * 1000,
  amazonreviews: 10 * 60 * 1000,

  // Developer platforms (Phase 4): 5 minute window
  indiehackers: 5 * 60 * 1000,
  github: 5 * 60 * 1000,
  devto: 5 * 60 * 1000,
  hashnode: 5 * 60 * 1000,

  // Social media (Phase 5): 5 minute window
  x: 5 * 60 * 1000,
} as const;

type PlatformName = keyof typeof STAGGER_CONFIG;

/**
 * Get stagger window for a platform
 */
export function getStaggerWindow(platform: PlatformName): number {
  return STAGGER_CONFIG[platform] || 5 * 60 * 1000;
}
