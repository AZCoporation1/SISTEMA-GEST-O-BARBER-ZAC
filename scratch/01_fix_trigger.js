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
  const sql = `
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_type text;
  v_system_role text;
begin
  v_user_type := new.raw_user_meta_data->>'user_type';
  v_system_role := new.raw_user_meta_data->>'system_role';

  -- Only internal accounts may get user_profiles automatically.
  if v_user_type = 'internal'
     and v_system_role in ('admin_total', 'professional', 'owner_admin_professional')
  then
    insert into public.user_profiles (
      auth_user_id,
      full_name,
      email,
      role,
      system_role
    )
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      new.email,
      'operador',
      v_system_role
    )
    on conflict (auth_user_id) do nothing;
  end if;

  return new;
end;
$$;
  `
  
  console.log("Replacing handle_new_user function in Supabase...")
  const { data, error } = await supabase.rpc('execute_sql', { query_text: sql })
  
  if (error) {
    console.error("Error executing SQL:", error)
  } else {
    console.log("Successfully replaced function handle_new_user!")
  }
}

run()
