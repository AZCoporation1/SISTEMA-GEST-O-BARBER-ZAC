/**
 * Fix: Replace broken UNIQUE(status) constraint on cash_sessions
 * with a partial unique index that only prevents multiple OPEN sessions.
 * 
 * Run: node scripts/fix-cash-constraint.mjs
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: resolve(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing SUPABASE env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function fixConstraint() {
  console.log('🔧 Fixing cash_sessions constraint...\n')

  // Step 1: Drop the broken blanket UNIQUE constraint
  console.log('  1️⃣  Dropping broken UNIQUE(status) constraint...')
  const { error: dropError } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE public.cash_sessions DROP CONSTRAINT IF EXISTS uq_one_open_session;`
  })

  if (dropError) {
    // If rpc exec_sql doesn't exist, we need to use the SQL editor approach
    console.log('  ⚠️  rpc exec_sql not available, trying direct pgrest approach...')
    console.log('')
    console.log('  ❗ Please run the following SQL directly in the Supabase SQL Editor:')
    console.log('  ─────────────────────────────────────────────────────────────────')
    console.log('')
    console.log('  ALTER TABLE public.cash_sessions')
    console.log('    DROP CONSTRAINT IF EXISTS uq_one_open_session;')
    console.log('')
    console.log('  CREATE UNIQUE INDEX IF NOT EXISTS uq_one_open_session')
    console.log('    ON public.cash_sessions (status)')
    console.log("    WHERE status = 'open';")
    console.log('')
    console.log('  ─────────────────────────────────────────────────────────────────')
    console.log('')
    console.log('  After running this SQL, the "Fechar Caixa" feature will work correctly.')
    return
  }

  console.log('  ✅ Constraint dropped.')

  // Step 2: Create the partial unique index
  console.log('  2️⃣  Creating partial unique index (only status=open)...')
  const { error: createError } = await supabase.rpc('exec_sql', {
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS uq_one_open_session ON public.cash_sessions (status) WHERE status = 'open';`
  })

  if (createError) {
    console.error('  ❌ Error creating index:', createError.message)
    process.exit(1)
  }

  console.log('  ✅ Partial unique index created.')
  console.log('')
  console.log('🎉 Fix applied successfully! "Fechar Caixa" will now work correctly.')
}

fixConstraint().catch(err => {
  console.error('❌ Unexpected error:', err)
  process.exit(1)
})
