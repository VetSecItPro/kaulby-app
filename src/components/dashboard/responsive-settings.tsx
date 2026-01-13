"use client";

import { useDevice } from "@/hooks/use-device";
import { MobileSettings } from "@/components/mobile/mobile-settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap } from "lucide-react";

interface Plan {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  current: boolean;
  recommended?: boolean;
}

interface ResponsiveSettingsProps {
  email: string;
  name: string;
  subscriptionStatus: string;
  plans: Plan[];
}

export function ResponsiveSettings({
  email,
  name,
  subscriptionStatus,
  plans,
}: ResponsiveSettingsProps) {
  const { isMobile, isTablet } = useDevice();

  if (isMobile || isTablet) {
    return (
      <MobileSettings
        email={email}
        name={name}
        subscriptionStatus={subscriptionStatus}
        plans={plans}
      />
    );
  }

  // Desktop view
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and subscription.
        </p>
      </div>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium">{email}</span>
          </div>
          <div className="grid gap-1">
            <span className="text-sm text-muted-foreground">Name</span>
            <span className="text-sm font-medium">{name}</span>
          </div>
          <div className="grid gap-1">
            <span className="text-sm text-muted-foreground">Current Plan</span>
            <div className="flex items-center gap-2">
              <Badge
                variant={subscriptionStatus === "free" ? "secondary" : "default"}
                className="capitalize"
              >
                {subscriptionStatus}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscription Plans */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Subscription Plans</h2>
          <p className="text-sm text-muted-foreground">
            Choose the plan that best fits your needs.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.name} className={plan.recommended ? "border-primary" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  {plan.recommended && (
                    <Badge variant="default" className="gap-1">
                      <Zap className="h-3 w-3" />
                      Recommended
                    </Badge>
                  )}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  {plan.period && (
                    <span className="text-muted-foreground">{plan.period}</span>
                  )}
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {plan.current ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current Plan
                  </Button>
                ) : plan.name === "Enterprise" ? (
                  <Button variant="outline" className="w-full">
                    Contact Sales
                  </Button>
                ) : (
                  <Button className="w-full">Upgrade to {plan.name}</Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
