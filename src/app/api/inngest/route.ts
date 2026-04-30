import { serve } from "inngest/next";
import { inngest, functions } from "@/lib/inngest";

export const dynamic = "force-dynamic";

// Kill switch: when INNGEST_PAUSED=1, register zero functions so Inngest cloud
// deregisters all crons on next sync. Lets us pause all 44 schedules during
// pre-revenue / quiet periods without per-handler edits. Flip the env var in
// Vercel (no redeploy required for runtime envs; trigger a re-sync after).
const pausedRaw = (process.env.INNGEST_PAUSED ?? "").trim().toLowerCase();
const paused = pausedRaw === "1" || pausedRaw === "true" || pausedRaw === "yes";

if (paused) {
  console.warn(
    "[inngest] INNGEST_PAUSED=1 — registering 0 functions, all crons disabled",
  );
}

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: paused ? [] : functions,
});
