-- ============================================================
-- Barber Zac ERP — APPLY RECONCILIAÇÃO
-- EXECUTAR APENAS APÓS REVISAR O DRY-RUN!
-- 
-- Regras:
-- ✅ Vincular customer existente se auth_user_id IS NULL
-- ✅ Criar customer novo se não existe por email nem auth_user_id
-- ❌ NÃO sobrescrever auth_user_id existente
-- ❌ NÃO tocar whitelist interna
-- ❌ NÃO alterar user_profiles
-- ❌ NÃO deletar auth.users
-- ❌ NÃO deletar customers
--
-- Data: 2026-05-05
-- ============================================================

-- Executar em uma transação para atomicidade
BEGIN;

-- ════════════════════════════════════════════════════════════
-- PASSO 1: VINCULAR customers existentes (auth_user_id IS NULL)
-- ════════════════════════════════════════════════════════════

WITH whitelist AS (
  SELECT unnest(ARRAY[
    'fabiodasilva2026@outlook.com',
    'granconatoleonela@gmail.com',
    'lucaszaquiel123@gmail.com',
    'mateus.santos.ap123@gmail.com',
    'gustagaldino@gmail.com'
  ]) AS email
),
orphans_to_link AS (
  SELECT
    au.id AS auth_user_id,
    au.email AS auth_email,
    c.id AS customer_id
  FROM auth.users au
  -- Sem user_profile
  LEFT JOIN public.user_profiles up ON up.auth_user_id = au.id
  -- Sem customer por auth_user_id
  LEFT JOIN public.customers c_direct ON c_direct.auth_user_id = au.id
  -- Customer existente por email, sem auth_user_id
  JOIN public.customers c ON lower(trim(c.email)) = lower(trim(au.email))
    AND c.auth_user_id IS NULL
  WHERE up.id IS NULL
    AND c_direct.id IS NULL
    AND lower(au.email) NOT IN (SELECT lower(email) FROM whitelist)
)
UPDATE public.customers
SET
  auth_user_id = otl.auth_user_id,
  last_login_at = NOW(),
  updated_at = NOW()
FROM orphans_to_link otl
WHERE customers.id = otl.customer_id
  AND customers.auth_user_id IS NULL;  -- Safety: double-check null

-- Report how many were linked
-- (Run SELECT after the UPDATE to see count)

-- ════════════════════════════════════════════════════════════
-- PASSO 2: CRIAR customers novos para órfãos restantes
-- ════════════════════════════════════════════════════════════

WITH whitelist AS (
  SELECT unnest(ARRAY[
    'fabiodasilva2026@outlook.com',
    'granconatoleonela@gmail.com',
    'lucaszaquiel123@gmail.com',
    'mateus.santos.ap123@gmail.com',
    'gustagaldino@gmail.com'
  ]) AS email
),
still_orphans AS (
  SELECT
    au.id AS auth_user_id,
    au.email,
    au.raw_user_meta_data->>'full_name' AS meta_full_name,
    au.raw_user_meta_data->>'name' AS meta_name,
    au.raw_user_meta_data->>'phone' AS meta_phone
  FROM auth.users au
  LEFT JOIN public.user_profiles up ON up.auth_user_id = au.id
  LEFT JOIN public.customers c ON c.auth_user_id = au.id
  WHERE up.id IS NULL
    AND c.id IS NULL
    AND lower(au.email) NOT IN (SELECT lower(email) FROM whitelist)
    -- Also exclude if there's a customer with same email already linked to someone else
    AND NOT EXISTS (
      SELECT 1 FROM public.customers cx
      WHERE lower(trim(cx.email)) = lower(trim(au.email))
        AND cx.auth_user_id IS NOT NULL
        AND cx.auth_user_id != au.id
    )
    -- Exclude if customer with same email already exists (unlinked — should have been caught in step 1)
    AND NOT EXISTS (
      SELECT 1 FROM public.customers cx
      WHERE lower(trim(cx.email)) = lower(trim(au.email))
    )
)
INSERT INTO public.customers (
  auth_user_id,
  full_name,
  normalized_name,
  email,
  mobile_phone,
  is_active,
  last_login_at,
  created_at,
  updated_at
)
SELECT
  so.auth_user_id,
  COALESCE(so.meta_full_name, so.meta_name, split_part(so.email, '@', 1)),
  lower(
    translate(
      COALESCE(so.meta_full_name, so.meta_name, split_part(so.email, '@', 1)),
      'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'aaaaaeeeeiiiioooooiuuucnAAAAEEEEIIIIOOOOOUUUUCN'
    )
  ),
  lower(trim(so.email)),
  CASE
    WHEN so.meta_phone IS NOT NULL AND length(regexp_replace(so.meta_phone, '\D', '', 'g')) >= 10
    THEN regexp_replace(so.meta_phone, '\D', '', 'g')
    ELSE NULL
  END,
  true,
  NOW(),
  NOW(),
  NOW()
FROM still_orphans so;

-- ════════════════════════════════════════════════════════════
-- PASSO 3: VERIFICAÇÃO PÓS-APPLY
-- ════════════════════════════════════════════════════════════

-- Verificar que não existem mais órfãos (exceto whitelist e conflitos)
SELECT
  'REMAINING_ORPHANS' AS check_type,
  COUNT(*) AS total
FROM auth.users au
LEFT JOIN public.user_profiles up ON up.auth_user_id = au.id
LEFT JOIN public.customers c ON c.auth_user_id = au.id
WHERE up.id IS NULL AND c.id IS NULL
  AND lower(au.email) NOT IN (
    'fabiodasilva2026@outlook.com',
    'granconatoleonela@gmail.com',
    'lucaszaquiel123@gmail.com',
    'mateus.santos.ap123@gmail.com',
    'gustagaldino@gmail.com'
  );

-- Verificar whitelist intacta
SELECT
  'WHITELIST_STATUS' AS check_type,
  au.email,
  up.system_role,
  c.auth_user_id AS customer_auth_link
FROM auth.users au
LEFT JOIN public.user_profiles up ON up.auth_user_id = au.id
LEFT JOIN public.customers c ON c.auth_user_id = au.id
WHERE lower(au.email) IN (
  'fabiodasilva2026@outlook.com',
  'granconatoleonela@gmail.com',
  'lucaszaquiel123@gmail.com',
  'mateus.santos.ap123@gmail.com',
  'gustagaldino@gmail.com'
)
ORDER BY au.email;

-- Conflitos não resolvidos (precisam ação manual)
SELECT
  'UNRESOLVED_CONFLICT' AS check_type,
  au.email AS auth_email,
  au.id AS auth_user_id,
  c.id AS customer_id,
  c.auth_user_id AS customer_linked_to
FROM auth.users au
LEFT JOIN public.user_profiles up ON up.auth_user_id = au.id
LEFT JOIN public.customers c_direct ON c_direct.auth_user_id = au.id
JOIN public.customers c ON lower(trim(c.email)) = lower(trim(au.email))
  AND c.auth_user_id IS NOT NULL
  AND c.auth_user_id != au.id
WHERE up.id IS NULL
  AND c_direct.id IS NULL;

COMMIT;
