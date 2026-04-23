/**
 * Apply migration via Supabase Management API
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'

const ACCESS_TOKEN = process.argv[2] || 'sbp_44ee9c638868c9a6620f96f4a628a757cc034a19'
const PROJECT_REF = 'gyausvxjrpkheennijiv'

const migrationPath = resolve(process.cwd(), 'supabase/migrations/20260423_000010_auth_roles_professional_requests.sql')
const sql = readFileSync(migrationPath, 'utf-8')

console.log('Applying migration...')
console.log(`SQL length: ${sql.length} chars`)

const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
})

const text = await response.text()
console.log(`Status: ${response.status}`)
console.log('Response:', text.substring(0, 2000))

if (!response.ok) {
  console.error('❌ Migration failed')
  process.exit(1)
}

console.log('✅ Migration applied successfully!')
