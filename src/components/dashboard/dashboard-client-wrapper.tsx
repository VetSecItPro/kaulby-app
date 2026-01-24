"use client";

import { ReactNode } from "react";
import { OnboardingProvider } from "./onboarding-provider";
import { PageTransition } from "@/components/shared/motion";
import { useAutoTimezone } from "@/hooks/use-auto-timezone";

interface DashboardClientWrapperProps {
  children: ReactNode;
  isNewUser: boolean;
  userName?: string;
  userPlan?: "free" | "pro" | "enterprise";
}

export function DashboardClientWrapper({
  children,
  isNewUser,
  userName,
  userPlan = "free",
}: DashboardClientWrapperProps) {
  // Auto-detect and save user's timezone on first visit
  useAutoTimezone();

  return (
    <OnboardingProvider isNewUser={isNewUser} userName={userName} userPlan={userPlan}>
      <PageTransition>{children}</PageTransition>
    </OnboardingProvider>
  );
}
