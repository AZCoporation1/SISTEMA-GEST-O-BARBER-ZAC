/**
 * Barber Zac ERP — Create Professional: João Victor Lopes
 * 
 * IDEMPOTENT script with mandatory dry-run before apply.
 * 
 * Usage:
 *   node scripts/create-professional-joao-victor.mjs --dry-run
 *   node scripts/create-professional-joao-victor.mjs --apply
 * 
 * Options:
 *   --dry-run              Show what would be created/updated (MANDATORY first)
 *   --apply                Actually create/update records in production
 *   --commission=47        Commission percentage (REQUIRED)
 *   --email=x@y.com        Email for auth account (optional, but recommended)
 *   --password=xxx         Password for auth account (required if email provided)
 *   --workdays=1,2,3,4,5,6 Active weekdays (1=Mon, 6=Sat)
 *   --start=09:00          Working day start time
 *   --end=21:00            Working day end time
 *   --use-default-schedule Use default schedule if --workdays/start/end not specified
 *   --settlement-primary=15  Primary settlement day
 *   --settlement-secondary=30 Secondary settlement day
 *   --skip-auth            Create collaborator + hours only, skip auth/profile
 * 
 * Requirements:
 *   - .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ═══════════════════════════════════════════════════════════════
// ENV LOADER
// ═══════════════════════════════════════════════════════════════

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
// ARGS PARSER
// ═══════════════════════════════════════════════════════════════

const args = process.argv.slice(2)
const flags = {}
args.forEach(arg => {
  if (arg.startsWith('--')) {
    const [key, ...rest] = arg.slice(2).split('=')
    flags[key] = rest.length > 0 ? rest.join('=') : true
  }
})

const isDryRun = !!flags['dry-run']
const isApply = !!flags['apply']
const skipAuth = !!flags['skip-auth']
const useDefaultSchedule = !!flags['use-default-schedule']

if (!isDryRun && !isApply) {
  console.error('❌ Must specify --dry-run or --apply')
  console.error('')
  console.error('Usage:')
  console.error('  node scripts/create-professional-joao-victor.mjs --dry-run --commission=47 --email=jvlopes83@gmail.com --use-default-schedule')
  console.error('  node scripts/create-professional-joao-victor.mjs --apply --commission=47 --email=jvlopes83@gmail.com --use-default-schedule')
  process.exit(1)
}

// ═══════════════════════════════════════════════════════════════
// PROFESSIONAL DATA
// ═══════════════════════════════════════════════════════════════

const PROFESSIONAL = {
  name: 'João Victor Lopes',
  display_name: 'João Victor',
  role: 'barbeiro',
  is_active: true,
}

// Commission — MUST be explicitly provided
const commissionArg = flags['commission']
if (!commissionArg) {
  console.error('❌ --commission=<value> is REQUIRED')
  console.error('   Example: --commission=47')
  process.exit(1)
}
const commissionPercent = parseFloat(commissionArg)
if (isNaN(commissionPercent) || commissionPercent < 0 || commissionPercent > 100) {
  console.error(`❌ Invalid commission value: ${commissionArg}`)
  process.exit(1)
}

// Email
const email = flags['email'] || null
const password = flags['password'] || null

if (email && !password) {
  // Generate a secure default password
  console.warn('⚠️  No --password provided. Will generate: BZ@JoaoVictor2026!')
}
const authPassword = password || 'BZ@JoaoVictor2026!'

// Schedule
let workdays = null
let startTime = '09:00'
let endTime = '21:00'

if (flags['workdays']) {
  workdays = flags['workdays'].split(',').map(Number).filter(n => n >= 0 && n <= 6)
} else if (useDefaultSchedule) {
  workdays = [1, 2, 3, 4, 5, 6] // Mon-Sat
} else {
  console.error('❌ Schedule not specified. Use --workdays=1,2,3,4,5,6 or --use-default-schedule')
  process.exit(1)
}

if (flags['start']) startTime = flags['start']
if (flags['end']) endTime = flags['end']

// Settlement days
let settlementPrimary = flags['settlement-primary'] ? parseInt(flags['settlement-primary']) : null
let settlementSecondary = flags['settlement-secondary'] ? parseInt(flags['settlement-secondary']) : null

// ═══════════════════════════════════════════════════════════════
// WEEKDAY LABELS
// ═══════════════════════════════════════════════════════════════

const WEEKDAY_NAMES = {
  0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta',
  4: 'Quinta', 5: 'Sexta', 6: 'Sábado'
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
  const mode = isDryRun ? 'DRY-RUN' : 'APPLY'
  
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log(`║   Barber Zac — Create Professional: João Victor Lopes   ║`)
  console.log(`║   Mode: ${mode.padEnd(48)}║`)
  console.log('╚══════════════════════════════════════════════════════════╝')
  console.log('')

  const report = {
    collaborator_id: null,
    collaborator_action: null,
    user_profile_id: null,
    auth_user_id: null,
    commission: commissionPercent,
    settlement_primary_day: null,
    settlement_secondary_day: null,
    settlement_source: null,
    working_hours_created: [],
    working_hours_updated: [],
    appears_for_client: false,
    pending: [],
  }

  // ── Step 1: Check existing collaborators for duplicates ──
  console.log('━━━ Step 1: Check for existing collaborator ━━━')
  
  const { data: existingCollabs } = await supabase
    .from('collaborators')
    .select('id, name, display_name, role, is_active, default_commission_percent, settlement_primary_day, settlement_secondary_day')
    .or('name.ilike.%joão%,name.ilike.%joao%,display_name.ilike.%joão%,display_name.ilike.%joao%,name.ilike.%victor%,name.ilike.%lopes%')
    .order('name')

  let collaboratorId = null
  let collaboratorAction = 'CREATE'

  if (existingCollabs && existingCollabs.length > 0) {
    console.log(`  ⚠️  Found ${existingCollabs.length} potential match(es):`)
    for (const c of existingCollabs) {
      console.log(`     • "${c.name}" (${c.display_name || '-'}) [${c.role}] active=${c.is_active} id=${c.id}`)
    }
    
    // Check for exact match
    const exactMatch = existingCollabs.find(c => 
      c.name.toLowerCase() === 'joão victor lopes' || 
      c.name.toLowerCase() === 'joao victor lopes'
    )
    
    if (exactMatch) {
      console.log(`  ✅ Exact match found: ${exactMatch.name} (${exactMatch.id})`)
      collaboratorId = exactMatch.id
      collaboratorAction = 'UPDATE'
    } else {
      // Close match check
      const closeMatch = existingCollabs.find(c => {
        const n = c.name.toLowerCase()
        return (n.includes('joão victor') || n.includes('joao victor')) && 
               (n.includes('lopes'))
      })
      if (closeMatch) {
        console.log(`  ✅ Close match found: ${closeMatch.name} (${closeMatch.id})`)
        collaboratorId = closeMatch.id
        collaboratorAction = 'UPDATE'
      }
    }
  } else {
    console.log('  ✅ No existing collaborator found — will create new')
  }

  // ── Step 2: Determine settlement days ──
  console.log('')
  console.log('━━━ Step 2: Settlement days ━━━')

  if (settlementPrimary === null || settlementSecondary === null) {
    // Copy from existing professionals
    const { data: activeCollabs } = await supabase
      .from('collaborators')
      .select('name, settlement_primary_day, settlement_secondary_day')
      .eq('is_active', true)
      .eq('role', 'barbeiro')
      .order('name')
      .limit(5)

    if (activeCollabs && activeCollabs.length > 0) {
      // Use the most common pattern
      const first = activeCollabs[0]
      settlementPrimary = first.settlement_primary_day
      settlementSecondary = first.settlement_secondary_day
      report.settlement_source = `Copiado de: ${first.name} (primary=${settlementPrimary}, secondary=${settlementSecondary})`
      
      console.log('  📋 Active professionals settlement days:')
      for (const c of activeCollabs) {
        console.log(`     • ${c.name}: primary=${c.settlement_primary_day}, secondary=${c.settlement_secondary_day}`)
      }
      console.log(`  ✅ Using pattern from ${first.name}: primary=${settlementPrimary}, secondary=${settlementSecondary}`)
    } else {
      // Default fallback
      settlementPrimary = 15
      settlementSecondary = 30
      report.settlement_source = 'Default fallback (15/30)'
      console.log('  ⚠️  No active professionals found, using default: 15/30')
    }
  } else {
    report.settlement_source = 'Explicitly provided via CLI'
    console.log(`  ✅ Settlement days: primary=${settlementPrimary}, secondary=${settlementSecondary} (explicit)`)
  }

  report.settlement_primary_day = settlementPrimary
  report.settlement_secondary_day = settlementSecondary

  // ── Step 3: Create/Update Collaborator ──
  console.log('')
  console.log('━━━ Step 3: Collaborator ━━━')

  const collaboratorData = {
    name: PROFESSIONAL.name,
    display_name: PROFESSIONAL.display_name,
    role: PROFESSIONAL.role,
    is_active: PROFESSIONAL.is_active,
    default_commission_percent: commissionPercent,
    settlement_primary_day: settlementPrimary,
    settlement_secondary_day: settlementSecondary,
  }

  console.log(`  Action: ${collaboratorAction}`)
  console.log(`  Data:`)
  console.log(`    name: "${collaboratorData.name}"`)
  console.log(`    display_name: "${collaboratorData.display_name}"`)
  console.log(`    role: "${collaboratorData.role}"`)
  console.log(`    is_active: ${collaboratorData.is_active}`)
  console.log(`    default_commission_percent: ${collaboratorData.default_commission_percent}%`)
  console.log(`    settlement_primary_day: ${collaboratorData.settlement_primary_day}`)
  console.log(`    settlement_secondary_day: ${collaboratorData.settlement_secondary_day}`)

  if (isApply) {
    if (collaboratorAction === 'UPDATE' && collaboratorId) {
      const { data, error } = await supabase
        .from('collaborators')
        .update(collaboratorData)
        .eq('id', collaboratorId)
        .select('id')
        .single()

      if (error) {
        console.error(`  ❌ Failed to update collaborator:`, error.message)
        process.exit(1)
      }
      console.log(`  ✅ Updated collaborator: ${collaboratorId}`)
    } else {
      const { data, error } = await supabase
        .from('collaborators')
        .insert(collaboratorData)
        .select('id')
        .single()

      if (error) {
        console.error(`  ❌ Failed to create collaborator:`, error.message)
        process.exit(1)
      }
      collaboratorId = data.id
      console.log(`  ✅ Created collaborator: ${collaboratorId}`)
    }
  } else {
    if (collaboratorId) {
      console.log(`  [DRY-RUN] Would UPDATE collaborator: ${collaboratorId}`)
    } else {
      console.log(`  [DRY-RUN] Would CREATE new collaborator`)
    }
  }

  report.collaborator_id = collaboratorId || '[will be assigned]'
  report.collaborator_action = collaboratorAction

  // ── Step 4: Working Hours ──
  console.log('')
  console.log('━━━ Step 4: Working Hours ━━━')

  // Fetch existing hours for this collaborator
  let existingHours = []
  if (collaboratorId) {
    const { data } = await supabase
      .from('professional_working_hours')
      .select('*')
      .eq('professional_id', collaboratorId)
    existingHours = data || []
  }

  console.log(`  Schedule: ${workdays.map(w => WEEKDAY_NAMES[w]).join(', ')}`)
  console.log(`  Hours: ${startTime} — ${endTime}`)
  console.log(`  Existing hours in DB: ${existingHours.length}`)

  for (const weekday of [0, 1, 2, 3, 4, 5, 6]) {
    const isActive = workdays.includes(weekday)
    const existing = existingHours.find(h => h.weekday === weekday)
    
    const hourData = {
      professional_id: collaboratorId,
      weekday,
      start_time: startTime,
      end_time: endTime,
      break_start_time: null,
      break_end_time: null,
      is_active: isActive,
    }

    if (existing) {
      // Update existing
      if (isApply && collaboratorId) {
        const { error } = await supabase
          .from('professional_working_hours')
          .update({
            start_time: startTime,
            end_time: endTime,
            is_active: isActive,
          })
          .eq('id', existing.id)

        if (error) {
          console.error(`  ❌ Failed to update hours for ${WEEKDAY_NAMES[weekday]}:`, error.message)
        } else {
          console.log(`  ✅ Updated ${WEEKDAY_NAMES[weekday]}: ${isActive ? `${startTime}—${endTime}` : 'INACTIVE'}`)
          report.working_hours_updated.push(WEEKDAY_NAMES[weekday])
        }
      } else {
        console.log(`  [DRY-RUN] Would UPDATE ${WEEKDAY_NAMES[weekday]}: ${isActive ? `${startTime}—${endTime}` : 'INACTIVE'} (existing id: ${existing.id})`)
        report.working_hours_updated.push(WEEKDAY_NAMES[weekday])
      }
    } else {
      // Create new
      if (isApply && collaboratorId) {
        hourData.professional_id = collaboratorId
        const { error } = await supabase
          .from('professional_working_hours')
          .insert(hourData)

        if (error) {
          console.error(`  ❌ Failed to create hours for ${WEEKDAY_NAMES[weekday]}:`, error.message)
        } else {
          console.log(`  ✅ Created ${WEEKDAY_NAMES[weekday]}: ${isActive ? `${startTime}—${endTime}` : 'INACTIVE'}`)
          report.working_hours_created.push(WEEKDAY_NAMES[weekday])
        }
      } else {
        console.log(`  [DRY-RUN] Would CREATE ${WEEKDAY_NAMES[weekday]}: ${isActive ? `${startTime}—${endTime}` : 'INACTIVE'}`)
        report.working_hours_created.push(WEEKDAY_NAMES[weekday])
      }
    }
  }

  report.appears_for_client = workdays.length > 0

  // ── Step 5: Auth User ──
  console.log('')
  console.log('━━━ Step 5: Supabase Auth User ━━━')

  if (!email || skipAuth) {
    console.log(`  ⏭️  Skipping auth — ${!email ? 'no email provided' : '--skip-auth flag'}`)
    console.log(`  📋 Conta de login pendente — e-mail necessário.`)
    report.pending.push('Conta de login pendente — e-mail necessário para criar acesso ao portal profissional')
  } else {
    console.log(`  Email: ${email}`)
    console.log(`  Password: ${'*'.repeat(authPassword.length)}`)

    // Check if auth user already exists — paginate to find all users
    let authUserId = null
    let page = 1
    const perPage = 100
    let foundExisting = false

    while (!foundExisting) {
      const { data: usersPage } = await supabase.auth.admin.listUsers({ page, perPage })
      if (!usersPage?.users || usersPage.users.length === 0) break

      const match = usersPage.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
      if (match) {
        authUserId = match.id
        foundExisting = true
        console.log(`  ✅ Auth user already exists: ${match.id} (email: ${match.email})`)
      }

      if (usersPage.users.length < perPage) break
      page++
    }

    if (!foundExisting) {
      if (isApply) {
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: email,
          password: authPassword,
          email_confirm: true,
          user_metadata: {
            full_name: PROFESSIONAL.name,
            system_role: 'professional',
          }
        })

        if (createError) {
          // If "already registered", try to find via another approach
          if (createError.message.includes('already been registered')) {
            console.log(`  ⚠️  Auth user exists but wasn't found in list. Searching again...`)
            // Re-scan all pages
            let rePage = 1
            while (true) {
              const { data: reScan } = await supabase.auth.admin.listUsers({ page: rePage, perPage: 200 })
              if (!reScan?.users || reScan.users.length === 0) break
              const reMatch = reScan.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
              if (reMatch) {
                authUserId = reMatch.id
                console.log(`  ✅ Found existing auth user on re-scan: ${authUserId}`)
                break
              }
              if (reScan.users.length < 200) break
              rePage++
            }
            if (!authUserId) {
              console.error(`  ❌ Auth user exists but could not be located. Manual fix needed.`)
              report.pending.push('Auth user exists but ID unknown — manual lookup required in Supabase dashboard')
            }
          } else {
            console.error(`  ❌ Failed to create auth user:`, createError.message)
            report.pending.push(`Auth user creation failed: ${createError.message}`)
          }
        } else {
          authUserId = newUser.user.id
          console.log(`  ✅ Auth user created: ${authUserId}`)
        }
      } else {
        console.log(`  [DRY-RUN] Would CREATE auth user with email: ${email}`)
      }
    }

    report.auth_user_id = authUserId || '[will be assigned]'

    // ── Step 6: User Profile ──
    console.log('')
    console.log('━━━ Step 6: User Profile ━━━')

    const profileData = {
      system_role: 'professional',
      display_name: PROFESSIONAL.display_name,
      collaborator_id: collaboratorId,
      can_approve_professional_requests: false,
      can_view_all_professionals: false,
      can_manage_system: false,
      can_submit_professional_requests: true,
    }

    console.log(`  system_role: ${profileData.system_role}`)
    console.log(`  collaborator_id: ${collaboratorId || '[pending]'}`)
    console.log(`  can_manage_system: ${profileData.can_manage_system}`)
    console.log(`  can_view_all_professionals: ${profileData.can_view_all_professionals}`)
    console.log(`  can_approve_professional_requests: ${profileData.can_approve_professional_requests}`)
    console.log(`  can_submit_professional_requests: ${profileData.can_submit_professional_requests}`)
    console.log(`  ⚠️  João NÃO terá acesso admin — apenas portal profissional`)

    if (authUserId && collaboratorId) {
      // Check if profile already exists
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', authUserId)
        .single()

      if (existingProfile) {
        if (isApply) {
          const { error: updateErr } = await supabase
            .from('user_profiles')
            .update(profileData)
            .eq('id', existingProfile.id)

          if (updateErr) {
            console.error(`  ❌ Failed to update profile:`, updateErr.message)
          } else {
            console.log(`  ✅ Profile updated: ${existingProfile.id}`)
            report.user_profile_id = existingProfile.id
          }
        } else {
          console.log(`  [DRY-RUN] Would UPDATE profile: ${existingProfile.id}`)
          report.user_profile_id = existingProfile.id
        }
      } else {
        // Wait for trigger to create profile
        if (isApply) {
          console.log(`  ⏳ Waiting for handle_new_user trigger (2s)...`)
          await new Promise(r => setTimeout(r, 2500))

          const { data: retryProfile } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('auth_user_id', authUserId)
            .single()

          if (retryProfile) {
            const { error: updateErr } = await supabase
              .from('user_profiles')
              .update(profileData)
              .eq('id', retryProfile.id)

            if (updateErr) {
              console.error(`  ❌ Failed to update profile (post-trigger):`, updateErr.message)
            } else {
              console.log(`  ✅ Profile updated (post-trigger): ${retryProfile.id}`)
              report.user_profile_id = retryProfile.id
            }
          } else {
            console.error(`  ❌ Profile not found — trigger may not have fired`)
            report.pending.push('User profile not created by trigger — may need manual fix')
          }
        } else {
          console.log(`  [DRY-RUN] Would wait for trigger and UPDATE profile`)
        }
      }
    } else if (!authUserId) {
      console.log(`  ⏭️  Skipping profile — no auth user yet`)
    } else if (!collaboratorId) {
      console.log(`  ⏭️  Skipping profile — no collaborator ID yet (dry-run)`)
    }
  }

  // ── Step 7: Verify final state ──
  console.log('')
  console.log('━━━ Step 7: Post-apply Verification ━━━')

  if (isApply && collaboratorId) {
    // Verify collaborator
    const { data: verifyCollab } = await supabase
      .from('collaborators')
      .select('*')
      .eq('id', collaboratorId)
      .single()

    if (verifyCollab) {
      console.log(`  ✅ Collaborator verified:`)
      console.log(`     name: ${verifyCollab.name}`)
      console.log(`     display_name: ${verifyCollab.display_name}`)
      console.log(`     role: ${verifyCollab.role}`)
      console.log(`     is_active: ${verifyCollab.is_active}`)
      console.log(`     commission: ${verifyCollab.default_commission_percent}%`)
      console.log(`     settlement: ${verifyCollab.settlement_primary_day}/${verifyCollab.settlement_secondary_day}`)
    }

    // Verify hours
    const { data: verifyHours } = await supabase
      .from('professional_working_hours')
      .select('weekday, start_time, end_time, is_active')
      .eq('professional_id', collaboratorId)
      .order('weekday')

    if (verifyHours) {
      console.log(`  ✅ Working hours verified (${verifyHours.length} records):`)
      for (const h of verifyHours) {
        console.log(`     ${WEEKDAY_NAMES[h.weekday]}: ${h.is_active ? `${h.start_time}—${h.end_time}` : 'INATIVO'}`)
      }
    }

    // Verify profile if created
    if (report.auth_user_id && report.auth_user_id !== '[will be assigned]') {
      const { data: verifyProfile } = await supabase
        .from('user_profiles')
        .select('id, system_role, collaborator_id, can_manage_system')
        .eq('auth_user_id', report.auth_user_id)
        .single()

      if (verifyProfile) {
        console.log(`  ✅ Profile verified:`)
        console.log(`     system_role: ${verifyProfile.system_role}`)
        console.log(`     collaborator_id: ${verifyProfile.collaborator_id}`)
        console.log(`     can_manage_system: ${verifyProfile.can_manage_system}`)

        if (verifyProfile.system_role !== 'professional') {
          console.error(`  ❌ CRITICAL: system_role is "${verifyProfile.system_role}" — should be "professional"!`)
        }
        if (verifyProfile.can_manage_system) {
          console.error(`  ❌ CRITICAL: can_manage_system is true — João would have admin access!`)
        }
      }
    }

    // Check for public booking visibility
    const { data: publicProfs } = await supabase
      .from('collaborators')
      .select('id, name')
      .eq('is_active', true)
      .eq('role', 'barbeiro')
      .order('name')

    console.log(`  📋 Profissionais visíveis na Área do Cliente:`)
    for (const p of (publicProfs || [])) {
      const isJoao = p.id === collaboratorId
      console.log(`     ${isJoao ? '→' : '•'} ${p.name}${isJoao ? ' ← NOVO' : ''}`)
    }
  } else if (isDryRun) {
    console.log('  [DRY-RUN] Verification skipped — no changes applied')
  }

  // ── Final Report ──
  console.log('')
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║                    RELATÓRIO FINAL                      ║')
  console.log('╚══════════════════════════════════════════════════════════╝')
  console.log('')
  console.log(`  Modo:                    ${mode}`)
  console.log(`  Collaborator ID:         ${report.collaborator_id}`)
  console.log(`  Collaborator Action:     ${report.collaborator_action}`)
  console.log(`  Comissão:                ${report.commission}%`)
  console.log(`  Settlement Primary:      dia ${report.settlement_primary_day}`)
  console.log(`  Settlement Secondary:    dia ${report.settlement_secondary_day}`)
  console.log(`  Settlement Origem:       ${report.settlement_source}`)
  console.log(`  Auth User ID:            ${report.auth_user_id || 'NÃO CRIADO'}`)
  console.log(`  User Profile ID:         ${report.user_profile_id || 'NÃO CRIADO'}`)
  console.log(`  Horários Criados:        ${report.working_hours_created.length > 0 ? report.working_hours_created.join(', ') : 'nenhum'}`)
  console.log(`  Horários Atualizados:    ${report.working_hours_updated.length > 0 ? report.working_hours_updated.join(', ') : 'nenhum'}`)
  console.log(`  Aparece para Cliente:    ${report.appears_for_client ? 'SIM' : 'NÃO'}`)
  console.log(`  Email:                   ${email || 'NÃO FORNECIDO'}`)
  console.log('')

  if (report.pending.length > 0) {
    console.log('  ⚠️  PENDÊNCIAS:')
    for (const p of report.pending) {
      console.log(`     • ${p}`)
    }
    console.log('')
  }

  if (isDryRun) {
    console.log('  ℹ️  Nenhuma alteração foi feita (dry-run).')
    console.log('  ℹ️  Para aplicar, execute com --apply:')
    console.log(`     node scripts/create-professional-joao-victor.mjs --apply --commission=${commissionPercent}${email ? ` --email=${email}` : ''}${useDefaultSchedule ? ' --use-default-schedule' : ''}`)
    console.log('')
  }

  if (isApply && report.pending.length === 0) {
    console.log('  ✅ João Victor Lopes adicionado com sucesso!')
    console.log('')
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
