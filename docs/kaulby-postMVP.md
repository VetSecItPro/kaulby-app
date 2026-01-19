# Kaulby Post-MVP Improvements

Track features and improvements to implement after MVP launch.

---

## Timezone & Internationalization

- [ ] **Full IANA timezone list** - Replace US-only timezones with complete worldwide list
- [ ] **Auto-detect timezone from browser** - Use `Intl.DateTimeFormat().resolvedOptions().timeZone` on signup
- [ ] **Update Inngest digest functions** - Ensure email scheduling respects user timezone from database

## User Experience

- [ ] **Onboarding tour** - Guide new users through creating their first monitor
- [ ] **Empty state improvements** - Better illustrations and CTAs when no data
- [ ] **Dark mode toggle** - User preference for light/dark theme

## Monitor Management

- [ ] **Monitor actions dropdown** - Add 3-dot menu on monitor cards with:
  - Pause/Resume monitor toggle
  - Delete monitor (with confirmation dialog)
  - Duplicate monitor
- [ ] **Bulk monitor actions** - Select multiple monitors for bulk pause/delete
- [ ] **Monitor scheduling** - Set active hours for monitoring

## Analytics & Tracking

- [ ] **PostHog event tracking** - Track key conversion events (upgrade clicks, feature usage)
- [ ] **Funnel analysis** - Free → Pro conversion funnel in PostHog

## Platform Expansion

- [ ] **Twitter/X monitoring** - Research API costs and feasibility
- [ ] **LinkedIn monitoring** - Company mention tracking
- [ ] **YouTube comments** - Video comment monitoring

## Team Features (Enterprise)

- [x] **Team workspaces** ✅ - Base implementation done (`workspaces`, `workspaceInvites` tables, APIs, UI)
- [ ] **Team member roles** - Admin, Editor, Viewer permissions (currently just owner/member)
- [ ] **Shared monitors** - Assign monitors to team members
- [ ] **Activity log** - Track who did what in the workspace

## API & Integrations

- [ ] **API key management** - Enterprise feature for programmatic access:
  - `apiKeys` table (id, userId, name, keyHash, prefix, lastUsedAt, expiresAt, scopes)
  - Key generation with `kaulby_` prefix, CRUD APIs, auth middleware
  - Dashboard UI for managing keys, rate limiting
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

- [ ] **Annual pricing** - Offer 2 months free for annual commitment
- [ ] **Usage-based pricing option** - Pay per result for high-volume users

---

## Notes

Add items here as they come up during development. Prioritize based on user feedback post-launch.
