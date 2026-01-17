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

  // Show nothing while loading to prevent flash
  if (!isLoaded) {
    return (
      <>
        <Button variant="ghost" disabled className="opacity-50">
          Sign In
        </Button>
        <Button disabled className="opacity-50">
          Get Started
        </Button>
      </>
    );
  }

  // User is signed in - show dashboard link
  if (isSignedIn) {
    return (
      <Link href="/dashboard">
        <Button>Dashboard</Button>
      </Link>
    );
  }

  // User is not signed in - show auth buttons
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

  // Show loading state
  if (!isLoaded) {
    return (
      <>
        <Button size="lg" disabled className="gap-2 opacity-50">
          Start Free Trial <ArrowRight className="h-4 w-4" />
        </Button>
        <Link href="/pricing">
          <Button size="lg">
            View Pricing
          </Button>
        </Link>
      </>
    );
  }

  // User is signed in - show dashboard link instead of sign-up
  if (isSignedIn) {
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

  // User is not signed in
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

  // Show loading state
  if (!isLoaded) {
    return (
      <Button size="lg" variant="secondary" disabled className="gap-2 opacity-50">
        Get Started for Free <ArrowRight className="h-4 w-4" />
      </Button>
    );
  }

  // User is signed in - show dashboard link
  if (isSignedIn) {
    return (
      <Link href="/dashboard">
        <Button size="lg" variant="secondary" className="gap-2">
          Go to Dashboard <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    );
  }

  // User is not signed in
  return (
    <Link href="/sign-up">
      <Button size="lg" variant="secondary" className="gap-2">
        Get Started for Free <ArrowRight className="h-4 w-4" />
      </Button>
    </Link>
  );
}
