/**
 * Barber Zac ERP — Subscription Plans Audit Script
 * 
 * FASE 0: Diagnóstico obrigatório antes de qualquer implementação.
 * Consulta o banco real para responder todas as 30 perguntas da auditoria.
 * 
 * Usage: node scripts/audit-subscription-plans.mjs
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
// PLAN NAME PARSER
// ═══════════════════════════════════════════════════════════════

function parsePlanName(name) {
  const result = {
    planNumber: null,
    includedServices: {},
    visitTemplate: [],
    visitsPerCycle: 0,
    professionalScope: null,
    confidence: 'high',
    needsManualReview: false,
    parseErrors: [],
  }

  // Extract plan number: "Plano 1", "Plano 2", etc
  const planNumMatch = name.match(/^Plano\s+(\d+)/i)
  if (planNumMatch) {
    result.planNumber = parseInt(planNumMatch[1])
  } else {
    result.parseErrors.push('Could not extract plan number')
    result.confidence = 'low'
    result.needsManualReview = true
  }

  // Extract professional scope
  const nameNorm = name.toLowerCase()
  if (/gustavo\s*e\s*matheus/i.test(name)) {
    result.professionalScope = 'gustavo_matheus'
  } else if (/zac/i.test(name) && !/plano\s+\d+\s*-?\s*\d/i.test(name.replace(/zac/i, ''))) {
    // "ZAC" but not as part of another word
    result.professionalScope = 'zac'
  } else {
    result.parseErrors.push('Could not determine professional scope')
    result.confidence = 'low'
    result.needsManualReview = true
  }

  // Extract service items: "04 Cortes + 04 Sobrancelhas", "02 Cortes + 04 Barbas"
  // Remove plan number, separators, and professional scope
  let itemsPart = name
    .replace(/^Plano\s+\d+\s*[-–—]\s*/i, '')
    .replace(/\s*[-–—/]\s*(Gustavo\s*e\s*Matheus|ZAC)\s*$/i, '')
    .trim()

  // Match patterns like "04 Cortes", "01 Pezinho", "04 Barbas"
  const itemRegex = /(\d+)\s+(\w+(?:\s+\w+)?)/gi
  let match
  const items = []
  while ((match = itemRegex.exec(itemsPart)) !== null) {
    const qty = parseInt(match[1])
    let serviceName = match[2].toLowerCase().trim()
    
    // Normalize service names
    if (/corte|cortes/i.test(serviceName)) serviceName = 'corte'
    else if (/sobrancelha|sobrancelhas/i.test(serviceName)) serviceName = 'sobrancelha'
    else if (/barba|barbas/i.test(serviceName)) serviceName = 'barba'
    else if (/pezinho|pezinhos/i.test(serviceName)) serviceName = 'pezinho'
    else {
      result.parseErrors.push(`Unknown service item: ${match[2]}`)
      result.confidence = 'medium'
    }
    
    items.push({ name: serviceName, qty })
    result.includedServices[serviceName] = qty
  }

  if (items.length === 0) {
    result.parseErrors.push('Could not extract any service items')
    result.confidence = 'low'
    result.needsManualReview = true
    return result
  }

  // Calculate visits per cycle = max quantity
  const maxQty = Math.max(...items.map(i => i.qty))
  result.visitsPerCycle = maxQty

  // Build visit template
  // Strategy: distribute items across visits, filling from the largest quantity first
  // Sort items by quantity descending
  const sortedItems = [...items].sort((a, b) => b.qty - a.qty)
  
  for (let visitIndex = 0; visitIndex < maxQty; visitIndex++) {
    const visitItems = []
    for (const item of sortedItems) {
      if (visitIndex < item.qty) {
        visitItems.push(item.name)
      }
    }
    result.visitTemplate.push({
      visitIndex: visitIndex + 1,
      items: visitItems,
      label: visitItems.join(' + '),
    })
  }

  // Check if quantities are equal (simple plan) or different (mixed plan)
  const allEqual = items.every(i => i.qty === items[0].qty)
  if (!allEqual) {
    // Mixed plan — verify template makes sense
    const totalDistributed = {}
    for (const visit of result.visitTemplate) {
      for (const item of visit.items) {
        totalDistributed[item] = (totalDistributed[item] || 0) + 1
      }
    }
    // Verify totals match
    for (const item of items) {
      if ((totalDistributed[item.name] || 0) !== item.qty) {
        result.parseErrors.push(`Template distribution mismatch for ${item.name}: expected ${item.qty}, got ${totalDistributed[item.name] || 0}`)
        result.confidence = 'low'
        result.needsManualReview = true
      }
    }
  }

  return result
}

// ═══════════════════════════════════════════════════════════════
// MAIN AUDIT
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║  Barber Zac — FASE 0: Subscription Plans Audit         ║')
  console.log('╚══════════════════════════════════════════════════════════╝')
  console.log(`\nSupabase: ${supabaseUrl}\n`)

  // ── Q1-Q5: Services starting with "Plano" ──────────────────
  console.log('═══ Q1-Q5: Services starting with "Plano" ═══\n')
  
  const { data: planServices, error: planErr } = await supabase
    .from('services')
    .select('id, name, price, duration_minutes, category_id, is_active, is_bookable, service_categories(id, name)')
    .ilike('name', 'Plano%')
    .order('name')

  if (planErr) {
    console.error('❌ Error fetching plan services:', planErr.message)
    process.exit(1)
  }

  console.log(`Found ${planServices.length} services starting with "Plano":\n`)
  
  for (const svc of planServices) {
    const catName = svc.service_categories?.name || '(sem categoria)'
    console.log(`  ID: ${svc.id}`)
    console.log(`  Nome: ${svc.name}`)
    console.log(`  Preço: R$ ${svc.price?.toFixed(2) || '0.00'}`)
    console.log(`  Duração: ${svc.duration_minutes} min`)
    console.log(`  Categoria: ${catName} (${svc.category_id || 'null'})`)
    console.log(`  Ativo: ${svc.is_active} | Bookable: ${svc.is_bookable}`)
    console.log('')
  }

  // ── Q6-Q7: Professional scope ──────────────────────────────
  console.log('═══ Q6-Q7: Professional Scope Detection ═══\n')
  
  const gustavoPlans = planServices.filter(s => /gustavo\s*e\s*matheus/i.test(s.name))
  const zacPlans = planServices.filter(s => /zac/i.test(s.name))
  
  console.log(`Plans with "Gustavo e Matheus": ${gustavoPlans.length}`)
  gustavoPlans.forEach(p => console.log(`  - ${p.name}`))
  console.log(`\nPlans with "ZAC": ${zacPlans.length}`)
  zacPlans.forEach(p => console.log(`  - ${p.name}`))
  console.log('')

  // ── Q8-Q9: Collaborator IDs ────────────────────────────────
  console.log('═══ Q8-Q9: Collaborator IDs (ALL active barbeiros) ═══\n')
  
  const { data: collabs, error: collabErr } = await supabase
    .from('collaborators')
    .select('id, name, display_name, role, is_active')
    .eq('is_active', true)
    .order('name')

  if (collabErr) {
    console.error('❌ Error fetching collaborators:', collabErr.message)
  } else {
    console.log(`Found ${collabs.length} active collaborators:\n`)
    for (const c of collabs) {
      console.log(`  ID: ${c.id}`)
      console.log(`  Name: ${c.name}`)
      console.log(`  Display: ${c.display_name || '(none)'}`)
      console.log(`  Role: ${c.role}`)
      console.log('')
    }
  }

  // Specific lookups
  const guhsp = collabs?.find(c => /guh/i.test(c.name) || /guh/i.test(c.display_name || ''))
  const gulu = collabs?.find(c => /gulu/i.test(c.name) || /gulu/i.test(c.display_name || ''))
  const zac = collabs?.find(c => /zac/i.test(c.name) || /zac/i.test(c.display_name || ''))
  const joao = collabs?.find(c => /jo[ãa]o/i.test(c.name) || /jo[ãa]o/i.test(c.display_name || ''))

  console.log('═══ Professional ID Resolution ═══\n')
  console.log(`  GuhSP: ${guhsp ? `✅ ${guhsp.id} (${guhsp.name})` : '❌ NOT FOUND'}`)
  console.log(`  Gulu:  ${gulu ? `✅ ${gulu.id} (${gulu.name})` : '❌ NOT FOUND'}`)
  console.log(`  Zac:   ${zac ? `✅ ${zac.id} (${zac.name})` : '❌ NOT FOUND'}`)
  console.log(`  João:  ${joao ? `✅ ${joao.id} (${joao.name})` : '❌ NOT FOUND'}`)
  console.log('')

  // ── Q10-Q13: Plan parsing ──────────────────────────────────
  console.log('═══ Q10-Q13: Plan Name Parsing & Visit Templates ═══\n')
  
  let ambiguousCount = 0
  let failedParseCount = 0
  let mixedPlansCount = 0
  let reviewNeededCount = 0

  for (const svc of planServices) {
    const parsed = parsePlanName(svc.name)
    
    console.log(`  ┌─ ${svc.name}`)
    console.log(`  │  Plan #: ${parsed.planNumber || '?'}`)
    console.log(`  │  Scope: ${parsed.professionalScope || '?'}`)
    console.log(`  │  Included: ${JSON.stringify(parsed.includedServices)}`)
    console.log(`  │  Visits/cycle: ${parsed.visitsPerCycle}`)
    console.log(`  │  Confidence: ${parsed.confidence}`)
    console.log(`  │  Needs Review: ${parsed.needsManualReview}`)
    
    if (parsed.visitTemplate.length > 0) {
      console.log(`  │  Visit Template:`)
      for (const visit of parsed.visitTemplate) {
        console.log(`  │    Visit ${visit.visitIndex}: ${visit.label}`)
      }
    }
    
    if (parsed.parseErrors.length > 0) {
      console.log(`  │  ⚠️  Errors: ${parsed.parseErrors.join('; ')}`)
    }
    
    // Check if mixed (different quantities)
    const qtys = Object.values(parsed.includedServices)
    const isMixed = qtys.length > 1 && !qtys.every(q => q === qtys[0])
    if (isMixed) {
      console.log(`  │  🔀 MIXED PLAN (different quantities)`)
      mixedPlansCount++
    }
    
    console.log(`  └─`)
    console.log('')

    if (parsed.confidence === 'low') ambiguousCount++
    if (parsed.parseErrors.length > 0) failedParseCount++
    if (parsed.needsManualReview) reviewNeededCount++
  }

  // ── Q14-Q15: Category check ────────────────────────────────
  console.log('═══ Q14-Q15: Category "Planos Mensais" Check ═══\n')
  
  const { data: cats } = await supabase
    .from('service_categories')
    .select('*')
    .order('name')

  console.log('All service categories:')
  for (const cat of (cats || [])) {
    console.log(`  ${cat.is_active ? '✅' : '❌'} ${cat.name} (${cat.id})`)
  }
  
  const planosCat = cats?.find(c => /planos?\s*mensai?s/i.test(c.name))
  console.log(`\n  "Planos Mensais" category: ${planosCat ? `✅ EXISTS (${planosCat.id})` : '❌ DOES NOT EXIST — needs creation'}`)
  console.log('')

  // ── Q16: Field conflicts ───────────────────────────────────
  console.log('═══ Q16: Appointment Field Check ═══\n')
  
  // Check if subscription fields already exist in appointments
  const { data: sampleAppt } = await supabase
    .from('appointments')
    .select('*')
    .limit(1)

  if (sampleAppt && sampleAppt.length > 0) {
    const fields = Object.keys(sampleAppt[0])
    console.log(`  subscription_id: ${fields.includes('subscription_id') ? '✅ EXISTS' : '❌ NOT YET'}`)
    console.log(`  subscription_occurrence_id: ${fields.includes('subscription_occurrence_id') ? '✅ EXISTS' : '❌ NOT YET'}`)
    console.log(`  is_subscription: ${fields.includes('is_subscription') ? '✅ EXISTS' : '❌ NOT YET'}`)
    console.log(`  source field: ${fields.includes('source') ? '✅ EXISTS' : '❌ NOT FOUND'}`)
    if (fields.includes('source')) {
      console.log(`    source value: "${sampleAppt[0].source}"`)
    }
  }
  console.log('')

  // ── Check if subscription tables already exist ─────────────
  console.log('═══ Subscription Tables Check ═══\n')
  
  for (const table of ['subscription_plans', 'customer_subscriptions', 'subscription_occurrences', 'subscription_payments', 'subscription_webhook_events', 'subscription_plan_professionals']) {
    const { error } = await supabase.from(table).select('id').limit(1)
    console.log(`  ${table}: ${error ? '❌ NOT YET' : '✅ EXISTS'}`)
  }
  console.log('')

  // ── SUMMARY ────────────────────────────────────────────────
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║  AUDIT SUMMARY                                         ║')
  console.log('╚══════════════════════════════════════════════════════════╝')
  console.log(``)
  console.log(`  Total "Plano" services:     ${planServices.length}`)
  console.log(`  Gustavo+Matheus plans:       ${gustavoPlans.length}`)
  console.log(`  ZAC plans:                   ${zacPlans.length}`)
  console.log(`  Ambiguous (low confidence):  ${ambiguousCount}`)
  console.log(`  Failed to parse:             ${failedParseCount}`)
  console.log(`  Mixed plans (diff qtys):     ${mixedPlansCount}`)
  console.log(`  Needs manual review:         ${reviewNeededCount}`)
  console.log(`  GuhSP found:                 ${guhsp ? '✅' : '❌'}`)
  console.log(`  Gulu found:                  ${gulu ? '✅' : '❌'}`)
  console.log(`  Barber Zac found:            ${zac ? '✅' : '❌'}`)
  console.log(`  João Victor found:           ${joao ? '✅' : '❌'}`)
  console.log(`  "Planos Mensais" category:   ${planosCat ? '✅' : '❌ NEEDS CREATION'}`)
  console.log('')

  // ── Q17-Q20 (code-level, answered here) ────────────────────
  console.log('═══ Q17-Q20: Code-level Answers ═══\n')
  console.log('  Q17: getPublicBookingCatalogV2 must filter isPlan services out of combo/build views.')
  console.log('       Classification engine already sets isPlan=true. ReadyCombosList filters by isCombo.')
  console.log('       Need to ensure isPlan services have isCombo=false so they don\'t appear in combos.')
  console.log('')
  console.log('  Q18: New funil will load plans from getPublicSubscriptionPlans() in subscription.actions.ts')
  console.log('       NOT from getPublicBookingCatalogV2.')
  console.log('')
  console.log('  Q19: Plans won\'t appear in Combos Prontos because:')
  console.log('       - classification engine: isPlan=true, isCombo=false')
  console.log('       - ReadyCombosList filters by isCombo===true')
  console.log('       - Plans will fail this filter automatically')
  console.log('')
  console.log('  Q20: Plans in "Ver todos" (ServiceCatalog): will be filtered by isPlan in V2 catalog.')
  console.log('       Legacy catalog uses service_categories — once plans are in "Planos Mensais" category,')
  console.log('       they naturally separate. Additionally, shouldHideFromPublicFunnel can be set.')
  console.log('')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
