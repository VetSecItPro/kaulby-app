"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Home, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-destructive" />
          </div>
          <CardTitle className="text-xl">Dashboard Error</CardTitle>
          <CardDescription>
            Something went wrong while loading this page. You can try again or navigate elsewhere.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error.digest && (
            <div className="bg-muted rounded-md p-3 text-center">
              <p className="text-xs text-muted-foreground font-mono">
                Error ID: {error.digest}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button onClick={reset} className="w-full gap-2">
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => router.back()}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Go Back
              </Button>
              <Link href="/dashboard" className="w-full">
                <Button variant="outline" className="w-full gap-2">
                  <Home className="w-4 h-4" />
                  Dashboard
                </Button>
              </Link>
            </div>
          </div>

          <p className="text-sm text-muted-foreground text-center pt-2">
            Need help?{" "}
            <Link href="/dashboard/help" className="text-primary hover:underline">
              Contact support
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
