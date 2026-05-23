#!/usr/bin/env node
/**
 * Barber Zac ERP — Migrate Subscription Plans from Services
 *
 * Usage:
 *   node scripts/migrate-subscription-plans-from-services.mjs --dry-run
 *   node scripts/migrate-subscription-plans-from-services.mjs --apply
 *
 * Dry-run is the DEFAULT. --apply requires all 14 plans at high confidence.
 *
 * What it does:
 * 1. Finds all services starting with "Plano"
 * 2. Parses plan_number, items, visits, scope, visit_template
 * 3. Maps professionals by confirmed IDs
 * 4. On --apply:
 *    a. Creates/reuses "Planos Mensais" category
 *    b. Creates subscription_plans records
 *    c. Creates subscription_plan_professionals records
 *    d. Validates all 14 plans created
 *    e. Moves service category_id to Planos Mensais
 *    f. Validates combos are untouched
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── Load env ──
try {
  const envPath = resolve(process.cwd(), '.env.local')
  readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const [key, ...v] = line.split('=')
    if (key && v.length > 0) {
      const val = v.join('=').trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[key.trim()]) process.env[key.trim()] = val
    }
  })
} catch {}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const isApply = process.argv.includes('--apply')

// ── Confirmed Professional IDs ──
const PROFESSIONAL_MAP = {
  gustavo_matheus: [
    { id: '77d223f2-e66c-4f63-8dda-1db7e98a0b92', name: 'GuhSP' },
    { id: '0c12ffd5-c6c7-459a-b22a-ffc41bd67f53', name: 'Gulu' },
  ],
  zac: [
    { id: '896213fa-5918-4b97-8518-7bb7302e195e', name: 'Barber Zac' },
  ],
}

// ── Plan Name Parser ──
function parsePlanName(name) {
  const result = {
    planNumber: null,
    items: {},
    visitsPerCycle: null,
    scope: 'unknown',
    needsVisitTemplate: false,
    visitTemplate: null,
    confidence: 'high',
    needsManualReview: false,
    displayName: '',
  }

  // Extract plan number
  const numMatch = name.match(/plano\s+(\d+)/i)
  if (numMatch) result.planNumber = parseInt(numMatch[1])

  // Extract scope
  const nameLower = name.toLowerCase()
  if (nameLower.includes('gustavo') && nameLower.includes('matheus')) {
    result.scope = 'gustavo_matheus'
  } else if (nameLower.includes('zac')) {
    result.scope = 'zac'
  } else {
    result.scope = 'unknown'
    result.confidence = 'low'
    result.needsManualReview = true
  }

  // Build display name
  const scopeLabel = result.scope === 'gustavo_matheus' ? 'Gustavo e Matheus' : result.scope === 'zac' ? 'ZAC' : '???'
  result.displayName = `Plano ${result.planNumber || '?'} — ${scopeLabel}`

  // Extract items
  const itemRegex = /(\d+)\s+(corte|barba|sobrancelha|pezinho|sombrancelha)[s]?/gi
  let match
  while ((match = itemRegex.exec(name)) !== null) {
    const qty = parseInt(match[1])
    const itemType = match[2].toLowerCase().replace('sombrancelha', 'sobrancelha')
    result.items[itemType] = qty
  }

  // Calculate visits per cycle (max of all quantities)
  const quantities = Object.values(result.items)
  if (quantities.length > 0) {
    result.visitsPerCycle = Math.max(...quantities)
  }

  // Build visit template (always — even for equal quantities)
  if (quantities.length > 0) {
    const uniqueQtys = [...new Set(quantities)]
    result.needsVisitTemplate = uniqueQtys.length > 1
    result.visitTemplate = buildVisitTemplate(result.items, result.visitsPerCycle)
  }

  if (Object.keys(result.items).length === 0) {
    result.confidence = 'low'
    result.needsManualReview = true
  }

  return result
}

function buildVisitTemplate(items, totalVisits) {
  const itemEntries = Object.entries(items).sort((a, b) => b[1] - a[1])
  const remaining = {}
  for (const [type, qty] of itemEntries) {
    remaining[type] = qty
  }

  const template = []
  for (let v = 0; v < totalVisits; v++) {
    const visit = []
    for (const [type] of itemEntries) {
      if (remaining[type] > 0) {
        visit.push(type)
        remaining[type]--
      }
    }
    template.push({ index: v + 1, items: visit })
  }

  return template
}

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// ══════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log(`║  Migrate Subscription Plans — ${isApply ? '--apply (REAL)' : '--dry-run (PREVIEW)'}`)
  console.log('╚══════════════════════════════════════════════════════════════╝\n')

  // ── Step 1: Fetch all "Plano" services ──
  const { data: planoServices, error: svcErr } = await supabase
    .from('services')
    .select('id, name, price, duration_minutes, is_active, is_bookable, category_id, description')
    .ilike('name', 'Plano%')
    .order('name')

  if (svcErr) {
    console.error('❌ ERRO ao consultar services:', svcErr.message)
    process.exit(1)
  }

  console.log(`📋 Planos encontrados: ${planoServices.length}\n`)
  if (planoServices.length !== 14) {
    console.error(`❌ ERRO: Esperado 14 planos, encontrado ${planoServices.length}. Abortando.`)
    process.exit(1)
  }

  // ── Step 2: Parse each plan ──
  const parsedPlans = planoServices.map(svc => {
    const parsed = parsePlanName(svc.name)
    return {
      service: svc,
      ...parsed,
    }
  })

  // ── Step 3: Validate all plans ──
  let hasErrors = false

  console.log('══ Relatório dos Planos ══\n')
  for (const plan of parsedPlans) {
    const profs = PROFESSIONAL_MAP[plan.scope] || []
    const status = plan.confidence === 'high' ? '✅' : plan.confidence === 'medium' ? '⚠️' : '❌'

    console.log(`${status} ${plan.service.name}`)
    console.log(`   ID: ${plan.service.id}`)
    console.log(`   Preço: R$ ${plan.service.price?.toFixed(2)}`)
    console.log(`   Duração: ${plan.service.duration_minutes}min`)
    console.log(`   Categoria atual: ${plan.service.category_id}`)
    console.log(`   plan_number: ${plan.planNumber}`)
    console.log(`   scope: ${plan.scope}`)
    console.log(`   visits_per_cycle: ${plan.visitsPerCycle}`)
    console.log(`   items: ${JSON.stringify(plan.items)}`)
    console.log(`   professionals: ${profs.map(p => `${p.name} (${p.id})`).join(', ')}`)
    console.log(`   confidence: ${plan.confidence}`)
    console.log(`   needs_manual_review: ${plan.needsManualReview}`)
    if (plan.visitTemplate) {
      console.log(`   visit_template:`)
      plan.visitTemplate.forEach(v => console.log(`     visita ${v.index}: ${v.items.join(' + ')}`))
    }
    console.log('')

    if (plan.confidence !== 'high') {
      hasErrors = true
      console.error(`   ❌ ERRO: Confiança "${plan.confidence}" para "${plan.service.name}"`)
    }
    if (plan.needsManualReview) {
      hasErrors = true
      console.error(`   ❌ ERRO: Precisa revisão manual: "${plan.service.name}"`)
    }
    if (profs.length === 0) {
      hasErrors = true
      console.error(`   ❌ ERRO: Sem profissionais mapeados: scope="${plan.scope}"`)
    }
  }

  // ── Step 4: Verify professional IDs exist ──
  console.log('\n══ Verificação dos Profissionais ══\n')
  const allProfIds = [
    ...PROFESSIONAL_MAP.gustavo_matheus.map(p => p.id),
    ...PROFESSIONAL_MAP.zac.map(p => p.id),
  ]
  const { data: collabs } = await supabase
    .from('collaborators')
    .select('id, name, display_name, is_active')
    .in('id', allProfIds)

  for (const expected of [...PROFESSIONAL_MAP.gustavo_matheus, ...PROFESSIONAL_MAP.zac]) {
    const found = collabs?.find(c => c.id === expected.id)
    if (found) {
      console.log(`  ✅ ${expected.name}: ${found.name} (${found.display_name}) — ativo: ${found.is_active}`)
    } else {
      console.error(`  ❌ ${expected.name}: NÃO ENCONTRADO no banco! ID: ${expected.id}`)
      hasErrors = true
    }
  }

  // ── Step 5: Check combo count (should NOT be affected) ──
  console.log('\n══ Verificação Combos Prontos ══\n')
  const { data: combosBefore } = await supabase
    .from('services')
    .select('id')
    .eq('category_id', '5b322c92-85ca-42fb-94f2-94ae0f900a33')
    .eq('is_active', true)
    .not('name', 'ilike', 'Plano%')

  const comboCount = combosBefore?.length || 0
  console.log(`  Combos comuns (não-plano) na categoria: ${comboCount}`)

  // ── Summary ──
  console.log('\n══ Resumo ══\n')
  console.log(`  Planos encontrados: ${parsedPlans.length}`)
  console.log(`  Planos com alta confiança: ${parsedPlans.filter(p => p.confidence === 'high').length}`)
  console.log(`  Planos com review manual: ${parsedPlans.filter(p => p.needsManualReview).length}`)
  console.log(`  Erros bloqueantes: ${hasErrors ? 'SIM' : 'NÃO'}`)

  if (!isApply) {
    console.log('\n📋 Modo DRY-RUN — nenhuma alteração foi feita.')
    console.log('   Para aplicar: node scripts/migrate-subscription-plans-from-services.mjs --apply')
    process.exit(hasErrors ? 1 : 0)
  }

  // ══════════════════════════════════════════════════════
  // APPLY MODE
  // ══════════════════════════════════════════════════════

  if (hasErrors) {
    console.error('\n❌ ABORTANDO --apply: existem erros bloqueantes.')
    process.exit(1)
  }

  console.log('\n\n══════════════════════════════════════')
  console.log('   APLICANDO ALTERAÇÕES...')
  console.log('══════════════════════════════════════\n')

  // ── A1: Create/reuse "Planos Mensais" category ──
  console.log('── A1: Categoria "Planos Mensais" ──')
  let categoryId
  const { data: existingCat } = await supabase
    .from('service_categories')
    .select('id')
    .eq('normalized_name', 'planos mensais')
    .single()

  if (existingCat) {
    categoryId = existingCat.id
    console.log(`  ✅ Categoria já existe: ${categoryId}`)
  } else {
    const { data: newCat, error: catErr } = await supabase
      .from('service_categories')
      .insert({
        name: 'Planos Mensais',
        normalized_name: 'planos mensais',
        is_active: true,
      })
      .select('id')
      .single()

    if (catErr) {
      console.error(`  ❌ Erro ao criar categoria:`, catErr.message)
      process.exit(1)
    }
    categoryId = newCat.id
    console.log(`  ✅ Categoria criada: ${categoryId}`)
  }

  // ── A2: Create subscription_plans ──
  console.log('\n── A2: Criando subscription_plans ──')

  let created = 0
  let skipped = 0
  const planIdMap = {} // service_id → subscription_plan_id

  for (const plan of parsedPlans) {
    // Check if already exists (idempotent)
    const { data: existing } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('source_service_id', plan.service.id)
      .single()

    if (existing) {
      console.log(`  ⏭️  Já existe: ${plan.service.name} → ${existing.id}`)
      planIdMap[plan.service.id] = existing.id
      skipped++
      continue
    }

    const slug = slugify(plan.displayName)
    const { data: newPlan, error: planErr } = await supabase
      .from('subscription_plans')
      .insert({
        source_service_id: plan.service.id,
        name: plan.service.name,
        display_name: plan.displayName,
        slug,
        plan_number: plan.planNumber,
        monthly_price: plan.service.price,
        duration_minutes_per_visit: plan.service.duration_minutes,
        visits_per_cycle: plan.visitsPerCycle,
        included_services_json: plan.items,
        visit_template_json: plan.visitTemplate || [],
        professional_scope: plan.scope,
        needs_manual_review: plan.needsManualReview,
        imported_from_service: true,
        is_active: true,
        show_in_customer_portal: !plan.needsManualReview,
        sort_order: (plan.planNumber || 0) * 10 + (plan.scope === 'zac' ? 1 : 0),
      })
      .select('id')
      .single()

    if (planErr) {
      console.error(`  ❌ Erro ao criar plano "${plan.service.name}":`, planErr.message)
      process.exit(1)
    }

    planIdMap[plan.service.id] = newPlan.id
    created++
    console.log(`  ✅ Criado: ${plan.service.name} → ${newPlan.id}`)
  }
  console.log(`\n  📊 Criados: ${created} | Já existiam: ${skipped}`)

  // ── A3: Create subscription_plan_professionals ──
  console.log('\n── A3: Criando subscription_plan_professionals ──')

  for (const plan of parsedPlans) {
    const subPlanId = planIdMap[plan.service.id]
    if (!subPlanId) continue

    const profs = PROFESSIONAL_MAP[plan.scope] || []
    for (const prof of profs) {
      const { error: profErr } = await supabase
        .from('subscription_plan_professionals')
        .upsert({
          plan_id: subPlanId,
          professional_id: prof.id,
        }, { onConflict: 'plan_id,professional_id' })

      if (profErr) {
        console.error(`  ❌ Erro ao vincular ${prof.name} ao plano:`, profErr.message)
      } else {
        console.log(`  ✅ ${plan.displayName} ← ${prof.name}`)
      }
    }
  }

  // ── A4: Validate all 14 plans were created ──
  console.log('\n── A4: Validando planos criados ──')
  const { data: allPlans } = await supabase
    .from('subscription_plans')
    .select('id, source_service_id, name')
    .eq('imported_from_service', true)

  if (!allPlans || allPlans.length !== 14) {
    console.error(`  ❌ ERRO: Esperado 14 planos, encontrado ${allPlans?.length || 0}. Não movendo categorias.`)
    process.exit(1)
  }
  console.log(`  ✅ Todos os 14 planos confirmados.`)

  // ── A5: Move service category to Planos Mensais ──
  console.log('\n── A5: Movendo services para categoria Planos Mensais ──')

  const serviceIds = parsedPlans.map(p => p.service.id)
  const { error: moveErr } = await supabase
    .from('services')
    .update({ category_id: categoryId })
    .in('id', serviceIds)

  if (moveErr) {
    console.error(`  ❌ Erro ao mover services:`, moveErr.message)
    process.exit(1)
  }
  console.log(`  ✅ ${serviceIds.length} services movidos para Planos Mensais.`)

  // ── A6: Validate planos left Combos Prontos ──
  console.log('\n── A6: Validando saída de Combos Prontos ──')
  const { data: remainingInCombos } = await supabase
    .from('services')
    .select('id, name')
    .eq('category_id', '5b322c92-85ca-42fb-94f2-94ae0f900a33')
    .ilike('name', 'Plano%')

  if (remainingInCombos && remainingInCombos.length > 0) {
    console.error(`  ❌ ERRO: ${remainingInCombos.length} planos ainda em Combos Prontos!`)
    remainingInCombos.forEach(s => console.error(`    - ${s.name}`))
    process.exit(1)
  }
  console.log(`  ✅ Nenhum plano restante em Combos Prontos.`)

  // ── A7: Validate combos untouched ──
  console.log('\n── A7: Validando combos comuns preservados ──')
  const { data: combosAfter } = await supabase
    .from('services')
    .select('id')
    .eq('category_id', '5b322c92-85ca-42fb-94f2-94ae0f900a33')
    .eq('is_active', true)

  const comboCountAfter = combosAfter?.length || 0
  if (comboCountAfter === comboCount) {
    console.log(`  ✅ Combos preservados: ${comboCountAfter} (antes: ${comboCount})`)
  } else {
    console.warn(`  ⚠️ Contagem diferente: antes=${comboCount}, depois=${comboCountAfter}`)
  }

  // ── Final Report ──
  console.log('\n\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║  MIGRAÇÃO CONCLUÍDA COM SUCESSO                            ║')
  console.log('╚══════════════════════════════════════════════════════════════╝\n')

  console.log(`  📊 Planos importados: ${created + skipped}`)
  console.log(`  📁 Categoria "Planos Mensais": ${categoryId}`)
  console.log(`  🔄 Services movidos: ${serviceIds.length}`)
  console.log(`  🏷️  Combos preservados: ${comboCountAfter}`)
  console.log(`  👥 Profissionais vinculados: GuhSP, Gulu, Barber Zac`)
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
