import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/toaster";
import { PostHogProvider, PostHogIdentify } from "@/components/shared/posthog-provider";
import { PostHogPageView } from "@/components/shared/posthog-pageview";
import { CookieConsentBanner } from "@/components/shared/cookie-consent";
import { DeviceProvider } from "@/hooks/use-device";
import { ServiceWorkerRegister } from "@/components/shared/service-worker-register";
import "./globals.css";

// Optimize font loading with display swap for faster text rendering
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

// Viewport configuration for optimal mobile rendering
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0a0a0a",
};

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
};

// Check if Clerk is configured (only check public key - available on both client/server)
const isClerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const content = (
    <html lang="en" className="dark">
      <head>
        {/* Preconnect to critical third-party origins for faster loading */}
        <link rel="preconnect" href="https://clerk.kaulbyapp.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://us.posthog.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />

        {/* DNS prefetch for faster resolution */}
        <link rel="dns-prefetch" href="https://clerk.kaulbyapp.com" />
        <link rel="dns-prefetch" href="https://us.posthog.com" />
        <link rel="dns-prefetch" href="https://api.stripe.com" />

        {/* Preload critical assets */}
        <link rel="preload" href="/logo.jpg" as="image" type="image/jpeg" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background`}
      >
        <DeviceProvider>
          <PostHogProvider>
            <PostHogPageView />
            {isClerkConfigured && <PostHogIdentify />}
            {children}
            <Toaster />
            <CookieConsentBanner />
            <ServiceWorkerRegister />
          </PostHogProvider>
        </DeviceProvider>
      </body>
    </html>
  );

  // Only wrap with ClerkProvider if fully configured
  if (isClerkConfigured) {
    return <ClerkProvider>{content}</ClerkProvider>;
  }

  return content;
}
