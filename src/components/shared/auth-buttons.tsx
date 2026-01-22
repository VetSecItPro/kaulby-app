"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

/**
 * Auth buttons component - displays sign in/up buttons or dashboard link
 * Uses Clerk's useAuth hook to check authentication state
 */

// Navigation auth buttons
export function AuthButtons() {
  const { isSignedIn, isLoaded } = useAuth();

  // User is signed in - show dashboard link
  if (isLoaded && isSignedIn) {
    return (
      <Link href="/dashboard">
        <Button>Dashboard</Button>
      </Link>
    );
  }

  // Show auth buttons (works even while Clerk is loading)
  return (
    <>
      <Link href="/sign-in">
        <Button
          variant="ghost"
          className="hover:bg-teal-500 hover:text-black transition-colors"
        >
          Sign In
        </Button>
      </Link>
      <Link href="/sign-up">
        <Button>Get Started</Button>
      </Link>
    </>
  );
}

// Hero section CTA buttons
export function HeroCTA() {
  const { isSignedIn, isLoaded } = useAuth();

  // User is signed in - show dashboard link instead of sign-up
  if (isLoaded && isSignedIn) {
    return (
      <>
        <Link href="/dashboard">
          <Button size="lg" className="gap-2">
            Go to Dashboard <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link href="/pricing">
          <Button size="lg">
            View Pricing
          </Button>
        </Link>
      </>
    );
  }

  // Show sign-up buttons (works even while Clerk is loading)
  return (
    <>
      <Link href="/sign-up">
        <Button size="lg" className="gap-2">
          Start Free Trial <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
      <Link href="/pricing">
        <Button size="lg">
          View Pricing
        </Button>
      </Link>
    </>
  );
}

// Bottom CTA section
export function AuthCTA() {
  const { isSignedIn, isLoaded } = useAuth();

  // User is signed in - show dashboard link
  if (isLoaded && isSignedIn) {
    return (
      <Link href="/dashboard">
        <Button size="lg" variant="secondary" className="gap-2">
          Go to Dashboard <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    );
  }

  // Show sign-up button (works even while Clerk is loading)
  return (
    <Link href="/sign-up">
      <Button size="lg" variant="secondary" className="gap-2">
        Get Started for Free <ArrowRight className="h-4 w-4" />
      </Button>
    </Link>
  );
}
