"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Download, Zap, Wifi, Bell } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Shared hook for PWA install prompt
function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);

    if (outcome === "accepted") {
      setIsInstalled(true);
      return true;
    }
    return false;
  };

  return { canInstall: !!deferredPrompt && !isInstalled, isInstalled, install };
}

// Inline install button for use in page content
export function PWAInstallButton() {
  const { canInstall, isInstalled, install } = usePWAInstall();

  if (isInstalled) {
    return (
      <Button variant="outline" disabled className="gap-2">
        <Download className="h-4 w-4" />
        App Installed
      </Button>
    );
  }

  if (!canInstall) {
    return (
      <Button variant="outline" disabled className="gap-2">
        <Download className="h-4 w-4" />
        Install App
      </Button>
    );
  }

  return (
    <Button onClick={install} variant="outline" className="gap-2">
      <Download className="h-4 w-4" />
      Install App
    </Button>
  );
}

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed this session
    const wasDismissed = sessionStorage.getItem("pwa-banner-dismissed");
    if (wasDismissed) {
      setDismissed(true);
      return;
    }

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setDismissed(true);
    sessionStorage.setItem("pwa-banner-dismissed", "true");
  };

  if (!showBanner || dismissed) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-fade-up">
      <div className="container mx-auto max-w-lg">
        <div className="relative rounded-xl border border-primary/20 bg-gradient-to-b from-card to-card/80 backdrop-blur-lg p-6 shadow-2xl shadow-primary/10">
          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Content */}
          <div className="text-center space-y-4">
            {/* Icon */}
            <div className="mx-auto h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Download className="h-6 w-6 text-primary" />
            </div>

            {/* Title & Description */}
            <div className="space-y-1">
              <h3 className="font-semibold text-lg">Install Kaulby</h3>
              <p className="text-sm text-muted-foreground">
                Add to your home screen for the best experience
              </p>
            </div>

            {/* Install Button */}
            <Button onClick={handleInstall} className="gap-2">
              <Download className="h-4 w-4" />
              Install App
            </Button>

            {/* Features */}
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2">
              <span className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-primary" />
                Lightning fast
              </span>
              <span className="flex items-center gap-1.5">
                <Wifi className="h-3.5 w-3.5 text-primary" />
                Works offline
              </span>
              <span className="flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5 text-primary" />
                Push notifications
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
