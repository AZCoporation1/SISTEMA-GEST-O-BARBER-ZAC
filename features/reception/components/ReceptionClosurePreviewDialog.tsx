"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useReceptionClosurePreview, useReceptionMutations } from "../hooks/useReception"
import { receptionPeriodToISO } from "../services/receptionPeriodUtils"
import { AlertCircle, FileText } from "lucide-react"
import type { ReceptionStaff, ReceptionPeriod } from "../types"

interface ReceptionClosurePreviewDialogProps {
  isOpen: boolean
  onClose: () => void
  staff: ReceptionStaff | null
  currentPeriod: ReceptionPeriod | null
}

export function ReceptionClosurePreviewDialog({
  isOpen,
  onClose,
  staff,
  currentPeriod,
}: ReceptionClosurePreviewDialogProps) {
  const { loadPreview, previewData, isLoading: isLoadingPreview, error: previewError } = useReceptionClosurePreview()
  const { confirmClosure, isConfirmingClosure } = useReceptionMutations()
  const [notes, setNotes] = React.useState("")

  React.useEffect(() => {
    if (isOpen && staff && currentPeriod) {
      setNotes("")
      const iso = receptionPeriodToISO(currentPeriod)
      loadPreview({
        staffId: staff.id,
        periodStart: iso.start,
        periodEnd: iso.end,
      }).catch((err) => console.error("Error loading preview:", err))
    }
  }, [isOpen, staff, currentPeriod, loadPreview])

  const handleConfirm = async () => {
    const data = previewData as any
    if (!staff || !currentPeriod || !data) return

    const { summary, advances, draftClosure, legitText } = data
    if (summary.salaryAmount <= 0) {
      alert("Não é possível fechar o período sem salário definido.")
      return
    }

    const iso = receptionPeriodToISO(currentPeriod)
    const activeAdvanceIds = (advances || [])
      .filter((a: any) => a.status === "active")
      .map((a: any) => a.id)

    try {
      await confirmClosure({
        staff_id: staff.id,
        closure_id: draftClosure?.id || "",
        period_start: iso.start,
        period_end: iso.end,
        salary_amount: summary.salaryAmount,
        advances_total: summary.advancesTotal + summary.stockWithdrawalsTotal,
        adjustments_total: summary.adjustmentsTotal,
        net_payable: summary.netPayable,
        legit_text: legitText,
        snapshot_json: {
          salaryAmount: summary.salaryAmount,
          advancesTotal: summary.advancesTotal,
          stockWithdrawalsTotal: summary.stockWithdrawalsTotal,
          adjustmentsTotal: summary.adjustmentsTotal,
          netPayable: summary.netPayable,
          advancesCount: summary.advancesCount,
          generatedAt: new Date().toISOString(),
          advancesList: advances,
        },
        advance_ids: activeAdvanceIds,
        notes: notes.trim() || null,
      })
      onClose()
    } catch (err) {
      console.error(err)
    }
  }

  if (!staff || !currentPeriod) return null

  const data = previewData as any
  const summary = data?.summary
  const hasSalary = summary ? summary.salaryAmount > 0 : false

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Fechamento de Período</DialogTitle>
          <DialogDescription>
            Confirme as contas do período de <strong>{currentPeriod.label}</strong> para <strong>{staff.display_name}</strong>.
          </DialogDescription>
        </DialogHeader>

        {isLoadingPreview ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--accent)] border-t-transparent" />
            <span className="text-xs text-[var(--text-secondary)]">Calculando folha do período...</span>
          </div>
        ) : previewError ? (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-[var(--danger)] flex items-center gap-2 my-4">
            <AlertCircle className="size-4" />
            <span>Erro ao carregar prévia: {previewError.message || "Erro desconhecido"}</span>
          </div>
        ) : data ? (
          <div className="space-y-4 py-2">
            {/* Warning Alert if Salary is not defined */}
            {!hasSalary && (
              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-600 dark:text-yellow-400 flex items-start gap-2">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold block">Atenção: Salário não definido!</span>
                  <span>
                    O funcionário não possui salário definido para esta quinzena. O fechamento não pode ser confirmado com valor zero. Clique em "Ajustar Salário" no painel principal primeiro.
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Resumo Financeiro */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Resumo de Contas</h3>
                <div className="rounded-lg border border-[var(--border-strong)] divide-y divide-[var(--border)] overflow-hidden text-xs">
                  <div className="flex justify-between px-3 py-2.5 bg-[var(--bg-elevated)]">
                    <span className="text-[var(--text-secondary)] font-medium">Salário da Quinzena</span>
                    <span className="font-bold text-[var(--text-primary)]">
                      R$ {summary?.salaryAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between px-3 py-2.5">
                    <span className="text-[var(--text-secondary)]">Adiantamentos (Dinheiro/PIX)</span>
                    <span className="font-semibold text-[var(--danger)]">
                      - R$ {summary?.advancesTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between px-3 py-2.5">
                    <span className="text-[var(--text-secondary)]">Retiradas de Estoque</span>
                    <span className="font-semibold text-[var(--danger)]">
                      - R$ {summary?.stockWithdrawalsTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {summary?.adjustmentsTotal !== 0 && (
                    <div className="flex justify-between px-3 py-2.5">
                      <span className="text-[var(--text-secondary)]">Ajustes / Créditos</span>
                      <span className={`font-semibold ${summary!.adjustmentsTotal > 0 ? "text-[var(--accent)]" : "text-[var(--danger)]"}`}>
                        R$ {summary?.adjustmentsTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between px-3 py-3 bg-[var(--accent)]/10 font-bold text-sm">
                    <span className="text-[var(--text-primary)]">Total Líquido Devido</span>
                    <span className="text-[var(--text-primary)]">
                      R$ {summary?.netPayable.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="closureNotes" className="text-xs font-medium text-[var(--text-secondary)]">Observações do Fechamento</label>
                  <textarea
                    id="closureNotes"
                    placeholder="Adicione observações complementares a este fechamento..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full min-h-[70px] rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                    disabled={isConfirmingClosure}
                  />
                </div>
              </div>

              {/* Legit Receipt Preview */}
              <div className="space-y-2">
                <div className="flex items-center gap-1 text-sm font-semibold text-[var(--text-primary)]">
                  <FileText className="size-4" />
                  <span>Visualização do Recibo</span>
                </div>
                <pre className="w-full h-[220px] rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-3 text-[10px] font-mono text-[var(--text-secondary)] overflow-y-auto whitespace-pre leading-relaxed select-all">
                  {data.legitText}
                </pre>
                <p className="text-[10px] text-[var(--text-muted)] text-right">Dica: clique três vezes na caixa para copiar tudo.</p>
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isConfirmingClosure || isLoadingPreview}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isConfirmingClosure || isLoadingPreview || !hasSalary || !previewData}
          >
            {isConfirmingClosure ? "Fechando..." : "Confirmar Fechamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
