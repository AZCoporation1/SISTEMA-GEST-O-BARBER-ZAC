// ── Event Payload Builders ──────────────────────────────────
// Barber Zac ERP — Notification content for each event type

import type {
  PushPayload,
  AppointmentNotificationData,
  SubscriptionNotificationData,
} from '../types'

/**
 * Build push payload for appointment_created event.
 */
export function buildAppointmentCreatedPayload(
  data: AppointmentNotificationData,
  targetRole: 'admin' | 'owner' | 'professional'
): PushPayload {
  return {
    title: '📅 Novo agendamento IBZ',
    body: `${data.customerName} agendou ${data.serviceName || 'serviço'} com ${data.professionalName || 'profissional'} às ${data.startTime || ''}.`,
    icon: '/icons/ibz-192.png',
    badge: '/icons/ibz-192.png',
    tag: `appointment-created-${data.appointmentId}`,
    data: {
      url: targetRole === 'professional' ? '/profissional/agenda' : '/agendamento',
      eventType: 'appointment_created',
      entityId: data.appointmentId,
    },
  }
}

/**
 * Build push payload for appointment_cancelled event.
 */
export function buildAppointmentCancelledPayload(
  data: AppointmentNotificationData,
  targetRole: 'admin' | 'owner' | 'professional'
): PushPayload {
  return {
    title: '❌ Agendamento cancelado',
    body: `${data.customerName} cancelou ${data.serviceName || 'serviço'} de ${data.startTime || ''}.`,
    icon: '/icons/ibz-192.png',
    badge: '/icons/ibz-192.png',
    tag: `appointment-cancelled-${data.appointmentId}`,
    data: {
      url: targetRole === 'professional' ? '/profissional/agenda' : '/agendamento',
      eventType: 'appointment_cancelled',
      entityId: data.appointmentId,
    },
  }
}

/**
 * Build push payload for appointment_rescheduled event.
 */
export function buildAppointmentRescheduledPayload(
  data: AppointmentNotificationData,
  targetRole: 'admin' | 'owner' | 'professional'
): PushPayload {
  return {
    title: '🔄 Agendamento reagendado',
    body: `${data.customerName} mudou para ${data.newStartDate || ''} às ${data.newStartTime || ''}.`,
    icon: '/icons/ibz-192.png',
    badge: '/icons/ibz-192.png',
    tag: `appointment-rescheduled-${data.appointmentId}`,
    data: {
      url: targetRole === 'professional' ? '/profissional/agenda' : '/agendamento',
      eventType: 'appointment_rescheduled',
      entityId: data.appointmentId,
    },
  }
}

/**
 * Build push payload for appointment_checkin event.
 */
export function buildAppointmentCheckinPayload(
  data: AppointmentNotificationData,
  targetRole: 'admin' | 'owner' | 'professional'
): PushPayload {
  return {
    title: '✅ Cliente chegou',
    body: `${data.customerName} fez check-in para ${data.serviceName || 'serviço'} às ${data.startTime || ''}.`,
    icon: '/icons/ibz-192.png',
    badge: '/icons/ibz-192.png',
    tag: `appointment-checkin-${data.appointmentId}`,
    data: {
      url: targetRole === 'professional' ? '/profissional/agenda' : '/agendamento',
      eventType: 'appointment_checkin',
      entityId: data.appointmentId,
    },
  }
}

/**
 * Build push payload for appointment_completed event.
 */
export function buildAppointmentCompletedPayload(
  data: AppointmentNotificationData,
  targetRole: 'admin' | 'owner' | 'professional'
): PushPayload {
  return {
    title: '🎉 Atendimento finalizado',
    body: `${data.customerName} — ${data.serviceName || 'serviço'} finalizado.`,
    icon: '/icons/ibz-192.png',
    badge: '/icons/ibz-192.png',
    tag: `appointment-completed-${data.appointmentId}`,
    data: {
      url: targetRole === 'professional' ? '/profissional/agenda' : '/agendamento',
      eventType: 'appointment_completed',
      entityId: data.appointmentId,
    },
  }
}

/**
 * Build push payload for appointment_no_show event.
 */
export function buildAppointmentNoShowPayload(
  data: AppointmentNotificationData,
  targetRole: 'admin' | 'owner' | 'professional'
): PushPayload {
  return {
    title: '⚠️ Cliente marcado como ausência',
    body: `${data.customerName} foi marcado como ausência no horário ${data.startTime || ''}.`,
    icon: '/icons/ibz-192.png',
    badge: '/icons/ibz-192.png',
    tag: `appointment-noshow-${data.appointmentId}`,
    data: {
      url: targetRole === 'professional' ? '/profissional/agenda' : '/agendamento',
      eventType: 'appointment_no_show',
      entityId: data.appointmentId,
    },
  }
}

/**
 * Build push payload for subscription_closed event.
 */
export function buildSubscriptionClosedPayload(
  data: SubscriptionNotificationData,
  targetRole: 'admin' | 'owner' | 'professional'
): PushPayload {
  return {
    title: '🎯 Nova assinatura fechada',
    body: `${data.customerName} fechou o plano ${data.planName || 'assinatura'}${data.dayOfWeek ? ` com horário fixo ${data.dayOfWeek}` : ''}${data.time ? ` às ${data.time}` : ''}.`,
    icon: '/icons/ibz-192.png',
    badge: '/icons/ibz-192.png',
    tag: `subscription-closed-${data.subscriptionId}`,
    data: {
      url: targetRole === 'professional' ? '/profissional' : '/assinaturas',
      eventType: 'subscription_closed',
      entityId: data.subscriptionId,
    },
  }
}

/**
 * Build push payload for subscription_cancelled event.
 */
export function buildSubscriptionCancelledPayload(
  data: SubscriptionNotificationData,
  targetRole: 'admin' | 'owner' | 'professional'
): PushPayload {
  return {
    title: '🚫 Assinatura cancelada',
    body: `${data.customerName} cancelou o plano ${data.planName || 'assinatura'}.`,
    icon: '/icons/ibz-192.png',
    badge: '/icons/ibz-192.png',
    tag: `subscription-cancelled-${data.subscriptionId}`,
    data: {
      url: targetRole === 'professional' ? '/profissional' : '/assinaturas',
      eventType: 'subscription_cancelled',
      entityId: data.subscriptionId,
    },
  }
}

/**
 * Build test notification payload.
 */
export function buildTestNotificationPayload(): PushPayload {
  return {
    title: '🔔 Teste de notificação IBZ',
    body: 'Notificações ativadas com sucesso neste dispositivo.',
    icon: '/icons/ibz-192.png',
    badge: '/icons/ibz-192.png',
    tag: `test-${Date.now()}`,
    data: {
      url: '/',
      eventType: 'test_notification',
    },
  }
}

// ── Client-facing payloads (safe for lock screen — no PII) ──

export function buildClientAppointmentCreatedPayload(
  data: AppointmentNotificationData
): PushPayload {
  return {
    title: '📅 Horário agendado',
    body: 'Seu horário no IBZ foi agendado com sucesso.',
    icon: '/icons/ibz-192.png',
    badge: '/icons/ibz-192.png',
    tag: `client-appt-created-${data.appointmentId}`,
    data: {
      url: '/cliente/meus-agendamentos',
      eventType: 'appointment_created',
      entityId: data.appointmentId,
    },
  }
}

export function buildClientAppointmentRescheduledPayload(
  data: AppointmentNotificationData
): PushPayload {
  return {
    title: '🔄 Agendamento atualizado',
    body: 'Seu agendamento foi atualizado. Toque para conferir.',
    icon: '/icons/ibz-192.png',
    badge: '/icons/ibz-192.png',
    tag: `client-appt-rescheduled-${data.appointmentId}`,
    data: {
      url: '/cliente/meus-agendamentos',
      eventType: 'appointment_rescheduled',
      entityId: data.appointmentId,
    },
  }
}

export function buildClientAppointmentCancelledPayload(
  data: AppointmentNotificationData
): PushPayload {
  return {
    title: '❌ Horário cancelado',
    body: 'Seu horário foi cancelado. Toque para ver os detalhes.',
    icon: '/icons/ibz-192.png',
    badge: '/icons/ibz-192.png',
    tag: `client-appt-cancelled-${data.appointmentId}`,
    data: {
      url: '/cliente/meus-agendamentos',
      eventType: 'appointment_cancelled',
      entityId: data.appointmentId,
    },
  }
}

export function buildClientAppointmentReminderPayload(
  data: AppointmentNotificationData
): PushPayload {
  return {
    title: '🔔 Lembrete',
    body: 'Lembrete: você tem um horário em breve no IBZ.',
    icon: '/icons/ibz-192.png',
    badge: '/icons/ibz-192.png',
    tag: `client-appt-reminder-${data.appointmentId}`,
    data: {
      url: '/cliente/meus-agendamentos',
      eventType: 'appointment_created',
      entityId: data.appointmentId,
    },
  }
}
