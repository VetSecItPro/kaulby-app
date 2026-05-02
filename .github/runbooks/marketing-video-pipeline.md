# Marketing Video Pipeline (Playwright + Remotion hybrid)

**Status: planning complete, implementation pending. Designed to be portable across Kaulby, Clarus, Rowan, and future apps.**

This runbook is the architecture spec for producing marketing-grade product demo videos that feel like Linear/Arc/Hatch — short, looped, autoplay, sub-2MB, showing the real product UI with motion-design polish on top.

---

## Why hybrid (not Playwright alone, not Remotion alone)

| Approach | What it gets right | What it misses |
|---|---|---|
| **Playwright only** (screen recording) | Real product UI, real data, auto-regenerates on every deploy | No callouts, no zoom, no captions, no transitions, no brand intro/outro — looks like a screencast, not a marketing asset |
| **Remotion only** (programmatic React video) | Full motion design, callouts, transitions, branded intros, captions | Every UI mockup is hand-coded — tedious, drifts from real product, looks fake. Confirmed hacky on Kaulby's first attempt 2026-03 |
| **Hybrid** (Playwright captures → Remotion composes) | Real product UI as input + cinematic editing on top | More moving parts; needs both stacks working |

The hybrid model is how Loom Pro / Tella / Screen Studio produce their output: record the real screen, then a motion engine adds zoom-on-click, cursor highlights, captions, transitions. We replicate that with open tools.

## Pipeline architecture

```
[ Playwright drives /demo on a deployed preview ]
        ↓
   capture: full-page screencast (.webm) + per-action screenshots (.png)
        ↓
[ Remotion composition imports captures as <Video> + <Img> assets ]
        ↓
   compose: zoom transitions, captions, callouts, brand intro/outro, music (optional)
        ↓
[ ffmpeg pass: H.264 + WebM dual encode, target ≤2 MB per clip ]
        ↓
   output: public/videos/{name}.{mp4,webm,poster.webp}
        ↓
[ <video> tag in marketing pages with WebM-first source ]
```

**Reusability across apps:** The pipeline scripts live in a per-app `scripts/marketing-videos/` directory. Each app provides:
- A **flow file** (e.g., `kaulby-flows.ts`) — what URLs to drive, what selectors to click, what data to seed
- A **brand file** (e.g., `kaulby-brand.tsx`) — Remotion config: logo, color palette, font, intro animation
- The **shared core** stays the same: Playwright runner + Remotion composer + ffmpeg encoder

When we extract this to `vibecode-tooling/video-pipeline` later, only the shared core moves; flows and brand stay per-app.

---

## Per-page video inventory (Kaulby specifically)

| Page | Video | Length | Why it goes here | Path | Priority |
|---|---|---|---|---|---|
| `/` (homepage hero) | "What does Kaulby do?" — full pipeline shown | 12-18s | First impression. Story arc: empty dashboard → create monitor → mentions appear → AI summary highlights pain point → "Save lead" badge | Hybrid | P0 |
| `/` (AI section) | "Ask Kaulby AI" interaction loop | 6-10s | Show typing a question + the answer streaming in. Highlights the chat affordance | Playwright + light Remotion (just zoom-on-cursor) | P1 |
| `/pricing` (above table) | Dashboard ambient loop | 5-8s | Just visual proof. No story, no captions — silent loop of dashboard with results scrolling, badges flickering | Playwright only | P1 |
| `/alternatives/[slug]` | Side-by-side gap shot | 6-10s | Show a pain-point/intent-score view; competitor comparison handled in copy, not video. One generic video reused across all `[slug]`s | Hybrid | P2 |
| `/use-case/[slug]` | Use-case-specific 6-8s loop | 6-8s | One video per use case (competitor monitoring, founder research, support intel). Each shows that specific flow. | Hybrid | P2 |
| `/demo` (interactive) | NO VIDEO | — | Page is already interactive product. Adding video here would be redundant | n/a | n/a |

Total assets when fully shipped: **~6-8 videos**, total weight ~10-15 MB. (Hatch ships 11 MB across 7 videos for reference.)

---

## Video specs (for whoever directs the recording)

### Homepage hero (P0) — "What does Kaulby do?"

**Duration:** 12-18 seconds, looped seamlessly
**Aspect:** 16:9, 1280×720 final (capture at 1920×1080, scale down)
**Story beats** (rough timeline, adjust during recording):

| Time | What's shown | Motion treatment |
|---|---|---|
| 0:00–0:02 | Empty Kaulby dashboard, "Create monitor" CTA glowing | Light zoom-in on CTA |
| 0:02–0:04 | New monitor form: company name typed, platforms multi-selected | Cursor highlight + soft caption: "Track 16 platforms" |
| 0:04–0:07 | Results page populating with cards: Reddit, HN, Trustpilot mentions appearing | Cascade animation, subtle |
| 0:07–0:11 | One result card opens, AI summary streams in, lead score badge appears (high-intent, 87/100) | Zoom on result card + caption: "AI surfaces high-intent leads" |
| 0:11–0:14 | Click "Save" → bookmark icon fills → small "Saved to Bookmarks" toast | Cursor highlight on bookmark |
| 0:14–0:16 | Pull back to dashboard view: counter ticked up "1 saved" | Wide zoom-out, end on logo + tagline (1 sec hold) |

**Captions** (3-4 max, lowercase, sans-serif, white on dark):
- "track 16 platforms"
- "ai surfaces high-intent leads"
- "save what matters"

**Audio:** none (autoplay loops are muted by browser policy anyway)
**Loop seam:** end frame should match start frame (empty dashboard or post-save dashboard pulled wide)

### AI section (P1) — "Ask Kaulby AI"

**Duration:** 6-10s, looped
**Capture flow:** Open Floating Ask Kaulby → type "What pain points are trending in B2B SaaS this week?" → answer streams in with citations → close
**Motion:** zoom on the typing cursor, settle on the streaming answer, fade

### Pricing ambient loop (P1)

**Duration:** 5-8s, looped
**Capture flow:** Dashboard view, 3-4 result cards visible, scroll slowly, hover reveals lead score badge animation
**Motion:** none. Pure raw screencast at 30 fps. Quiet visual proof.

### Alternatives generic (P2)

**Duration:** 6-10s, looped
**Capture flow:** One pain-point trend chart + one high-intent lead card highlighted
**Motion:** simple zoom-and-hold on the lead score badge

### Use-case specific (P2)

**Duration:** 6-8s each, looped
**Per use case** (`/use-case/competitor-monitoring`, `/use-case/founder-research`, etc.):
- Show the exact flow that maps to that use case
- Use the same template (Playwright flow) but parametrized by URL/keywords/platforms

---

## Execution roadmap

### Stage 1 — Foundation (sets up the reusable core)

1. **Audit existing remotion/** — keep what's salvageable, archive the rest. Existing capture-*.ts scripts are starting point for Playwright runner. Existing Remotion compositions get rebuilt to higher quality (or replaced).
2. **Set up `scripts/marketing-videos/`**:
   - `runner.ts` — Playwright orchestrator: launches browser, navigates, drives flow, captures `.webm`
   - `compose.ts` — Remotion entry: imports `.webm` capture, layers brand intro/outro/captions
   - `encode.ts` — ffmpeg pass: H.264 + WebM dual encode, target ≤2 MB
   - `flows/` — per-video flow files
3. **Build one end-to-end video** (homepage hero) to validate the pipeline before scaling.

### Stage 2 — Ship homepage hero (P0)

1. Write `flows/hero.ts` driving the dashboard demo flow
2. Build Remotion composition with Kaulby brand intro (logo + tagline) → captures → outro
3. Run pipeline, output to `public/videos/hero.{mp4,webm,poster.webp}`
4. Replace `<HeroDashboard />` placeholder in `src/app/page.tsx` with `<video>` element (autoplay loop muted playsinline, WebM-first source)
5. Verify file sizes ≤2 MB, Lighthouse PWA score holds, no LCP regression

### Stage 3 — Pricing + AI section (P1)

1. `flows/ai-chat.ts` — drives Ask Kaulby flow
2. `flows/pricing-loop.ts` — passive scroll/hover loop
3. Output 2 more videos
4. Wire into `/pricing` page (pre-table) and AI section (re-create or repurpose ai-section.tsx)

### Stage 4 — Alternatives + use-cases (P2)

1. `flows/alternatives-generic.ts` — single video for all `[slug]`s
2. `flows/use-case-{slug}.ts` — one per use case
3. Wire into the dynamic route pages

### Stage 5 — CI integration

Add a GitHub Actions workflow `marketing-videos.yml` that:
- Triggers on `[render-videos]` in commit message OR weekly cron
- Runs the pipeline against the latest preview deployment
- Commits regenerated videos to a `marketing-assets` branch
- Opens a PR for review (videos shouldn't auto-merge — visual review required)

### Stage 6 — Extract to shared tooling

When Clarus/Rowan want videos:
1. Create `vibecode-tooling/video-pipeline/` (separate repo or monorepo package)
2. Move `runner.ts`, `compose.ts`, `encode.ts` shared core
3. Each app keeps its `flows/` + brand config
4. Apps install via `pnpm add -D @vibecode/video-pipeline`

---

## Cost / time estimates (Kaulby)

| Stage | Estimated time | Output |
|---|---|---|
| 1 (foundation) | 4-6 hrs | Pipeline working end-to-end on one video |
| 2 (homepage hero) | 2-3 hrs | Hero video shipped (P0) |
| 3 (pricing + AI) | 2-3 hrs | 2 more videos shipped (P1) |
| 4 (alternatives + use-cases) | 3-4 hrs | 2-4 more videos shipped (P2) |
| 5 (CI integration) | 2-3 hrs | Auto-regen on deploy |
| 6 (extract to shared) | 4-6 hrs | Reusable across apps |
| **Total to fully ship Kaulby** | **15-25 hrs** | 6-8 videos + auto-regen + reusable infra |

Compare to manual screen recording: ~30 min per video × 8 videos × every UI change = unbounded ongoing cost. The pipeline pays back after ~10 video re-renders.

---

## Open decisions for the operator

1. **Do we keep the existing `remotion/` source?** It has 5 hacky compositions + 4 capture scripts. Recommendation: **rebuild stage 1 from scratch**, but keep the existing dir as reference until stage 1 ships, then archive.
2. **Brand intro length?** Hatch has none — videos open mid-action. Linear has a 1-sec logo flash. Kaulby could do either; recommend none for ambient loops, brief for hero.
3. **Use existing `ProductOverview.mp4` as a temporary stopgap?** No — it was 18 MB and looked hacky. Better to ship zero videos than that one. HeroDashboard placeholder is fine until stage 2 lands.
4. **Music/SFX?** Mute. Autoplay videos with sound get blocked by every browser. Captions carry the message.
5. **Caption font?** Match the marketing site (Geist Sans). Don't introduce a third font.

---

## Files this runbook informs (when implementation starts)

- `scripts/marketing-videos/runner.ts` (NEW)
- `scripts/marketing-videos/compose.ts` (NEW)
- `scripts/marketing-videos/encode.ts` (NEW)
- `scripts/marketing-videos/flows/*.ts` (NEW, per video)
- `scripts/marketing-videos/brand/kaulby.tsx` (NEW, Remotion brand config)
- `public/videos/*.mp4` + `*.webm` + `*-poster.webp` (NEW outputs)
- `src/app/page.tsx` (UPDATE — replace `<HeroDashboard />` with `<video>`)
- `src/app/pricing/page.tsx` (UPDATE — add video above table)
- `src/components/landing/ai-section.tsx` (RECREATE properly, or skip)
- `.github/workflows/marketing-videos.yml` (NEW)

## Spawned tasks (when you're ready to execute)

These will be created when you say go on a stage:
- Stage 1: "Marketing video pipeline foundation (runner + composer + encoder)"
- Stage 2: "Marketing video: homepage hero (P0)"
- Stage 3: "Marketing video: pricing + AI section (P1)"
- Stage 4: "Marketing video: alternatives + use-case (P2)"
- Stage 5: "Marketing video CI integration (auto-regen)"
- Stage 6: "Extract video pipeline to shared @vibecode/video-pipeline"
