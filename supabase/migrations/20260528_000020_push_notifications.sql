-- ============================================================
-- Barber Zac ERP — Migration #20
-- Push Notifications Module
-- Date: 2026-05-28
-- STRICTLY ADDITIVE — No drops, no destructive changes
-- ============================================================

-- ============================================================
-- TABLE 1: push_subscriptions
-- Stores device/token registrations for push notifications
-- ============================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_profile_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  collaborator_id uuid REFERENCES public.collaborators(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  role text NOT NULL CHECK (role IN ('admin', 'owner', 'professional', 'customer')),
  provider text NOT NULL DEFAULT 'fcm',
  token text NOT NULL,
  endpoint text,
  p256dh text,
  auth_key text,
  platform text CHECK (platform IN ('ios', 'android', 'desktop', 'unknown')),
  browser text,
  device_label text,
  user_agent text,
  is_pwa boolean NOT NULL DEFAULT false,
  permission_status text CHECK (permission_status IN ('granted', 'denied', 'default')) DEFAULT 'default',
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamp with time zone,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,

  CONSTRAINT uq_push_provider_token UNIQUE (provider, token)
);

CREATE INDEX IF NOT EXISTS idx_push_sub_user_profile ON public.push_subscriptions(user_profile_id);
CREATE INDEX IF NOT EXISTS idx_push_sub_collaborator ON public.push_subscriptions(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_push_sub_role ON public.push_subscriptions(role);
CREATE INDEX IF NOT EXISTS idx_push_sub_active ON public.push_subscriptions(is_active);

CREATE TRIGGER update_push_subscriptions_modtime
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all actions for authenticated users"
  ON public.push_subscriptions FOR ALL TO authenticated USING (true);

-- ============================================================
-- TABLE 2: notification_preferences
-- Per-user toggle preferences for notification types
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_profile_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  notify_new_appointment boolean NOT NULL DEFAULT true,
  notify_cancelled_appointment boolean NOT NULL DEFAULT true,
  notify_rescheduled_appointment boolean NOT NULL DEFAULT true,
  notify_checkin boolean NOT NULL DEFAULT true,
  notify_completed boolean NOT NULL DEFAULT false,
  notify_no_show boolean NOT NULL DEFAULT true,
  notify_subscription_closed boolean NOT NULL DEFAULT true,
  notify_subscription_cancelled boolean NOT NULL DEFAULT true,
  quiet_hours_enabled boolean NOT NULL DEFAULT false,
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notif_pref_user ON public.notification_preferences(user_profile_id);

CREATE TRIGGER update_notification_preferences_modtime
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all actions for authenticated users"
  ON public.notification_preferences FOR ALL TO authenticated USING (true);

-- ============================================================
-- TABLE 3: notification_events
-- Idempotent event log — prevents duplicate notifications
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notification_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type text NOT NULL CHECK (event_type IN (
    'appointment_created',
    'appointment_cancelled',
    'appointment_rescheduled',
    'appointment_checkin',
    'appointment_completed',
    'appointment_no_show',
    'subscription_closed',
    'subscription_cancelled',
    'subscription_payment_approved',
    'test_notification'
  )),
  entity_type text NOT NULL CHECK (entity_type IN (
    'appointment', 'subscription', 'payment', 'test'
  )),
  entity_id uuid NOT NULL,
  idempotency_key text UNIQUE NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notif_event_type ON public.notification_events(event_type);
CREATE INDEX IF NOT EXISTS idx_notif_event_entity ON public.notification_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notif_event_created ON public.notification_events(created_at DESC);

ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all actions for authenticated users"
  ON public.notification_events FOR ALL TO authenticated USING (true);

-- ============================================================
-- TABLE 4: notification_delivery_logs
-- Tracks delivery status per subscription per event
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notification_delivery_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_event_id uuid REFERENCES public.notification_events(id) ON DELETE CASCADE NOT NULL,
  push_subscription_id uuid REFERENCES public.push_subscriptions(id) ON DELETE CASCADE NOT NULL,
  user_profile_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  collaborator_id uuid REFERENCES public.collaborators(id) ON DELETE SET NULL,
  target_role text,
  status text NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'skipped')) DEFAULT 'pending',
  provider text NOT NULL DEFAULT 'fcm',
  provider_message_id text,
  error_message text,
  sent_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,

  CONSTRAINT uq_delivery_event_subscription UNIQUE (notification_event_id, push_subscription_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_event ON public.notification_delivery_logs(notification_event_id);
CREATE INDEX IF NOT EXISTS idx_delivery_subscription ON public.notification_delivery_logs(push_subscription_id);
CREATE INDEX IF NOT EXISTS idx_delivery_status ON public.notification_delivery_logs(status);
CREATE INDEX IF NOT EXISTS idx_delivery_created ON public.notification_delivery_logs(created_at DESC);

ALTER TABLE public.notification_delivery_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all actions for authenticated users"
  ON public.notification_delivery_logs FOR ALL TO authenticated USING (true);

-- End of Migration
