import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Instrument_Serif } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import { ResilientClerkProvider } from "@/components/shared/clerk-provider";
import { CookieConsent } from "@/components/shared/cookie-consent";
import { PostHogProvider } from "@/components/shared/posthog-provider";
// PWA: Service worker registration handled by @serwist/next (auto-register)
import { PWAInstallPrompt } from "@/components/shared/pwa-install-prompt";
import { ServiceWorkerUpdater } from "@/components/shared/service-worker-updater";
import { OrganizationSchema, SoftwareApplicationSchema } from "@/lib/seo/structured-data";

import "./globals.css";

// Font configuration
const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
  preload: true,
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
  preload: true,
});

// Serif font for elegant headers
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-serif",
  display: "swap",
});

// Viewport configuration
// viewportFit=cover lets the app extend into iPhone X+ notch / Dynamic Island.
// colorScheme=dark tells Safari/Chrome to render native scrollbars + form
// controls in dark mode (matches the always-dark app theme, no white flash).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0a0a0a",
  colorScheme: "dark",
  viewportFit: "cover",
};

// Metadata
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://kaulbyapp.com"),
  title: "Kaulby - Find Customer Pain Points, Competitor Gaps & Buying Signals",
  description: "Monitor Reddit, Hacker News, reviews, and 16 platforms. AI-powered pain point detection, competitor intelligence, and buying signal scoring for founders and SaaS teams.",
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "Kaulby - Find Customer Pain Points, Competitor Gaps & Buying Signals",
    description: "Monitor Reddit, reviews, Hacker News, and 16 platforms. AI surfaces pain points, competitor weaknesses, and buying signals for founders and SaaS teams.",
    url: "https://kaulbyapp.com",
    siteName: "Kaulby",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Kaulby - Customer Pain Points, Competitor Gaps & Buying Signals Dashboard",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kaulby - Find Customer Pain Points, Competitor Gaps & Buying Signals",
    description: "Monitor Reddit, reviews, and 16 platforms. AI-powered pain point detection, competitor intelligence, and buying signal scoring.",
    images: ["/opengraph-image"],
  },
  manifest: "/manifest.json",
  // PWA: iOS standalone behavior. Without these the installed iOS PWA shows
  // the Safari address bar in standalone mode (looks broken). black-translucent
  // lets the page extend behind the status bar (paired with viewportFit=cover).
  appleWebApp: {
    capable: true,
    title: "Kaulby",
    statusBarStyle: "black-translucent",
  },
  alternates: {
    canonical: "https://kaulbyapp.com", // SEO: FIX-320
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* Preconnect for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://img.clerk.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://us.i.posthog.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://clerk.kaulbyapp.com" />
        <link rel="dns-prefetch" href="https://api.polar.sh" />
        <link rel="dns-prefetch" href="https://us-assets.i.posthog.com" />

        {/* PWA: iOS launch images. Each <link> matches a specific device via
            its CSS dimensions + device-pixel-ratio. iOS picks the closest. */}
        <link rel="apple-touch-startup-image" href="/splash/iphone-se-750x1334.png"
          media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/iphone-11-828x1792.png"
          media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/iphone-14-1170x2532.png"
          media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/iphone-14-pro-max-1290x2796.png"
          media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/ipad-pro-11-1668x2388.png"
          media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/ipad-pro-12-9-2048x2732.png"
          media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} antialiased bg-background`}
        suppressHydrationWarning
      >
        {/* A11Y: Skip to main content link - FIX-302 */}
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded">
          Skip to main content
        </a>

        {/* Sitewide Structured Data for SEO & AEO */}
        <OrganizationSchema />
        <SoftwareApplicationSchema />

        <ResilientClerkProvider>
          <PostHogProvider>
            <div id="main-content">
              {children}
            </div>
            <Toaster />
            <CookieConsent />
            <PWAInstallPrompt />
            <ServiceWorkerUpdater />
          </PostHogProvider>
        </ResilientClerkProvider>
      </body>
    </html>
  );
}
