# Kaulby Post-MVP Improvements

Track features and improvements to implement after MVP launch.

---

## Timezone & Internationalization

- [x] **Full IANA timezone list** ✅ - Changed timezone field from enum to text to support any IANA timezone
- [x] **Auto-detect timezone from browser** ✅ - `useAutoTimezone` hook detects and saves timezone on first visit
- [x] **Update Inngest digest functions** ✅ - Worldwide timezone support: crons run hourly, query unique user timezones from DB, send at 9 AM local time

## User Experience

- [x] **Onboarding tour** ✅ - Spotlight tour using react-joyride + floating checklist sidebar
- [x] **Empty state improvements** ✅ - Animated SVG illustrations with gradient effects and CTAs in `src/components/dashboard/empty-states.tsx`

## Monitor Management

- [x] **Monitor actions dropdown** ✅ - 3-dot menu on monitor cards with:
  - Pause/Resume monitor toggle
  - Delete monitor (with confirmation dialog)
  - Duplicate monitor
- [x] **Bulk monitor actions** ✅ - Select multiple monitors for bulk pause/resume/delete with checkboxes
- [x] **Monitor scheduling** ✅ - Set active hours for monitoring with timezone support (all 16 Inngest functions updated)

## Analytics & Tracking

- [x] **PostHog event tracking** ✅ - Typed tracking utility with conversion events (upgrade clicks, feature usage, limits)
- [x] **Funnel analysis** ✅ - Conversion events tracked: `upgrade_clicked`, `upgrade_completed`, `day_pass_purchased`, limit hits

## Platform Expansion

- [x] **YouTube comments** ✅ - Video comment monitoring via Apify integration

## Team Features (Enterprise)

- [x] **Team workspaces** ✅ - Base implementation done (`workspaces`, `workspaceInvites` tables, APIs, UI)
- [x] **Team member roles** ✅ - Admin/Editor/Viewer permissions with granular access control (`src/lib/permissions.ts`)
- [x] **Shared monitors** ✅ - Monitor assignment API and UI in team-settings (`/api/workspace/monitors/[monitorId]/assign`)
- [x] **Activity log** ✅ - Track who did what in the workspace (`workspace_activity_logs` table, auto-logged via API routes)

## API & Integrations

- [x] **API key management** ✅ - `api_keys` table with hashed storage, prefix, expiration, request tracking
- [x] **Public API documentation** ✅ - Comprehensive docs at `/docs/api` with endpoints, examples, rate limits
- [x] **Zapier integration** ✅ - Works via generic webhook format (users paste Zapier webhook URL)
- [x] **Webhook configurations** ✅ - Full implementation with retry logic already done
- [x] **Custom webhook payloads** ✅ - Auto-formats for Slack/Discord/generic with platform-specific styling

## Admin Dashboard Improvements

- [x] **Budget alerts/thresholds** ✅ - Configurable daily/weekly/monthly cost thresholds with email and Slack notifications. Inngest cron job checks hourly. UI at `/manage/costs`.
- [x] **Error logs viewer** ✅ - `errorLogs` table, `src/lib/error-logger.ts` utility, `/manage/errors` page with filtering, resolution, and notes
- [x] **Database query performance** ✅ - Use Neon dashboard for query insights (https://console.neon.tech) - built-in query monitoring, slow query logs, and connection pooling stats

## Performance

- [x] **Upstash Redis for API caching** ✅ - Upgraded `src/lib/cache.ts` to use Upstash Redis when configured, falls back to in-memory
  - Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel to enable
  - Benefits: Persistent across deploys, shared across Vercel instances
- [x] **Infinite scroll** ✅ - Cursor-based pagination with `useInfiniteQuery` on results page
- [x] **Result caching** ✅ - Server-side caching via `unstable_cache` in `server-cache.ts` (getCachedResults, getCachedRecentResults, getCachedResultById, getCachedResultsBySentiment)

## Billing

- [x] **Annual pricing** ✅ - 2 months free for annual ($290/yr Pro, $990/yr Team) with `annualPriceId` in Polar

## SEO & Marketing

- [x] **Subreddit SEO Pages** ✅ - Dynamic ISR pages for 100+ subreddits
  - `/subreddits/[slug]/page.tsx` - Individual subreddit monitoring pages
  - `/subreddits/page.tsx` - Index page with categorized listings
  - Real stats from `communityGrowth` table + live API fallback
  - Full SEO: metadata, structured data, sitemap integration
- [x] **Community Stats Collection** ✅ - Weekly Inngest job (`collectCommunityStats`)
  - Runs Sunday 3 AM UTC via cron
  - Collects member count, posts/day, engagement rate
  - 100+ priority subreddits in `PRIORITY_SUBREDDITS` and `EXTENDED_SUBREDDITS`

---

## Notes

Add items here as they come up during development. Prioritize based on user feedback post-launch.
