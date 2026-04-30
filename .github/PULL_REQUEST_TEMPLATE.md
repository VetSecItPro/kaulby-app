## Summary

<!-- 1-3 bullets describing what this PR does and why. -->

## Test plan

<!-- Checklist of how this was verified. -->
- [ ] `pnpm exec tsc --noEmit` clean
- [ ] `pnpm lint` clean
- [ ] Affected unit tests pass
- [ ] Manual UI check (if frontend change)

## Cost / billing impact

<!-- Tick if any apply. Skip section if none. -->
- [ ] Adds new external service call (OpenRouter / Apify / Resend / Polar)
- [ ] Changes Vercel function invocation pattern (middleware, ISR, API route)
- [ ] Changes CI runtime (new job, longer timeout, expanded matrix)

## AI eval impact

<!-- Tick if touching anything in `src/lib/ai/` or `src/__tests__/ai/`. -->
- [ ] Touches AI prompts / models / analyzers
- [ ] Eval baseline updated if metrics moved

## Cost-saver patterns used

<!-- Available shortcuts when relevant. -->
- [ ] Branch name `wip/*` or `draft/*` for in-progress work (skips Vercel preview)
- [ ] `[skip preview]` / `[skip vercel]` / `[wip]` in commit message (skips Vercel preview)
- [ ] PR opened as draft (skips build/e2e/lighthouse/ai-eval until ready)

🤖 See `CONTRIBUTING.md` for the full pattern reference.
