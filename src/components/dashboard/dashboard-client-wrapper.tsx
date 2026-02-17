"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { OnboardingProvider } from "./onboarding-provider";
import { PageTransition } from "@/components/shared/motion";
import { PostHogIdentify } from "@/components/providers/posthog-provider";
import { useAutoTimezone } from "@/hooks/use-auto-timezone";

interface DashboardClientWrapperProps {
  children: ReactNode;
  isNewUser: boolean;
  userName?: string;
  userPlan?: "free" | "pro" | "enterprise";
}

// Common dashboard routes to prefetch for faster navigation
const PREFETCH_ROUTES = [
  "/dashboard",
  "/dashboard/monitors",
  "/dashboard/results",
  "/dashboard/settings",
];

export function DashboardClientWrapper({
  children,
  isNewUser,
  userName,
  userPlan = "free",
}: DashboardClientWrapperProps) {
  const router = useRouter();

  // Auto-detect and save user's timezone on first visit
  useAutoTimezone();

  // Prefetch common routes on mount for faster navigation
  useEffect(() => {
    // Small delay to not block initial render
    const timeoutId = setTimeout(() => {
      PREFETCH_ROUTES.forEach((route) => {
        router.prefetch(route);
      });
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [router]);

  return (
    <OnboardingProvider isNewUser={isNewUser} userName={userName} userPlan={userPlan}>
      <PostHogIdentify />
      <PageTransition>{children}</PageTransition>
    </OnboardingProvider>
  );
}
