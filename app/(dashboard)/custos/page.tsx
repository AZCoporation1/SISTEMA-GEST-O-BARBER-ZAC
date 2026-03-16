import { Receipt, Plus } from 'lucide-react'

export default function CustosPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Custos</h1>
          <p className="page-subtitle">Gestão de custos fixos e variáveis</p>
        </div>
        <div className="page-actions">
          <a href="/custos/novo" style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            background: 'var(--accent-gold)', borderRadius: 6,
            fontSize: 12, fontWeight: 600, color: '#1a1a28', textDecoration: 'none',
          }}>
            <Plus size={14} /> Novo Custo
          </a>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Custos Fixos */}
        <div className="section-card">
          <div className="section-card-header">
            <span className="section-card-title">Custos Fixos</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Mensais recorrentes</span>
          </div>
          <div className="section-card-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Recorrência</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={3}>
                    <div className="empty-state" style={{ padding: '32px 16px' }}>
                      <Receipt size={28} className="empty-state-icon" />
                      <p className="empty-state-description">Nenhum custo fixo cadastrado</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Custos Variáveis */}
        <div className="section-card">
          <div className="section-card-header">
            <span className="section-card-title">Custos Variáveis</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Por período</span>
          </div>
          <div className="section-card-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Data</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={3}>
                    <div className="empty-state" style={{ padding: '32px 16px' }}>
                      <Receipt size={28} className="empty-state-icon" />
                      <p className="empty-state-description">Nenhum custo variável no período</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
