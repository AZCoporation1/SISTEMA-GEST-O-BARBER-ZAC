"use client"

import * as React from "react"
import {
  useReceptionClosures,
  useReceptionAdvances,
  useReceptionMutations,
} from "../hooks/useReception"
import { receptionPeriodToISO, formatDateBR, formatCurrencyBR } from "../services/receptionPeriodUtils"
import {
  RECEPTION_ADVANCE_TYPE_LABELS,
  RECEPTION_CLOSURE_STATUS_COLORS,
  RECEPTION_CLOSURE_STATUS_LABELS,
  RECEPTION_ADVANCE_STATUS_LABELS,
  RECEPTION_ADVANCE_STATUS_COLORS,
} from "../types"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Trash2, AlertTriangle, FileText, Ban, HelpCircle, CheckCircle } from "lucide-react"
import type { ReceptionStaff, ReceptionPeriod, ReceptionClosure } from "../types"

interface ReceptionHistoryViewProps {
  staff: ReceptionStaff
  currentPeriod: ReceptionPeriod
  onPayClosure: (closure: ReceptionClosure) => void
}

export function ReceptionHistoryView({
  staff,
  currentPeriod,
  onPayClosure,
}: ReceptionHistoryViewProps) {
  const iso = receptionPeriodToISO(currentPeriod)
  const { data: closures, isLoading: isLoadingClosures } = useReceptionClosures(staff.id)
  const { data: advances, isLoading: isLoadingAdvances } = useReceptionAdvances(staff.id, iso.start, iso.end)
  const { cancelAdvance, isCancellingAdvance, cancelClosure, isCancellingClosure } = useReceptionMutations()

  const handleCancelAdvance = async (advanceId: string, desc: string) => {
    const reason = prompt(`Confirme o cancelamento do adiantamento "${desc}":\n\nPor que deseja cancelar?`)
    if (reason === null) return // cancelled prompt
    if (!reason.trim()) {
      alert("É necessário informar um motivo para o cancelamento.")
      return
    }

    try {
      await cancelAdvance({ advanceId, reason: reason.trim() })
    } catch (err) {
      console.error(err)
    }
  }

  const handleCancelClosure = async (closure: ReceptionClosure) => {
    const reason = prompt(`ATENÇÃO: Isso estornará todos os lançamentos financeiros/estoque vinculados ao pagamento deste período.\n\nPor que deseja estornar o fechamento de R$ ${formatCurrencyBR(closure.net_payable)}?`)
    if (reason === null) return // cancelled prompt
    if (!reason.trim()) {
      alert("É necessário informar um motivo para o cancelamento.")
      return
    }

    try {
      await cancelClosure({ closureId: closure.id, reason: reason.trim() })
    } catch (err) {
      console.error(err)
    }
  }

  const activeAdvances = advances?.filter((a) => a.status === "active") || []
  const cancelledAdvances = advances?.filter((a) => a.status === "cancelled") || []
  const appliedAdvances = advances?.filter((a) => a.status === "applied") || []

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* ── Col 1 & 2: Advances for Current Period ──────────────── */}
      <div className="lg:col-span-2 space-y-6">
        <Card className="border-[var(--border-strong)] bg-[var(--bg-surface)]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">Lançamentos do Período Atual</CardTitle>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Vales, adiantamentos e retiradas de estoque da quinzena {currentPeriod.label}
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
                {activeAdvances.length} ativo(s)
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingAdvances ? (
              <div className="py-8 flex justify-center text-xs text-[var(--text-secondary)]">Carregando lançamentos...</div>
            ) : !advances || advances.length === 0 ? (
              <div className="py-12 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-xl">
                Nenhum adiantamento, pego ou retirada lançado neste período.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[var(--text-secondary)] uppercase tracking-wider text-[10px] font-bold">
                      <th className="py-2.5 px-3">Data</th>
                      <th className="py-2.5 px-3">Descrição / Item</th>
                      <th className="py-2.5 px-3">Tipo</th>
                      <th className="py-2.5 px-3 text-right">Valor</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {advances.map((adv) => {
                      const isCancelled = adv.status === "cancelled"
                      const isApplied = adv.status === "applied"

                      return (
                        <tr key={adv.id} className={`group hover:bg-[var(--bg-hover)] ${isCancelled ? "opacity-50" : ""}`}>
                          <td className="py-3 px-3 font-medium whitespace-nowrap">
                            {formatDateBR(adv.occurred_at)}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-semibold text-[var(--text-primary)] block">
                              {adv.description}
                            </span>
                            {adv.notes && (
                              <span className="text-[10px] text-[var(--text-muted)] block mt-0.5 max-w-xs truncate">
                                Obs: {adv.notes}
                              </span>
                            )}
                            {isCancelled && adv.cancellation_reason && (
                              <span className="text-[10px] text-[var(--danger)] block mt-0.5 max-w-xs italic">
                                Cancelado por: {adv.cancellation_reason}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap text-[var(--text-secondary)]">
                            {RECEPTION_ADVANCE_TYPE_LABELS[adv.type]}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-[var(--text-primary)]">
                            R$ {formatCurrencyBR(Number(adv.total_amount))}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${RECEPTION_ADVANCE_STATUS_COLORS[adv.status]}`}>
                              {RECEPTION_ADVANCE_STATUS_LABELS[adv.status]}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            {adv.status === "active" && (
                              <Button
                                size="icon-xs"
                                variant="destructive"
                                onClick={() => handleCancelAdvance(adv.id, adv.description)}
                                disabled={isCancellingAdvance}
                                title="Estornar / Cancelar lançamento"
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Col 3: Historic Closures ────────────────────────────── */}
      <div className="space-y-6">
        <Card className="border-[var(--border-strong)] bg-[var(--bg-surface)]">
          <CardHeader>
            <CardTitle className="text-base font-bold">Histórico de Fechamentos</CardTitle>
            <p className="text-xs text-[var(--text-secondary)] mt-1">Últimos períodos processados e pagos</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoadingClosures ? (
              <div className="py-6 flex justify-center text-xs text-[var(--text-secondary)]">Carregando histórico...</div>
            ) : !closures || closures.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-xl">
                Nenhum período fechado anteriormente.
              </div>
            ) : (
              <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                {closures.map((closure) => {
                  const isConfirmed = closure.status === "confirmed"
                  const isPaid = closure.status === "paid"
                  const isDraft = closure.status === "draft"
                  const isCancelled = closure.status === "cancelled"

                  return (
                    <div
                      key={closure.id}
                      className={`p-3 rounded-lg border text-xs space-y-2 transition-all ${
                        isDraft
                          ? "bg-yellow-500/5 border-yellow-500/10"
                          : isConfirmed
                          ? "bg-blue-500/5 border-blue-500/10"
                          : isPaid
                          ? "bg-emerald-500/5 border-emerald-500/10"
                          : "bg-red-500/5 border-red-500/10 opacity-60"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-[var(--text-primary)]">
                          {formatDateBR(closure.period_start)} a {formatDateBR(closure.period_end)}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${RECEPTION_CLOSURE_STATUS_COLORS[closure.status]}`}>
                          {RECEPTION_CLOSURE_STATUS_LABELS[closure.status]}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-[var(--text-secondary)]">
                        <div>
                          <span>Salário: </span>
                          <strong className="text-[var(--text-primary)]">
                            R$ {formatCurrencyBR(Number(closure.salary_amount))}
                          </strong>
                        </div>
                        <div>
                          <span>Descontos: </span>
                          <strong className="text-[var(--danger)]">
                            - R$ {formatCurrencyBR(Number(closure.advances_total))}
                          </strong>
                        </div>
                        {closure.adjustments_total !== 0 && (
                          <div className="col-span-2">
                            <span>Ajustes: </span>
                            <strong className={closure.adjustments_total > 0 ? "text-[var(--accent)]" : "text-[var(--danger)]"}>
                              R$ {formatCurrencyBR(Number(closure.adjustments_total))}
                            </strong>
                          </div>
                        )}
                        <div className="col-span-2 border-t border-[var(--border)] pt-1 mt-1 flex justify-between items-center text-xs font-bold">
                          <span className="text-[var(--text-primary)]">Saldo Líquido:</span>
                          <span className="text-[var(--text-primary)]">
                            R$ {formatCurrencyBR(Number(closure.net_payable))}
                          </span>
                        </div>
                      </div>

                      {/* Ações do Fechamento */}
                      <div className="flex justify-end gap-1.5 pt-1 border-t border-[var(--border)] mt-1.5">
                        {isConfirmed && (
                          <Button
                            size="sm"
                            className="bg-[var(--accent)] font-bold text-[#0a0a0f] text-[10px] h-6 py-0 px-2"
                            onClick={() => onPayClosure(closure)}
                          >
                            Pagar Folha
                          </Button>
                        )}
                        {(isConfirmed || isPaid) && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="text-[10px] h-6 py-0 px-2"
                            onClick={() => handleCancelClosure(closure)}
                            disabled={isCancellingClosure}
                          >
                            Estornar
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
