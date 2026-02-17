import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hasCsrfCookie, setCsrfCookie } from "@/lib/csrf";

// PERF: Middleware bundle is 76.7kB — consider code-splitting non-essential logic — FIX-216

// PERF: Cache env check — env vars don't change at runtime — FIX-021
let _clerkConfigured: boolean | null = null;
function clerkConfigured(): boolean {
  return (_clerkConfigured ??= !!(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY
  ));
}

// Lazy-loaded Clerk middleware to avoid initialization errors when not configured
let clerkHandler: ((request: NextRequest, event: never) => Promise<Response>) | null = null;

async function getClerkHandler() {
  if (!clerkHandler) {
    const { clerkMiddleware, createRouteMatcher } = await import("@clerk/nextjs/server");

    // SECURITY: Only truly public routes - NEVER add dashboard/manage here
    // Test email endpoints only available in verified local development
    const isLocalDev = process.env.NODE_ENV === "development" &&
                       !process.env.VERCEL &&
                       !process.env.VERCEL_ENV;

    const isPublicRoute = createRouteMatcher([
      "/",
      "/pricing",
      "/privacy",
      "/terms",
      "/install", // PWA installation instructions
      "/gummysearch", // GummySearch migration landing page
      "/subreddits(.*)", // Programmatic SEO - subreddit landing pages
      "/alternatives(.*)", // Programmatic SEO - competitor comparison pages
      "/tools(.*)", // Programmatic SEO - tool landing pages
      "/articles(.*)",
      "/sign-in(.*)",
      "/sign-up(.*)",
      "/api/webhooks(.*)",
      "/api/inngest(.*)",
      "/api/polar(.*)", // Polar checkout routes (auth handled in route)
      "/api/v1(.*)", // API v1 routes use API key auth, not Clerk
      "/invite(.*)", // Public invite acceptance page
      "/banned", // Banned user page
      // Test endpoints only in verified local development (not Vercel preview/prod)
      ...(isLocalDev ? ["/api/test-emails(.*)", "/api/test-single-email(.*)"] : []),
    ]);

    clerkHandler = clerkMiddleware(async (auth, request) => {
      if (!isPublicRoute(request)) {
        await auth.protect();
      }
    }) as (request: NextRequest, event: never) => Promise<Response>;
  }
  return clerkHandler;
}

// Main middleware - checks if Clerk is configured at runtime
export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // CRITICAL: Skip Clerk entirely for webhook routes - they use their own auth
  // This must happen BEFORE Clerk middleware to prevent 307 redirects
  if (
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/inngest") ||
    pathname.startsWith("/api/v1") ||
    pathname.startsWith("/api/polar")
  ) {
    return NextResponse.next();
  }

  // SECURITY: Verified local development bypass
  // Requires explicit opt-in via ALLOW_DEV_AUTH_BYPASS=true
  // Only bypasses /dashboard and /api/ routes -- /manage (admin) always requires real auth
  const isLocalDev = process.env.NODE_ENV === "development" &&
                     process.env.ALLOW_DEV_AUTH_BYPASS === "true" &&
                     !process.env.VERCEL &&
                     !process.env.VERCEL_ENV;

  if (isLocalDev && (pathname.startsWith("/dashboard") || pathname.startsWith("/api/"))) {
    return NextResponse.next();
  }

  // PERF: Cache Clerk config check — env vars don't change at runtime — FIX-021
  const isClerkConfigured = clerkConfigured();

  if (!isClerkConfigured) {
    // Allow all routes when auth isn't configured
    return NextResponse.next();
  }

  // Use Clerk middleware when configured
  const handler = await getClerkHandler();
  const response = await handler(request, {} as never);

  // SECURITY (FIX-009): Set CSRF cookie on authenticated dashboard responses
  // Uses double-submit cookie pattern — API routes verify via X-CSRF-Token header.
  // Server actions already have built-in Origin header CSRF protection in Next.js 14.
  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/manage")
  ) {
    const nextResponse =
      response instanceof NextResponse
        ? response
        : NextResponse.next({ headers: response.headers });

    if (!hasCsrfCookie(request)) {
      setCsrfCookie(nextResponse);
    }
    return nextResponse;
  }

  return response;
}

// FIX-009: CSRF protection implemented — see src/lib/csrf.ts
// Middleware sets kaulby_csrf cookie on /dashboard and /manage routes.
// API routes can verify via verifyCsrfToken(request) for critical state changes.

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|json)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
