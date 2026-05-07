-- =============================================
-- DIAGNOSTIC: Check existing indexes
-- Run this FIRST to see what already exists
-- =============================================

SELECT 
  schemaname, 
  tablename, 
  indexname, 
  indexdef
FROM pg_indexes
WHERE tablename IN (
  'customers', 
  'appointments', 
  'user_profiles', 
  'collaborators',
  'services', 
  'professional_working_hours', 
  'appointment_blocks'
)
ORDER BY tablename, indexname;
