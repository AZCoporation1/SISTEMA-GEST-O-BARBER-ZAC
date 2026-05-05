-- ============================================================
-- Barber Zac ERP — Migration #14
-- FIX: handle_new_user trigger causing privilege escalation
-- ============================================================

-- Essa função substitui a atual. 
-- A regra fundamental: NUNCA crie user_profiles se for apenas cliente.
-- Apenas contas com user_type = 'internal' ganham profile.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_user_type text;
  v_system_role text;
BEGIN
  v_user_type := new.raw_user_meta_data->>'user_type';
  v_system_role := new.raw_user_meta_data->>'system_role';

  -- Apenas contas explicitamente internas devem ter acesso ao ERP.
  IF v_user_type = 'internal'
     AND v_system_role IN ('admin_total', 'professional', 'owner_admin_professional')
  THEN
    INSERT INTO public.user_profiles (
      auth_user_id,
      full_name,
      email,
      role,
      system_role
    )
    VALUES (
      new.id,
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      new.email,
      'operador',
      v_system_role
    )
    ON CONFLICT (auth_user_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
