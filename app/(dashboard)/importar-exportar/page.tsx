'use client'

import { FileUp, FileDown, Upload, Download } from 'lucide-react'
import { ImportWizard } from '@/features/import-export/components/ImportWizard'

export default function ImportarExportarPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Importar / Exportar</h1>
          <p className="page-subtitle">Importe dados CSV/XLSX com validação e exporte relatórios</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Import Section */}
        <div className="section-card bg-transparent border-none p-0 shadow-none overflow-visible">
           <ImportWizard />
        </div>

        {/* Export Section Info */}
        <div className="section-card">
          <div className="section-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Download size={16} style={{ color: 'var(--accent-gold)' }} />
              <span className="section-card-title">Exportações Simplificadas</span>
            </div>
          </div>
          <div className="section-card-body">
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
              Para exportar seus dados com segurança (em XLSX, CSV ou PDF), basta <b>acessar o módulo respectivo no menu lateral</b>.
              Os botões de exportação estarão localizados no canto superior direito ao lado de "Novo", permitindo que você aplique os mesmos filtros de tela para seu relatório.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
