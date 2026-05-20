"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Clock, DollarSign, Search, ChevronRight, Package, Sparkles } from 'lucide-react'
import type { PublicCatalogServiceV2 } from '@/features/agenda/actions/public-booking.actions'

interface ReadyCombosListProps {
  services: PublicCatalogServiceV2[]
  onBack: () => void
}

export default function ReadyCombosList({ services, onBack }: ReadyCombosListProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('Todos')

  const combos = services.filter(s => s.isCombo)

  // Extract unique displayCategories from combos
  const allCategories = new Set<string>()
  for (const combo of combos) {
    for (const cat of combo.displayCategories) {
      allCategories.add(cat)
    }
  }
  const filterOptions = ['Todos', ...Array.from(allCategories).sort()]

  // Filter
  const filtered = combos.filter(combo => {
    const matchSearch = !search || combo.displayName.toLowerCase().includes(search.toLowerCase())
    const matchFilter = activeFilter === 'Todos' || combo.displayCategories.includes(activeFilter)
    return matchSearch && matchFilter
  })

  const handleSelect = (serviceId: string) => {
    router.push(`/cliente/agendar/profissional?serviceId=${serviceId}`)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 fade-up-fast">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-accent text-muted-foreground transition-colors btn-press">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Combos Prontos</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{combos.length} opções disponíveis</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative fade-up-fast">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar combo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-background border border-input rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-all duration-200"
        />
      </div>

      {/* Category filter pills */}
      <div className="flex overflow-x-auto pb-2 -mx-4 px-4 snap-x hide-scrollbar gap-2">
        {filterOptions.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveFilter(cat)}
            className={`snap-center shrink-0 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border btn-press
              ${activeFilter === cat
                ? 'bg-primary text-primary-foreground border-transparent shadow-sm'
                : 'bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Combo list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground text-sm fade-up-fast">
            <Package className="w-10 h-10 opacity-30" />
            <p>Nenhum combo encontrado.</p>
          </div>
        ) : (
          filtered.map((combo, idx) => (
            <button
              key={combo.id}
              onClick={() => handleSelect(combo.id)}
              className="w-full p-4 rounded-2xl border border-border bg-card/50 premium-card hover:border-primary/20 text-left group fade-up"
              style={{ animationDelay: `${Math.min(idx * 40, 200)}ms` }}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary group-hover:scale-105 transition-transform">
                  <Package className="w-5 h-5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <h3 className="font-semibold text-foreground line-clamp-2 leading-snug">{combo.displayName}</h3>

                  {/* Display categories pills */}
                  {combo.displayCategories.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {combo.displayCategories.map(cat => (
                        <span key={cat} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-[10px] font-medium text-muted-foreground">
                          <Sparkles className="w-2.5 h-2.5" />
                          {cat}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {combo.durationMinutes} min
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-foreground">
                      <DollarSign className="w-3.5 h-3.5" />
                      {combo.price.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-muted-foreground/50 group-hover:text-foreground shrink-0 mt-3 icon-nudge" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
