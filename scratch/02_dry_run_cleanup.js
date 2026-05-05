const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE credentials")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function run() {
  const whitelist = [
    'Fabiodasilva2026@outlook.com',
    'granconatoleonela@gmail.com',
    'lucaszaquiel123@gmail.com',
    'mateus.santos.ap123@gmail.com',
    'gustagaldino@gmail.com',
    'admin@barberzac.com.br'
  ].map(e => e.toLowerCase())

  const { data: profiles, error: pError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('system_role', 'professional')
    .order('created_at', { ascending: false })
    
  if (pError) {
    console.error(pError)
    return
  }

  const corrupted = profiles.filter(p => {
    const email = p.email.toLowerCase()
    if (whitelist.includes(email)) return false // Safe
    if (p.collaborator_id) return false // Has collaborator
    if (p.can_manage_system || p.can_approve_professional_requests || p.can_view_all_professionals) return false // Admin flags
    return true
  })

  console.log(`Encontrados ${corrupted.length} perfis suspeitos de corrupção:`)
  corrupted.forEach(c => {
    console.log(`- Nome: ${c.full_name} | Email: ${c.email} | Criado: ${c.created_at} | Profile ID: ${c.id}`)
  })
}

run()
