-- Migration: Assinaturas Internas e Customizações
-- Date: 2026-06-05

-- 1. Add customization fields to customer_subscriptions
ALTER TABLE public.customer_subscriptions
ADD COLUMN IF NOT EXISTS is_customized boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS custom_plan_name text,
ADD COLUMN IF NOT EXISTS custom_services_snapshot jsonb,
ADD COLUMN IF NOT EXISTS monthly_price_snapshot numeric(10,2),
ADD COLUMN IF NOT EXISTS visits_per_cycle_snapshot integer,
ADD COLUMN IF NOT EXISTS duration_minutes_snapshot integer;

-- 2. Add professional_id to subscription_payments to link payment to ledger
ALTER TABLE public.subscription_payments
ADD COLUMN IF NOT EXISTS professional_id uuid REFERENCES public.collaborators(id);
