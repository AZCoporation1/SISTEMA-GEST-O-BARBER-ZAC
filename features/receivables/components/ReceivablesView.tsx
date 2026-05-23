// @ts-nocheck
"use client"

import { useState } from "react"
import { useReceivables, useReceivableSummary, useReceivableDependencies, useReceivableMutations } from "../hooks/useReceivables"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  HandCoins, Search, Filter, ChevronLeft, ChevronRight,
  DollarSign, AlertTriangle, CalendarClock, TrendingUp,
  CheckCircle2, XCircle, RotateCcw, Eye, X
} from "lucide-react"
import type { ReceivableFilters, ReceivableWithRelations } from "../types"

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: "Em aberto", color: "var(--info)", bg: "var(--info-subtle, rgba(59,130,246,0.1))" },
  partial: { label: "Parcial", color: "var(--warning)", bg: "var(--warning-subtle, rgba(245,158,11,0.1))" },
  paid: { label: "Pago", color: "var(--success)", bg: "var(--success-subtle, rgba(34,197,94,0.1))" },
  overdue: { label: "Vencido", color: "var(--error)", bg: "var(--error-subtle, rgba(239,68,68,0.1))" },
  cancelled: { label: "Cancelado", color: "var(--text-muted)", bg: "var(--muted)" },
  reversed: { label: "Estornado", color: "var(--text-muted)", bg: "var(--muted)" },
}

const PAYMENT_METHODS = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "debit_card", label: "Cartão Débito" },
  { value: "credit_card", label: "Cartão Crédito" },
]

export function ReceivablesView() {
  const [filters, setFilters] = useState<ReceivableFilters>({
    page: 1, perPage: 15, status: "all", search: "",
  })
  const [showFilters, setShowFilters] = useState(false)

  // Receive modal
  const [receiveModal, setReceiveModal] = useState<ReceivableWithRelations | null>(null)
  const [receiveAmount, setReceiveAmount] = useState(0)
  const [receiveMethod, setReceiveMethod] = useState("pix")
  const [receiveNotes, setReceiveNotes] = useState("")

  // Cancel modal
  const [cancelModal, setCancelModal] = useState<ReceivableWithRelations | null>(null)
  const [cancelReason, setCancelReason] = useState("")

  // Data
  const { data: receivablesData, isLoading } = useReceivables(filters)
  const { data: summary } = useReceivableSummary()
  const { customers, collaborators } = useReceivableDependencies()
  const { receivePayment, isReceiving, cancelReceivable: cancelFn, isCancelling } = useReceivableMutations()

  const receivables = receivablesData?.data || []
  const totalCount = receivablesData?.count || 0
  const totalPages = Math.ceil(totalCount / filters.perPage)

  const kpis = summary || { totalOpen: 0, totalOverdue: 0, dueTodayCount: 0, dueTodayAmount: 0, receivedThisMonth: 0, totalReceivables: 0 }

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const handleReceive = async () => {
    if (!receiveModal) return
    await receivePayment({
      receivableId: receiveModal.id,
      amount: receiveAmount,
      paymentMethod: receiveMethod as any,
      notes: receiveNotes || undefined,
    })
    setReceiveModal(null)
    setReceiveAmount(0)
    setReceiveNotes("")
  }

  const handleCancel = async () => {
    if (!cancelModal) return
    await cancelFn({ id: cancelModal.id, reason: cancelReason })
    setCancelModal(null)
    setCancelReason("")
  }

  const openReceiveModal = (r: ReceivableWithRelations) => {
    setReceiveModal(r)
    setReceiveAmount(Math.round((Number(r.amount) - Number(r.amount_paid)) * 100) / 100)
    setReceiveMethod("pix")
    setReceiveNotes("")
  }

  const isOverdue = (r: ReceivableWithRelations) => {
    const today = new Date().toISOString().split("T")[0]
    return r.due_date < today && ["open", "partial"].includes(r.status)
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">A Receber</h1>
          <p className="page-subtitle">Parcelas, vencimentos e baixa de recebimentos</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Total em Aberto</span>
            <DollarSign className="kpi-icon" style={{ color: "var(--info)" }} />
          </div>
          <div className="kpi-value" style={{ color: "var(--info)" }}>{fmt(kpis.totalOpen)}</div>
          <div className="kpi-sub">{kpis.totalReceivables} parcelas pendentes</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Vencendo Hoje</span>
            <CalendarClock className="kpi-icon" style={{ color: "var(--warning)" }} />
          </div>
          <div className="kpi-value" style={{ color: "var(--warning)" }}>{fmt(kpis.dueTodayAmount)}</div>
          <div className="kpi-sub">{kpis.dueTodayCount} parcelas hoje</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Vencido</span>
            <AlertTriangle className="kpi-icon" style={{ color: "var(--error)" }} />
          </div>
          <div className="kpi-value" style={{ color: "var(--error)" }}>{fmt(kpis.totalOverdue)}</div>
          <div className="kpi-sub">Atenção: parcelas em atraso</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Recebido no Mês</span>
            <TrendingUp className="kpi-icon" style={{ color: "var(--success)" }} />
          </div>
          <div className="kpi-value" style={{ color: "var(--success)" }}>{fmt(kpis.receivedThisMonth)}</div>
          <div className="kpi-sub">Baixas realizadas</div>
        </div>
      </div>

      {/* Filters */}
      <div className="section-card">
        <div className="section-card-header" style={{ padding: "10px 16px" }}>
          <div className="flex items-center gap-3 w-full">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente ou descrição..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="h-8 text-xs gap-1"
            >
              <Filter className="h-3.5 w-3.5" />
              Filtros
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="p-3 border-b grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-muted/10 animate-in slide-in-from-top-1">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Status</label>
              <Select value={filters.status || "all"} onValueChange={(v) => setFilters({ ...filters, status: v, page: 1 })}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="open">Em aberto</SelectItem>
                  <SelectItem value="partial">Parcial</SelectItem>
                  <SelectItem value="overdue">Vencido</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Período início</label>
              <Input type="date" className="h-8 text-xs mt-1" value={filters.startDate || ""} onChange={(e) => setFilters({ ...filters, startDate: e.target.value, page: 1 })} />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Período fim</label>
              <Input type="date" className="h-8 text-xs mt-1" value={filters.endDate || ""} onChange={(e) => setFilters({ ...filters, endDate: e.target.value, page: 1 })} />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Cliente</label>
              <Select value={filters.customerId || "all"} onValueChange={(v) => setFilters({ ...filters, customerId: v === "all" ? undefined : v, page: 1 })}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {customers.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th style={{ minWidth: 140 }}>Cliente</th>
                <th style={{ minWidth: 160 }}>Descrição</th>
                <th style={{ width: 70 }}>Parcela</th>
                <th style={{ width: 100 }}>Vencimento</th>
                <th style={{ width: 100, textAlign: "right" }}>Valor</th>
                <th style={{ width: 100, textAlign: "right" }}>Pago</th>
                <th style={{ width: 90 }}>Status</th>
                <th style={{ width: 70 }}>Origem</th>
                <th style={{ width: 120 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">Carregando...</td></tr>
              ) : receivables.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state" style={{ margin: 16, padding: "40px 16px" }}>
                      <HandCoins className="empty-state-icon" style={{ width: 40, height: 40 }} />
                      <h3 className="empty-state-title">Nenhuma parcela encontrada</h3>
                      <p className="empty-state-description">
                        Parcelas aparecerão aqui quando vendas parceladas ou a prazo forem realizadas.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                receivables.map((r) => {
                  const statusCfg = isOverdue(r) ? STATUS_CONFIG.overdue : STATUS_CONFIG[r.status] || STATUS_CONFIG.open
                  const remaining = Number(r.amount) - Number(r.amount_paid)
                  const canReceive = ["open", "partial"].includes(r.status)
                  const canCancel = ["open", "partial"].includes(r.status)

                  return (
                    <tr key={r.id}>
                      <td>
                        <div className="font-semibold text-xs">{r.customer_name_snapshot || (r as any).customer?.full_name || "—"}</div>
                        {r.customer_phone_snapshot && (
                          <div className="text-[10px] text-muted-foreground">{r.customer_phone_snapshot}</div>
                        )}
                      </td>
                      <td>
                        <div className="text-xs line-clamp-1">{r.description}</div>
                        {r.notes && <div className="text-[10px] text-muted-foreground line-clamp-1">{r.notes}</div>}
                      </td>
                      <td className="text-center">
                        <span className="text-xs font-bold">{r.installment_number}/{r.total_installments}</span>
                      </td>
                      <td>
                        <span className={`text-xs ${isOverdue(r) ? 'text-red-500 font-bold' : ''}`}>
                          {new Date(r.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className="text-xs font-semibold">{fmt(Number(r.amount))}</span>
                      </td>
                      <td className="text-right">
                        <span className="text-xs">{fmt(Number(r.amount_paid))}</span>
                        {remaining > 0 && r.status !== 'cancelled' && (
                          <div className="text-[10px] text-muted-foreground">Saldo: {fmt(remaining)}</div>
                        )}
                      </td>
                      <td>
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{ color: statusCfg.color, background: statusCfg.bg }}
                        >
                          {statusCfg.label}
                        </span>
                      </td>
                      <td>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                          {r.payment_origin === 'store_credit' ? 'A prazo' :
                           r.payment_origin === 'credit_card_installment' ? 'Crédito' : 'Misto'}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          {canReceive && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-emerald-500 hover:bg-emerald-500/10"
                              title="Receber"
                              onClick={() => openReceiveModal(r)}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canCancel && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:bg-destructive/10"
                              title="Cancelar"
                              onClick={() => { setCancelModal(r); setCancelReason("") }}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t">
            <span className="text-xs text-muted-foreground">
              Página {filters.page} de {totalPages} ({totalCount} registros)
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={filters.page <= 1}
                onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={filters.page >= totalPages}
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ═══════ RECEIVE MODAL ═══════ */}
      {receiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setReceiveModal(null)}>
          <div
            className="bg-card border rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b bg-emerald-500/5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-emerald-600 dark:text-emerald-400">Receber Parcela</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {receiveModal.customer_name_snapshot} • Parcela {receiveModal.installment_number}/{receiveModal.total_installments}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setReceiveModal(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-lg">
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground font-medium">Valor da Parcela</div>
                  <div className="text-sm font-bold">{fmt(Number(receiveModal.amount))}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground font-medium">Saldo Restante</div>
                  <div className="text-sm font-bold text-emerald-500">{fmt(Number(receiveModal.amount) - Number(receiveModal.amount_paid))}</div>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block">Valor Recebido *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Number(receiveModal.amount) - Number(receiveModal.amount_paid)}
                  value={receiveAmount || ""}
                  onChange={(e) => setReceiveAmount(parseFloat(e.target.value) || 0)}
                  className="h-10 text-lg font-bold text-emerald-600 dark:text-emerald-400"
                />
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block">Forma de Recebimento *</label>
                <Select value={receiveMethod} onValueChange={setReceiveMethod}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((pm) => (
                      <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block">Observação</label>
                <Input
                  placeholder="Opcional"
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="p-4 border-t flex gap-2">
              <Button variant="outline" className="flex-1 h-9 text-xs" onClick={() => setReceiveModal(null)}>
                Cancelar
              </Button>
              <Button
                className="flex-1 h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={isReceiving || receiveAmount <= 0}
                onClick={handleReceive}
              >
                {isReceiving ? "Processando..." : `Receber ${fmt(receiveAmount)}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ CANCEL MODAL ═══════ */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setCancelModal(null)}>
          <div
            className="bg-card border rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b bg-destructive/5">
              <h3 className="font-bold text-base text-destructive">Cancelar Parcela</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Parcela {cancelModal.installment_number}/{cancelModal.total_installments} — {fmt(Number(cancelModal.amount))}
              </p>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Motivo do cancelamento *</label>
                <Input
                  placeholder="Informe o motivo..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="p-4 border-t flex gap-2">
              <Button variant="outline" className="flex-1 h-9 text-xs" onClick={() => setCancelModal(null)}>
                Voltar
              </Button>
              <Button
                variant="destructive"
                className="flex-1 h-9 text-xs"
                disabled={isCancelling || !cancelReason.trim()}
                onClick={handleCancel}
              >
                {isCancelling ? "Cancelando..." : "Confirmar Cancelamento"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
