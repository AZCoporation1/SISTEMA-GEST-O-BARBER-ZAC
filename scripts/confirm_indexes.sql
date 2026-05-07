-- =============================================
-- POST-OPTIMIZATION: Confirm all P0 indexes exist
-- Run this after applying suggested_indexes_p0.sql
-- Expected: 5 rows matching idx_customers_*, idx_user_profiles_*, idx_appointments_*
-- =============================================

SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE indexname IN (
  'idx_customers_auth_user_id',
  'idx_customers_email_lower',
  'idx_user_profiles_auth_user_id',
  'idx_appointments_customer_id',
  'idx_appointments_prof_start'
)
ORDER BY tablename, indexname;

-- Also show ALL indexes on our critical tables to see what already existed
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename IN (
  'customers',
  'user_profiles',
  'appointments',
  'professional_working_hours',
  'appointment_blocks',
  'services',
  'collaborators',
  'sales',
  'financial_movements',
  'stock_movements'
)
ORDER BY tablename, indexname;
