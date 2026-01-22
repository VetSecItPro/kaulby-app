import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL required');
}

const sql = neon(DATABASE_URL);

async function checkAndReset() {
  // Check stuck monitors
  const stuck = await sql`
    SELECT id, name, is_scanning, last_checked_at, updated_at
    FROM monitors
    WHERE is_scanning = true
  `;

  console.log('Stuck monitors:', stuck.length);
  stuck.forEach((m: any) => console.log('-', m.name, '| last_checked:', m.last_checked_at));

  if (stuck.length > 0) {
    // Reset them
    const result = await sql`
      UPDATE monitors
      SET is_scanning = false, updated_at = NOW()
      WHERE is_scanning = true
      RETURNING id, name
    `;
    console.log('\nReset', result.length, 'monitors:');
    result.forEach((m: any) => console.log('  ✓', m.name));
  }
}

checkAndReset();
