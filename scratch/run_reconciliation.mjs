/**
 * Barber Zac — Auth → Customers Reconciliation Script
 * 
 * Executa DIAGNÓSTICO → DRY-RUN → APPLY na ordem correta.
 * Usa SUPABASE_SERVICE_ROLE_KEY para acessar auth.users e customers.
 * 
 * Fases:
 *   1. DIAGNOSTIC — somente leitura
 *   2. DRY-RUN    — simula ações sem alterar banco
 *   3. APPLY      — executa vinculação e criação
 *   4. VERIFY     — verifica resultado final
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const WHITELIST = [
  'fabiodasilva2026@outlook.com',
  'granconatoleonela@gmail.com',
  'lucaszaquiel123@gmail.com',
  'mateus.santos.ap123@gmail.com',
  'gustagaldino@gmail.com',
].map(e => e.toLowerCase())

function isWhitelisted(email) {
  return WHITELIST.includes((email || '').toLowerCase())
}

function sep(title) {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  ${title}`)
  console.log(`${'═'.repeat(60)}\n`)
}

// ─── HELPERS ──────────────────────────────────────────────

async function getAllAuthUsers() {
  const allUsers = []
  let page = 1
  const perPage = 1000
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) {
      console.error('❌ Error listing auth users:', error.message)
      break
    }
    if (!data?.users?.length) break
    allUsers.push(...data.users)
    if (data.users.length < perPage) break
    page++
  }
  return allUsers
}

async function getAllUserProfiles() {
  const { data, error } = await admin
    .from('user_profiles')
    .select('id, auth_user_id, email, system_role, collaborator_id')
  if (error) {
    console.error('❌ Error fetching user_profiles:', error.message)
    return []
  }
  return data || []
}

async function getAllCustomers() {
  const { data, error } = await admin
    .from('customers')
    .select('id, auth_user_id, full_name, email, mobile_phone, phone, is_active, created_at')
  if (error) {
    console.error('❌ Error fetching customers:', error.message)
    return []
  }
  return data || []
}

// ─── PHASE 1: DIAGNOSTIC ──────────────────────────────────

async function runDiagnostic() {
  sep('FASE 1 — DIAGNÓSTICO (somente leitura)')

  const authUsers = await getAllAuthUsers()
  const userProfiles = await getAllUserProfiles()
  const customers = await getAllCustomers()

  console.log(`📊 Total auth.users: ${authUsers.length}`)
  console.log(`📊 Total user_profiles: ${userProfiles.length}`)
  console.log(`📊 Total customers: ${customers.length}`)

  // Create lookup maps
  const profileByAuthId = new Map(userProfiles.map(p => [p.auth_user_id, p]))
  const customerByAuthId = new Map()
  const customersByEmail = new Map()

  for (const c of customers) {
    if (c.auth_user_id) customerByAuthId.set(c.auth_user_id, c)
    if (c.email) {
      const key = c.email.toLowerCase().trim()
      if (!customersByEmail.has(key)) customersByEmail.set(key, [])
      customersByEmail.get(key).push(c)
    }
  }

  // ── 1. Recent auth users (last 30 days) ──
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const recentUsers = authUsers.filter(u => new Date(u.created_at) > thirtyDaysAgo)

  console.log(`\n📅 Auth users recentes (últimos 30 dias): ${recentUsers.length}`)
  if (recentUsers.length > 0) {
    console.table(recentUsers.map(u => ({
      auth_id: u.id.substring(0, 8) + '...',
      email: u.email,
      created: new Date(u.created_at).toLocaleDateString('pt-BR'),
      user_type: u.user_metadata?.user_type || '-',
      provider: u.app_metadata?.provider || 'email',
    })))
  }

  // ── 2. Orphans: no user_profile AND no customer ──
  const orphans = authUsers.filter(u =>
    !profileByAuthId.has(u.id) && !customerByAuthId.has(u.id)
  )

  console.log(`\n🔍 Órfãos (sem user_profile e sem customer): ${orphans.length}`)
  if (orphans.length > 0) {
    console.table(orphans.map(u => ({
      auth_id: u.id.substring(0, 8) + '...',
      email: u.email,
      created: new Date(u.created_at).toLocaleDateString('pt-BR'),
      name: u.user_metadata?.full_name || u.user_metadata?.name || '-',
      user_type: u.user_metadata?.user_type || '-',
      whitelisted: isWhitelisted(u.email) ? '🔒 SIM' : 'NÃO',
    })))
  }

  // ── 3. Customers with same email and auth_user_id NULL (link candidates) ──
  const linkCandidates = []
  for (const u of orphans) {
    if (!u.email || isWhitelisted(u.email)) continue
    const emailKey = u.email.toLowerCase().trim()
    const matchingCustomers = customersByEmail.get(emailKey) || []
    for (const c of matchingCustomers) {
      if (!c.auth_user_id) {
        linkCandidates.push({
          auth_id: u.id.substring(0, 8) + '...',
          auth_email: u.email,
          customer_id: c.id.substring(0, 8) + '...',
          customer_name: c.full_name,
          customer_email: c.email,
        })
      }
    }
  }

  console.log(`\n🔗 Candidatos a vinculação (customer sem auth_user_id, mesmo email): ${linkCandidates.length}`)
  if (linkCandidates.length > 0) console.table(linkCandidates)

  // ── 4. Conflicts: customer with same email but DIFFERENT auth_user_id ──
  const conflicts = []
  for (const u of orphans) {
    if (!u.email || isWhitelisted(u.email)) continue
    const emailKey = u.email.toLowerCase().trim()
    const matchingCustomers = customersByEmail.get(emailKey) || []
    for (const c of matchingCustomers) {
      if (c.auth_user_id && c.auth_user_id !== u.id) {
        conflicts.push({
          auth_id: u.id.substring(0, 8) + '...',
          auth_email: u.email,
          customer_id: c.id.substring(0, 8) + '...',
          customer_linked_to: c.auth_user_id.substring(0, 8) + '...',
          conflict: 'CONFLICT_EMAIL',
        })
      }
    }
  }

  console.log(`\n⚠️  Conflitos (email em uso por outro auth): ${conflicts.length}`)
  if (conflicts.length > 0) console.table(conflicts)

  // ── 5. Whitelist status ──
  console.log(`\n🔒 Whitelist interna:`)
  for (const email of WHITELIST) {
    const authUser = authUsers.find(u => u.email?.toLowerCase() === email)
    const profile = authUser ? profileByAuthId.get(authUser.id) : null
    const customer = authUser ? customerByAuthId.get(authUser.id) : null
    console.log(`  ${email}`)
    console.log(`    Auth:     ${authUser ? '✅ ' + authUser.id.substring(0, 8) + '...' : '❌ Não encontrado'}`)
    console.log(`    Profile:  ${profile ? '✅ ' + profile.system_role : '❌ Sem profile'}`)
    console.log(`    Customer: ${customer ? '✅ ' + customer.id.substring(0, 8) + '...' : '⚪ Sem customer'}`)
  }

  return { authUsers, userProfiles, customers, orphans, linkCandidates, conflicts, profileByAuthId, customerByAuthId, customersByEmail }
}

// ─── PHASE 2: DRY-RUN ──────────────────────────────────

function runDryRun(ctx) {
  sep('FASE 2 — DRY-RUN (sem alteração)')

  const { orphans, customersByEmail } = ctx
  const nonWhitelistedOrphans = orphans.filter(u => !isWhitelisted(u.email))

  const actions = { LINK: [], CREATE: [], CONFLICT: [], SKIP_WHITELIST: [] }

  // Whitelisted orphans (if any)
  const whitelistedOrphans = orphans.filter(u => isWhitelisted(u.email))
  for (const u of whitelistedOrphans) {
    actions.SKIP_WHITELIST.push({
      auth_id: u.id,
      email: u.email,
      reason: 'WHITELIST — NÃO TOCAR',
    })
  }

  for (const u of nonWhitelistedOrphans) {
    const emailKey = (u.email || '').toLowerCase().trim()
    const matchingCustomers = emailKey ? (customersByEmail.get(emailKey) || []) : []

    // Check for unlinked customer by email
    const unlinkable = matchingCustomers.find(c => !c.auth_user_id)
    const conflicting = matchingCustomers.find(c => c.auth_user_id && c.auth_user_id !== u.id)

    if (unlinkable) {
      actions.LINK.push({
        auth_id: u.id.substring(0, 8) + '...',
        email: u.email,
        customer_id: unlinkable.id.substring(0, 8) + '...',
        customer_name: unlinkable.full_name,
        action: 'VINCULAR EXISTENTE',
      })
    } else if (conflicting) {
      actions.CONFLICT.push({
        auth_id: u.id.substring(0, 8) + '...',
        email: u.email,
        customer_linked_to: conflicting.auth_user_id.substring(0, 8) + '...',
        action: 'CONFLITO — NÃO TOCAR',
      })
    } else {
      // No customer by email → create new
      actions.CREATE.push({
        auth_id: u.id.substring(0, 8) + '...',
        email: u.email || '(sem email)',
        name: u.user_metadata?.full_name || u.user_metadata?.name || (u.email ? u.email.split('@')[0] : 'Cliente'),
        phone: u.user_metadata?.phone || '-',
        action: 'CRIAR NOVO CUSTOMER',
      })
    }
  }

  console.log('📋 Resumo do dry-run:')
  console.log(`  🔗 VINCULAR existentes:  ${actions.LINK.length}`)
  console.log(`  ➕ CRIAR novos:          ${actions.CREATE.length}`)
  console.log(`  ⚠️  CONFLITOS (ignorar): ${actions.CONFLICT.length}`)
  console.log(`  🔒 WHITELIST (preservar): ${actions.SKIP_WHITELIST.length}`)

  if (actions.LINK.length > 0) {
    console.log('\n🔗 Customers a VINCULAR:')
    console.table(actions.LINK)
  }

  if (actions.CREATE.length > 0) {
    console.log('\n➕ Customers a CRIAR:')
    console.table(actions.CREATE)
  }

  if (actions.CONFLICT.length > 0) {
    console.log('\n⚠️  CONFLITOS (não serão tocados):')
    console.table(actions.CONFLICT)
  }

  if (actions.SKIP_WHITELIST.length > 0) {
    console.log('\n🔒 WHITELIST (preservados):')
    console.table(actions.SKIP_WHITELIST)
  }

  return actions
}

// ─── PHASE 3: APPLY ──────────────────────────────────

async function runApply(ctx) {
  sep('FASE 3 — APPLY (alterando banco)')

  const { orphans, customersByEmail } = ctx
  const nonWhitelistedOrphans = orphans.filter(u => !isWhitelisted(u.email))

  let linked = 0
  let created = 0
  let conflicted = 0
  let errors = 0

  for (const u of nonWhitelistedOrphans) {
    const emailKey = (u.email || '').toLowerCase().trim()
    const matchingCustomers = emailKey ? (customersByEmail.get(emailKey) || []) : []

    const unlinkable = matchingCustomers.find(c => !c.auth_user_id)
    const conflicting = matchingCustomers.find(c => c.auth_user_id && c.auth_user_id !== u.id)

    if (unlinkable) {
      // LINK existing customer
      const { error } = await admin
        .from('customers')
        .update({
          auth_user_id: u.id,
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', unlinkable.id)
        .is('auth_user_id', null) // Safety: only if still null

      if (error) {
        console.error(`  ❌ LINK FAILED for ${u.email}: ${error.message}`)
        errors++
      } else {
        console.log(`  ✅ LINKED: ${u.email} → customer ${unlinkable.id.substring(0, 8)}... (${unlinkable.full_name})`)
        linked++
      }

    } else if (conflicting) {
      console.log(`  ⚠️  CONFLICT: ${u.email} — customer linked to different auth user`)
      conflicted++

    } else {
      // CREATE new customer
      const resolvedName = u.user_metadata?.full_name || u.user_metadata?.name || (u.email ? u.email.split('@')[0] : 'Cliente')
      const normalizedName = resolvedName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const rawPhone = u.user_metadata?.phone?.replace(/\D/g, '') || null
      const validPhone = rawPhone && rawPhone.length >= 10 ? rawPhone : null

      const { data: newCustomer, error } = await admin
        .from('customers')
        .insert({
          auth_user_id: u.id,
          full_name: resolvedName,
          normalized_name: normalizedName,
          email: emailKey || null,
          mobile_phone: validPhone,
          is_active: true,
          last_login_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (error) {
        console.error(`  ❌ CREATE FAILED for ${u.email}: ${error.message}`)
        errors++
      } else {
        console.log(`  ✅ CREATED: ${u.email} → customer ${newCustomer?.id?.substring(0, 8)}... (${resolvedName})`)
        created++
      }
    }
  }

  console.log(`\n📊 Resultado do apply:`)
  console.log(`  🔗 Vinculados: ${linked}`)
  console.log(`  ➕ Criados:    ${created}`)
  console.log(`  ⚠️  Conflitos:  ${conflicted}`)
  console.log(`  ❌ Erros:      ${errors}`)

  return { linked, created, conflicted, errors }
}

// ─── PHASE 4: VERIFY ──────────────────────────────────

async function runVerify() {
  sep('FASE 4 — VERIFICAÇÃO PÓS-APPLY')

  const authUsers = await getAllAuthUsers()
  const userProfiles = await getAllUserProfiles()
  const customers = await getAllCustomers()

  const profileByAuthId = new Map(userProfiles.map(p => [p.auth_user_id, p]))
  const customerByAuthId = new Map()
  for (const c of customers) {
    if (c.auth_user_id) customerByAuthId.set(c.auth_user_id, c)
  }

  // Remaining orphans
  const remainingOrphans = authUsers.filter(u =>
    !profileByAuthId.has(u.id) && !customerByAuthId.has(u.id)
  )

  const nonWhitelistedRemaining = remainingOrphans.filter(u => !isWhitelisted(u.email))

  console.log(`📊 Total auth.users: ${authUsers.length}`)
  console.log(`📊 Total user_profiles: ${userProfiles.length}`)
  console.log(`📊 Total customers: ${customers.length}`)
  console.log(`📊 Órfãos restantes (não-whitelist): ${nonWhitelistedRemaining.length}`)
  console.log(`📊 Órfãos whitelist (esperado): ${remainingOrphans.length - nonWhitelistedRemaining.length}`)

  if (nonWhitelistedRemaining.length > 0) {
    console.log('\n⚠️  Órfãos NÃO resolvidos:')
    console.table(nonWhitelistedRemaining.map(u => ({
      auth_id: u.id.substring(0, 8) + '...',
      email: u.email,
      reason: 'Possível conflito não tratado',
    })))
  } else {
    console.log('\n✅ TODOS os órfãos foram resolvidos (exceto whitelist interna)!')
  }

  // Verify whitelist
  console.log('\n🔒 Whitelist — verificação final:')
  for (const email of WHITELIST) {
    const authUser = authUsers.find(u => u.email?.toLowerCase() === email)
    const profile = authUser ? profileByAuthId.get(authUser.id) : null
    const customer = authUser ? customerByAuthId.get(authUser.id) : null
    const status = profile ? `✅ ${profile.system_role}` : '⚪ Sem profile (esperado para órfãos internos)'
    console.log(`  ${email}: ${status}${customer ? ' | Customer: ✅' : ' | Customer: ⚪'}`)
  }

  return { remainingOrphans: nonWhitelistedRemaining.length }
}

// ─── MAIN ──────────────────────────────────────────────

async function main() {
  console.log('🔧 Barber Zac — Reconciliação Auth → Customers')
  console.log(`📅 ${new Date().toLocaleString('pt-BR')}`)
  console.log(`🔗 Supabase: ${SUPABASE_URL}`)
  console.log(`🔒 Whitelist: ${WHITELIST.length} emails protegidos`)

  // PHASE 1: Diagnostic
  const ctx = await runDiagnostic()

  if (ctx.orphans.length === 0) {
    console.log('\n✅ Nenhum órfão encontrado! Nada a fazer.')
    return
  }

  // PHASE 2: Dry-run
  const actions = runDryRun(ctx)

  const totalActions = actions.LINK.length + actions.CREATE.length
  if (totalActions === 0) {
    console.log('\n✅ Nenhuma ação necessária (apenas conflitos e/ou whitelist).')
    return
  }

  // PHASE 3: Apply
  console.log(`\n⚡ Executando ${totalActions} ações...`)
  const result = await runApply(ctx)

  // PHASE 4: Verify
  const verify = await runVerify()

  // ── FINAL REPORT ──
  sep('RELATÓRIO FINAL')
  console.log(`📊 Órfãos encontrados:      ${ctx.orphans.length}`)
  console.log(`🔗 Customers vinculados:     ${result.linked}`)
  console.log(`➕ Customers criados:        ${result.created}`)
  console.log(`⚠️  Conflitos (ignorados):    ${result.conflicted}`)
  console.log(`❌ Erros:                    ${result.errors}`)
  console.log(`🔒 Emails preservados:       ${WHITELIST.length}/5`)
  console.log(`📊 Órfãos restantes:         ${verify.remainingOrphans}`)
  console.log(`\n✅ Reconciliação completa!`)
}

main().catch(err => {
  console.error('💥 Fatal error:', err)
  process.exit(1)
})
