import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')

console.log('🔧 Loading configuration from:', envPath)
let envContent = ''
try {
  envContent = readFileSync(envPath, 'utf-8')
} catch (e) {
  console.error('❌ Failed to read .env.local file:', e.message)
  process.exit(1)
}

function getEnvVar(name) {
  const match = envContent.match(new RegExp(`^${name}=(.*)$`, 'm'))
  return match ? match[1].trim() : null
}

const SUPABASE_URL = getEnvVar('NEXT_PUBLIC_SUPABASE_URL')
const SUPABASE_KEY = getEnvVar('SUPABASE_SERVICE_ROLE_KEY')

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Supabase URL or Service Role Key not found in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
})

async function run() {
  console.log('\n🚀 Starting Idempotent Category Sync for "RELO"...')

  // Check if RELO category already exists
  const { data: existingCat, error: checkError } = await supabase
    .from('inventory_categories')
    .select('*')
    .ilike('name', 'RELO')
    .maybeSingle()

  if (checkError) {
    console.error('❌ Error checking existing categories:', checkError.message)
    process.exit(1)
  }

  let categoryId
  let categoryData

  if (existingCat) {
    console.log(`✅ Category "RELO" already exists! (ID: ${existingCat.id})`)
    categoryId = existingCat.id
    categoryData = existingCat

    // Make sure it is active
    if (!existingCat.is_active) {
      console.log('🔄 Category was inactive. Activating it...')
      const { data: updatedCat, error: updateError } = await supabase
        .from('inventory_categories')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', categoryId)
        .select()
        .single()

      if (updateError) {
        console.error('❌ Failed to activate category:', updateError.message)
        process.exit(1)
      }
      categoryData = updatedCat
      console.log('✅ Activated successfully.')
    }
  } else {
    console.log('➕ Category "RELO" does not exist. Creating it...')
    const newCategory = {
      name: 'RELO',
      normalized_name: 'relo',
      code_prefix: 'REL',
      is_active: true,
      sort_order: 0,
      aliases: null
    }

    const { data: createdCat, error: insertError } = await supabase
      .from('inventory_categories')
      .insert(newCategory)
      .select()
      .single()

    if (insertError) {
      console.error('❌ Failed to insert category "RELO":', insertError.message)
      process.exit(1)
    }

    categoryId = createdCat.id
    categoryData = createdCat
    console.log(`✅ Category "RELO" created successfully with ID: ${categoryId}`)

    // Log this action to the audit logs
    console.log('📝 Logging insert action to audit_logs...')
    const auditRecord = {
      entity_type: 'inventory_categories',
      entity_id: categoryId,
      action: 'INSERT',
      before_data: null,
      after_data: categoryData,
      context: {
        source: 'system',
        status: 'success',
        observation: 'Criação de categoria para SmartWatch Series 11',
        origem: 'estoque interno',
        motivo: 'criação de categoria para SmartWatch Series 11'
      }
    }

    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert(auditRecord)

    if (auditError) {
      console.warn('⚠️ Warning: Failed to insert audit log:', auditError.message)
    } else {
      console.log('✅ Audit log created successfully.')
    }
  }

  console.log('\n🎉 Category Sync Complete!')
  console.log(`   Category Name: ${categoryData.name}`)
  console.log(`   Normalized Name: ${categoryData.normalized_name}`)
  console.log(`   Code Prefix: ${categoryData.code_prefix}`)
  console.log(`   ID: ${categoryId}`)
}

run()
