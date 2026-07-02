"use client"

import { Trophy, Rocket, Target, Medal } from 'lucide-react'
import { KPICard } from "@/components/ui/kpi-card"

export default function GamificacaoPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Gamificação</h1>
          <p className="page-subtitle">Sistema de engajamento e recompensas da equipe</p>
        </div>
      </div>

      <div className="section-card">
        <div className="section-card-header">
          <span className="section-card-title flex items-center gap-2">
            <Rocket size={16} /> Em Preparação
          </span>
        </div>
        <div className="section-card-body">
          <div className="flex flex-col items-center justify-center py-12 text-center max-w-2xl mx-auto">
            <div className="w-16 h-16 bg-[var(--accent-subtle)] rounded-full flex items-center justify-center mb-6">
              <Trophy size={32} className="text-[var(--accent)]" />
            </div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">
              A Gamificação está chegando!
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-8">
              Estamos preparando um sistema completo de gamificação para engajar e reconhecer a equipe. 
              Em breve, o desempenho operacional (como o cumprimento do 5S) e as metas de vendas serão 
              revertidos em pontos de experiência (XP), níveis e recompensas reais.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-base)] flex flex-col items-center gap-3">
                <Target size={24} className="text-[var(--primary)]" />
                <span className="text-sm font-semibold">Missões e Metas</span>
              </div>
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-base)] flex flex-col items-center gap-3">
                <Medal size={24} className="text-[var(--warning)]" />
                <span className="text-sm font-semibold">Níveis e Badges</span>
              </div>
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-base)] flex flex-col items-center gap-3">
                <Trophy size={24} className="text-[var(--accent)]" />
                <span className="text-sm font-semibold">Recompensas</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
