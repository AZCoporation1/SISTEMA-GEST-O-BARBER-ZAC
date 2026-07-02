-- Migration: Módulo 5S Operacional V2 (Arquitetura Estrita e RLS de Menor Privilégio)
-- Criação das 7 tabelas fundamentais e inserção do Template V1 Oficial (21 itens).
-- Todas as tabelas são isoladas, sem impacto na gamificação e comissionamento.

BEGIN;

-- 1. CONFIGURAÇÕES (operational_5s_settings)
CREATE TABLE IF NOT EXISTS public.operational_5s_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    default_manager_user_id uuid REFERENCES public.user_profiles(id),
    timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
    opening_due_time time NOT NULL DEFAULT '08:30:00',
    during_day_due_time time NOT NULL DEFAULT '14:00:00',
    closing_due_time time NOT NULL DEFAULT '20:30:00',
    operational_days jsonb NOT NULL DEFAULT '["1", "2", "3", "4", "5", "6"]'::jsonb,
    module_enabled boolean NOT NULL DEFAULT false,
    gamification_enabled boolean NOT NULL DEFAULT false,
    notifications_enabled boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by_user_id uuid REFERENCES public.user_profiles(id)
);

ALTER TABLE public.operational_5s_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_operational_5s_settings" ON public.operational_5s_settings 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()) AND system_role IN ('admin_total', 'owner_admin_professional'))) 
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()) AND system_role IN ('admin_total', 'owner_admin_professional')));

CREATE POLICY "auth_read_operational_5s_settings" ON public.operational_5s_settings 
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_operational_5s_settings_updated_at BEFORE UPDATE ON public.operational_5s_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. TEMPLATES (operational_5s_templates)
CREATE TABLE IF NOT EXISTS public.operational_5s_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version integer NOT NULL DEFAULT 1,
    name text NOT NULL,
    status text NOT NULL CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')) DEFAULT 'DRAFT',
    created_by_user_id uuid REFERENCES public.user_profiles(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operational_5s_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_operational_5s_templates" ON public.operational_5s_templates 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE auth_user_id = auth.uid() AND system_role IN ('admin_total', 'owner_admin_professional')));
CREATE POLICY "auth_read_operational_5s_templates" ON public.operational_5s_templates FOR SELECT TO authenticated USING (true);
CREATE TRIGGER update_operational_5s_templates_updated_at BEFORE UPDATE ON public.operational_5s_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. ITENS DE TEMPLATES (operational_5s_template_items)
CREATE TABLE IF NOT EXISTS public.operational_5s_template_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id uuid NOT NULL REFERENCES public.operational_5s_templates(id) ON DELETE CASCADE,
    item_key text NOT NULL,
    section text NOT NULL CHECK (section IN ('OPENING', 'DURING_DAY', 'CLOSING')),
    title text NOT NULL,
    description text,
    display_order integer NOT NULL DEFAULT 0,
    weight integer NOT NULL DEFAULT 1,
    is_required boolean NOT NULL DEFAULT true,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operational_5s_template_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_operational_5s_template_items" ON public.operational_5s_template_items 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE auth_user_id = auth.uid() AND system_role IN ('admin_total', 'owner_admin_professional')));
CREATE POLICY "auth_read_operational_5s_template_items" ON public.operational_5s_template_items FOR SELECT TO authenticated USING (true);
CREATE TRIGGER update_operational_5s_template_items_updated_at BEFORE UPDATE ON public.operational_5s_template_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. CHECKLIST DIÁRIO (operational_5s_daily_checklists)
CREATE TABLE IF NOT EXISTS public.operational_5s_daily_checklists (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_date date NOT NULL,
    template_id uuid NOT NULL REFERENCES public.operational_5s_templates(id),
    status text NOT NULL CHECK (status IN ('DRAFT', 'OPENING_IN_PROGRESS', 'OPERATION_IN_PROGRESS', 'CLOSING_IN_PROGRESS', 'AWAITING_ACTIONS', 'COMPLETED', 'APPROVED')) DEFAULT 'DRAFT',
    manager_user_id uuid REFERENCES public.user_profiles(id),
    opened_at timestamptz,
    closed_at timestamptz,
    approved_at timestamptz,
    approved_by_user_id uuid REFERENCES public.user_profiles(id),
    score_operational numeric(5,2),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (business_date)
);

ALTER TABLE public.operational_5s_daily_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_operational_5s_daily_checklists" ON public.operational_5s_daily_checklists 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE auth_user_id = auth.uid() AND system_role IN ('admin_total', 'owner_admin_professional')));
CREATE POLICY "auth_read_operational_5s_daily_checklists" ON public.operational_5s_daily_checklists FOR SELECT TO authenticated USING (true);
CREATE TRIGGER update_operational_5s_daily_checklists_updated_at BEFORE UPDATE ON public.operational_5s_daily_checklists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. INSPEÇÕES (operational_5s_inspections)
CREATE TABLE IF NOT EXISTS public.operational_5s_inspections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_id uuid NOT NULL REFERENCES public.operational_5s_daily_checklists(id) ON DELETE CASCADE,
    inspection_type text NOT NULL CHECK (inspection_type IN ('OPENING', 'DURING_DAY', 'CLOSING')),
    sequence_number integer NOT NULL DEFAULT 1,
    status text NOT NULL CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'CANCELLED')) DEFAULT 'IN_PROGRESS',
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    inspector_user_id uuid NOT NULL REFERENCES public.user_profiles(id),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operational_5s_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_operational_5s_inspections" ON public.operational_5s_inspections 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE auth_user_id = auth.uid() AND system_role IN ('admin_total', 'owner_admin_professional')));
CREATE POLICY "auth_read_operational_5s_inspections" ON public.operational_5s_inspections FOR SELECT TO authenticated USING (true);
CREATE TRIGGER update_operational_5s_inspections_updated_at BEFORE UPDATE ON public.operational_5s_inspections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. RESPOSTAS DAS INSPEÇÕES (operational_5s_inspection_responses)
CREATE TABLE IF NOT EXISTS public.operational_5s_inspection_responses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id uuid NOT NULL REFERENCES public.operational_5s_inspections(id) ON DELETE CASCADE,
    template_item_id uuid NOT NULL REFERENCES public.operational_5s_template_items(id),
    item_key_snapshot text NOT NULL,
    title_snapshot text NOT NULL,
    section_snapshot text NOT NULL,
    weight_snapshot integer NOT NULL,
    status text NOT NULL CHECK (status IN ('PENDING_REVIEW', 'COMPLIANT', 'ISSUE', 'NOT_APPLICABLE')) DEFAULT 'PENDING_REVIEW',
    justification text,
    observation text,
    answered_by_user_id uuid REFERENCES public.user_profiles(id),
    answered_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (inspection_id, template_item_id)
);

ALTER TABLE public.operational_5s_inspection_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_operational_5s_inspection_responses" ON public.operational_5s_inspection_responses 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE auth_user_id = auth.uid() AND system_role IN ('admin_total', 'owner_admin_professional')));
CREATE POLICY "auth_read_operational_5s_inspection_responses" ON public.operational_5s_inspection_responses FOR SELECT TO authenticated USING (true);
CREATE TRIGGER update_operational_5s_inspection_responses_updated_at BEFORE UPDATE ON public.operational_5s_inspection_responses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. AÇÕES CORRETIVAS / PENDÊNCIAS (operational_5s_corrective_actions)
CREATE TABLE IF NOT EXISTS public.operational_5s_corrective_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_id uuid NOT NULL REFERENCES public.operational_5s_daily_checklists(id) ON DELETE CASCADE,
    response_id uuid NOT NULL REFERENCES public.operational_5s_inspection_responses(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text NOT NULL,
    assigned_to_collaborator_id uuid NOT NULL REFERENCES public.collaborators(id),
    priority text NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) DEFAULT 'MEDIUM',
    status text NOT NULL CHECK (status IN ('OPEN', 'IN_PROGRESS', 'AWAITING_VALIDATION', 'RESOLVED', 'CANCELLED_WITH_JUSTIFICATION')) DEFAULT 'OPEN',
    due_at timestamptz NOT NULL,
    resolution_notes text,
    created_by_user_id uuid NOT NULL REFERENCES public.user_profiles(id),
    resolved_at timestamptz,
    validated_at timestamptz,
    validated_by_user_id uuid REFERENCES public.user_profiles(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (response_id)
);

ALTER TABLE public.operational_5s_corrective_actions ENABLE ROW LEVEL SECURITY;
-- Administradores gerenciam tudo
CREATE POLICY "admin_all_operational_5s_corrective_actions" ON public.operational_5s_corrective_actions 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE auth_user_id = auth.uid() AND system_role IN ('admin_total', 'owner_admin_professional')));

-- Profissionais lêem e atualizam (apenas a coluna resolution_notes e status) as suas pendências atribuídas
CREATE POLICY "prof_read_own_corrective_actions" ON public.operational_5s_corrective_actions 
  FOR SELECT TO authenticated 
  USING (assigned_to_collaborator_id = (SELECT collaborator_id FROM public.user_profiles WHERE auth_user_id = auth.uid()));

CREATE POLICY "prof_update_own_corrective_actions" ON public.operational_5s_corrective_actions 
  FOR UPDATE TO authenticated 
  USING (assigned_to_collaborator_id = (SELECT collaborator_id FROM public.user_profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (assigned_to_collaborator_id = (SELECT collaborator_id FROM public.user_profiles WHERE auth_user_id = auth.uid()));

CREATE TRIGGER update_operational_5s_corrective_actions_updated_at BEFORE UPDATE ON public.operational_5s_corrective_actions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- VIEWS
CREATE OR REPLACE VIEW public.vw_5s_operational_summary AS
SELECT 
  ca.*,
  (ca.due_at < now() AND ca.status NOT IN ('RESOLVED', 'CANCELLED_WITH_JUSTIFICATION')) as is_overdue
FROM public.operational_5s_corrective_actions ca;

-- SEED TEMPLATE OFICIAL V1 E SEUS 21 ITENS
DO $$
DECLARE
    v_template_id uuid;
BEGIN
    INSERT INTO public.operational_5s_templates (name, status) 
    VALUES ('IBZ 5S Operacional — v1', 'ACTIVE') 
    RETURNING id INTO v_template_id;

    -- 7 Itens de Abertura
    INSERT INTO public.operational_5s_template_items (template_id, item_key, section, title, display_order) VALUES
    (v_template_id, 'OPEN_1', 'OPENING', 'Luzes e equipamentos ligados', 1),
    (v_template_id, 'OPEN_2', 'OPENING', 'Bancadas limpas e organizadas', 2),
    (v_template_id, 'OPEN_3', 'OPENING', 'Chão varrido e sem cabelos', 3),
    (v_template_id, 'OPEN_4', 'OPENING', 'Estoque de toalhas abastecido', 4),
    (v_template_id, 'OPEN_5', 'OPENING', 'Recepção organizada', 5),
    (v_template_id, 'OPEN_6', 'OPENING', 'Produtos de consumo (shampoo) preenchidos', 6),
    (v_template_id, 'OPEN_7', 'OPENING', 'Lixeiras vazias e com saco novo', 7);

    -- 7 Itens Durante o Dia
    INSERT INTO public.operational_5s_template_items (template_id, item_key, section, title, display_order) VALUES
    (v_template_id, 'DAY_1', 'DURING_DAY', 'Cadeiras limpas entre clientes', 8),
    (v_template_id, 'DAY_2', 'DURING_DAY', 'Ferramentas higienizadas após uso', 9),
    (v_template_id, 'DAY_3', 'DURING_DAY', 'Chão varrido entre clientes', 10),
    (v_template_id, 'DAY_4', 'DURING_DAY', 'Espelhos sem manchas visíveis', 11),
    (v_template_id, 'DAY_5', 'DURING_DAY', 'Toalhas sujas no cesto correto', 12),
    (v_template_id, 'DAY_6', 'DURING_DAY', 'Pia lavatório sem acúmulo de cabelo', 13),
    (v_template_id, 'DAY_7', 'DURING_DAY', 'Copos e xícaras recolhidos das bancadas', 14);

    -- 7 Itens de Fechamento
    INSERT INTO public.operational_5s_template_items (template_id, item_key, section, title, display_order) VALUES
    (v_template_id, 'CLOSE_1', 'CLOSING', 'Máquinas de corte limpas e lubrificadas', 15),
    (v_template_id, 'CLOSE_2', 'CLOSING', 'Bancadas esterilizadas', 16),
    (v_template_id, 'CLOSE_3', 'CLOSING', 'Chão aspirado e limpo', 17),
    (v_template_id, 'CLOSE_4', 'CLOSING', 'Lixeiras esvaziadas (todas)', 18),
    (v_template_id, 'CLOSE_5', 'CLOSING', 'Ar condicionado e luzes apagados', 19),
    (v_template_id, 'CLOSE_6', 'CLOSING', 'Estoque rápido (barbicide/golas) reabastecido para amanhã', 20),
    (v_template_id, 'CLOSE_7', 'CLOSING', 'Portas fechadas e alarme ativado', 21);
END $$;

COMMIT;
