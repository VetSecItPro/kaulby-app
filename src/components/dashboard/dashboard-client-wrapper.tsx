"use client";

import { ReactNode } from "react";
import { OnboardingProvider } from "./onboarding-provider";
import { PageTransition } from "@/components/shared/motion";

interface DashboardClientWrapperProps {
  children: ReactNode;
  isNewUser: boolean;
  userName?: string;
}

export function DashboardClientWrapper({
  children,
  isNewUser,
  userName,
}: DashboardClientWrapperProps) {
  return (
    <OnboardingProvider isNewUser={isNewUser} userName={userName}>
      <PageTransition>{children}</PageTransition>
    </OnboardingProvider>
  );
}
