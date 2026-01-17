import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
      "/gummysearch", // GummySearch migration landing page
      "/subreddits(.*)", // Programmatic SEO - subreddit landing pages
      "/alternatives(.*)", // Programmatic SEO - competitor comparison pages
      "/articles(.*)",
      "/sign-in(.*)",
      "/sign-up(.*)",
      "/api/webhooks(.*)",
      "/api/inngest(.*)",
      "/invite(.*)", // Public invite acceptance page
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
  // Check if Clerk is configured at runtime
  const isClerkConfigured =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY;

  if (!isClerkConfigured) {
    // Allow all routes when auth isn't configured
    return NextResponse.next();
  }

  // Use Clerk middleware when configured
  const handler = await getClerkHandler();
  return handler(request, {} as never);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|json)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
