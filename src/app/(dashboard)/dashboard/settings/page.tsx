import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ResponsiveSettings } from "@/components/dashboard/responsive-settings";

export default async function SettingsPage() {
  const isDev = process.env.NODE_ENV === "development";

  let userId: string | null = null;
  let clerkUser = null;

  if (!isDev) {
    const authResult = await auth();
    userId = authResult.userId;
    clerkUser = await currentUser();

    if (!userId) {
      redirect("/sign-in");
    }
  }

  const user = userId
    ? await db.query.users.findFirst({
        where: eq(users.id, userId),
      })
    : null;

  const subscriptionStatus = user?.subscriptionStatus || "free";
  const email = clerkUser?.emailAddresses[0]?.emailAddress || user?.email || "demo@example.com";
  const name = clerkUser?.fullName || user?.name || "Demo User";

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
    <ResponsiveSettings
      email={email}
      name={name}
      subscriptionStatus={subscriptionStatus}
      plans={plans}
    />
  );
}
