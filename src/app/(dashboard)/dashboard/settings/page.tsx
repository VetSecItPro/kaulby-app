import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap } from "lucide-react";

export default async function SettingsPage() {
  const { userId } = await auth();
  const clerkUser = await currentUser();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  const subscriptionStatus = user?.subscriptionStatus || "free";

  const plans = [
    {
      name: "Free",
      price: "$0",
      description: "Get started with basic monitoring",
      features: ["3 monitors", "100 results/month", "Basic analytics"],
      current: subscriptionStatus === "free",
    },
    {
      name: "Pro",
      price: "$29",
      period: "/month",
      description: "For growing businesses",
      features: [
        "20 monitors",
        "5,000 results/month",
        "AI-powered insights",
        "Email & Slack alerts",
        "Priority support",
      ],
      current: subscriptionStatus === "pro",
      recommended: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      description: "For large organizations",
      features: [
        "Unlimited monitors",
        "Unlimited results",
        "Advanced AI analysis",
        "Custom integrations",
        "Dedicated support",
        "SLA guarantee",
      ],
      current: subscriptionStatus === "enterprise",
    },
  ];

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
            <span className="text-sm font-medium">
              {clerkUser?.emailAddresses[0]?.emailAddress || user?.email || "Not available"}
            </span>
          </div>
          <div className="grid gap-1">
            <span className="text-sm text-muted-foreground">Name</span>
            <span className="text-sm font-medium">
              {clerkUser?.fullName || user?.name || "Not set"}
            </span>
          </div>
          <div className="grid gap-1">
            <span className="text-sm text-muted-foreground">Current Plan</span>
            <div className="flex items-center gap-2">
              <Badge variant={subscriptionStatus === "free" ? "secondary" : "default"} className="capitalize">
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
            <Card
              key={plan.name}
              className={plan.recommended ? "border-primary" : ""}
            >
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
                  <Button className="w-full">
                    Upgrade to {plan.name}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
