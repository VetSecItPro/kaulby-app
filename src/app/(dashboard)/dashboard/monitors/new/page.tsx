import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserPlan } from "@/lib/limits";
import { getPlanLimits } from "@/lib/plans";
import { NewMonitorForm } from "./new-monitor-form";
import { getEffectiveUserId, isLocalDev } from "@/lib/dev-auth";

export const metadata: Metadata = { title: "Create Monitor | Kaulby" };

// Web Share Target params: ?title=...&text=...&url=...
type SearchParams = Promise<{ title?: string; text?: string; url?: string }>;

function pickPrefillKeyword(params: { title?: string; text?: string; url?: string }): string | undefined {
  const candidate = params.text || params.title;
  if (!candidate) return undefined;
  const cleaned = candidate.replace(/\s+/g, " ").trim().slice(0, 80);
  return cleaned || undefined;
}

function pickPrefillName(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return undefined;
  try {
    return `Shared: ${new URL(rawUrl).hostname}`;
  } catch {
    return undefined;
  }
}

export default async function NewMonitorPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const prefillKeyword = pickPrefillKeyword(params);
  const prefillName = pickPrefillName(params.url);

  const userId = await getEffectiveUserId();

  if (!userId) {
    if (!isLocalDev()) {
      redirect("/sign-in");
    }
    const limits = getPlanLimits("growth");
    return <NewMonitorForm limits={limits} userPlan="growth" prefillKeyword={prefillKeyword} prefillName={prefillName} />;
  }

  const userPlan = await getUserPlan(userId);
  const limits = getPlanLimits(userPlan);

  return <NewMonitorForm limits={limits} userPlan={userPlan} prefillKeyword={prefillKeyword} prefillName={prefillName} />;
}
