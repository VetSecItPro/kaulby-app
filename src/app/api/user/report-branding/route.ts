import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { checkApiRateLimit, parseJsonBody, BodyTooLargeError } from "@/lib/rate-limit";

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const userId = await getEffectiveUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        reportBranding: true,
        subscriptionStatus: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      branding: user.reportBranding ?? null,
      isTeam: user.subscriptionStatus === "team",
    });
  } catch (error) {
    console.error("Failed to fetch report branding:", error);
    return NextResponse.json(
      { error: "Failed to fetch report branding" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await getEffectiveUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting
    const rateLimit = await checkApiRateLimit(userId, "write");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } }
      );
    }

    // Verify Team tier
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { subscriptionStatus: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.subscriptionStatus !== "team") {
      return NextResponse.json(
        { error: "Report branding customization requires a Team subscription" },
        { status: 403 }
      );
    }

    const body = await parseJsonBody(request);
    const { companyName, logoUrl, primaryColor, footerText, hideKaulbyBranding } = body;

    // Validate fields
    if (primaryColor !== undefined && primaryColor !== null && primaryColor !== "") {
      if (typeof primaryColor !== "string" || !HEX_COLOR_RE.test(primaryColor)) {
        return NextResponse.json(
          { error: "Invalid primary color. Must be a hex color like #14b8a6" },
          { status: 400 }
        );
      }
    }

    if (logoUrl !== undefined && logoUrl !== null && logoUrl !== "") {
      if (typeof logoUrl !== "string" || !isValidUrl(logoUrl)) {
        return NextResponse.json(
          { error: "Invalid logo URL. Must be a valid HTTP(S) URL" },
          { status: 400 }
        );
      }
    }

    if (companyName !== undefined && typeof companyName !== "string") {
      return NextResponse.json(
        { error: "Company name must be a string" },
        { status: 400 }
      );
    }

    if (footerText !== undefined && typeof footerText !== "string") {
      return NextResponse.json(
        { error: "Footer text must be a string" },
        { status: 400 }
      );
    }

    if (hideKaulbyBranding !== undefined && typeof hideKaulbyBranding !== "boolean") {
      return NextResponse.json(
        { error: "hideKaulbyBranding must be a boolean" },
        { status: 400 }
      );
    }

    // Build the branding object, preserving unset fields
    const branding: Record<string, unknown> = {};
    if (companyName !== undefined) branding.companyName = companyName || undefined;
    if (logoUrl !== undefined) branding.logoUrl = logoUrl || undefined;
    if (primaryColor !== undefined) branding.primaryColor = primaryColor || undefined;
    if (footerText !== undefined) branding.footerText = footerText || undefined;
    if (hideKaulbyBranding !== undefined) branding.hideKaulbyBranding = hideKaulbyBranding;

    await db
      .update(users)
      .set({ reportBranding: branding })
      .where(eq(users.id, userId));

    return NextResponse.json({ success: true, branding });
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 });
    }
    console.error("Failed to update report branding:", error);
    return NextResponse.json(
      { error: "Failed to update report branding" },
      { status: 500 }
    );
  }
}
