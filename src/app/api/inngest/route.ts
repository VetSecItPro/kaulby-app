import { serve } from "inngest/next";
import { inngest, functions } from "@/lib/inngest";

export const dynamic = "force-dynamic";

// Kill switch: when INNGEST_PAUSED=1, register a single never-fired stub
// function. Inngest cloud refuses to sync if zero functions are registered
// (treats it as misconfiguration), so the stub satisfies the introspection
// check while pruning all real crons + event handlers from the cloud-side
// function list. Flip the env var in Vercel + redeploy + sync to pause.
const pausedRaw = (process.env.INNGEST_PAUSED ?? "").trim().toLowerCase();
const paused =
  pausedRaw === "1" || pausedRaw === "true" || pausedRaw === "yes";

const pauseStub = inngest.createFunction(
  { id: "inngest-paused-stub", name: "Paused (kill switch active)" },
  { event: "inngest/never-fired" },
  async () => ({ paused: true }),
);

if (paused) {
  console.warn(
    "[inngest] INNGEST_PAUSED=1 — registering stub only, all real crons disabled",
  );
}

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: paused ? [pauseStub] : functions,
});
