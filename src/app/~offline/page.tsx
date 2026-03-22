import type { Metadata } from "next";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = {
  title: "Offline | Kaulby",
};

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <WifiOff className="w-8 h-8 text-muted-foreground" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">You&apos;re offline</h1>
          <p className="text-muted-foreground">
            Check your internet connection and try again. Previously visited pages may still be available.
          </p>
        </div>

        <a
          href="."
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
        >
          Try Again
        </a>
      </div>
    </div>
  );
}
