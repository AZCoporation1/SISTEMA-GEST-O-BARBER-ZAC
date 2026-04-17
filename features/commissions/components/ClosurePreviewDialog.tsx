"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { confirmClosure, payClosureViaCaixa, payClosureViaPix } from "../actions/professionals.actions"
import { formatCurrencyBR, formatDateBR } from "../services/periodUtils"
import { ADVANCE_STATUS_LABELS } from "../types"
import type { ConfirmClosureInput } from "../types"
import { CheckCircle, Copy, Wallet, CreditCard, FileText } from "lucide-react"

interface ClosurePreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  previewData: any // from generateClosurePreview
  periodStart: string
  periodEnd: string
  paymentDate: string
}

export function ClosurePreviewDialog({
  open,
  onOpenChange,
  previewData,
  periodStart,
  periodEnd,
  paymentDate,
}: ClosurePreviewDialogProps) {
  const [copied, setCopied] = useState(false)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const confirmMutation = useMutation({
    mutationFn: (data: ConfirmClosureInput) => confirmClosure(data),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ["professionalClosures"] })
        queryClient.invalidateQueries({ queryKey: ["professionalAdvances"] })
        queryClient.invalidateQueries({ queryKey: ["professionals"] })
        toast({ title: "Fechamento confirmado!", description: "O fechamento foi salvo com sucesso." })
        onOpenChange(false)
      } else {
        toast({ title: "Erro", description: res.error, variant: "destructive" })
      }
    }
  })

  if (!previewData) return null

  const {
    professional,
    grossTotal,
    salesCount,
    servicesCount,
    productsCount,
    itemsQuantity,
    ticketMedio,
    commissionPercent,
    barberShare,
    barbershopShare,
    advances,
    advancesTotal,
    deferredItems,
    deferredTotal,
    netPayable,
    legitText,
  } = previewData

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(legitText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({ title: "Copiado!", description: "Legit copiada para a área de transferência." })
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" })
    }
  }

  const handleConfirm = () => {
    const input: ConfirmClosureInput = {
      professional_id: professional.id,
      period_start: periodStart,
      period_end: periodEnd,
      payment_reference_date: paymentDate,
      gross_total: grossTotal,
      commission_percent_snapshot: commissionPercent,
      barber_share: barberShare,
      barbershop_share: barbershopShare,
      advances_total: advancesTotal,
      deferred_total: deferredTotal,
      net_payable: netPayable,
      legit_text: legitText,
      snapshot_json: {
        salesCount,
        servicesCount,
        productsCount,
        itemsQuantity,
        ticketMedio,
        advances: advances.map((a: any) => ({ id: a.id, description: a.description, total_amount: a.total_amount })),
        deferredItems: deferredItems.map((a: any) => ({ id: a.id, description: a.description, total_amount: a.total_amount })),
      },
      advance_ids: advances.map((a: any) => a.id),
    }
    confirmMutation.mutate(input)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText size={18} />
            Prévia de Fechamento
          </DialogTitle>
          <DialogDescription>
            {professional.display_name || professional.name} — Período {formatDateBR(periodStart)} ao dia {formatDateBR(periodEnd)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard label="Atendimentos" value={salesCount.toString()} />
            <MetricCard label="Serviços" value={servicesCount.toString()} />
            <MetricCard label="Produtos" value={productsCount.toString()} />
            <MetricCard label="Ticket Médio" value={`R$ ${formatCurrencyBR(ticketMedio)}`} />
          </div>

          {/* Financial Breakdown */}
          <div className="section-card">
            <div className="section-card-header">
              <h3 className="section-card-title">Cálculo Financeiro</h3>
            </div>
            <div className="section-card-body space-y-3">
              <Row label="Total Bruto" value={`R$ ${formatCurrencyBR(grossTotal)}`} bold />
              <Row label={`Porcentagem: ${commissionPercent}%`} value="" />
              <Row label="Total Barbearia" value={`R$ ${formatCurrencyBR(barbershopShare)}`} />
              <Row label="Total Barbeiro" value={`R$ ${formatCurrencyBR(barberShare)}`} highlight />
              <div className="border-t border-[var(--border)] pt-3">
                <Row label="Pego (Adiantamentos)" value={`- R$ ${formatCurrencyBR(advancesTotal)}`} danger />
                {advances.length > 0 && (
                  <div className="ml-4 mt-1 space-y-1">
                    {advances.map((a: any) => (
                      <p key={a.id} className="text-xs text-[var(--text-secondary)]">
                        • {a.description} — R$ {formatCurrencyBR(Number(a.total_amount))}
                      </p>
                    ))}
                  </div>
                )}
                {deferredItems.length > 0 && (
                  <div className="ml-4 mt-2">
                    <p className="text-xs font-medium text-[var(--warning)]">Diferidos (mês que vem):</p>
                    {deferredItems.map((a: any) => (
                      <p key={a.id} className="text-xs text-[var(--text-secondary)] ml-2">
                        • {a.description} — R$ {formatCurrencyBR(Number(a.total_amount))}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t border-[var(--border)] pt-3">
                <Row label="A PAGAR" value={`R$ ${formatCurrencyBR(netPayable)}`} bold highlight />
              </div>
            </div>
          </div>

          {/* Legit Text Preview */}
          <div className="section-card">
            <div className="section-card-header">
              <h3 className="section-card-title">Legit de Pagamento</h3>
              <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                <Copy size={12} />
                {copied ? 'Copiado!' : 'Copiar'}
              </Button>
            </div>
            <div className="section-card-body">
              <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono text-[var(--text-primary)] bg-[var(--bg-base)] p-4 rounded-lg border border-[var(--border)]">
                {legitText}
              </pre>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="btn-primary"
            disabled={confirmMutation.isPending}
            onClick={handleConfirm}
          >
            <CheckCircle size={14} className="mr-1.5" />
            {confirmMutation.isPending ? 'Confirmando...' : 'Confirmar Fechamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Helper sub-components ──

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">{label}</p>
      <p className="text-lg font-bold text-[var(--text-primary)] mt-1">{value}</p>
    </div>
  )
}

function Row({ label, value, bold, highlight, danger }: {
  label: string
  value: string
  bold?: boolean
  highlight?: boolean
  danger?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${bold ? 'font-semibold' : ''} text-[var(--text-secondary)]`}>{label}</span>
      <span className={`text-sm font-medium ${
        highlight ? 'text-emerald-500 font-bold' :
        danger ? 'text-red-400' :
        'text-[var(--text-primary)]'
      }`}>
        {value}
      </span>
    </div>
  )
}

// ── Legit Viewer (for historical closures) ──

interface LegitViewerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  legitText: string
  professionalName: string
  periodLabel: string
}

export function LegitViewer({ open, onOpenChange, legitText, professionalName, periodLabel }: LegitViewerProps) {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(legitText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({ title: "Copiado!" })
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Legit de Pagamento</DialogTitle>
          <DialogDescription>
            {professionalName} — {periodLabel}
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono text-[var(--text-primary)] bg-[var(--bg-base)] p-4 rounded-lg border border-[var(--border)]">
            {legitText || 'Sem texto de legit disponível.'}
          </pre>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCopy} className="gap-1.5">
            <Copy size={12} />
            {copied ? 'Copiado!' : 'Copiar Legit'}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
