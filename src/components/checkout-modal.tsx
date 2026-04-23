"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink } from "lucide-react";
import type { BillingInterval } from "@/lib/plans";

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: "starter" | "pro" | "team";
  planName: string;
  billingInterval?: BillingInterval;
}

export function CheckoutModal({
  open,
  onOpenChange,
  plan,
  planName,
  billingInterval = "monthly",
}: CheckoutModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setLoading(false);
      setError(null);
    }
  }, [open]);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/polar/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan, billingInterval }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create checkout session");
      }

      const data = await response.json();

      // Redirect to Polar checkout
      if (data.url) {
        window.location.href = data.url;
        // Reset loading after a delay in case redirect is slow
        setTimeout(() => setLoading(false), 5000);
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  const priceByPlan = {
    starter: { monthly: "$49/month", annual: "$470/year" },
    pro: { monthly: "$29/month", annual: "$290/year" },
    team: { monthly: "$99/month", annual: "$990/year" },
  } as const;
  const price = priceByPlan[plan][billingInterval];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Upgrade to {planName}</DialogTitle>
          <DialogDescription>
            You&apos;ll be redirected to our secure payment provider to complete your purchase.
          </DialogDescription>
        </DialogHeader>
        <div className="py-6">
          <div className="text-center mb-6">
            <div className="text-3xl font-bold">{price}</div>
            <div className="text-sm text-muted-foreground mt-1">
              {billingInterval === "annual" ? "Billed annually (2 months free)" : "Billed monthly"}
            </div>
          </div>

          {error ? (
            <div className="text-center py-4">
              <p className="text-destructive mb-4 text-sm">{error}</p>
              <Button
                variant="outline"
                onClick={() => setError(null)}
                size="sm"
              >
                Try again
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redirecting...
                </>
              ) : (
                <>
                  Continue to Checkout
                  <ExternalLink className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          )}

          <p className="text-xs text-muted-foreground text-center mt-4">
            Secure payment powered by Polar. Cancel anytime.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

