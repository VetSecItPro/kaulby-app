"use client";

import { memo } from "react";
import { ShieldCheck, Shield } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type AuthorityTier = "high" | "medium" | "low";

const PLATFORM_AUTHORITY: Record<string, { tier: AuthorityTier; label: string }> = {
  // High authority - established platforms with quality signals
  hackernews: { tier: "high", label: "High Authority" },
  github: { tier: "high", label: "High Authority" },
  producthunt: { tier: "high", label: "High Authority" },
  g2: { tier: "high", label: "High Authority" },

  // Medium authority - popular but mixed quality
  reddit: { tier: "medium", label: "Medium Authority" },
  youtube: { tier: "medium", label: "Medium Authority" },
  trustpilot: { tier: "medium", label: "Medium Authority" },
  googlereviews: { tier: "medium", label: "Medium Authority" },
  devto: { tier: "medium", label: "Medium Authority" },
  hashnode: { tier: "medium", label: "Medium Authority" },

  // Lower authority - anyone can post
  quora: { tier: "low", label: "General" },
  appstore: { tier: "low", label: "General" },
  playstore: { tier: "low", label: "General" },
  yelp: { tier: "low", label: "General" },
  amazon: { tier: "low", label: "General" },
  indiehackers: { tier: "low", label: "General" },
  x: { tier: "low", label: "General" },
};

interface SourceAuthorityBadgeProps {
  platform: string;
}

export const SourceAuthorityBadge = memo(function SourceAuthorityBadge({
  platform,
}: SourceAuthorityBadgeProps) {
  const authority = PLATFORM_AUTHORITY[platform];

  // Don't render for unknown platforms or low authority
  if (!authority || authority.tier === "low") {
    return null;
  }

  if (authority.tier === "high") {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <ShieldCheck className="h-4 w-4 text-green-500 shrink-0" />
          </TooltipTrigger>
          <TooltipContent>
            <p>High authority source</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Medium authority
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Shield className="h-4 w-4 text-blue-500 shrink-0" />
        </TooltipTrigger>
        <TooltipContent>
          <p>Established platform</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
