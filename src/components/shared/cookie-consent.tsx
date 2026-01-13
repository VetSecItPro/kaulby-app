"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { X } from "lucide-react";

const CONSENT_KEY = "kaulby_cookie_consent";

export type ConsentStatus = "pending" | "accepted" | "rejected";

export interface CookieConsent {
  analytics: boolean;
  marketing: boolean;
  timestamp: number;
}

export function getConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent(): boolean {
  const consent = getConsent();
  return consent?.analytics === true;
}

export function setConsent(consent: CookieConsent): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));

  // Dispatch event so other components can react
  window.dispatchEvent(new CustomEvent("cookieConsentChange", { detail: consent }));
}

export function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if user has already made a choice
    const existingConsent = getConsent();
    if (!existingConsent) {
      // Small delay for better UX
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    setConsent({
      analytics: true,
      marketing: false, // We don't use marketing cookies
      timestamp: Date.now(),
    });
    setIsVisible(false);
  };

  const handleRejectAll = () => {
    setConsent({
      analytics: false,
      marketing: false,
      timestamp: Date.now(),
    });
    setIsVisible(false);
  };

  const handleEssentialOnly = () => {
    setConsent({
      analytics: false,
      marketing: false,
      timestamp: Date.now(),
    });
    setIsVisible(false);
  };

  // Don't render on server or if already consented
  if (!mounted || !isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-fade-up">
      <Card className="max-w-2xl mx-auto p-6 bg-card/95 backdrop-blur-lg border-border/50 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-semibold text-base mb-2">We value your privacy</h3>
            <p className="text-sm text-muted-foreground mb-4">
              We use essential cookies for site functionality and optional analytics
              to improve our service. We don&apos;t sell your data or use marketing trackers.{" "}
              <Link href="/privacy" className="text-primary hover:underline">
                Learn more
              </Link>
            </p>

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleAcceptAll} size="sm">
                Accept All
              </Button>
              <Button onClick={handleEssentialOnly} variant="outline" size="sm">
                Essential Only
              </Button>
              <Button onClick={handleRejectAll} variant="ghost" size="sm">
                Reject All
              </Button>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleEssentialOnly}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}

// Hook to check consent status
export function useCookieConsent() {
  const [consent, setConsentState] = useState<CookieConsent | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setConsentState(getConsent());
    setIsLoaded(true);

    const handleChange = (e: CustomEvent<CookieConsent>) => {
      setConsentState(e.detail);
    };

    window.addEventListener("cookieConsentChange", handleChange as EventListener);
    return () => {
      window.removeEventListener("cookieConsentChange", handleChange as EventListener);
    };
  }, []);

  return {
    consent,
    isLoaded,
    hasAnalyticsConsent: consent?.analytics === true,
  };
}
