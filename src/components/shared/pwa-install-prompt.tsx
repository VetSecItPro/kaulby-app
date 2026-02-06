"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Download } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** localStorage key used to track when the user last dismissed the banner */
const DISMISS_KEY = "pwa-install-dismissed";

/** Number of milliseconds in 7 days */
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/** Delay before showing the banner after page load (ms) */
const SHOW_DELAY_MS = 30_000;

/**
 * Extends the global BeforeInstallPromptEvent type used by Chromium browsers.
 * This event is fired when the browser determines the site meets PWA
 * installability criteria.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  prompt(): Promise<void>;
}

/**
 * Detects whether the current browser is Safari on iOS (not Chrome or Firefox
 * on iOS, which use their own install flows).
 */
function isIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad/.test(ua);
  const isChromeIOS = /CriOS/.test(ua);
  const isFirefoxIOS = /FxiOS/.test(ua);
  return isIOS && !isChromeIOS && !isFirefoxIOS;
}

/**
 * Detects whether the user is on a mobile device (phone or tablet).
 */
function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

/**
 * Checks whether the app is already running in standalone (installed) mode.
 */
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const matchesStandalone = window.matchMedia(
    "(display-mode: standalone)"
  ).matches;
  const navigatorStandalone = (
    navigator as unknown as { standalone?: boolean }
  ).standalone;
  return matchesStandalone || navigatorStandalone === true;
}

/**
 * Checks whether the user dismissed the banner within the cooldown period.
 */
function isDismissedRecently(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (!dismissed) return false;
    const timestamp = parseInt(dismissed, 10);
    if (isNaN(timestamp)) return false;
    return Date.now() - timestamp < COOLDOWN_MS;
  } catch {
    return false;
  }
}

/**
 * Inline SVG share icon matching iOS Safari's share button appearance.
 * Used in the iOS-specific install instructions.
 */
function ShareIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="inline-block align-text-bottom mx-0.5 text-teal-400"
      aria-hidden="true"
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

/**
 * Smart PWA install banner that adapts to the user's platform.
 *
 * - On Chrome/Edge/Android: intercepts `beforeinstallprompt` and triggers the
 *   native install dialog when the user taps "Install".
 * - On iOS Safari: shows instructions to use the Share menu and "Add to Home
 *   Screen" since there is no programmatic install API.
 * - Hides automatically if the app is already installed (standalone mode).
 * - Respects a 7-day cooldown after the user dismisses the banner.
 * - Waits 30 seconds after page load before appearing to avoid disrupting
 *   first-time visitors.
 */
export function PWAInstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  const dismiss = useCallback(() => {
    setAnimateIn(false);
    // Wait for the slide-out animation to complete before unmounting
    setTimeout(() => setVisible(false), 300);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // localStorage may be unavailable in private browsing
    }
  }, []);

  const handleInstall = useCallback(async () => {
    const event = deferredPromptRef.current;
    if (!event) return;

    await event.prompt();
    const { outcome } = await event.userChoice;

    if (outcome === "accepted") {
      deferredPromptRef.current = null;
      setAnimateIn(false);
      setTimeout(() => setVisible(false), 300);
    }
  }, []);

  useEffect(() => {
    // Don't show if already installed or recently dismissed
    if (isStandalone() || isDismissedRecently()) return;

    const ios = isIOSSafari();
    const mobile = isMobileDevice();
    setIsIOS(ios);
    setIsMobile(mobile);

    let mounted = true;

    const onBeforeInstallPrompt = (e: Event) => {
      // Prevent the browser's default mini-infobar
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
    };

    // Listen for Chromium's install prompt event
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    // Show the banner after the configured delay
    const showTimer = setTimeout(() => {
      if (!mounted) return;
      // On non-iOS, only show if we captured a beforeinstallprompt OR it's iOS
      if (ios || deferredPromptRef.current) {
        setVisible(true);
        // Trigger the slide-in animation on the next frame
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (mounted) setAnimateIn(true);
          });
        });
      }
    }, SHOW_DELAY_MS);

    return () => {
      mounted = false;
      if (showTimer) clearTimeout(showTimer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed bottom-[72px] sm:bottom-0 left-0 right-0 z-50",
        "bg-background/95 backdrop-blur-xl",
        "border-t border-border",
        "transition-all duration-300 ease-out",
        animateIn
          ? "translate-y-0 opacity-100"
          : "translate-y-full opacity-0"
      )}
      role="banner"
      aria-label="Install Kaulby app"
    >
      <div className="max-w-3xl mx-auto px-4 py-3">
        <div className="flex items-center gap-3">
          {/* App icon and text */}
          <Image
            src="/icon-192.png"
            alt="Kaulby app icon"
            width={40}
            height={40}
            sizes="40px"
            className="rounded-lg flex-shrink-0"
          />

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Add Kaulby to your {isMobile ? "home screen" : "desktop"}
            </p>
            {isIOS ? (
              <p className="text-xs text-muted-foreground mt-0.5">
                Tap <ShareIcon /> then &ldquo;Add to Home Screen&rdquo;
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">
                Installs locally — no app store, works offline
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={dismiss}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Dismiss install prompt"
            >
              <X className="w-4 h-4" />
            </button>

            {isIOS ? (
              <Link
                href="/install"
                className="bg-teal-500 hover:bg-teal-600 text-black px-4 py-2 rounded-lg font-medium text-sm transition-colors"
              >
                How to Install
              </Link>
            ) : (
              <button
                onClick={handleInstall}
                className="flex items-center gap-1.5 bg-teal-500 hover:bg-teal-600 text-black px-4 py-2 rounded-lg font-medium text-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                Install
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
