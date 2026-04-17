import fs from 'fs'
import path from 'path'

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const PROJECT_REF = 'gyausvxjrpkheennijiv'

const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '20260417_000006_professionals_commissions.sql')
const sql = fs.readFileSync(sqlPath, 'utf8')

console.log('=== Applying Migration via Supabase Management API ===')
console.log(`SQL length: ${sql.length} chars`)
console.log('')

try {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })

  const text = await res.text()
  
  if (res.ok) {
    console.log('✅ Migration applied successfully!')
    console.log('Response:', text.substring(0, 500))
  } else {
    console.log(`❌ Error (HTTP ${res.status}):`, text.substring(0, 1000))
  }
} catch (err) {
  console.error('❌ Fetch error:', err.message)
}
