/**
 * Barber Zac ERP — Seed Reception Staff
 * 
 * Idempotent script to create Anthony and Fábio in reception_staff.
 * Links to existing user_profiles without modifying them.
 * 
 * Usage: node scripts/seed-reception-staff.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env.local
try {
  const envPath = resolve(process.cwd(), '.env.local')
  const envContent = readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=')
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value
      }
    }
  })
} catch {}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// ═══════════════════════════════════════════════════════════════
// RECEPTION STAFF DEFINITIONS
// ═══════════════════════════════════════════════════════════════

const RECEPTION_STAFF = [
  {
    email: 'granconatoleonela@gmail.com',
    full_name: 'Anthony',
    display_name: 'Anthony',
    base_salary_per_period: 1250.00,
    settlement_primary_day: 23,
    settlement_secondary_day: 6,
  },
  {
    email: 'Fabiodasilva2026@outlook.com',
    full_name: 'Fábio',
    display_name: 'Fábio',
    base_salary_per_period: null, // A definir
    settlement_primary_day: 23,
    settlement_secondary_day: 6,
  },
]

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('╔══════════════════════════════════════════╗')
  console.log('║  Barber Zac — Seed Reception Staff       ║')
  console.log('╚══════════════════════════════════════════╝')
  console.log(`\nSupabase: ${supabaseUrl}`)

  let success = 0
  let failed = 0

  for (const staffDef of RECEPTION_STAFF) {
    console.log(`\n━━━ Processing: ${staffDef.full_name} (${staffDef.email}) ━━━`)

    // 1. Find user_profile by email (case-insensitive)
    const { data: profile, error: profileErr } = await supabase
      .from('user_profiles')
      .select('id, full_name, display_name, email, system_role')
      .ilike('email', staffDef.email)
      .single()

    if (profileErr || !profile) {
      console.error(`  ❌ user_profile not found for email: ${staffDef.email}`)
      console.error(`     Error: ${profileErr?.message || 'No data returned'}`)
      failed++
      continue
    }

    console.log(`  ✅ Found user_profile: ${profile.full_name} (${profile.id})`)
    console.log(`     system_role: ${profile.system_role}`)

    // 2. Check if already exists in reception_staff
    const { data: existing } = await supabase
      .from('reception_staff')
      .select('id')
      .eq('user_profile_id', profile.id)
      .single()

    if (existing) {
      // Update existing
      const { error: updateErr } = await supabase
        .from('reception_staff')
        .update({
          full_name: staffDef.full_name,
          display_name: staffDef.display_name,
          base_salary_per_period: staffDef.base_salary_per_period,
          settlement_primary_day: staffDef.settlement_primary_day,
          settlement_secondary_day: staffDef.settlement_secondary_day,
          is_active: true,
        })
        .eq('id', existing.id)

      if (updateErr) {
        console.error(`  ❌ Failed to update: ${updateErr.message}`)
        failed++
      } else {
        console.log(`  ✅ Updated existing reception_staff record`)
        console.log(`     salary: ${staffDef.base_salary_per_period ?? 'A definir'}`)
        success++
      }
    } else {
      // Insert new
      const { data: inserted, error: insertErr } = await supabase
        .from('reception_staff')
        .insert({
          user_profile_id: profile.id,
          full_name: staffDef.full_name,
          display_name: staffDef.display_name,
          base_salary_per_period: staffDef.base_salary_per_period,
          settlement_primary_day: staffDef.settlement_primary_day,
          settlement_secondary_day: staffDef.settlement_secondary_day,
          is_active: true,
        })
        .select('id')
        .single()

      if (insertErr) {
        console.error(`  ❌ Failed to insert: ${insertErr.message}`)
        failed++
      } else {
        console.log(`  ✅ Created reception_staff: ${inserted.id}`)
        console.log(`     salary: ${staffDef.base_salary_per_period ?? 'A definir'}`)
        success++
      }
    }
  }

  console.log('\n╔══════════════════════════════════════════╗')
  console.log(`║  Results: ${success} OK, ${failed} Failed               ║`)
  console.log('╚══════════════════════════════════════════╝')

  if (failed > 0) process.exit(1)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
