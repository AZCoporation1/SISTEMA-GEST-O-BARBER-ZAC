-- =============================================
-- P0 INDEXES — Área do Cliente (critical path)
-- Run AFTER diagnostic_indexes.sql
-- Uses IF NOT EXISTS — safe to run multiple times
-- =============================================

-- customers.auth_user_id
-- Used by: AuthProvider, ensureCustomerForAuthUser, resolveCustomerAreaIdentity, middleware
-- Called: 5-10x per customer session
CREATE INDEX IF NOT EXISTS idx_customers_auth_user_id 
  ON customers(auth_user_id);

-- customers.email (lowercase for normalized lookup)
-- Used by: ensureCustomerForAuthUser step 2 (email dedup)
CREATE INDEX IF NOT EXISTS idx_customers_email_lower 
  ON customers(lower(email));

-- user_profiles.auth_user_id
-- Used by: middleware (EVERY request), AuthProvider, resolveCustomerAreaIdentity
-- Called: every authenticated page load
CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_user_id 
  ON user_profiles(auth_user_id);

-- appointments.customer_id
-- Used by: getCustomerAppointments, getCustomerProfile (upcoming count)
CREATE INDEX IF NOT EXISTS idx_appointments_customer_id 
  ON appointments(customer_id);

-- appointments(professional_id, start_at)
-- Used by: getCustomerAvailableSlots (conflict detection per day)
-- Composite index optimizes the eq(professional_id) + gte/lte(start_at) pattern
CREATE INDEX IF NOT EXISTS idx_appointments_prof_start 
  ON appointments(professional_id, start_at);
