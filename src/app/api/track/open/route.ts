import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailEvents } from "@/lib/db/schema";

// 1x1 transparent GIF
const TRACKING_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const emailId = searchParams.get("eid");
  const userId = searchParams.get("uid");
  const emailType = searchParams.get("type");

  // Always return the pixel, even if tracking fails
  const response = new NextResponse(TRACKING_PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": TRACKING_PIXEL.length.toString(),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });

  // Track the open event asynchronously
  if (emailId && userId && emailType) {
    try {
      // Check for duplicate opens (dedup within 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const existing = await db.query.emailEvents.findFirst({
        where: (events, { and, eq, gt }) =>
          and(
            eq(events.emailId, emailId),
            eq(events.eventType, "opened"),
            gt(events.createdAt, fiveMinutesAgo)
          ),
      });

      if (!existing) {
        // Get IP country from header if available (set by CDN/edge)
        const ipCountry = request.headers.get("x-vercel-ip-country") || undefined;
        const userAgent = request.headers.get("user-agent") || undefined;

        await db.insert(emailEvents).values({
          userId,
          emailId,
          emailType,
          eventType: "opened",
          metadata: {
            userAgent,
            ipCountry,
          },
        });
      }
    } catch (error) {
      // Log but don't fail - tracking shouldn't break the user experience
      console.error("Failed to track email open:", error);
    }
  }

  return response;
}
