import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { db, monitors, audiences } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getUserPlan } from "@/lib/limits";
import { AIChat } from "@/components/dashboard/ai-chat";
import { getEffectiveUserId, isLocalDev } from "@/lib/dev-auth";

export const metadata: Metadata = { title: "Ask Kaulby AI | Kaulby" };

/**
 * Get user's monitors and audiences for scoping
 */
async function getUserContext(userId: string) {
  const [userMonitors, userAudiences] = await Promise.all([
    db.query.monitors.findMany({
      where: eq(monitors.userId, userId),
      columns: {
        id: true,
        name: true,
        keywords: true,
      },
    }),
    db.query.audiences.findMany({
      where: eq(audiences.userId, userId),
      columns: {
        id: true,
        name: true,
      },
    }),
  ]);

  // Generate suggested questions based on user's monitors
  const keywords = new Set<string>();
  userMonitors.forEach((m) => m.keywords?.forEach((k) => keywords.add(k)));

  const suggestedQuestions = [
    "What are the main themes in my latest results?",
    "Show me posts where people are looking for solutions",
    "Which topics have the most negative sentiment?",
    "Find high-intent leads from the last 7 days",
    "Summarize the feedback about pricing discussions",
    "What are people's biggest pain points?",
  ];

  // Add keyword-specific questions
  Array.from(keywords)
    .slice(0, 2)
    .forEach((keyword) => {
      suggestedQuestions.push(`What are people saying about ${keyword}?`);
    });

  return {
    monitorIds: userMonitors.map((m) => m.id),
    audienceIds: userAudiences.map((a) => a.id),
    suggestedQuestions,
    monitorCount: userMonitors.length,
  };
}

async function AskContent() {
  const userId = await getEffectiveUserId();

  if (!userId && !isLocalDev()) {
    redirect("/sign-in");
  }

  // Get user context and plan
  const [userContext, userPlan] = userId
    ? await Promise.all([getUserContext(userId), getUserPlan(userId)])
    : [
        { monitorIds: [], audienceIds: [], suggestedQuestions: [], monitorCount: 0 },
        "free" as const,
      ];

  const isPro = userPlan === "pro" || userPlan === "team";

  return (
    <div className="flex flex-col overflow-hidden -mx-4 -mt-4 -mb-20 lg:-mx-8 lg:-mt-6 lg:-mb-6 h-[calc(100dvh-3.5rem)] lg:h-screen">
      <div className="border-b px-6 py-4 shrink-0">
        <h1 className="text-2xl font-bold">Ask Kaulby AI</h1>
        <p className="text-sm text-muted-foreground">
          Chat with your data using natural language
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <AIChat
          isPro={isPro}
          suggestedQuestions={userContext.suggestedQuestions}
          monitorIds={userContext.monitorIds}
          audienceIds={userContext.audienceIds}
        />
      </div>
    </div>
  );
}

export default function AskPage() {
  return (
    <Suspense fallback={<div className="animate-pulse p-6">Loading...</div>}>
      <AskContent />
    </Suspense>
  );
}
