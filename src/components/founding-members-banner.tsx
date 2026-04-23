"use client";

import { useEffect, useState } from "react";
import { Wand2, Lock } from "lucide-react";

interface FoundingMembersCount {
  claimed: number;
  remaining: number;
  total: number;
  exhausted: boolean;
}

interface FoundingMembersBannerProps {
  /** Compact one-line render for the sign-up page; default is the pricing hero format */
  variant?: "hero" | "compact";
}

/**
 * Live "X/1000 Founding Members remaining" banner.
 *
 * Renders nothing while loading (prevents flash) and when the 1000 cap
 * is hit (program ended). The count comes from a 60s-cached public
 * endpoint, so the banner is eventually consistent, not real-time —
 * which is fine for marketing copy.
 *
 */
export function FoundingMembersBanner({ variant = "hero" }: FoundingMembersBannerProps) {
  const [count, setCount] = useState<FoundingMembersCount | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/founding-members/count", { signal: controller.signal })
      .then((res) => res.json())
      .then((data: FoundingMembersCount) => setCount(data))
      .catch((err) => {
        if (err.name !== "AbortError") {
          // Silent fail — banner just doesn't render, page still works.
        }
      });
    return () => controller.abort();
  }, []);

  if (!count || count.exhausted) return null;

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
        <Lock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        <span className="text-amber-600 dark:text-amber-400">
          <span className="font-semibold">{count.remaining.toLocaleString()}</span>
          <span className="text-muted-foreground"> of {count.total.toLocaleString()} Founding Member spots left. Lock in current pricing for life.</span>
        </span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-sm">
      <Wand2 className="h-3.5 w-3.5 text-amber-500" />
      <span className="text-amber-600 dark:text-amber-400">
        Founding Member:{" "}
        <span className="font-semibold">{count.remaining.toLocaleString()}/{count.total.toLocaleString()}</span>
        <span className="text-muted-foreground"> spots remaining. Lock in current pricing for life.</span>
      </span>
    </div>
  );
}
