import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailEvents } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const emailId = searchParams.get("eid");
  const userId = searchParams.get("uid");
  const emailType = searchParams.get("type");
  const url = searchParams.get("url");
  const resultId = searchParams.get("rid");
  const monitorId = searchParams.get("mid");

  // If no URL provided, redirect to dashboard
  if (!url) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Decode the URL
  let targetUrl: string;
  try {
    targetUrl = decodeURIComponent(url);
    // Validate it's a proper URL
    new URL(targetUrl);
  } catch {
    // Invalid URL, redirect to dashboard
    return NextResponse.redirect(new URL("/dashboard", request.url));
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
      console.error("Failed to track email click:", error);
    }
  }

  // Redirect to the target URL
  return NextResponse.redirect(targetUrl);
}
