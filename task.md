# Customer Booking Portal Implementation

- `[x]` 1. Catalog Fix & Enhancement (`app/cliente/agendar/page.tsx`)
  - `[x]` Fix `categories(name)` to `service_categories(name)` in Supabase query.
  - `[x]` Update UI to show services dynamically with price and duration.
- `[x]` 2. Professional Selection (`app/cliente/agendar/profissional/page.tsx`)
  - `[x]` Fetch active professionals (`collaborators`).
  - `[x]` Use safe fallback for name (`display_name` ?? `name` ?? `full_name`).
  - `[x]` Render professional list and pass state.
- `[x]` 3. Date & Time Selection (`app/cliente/agendar/data-hora/page.tsx`)
  - `[x]` Create calendar interface.
  - `[x]` Fetch available slots from server when date/service/professional changes.
- `[x]` 4. Slot Availability Service (`features/agenda/services/availability.service.ts`)
  - `[x]` Validate working hours, agenda settings, active appointments, and blocks.
  - `[x]` Generate contiguous slots based on service duration.
- `[x]` 5. Confirmation & Auth Integration
  - `[x]` Protect `/cliente/agendar/confirmacao` and trigger login if unauthenticated.
  - `[x]` Create confirmation page showing all details.
- `[x]` 6. Server Action (`features/agenda/actions/agenda.actions.ts`)
  - `[x]` Implement `createCustomerAppointment(data)`.
  - `[x]` Validate everything (auth, ownership, availability, constraints).
  - `[x]` Insert into `appointments` with `source = 'customer'`.
- `[x]` 7. Internal Agenda UI (`features/agenda/components/AgendaMobileView.tsx`)
  - `[x]` Render customer appointments with distinct visual indicator (e.g. teal, "Cliente/App" label).
- `[x]` 8. Validation
  - `[x]` Run `tsc --noEmit`.
  - `[x]` Run `next build`.
  - `[x]` Verify Customer Booking Portal compiles and integrates properly.

## FASE 3 — Script de Migração
- [x] Criar `scripts/migrate-subscription-plans-from-services.mjs`
- [x] Parser de nomes com items, visits, scope, visit_template
- [x] Mapeamento de profissionais confirmado
- [x] --dry-run executado: **14/14 ✅ alta confiança, 0 erros**
- [x] --apply executado e validado: **14/14 planos migrados com sucesso**

## FASE 4 — Tipos TypeScript
- [x] `features/subscriptions/types.ts` — Row types, enums, labels, colors, enriched types
- [x] `features/agenda/types.ts` — Adicionar subscription_id, subscription_occurrence_id, is_subscription ao AppointmentRow
- [x] `types/supabase.ts` — Registrar 6 tabelas novas

## FASE 5 — Server Actions
- [x] `features/subscriptions/actions/subscription.actions.ts` — SEM @ts-nocheck
- [x] getPublicSubscriptionPlans (com feature flag)
- [x] checkPlanProfessionalAllowed
- [x] checkSubscriptionAvailability (conflito + working hours)
- [x] createSubscriptionDraft (validação completa)
- [x] activateSubscription (admin only, gera appointments)
- [x] generateSubscriptionAppointments (idempotente, visit_template)
- [x] cancelCustomerSubscription (cancela tudo em cascata)
- [x] getCustomerActiveSubscription
- [x] markOccurrenceUsed (idempotente)
- [x] getSubscriberDiscount (backend source of truth, 7%)
- [x] listSubscriptions (admin)
- [x] getSubscriptionDetails (admin, com occurrences/payments)

## FASE 6 — UI Portal do Cliente
- [x] `SubscriptionPlanSelector.tsx` — Cards premium com filtro de scope
- [x] `SubscriptionFlow.tsx` — Wizard multi-step com escolha de barbeiro, dia/hora recorrentes, preview de datas e conflito, dados do cliente e checkout placeholder
- [x] `AgendarClientContent.tsx` — Roteamento do funil completo de planos e fluxo de assinatura
- [x] `BookingModeSelector.tsx` — Botão "Planos Mensais" (purple) habilitado via feature flag
