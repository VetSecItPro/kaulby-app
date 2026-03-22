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
      "/demo(.*)", // Public demo route for video capture and try-before-signup
      "/pricing",
      "/privacy",
      "/terms",
      "/cookies", // Cookie policy page
      "/docs/api(.*)", // Public API documentation
      "/status", // Public system status page
      "/install", // PWA installation instructions
      "/roadmap", // Public product roadmap page
      "/gummysearch", // GummySearch migration landing page
      "/migrate(.*)", // Migration guides (e.g., /migrate/gummysearch)
      "/use-case(.*)", // Programmatic SEO - use case landing pages
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
      "/api/track(.*)", // Email tracking pixels/clicks (public by design)
      "/invite(.*)", // Public invite acceptance page
      "/banned", // Banned user page
      "/~offline", // PWA offline fallback page
      "/report(.*)", // Public shared report pages
      "/robots.txt", // Search engine crawling directives
      "/sitemap.xml", // Search engine sitemap
      "/opengraph-image", // Dynamic OG image (must be public for social crawlers)
      // Test endpoints only in verified local development (not Vercel preview/prod)
      ...(isLocalDev ? ["/api/test-emails(.*)", "/api/test-single-email(.*)"] : []),
    ]);

    clerkHandler = clerkMiddleware(async (auth, request) => {
      // SECURITY: Dev auth bypass — skip Clerk protect() in verified local dev
      // so Playwright e2e tests can access dashboard without a Clerk session.
      // Layout uses getEffectiveUserId() to resolve the test user from DB.
      if (
        isLocalDev &&
        process.env.ALLOW_DEV_AUTH_BYPASS === "true" &&
        !process.env.VERCEL &&
        !process.env.VERCEL_ENV
      ) {
        return;
      }
      if (!isPublicRoute(request)) {
        await auth.protect({
          unauthenticatedUrl: new URL('/sign-in', request.url).toString(),
        });
      }
    }) as (request: NextRequest, event: never) => Promise<Response>;
  }
  return clerkHandler;
}

// Bot blocking — return 403 before any serverless work (saves Clerk invocations too)
// NOTE: Beneficial AEO crawlers (GPTBot, ChatGPT-User, ClaudeBot, PerplexityBot,
// OAI-SearchBot) are ALLOWED — they help Kaulby appear in AI search results.
// Only block aggressive scrapers and non-beneficial bots.
const BLOCKED_BOTS = [
  'CCBot', 'Bytespider', 'meta-externalagent', 'FacebookBot',
  'facebookexternalhit', 'AhrefsBot', 'SemrushBot', 'MJ12bot', 'DotBot',
  'PetalBot', 'Amazonbot', 'YouBot', 'Applebot-Extended', 'cohere-ai',
  'Google-Extended',
];

function isBlockedBot(ua: string): boolean {
  const lower = ua.toLowerCase();
  return BLOCKED_BOTS.some((bot) => lower.includes(bot.toLowerCase()));
}

// Main middleware - checks if Clerk is configured at runtime
export default async function middleware(request: NextRequest) {
  // Block aggressive bots before any processing
  const userAgent = request.headers.get('user-agent') ?? '';
  if (userAgent && isBlockedBot(userAgent)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const pathname = request.nextUrl.pathname;

  // CRITICAL: Skip Clerk entirely for webhook/inngest/API-key routes - they use their own auth
  // This must happen BEFORE Clerk middleware to prevent 307 redirects
  // NOTE: /api/polar routes are NOT skipped here — they need Clerk middleware
  // to run so auth() works in checkout routes (they're in isPublicRoute so no auth required)
  if (
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/inngest") ||
    pathname.startsWith("/api/v1") ||
    pathname === "/api/health"
  ) {
    return NextResponse.next();
  }

  // NOTE: Dev auth bypass is handled at the route level via getEffectiveUserId(),
  // NOT in middleware. Clerk middleware must always run so auth() works in API routes.

  // RT-002: CSRF — Verify Origin header on mutation requests to API routes.
  // Blocks cross-origin POST/PUT/PATCH/DELETE from malicious sites.
  // Webhook/inngest/v1 routes are excluded above (they use their own auth).
  // Polar routes go through Clerk (public route) so auth() context is available.
  if (
    pathname.startsWith("/api/") &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(request.method)
  ) {
    const origin = request.headers.get("origin");
    if (origin) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const allowedOrigins = new Set([
        new URL(appUrl).origin,
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
      ]);
      // In development, allow any localhost port
      if (process.env.NODE_ENV === "development" && origin.startsWith("http://localhost:")) {
        allowedOrigins.add(origin);
      }
      // Include Vercel preview/production URLs
      if (process.env.VERCEL_URL) {
        allowedOrigins.add(`https://${process.env.VERCEL_URL}`);
      }
      if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
        allowedOrigins.add(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
      }
      if (!allowedOrigins.has(origin)) {
        return NextResponse.json(
          { error: "Cross-origin request blocked" },
          { status: 403 }
        );
      }
    }
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
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|json|mp4|webm|ogg|mov|avi)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
