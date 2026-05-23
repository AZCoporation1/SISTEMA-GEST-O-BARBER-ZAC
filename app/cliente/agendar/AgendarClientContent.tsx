"use client"

import { useRouter } from 'next/navigation'
import BookingModeSelector from './components/BookingModeSelector'
import ReadyCombosList from './components/ReadyCombosList'
import BuildServiceFlow from './components/BuildServiceFlow'
import SubscriptionPlanSelector from './components/SubscriptionPlanSelector'
import SubscriptionFlow from './components/SubscriptionFlow'
import ServiceCatalog from './ServiceCatalog'
import type { PublicCatalogServiceV2, PublicCatalogService } from '@/features/agenda/actions/public-booking.actions'

interface AgendarClientContentProps {
  mode: string
  planId?: string
  servicesV2: PublicCatalogServiceV2[]
  servicesLegacy: PublicCatalogService[]
}

export default function AgendarClientContent({ mode, planId, servicesV2, servicesLegacy }: AgendarClientContentProps) {
  const router = useRouter()

  const goToHub = () => router.push('/cliente/agendar')

  if (mode === 'combo') {
    return <ReadyCombosList services={servicesV2} onBack={goToHub} />
  }

  if (mode === 'build') {
    return <BuildServiceFlow services={servicesV2} onBack={goToHub} />
  }

  if (mode === 'subscription') {
    if (planId) {
      return <SubscriptionFlow planId={planId} onBack={() => router.push('/cliente/agendar?mode=subscription')} />
    }
    return <SubscriptionPlanSelector onBack={goToHub} />
  }

  if (mode === 'all') {
    return (
      <div className="space-y-4">
        <button
          onClick={goToHub}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors btn-press"
        >
          ← Voltar ao menu
        </button>
        <ServiceCatalog services={servicesLegacy} />
      </div>
    )
  }

  // Default: hub
  return <BookingModeSelector services={servicesV2} />
}
