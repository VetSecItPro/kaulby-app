import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailEvents } from "@/lib/db/schema";
import { sanitizeUrl, isValidUuid, verifyTrackingSignature } from "@/lib/security";
import { checkIpRateLimit, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  // Public endpoint - no authenticated user, so rate-limit by client IP.
  // "read" tier (200/min) is generous enough for legitimate email link clicks
  // while blocking scrapers that follow tracking URLs at high rates.
  const ip = getClientIp(request);
  const rateLimit = await checkIpRateLimit(ip, "read");
  if (!rateLimit.allowed) {
    // Fall back to a silent dashboard redirect (same as invalid-URL path)
    // rather than a 429 so that malicious traffic doesn't learn about the limit.
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const searchParams = request.nextUrl.searchParams;
  const emailId = searchParams.get("eid");
  const userId = searchParams.get("uid");
  const emailType = searchParams.get("type");
  const url = searchParams.get("url");
  const resultId = searchParams.get("rid");
  const monitorId = searchParams.get("mid");
  const sig = searchParams.get("sig");

  // If no URL provided, redirect to dashboard
  if (!url) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // RT-001: Verify HMAC signature to prevent open redirect abuse.
  // Only app-generated tracking URLs (signed in email.ts) are accepted.
  if (!sig || !emailId || !userId || !emailType) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!verifyTrackingSignature({ eid: emailId, uid: userId, type: emailType, url }, sig)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Decode and validate the URL
  let targetUrl: string;
  try {
    targetUrl = decodeURIComponent(url);
    // Validate URL is safe (blocks javascript:, data:, vbscript: protocols)
    const safe = sanitizeUrl(targetUrl);
    if (!safe) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    targetUrl = safe;
  } catch {
    // Invalid URL, redirect to dashboard
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Validate uid format to prevent data poisoning
  if (userId && !isValidUuid(userId)) {
    return NextResponse.redirect(new URL(targetUrl, request.url));
  }

  // Track the click event asynchronously
  if (emailId && userId && emailType) {
    try {
      // Get IP country from header if available (set by CDN/edge)
      const ipCountry = request.headers.get("x-vercel-ip-country") || undefined;
      const userAgent = request.headers.get("user-agent") || undefined;

      await db.insert(emailEvents).values({
        userId,
        emailId,
        emailType,
        eventType: "clicked",
        linkUrl: targetUrl,
        metadata: {
          userAgent,
          ipCountry,
          resultId: resultId || undefined,
          monitorId: monitorId || undefined,
        },
      });
    } catch (error) {
      // Log but don't fail - tracking shouldn't break the redirect
      logger.error("Failed to track email click:", { error: error instanceof Error ? error.message : String(error) });
    }
  }

  // Redirect to the target URL (new URL() handles both absolute and relative paths)
  return NextResponse.redirect(new URL(targetUrl, request.url));
}
