"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { SignedIn, SignedOut, useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";

// Wrapper that shows fallback when Clerk isn't working or takes too long
function ClerkFallback({
  signedOutContent,
  signedInContent
}: {
  signedOutContent: React.ReactNode;
  signedInContent: React.ReactNode;
}) {
  const [showFallback, setShowFallback] = useState(false);
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    // If Clerk doesn't load within 1.5 seconds, show fallback
    const timeout = setTimeout(() => {
      if (!isLoaded) {
        setShowFallback(true);
      }
    }, 1500);

    return () => clearTimeout(timeout);
  }, [isLoaded]);

  // Clerk is working - use normal SignedIn/SignedOut
  if (isLoaded) {
    return (
      <>
        <SignedOut>{signedOutContent}</SignedOut>
        <SignedIn>{signedInContent}</SignedIn>
      </>
    );
  }

  // Clerk timed out - show signed out content as fallback
  if (showFallback) {
    return <>{signedOutContent}</>;
  }

  // Still waiting for Clerk - render nothing to avoid flash
  return null;
}

// Navigation auth buttons
export function AuthButtons() {
  return (
    <ClerkFallback
      signedOutContent={
        <>
          <Link href="/sign-in">
            <Button variant="ghost">Sign In</Button>
          </Link>
          <Link href="/sign-up">
            <Button>Get Started</Button>
          </Link>
        </>
      }
      signedInContent={
        <Link href="/dashboard">
          <Button>Dashboard</Button>
        </Link>
      }
    />
  );
}

// Hero section CTA buttons
export function HeroCTA() {
  return (
    <ClerkFallback
      signedOutContent={
        <>
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
        </>
      }
      signedInContent={
        <Link href="/dashboard">
          <Button size="lg" className="gap-2">
            Go to Dashboard <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      }
    />
  );
}

// Bottom CTA section
export function AuthCTA() {
  return (
    <ClerkFallback
      signedOutContent={
        <Link href="/sign-up">
          <Button size="lg" variant="secondary" className="gap-2">
            Get Started for Free <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      }
      signedInContent={
        <Link href="/dashboard">
          <Button size="lg" variant="secondary" className="gap-2">
            Go to Dashboard <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      }
    />
  );
}
