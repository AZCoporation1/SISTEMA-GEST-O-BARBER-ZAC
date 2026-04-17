-- ============================================================
-- FIX: Replace blanket UNIQUE(status) with a partial unique index
-- that ONLY prevents multiple sessions with status = 'open'.
-- This was causing "duplicate key value violates unique constraint
-- uq_one_open_session" when closing a session because 'closed'
-- already existed as a status value in another row.
-- ============================================================

-- 1. Drop the broken constraint
ALTER TABLE public.cash_sessions
  DROP CONSTRAINT IF EXISTS uq_one_open_session;

-- 2. Create a partial unique index: only ONE row can have status='open'
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_open_session
  ON public.cash_sessions (status)
  WHERE status = 'open';
