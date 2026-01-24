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
- [ ] **Monitor scheduling** - Set active hours for monitoring

## Analytics & Tracking

- [x] **PostHog event tracking** ✅ - Typed tracking utility with conversion events (upgrade clicks, feature usage, limits)
- [x] **Funnel analysis** ✅ - Conversion events tracked: `upgrade_clicked`, `upgrade_completed`, `day_pass_purchased`, limit hits

## Platform Expansion

- [ ] **YouTube comments** - Video comment monitoring

## Team Features (Enterprise)

- [x] **Team workspaces** ✅ - Base implementation done (`workspaces`, `workspaceInvites` tables, APIs, UI)
- [x] **Team member roles** ✅ - Admin/Editor/Viewer permissions with granular access control (`src/lib/permissions.ts`)
- [x] **Shared monitors** ✅ - Monitor assignment API and UI in team-settings (`/api/workspace/monitors/[monitorId]/assign`)
- [ ] **Activity log** - Track who did what in the workspace

## API & Integrations

- [x] **API key management** ✅ - `api_keys` table with hashed storage, prefix, expiration, request tracking
- [ ] **Public API documentation** - OpenAPI spec for Team tier
- [ ] **Zapier integration** - Connect to 5000+ apps
- [x] **Webhook configurations** ✅ - Full implementation with retry logic already done
- [ ] **Custom webhook payloads** - Let users customize webhook data structure

## Admin Dashboard Improvements

- [ ] **Budget alerts/thresholds** - Notify when AI costs exceed limits
- [ ] **Error logs viewer** - View and filter application errors (needs logging integration)
- [ ] **Database query performance** - Monitor slow queries (needs query monitoring)
- [ ] **Content moderation** - Flag/review reported content, abuse detection

## Performance

- [ ] **Upstash Redis for API caching** - Upgrade from in-memory to Upstash Redis for Serper/API query cache
  - Current: In-memory cache in `src/lib/cache.ts` (works but lost on redeploy, not shared across instances)
  - Upgrade when: 100+ DAU or noticeable cache miss rate in logs
  - Benefits: Persistent across deploys, shared across Vercel instances, ~$0.20/100K commands
- [ ] **Result caching** - Redis cache for frequently accessed results
- [ ] **Infinite scroll** - Replace pagination with infinite scroll on results page

## Billing

- [x] **Annual pricing** ✅ - 2 months free for annual ($290/yr Pro, $990/yr Team) with `annualPriceId` in Polar
- [ ] **Usage-based pricing option** - Pay per result for high-volume users

---

## Notes

Add items here as they come up during development. Prioritize based on user feedback post-launch.
