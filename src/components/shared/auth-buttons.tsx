import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

// Navigation auth buttons (server component — no ClerkProvider needed)
export async function AuthButtons() {
  const { userId } = await auth();

  if (userId) {
    return (
      <Link href="/dashboard">
        <Button>Dashboard</Button>
      </Link>
    );
  }

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
export async function HeroCTA() {
  const { userId } = await auth();

  if (userId) {
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
export async function AuthCTA() {
  const { userId } = await auth();

  if (userId) {
    return (
      <Link href="/dashboard">
        <Button size="lg" variant="secondary" className="gap-2">
          Go to Dashboard <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    );
  }

  return (
    <Link href="/sign-up">
      <Button size="lg" variant="secondary" className="gap-2">
        Get Started for Free <ArrowRight className="h-4 w-4" />
      </Button>
    </Link>
  );
}
