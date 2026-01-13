"use client";

import { ReactNode } from "react";
import { OnboardingProvider } from "./onboarding-provider";

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
      {children}
    </OnboardingProvider>
  );
}
