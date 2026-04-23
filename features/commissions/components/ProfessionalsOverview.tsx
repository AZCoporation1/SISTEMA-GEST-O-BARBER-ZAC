"use client"

import { useState, useMemo } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useProfessionals, useProfessionalClosures } from "../hooks/useProfessionals"
import { getProfessionalSales, getProfessionalAdvances } from "../services/professionals.service"
import { generateClosurePreview, payClosureViaCaixa, payClosureViaPix, cancelClosure } from "../actions/professionals.actions"
import { getCurrentFortnightPeriod, getRecentPeriods, formatCurrencyBR, formatDateBR, formatFullDateBR, periodToISO } from "../services/periodUtils"
import { RegisterAdvanceDialog } from "./RegisterAdvanceDialog"
import { ClosurePreviewDialog, LegitViewer } from "./ClosurePreviewDialog"
import { CLOSURE_STATUS_LABELS, CLOSURE_STATUS_COLORS } from "../types"
import { KPICard } from "@/components/ui/kpi-card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { useQuery } from "@tanstack/react-query"
import {
  Scissors,
  DollarSign,
  TrendingDown,
  Calendar,
  Plus,
  FileText,
  Eye,
  Wallet,
  CreditCard,
  XCircle,
  Users,
  BarChart3,
} from "lucide-react"
import type { FortnightPeriod } from "../services/periodUtils"

export function ProfessionalsOverview() {
  // ── State ──
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState(0)
  const [advanceDialog, setAdvanceDialog] = useState<{ open: boolean; profId: string; profName: string }>({ open: false, profId: '', profName: '' })
  const [closurePreview, setClosurePreview] = useState<{ open: boolean; data: any }>({ open: false, data: null })
  const [legitViewer, setLegitViewer] = useState<{ open: boolean; text: string; name: string; label: string }>({ open: false, text: '', name: '', label: '' })
  const [isGenerating, setIsGenerating] = useState<string | null>(null)
  const [cancelClosureDialog, setCancelClosureDialog] = useState<{ open: boolean; closureId: string; status: string }>({ open: false, closureId: '', status: '' })

  const periods = useMemo(() => getRecentPeriods(8), [])
  const currentPeriod = periods[selectedPeriodIdx]
  const periodISO = periodToISO(currentPeriod)

  // ── Data ──
  const { data: professionals, isLoading: profsLoading } = useProfessionals()
  const { data: closures, isLoading: closuresLoading } = useProfessionalClosures()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Fetch sales + advances for ALL professionals in current period
  const { data: allMetrics } = useQuery({
    queryKey: ["allProfMetrics", professionals?.map(p => p.id), periodISO.start, periodISO.end],
    queryFn: async () => {
      if (!professionals || professionals.length === 0) return {}
      const results: Record<string, any> = {}
      for (const prof of professionals) {
        const [sales, advances] = await Promise.all([
          getProfessionalSales(prof.id, periodISO.start, periodISO.end),
          getProfessionalAdvances(prof.id, periodISO.start, periodISO.end, 'active'),
        ])
        const commissionPercent = Number(prof.default_commission_percent) || 47
        const barberShare = sales.grossTotal * (commissionPercent / 100)
        const barbershopShare = sales.grossTotal - barberShare
        const advancesTotal = advances
          .filter(a => !a.carry_over_to_next_period)
          .reduce((sum, a) => sum + Number(a.total_amount), 0)
        results[prof.id] = {
          ...sales,
          commissionPercent,
          barberShare,
          barbershopShare,
          advancesTotal,
          netPayable: barberShare - advancesTotal,
          advancesCount: advances.length,
        }
      }
      return results
    },
    enabled: !!professionals && professionals.length > 0,
  })

  // ── KPI Aggregates ──
  const totalGross = Object.values(allMetrics || {}).reduce((s: number, m: any) => s + (m?.grossTotal || 0), 0)
  const totalBarberShare = Object.values(allMetrics || {}).reduce((s: number, m: any) => s + (m?.barberShare || 0), 0)
  const totalAdvances = Object.values(allMetrics || {}).reduce((s: number, m: any) => s + (m?.advancesTotal || 0), 0)
  const totalAtendimentos = Object.values(allMetrics || {}).reduce((s: number, m: any) => s + (m?.salesCount || 0), 0)

  // ── Closure Preview ──
  const handleGenerateClosure = async (profId: string) => {
    setIsGenerating(profId)
    try {
      const result = await generateClosurePreview(profId, periodISO.start, periodISO.end)
      if (result.success) {
        setClosurePreview({ open: true, data: result.data })
      } else {
        toast({ title: "Erro", description: result.error, variant: "destructive" })
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" })
    } finally {
      setIsGenerating(null)
    }
  }

  // ── Pay / Cancel Closure mutations ──
  const payViaCaixaMutation = useMutation({
    mutationFn: (id: string) => payClosureViaCaixa(id),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ["professionalClosures"] })
        toast({ title: "Pago via Caixa!" })
      } else {
        toast({ title: "Erro", description: res.error, variant: "destructive" })
      }
    }
  })

  const payViaPixMutation = useMutation({
    mutationFn: (id: string) => payClosureViaPix(id),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ["professionalClosures"] })
        toast({ title: "Pago via PIX!" })
      } else {
        toast({ title: "Erro", description: res.error, variant: "destructive" })
      }
    }
  })

  const cancelClosureMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => cancelClosure(id, reason),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ["professionalClosures"] })
        queryClient.invalidateQueries({ queryKey: ["professionalAdvances"] })
        toast({ title: "Fechamento cancelado" })
        setCancelClosureDialog({ open: false, closureId: '', status: '' })
      } else {
        toast({ title: "Erro", description: res.error, variant: "destructive" })
      }
    }
  })

  // ── Closures Table Columns ──
  const closureColumns: ColumnDef<any>[] = [
    {
      accessorKey: "professional",
      header: "Profissional",
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.professional?.display_name || row.original.professional?.name || '—'}
        </span>
      ),
    },
    {
      accessorKey: "period",
      header: "Período",
      cell: ({ row }) => (
        <span className="text-xs">
          {formatFullDateBR(row.original.period_start)} — {formatFullDateBR(row.original.period_end)}
        </span>
      ),
    },
    {
      accessorKey: "net_payable",
      header: "Líquido",
      cell: ({ row }) => (
        <span className="font-bold text-emerald-500">R$ {formatCurrencyBR(row.original.net_payable)}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${CLOSURE_STATUS_COLORS[row.original.status] || ''}`}>
          {CLOSURE_STATUS_LABELS[row.original.status] || row.original.status}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          {row.original.legit_text && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setLegitViewer({
                open: true,
                text: row.original.legit_text,
                name: row.original.professional?.display_name || row.original.professional?.name || '',
                label: `${formatFullDateBR(row.original.period_start)} — ${formatFullDateBR(row.original.period_end)}`,
              })}
            >
              <Eye size={12} className="mr-1" /> Legit
            </Button>
          )}
          {row.original.status === 'confirmed' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-emerald-500 hover:text-emerald-400"
                disabled={payViaCaixaMutation.isPending}
                onClick={() => payViaCaixaMutation.mutate(row.original.id)}
              >
                <Wallet size={12} className="mr-1" /> Caixa
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-blue-500 hover:text-blue-400"
                disabled={payViaPixMutation.isPending}
                onClick={() => payViaPixMutation.mutate(row.original.id)}
              >
                <CreditCard size={12} className="mr-1" /> PIX
              </Button>
            </>
          )}
          {(row.original.status === 'confirmed' || row.original.status === 'paid') && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-red-500 hover:text-red-400"
              onClick={() => setCancelClosureDialog({
                open: true,
                closureId: row.original.id,
                status: row.original.status,
              })}
            >
              <XCircle size={12} className="mr-1" />
              {row.original.status === 'paid' ? 'Reverter' : 'Cancelar'}
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Profissionais & Comissões</h1>
          <p className="page-subtitle">Gestão de produção, adiantamentos e fechamentos quinzenais.</p>
        </div>
        <div className="page-actions flex items-center gap-2 flex-wrap">
          <Select
            value={selectedPeriodIdx.toString()}
            onValueChange={(v) => setSelectedPeriodIdx(parseInt(v))}
          >
            <SelectTrigger className="w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periods.map((p, i) => (
                <SelectItem key={i} value={i.toString()}>
                  {i === 0 ? '⏱ Atual: ' : ''}{p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <KPICard
          title="Faturamento Bruto"
          value={`R$ ${formatCurrencyBR(totalGross)}`}
          icon={<DollarSign className="text-emerald-500" />}
          description={`${totalAtendimentos} atendimentos no período`}
        />
        <KPICard
          title="Total Barbeiros"
          value={`R$ ${formatCurrencyBR(totalBarberShare)}`}
          icon={<Scissors />}
          description="Valor total a pagar"
        />
        <KPICard
          title="Total Adiantamentos"
          value={`R$ ${formatCurrencyBR(totalAdvances)}`}
          icon={<TrendingDown className="text-red-400" />}
          description="Pegos no período"
        />
        <KPICard
          title="Próximo Pagamento"
          value={formatFullDateBR(currentPeriod.paymentDate)}
          icon={<Calendar className="text-blue-400" />}
          description={`Período: ${currentPeriod.label}`}
        />
      </div>

      {/* Professional Cards */}
      <div>
        <h2 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4 flex items-center gap-2">
          <Users size={14} />
          Equipe — {currentPeriod.label}
        </h2>
        {profsLoading ? (
          <div className="h-40 flex items-center justify-center text-[var(--text-muted)]">Carregando profissionais...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {(professionals || []).map((prof) => {
              const metrics = allMetrics?.[prof.id]
              const displayName = prof.display_name || prof.name
              return (
                <div key={prof.id} className="section-card hover:border-[var(--border-strong)] transition-all">
                  <div className="section-card-header">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[var(--gradient-brand-subtle)] flex items-center justify-center text-white font-bold text-sm">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="section-card-title">{displayName}</h3>
                        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                          {prof.name} · {prof.default_commission_percent}%
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="section-card-body space-y-3">
                    {metrics ? (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <MiniMetric label="Bruto" value={`R$ ${formatCurrencyBR(metrics.grossTotal)}`} />
                          <MiniMetric label="Parte Barbeiro" value={`R$ ${formatCurrencyBR(metrics.barberShare)}`} highlight />
                          <MiniMetric label="Pegos" value={`R$ ${formatCurrencyBR(metrics.advancesTotal)}`} danger />
                          <MiniMetric label="A Pagar" value={`R$ ${formatCurrencyBR(metrics.netPayable)}`} success />
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                          <span>{metrics.salesCount} atend.</span>
                          <span>·</span>
                          <span>{metrics.servicesCount} serv.</span>
                          <span>·</span>
                          <span>{metrics.productsCount} prod.</span>
                          <span>·</span>
                          <span>TM: R$ {formatCurrencyBR(metrics.ticketMedio)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="h-20 flex items-center justify-center text-xs text-[var(--text-muted)]">
                        Carregando...
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs h-8"
                        onClick={() => setAdvanceDialog({ open: true, profId: prof.id, profName: displayName })}
                      >
                        <Plus size={12} className="mr-1" /> Registrar Pego
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs h-8 border-emerald-600/30 text-emerald-500 hover:bg-emerald-950/20"
                        disabled={isGenerating === prof.id}
                        onClick={() => handleGenerateClosure(prof.id)}
                      >
                        <FileText size={12} className="mr-1" />
                        {isGenerating === prof.id ? 'Gerando...' : 'Fechar Período'}
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Closures History */}
      <div>
        <h2 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4 flex items-center gap-2">
          <BarChart3 size={14} />
          Histórico de Fechamentos
        </h2>
        <div className="data-table-wrapper p-4">
          {closuresLoading ? (
            <div className="h-32 flex items-center justify-center text-[var(--text-muted)]">Carregando...</div>
          ) : (closures || []).length === 0 ? (
            <div className="empty-state">
              <FileText className="empty-state-icon" />
              <h3 className="empty-state-title">Nenhum fechamento registrado</h3>
              <p className="empty-state-description">Gere o primeiro fechamento de período para um profissional.</p>
            </div>
          ) : (
            <DataTable columns={closureColumns} data={closures || []} />
          )}
        </div>
      </div>

      {/* Dialogs */}
      <RegisterAdvanceDialog
        open={advanceDialog.open}
        onOpenChange={(open) => setAdvanceDialog(prev => ({ ...prev, open }))}
        professionalId={advanceDialog.profId}
        professionalName={advanceDialog.profName}
      />

      <ClosurePreviewDialog
        open={closurePreview.open}
        onOpenChange={(open) => setClosurePreview(prev => ({ ...prev, open }))}
        previewData={closurePreview.data}
        periodStart={periodISO.start}
        periodEnd={periodISO.end}
        paymentDate={currentPeriod.paymentDate.toISOString()}
      />

      <LegitViewer
        open={legitViewer.open}
        onOpenChange={(open) => setLegitViewer(prev => ({ ...prev, open }))}
        legitText={legitViewer.text}
        professionalName={legitViewer.name}
        periodLabel={legitViewer.label}
      />

      {/* Cancel/Reverse Closure Confirmation Dialog */}
      <CancelClosureConfirmDialog
        open={cancelClosureDialog.open}
        onOpenChange={(open) => setCancelClosureDialog(prev => ({ ...prev, open }))}
        closureId={cancelClosureDialog.closureId}
        isPaid={cancelClosureDialog.status === 'paid'}
        onConfirm={(reason) => cancelClosureMutation.mutate({ id: cancelClosureDialog.closureId, reason })}
        isPending={cancelClosureMutation.isPending}
      />
    </div>
  )
}

// ── Mini metric helper ──

function MiniMetric({ label, value, highlight, success, danger }: {
  label: string
  value: string
  highlight?: boolean
  success?: boolean
  danger?: boolean
}) {
  return (
    <div className="p-2.5 rounded-lg bg-[var(--bg-base)] border border-[var(--border)]">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
      <p className={`text-sm font-bold mt-0.5 ${
        success ? 'text-emerald-500' :
        danger ? 'text-red-400' :
        highlight ? 'text-[var(--accent-light)]' :
        'text-[var(--text-primary)]'
      }`}>{value}</p>
    </div>
  )
}

// ── Cancel/Reverse Closure Confirm Dialog ──

function CancelClosureConfirmDialog({ open, onOpenChange, closureId, isPaid, onConfirm, isPending }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  closureId: string
  isPaid: boolean
  onConfirm: (reason: string) => void
  isPending: boolean
}) {
  const [reason, setReason] = useState('')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-400">
            <XCircle size={18} />
            {isPaid ? 'Reverter Fechamento Pago' : 'Cancelar Fechamento'}
          </DialogTitle>
          <DialogDescription>
            {isPaid
              ? 'Esta ação irá criar movimentos inversos no caixa e fluxo financeiro para reverter o pagamento. Os adiantamentos serão revertidos para status ativo.'
              : 'Esta ação irá cancelar o fechamento e reverter os adiantamentos para status ativo.'
            }
          </DialogDescription>
        </DialogHeader>
        <div>
          <label className="text-xs uppercase font-semibold text-[var(--text-secondary)]">Motivo *</label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Descreva o motivo do cancelamento/estorno..."
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button
            variant="destructive"
            disabled={isPending || reason.length < 3}
            onClick={() => onConfirm(reason)}
          >
            {isPending ? 'Processando...' : isPaid ? 'Confirmar Reversão' : 'Confirmar Cancelamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
