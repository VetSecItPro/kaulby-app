"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

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

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);

    if (outcome === "accepted") {
      setIsInstalled(true);
    }
  };

  // Determine button state and tooltip
  const canInstall = mounted && !isInstalled && !!deferredPrompt;
  const buttonText = isInstalled ? "App Installed" : "Install App";

  const getTooltipText = () => {
    if (isInstalled) return "Kaulby is already installed on your device";
    if (!deferredPrompt) return "App installation not available in your browser. You can still use Kaulby in your browser.";
    return "Install Kaulby for faster access and notifications";
  };

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-help">
            <Button
              onClick={handleInstall}
              variant="secondary"
              className="gap-2 bg-white hover:bg-white/90 text-black border-0 disabled:bg-white/20 disabled:text-white/50"
              disabled={!canInstall}
              style={{ pointerEvents: canInstall ? 'auto' : 'none' }}
            >
              <Download className="h-4 w-4" />
              {buttonText}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] text-center text-xs">
          <p>{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
