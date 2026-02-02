import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home, Search, ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Cute sad robot */}
        <div className="select-none" aria-hidden="true">
          <pre className="text-muted-foreground text-sm leading-tight inline-block text-left font-mono">
{`      .-───-.
     /  ___  \\
    |  /   \\  |
    | | ·   · | |
    |  \\ ᴖ /  |
     \\_______/
      /|   |\\
     / |   | \\
    ╰──╯   ╰──╯`}
          </pre>
          <p className="mt-3 text-2xl font-mono text-muted-foreground/60">404</p>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            This page wandered off
          </h1>
          <p className="text-muted-foreground">
            Our monitoring bot searched everywhere but couldn&apos;t find this
            page. It might have been moved, deleted, or maybe it never existed.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/">
            <Button variant="default" className="gap-2 w-full sm:w-auto">
              <Home className="w-4 h-4" />
              Go Home
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" className="gap-2 w-full sm:w-auto">
              <Search className="w-4 h-4" />
              Dashboard
            </Button>
          </Link>
        </div>

        <p className="text-sm text-muted-foreground">
          Looking for something specific?{" "}
          <Link
            href="/articles"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            Browse our articles
            <ArrowRight className="h-3 w-3" />
          </Link>
        </p>
      </div>
    </div>
  );
}
