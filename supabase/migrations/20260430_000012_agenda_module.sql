-- ============================================================
-- Barber Zac ERP — Migration #12: Agenda Module
-- Date: 2026-04-30
-- ADDITIVE ONLY — No drops, no destructive changes
-- ============================================================

-- ============================================================
-- 1. AGENDA SETTINGS (global config)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agenda_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opening_time TIME NOT NULL DEFAULT '08:00',
  closing_time TIME NOT NULL DEFAULT '21:00',
  slot_interval_minutes INTEGER NOT NULL DEFAULT 30 CHECK (slot_interval_minutes IN (15, 30, 60)),
  allow_overbooking BOOLEAN NOT NULL DEFAULT false,
  default_view TEXT NOT NULL DEFAULT 'day' CHECK (default_view IN ('day', 'week')),
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.agenda_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_agenda_settings" ON public.agenda_settings FOR ALL TO authenticated USING (true);

CREATE TRIGGER update_agenda_settings_modtime
  BEFORE UPDATE ON public.agenda_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. PROFESSIONAL WORKING HOURS (jornada por profissional/dia)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.professional_working_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0=Sunday, 1=Monday...6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_start_time TIME,
  break_end_time TIME,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(professional_id, weekday)
);

ALTER TABLE public.professional_working_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_professional_working_hours" ON public.professional_working_hours FOR ALL TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_pwh_professional ON public.professional_working_hours(professional_id);
CREATE INDEX IF NOT EXISTS idx_pwh_weekday ON public.professional_working_hours(weekday);

CREATE TRIGGER update_pwh_modtime
  BEFORE UPDATE ON public.professional_working_hours
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 3. APPOINTMENTS (agendamentos core)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name_snapshot TEXT,
  customer_phone_snapshot TEXT,
  professional_id UUID NOT NULL REFERENCES public.collaborators(id) ON DELETE RESTRICT,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  service_name_snapshot TEXT,
  service_price_snapshot NUMERIC(14,2),
  service_duration_minutes_snapshot INTEGER,
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show', 'blocked', 'encaixe'
  )),
  source TEXT NOT NULL DEFAULT 'admin' CHECK (source IN ('admin', 'professional', 'customer', 'imported')),
  notes TEXT,
  linked_sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  recurrence_rule JSONB, -- Prepared for phase 2
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  cancelled_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_appointments" ON public.appointments FOR ALL TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_appointments_professional ON public.appointments(professional_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start ON public.appointments(start_at);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_customer ON public.appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(start_at, end_at);

CREATE TRIGGER update_appointments_modtime
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 4. APPOINTMENT BLOCKS (bloqueios de agenda)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.appointment_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at TIMESTAMP WITH TIME ZONE NOT NULL,
  block_type TEXT NOT NULL DEFAULT 'manual' CHECK (block_type IN ('manual', 'lunch', 'meeting', 'unavailable', 'recurring')),
  reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  cancelled_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.appointment_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_appointment_blocks" ON public.appointment_blocks FOR ALL TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_blocks_professional ON public.appointment_blocks(professional_id);
CREATE INDEX IF NOT EXISTS idx_blocks_range ON public.appointment_blocks(start_at, end_at);

CREATE TRIGGER update_blocks_modtime
  BEFORE UPDATE ON public.appointment_blocks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 5. APPOINTMENT WAITLIST (lista de espera)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.appointment_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name_snapshot TEXT,
  customer_phone_snapshot TEXT,
  desired_professional_id UUID REFERENCES public.collaborators(id) ON DELETE SET NULL,
  desired_service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  desired_date DATE,
  preferred_period TEXT CHECK (preferred_period IN ('morning', 'afternoon', 'evening', 'any')),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'contacted', 'scheduled', 'cancelled')),
  notes TEXT,
  converted_appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.appointment_waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_appointment_waitlist" ON public.appointment_waitlist FOR ALL TO authenticated USING (true);

CREATE TRIGGER update_waitlist_modtime
  BEFORE UPDATE ON public.appointment_waitlist
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 6. APPOINTMENT COMMAND ITEMS (pré-comanda)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.appointment_command_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('service', 'product', 'manual')),
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.inventory_products(id) ON DELETE SET NULL,
  description_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_snapshot NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_price_snapshot NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price_snapshot) STORED,
  professional_id UUID REFERENCES public.collaborators(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.appointment_command_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_appointment_command_items" ON public.appointment_command_items FOR ALL TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_cmd_items_appointment ON public.appointment_command_items(appointment_id);

CREATE TRIGGER update_cmd_items_modtime
  BEFORE UPDATE ON public.appointment_command_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SEED: Default agenda settings
-- ============================================================
INSERT INTO public.agenda_settings (opening_time, closing_time, slot_interval_minutes, allow_overbooking, default_view, timezone)
SELECT '07:00', '21:00', 30, false, 'day', 'America/Sao_Paulo'
WHERE NOT EXISTS (SELECT 1 FROM public.agenda_settings LIMIT 1);

-- ============================================================
-- SEED: Professional working hours (real Barber Zac schedule)
-- Uses collaborator names to resolve IDs dynamically
-- ============================================================

-- Helper: Insert working hours for a professional by name
DO $$
DECLARE
  v_gustavo_id UUID;
  v_matheus_id UUID;
  v_lucas_id UUID;
BEGIN
  SELECT id INTO v_gustavo_id FROM public.collaborators WHERE name = 'Gustavo' AND is_active = true LIMIT 1;
  SELECT id INTO v_matheus_id FROM public.collaborators WHERE name = 'Matheus' AND is_active = true LIMIT 1;
  SELECT id INTO v_lucas_id FROM public.collaborators WHERE name = 'Lucas Zaquiel' AND is_active = true LIMIT 1;

  -- For each professional, insert Mon-Sat working hours
  -- Weekday: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

  -- ── Gustavo (GuhSP) ──
  IF v_gustavo_id IS NOT NULL THEN
    INSERT INTO public.professional_working_hours (professional_id, weekday, start_time, end_time, is_active) VALUES
      (v_gustavo_id, 1, '09:00', '21:00', true),  -- Segunda
      (v_gustavo_id, 2, '09:00', '21:00', true),  -- Terça
      (v_gustavo_id, 3, '08:00', '20:30', true),  -- Quarta
      (v_gustavo_id, 4, '08:00', '21:00', true),  -- Quinta
      (v_gustavo_id, 5, '07:00', '21:00', true),  -- Sexta
      (v_gustavo_id, 6, '07:00', '19:00', true)   -- Sábado
    ON CONFLICT (professional_id, weekday) DO NOTHING;
  END IF;

  -- ── Matheus (Gulu) ──
  IF v_matheus_id IS NOT NULL THEN
    INSERT INTO public.professional_working_hours (professional_id, weekday, start_time, end_time, is_active) VALUES
      (v_matheus_id, 1, '09:00', '21:00', true),
      (v_matheus_id, 2, '09:00', '21:00', true),
      (v_matheus_id, 3, '08:00', '20:30', true),
      (v_matheus_id, 4, '08:00', '21:00', true),
      (v_matheus_id, 5, '07:00', '21:00', true),
      (v_matheus_id, 6, '07:00', '19:00', true)
    ON CONFLICT (professional_id, weekday) DO NOTHING;
  END IF;

  -- ── Lucas Zaquiel (Barber Zac) ──
  IF v_lucas_id IS NOT NULL THEN
    INSERT INTO public.professional_working_hours (professional_id, weekday, start_time, end_time, is_active) VALUES
      (v_lucas_id, 1, '09:00', '21:00', true),
      (v_lucas_id, 2, '09:00', '21:00', true),
      (v_lucas_id, 3, '08:00', '20:30', true),
      (v_lucas_id, 4, '08:00', '21:00', true),
      (v_lucas_id, 5, '07:00', '21:00', true),
      (v_lucas_id, 6, '07:00', '19:00', true)
    ON CONFLICT (professional_id, weekday) DO NOTHING;
  END IF;
END $$;

-- End of Migration #12
