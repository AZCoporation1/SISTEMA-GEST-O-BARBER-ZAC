/**
 * Apply migration #12 — Agenda Module via Supabase Management API
 */
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const MGMT_TOKEN = 'sbp_f5ed50c494359deb4b9e90c04eb19e792f07c176';
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0];

async function runSQL(sql, label) {
  console.log(`\n[EXEC] ${label}`);
  const resp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MGMT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await resp.text();
  if (!resp.ok) {
    console.log(`  ❌ Status: ${resp.status}`);
    console.log(`  Response: ${text.substring(0, 800)}`);
    return false;
  }

  console.log(`  ✅ Success`);
  try {
    const result = JSON.parse(text);
    if (result && result.length > 0) {
      console.log(`  Result: ${JSON.stringify(result).substring(0, 300)}`);
    }
  } catch(e) {}
  return true;
}

async function main() {
  console.log('=== Migration #12: Agenda Module ===');
  console.log(`Project: ${PROJECT_REF}`);

  // Step 1: agenda_settings
  let ok = await runSQL(`
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
  `, '1/12 — Create agenda_settings');
  if (!ok) return;

  ok = await runSQL(`
    ALTER TABLE public.agenda_settings ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      CREATE POLICY "auth_all_agenda_settings" ON public.agenda_settings FOR ALL TO authenticated USING (true);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `, '1b — RLS agenda_settings');

  ok = await runSQL(`
    DROP TRIGGER IF EXISTS update_agenda_settings_modtime ON public.agenda_settings;
    CREATE TRIGGER update_agenda_settings_modtime
      BEFORE UPDATE ON public.agenda_settings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `, '1c — Trigger agenda_settings');

  // Step 2: professional_working_hours
  ok = await runSQL(`
    CREATE TABLE IF NOT EXISTS public.professional_working_hours (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      professional_id UUID NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
      weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      break_start_time TIME,
      break_end_time TIME,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(professional_id, weekday)
    );
  `, '2/12 — Create professional_working_hours');
  if (!ok) return;

  ok = await runSQL(`
    ALTER TABLE public.professional_working_hours ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      CREATE POLICY "auth_all_professional_working_hours" ON public.professional_working_hours FOR ALL TO authenticated USING (true);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS idx_pwh_professional ON public.professional_working_hours(professional_id);
    CREATE INDEX IF NOT EXISTS idx_pwh_weekday ON public.professional_working_hours(weekday);
    DROP TRIGGER IF EXISTS update_pwh_modtime ON public.professional_working_hours;
    CREATE TRIGGER update_pwh_modtime BEFORE UPDATE ON public.professional_working_hours FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `, '2b — RLS + Indexes + Trigger');

  // Step 3: appointments
  ok = await runSQL(`
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
      linked_sale_id UUID,
      recurrence_rule JSONB,
      created_by UUID,
      updated_by UUID,
      cancelled_by UUID,
      cancelled_at TIMESTAMP WITH TIME ZONE,
      cancellation_reason TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `, '3/12 — Create appointments');
  if (!ok) return;

  ok = await runSQL(`
    ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      CREATE POLICY "auth_all_appointments" ON public.appointments FOR ALL TO authenticated USING (true);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS idx_appointments_professional ON public.appointments(professional_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_start ON public.appointments(start_at);
    CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);
    CREATE INDEX IF NOT EXISTS idx_appointments_customer ON public.appointments(customer_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(start_at, end_at);
    DROP TRIGGER IF EXISTS update_appointments_modtime ON public.appointments;
    CREATE TRIGGER update_appointments_modtime BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `, '3b — RLS + Indexes + Trigger');

  // Step 4: appointment_blocks
  ok = await runSQL(`
    CREATE TABLE IF NOT EXISTS public.appointment_blocks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      professional_id UUID NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
      start_at TIMESTAMP WITH TIME ZONE NOT NULL,
      end_at TIMESTAMP WITH TIME ZONE NOT NULL,
      block_type TEXT NOT NULL DEFAULT 'manual' CHECK (block_type IN ('manual', 'lunch', 'meeting', 'unavailable', 'recurring')),
      reason TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_by UUID,
      cancelled_by UUID,
      cancelled_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `, '4/12 — Create appointment_blocks');
  if (!ok) return;

  ok = await runSQL(`
    ALTER TABLE public.appointment_blocks ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      CREATE POLICY "auth_all_appointment_blocks" ON public.appointment_blocks FOR ALL TO authenticated USING (true);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS idx_blocks_professional ON public.appointment_blocks(professional_id);
    CREATE INDEX IF NOT EXISTS idx_blocks_range ON public.appointment_blocks(start_at, end_at);
    DROP TRIGGER IF EXISTS update_blocks_modtime ON public.appointment_blocks;
    CREATE TRIGGER update_blocks_modtime BEFORE UPDATE ON public.appointment_blocks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `, '4b — RLS + Indexes + Trigger');

  // Step 5: appointment_waitlist
  ok = await runSQL(`
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
  `, '5/12 — Create appointment_waitlist');
  if (!ok) return;

  ok = await runSQL(`
    ALTER TABLE public.appointment_waitlist ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      CREATE POLICY "auth_all_appointment_waitlist" ON public.appointment_waitlist FOR ALL TO authenticated USING (true);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DROP TRIGGER IF EXISTS update_waitlist_modtime ON public.appointment_waitlist;
    CREATE TRIGGER update_waitlist_modtime BEFORE UPDATE ON public.appointment_waitlist FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `, '5b — RLS + Trigger');

  // Step 6: appointment_command_items
  ok = await runSQL(`
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
  `, '6/12 — Create appointment_command_items');
  if (!ok) return;

  ok = await runSQL(`
    ALTER TABLE public.appointment_command_items ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      CREATE POLICY "auth_all_appointment_command_items" ON public.appointment_command_items FOR ALL TO authenticated USING (true);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS idx_cmd_items_appointment ON public.appointment_command_items(appointment_id);
    DROP TRIGGER IF EXISTS update_cmd_items_modtime ON public.appointment_command_items;
    CREATE TRIGGER update_cmd_items_modtime BEFORE UPDATE ON public.appointment_command_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `, '6b — RLS + Index + Trigger');

  // Step 7: Seed agenda_settings
  ok = await runSQL(`
    INSERT INTO public.agenda_settings (opening_time, closing_time, slot_interval_minutes, allow_overbooking, default_view, timezone)
    SELECT '07:00', '21:00', 30, false, 'day', 'America/Sao_Paulo'
    WHERE NOT EXISTS (SELECT 1 FROM public.agenda_settings LIMIT 1);
  `, '7/12 — Seed agenda_settings');

  // Step 8: Seed professional working hours
  ok = await runSQL(`
    DO $$
    DECLARE
      v_gustavo_id UUID;
      v_matheus_id UUID;
      v_lucas_id UUID;
    BEGIN
      SELECT id INTO v_gustavo_id FROM public.collaborators WHERE name = 'Gustavo' AND is_active = true LIMIT 1;
      SELECT id INTO v_matheus_id FROM public.collaborators WHERE name = 'Matheus' AND is_active = true LIMIT 1;
      SELECT id INTO v_lucas_id FROM public.collaborators WHERE name = 'Lucas Zaquiel' AND is_active = true LIMIT 1;

      IF v_gustavo_id IS NOT NULL THEN
        INSERT INTO public.professional_working_hours (professional_id, weekday, start_time, end_time, is_active) VALUES
          (v_gustavo_id, 1, '09:00', '21:00', true),
          (v_gustavo_id, 2, '09:00', '21:00', true),
          (v_gustavo_id, 3, '08:00', '20:30', true),
          (v_gustavo_id, 4, '08:00', '21:00', true),
          (v_gustavo_id, 5, '07:00', '21:00', true),
          (v_gustavo_id, 6, '07:00', '19:00', true)
        ON CONFLICT (professional_id, weekday) DO NOTHING;
      END IF;

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
  `, '8/12 — Seed professional working hours (real schedule)');

  // Verify
  console.log('\n=== Verification ===');
  await runSQL(`SELECT COUNT(*) as cnt FROM public.agenda_settings`, 'Verify agenda_settings');
  await runSQL(`SELECT COUNT(*) as cnt FROM public.professional_working_hours`, 'Verify working_hours');
  await runSQL(`SELECT COUNT(*) as cnt FROM public.appointments`, 'Verify appointments (should be 0)');
  await runSQL(`SELECT COUNT(*) as cnt FROM public.appointment_blocks`, 'Verify blocks (should be 0)');
  await runSQL(`SELECT COUNT(*) as cnt FROM public.appointment_waitlist`, 'Verify waitlist (should be 0)');
  await runSQL(`SELECT COUNT(*) as cnt FROM public.appointment_command_items`, 'Verify cmd_items (should be 0)');

  console.log('\n✅ Migration #12 complete!');
}

main().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
