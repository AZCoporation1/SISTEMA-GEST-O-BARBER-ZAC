"use client"

import { useState } from "react"
import { useActiveCashSession, useCashDependencies, useCashMutations } from "../hooks/useCash"
import { DataTable } from "@/components/ui/data-table"
import { KPICard } from "@/components/ui/kpi-card"
import { Button } from "@/components/ui/button"
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription
} from "@/components/ui/dialog"
import { OpenSessionForm, CloseSessionForm, CashEntryForm } from "./CashForms"
import { LockOpen, Lock, Plus, ArrowDownRight, ArrowUpRight } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { ExportDialog } from "@/features/import-export/components/ExportDialog"

const ENTRY_LABELS: Record<string, string> = {
  "opening_balance": "Abertura de Caixa",
  "sale_income": "Venda Gerada",
  "other_income": "Outras Receitas",
  "expense": "Despesa Diária",
  "withdrawal": "Retirada/Sangria",
  "reinforcement": "Suprimento de Caixa",
}

export function CashDashboardView() {
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false)
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false)
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false)

  const { data: activeSession, isLoading } = useActiveCashSession()
  const { data: paymentMethods } = useCashDependencies()
  const { openSession, isOpening, closeSession, isClosing, addEntry, isAdding } = useCashMutations()

  if (isLoading) return <div className="p-6 h-64 flex items-center justify-center">Buscando sessão...</div>

  if (!activeSession) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center border rounded-lg bg-card mt-6">
        <Lock className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
        <h3 className="text-2xl font-bold tracking-tight mb-2">O Caixa está Fechado</h3>
        <p className="text-muted-foreground mb-6 max-w-sm">Nenhuma operação financeira ou venda pode ser realizada no PDV enquanto o caixa não for aberto.</p>
        
        <Dialog open={isOpenModalOpen} onOpenChange={setIsOpenModalOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="h-14 px-8 text-lg"><LockOpen className="mr-2 h-5 w-5" /> Abrir Caixa Agora</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Abertura de Caixa</DialogTitle>
              <DialogDescription>Infome o valor inicial disponível para troco na gaveta física.</DialogDescription>
            </DialogHeader>
            <OpenSessionForm 
              isLoading={isOpening}
              onSubmit={async (data) => {
                await openSession(data)
                setIsOpenModalOpen(false)
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // Active Session calculations
  const totalIn = activeSession.entries?.filter(e => ["opening_balance", "sale_income", "other_income", "reinforcement"].includes(e.entry_type)).reduce((acc, curr) => acc + curr.amount, 0) || 0
  const totalOut = activeSession.entries?.filter(e => ["expense", "withdrawal"].includes(e.entry_type)).reduce((acc, curr) => acc + curr.amount, 0) || 0
  const currentExpected = totalIn - totalOut

  const columns = [
    {
      accessorKey: "occurred_at",
      header: "Hora",
      cell: ({ row }: any) => <span className="text-sm">{format(new Date(row.original.occurred_at), "HH:mm")}</span>
    },
    {
      accessorKey: "entry_type",
      header: "Operação",
      cell: ({ row }: any) => {
        const type = row.original.entry_type
        const isEntry = ["opening_balance", "sale_income", "other_income", "reinforcement"].includes(type)
        return (
          <Badge variant={isEntry ? "default" : "destructive"} className={isEntry ? "bg-emerald-600" : ""}>
            {isEntry ? <ArrowDownRight className="mr-1 h-3 w-3" /> : <ArrowUpRight className="mr-1 h-3 w-3" />}
            {ENTRY_LABELS[type] || type}
          </Badge>
        )
      }
    },
    {
      accessorKey: "category",
      header: "Categoria",
    },
    {
      accessorKey: "description",
      header: "Histórico",
      cell: ({ row }: any) => <span className="truncate max-w-[200px]" title={row.original.description}>{row.original.description}</span>
    },
    {
      accessorKey: "amount",
      header: "Valor (R$)",
      cell: ({ row }: any) => <span className="font-bold">{row.original.amount.toFixed(2)}</span>
    }
  ]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title text-emerald-600 dark:text-emerald-400">Caixa Aberto</h1>
          <p className="page-subtitle">
            Aberto por {activeSession.opened_by_user?.full_name || "Sistema"} às {format(new Date(activeSession.opened_at), "HH:mm", { locale: ptBR })}
          </p>
        </div>
        
        <div className="page-actions flex items-center gap-2">
          <ExportDialog data={activeSession.entries || []} filename={`relatorio-caixa-${activeSession.id?.split('-')[0]}`} title="Operações do Caixa" />
          <Dialog open={isEntryModalOpen} onOpenChange={setIsEntryModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Plus className="mr-2 h-4 w-4" /> Lançamento Avulso</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Lançamento Manual</DialogTitle>
                <DialogDescription>Registra uma sangria ou despesa de caixa.</DialogDescription>
              </DialogHeader>
              <CashEntryForm 
                sessionId={activeSession.id}
                paymentMethods={paymentMethods || []}
                isLoading={isAdding}
                onSubmit={async (data) => {
                  await addEntry(data)
                  setIsEntryModalOpen(false)
                }}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={isCloseModalOpen} onOpenChange={setIsCloseModalOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" disabled={isClosing}><Lock className="mr-2 h-4 w-4" /> Fechar Caixa</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Fechamento de Caixa</DialogTitle>
              </DialogHeader>
              <CloseSessionForm 
                currentBalance={currentExpected}
                isLoading={isClosing}
                onSubmit={async (data) => {
                  await closeSession({ id: activeSession.id, data })
                  setIsCloseModalOpen(false)
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="kpi-grid">
        <KPICard title="Entradas Hoje" value={`R$ ${totalIn.toFixed(2)}`} icon={<ArrowDownRight className="text-emerald-500" />} />
        <KPICard title="Saídas (Despesas/Sangrias)" value={`R$ ${totalOut.toFixed(2)}`} icon={<ArrowUpRight className="text-destructive" />} />
        <KPICard title="Saldo Atual Estimado" value={`R$ ${currentExpected.toFixed(2)}`} className="border-emerald-500 dark:border-emerald-800" icon={<LockOpen />} />
      </div>

      <div className="data-table-wrapper p-4">
        <h3 className="text-lg font-medium mb-4 px-2">Resumo das Movimentações do Turno</h3>
        <DataTable columns={columns} data={activeSession.entries || []} />
      </div>
    </div>
  )
} 3
