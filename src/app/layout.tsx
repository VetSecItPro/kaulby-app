import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Instrument_Serif } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import { DeviceProvider } from "@/hooks/use-device";
import { ResilientClerkProvider } from "@/components/shared/clerk-provider";
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
        {/* Sitewide Structured Data for SEO & AEO */}
        <OrganizationSchema />
        <SoftwareApplicationSchema />

        <ResilientClerkProvider>
          <DeviceProvider>
            {children}
            <Toaster />
          </DeviceProvider>
        </ResilientClerkProvider>
      </body>
    </html>
  );
}
