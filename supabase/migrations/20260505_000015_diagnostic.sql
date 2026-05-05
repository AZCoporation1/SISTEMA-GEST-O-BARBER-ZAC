-- ============================================================
-- Barber Zac ERP — DIAGNÓSTICO (somente leitura)
-- Executar no Supabase SQL Editor ANTES de qualquer alteração
-- Data: 2026-05-05
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 1. AUTH USERS RECENTES (últimos 30 dias)
-- ════════════════════════════════════════════════════════════
SELECT
  au.id AS auth_user_id,
  au.email,
  au.created_at,
  au.raw_user_meta_data->>'user_type' AS user_type,
  au.raw_user_meta_data->>'full_name' AS meta_full_name,
  au.raw_user_meta_data->>'phone' AS meta_phone,
  CASE
    WHEN ai.provider IS NOT NULL THEN ai.provider
    ELSE 'email'
  END AS provider
FROM auth.users au
LEFT JOIN auth.identities ai ON ai.user_id = au.id
WHERE au.created_at > NOW() - INTERVAL '30 days'
ORDER BY au.created_at DESC;

-- ════════════════════════════════════════════════════════════
-- 2. ÓRFÃOS: auth users SEM user_profiles E SEM customers
-- ════════════════════════════════════════════════════════════
SELECT
  au.id AS auth_user_id,
  au.email,
  au.created_at,
  au.raw_user_meta_data->>'full_name' AS meta_full_name,
  au.raw_user_meta_data->>'name' AS meta_name,
  au.raw_user_meta_data->>'phone' AS meta_phone,
  au.raw_user_meta_data->>'user_type' AS user_type,
  'ORPHAN' AS status
FROM auth.users au
LEFT JOIN public.user_profiles up ON up.auth_user_id = au.id
LEFT JOIN public.customers c ON c.auth_user_id = au.id
WHERE up.id IS NULL
  AND c.id IS NULL
ORDER BY au.created_at DESC;

-- ════════════════════════════════════════════════════════════
-- 3. CUSTOMERS COM MESMO EMAIL E auth_user_id NULL
--    (candidatos a vinculação)
-- ════════════════════════════════════════════════════════════
SELECT
  c.id AS customer_id,
  c.full_name,
  c.email,
  c.mobile_phone,
  c.auth_user_id,
  c.created_at,
  au.id AS matching_auth_user_id,
  au.email AS auth_email
FROM public.customers c
JOIN auth.users au ON lower(trim(c.email)) = lower(trim(au.email))
WHERE c.auth_user_id IS NULL
ORDER BY c.created_at DESC;

-- ════════════════════════════════════════════════════════════
-- 4. CONFLITOS: customer com mesmo email mas auth_user_id DIFERENTE
-- ════════════════════════════════════════════════════════════
SELECT
  c.id AS customer_id,
  c.full_name,
  c.email AS customer_email,
  c.auth_user_id AS current_auth_user_id,
  au.id AS conflicting_auth_user_id,
  au.email AS auth_email,
  'CONFLICT_EMAIL' AS conflict_type
FROM public.customers c
JOIN auth.users au ON lower(trim(c.email)) = lower(trim(au.email))
WHERE c.auth_user_id IS NOT NULL
  AND c.auth_user_id != au.id
ORDER BY c.email;

-- ════════════════════════════════════════════════════════════
-- 5. WHITELIST INTERNA — Status de preservação
-- ════════════════════════════════════════════════════════════
SELECT
  au.id AS auth_user_id,
  au.email,
  au.created_at,
  up.id AS user_profile_id,
  up.system_role,
  up.collaborator_id,
  c.id AS customer_id,
  c.auth_user_id AS customer_auth_user_id,
  CASE
    WHEN up.id IS NOT NULL THEN 'HAS_PROFILE'
    ELSE 'NO_PROFILE'
  END AS profile_status,
  CASE
    WHEN c.id IS NOT NULL THEN 'HAS_CUSTOMER'
    ELSE 'NO_CUSTOMER'
  END AS customer_status,
  'WHITELIST_PROTECTED' AS action
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

-- ════════════════════════════════════════════════════════════
-- 6. VISÃO COMPLETA: auth user ↔ user_profile ↔ customer
--    Para qualquer email específico, substituir '<EMAIL>' abaixo
-- ════════════════════════════════════════════════════════════
-- SELECT
--   au.id AS auth_user_id,
--   au.email,
--   au.created_at,
--   au.raw_user_meta_data,
--   au.raw_app_meta_data,
--   up.id AS user_profile_id,
--   up.system_role,
--   up.collaborator_id,
--   c.id AS customer_id,
--   c.full_name AS customer_name,
--   c.email AS customer_email,
--   c.mobile_phone,
--   c.auth_user_id AS customer_auth_user_id
-- FROM auth.users au
-- LEFT JOIN public.user_profiles up ON up.auth_user_id = au.id
-- LEFT JOIN public.customers c ON c.auth_user_id = au.id
-- WHERE lower(au.email) = lower('<EMAIL>');
