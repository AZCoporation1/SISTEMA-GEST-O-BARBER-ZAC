import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://gyausvxjrpkheennijiv.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5YXVzdnhqcnBraGVlbm5paml2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjIzNDIsImV4cCI6MjA4ODkzODM0Mn0.OHLAvQmihPG-hVQjL_IdDZuIpR3KXLL0zq5K8O2O0EI'
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log('Fetching app_settings...');
  const res1 = await supabase.from('app_settings').select('*').limit(1).single()
  console.log('app_settings:', res1.error ? res1.error : res1.data)
  
  console.log('Fetching vw_inventory_position...');
  const res2 = await supabase.from('vw_inventory_position').select('*').limit(1)
  console.log('vw_inventory_position:', res2.error ? res2.error : res2.data)
}

run()
