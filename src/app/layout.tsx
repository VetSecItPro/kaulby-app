import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Instrument_Serif } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import { ResilientClerkProvider } from "@/components/shared/clerk-provider";
import { CookieConsent } from "@/components/shared/cookie-consent";
import { ServiceWorkerRegister } from "@/components/shared/service-worker-register";
import { PWAInstallPrompt } from "@/components/shared/pwa-install-prompt";
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
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0a0a0a",
};

// Metadata
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://kaulbyapp.com"),
  title: "Kaulby - AI-Powered Community Monitoring",
  description: "Track discussions across Reddit, Hacker News, and online communities. AI-powered pain point detection, sentiment analysis, and natural language querying.",
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
    title: "Kaulby - AI-Powered Community Monitoring",
    description: "Track discussions across Reddit, Hacker News, and online communities. Get AI-powered insights and instant alerts.",
    url: "https://kaulbyapp.com",
    siteName: "Kaulby",
    images: [
      {
        url: "/icon-512.png",
        width: 512,
        height: 512,
        alt: "Kaulby Logo",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Kaulby - AI-Powered Community Monitoring",
    description: "Track discussions across Reddit, Hacker News, and online communities.",
    images: ["/icon-512.png"],
  },
  manifest: "/manifest.json",
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
        <link rel="dns-prefetch" href="https://api.polar.sh" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} antialiased bg-background`}
        suppressHydrationWarning
      >
        {/* A11Y: Skip to main content link — FIX-302 */}
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:text-black focus:px-4 focus:py-2 focus:rounded">
          Skip to main content
        </a>

        {/* Sitewide Structured Data for SEO & AEO */}
        <OrganizationSchema />
        <SoftwareApplicationSchema />

        <ResilientClerkProvider>
          <ServiceWorkerRegister />
          <div id="main-content">
            {children}
          </div>
          <Toaster />
          <CookieConsent />
          <PWAInstallPrompt />
        </ResilientClerkProvider>
      </body>
    </html>
  );
}
