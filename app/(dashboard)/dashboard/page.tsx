import {
  Package,
  AlertTriangle,
  TrendingUp,
  Wallet,
  ShoppingCart,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Clock,
  Scissors,
} from 'lucide-react'
import { AlertsPanel } from '@/features/ai-operator/components/AlertsPanel'

export default function DashboardPage() {
  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Visão geral operacional — Instituto Barber Zac</p>
        </div>
        <div className="page-actions">
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Estoque (Custo)</span>
            <div className="kpi-icon"><Package size={16} /></div>
          </div>
          <div className="kpi-value">—</div>
          <div className="kpi-delta neutral">Calculando...</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Vendas Hoje</span>
            <div className="kpi-icon"><ShoppingCart size={16} /></div>
          </div>
          <div className="kpi-value">R$ 0,00</div>
          <div className="kpi-delta neutral">Sem vendas hoje</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Saldo do Caixa</span>
            <div className="kpi-icon"><Wallet size={16} /></div>
          </div>
          <div className="kpi-value">R$ 0,00</div>
          <div className="kpi-delta neutral">Caixa fechado</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Produtos Críticos</span>
            <div className="kpi-icon" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="kpi-value">0</div>
          <div className="kpi-delta neutral">produtos abaixo do mínimo</div>
        </div>
      </div>

      {/* Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Alertas de Estoque */}
        <div className="section-card border-none bg-transparent shadow-none p-0 overflow-visible">
           <AlertsPanel />
        </div>

        {/* Últimas Vendas */}
        <div className="section-card">
          <div className="section-card-header">
            <span className="section-card-title">Últimas Vendas</span>
            <a href="/vendas" style={{ fontSize: 11, color: 'var(--accent-gold)', fontWeight: 600, textDecoration: 'none' }}>
              Ver todas →
            </a>
          </div>
          <div className="section-card-body">
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <ShoppingCart size={32} style={{ color: 'var(--text-muted)' }} />
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Nenhuma venda registrada hoje
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        {/* Últimas Movimentações */}
        <div className="section-card">
          <div className="section-card-header">
            <span className="section-card-title">Últimas Movimentações</span>
            <a href="/movimentacoes" style={{ fontSize: 11, color: 'var(--accent-gold)', fontWeight: 600, textDecoration: 'none' }}>
              Ver todas →
            </a>
          </div>
          <div className="section-card-body" style={{ padding: 0 }}>
            <div className="empty-state">
              <Clock size={32} style={{ color: 'var(--text-muted)' }} />
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Nenhuma movimentação recente
              </p>
            </div>
          </div>
        </div>

        {/* Resumo Financeiro */}
        <div className="section-card">
          <div className="section-card-header">
            <span className="section-card-title">Resumo do Mês</span>
          </div>
          <div className="section-card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ArrowUp size={12} style={{ color: 'var(--success)' }} /> Receitas
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>R$ 0,00</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ArrowDown size={12} style={{ color: 'var(--danger)' }} /> Despesas
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>R$ 0,00</span>
              </div>
              <div style={{
                borderTop: '1px solid var(--border)',
                paddingTop: 12,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Resultado</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent-gold)' }}>R$ 0,00</span>
              </div>
              <a
                href="/fluxo-de-caixa"
                style={{
                  fontSize: 11,
                  color: 'var(--accent-gold)',
                  fontWeight: 600,
                  textDecoration: 'none',
                  textAlign: 'center',
                  marginTop: 4,
                }}
              >
                Ver fluxo completo →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
