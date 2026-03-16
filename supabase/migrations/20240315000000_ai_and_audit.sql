-- Migration: AI & Audit Logs
-- Description: Adds tables to track AI command history, audit logs, and settings extensions

CREATE TABLE IF NOT EXISTS public.ai_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    command_text TEXT NOT NULL,
    intent VARCHAR(50) NOT NULL,
    raw_response JSONB,
    executed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast user command lookups
CREATE INDEX IF NOT EXISTS idx_ai_commands_user ON public.ai_commands(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_commands_date ON public.ai_commands(created_at DESC);


CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity VARCHAR(50) NOT NULL,
    entity_id UUID,
    action VARCHAR(50) NOT NULL,
    old_data JSONB,
    new_data JSONB,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for searching history of a specific entity
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_date ON public.audit_logs(created_at DESC);

-- View to detect Stock Inconsistencies (Furos)
-- A common request: identify negative stocks or items below minimum
CREATE OR REPLACE VIEW public.vw_stock_inconsistencies AS
SELECT 
    p.id AS product_id,
    p.name,
    p.code,
    c.name AS category_name,
    p.qty_min,
    p.qty_current,
    p.cost_price,
    CASE
        WHEN p.qty_current < 0 THEN 'negative_stock'
        WHEN p.qty_current = 0 THEN 'zero_stock'
        WHEN p.qty_current <= p.qty_min THEN 'critical_stock'
        WHEN p.cost_price IS NULL OR p.cost_price <= 0 THEN 'missing_cost'
        ELSE 'attention_stock'
    END AS anomaly_type,
    (p.qty_max - p.qty_current) AS suggested_buy_qty,
    ((p.qty_max - p.qty_current) * COALESCE(p.cost_price, 0)) AS estimated_buy_cost
FROM 
    public.products p
LEFT JOIN 
    public.categories c ON p.category_id = c.id
WHERE 
    p.status = 'active' AND (
        p.qty_current <= p.qty_min 
        OR p.cost_price IS NULL 
        OR p.cost_price <= 0
    );

-- Enable RLS
ALTER TABLE public.ai_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies for AI Commands
CREATE POLICY "Users can view their own AI commands" ON public.ai_commands FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own AI commands" ON public.ai_commands FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own AI commands" ON public.ai_commands FOR UPDATE USING (auth.uid() = user_id);

-- Policies for Audit Logs (Read-only for all authenticated users, or restrict to admin)
-- For MVP, authenticated users can read logs
CREATE POLICY "Authenticated users can view audit logs" ON public.audit_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "System can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Grant access to views
GRANT SELECT ON public.vw_stock_inconsistencies TO authenticated;
GRANT SELECT ON public.vw_stock_inconsistencies TO service_role;
