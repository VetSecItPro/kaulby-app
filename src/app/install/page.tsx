import type { Metadata } from "next";
import Link from "next/link";
import { Download, ArrowLeft } from "lucide-react";
import { MarketingHeader } from "@/components/shared/marketing-header";
import { MarketingFooter } from "@/components/shared/marketing-footer";
import { InstallContent } from "./install-content";

export const metadata: Metadata = {
  title: "Install Kaulby | Add to Home Screen",
  description: "Install Kaulby on your device for faster access, offline support, and a native app experience. Works on iOS, Android, and desktop.",
  openGraph: {
    title: "Install Kaulby | Add to Home Screen",
    description: "Install Kaulby on your device for faster access, offline support, and a native app experience.",
  },
};

export default function InstallPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MarketingHeader />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 pb-28 sm:pb-8">
        {/* Hero */}
        <section className="text-center pt-10 pb-10 sm:pt-16 sm:pb-14">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-500/10 mb-6">
            <Download className="w-8 h-8 text-teal-500" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-3">
            Install Kaulby
          </h1>
          <p className="text-base text-muted-foreground max-w-md mx-auto mb-6">
            Get the full app experience on any device
          </p>

          {/* Client component handles the native install button and platform detection */}
          <InstallContent />
        </section>

        {/* Back link */}
        <div className="pt-2 pb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
