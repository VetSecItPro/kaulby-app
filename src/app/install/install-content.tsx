"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Smartphone,
  Monitor,
  Download,
  Wifi,
  AppWindow,
  Bell,
  Share2,
  MoreVertical,
  Chrome,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Platform = "ios" | "android" | "chrome" | "edge" | "other";

interface PlatformInfo {
  key: Platform;
  label: string;
  icon: typeof Smartphone;
  steps: string[];
}

interface BenefitInfo {
  icon: typeof Wifi;
  title: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

function detectPlatform(ua: string): Platform {
  // iOS Safari — exclude Chrome-on-iOS (CriOS) and Firefox-on-iOS (FxiOS)
  if (/iPhone|iPad/.test(ua) && !/CriOS|FxiOS/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Edg/.test(ua)) return "edge";
  if (/Chrome/.test(ua) && !/Edg/.test(ua)) return "chrome";
  return "other";
}

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

const PLATFORMS: PlatformInfo[] = [
  {
    key: "ios",
    label: "iPhone & iPad",
    icon: Smartphone,
    steps: [
      "Open kaulbyapp.com in Safari",
      "Tap the Share button (square with arrow) at the bottom",
      'Scroll down and tap "Add to Home Screen"',
      'Tap "Add" to confirm',
    ],
  },
  {
    key: "android",
    label: "Android",
    icon: Smartphone,
    steps: [
      "Open kaulbyapp.com in Chrome",
      "Tap the three-dot menu (top right)",
      'Tap "Install app" or "Add to home screen"',
      'Tap "Install" to confirm',
    ],
  },
  {
    key: "chrome",
    label: "Desktop Chrome",
    icon: Monitor,
    steps: [
      "Open kaulbyapp.com in Chrome",
      "Click the install icon in the address bar (monitor with arrow)",
      'Click "Install" in the popup',
    ],
  },
  {
    key: "edge",
    label: "Desktop Edge / Other",
    icon: Monitor,
    steps: [
      "Open kaulbyapp.com in Edge",
      'Click the "App available" icon in the address bar',
      'Click "Install"',
    ],
  },
];

const BENEFITS: BenefitInfo[] = [
  {
    icon: Wifi,
    title: "Offline Support",
    description: "Access your dashboard even without internet",
  },
  {
    icon: Smartphone,
    title: "Home Screen Access",
    description: "Launch Kaulby with a single tap",
  },
  {
    icon: AppWindow,
    title: "Standalone Window",
    description: "Full-screen experience without browser chrome",
  },
  {
    icon: Bell,
    title: "Push Notifications",
    description: "Get instant alerts for important mentions",
  },
];

/** Map each platform key to a decorative icon for the step list */
const STEP_ICON_MAP: Record<Platform, typeof Share2> = {
  ios: Share2,
  android: MoreVertical,
  chrome: Chrome,
  edge: Monitor,
  other: Monitor,
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PlatformCard({
  platform,
  highlighted,
}: {
  platform: PlatformInfo;
  highlighted: boolean;
}) {
  const Icon = platform.icon;
  const StepIcon = STEP_ICON_MAP[platform.key];

  return (
    <div
      className={cn(
        "rounded-xl border p-6 transition-all duration-200",
        highlighted
          ? "ring-2 ring-teal-500/40 bg-teal-500/5 border-teal-500/30"
          : "bg-card border-border hover:bg-muted/50"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-lg",
            highlighted ? "bg-teal-500/15" : "bg-muted"
          )}
        >
          <Icon
            className={cn(
              "w-5 h-5",
              highlighted ? "text-teal-500" : "text-muted-foreground"
            )}
          />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">
            {platform.label}
          </h3>
          {highlighted && (
            <span className="text-[11px] font-medium text-teal-500 uppercase tracking-wider">
              Your device
            </span>
          )}
        </div>
        {/* Decorative step icon */}
        <StepIcon className="ml-auto w-4 h-4 text-muted-foreground/40" />
      </div>

      {/* Steps */}
      <ol className="space-y-3">
        {platform.steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="flex-shrink-0 bg-teal-500 text-black rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
              {i + 1}
            </span>
            <span className="text-sm text-muted-foreground leading-relaxed pt-0.5">
              {step}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function BenefitCard({ benefit }: { benefit: BenefitInfo }) {
  const Icon = benefit.icon;
  return (
    <div className="flex flex-col items-center text-center rounded-xl border border-border bg-card p-6 transition-colors hover:bg-muted/50">
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-teal-500/10 mb-4">
        <Icon className="w-6 h-6 text-teal-500" />
      </div>
      <h4 className="text-sm font-semibold text-foreground mb-1">
        {benefit.title}
      </h4>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {benefit.description}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallContent() {
  const [detectedPlatform, setDetectedPlatform] = useState<Platform>("other");
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  // Detect platform on mount
  useEffect(() => {
    setDetectedPlatform(detectPlatform(navigator.userAgent));
  }, []);

  // Capture the beforeinstallprompt event (Chrome/Edge only)
  useEffect(() => {
    function handleBIP(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", handleBIP);
    return () => window.removeEventListener("beforeinstallprompt", handleBIP);
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  // Put the detected platform first, then the rest
  const sortedPlatforms = [
    ...PLATFORMS.filter((p) => p.key === detectedPlatform),
    ...PLATFORMS.filter((p) => p.key !== detectedPlatform),
  ];

  return (
    <>
      {/* Native install button (Chrome/Edge only) */}
      {deferredPrompt && (
        <button
          onClick={handleInstallClick}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 text-black font-semibold text-sm shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 transition-all duration-200 hover:-translate-y-0.5 mb-10"
        >
          <Download className="w-4 h-4" />
          Install Now
        </button>
      )}

      {/* Platform cards */}
      <section className="pb-12 text-left">
        <h2 className="text-lg font-semibold text-foreground mb-5">
          Installation Instructions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedPlatforms.map((platform) => (
            <PlatformCard
              key={platform.key}
              platform={platform}
              highlighted={platform.key === detectedPlatform}
            />
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="pb-12 text-left">
        <h2 className="text-lg font-semibold text-foreground mb-5">
          What You Get
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {BENEFITS.map((benefit) => (
            <BenefitCard key={benefit.title} benefit={benefit} />
          ))}
        </div>
      </section>
    </>
  );
}
