const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE credentials in environment.")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function runAudit() {
  console.log("==================================================")
  console.log("FASE 0 — AUDITORIA DE IDENTIDADE NO SUPABASE")
  console.log("==================================================")

  try {
    // 1. Check Triggers on auth.users or user_profiles
    console.log("\\n--- 1. VERIFICANDO TRIGGERS E FUNCTIONS ---")
    const { data: triggers, error: triggerError } = await supabase.rpc('execute_sql', {
      query_text: `
        select
          event_object_schema,
          event_object_table,
          trigger_name,
          action_statement
        from information_schema.triggers
        where event_object_schema = 'auth'
           or action_statement ilike '%user_profiles%'
           or action_statement ilike '%handle_new_user%';
      `
    })
    
    if (triggerError) {
      console.log("-> RPC execute_sql falhou. Consultando tabela de user_profiles para detectar metadados.")
    } else {
      console.log("Triggers:", JSON.stringify(triggers, null, 2))
    }

    // 2. Inspect the latest users in auth.users (via admin API)
    console.log("\\n--- 2. INSPECIONANDO ÚLTIMOS USUÁRIOS CRIADOS ---")
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
    
    if (authError) {
      console.error("Erro ao listar usuários auth:", authError)
    } else {
      // Sort by created_at desc and take top 5
      const recentUsers = authUsers.users
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)

      for (const user of recentUsers) {
        console.log(`\\nUser ID: ${user.id}`)
        console.log(`Email: ${user.email}`)
        console.log(`Created At: ${user.created_at}`)
        console.log(`Provider: ${user.app_metadata?.provider || 'email'}`)
        console.log(`User Meta:`, JSON.stringify(user.user_metadata))

        // Check user_profiles
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('auth_user_id', user.id)
          .single()
        
        console.log(`-> Possui user_profile? ${profile ? 'SIM' : 'NÃO'}`)
        if (profile) {
          console.log(`   - role: ${profile.system_role}`)
          console.log(`   - created_at: ${profile.created_at}`)
          console.log(`   - full profile:`, JSON.stringify(profile))
        }

        // Check customers
        const { data: customer } = await supabase
          .from('customers')
          .select('id, full_name, email')
          .eq('auth_user_id', user.id)
          .single()
        
        console.log(`-> Possui customer vinculado? ${customer ? 'SIM' : 'NÃO'}`)
      }
    }

  } catch (err) {
    console.error("Audit error:", err)
  }
}

runAudit()
