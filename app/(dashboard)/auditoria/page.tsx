import { Metadata } from 'next'
import { AuditDashboard } from '@/features/audit/components/AuditDashboard'

export const metadata: Metadata = {
  title: 'Auditoria | Barber Zac',
  description: 'Sistema de rastreabilidade e logs do ERP Barber Zac.',
}

export default function AuditPage() {
  return <AuditDashboard />
}
