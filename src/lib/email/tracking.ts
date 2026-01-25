/**
 * Email Tracking Utilities
 *
 * Generate tracking pixels and tracked URLs for email analytics
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://kaulbyapp.com";

export type EmailType = "daily_digest" | "weekly_digest" | "monthly_digest" | "alert" | "report";

interface TrackingParams {
  userId: string;
  emailId: string;
  emailType: EmailType;
}

/**
 * Generate a unique email ID for tracking
 */
export function generateEmailId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generate tracking pixel HTML for email opens
 */
export function getTrackingPixel(params: TrackingParams): string {
  const { userId, emailId, emailType } = params;
  const url = new URL(`${APP_URL}/api/track/open`);
  url.searchParams.set("uid", userId);
  url.searchParams.set("eid", emailId);
  url.searchParams.set("type", emailType);

  return `<img src="${url.toString()}" width="1" height="1" alt="" style="display:none;" />`;
}

/**
 * Generate a tracked link URL
 */
export function getTrackedLink(
  originalUrl: string,
  params: TrackingParams & {
    resultId?: string;
    monitorId?: string;
  }
): string {
  const { userId, emailId, emailType, resultId, monitorId } = params;
  const url = new URL(`${APP_URL}/api/track/click`);
  url.searchParams.set("uid", userId);
  url.searchParams.set("eid", emailId);
  url.searchParams.set("type", emailType);
  url.searchParams.set("url", encodeURIComponent(originalUrl));
  if (resultId) {
    url.searchParams.set("rid", resultId);
  }
  if (monitorId) {
    url.searchParams.set("mid", monitorId);
  }

  return url.toString();
}

/**
 * Replace all links in HTML with tracked versions
 */
export function addLinkTracking(
  html: string,
  params: TrackingParams
): string {
  // Match href="..." links
  const linkRegex = /href="([^"]+)"/g;

  return html.replace(linkRegex, (match, url) => {
    // Skip tracking for mailto links and anchors
    if (url.startsWith("mailto:") || url.startsWith("#") || url.startsWith("tel:")) {
      return match;
    }
    // Skip if it's already a tracking URL
    if (url.includes("/api/track/")) {
      return match;
    }
    // Skip unsubscribe/settings links (these should stay direct)
    if (url.includes("/settings") || url.includes("/unsubscribe")) {
      return match;
    }

    const trackedUrl = getTrackedLink(url, params);
    return `href="${trackedUrl}"`;
  });
}

/**
 * Add tracking pixel to end of HTML body
 */
export function addOpenTracking(
  html: string,
  params: TrackingParams
): string {
  const pixel = getTrackingPixel(params);

  // Insert before </body> if present
  if (html.includes("</body>")) {
    return html.replace("</body>", `${pixel}</body>`);
  }

  // Otherwise append to end
  return html + pixel;
}

/**
 * Add both open and click tracking to email HTML
 */
export function addEmailTracking(
  html: string,
  params: TrackingParams
): string {
  let tracked = addOpenTracking(html, params);
  tracked = addLinkTracking(tracked, params);
  return tracked;
}

/**
 * Record a sent event for an email
 */
export async function recordEmailSent(
  params: TrackingParams
): Promise<void> {
  // This is called after successfully sending an email
  // The actual insert is done separately to keep this function simple
  // and not require db imports in this utility module
  console.log(`Email sent: ${params.emailType} to ${params.userId} (${params.emailId})`);
}
