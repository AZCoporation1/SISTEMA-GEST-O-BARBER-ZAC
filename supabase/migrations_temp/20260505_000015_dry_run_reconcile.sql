-- ============================================================
-- Barber Zac ERP — DRY-RUN RECONCILIAÇÃO (NÃO ALTERA BANCO)
-- Executar no Supabase SQL Editor APÓS o diagnostic.sql
-- Mostra exatamente o que SERIA feito pelo apply
-- Data: 2026-05-05
-- ============================================================

-- Whitelist interna (NUNCA tocar):
-- fabiodasilva2026@outlook.com
-- granconatoleonela@gmail.com
-- lucaszaquiel123@gmail.com
-- mateus.santos.ap123@gmail.com
-- gustagaldino@gmail.com

-- ════════════════════════════════════════════════════════════
-- AÇÃO 1: AUTH USERS ÓRFÃOS QUE SERIAM RECONCILIADOS
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
orphans AS (
  -- Auth users sem user_profile e sem customer (por auth_user_id)
  SELECT
    au.id AS auth_user_id,
    au.email,
    au.created_at,
    au.raw_user_meta_data->>'full_name' AS meta_full_name,
    au.raw_user_meta_data->>'name' AS meta_name,
    au.raw_user_meta_data->>'phone' AS meta_phone
  FROM auth.users au
  LEFT JOIN public.user_profiles up ON up.auth_user_id = au.id
  LEFT JOIN public.customers c ON c.auth_user_id = au.id
  WHERE up.id IS NULL
    AND c.id IS NULL
    AND lower(au.email) NOT IN (SELECT lower(email) FROM whitelist)
)
SELECT
  o.auth_user_id,
  o.email,
  o.created_at,
  o.meta_full_name,
  o.meta_name,
  o.meta_phone,

  -- Verificar se existe customer com mesmo email
  c_by_email.id AS existing_customer_id_by_email,
  c_by_email.full_name AS existing_customer_name,
  c_by_email.auth_user_id AS existing_customer_auth_user_id,

  -- Determinar ação
  CASE
    -- Customer existe com mesmo email e auth_user_id é NULL → VINCULAR
    WHEN c_by_email.id IS NOT NULL AND c_by_email.auth_user_id IS NULL
      THEN 'LINK_EXISTING_CUSTOMER'

    -- Customer existe com mesmo email mas auth_user_id é de OUTRO → CONFLITO
    WHEN c_by_email.id IS NOT NULL AND c_by_email.auth_user_id IS NOT NULL
         AND c_by_email.auth_user_id != o.auth_user_id
      THEN 'CONFLICT_EMAIL — NÃO TOCAR'

    -- Customer existe com mesmo email e mesmo auth_user_id (já vinculado, edge case)
    WHEN c_by_email.id IS NOT NULL AND c_by_email.auth_user_id = o.auth_user_id
      THEN 'ALREADY_LINKED (edge case)'

    -- Nenhum customer por email → CRIAR NOVO
    WHEN c_by_email.id IS NULL
      THEN 'CREATE_NEW_CUSTOMER'

    ELSE 'UNKNOWN'
  END AS planned_action,

  -- Dados que seriam usados
  COALESCE(o.meta_full_name, o.meta_name, split_part(o.email, '@', 1)) AS resolved_name,
  o.email AS resolved_email,
  o.meta_phone AS resolved_phone

FROM orphans o
LEFT JOIN public.customers c_by_email
  ON lower(trim(c_by_email.email)) = lower(trim(o.email))
ORDER BY
  CASE
    WHEN c_by_email.id IS NOT NULL AND c_by_email.auth_user_id IS NOT NULL
         AND c_by_email.auth_user_id != o.auth_user_id THEN 0  -- Conflitos primeiro
    WHEN c_by_email.id IS NOT NULL AND c_by_email.auth_user_id IS NULL THEN 1 -- Links depois
    ELSE 2  -- Creates por último
  END,
  o.created_at DESC;

-- ════════════════════════════════════════════════════════════
-- RESUMO CONTAGEM
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
orphans AS (
  SELECT
    au.id AS auth_user_id,
    au.email
  FROM auth.users au
  LEFT JOIN public.user_profiles up ON up.auth_user_id = au.id
  LEFT JOIN public.customers c ON c.auth_user_id = au.id
  WHERE up.id IS NULL
    AND c.id IS NULL
    AND lower(au.email) NOT IN (SELECT lower(email) FROM whitelist)
),
actions AS (
  SELECT
    o.auth_user_id,
    o.email,
    CASE
      WHEN c.id IS NOT NULL AND c.auth_user_id IS NULL THEN 'LINK'
      WHEN c.id IS NOT NULL AND c.auth_user_id IS NOT NULL AND c.auth_user_id != o.auth_user_id THEN 'CONFLICT'
      WHEN c.id IS NULL THEN 'CREATE'
      ELSE 'SKIP'
    END AS action
  FROM orphans o
  LEFT JOIN public.customers c ON lower(trim(c.email)) = lower(trim(o.email))
)
SELECT
  action,
  COUNT(*) AS total
FROM actions
GROUP BY action
ORDER BY action;

-- ════════════════════════════════════════════════════════════
-- WHITELIST STATUS (confirmar que não serão tocados)
-- ════════════════════════════════════════════════════════════

SELECT
  au.email,
  'PRESERVED — NÃO SERÁ TOCADO' AS status,
  up.system_role,
  CASE
    WHEN up.id IS NOT NULL THEN 'HAS_PROFILE'
    ELSE 'NO_PROFILE'
  END AS profile_status,
  CASE
    WHEN c.id IS NOT NULL THEN 'HAS_CUSTOMER'
    ELSE 'NO_CUSTOMER'
  END AS customer_status
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
