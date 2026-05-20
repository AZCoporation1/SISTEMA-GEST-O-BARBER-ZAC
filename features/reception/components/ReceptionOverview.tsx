"use client"

import * as React from "react"
import {
  useReceptionStaff,
  useReceptionAdvances,
  useReceptionClosures,
} from "../hooks/useReception"
import {
  getRecentReceptionPeriods,
  receptionPeriodToISO,
  formatCurrencyBR,
} from "../services/receptionPeriodUtils"
import { calculateReceptionLedger } from "../services/receptionLedger.service"
import { ReceptionSalaryDialog } from "./ReceptionSalaryDialog"
import { ReceptionAdvanceDialog } from "./ReceptionAdvanceDialog"
import { ReceptionStockWithdrawalDialog } from "./ReceptionStockWithdrawalDialog"
import { ReceptionClosurePreviewDialog } from "./ReceptionClosurePreviewDialog"
import { ReceptionPaymentDialog } from "./ReceptionPaymentDialog"
import { ReceptionHistoryView } from "./ReceptionHistoryView"
import {
  Coins,
  DollarSign,
  Package,
  ClipboardCheck,
  Calendar,
  Headset,
  Wallet,
  ArrowRightLeft,
  AlertCircle,
  Sparkles,
} from "lucide-react"
import type { ReceptionStaff, ReceptionPeriod, ReceptionClosure } from "../types"

export function ReceptionOverview() {
  const { data: staffList, isLoading: isLoadingStaff } = useReceptionStaff()
  const recentPeriods = React.useMemo(() => getRecentReceptionPeriods(8), [])
  const [selectedPeriodIdx, setSelectedPeriodIdx] = React.useState(0)
  const currentPeriod = recentPeriods[selectedPeriodIdx]

  const [selectedStaffId, setSelectedStaffId] = React.useState<string>("")

  // Dialog States
  const [salaryStaff, setSalaryStaff] = React.useState<ReceptionStaff | null>(null)
  const [advanceStaff, setAdvanceStaff] = React.useState<ReceptionStaff | null>(null)
  const [withdrawalStaff, setWithdrawalStaff] = React.useState<ReceptionStaff | null>(null)
  const [closureStaff, setClosureStaff] = React.useState<ReceptionStaff | null>(null)
  const [paymentClosure, setPaymentClosure] = React.useState<ReceptionClosure | null>(null)

  // Sync selected staff ID once data loads
  React.useEffect(() => {
    if (staffList && staffList.length > 0 && !selectedStaffId) {
      setSelectedStaffId(staffList[0].id)
    }
  }, [staffList, selectedStaffId])

  const activeStaff = React.useMemo(() => {
    return staffList?.find((s) => s.id === selectedStaffId) || null
  }, [staffList, selectedStaffId])

  // Queries for active staff
  const isoPeriod = React.useMemo(() => receptionPeriodToISO(currentPeriod), [currentPeriod])
  const { data: advances, isLoading: isLoadingAdvances } = useReceptionAdvances(
    selectedStaffId,
    isoPeriod.start,
    isoPeriod.end
  )
  const { data: closures } = useReceptionClosures(selectedStaffId)

  const draftClosure = React.useMemo(() => {
    return closures?.find(
      (c) =>
        c.period_start === isoPeriod.start &&
        c.period_end === isoPeriod.end &&
        c.status !== "cancelled"
    ) || null
  }, [closures, isoPeriod])

  // Calculate Ledger Summary for Active Staff
  const ledgerSummary = React.useMemo(() => {
    if (!activeStaff) return null
    return calculateReceptionLedger(activeStaff, advances || [], draftClosure)
  }, [activeStaff, advances, draftClosure])

  if (isLoadingStaff) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--accent)] border-t-transparent" />
        <span className="text-sm text-[var(--text-secondary)]">Carregando painel de recepção...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── HEADER & PERIOD SELECTOR ───────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-5 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)]/60 backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
            <Headset className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">Módulo Recepção</h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Gestão de salários, retiradas de estoque, adiantamentos e fechamentos quinzenais.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-[var(--text-secondary)]" />
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Período:</span>
          <select
            value={selectedPeriodIdx}
            onChange={(e) => setSelectedPeriodIdx(parseInt(e.target.value))}
            className="h-9 rounded-lg border px-3 text-xs bg-[var(--bg-elevated)] border-[var(--border-strong)] text-[var(--text-primary)] font-bold outline-none focus:border-[var(--accent)]"
          >
            {recentPeriods.map((p, idx) => (
              <option key={p.label} value={idx}>
                Quinzena: {p.label} (Pagamento: {p.paymentDate.toLocaleDateString("pt-BR")})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── STAFF GRID ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {staffList?.map((staff) => {
          const isSelected = staff.id === selectedStaffId
          const hasSalary = staff.base_salary_per_period !== null

          return (
            <div
              key={staff.id}
              onClick={() => setSelectedStaffId(staff.id)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between h-[210px] ${
                isSelected
                  ? "border-[var(--accent)] bg-[var(--accent)]/5 shadow-md ring-1 ring-[var(--accent)]/30"
                  : "border-[var(--border-strong)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              {/* Premium Glow for selected */}
              {isSelected && (
                <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--accent)]/10 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />
              )}

              <div>
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">
                      Recepcionista
                    </span>
                    <h3 className="text-base font-bold text-[var(--text-primary)]">
                      {staff.full_name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--bg-hover)] text-[var(--text-secondary)] border border-[var(--border)]">
                    <Sparkles className="size-3 text-[var(--accent)]" />
                    <span>Admin</span>
                  </div>
                </div>

                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-xs text-[var(--text-secondary)]">Salário Base:</span>
                  <span className="text-sm font-bold text-[var(--text-primary)]">
                    {hasSalary ? `R$ ${formatCurrencyBR(staff.base_salary_per_period!)}` : "A definir"}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">/quinzena</span>
                </div>
              </div>

              {/* Botões de Ação Rápida */}
              <div className="grid grid-cols-4 gap-2 pt-4 border-t border-[var(--border)]">
                <button
                  type="button"
                  title="Ajustar Salário da Quinzena"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSalaryStaff(staff)
                  }}
                  className="flex flex-col items-center justify-center p-2 rounded-lg border border-[var(--border-strong)] hover:border-[var(--accent-border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                >
                  <DollarSign className="size-4 mb-0.5 text-yellow-500" />
                  <span className="text-[9px] font-bold">Salário</span>
                </button>

                <button
                  type="button"
                  title="Lançar Vale / Adiantamento"
                  onClick={(e) => {
                    e.stopPropagation()
                    setAdvanceStaff(staff)
                  }}
                  className="flex flex-col items-center justify-center p-2 rounded-lg border border-[var(--border-strong)] hover:border-[var(--accent-border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                >
                  <Coins className="size-4 mb-0.5 text-emerald-500" />
                  <span className="text-[9px] font-bold">Vale</span>
                </button>

                <button
                  type="button"
                  title="Retirada de Estoque"
                  onClick={(e) => {
                    e.stopPropagation()
                    setWithdrawalStaff(staff)
                  }}
                  className="flex flex-col items-center justify-center p-2 rounded-lg border border-[var(--border-strong)] hover:border-[var(--accent-border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                >
                  <Package className="size-4 mb-0.5 text-blue-500" />
                  <span className="text-[9px] font-bold">Estoque</span>
                </button>

                <button
                  type="button"
                  title="Fechar Quinzena"
                  onClick={(e) => {
                    e.stopPropagation()
                    setClosureStaff(staff)
                  }}
                  className="flex flex-col items-center justify-center p-2 rounded-lg border border-[var(--border-strong)] hover:border-[var(--accent-border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                >
                  <ClipboardCheck className="size-4 mb-0.5 text-[var(--accent)]" />
                  <span className="text-[9px] font-bold">Fechar</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── DETAILED AREA FOR SELECTED STAFF ───────────────────── */}
      {activeStaff && ledgerSummary && (
        <div className="space-y-6">
          {/* LEDGER SUMMARIES KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] flex items-center justify-between shadow-sm">
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase">Salário Quinzena</span>
                <span className="text-lg font-extrabold text-[var(--text-primary)] block">
                  R$ {formatCurrencyBR(ledgerSummary.salaryAmount)}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-yellow-500/10 text-yellow-500">
                <DollarSign className="size-5" />
              </div>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] flex items-center justify-between shadow-sm">
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase">Total Vales</span>
                <span className="text-lg font-extrabold text-[var(--danger)] block">
                  - R$ {formatCurrencyBR(ledgerSummary.advancesTotal)}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-red-500/10 text-[var(--danger)]">
                <Coins className="size-5" />
              </div>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] flex items-center justify-between shadow-sm">
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase">Retirada Estoque</span>
                <span className="text-lg font-extrabold text-[var(--danger)] block">
                  - R$ {formatCurrencyBR(ledgerSummary.stockWithdrawalsTotal)}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-500">
                <Package className="size-5" />
              </div>
            </div>

            <div className="p-4 rounded-xl border border-[var(--accent)] bg-[var(--accent)]/5 flex items-center justify-between shadow-sm">
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase">Saldo Líquido</span>
                <span className="text-lg font-extrabold text-[var(--text-primary)] block">
                  R$ {formatCurrencyBR(ledgerSummary.netPayable)}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-[var(--accent)]/15 text-[var(--accent)]">
                <Wallet className="size-5" />
              </div>
            </div>
          </div>

          {/* DRAFT CLOSURE WARNING */}
          {draftClosure && (
            <div className="p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 flex items-center gap-3 text-xs text-[var(--text-secondary)]">
              <AlertCircle className="size-5 text-yellow-500 shrink-0" />
              <div className="flex-1 leading-relaxed">
                <span>Há um <strong>rascunho de fechamento iniciado</strong> para este período. O saldo líquido de <strong>R$ {formatCurrencyBR(ledgerSummary.netPayable)}</strong> está pré-configurado. Clique em <strong>Fechar Período</strong> para confirmar o recibo e fechar a folha.</span>
              </div>
            </div>
          )}

          {/* TRANSACTION HISTORY VIEW */}
          <ReceptionHistoryView
            staff={activeStaff}
            currentPeriod={currentPeriod}
            onPayClosure={(closure) => setPaymentClosure(closure)}
          />
        </div>
      )}

      {/* ── MODALS & DIALOGS ───────────────────────────────────── */}
      <ReceptionSalaryDialog
        isOpen={salaryStaff !== null}
        onClose={() => setSalaryStaff(null)}
        staff={salaryStaff}
        currentPeriod={currentPeriod}
        initialSalary={draftClosure?.salary_amount}
      />

      <ReceptionAdvanceDialog
        isOpen={advanceStaff !== null}
        onClose={() => setAdvanceStaff(null)}
        staff={advanceStaff}
        currentPeriod={currentPeriod}
      />

      <ReceptionStockWithdrawalDialog
        isOpen={withdrawalStaff !== null}
        onClose={() => setWithdrawalStaff(null)}
        staff={withdrawalStaff}
        currentPeriod={currentPeriod}
      />

      <ReceptionClosurePreviewDialog
        isOpen={closureStaff !== null}
        onClose={() => setClosureStaff(null)}
        staff={closureStaff}
        currentPeriod={currentPeriod}
      />

      <ReceptionPaymentDialog
        isOpen={paymentClosure !== null}
        onClose={() => setPaymentClosure(null)}
        closure={paymentClosure}
      />
    </div>
  )
}
