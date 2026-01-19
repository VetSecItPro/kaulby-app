"use client";

import { ReactNode } from "react";
import { OnboardingProvider } from "./onboarding-provider";
import { PageTransition } from "@/components/shared/motion";

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
  return (
    <OnboardingProvider isNewUser={isNewUser} userName={userName} userPlan={userPlan}>
      <PageTransition>{children}</PageTransition>
    </OnboardingProvider>
  );
}
