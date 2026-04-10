const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://gyausvxjrpkheennijiv.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5YXVzdnhqcnBraGVlbm5paml2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjIzNDIsImV4cCI6MjA4ODkzODM0Mn0.OHLAvQmihPG-hVQjL_IdDZuIpR3KXLL0zq5K8O2O0EI'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@barberzac.com.br',
    password: 'admin123'
  })

  if (error) {
    console.error('Login Error:', error.message)
  } else {
    console.log('Login Success! Token:', data.session.access_token.substring(0, 20) + '...')
  }
}

run()
