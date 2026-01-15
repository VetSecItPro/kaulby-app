"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

/**
 * Auth buttons component - displays sign in/up buttons or dashboard link
 * Currently shows signed-out state only for maximum resilience
 * TODO: Integrate with Clerk auth state when provider is stable
 */

// Navigation auth buttons
export function AuthButtons() {
  return (
    <>
      <Link href="/sign-in">
        <Button variant="ghost">Sign In</Button>
      </Link>
      <Link href="/sign-up">
        <Button>Get Started</Button>
      </Link>
    </>
  );
}

// Hero section CTA buttons
export function HeroCTA() {
  return (
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
  );
}

// Bottom CTA section
export function AuthCTA() {
  return (
    <Link href="/sign-up">
      <Button size="lg" variant="secondary" className="gap-2">
        Get Started for Free <ArrowRight className="h-4 w-4" />
      </Button>
    </Link>
  );
}
