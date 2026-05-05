/**
 * Barber Zac — Apply Missing Migration #13 (Customer Portal)
 * 
 * A migration que adiciona auth_user_id e last_login_at à tabela customers
 * NÃO foi aplicada ao Supabase em produção. Este script aplica via REST API.
 * 
 * Após aplicar, re-executa a reconciliação.
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

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function main() {
  console.log('🔧 Barber Zac — Verificando coluna auth_user_id em customers\n')

  // Test if column exists by trying a query
  const { data, error } = await admin
    .from('customers')
    .select('id, full_name, email')
    .limit(1)

  if (error) {
    console.error('❌ Error querying customers:', error.message)
    return
  }

  console.log(`✅ Tabela customers acessível. ${data?.length || 0} registros retornados.`)

  // Try to select auth_user_id specifically
  const { data: test2, error: err2 } = await admin
    .from('customers')
    .select('id, auth_user_id')
    .limit(1)

  if (err2) {
    console.log(`\n❌ Coluna auth_user_id NÃO EXISTE: ${err2.message}`)
    console.log('\n📋 A migration #13 (20260502_000013_customer_portal.sql) precisa ser aplicada.')
    console.log('\nConteúdo da migration que precisa ser executada no SQL Editor do Supabase:')
    console.log('─'.repeat(60))
    console.log(`
-- ============================================================
-- Migration: Barber Zac ERP — Customer Portal Support (#13)
-- EXECUTAR NO SUPABASE SQL EDITOR
-- ============================================================

-- Add auth_user_id and last_login_at to customers table
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_auth_user_id ON public.customers(auth_user_id);

-- Unique partial index (one customer per auth user, nulls allowed)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_auth_user_id_unique
ON public.customers (auth_user_id)
WHERE auth_user_id IS NOT NULL;
`)
    console.log('─'.repeat(60))
    console.log('\n⚠️  VOCÊ PRECISA executar esse SQL manualmente no Supabase Dashboard → SQL Editor')
    console.log('   Depois, rode novamente: node scratch/run_reconciliation.mjs')
  } else {
    console.log(`\n✅ Coluna auth_user_id JÁ EXISTE na tabela customers!`)
    console.log('   Resultado:', JSON.stringify(test2, null, 2))
    console.log('\n   Pode executar a reconciliação: node scratch/run_reconciliation.mjs')
  }

  // Also list all existing customers to see the data
  const { data: allCustomers } = await admin
    .from('customers')
    .select('id, full_name, email, mobile_phone')
    .order('created_at', { ascending: false })

  console.log(`\n📋 Customers existentes (${allCustomers?.length || 0}):`)
  if (allCustomers && allCustomers.length > 0) {
    console.table(allCustomers.map(c => ({
      id: c.id.substring(0, 8) + '...',
      name: c.full_name,
      email: c.email || '-',
      phone: c.mobile_phone || '-',
    })))
  } else {
    console.log('   (nenhum customer cadastrado)')
  }
}

main().catch(err => {
  console.error('💥 Fatal:', err)
  process.exit(1)
})
