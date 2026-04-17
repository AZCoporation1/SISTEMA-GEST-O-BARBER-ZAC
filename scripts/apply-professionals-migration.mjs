/**
 * Apply the professionals + commissions migration to Supabase
 * Usage: SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/apply-professionals-migration.mjs
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://gyausvxjrpkheennijiv.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

async function run() {
  console.log('=== Applying Professionals + Commissions Migration ===')
  console.log('')

  // Step 1: Check if professional_advances table already exists
  const { data: testAdvances, error: testAdvErr } = await supabase
    .from('professional_advances')
    .select('id')
    .limit(1)

  if (!testAdvErr) {
    console.log('✓ professional_advances table already exists — skipping migration')
    console.log('  (If you need to re-run, drop the tables manually first)')
  } else {
    console.log('⚠ professional_advances table not found — migration needs to be applied')
    console.log('  Error:', testAdvErr.message)
    console.log('')
    console.log('→ Please apply the migration SQL manually via the Supabase Dashboard:')
    console.log('  1. Go to https://supabase.com/dashboard/project/gyausvxjrpkheennijiv/sql/new')
    console.log('  2. Copy and paste the contents of:')
    console.log('     supabase/migrations/20260417_000006_professionals_commissions.sql')
    console.log('  3. Click "Run"')
    console.log('')
  }

  // Step 2: Check collaborators table has the new columns
  const { data: collabs, error: collabErr } = await supabase
    .from('collaborators')
    .select('id, name, display_name, default_commission_percent')
    .eq('is_active', true)
    .order('name')

  if (collabErr) {
    console.log('⚠ Cannot read collaborators with new columns:', collabErr.message)
    console.log('  → Migration likely not applied yet')
  } else {
    console.log('✓ Collaborators with professional fields:')
    for (const c of collabs || []) {
      console.log(`  • ${c.name} (${c.display_name || '—'}) — ${c.default_commission_percent || '?'}%`)
    }
  }

  // Step 3: Check closures table
  const { data: testClosures, error: testClosErr } = await supabase
    .from('professional_closures')
    .select('id')
    .limit(1)

  if (testClosErr) {
    console.log('⚠ professional_closures table not found:', testClosErr.message)
  } else {
    console.log('✓ professional_closures table exists')
  }

  console.log('')
  console.log('=== Migration Check Complete ===')
}

run().catch(console.error)
