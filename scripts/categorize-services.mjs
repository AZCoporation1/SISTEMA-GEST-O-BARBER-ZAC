/**
 * Barber Zac ERP — Service Categorization Script (Dry-Run by Default)
 *
 * Usage:
 *   node scripts/categorize-services.mjs          # Dry-run (relatório apenas)
 *   node scripts/categorize-services.mjs --apply   # Aplicar mudanças no banco
 *
 * NÃO renomeia serviços. Apenas atribui category_id.
 * Cria categorias novas se necessário.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gyausvxjrpkheennijiv.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5YXVzdnhqcnBraGVlbm5paml2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzM2MjM0MiwiZXhwIjoyMDg4OTM4MzQyfQ.YXftgRA-zScwy391X-T87gNzbLS2ABZZVKSMyGdQLMY'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const applyMode = process.argv.includes('--apply')

// ── Normalize ─────────────────────────────────────────────
function norm(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00A0/g, ' ')    // non-breaking space → normal space
    .replace(/&amp;/g, '&')
    .replace(/&/g, '&')
    .trim()
}

// ── Professional Final Categories (11) ────────────────────
const SLUG_MAP = {
  'combos-prontos': 'Combos Prontos',
  'cortes-de-cabelo': 'Cortes de Cabelo',
  'barba-e-bigode': 'Barba e Bigode',
  'sobrancelha-e-depilacao': 'Sobrancelha e Depilação',
  'estetica-e-bem-estar': 'Estética e Bem-estar',
  'quimicas-e-coloracao': 'Químicas e Coloração',
  'tratamentos-capilares': 'Tratamentos Capilares',
  'finalizacao-e-penteados': 'Finalização e Penteados',
  'consultoria-e-educacao': 'Consultoria e Educação',
  'atendimento-especial': 'Atendimento Especial',
  'outros': 'Outros',
}

// Map existing DB category names → slug (for reuse)
const EXISTING_CAT_MAPPINGS = {
  'quimicas (luzes/nevou/alissamento/etc)': 'quimicas-e-coloracao',
  'estetica e bem estar': 'estetica-e-bem-estar',
  'cortes de cabelo': 'cortes-de-cabelo',
  'barba e bigode': 'barba-e-bigode',
}

// ── Keyword Groups ────────────────────────────────────────
const KW = {
  combo: /combo|pacote/,
  corte: /corte|degrade|social|executivo|fade|tesoura|texturizacao|zac|infantil|pezinho cabelo|passar a maquina/,
  barba: /barba|barboterapia|terapia de barba|razor|aparar barba|cavanhaque|pezinho barba/,
  bigode: /bigode/,
  sobrancelha: /sobrancelha|sombrancelha/,
  depilacao: /cera nasal|nazal|nasal|orelha|depilacao|apenugem|limpeza orelha|raspagem.*(costas|peito)/,
  estetica: /limpeza de pele|massoterapia|remocao de cravos|ozonio|estetica|facial|skin care|detox/,
  quimica: /progressiva|alisamento|alissamento|luzes|reflexo|nevou|platinado|tintura|colorimetria|mechas|selagem|botox|pintura black|pintura colors|camuflagem|pigmentacao|micropigmentacao|colors fun/,
  tratamento: /hidratacao|reconstrucao|mascara|tratamento|cauterizacao|nutricao|acidificacao|sos reconstrutor|lavagem|lavatorio/,
  finalizacao: /penteado|finalizacao/,
  consultoria: /consultoria|aula particular|metodo tbe|visagista|abordagem visagista|entrega.*(certificado)/,
  especial: /emergencial/,
}

const DISPLAY_CATS = {
  corte: ['Cabelo'], barba: ['Barba e Bigode'], bigode: ['Barba e Bigode'],
  sobrancelha: ['Sobrancelha e Depilação'], depilacao: ['Sobrancelha e Depilação'],
  estetica: ['Estética e Bem-estar'], quimica: ['Químicas e Coloração'],
  tratamento: ['Tratamentos Capilares'], finalizacao: ['Finalização e Penteados'],
  consultoria: ['Consultoria e Educação'], especial: ['Atendimento Especial'],
}

const GROUP_SLUG = {
  corte: 'cortes-de-cabelo', barba: 'barba-e-bigode', bigode: 'barba-e-bigode',
  sobrancelha: 'sobrancelha-e-depilacao', depilacao: 'sobrancelha-e-depilacao',
  estetica: 'estetica-e-bem-estar', quimica: 'quimicas-e-coloracao',
  tratamento: 'tratamentos-capilares', finalizacao: 'finalizacao-e-penteados',
  consultoria: 'consultoria-e-educacao', especial: 'atendimento-especial',
}

// ── Specific Overrides ────────────────────────────────────
const OVERRIDES = {
  'abordagem visagista': {
    slug: 'consultoria-e-educacao', displayCategories: ['Consultoria e Visagismo'],
    tags: ['visagismo', 'consultoria', 'imagem'], confidence: 'medium',
    needsManualReview: true, shouldHide: true, hideReason: 'Consultoria — exibir no funil público só com aprovação',
    reason: 'Override: Abordagem Visagista → Consultoria e Educação',
  },
  'consultoria particular (aula)': {
    slug: 'consultoria-e-educacao', displayCategories: ['Consultoria e Educação'],
    tags: ['aula', 'consultoria', 'educacao'], confidence: 'high',
    needsManualReview: true, shouldHide: true, hideReason: 'Educacional — ocultar do funil público',
    reason: 'Override: Consultoria particular → Consultoria e Educação',
  },
  'metodo tbe - aula particular': {
    slug: 'consultoria-e-educacao', displayCategories: ['Consultoria e Educação'],
    tags: ['aula', 'tbe', 'educacao', 'mentoria'], confidence: 'high',
    needsManualReview: true, shouldHide: true, hideReason: 'Educacional — ocultar do funil público',
    reason: 'Override: Metodo TBE → Consultoria e Educação',
  },
  'emergencial': {
    slug: 'atendimento-especial', displayCategories: ['Atendimento Especial'],
    tags: ['emergencial', 'urgente', 'especial'], confidence: 'high',
    needsManualReview: true, shouldHide: false,
    reason: 'Override: Emergencial → Atendimento Especial',
  },
  'entrega do certificado': {
    slug: 'consultoria-e-educacao', displayCategories: ['Consultoria e Educação'],
    tags: ['certificado', 'administrativo'], confidence: 'high',
    needsManualReview: true, shouldHide: true, hideReason: 'Administrativo + R$0 — is_bookable=false recomendado',
    reason: 'Override: Entrega do certificado → Consultoria e Educação',
  },
  'lavagem': {
    slug: 'tratamentos-capilares', displayCategories: ['Tratamentos Capilares', 'Finalização e Penteados'],
    tags: ['lavagem', 'lavatorio', 'tratamento'], confidence: 'medium',
    needsManualReview: false, shouldHide: false,
    reason: 'Override: Lavagem → Tratamentos Capilares',
  },
  'penteado': {
    slug: 'finalizacao-e-penteados', displayCategories: ['Finalização e Penteados'],
    tags: ['penteado', 'finalizacao'], confidence: 'high',
    needsManualReview: false, shouldHide: false,
    reason: 'Override: Penteado → Finalização e Penteados',
  },
  'pintura colors fun': {
    slug: 'quimicas-e-coloracao', displayCategories: ['Químicas e Coloração'],
    tags: ['pintura', 'coloracao', 'colors-fun', 'tintura', 'cor'], confidence: 'high',
    needsManualReview: false, shouldHide: false,
    reason: 'Override: Pintura colors fun → Químicas e Coloração',
  },
  'raspagem / costas & peito': {
    slug: 'sobrancelha-e-depilacao', displayCategories: ['Sobrancelha e Depilação', 'Estética e Bem-estar'],
    tags: ['raspagem', 'costas', 'peito', 'depilacao', 'remocao-de-pelos'], confidence: 'medium',
    needsManualReview: false, shouldHide: false,
    reason: 'Override: Raspagem Costas/Peito → Sobrancelha e Depilação',
  },
}

// ── Name suggestions ──────────────────────────────────────
const NAME_CHECKS = [
  { pattern: /Sombrancelha/i, fix: 'Sobrancelha', reason: 'Erro de grafia' },
  { pattern: /Premiun/i, fix: 'Premium', reason: 'Erro de grafia' },
  { pattern: /&amp;/g, fix: '&', reason: 'HTML entity' },
  { pattern: /Combo\.(\d)/g, fix: 'Combo $1', reason: 'Padronização' },
  { pattern: /recontru/i, fix: 'reconstru', reason: 'Erro de grafia' },
  { pattern: /sellagem/i, fix: 'selagem', reason: 'Erro de grafia' },
  { pattern: /sollution/i, fix: 'solution', reason: 'Erro de grafia' },
  { pattern: /colors fun/i, fix: 'Colors Fun', reason: 'Padronização de nome' },
]

function classifyService(svc) {
  const n = norm(svc.name)
  const d = norm(svc.description || '')
  const combined = `${n} ${d}`

  // ── Check overrides first ──
  const override = OVERRIDES[n]
  if (override) {
    let shouldHide = override.shouldHide
    let hideReason = override.hideReason || ''
    if (svc.price === 0 || svc.price === null) {
      shouldHide = true
      hideReason = (hideReason ? hideReason + ' | ' : '') + 'Preço R$0'
    }
    return {
      ...override,
      isCombo: false,
      shouldHide,
      hideReason,
    }
  }

  const isCombo = KW.combo.test(n)
  const matched = []
  const tags = []

  for (const [group, regex] of Object.entries(KW)) {
    if (group === 'combo') continue
    if (regex.test(combined)) { matched.push(group); tags.push(group) }
  }

  const displayCategories = []
  for (const g of matched) {
    const cats = DISPLAY_CATS[g]
    if (cats) for (const c of cats) { if (!displayCategories.includes(c)) displayCategories.push(c) }
  }

  let slug, confidence = 'high', reason = '', needsManualReview = false, shouldHide = false, hideReason = ''

  if (isCombo) {
    slug = 'combos-prontos'; tags.unshift('combo')
    reason = 'Nome contém "combo/pacote"'
  } else if (matched.length === 1) {
    slug = GROUP_SLUG[matched[0]] || 'outros'
    reason = `Palavra-chave: ${matched[0]}`
  } else if (matched.length > 1) {
    slug = GROUP_SLUG[matched[0]] || 'outros'
    confidence = 'medium'
    reason = `Múltiplas palavras-chave: ${matched.join(', ')}`
  } else {
    slug = 'outros'; confidence = 'low'; needsManualReview = true
    reason = 'Nenhuma palavra-chave reconhecida'
  }

  if (svc.price === 0 || svc.price === null) {
    needsManualReview = true; shouldHide = true
    hideReason = 'Preço R$0'
    if (confidence === 'high') confidence = 'medium'
    reason += ' | Preço R$0'
  }

  return { isCombo, slug, displayCategories, tags, confidence, reason, needsManualReview, shouldHide, hideReason }
}

async function run() {
  console.log('═'.repeat(70))
  console.log(applyMode
    ? '  MODO: --apply (APLICAR MUDANÇAS NO BANCO)'
    : '  MODO: DRY-RUN (APENAS RELATÓRIO)')
  console.log('═'.repeat(70))

  const { data: services } = await supabase.from('services').select('*, service_categories(id, name)').order('name')
  const { data: categories } = await supabase.from('service_categories').select('*').order('name')
  if (!services || !categories) { console.error('Erro ao buscar dados'); return }

  // ── Classify all ──
  const results = services.map(svc => ({
    svc,
    c: classifyService(svc),
    currentCat: svc.service_categories?.name || null,
    currentCatId: svc.category_id || null,
  }))

  // ── Categories to create ──
  const existingNormalized = categories.map(c => norm(c.name))
  // Also map existing → slug
  const existingSlugMap = {}
  for (const cat of categories) {
    const mapping = EXISTING_CAT_MAPPINGS[norm(cat.name)]
    if (mapping) existingSlugMap[mapping] = cat.id
    // Direct match
    for (const [slug, displayName] of Object.entries(SLUG_MAP)) {
      if (norm(cat.name) === norm(displayName)) existingSlugMap[slug] = cat.id
    }
  }

  const neededSlugs = [...new Set(results.map(r => r.c.slug))]
  const categoriesToCreate = neededSlugs
    .filter(slug => slug !== 'outros' && !existingSlugMap[slug])
    .map(slug => ({ slug, displayName: SLUG_MAP[slug] }))

  // ── Report ──

  // 1. Categories
  console.log('\n── CATEGORIAS NOVAS A CRIAR ──')
  if (categoriesToCreate.length === 0) {
    console.log('  Nenhuma categoria nova necessária.')
  } else {
    categoriesToCreate.forEach(c => {
      const count = results.filter(r => r.c.slug === c.slug).length
      console.log(`  + ${c.displayName} (slug: ${c.slug}) — ${count} serviços`)
    })
  }

  console.log('\n── CATEGORIAS EXISTENTES (reaproveitáveis) ──')
  for (const [slug, id] of Object.entries(existingSlugMap)) {
    const cat = categories.find(c => c.id === id)
    const target = SLUG_MAP[slug]
    const normMatch = norm(cat?.name || '') === norm(target || '')
    console.log(`  ${normMatch ? '✅' : '⚡ renomear'} "${cat?.name}" → slug: ${slug} (target: ${target})`)
  }

  // 2. By category
  console.log('\n── SERVIÇOS POR CATEGORIA SUGERIDA ──')
  for (const [slug, displayName] of Object.entries(SLUG_MAP)) {
    const group = results.filter(r => r.c.slug === slug)
    if (group.length === 0) continue
    console.log(`\n  📁 ${displayName} (${group.length} serviços)`)
    group.forEach(r => {
      const conf = r.c.confidence === 'high' ? '✅' : r.c.confidence === 'medium' ? '⚡' : '⚠'
      const hide = r.c.shouldHide ? ' 🔒OCULTAR' : ''
      const review = r.c.needsManualReview ? ' 🔍REVISAR' : ''
      const catId = r.currentCatId ? ` [já: ${r.currentCat}]` : ''
      console.log(`    ${conf} ${r.svc.name}${catId}${hide}${review}`)
      if (r.c.displayCategories.length > 1) {
        console.log(`       displayCategories: [${r.c.displayCategories.join(', ')}]`)
      }
      if (r.c.tags.length > 0) {
        console.log(`       tags: [${r.c.tags.join(', ')}]`)
      }
    })
  }

  // 3. Services leaving "Outros"
  const wasOthers = results.filter(r => r.c.slug !== 'outros' && !r.currentCatId)
  const stillOthers = results.filter(r => r.c.slug === 'outros')
  console.log(`\n── SERVIÇOS QUE SAIRÃO DE "SEM CATEGORIA" ──`)
  console.log(`  ${wasOthers.length} serviços receberão categoria pela primeira vez.`)

  console.log(`\n── SERVIÇOS AINDA EM "OUTROS" ──`)
  if (stillOthers.length === 0) {
    console.log('  Nenhum! Todos classificados. 🎉')
  } else {
    stillOthers.forEach(r => {
      console.log(`  ⚠ ${r.svc.name} | ${r.c.reason}`)
    })
  }

  // 4. Manual review
  const manual = results.filter(r => r.c.needsManualReview)
  console.log(`\n── SERVIÇOS QUE EXIGEM REVISÃO MANUAL (${manual.length}) ──`)
  manual.forEach(r => {
    console.log(`  🔍 ${r.svc.name.padEnd(55)} | ${SLUG_MAP[r.c.slug]} | ${r.c.reason}`)
  })

  // 5. Hide from funnel
  const hidden = results.filter(r => r.c.shouldHide)
  console.log(`\n── SERVIÇOS OCULTÁVEIS DO FUNIL PÚBLICO (${hidden.length}) ──`)
  hidden.forEach(r => {
    console.log(`  🔒 ${r.svc.name.padEnd(55)} | ${r.c.hideReason}`)
  })

  // 6. R$0
  const zeroPrice = services.filter(s => s.price === 0 || s.price === null)
  console.log(`\n── SERVIÇOS COM PREÇO R$0 (${zeroPrice.length}) ──`)
  zeroPrice.forEach(s => {
    console.log(`  ⚠ ${s.name} | R$${s.price} | bookable: ${s.is_bookable} | Recomendação: revisar preço ou is_bookable=false`)
  })

  // 7. Name suggestions
  console.log('\n── SUGESTÕES DE RENOMEAÇÃO (apenas relatório, NÃO aplicar) ──')
  let nameSuggestions = 0
  services.forEach(svc => {
    let suggested = svc.name
    const reasons = []
    for (const check of NAME_CHECKS) {
      if (check.pattern.test(suggested)) {
        suggested = suggested.replace(check.pattern, check.fix)
        reasons.push(check.reason)
      }
    }
    if (suggested !== svc.name) {
      console.log(`  "${svc.name}" → "${suggested}" (${reasons.join('; ')})`)
      nameSuggestions++
    }
  })
  if (nameSuggestions === 0) console.log('  Nenhuma sugestão.')

  // 8. Summary
  const noCat = results.filter(r => !r.currentCatId)
  const high = noCat.filter(r => r.c.confidence === 'high')
  const medium = noCat.filter(r => r.c.confidence === 'medium')
  const low = noCat.filter(r => r.c.confidence === 'low')

  console.log('\n' + '═'.repeat(70))
  console.log('RESUMO FINAL')
  console.log('═'.repeat(70))
  console.log(`Total serviços: ${services.length}`)
  console.log(`Já categorizados: ${results.filter(r => r.currentCatId).length}`)
  console.log(`Sem categoria: ${noCat.length}`)
  console.log(`  → Confiança alta: ${high.length}`)
  console.log(`  → Confiança média: ${medium.length}`)
  console.log(`  → Confiança baixa: ${low.length}`)
  console.log(`Revisão manual: ${manual.length}`)
  console.log(`Ocultáveis do funil: ${hidden.length}`)
  console.log(`Categorias novas: ${categoriesToCreate.length}`)
  console.log(`Sugestões de nome: ${nameSuggestions}`)
  console.log(`Preço R$0: ${zeroPrice.length}`)
  console.log(`Serviços que sairão de "Outros": ${results.filter(r => r.c.slug !== 'outros').length - results.filter(r => r.currentCatId).length}`)

  if (!applyMode) {
    console.log('\n⏸  DRY-RUN completo. Para aplicar, rode:')
    console.log('   node scripts/categorize-services.mjs --apply')
    return
  }

  // ── APPLY ──
  console.log('\n🔧 APLICANDO...')

  // Create new categories
  const slugToId = { ...existingSlugMap }
  for (const toCreate of categoriesToCreate) {
    const { data: newCat, error } = await supabase
      .from('service_categories')
      .insert({ name: toCreate.displayName, normalized_name: norm(toCreate.displayName), is_active: true })
      .select().single()
    if (error) {
      console.error(`  ❌ Erro ao criar "${toCreate.displayName}":`, error.message)
    } else {
      slugToId[toCreate.slug] = newCat.id
      console.log(`  ✅ Categoria criada: "${toCreate.displayName}" (${newCat.id})`)
    }
  }

  // Apply category_id to high+medium confidence (no-category) services
  let applied = 0
  for (const r of [...high, ...medium]) {
    const catId = slugToId[r.c.slug]
    if (!catId) { console.log(`  ⏭ Sem ID para slug "${r.c.slug}" — pulando ${r.svc.name}`); continue }
    const { error } = await supabase.from('services').update({ category_id: catId }).eq('id', r.svc.id)
    if (error) {
      console.error(`  ❌ Erro: "${r.svc.name}":`, error.message)
    } else {
      console.log(`  ✅ ${r.svc.name} → ${SLUG_MAP[r.c.slug]}`)
      applied++
    }
  }

  console.log(`\n✅ Categorização concluída. ${applied} serviços atualizados.`)
  console.log(`⚠ ${low.length} serviços NÃO atualizados (confiança baixa).`)
}

run().catch(console.error)
