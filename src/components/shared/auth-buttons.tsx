"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

// Check if Clerk is configured (client-side check)
const isClerkConfigured = typeof window !== "undefined"
  ? !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  : false;

// Dynamic import of Clerk components only when configured
let SignedIn: React.ComponentType<{ children: React.ReactNode }> | null = null;
let SignedOut: React.ComponentType<{ children: React.ReactNode }> | null = null;

if (isClerkConfigured) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const clerk = require("@clerk/nextjs");
  SignedIn = clerk.SignedIn;
  SignedOut = clerk.SignedOut;
}

// Fallback components when Clerk isn't configured
function FallbackSignedOut({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function FallbackSignedIn({ children }: { children: React.ReactNode }) {
  // When not configured, don't show signed-in content
  return null;
}

const SafeSignedIn = SignedIn || FallbackSignedIn;
const SafeSignedOut = SignedOut || FallbackSignedOut;

// Navigation auth buttons
export function AuthButtons() {
  return (
    <>
      <SafeSignedOut>
        <Link href="/sign-in">
          <Button variant="ghost">Sign In</Button>
        </Link>
        <Link href="/sign-up">
          <Button>Get Started</Button>
        </Link>
      </SafeSignedOut>
      <SafeSignedIn>
        <Link href="/dashboard">
          <Button>Dashboard</Button>
        </Link>
      </SafeSignedIn>
    </>
  );
}

// Hero section CTA buttons
export function HeroCTA() {
  return (
    <>
      <SafeSignedOut>
        <Link href="/sign-up">
          <Button size="lg" className="gap-2">
            Start Free Trial <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link href="/pricing">
          <Button size="lg" variant="outline">
            View Pricing
          </Button>
        </Link>
      </SafeSignedOut>
      <SafeSignedIn>
        <Link href="/dashboard">
          <Button size="lg" className="gap-2">
            Go to Dashboard <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </SafeSignedIn>
    </>
  );
}

// Bottom CTA section
export function AuthCTA() {
  return (
    <>
      <SafeSignedOut>
        <Link href="/sign-up">
          <Button size="lg" variant="secondary" className="gap-2">
            Get Started for Free <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </SafeSignedOut>
      <SafeSignedIn>
        <Link href="/dashboard">
          <Button size="lg" variant="secondary" className="gap-2">
            Go to Dashboard <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </SafeSignedIn>
    </>
  );
}
