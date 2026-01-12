import type { Metadata } from "next";
import localFont from "next/font/local";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/toaster";
import { PostHogProvider, PostHogIdentify } from "@/components/shared/posthog-provider";
import { PostHogPageView } from "@/components/shared/posthog-pageview";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Kaulby - AI-Powered Community Monitoring",
  description: "Track discussions across Reddit, Hacker News, and online communities. AI-powered pain point detection, sentiment analysis, and natural language querying.",
};

// Check if Clerk is fully configured
const isClerkConfigured = !!(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  process.env.CLERK_SECRET_KEY
);

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const content = (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PostHogProvider>
          <PostHogPageView />
          {isClerkConfigured && <PostHogIdentify />}
          {children}
          <Toaster />
        </PostHogProvider>
      </body>
    </html>
  );

  // Only wrap with ClerkProvider if fully configured
  if (isClerkConfigured) {
    return <ClerkProvider>{content}</ClerkProvider>;
  }

  return content;
}
