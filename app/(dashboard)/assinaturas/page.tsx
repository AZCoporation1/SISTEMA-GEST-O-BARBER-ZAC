import { Metadata } from 'next'
import SubscriptionsPageClient from './SubscriptionsPageClient'

export const metadata: Metadata = {
  title: 'Assinaturas | Barber Zac ERP',
  description: 'Gerenciamento de assinaturas mensais — planos, assinantes ativos, ativação manual e acompanhamento de ciclos.',
}

export default function SubscriptionsPage() {
  return <SubscriptionsPageClient />
}
