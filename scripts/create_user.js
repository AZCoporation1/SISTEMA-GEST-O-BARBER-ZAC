const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gyausvxjrpkheennijiv.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function run() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'admin@barberzac.com.br',
    password: 'admin123',
    email_confirm: true,
    user_metadata: {
      full_name: 'Administrador'
    }
  })

  if (error) {
    console.error('Error creating user:', error)
  } else {
    console.log('User created successfully:', data.user.email, data.user.id)
  }
}

run()
