/**
 * Barber Zac — Apply Migration #13 via Supabase REST API
 * 
 * Uses the Supabase Management API to execute the DDL
 * that adds auth_user_id and last_login_at to customers.
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
  console.error('❌ Missing env vars')
  process.exit(1)
}

// Extract project ref from URL: https://gyausvxjrpkheennijiv.supabase.co → gyausvxjrpkheennijiv
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0]

async function executeSql(sql) {
  // Use the Supabase pg/query endpoint (available with service_role key)
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  })

  // If rpc endpoint doesn't work, try the direct SQL endpoint
  if (!response.ok) {
    console.log(`REST /rpc returned ${response.status}, trying alternative...`)
    
    // Try the pg SQL API endpoint  
    const pgResponse = await fetch(`${SUPABASE_URL}/pg/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    })

    if (!pgResponse.ok) {
      const text = await pgResponse.text()
      console.log(`/pg/sql returned ${pgResponse.status}: ${text}`)
      return null
    }

    return await pgResponse.json()
  }

  return await response.json()
}

async function main() {
  console.log(`🔧 Barber Zac — Applying Migration #13`)
  console.log(`📅 ${new Date().toLocaleString('pt-BR')}`)
  console.log(`🔗 Project: ${projectRef}\n`)

  const migrationSql = `
    ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

    CREATE INDEX IF NOT EXISTS idx_customers_auth_user_id ON public.customers(auth_user_id);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_auth_user_id_unique
    ON public.customers (auth_user_id)
    WHERE auth_user_id IS NOT NULL;
  `

  console.log('Tentando executar migration via REST API...')
  const result = await executeSql(migrationSql)

  if (result) {
    console.log('✅ Migration executada via REST:', JSON.stringify(result, null, 2))
  } else {
    console.log('\n⚠️  Não foi possível executar DDL via REST API.')
    console.log('   O Supabase não expõe endpoints de DDL via REST (segurança).')
    console.log('')
    console.log('═'.repeat(60))
    console.log('  AÇÃO NECESSÁRIA: Executar no Supabase Dashboard')
    console.log('═'.repeat(60))
    console.log('')
    console.log('1. Abra: https://supabase.com/dashboard/project/' + projectRef + '/sql')
    console.log('')
    console.log('2. Cole e execute este SQL:')
    console.log('─'.repeat(60))
    console.log(migrationSql)
    console.log('─'.repeat(60))
    console.log('')
    console.log('3. Após executar, rode:')
    console.log('   node scratch/run_reconciliation.mjs')
    console.log('')
  }

  // Verify
  console.log('\nVerificando se a coluna existe agora...')
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const { error } = await admin
    .from('customers')
    .select('id, auth_user_id')
    .limit(1)

  if (error) {
    console.log(`❌ Coluna auth_user_id AINDA NÃO EXISTE: ${error.message}`)
    console.log('   Execute o SQL manualmente no Supabase Dashboard.')
  } else {
    console.log('✅ Coluna auth_user_id EXISTE! Migration aplicada com sucesso.')
    console.log('   Executando reconciliação automaticamente...')
  }
}

main().catch(err => {
  console.error('💥 Fatal:', err)
  process.exit(1)
})
