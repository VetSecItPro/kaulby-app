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

## Analytics & Tracking

- [ ] **PostHog event tracking** - Track key conversion events (upgrade clicks, feature usage)
- [ ] **Funnel analysis** - Free → Pro conversion funnel in PostHog

## Platform Expansion

- [ ] **Twitter/X monitoring** - Research API costs and feasibility
- [ ] **LinkedIn monitoring** - Company mention tracking
- [ ] **YouTube comments** - Video comment monitoring

## Team Features (Enterprise)

- [ ] **Team member roles** - Admin, Editor, Viewer permissions
- [ ] **Shared monitors** - Assign monitors to team members
- [ ] **Activity log** - Track who did what in the workspace

## API & Integrations

- [ ] **Public API documentation** - OpenAPI spec for Team tier
- [ ] **Zapier integration** - Connect to 5000+ apps
- [ ] **Custom webhook payloads** - Let users customize webhook data

## Performance

- [ ] **Result caching** - Redis cache for frequently accessed results
- [ ] **Infinite scroll** - Replace pagination with infinite scroll on results page

## Billing

- [ ] **Annual pricing** - Offer 2 months free for annual commitment
- [ ] **Usage-based pricing option** - Pay per result for high-volume users

---

## Notes

Add items here as they come up during development. Prioritize based on user feedback post-launch.
