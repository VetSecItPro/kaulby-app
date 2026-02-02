import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL required');
}

const sql = neon(DATABASE_URL);

async function clearTestData() {
  // Find the test user
  const users = await sql`
    SELECT id, email, name, subscription_status
    FROM users
    WHERE email = 'vetsecitpro@gmail.com'
  `;

  if (users.length === 0) {
    console.log('No user found with email vetsecitpro@gmail.com');
    process.exit(1);
  }

  const user = users[0];
  console.log(`Found user: ${user.email} (${user.id})`);
  console.log(`Subscription: ${user.subscription_status}\n`);

  // Get monitor IDs for cascading deletes
  const monitors = await sql`
    SELECT id, name FROM monitors WHERE user_id = ${user.id}
  `;
  console.log(`Monitors to delete: ${monitors.length}`);
  monitors.forEach((m: any) => console.log(`  - ${m.name} (${m.id})`));

  const monitorIds = monitors.map((m: any) => m.id);

  // 1. Delete results (linked to monitors)
  if (monitorIds.length > 0) {
    const results = await sql`
      DELETE FROM results WHERE monitor_id = ANY(${monitorIds})
      RETURNING id
    `;
    console.log(`\nDeleted ${results.length} results`);

    // 2. Delete alerts (linked to monitors)
    const alerts = await sql`
      DELETE FROM alerts WHERE monitor_id = ANY(${monitorIds})
      RETURNING id
    `;
    console.log(`Deleted ${alerts.length} alerts`);
  }

  // 3. Delete AI logs
  const aiLogs = await sql`
    DELETE FROM ai_logs WHERE user_id = ${user.id}
    RETURNING id
  `;
  console.log(`Deleted ${aiLogs.length} AI logs`);

  // 4. Delete audience_monitors (junction table - linked to user's monitors)
  if (monitorIds.length > 0) {
    const am = await sql`
      DELETE FROM audience_monitors WHERE monitor_id = ANY(${monitorIds})
      RETURNING monitor_id
    `;
    console.log(`Deleted ${am.length} audience-monitor links`);
  }

  // 5. Get audience IDs, then delete communities
  const audiences = await sql`
    SELECT id, name FROM audiences WHERE user_id = ${user.id}
  `;
  const audienceIds = audiences.map((a: any) => a.id);

  if (audienceIds.length > 0) {
    const communities = await sql`
      DELETE FROM communities WHERE audience_id = ANY(${audienceIds})
      RETURNING id
    `;
    console.log(`Deleted ${communities.length} communities`);
  }

  // 6. Delete audiences
  const deletedAudiences = await sql`
    DELETE FROM audiences WHERE user_id = ${user.id}
    RETURNING id
  `;
  console.log(`Deleted ${deletedAudiences.length} audiences`);

  // 7. Delete saved searches
  const savedSearches = await sql`
    DELETE FROM saved_searches WHERE user_id = ${user.id}
    RETURNING id
  `;
  console.log(`Deleted ${savedSearches.length} saved searches`);

  // 8. Delete API keys
  const apiKeys = await sql`
    DELETE FROM api_keys WHERE user_id = ${user.id}
    RETURNING id
  `;
  console.log(`Deleted ${apiKeys.length} API keys`);

  // 9. Delete webhook deliveries (linked to user's webhooks)
  const webhooks = await sql`
    SELECT id FROM webhooks WHERE user_id = ${user.id}
  `;
  const webhookIds = webhooks.map((w: any) => w.id);

  if (webhookIds.length > 0) {
    const deliveries = await sql`
      DELETE FROM webhook_deliveries WHERE webhook_id = ANY(${webhookIds})
      RETURNING id
    `;
    console.log(`Deleted ${deliveries.length} webhook deliveries`);
  }

  // 10. Delete webhooks
  const deletedWebhooks = await sql`
    DELETE FROM webhooks WHERE user_id = ${user.id}
    RETURNING id
  `;
  console.log(`Deleted ${deletedWebhooks.length} webhooks`);

  // 11. Delete email events
  const emailEvents = await sql`
    DELETE FROM email_events WHERE user_id = ${user.id}
    RETURNING id
  `;
  console.log(`Deleted ${emailEvents.length} email events`);

  // 12. Delete usage records
  const usageRecords = await sql`
    DELETE FROM usage WHERE user_id = ${user.id}
    RETURNING id
  `;
  console.log(`Deleted ${usageRecords.length} usage records`);

  // 13. Delete activity logs
  const activityLogs = await sql`
    DELETE FROM activity_logs WHERE user_id = ${user.id}
    RETURNING id
  `;
  console.log(`Deleted ${activityLogs.length} activity logs`);

  // 14. Delete monitors (last, since other tables reference them)
  const deletedMonitors = await sql`
    DELETE FROM monitors WHERE user_id = ${user.id}
    RETURNING id, name
  `;
  console.log(`Deleted ${deletedMonitors.length} monitors`);

  // Verify user still exists
  const verify = await sql`
    SELECT id, email FROM users WHERE id = ${user.id}
  `;
  console.log(`\nUser record preserved: ${verify.length > 0 ? 'YES' : 'NO'}`);
  console.log('\nDone! All test data cleared.');
}

clearTestData().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
