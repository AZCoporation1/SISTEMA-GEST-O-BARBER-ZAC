"use client"

import { useAuditLogs } from "../hooks/useAuditLogs"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { AuditLogRow } from "@/types/supabase"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { ShieldCheck, FileDown, AlertCircle } from "lucide-react"
import { ExportDialog } from "@/features/import-export/components/ExportDialog"

export function AuditDashboard() {
  const { data: logs, isLoading } = useAuditLogs()

  const columns: ColumnDef<AuditLogRow>[] = [
    {
      accessorKey: "created_at",
      header: "Data / Hora",
      cell: ({ row }) => {
        const date = new Date(row.original.created_at)
        return <span className="text-muted-foreground">{format(date, "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
      }
    },
    {
      id: "user_name",
      header: "Usuário",
      cell: ({ row }) => {
        const actor = row.original.actor as any
        return <span className="font-medium">{actor?.full_name || "Sistema"}</span>
      }
    },
    {
      accessorKey: "action",
      header: "Ação",
      cell: ({ row }) => {
        const action = row.original.action
        const badgeColor = 
          action === 'INSERT' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' :
          action === 'UPDATE' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' :
          action === 'DELETE' ? 'bg-red-100 text-red-700 hover:bg-red-200' :
          'bg-gray-100 text-gray-700 hover:bg-gray-200'

        return <Badge variant="secondary" className={`font-semibold text-[10px] uppercase tracking-wider ${badgeColor}`}>{action}</Badge>
      }
    },
    {
      accessorKey: "entity_type",
      header: "Entidade",
      cell: ({ row }) => {
        return <span className="uppercase text-[11px] text-muted-foreground font-semibold tracking-wider">{row.original.entity_type}</span>
      }
    },
    {
      id: "observation",
      accessorFn: (row: any) => row.context?.observation || "-",
      header: "Observação",
      cell: ({ row }) => {
        const ctx: any = row.original.context || {}
        return <span className="text-sm">{ctx.observation || "-"}</span>
      }
    },
    {
      id: "source",
      header: "Origem",
      cell: ({ row }) => {
        const ctx: any = row.original.context || {}
        const src = ctx.source || 'web'
        return <Badge variant="outline" className="text-[10px] uppercase">{src}</Badge>
      }
    }
  ]

  return (
    <div className="space-y-6">
      <div className="page-header items-start sm:items-center">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-[#c9a84c]" />
            Auditoria & Logs
          </h1>
          <p className="page-subtitle">Rastreamento de ponta a ponta de todas as ações e mutações no sistema.</p>
        </div>
        
        <div className="page-actions flex flex-wrap items-center gap-2 mt-4 sm:mt-0">
          <ExportDialog data={logs || []} filename="auditoria-sistema" title="Logs de Auditoria do Sistema" buttonText="Exportar Logs" />
        </div>
      </div>

      <div className="section-card">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
            <div className="w-6 h-6 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
            <p>Carregando histórico restrito...</p>
          </div>
        ) : !logs || logs.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-4 bg-muted/10 rounded-lg border border-dashed">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Nenhum evento registrado.</p>
              <p className="text-sm">As ações do sistema começarão a aparecer aqui.</p>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <DataTable 
              columns={columns} 
              data={logs} 
              searchKey="observation"
              searchPlaceholder="Buscar na observação ou entidade..."
            />
          </div>
        )}
      </div>
    </div>
  )
}
