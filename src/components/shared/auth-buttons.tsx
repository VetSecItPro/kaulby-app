"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { SignedIn, SignedOut } from "@clerk/nextjs";

// Navigation auth buttons
export function AuthButtons() {
  return (
    <>
      <SignedOut>
        <Link href="/sign-in">
          <Button variant="ghost">Sign In</Button>
        </Link>
        <Link href="/sign-up">
          <Button>Get Started</Button>
        </Link>
      </SignedOut>
      <SignedIn>
        <Link href="/dashboard">
          <Button>Dashboard</Button>
        </Link>
      </SignedIn>
    </>
  );
}

// Hero section CTA buttons
export function HeroCTA() {
  return (
    <>
      <SignedOut>
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
      </SignedOut>
      <SignedIn>
        <Link href="/dashboard">
          <Button size="lg" className="gap-2">
            Go to Dashboard <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </SignedIn>
    </>
  );
}

// Bottom CTA section
export function AuthCTA() {
  return (
    <>
      <SignedOut>
        <Link href="/sign-up">
          <Button size="lg" variant="secondary" className="gap-2">
            Get Started for Free <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </SignedOut>
      <SignedIn>
        <Link href="/dashboard">
          <Button size="lg" variant="secondary" className="gap-2">
            Go to Dashboard <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </SignedIn>
    </>
  );
}
