# AI Quality Canary

**Status:** active as of 2026-04-23 (PR after #221)
**Cron:** `0 */6 * * *` (runs at 00:00, 06:00, 12:00, 18:00 UTC)
**Function ID:** `ai-quality-canary`

## What it does

Fires a scan against a dedicated canary monitor every 6 hours, waits for AI
summaries to populate, audits them for analyst-voice persona patterns, and
emits a `ai_quality_check` event to PostHog. Hard-floor violations also
page Sentry.

## Why it exists

On 2026-04-23, `analyze-content` entered an Inngest deploy-orphan state after
PR #220 merged. Events queued with zero runs for 4+ hours before anyone
noticed via a manual smoke test. The canary turns that class of silent
outage into a 30-min-max detection window.

## Resources it owns

| Resource | ID / path |
|---|---|
| Canary monitor | `[CANARY] AI quality — inngest` (admin workspace) |
| Canary monitor DB row | `bff73490-0e68-4181-8ee8-674a5ffe8eec` |
| Cron handler | `src/lib/inngest/functions/ai-quality-canary.ts` |
| Probes library | `src/lib/ai/quality-probes.ts` |
| Baseline thresholds | `src/__tests__/ai/quality-baseline.json` |
| Setup script | `scripts/setup-canary-monitor.ts` |

## Thresholds (from quality-baseline.json)

**Hard floors (Sentry-paging):**
| Metric | Threshold | What it catches |
|---|---|---|
| `ai_logs_count_since_run_start` | `>= 1` | Silent `analyze-content` outage (today's incident class) |
| `persona_rate` | `>= 0.30` | Prompt regression / model swap without prompt update |
| `robotic_rate` | `<= 0.10` | Zod schema coercion breaking output structure |
| `banned_opener_rate` | `<= 0.40` | Persona voice regression specifically at output start |

**Soft thresholds (PostHog-only):**
- persona_rate drop >10% vs 7-day average, 3 consecutive runs
- avg_summary_length outside [100, 800] chars

## Operating procedures

### When a hard floor trips

1. Check Sentry issue for which violation fired
2. Cross-reference against PostHog `ai_quality_check` timeline for drift
3. **If `ai_logs_count_since_run_start == 0`:** analyze-content isn't running
   - Check https://app.inngest.com/env/production/functions/analyze-content
   - If "Function not yet deployed to this environment" → re-trigger sync by
     bumping the function's `name` field + deploying (see `inngest-drain.md`)
4. **If `persona_rate` dropped:** prompt regression
   - Check recent git history of `src/lib/ai/prompts.ts`
   - Run `pnpm tsx scripts/audit-persona-voice.ts <monitorId>` against the
     canary monitor to see sample summaries
5. **If `robotic_rate` spiked:** structured output broke
   - Check recent changes to any `src/lib/ai/analyzers/*.ts` Zod schemas
   - Check OpenRouter status page for active provider incidents

### Firing the canary manually

Sometimes you need to kick a run without waiting for the next 6-hour cron
tick — e.g., after a deploy that might have shifted persona rates, or
after a Sentry alert to confirm whether the last tick's failure was
transient.

```
pnpm tsx scripts/fire-canary.ts
```

The script does two things:
1. `PUT /api/inngest` to force the Inngest SDK to re-register (picks up
   any new function triggers from the last deploy)
2. Fires a `canary/fire-now` event — the canary function accepts both
   this event and its regular 6-hour cron trigger

Results land in PostHog's `ai_quality_check` event within ~4 minutes.
Watch the run in the Inngest dashboard:
https://app.inngest.com/env/production/functions/ai-quality-canary

### Recalibrating the baseline

Do this after shipping intentional prompt/model improvements:

1. Let the canary run 5+ cycles against the new prompt
2. Note the new steady-state metrics from PostHog
3. Update `src/__tests__/ai/quality-baseline.json` hard floors with some margin
4. Commit with `chore(canary): recalibrate baseline after <change description>`

### Pausing the canary

If needed (e.g., during planned maintenance):

```
# Via Inngest dashboard:
# Functions → ai-quality-canary → Pause

# Or deactivate the canary monitor in the DB:
pnpm tsx -e "
import { db } from '@/lib/db';
import { monitors } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
await db.update(monitors).set({ isActive: false }).where(eq(monitors.id, 'bff73490-0e68-4181-8ee8-674a5ffe8eec'));
"
```

The canary logs-and-exits if the monitor is missing or inactive, so this
is a clean pause without Inngest-side changes.

### Cost

~$0.05/run × 4 runs/day = $0.20/day = $6/mo. At steady state, roughly
20 fresh summaries per cycle at Flash pricing (~$0.001 each) plus scan
infrastructure (shared with real users via scan-on-demand).
