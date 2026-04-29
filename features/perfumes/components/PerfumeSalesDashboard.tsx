// @ts-nocheck
"use client"

import { useState, useMemo } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import {
  usePerfumeSales,
  usePerfumeProducts,
  usePerfumeProfessionals,
  useOverdueInstallments,
  usePerfumeClientSummaries,
  usePaymentMethods,
} from "../hooks/usePerfumes"
import {
  registerPerfumeSale,
  payPerfumeInstallment,
  cancelPerfumeSale,
  reverseInstallmentPayment,
} from "../actions/perfumes.actions"
import { searchCustomers } from "../services/perfumes.service"
import {
  PERFUME_SALE_STATUS_LABELS,
  PERFUME_SALE_STATUS_COLORS,
  PERFUME_INSTALLMENT_STATUS_LABELS,
  PERFUME_INSTALLMENT_STATUS_COLORS,
  PAYMENT_MODE_LABELS,
} from "../types"
import { KPICard } from "@/components/ui/kpi-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable } from "@/components/ui/data-table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { ColumnDef } from "@tanstack/react-table"
import {
  Sparkles,
  DollarSign,
  Users,
  AlertTriangle,
  ShoppingBag,
  Plus,
  XCircle,
  CheckCircle,
  Clock,
  CreditCard,
  RotateCcw,
  Search,
  User,
  Phone,
  Package,
} from "lucide-react"

// ══════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ══════════════════════════════════════════════════════════

export function PerfumeSalesDashboard() {
  const [activeTab, setActiveTab] = useState("vendas")
  const [salesFilters, setSalesFilters] = useState({ page: 1, perPage: 20, search: "", status: "all" })
  const [registerOpen, setRegisterOpen] = useState(false)
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; saleId: string; saleName: string }>({ open: false, saleId: "", saleName: "" })
  const [payDialog, setPayDialog] = useState<{ open: boolean; installmentId: string; amount: number; saleName: string }>({ open: false, installmentId: "", amount: 0, saleName: "" })
  const [reverseDialog, setReverseDialog] = useState<{ open: boolean; installmentId: string; saleName: string }>({ open: false, installmentId: "", saleName: "" })

  const { data: salesData, isLoading: salesLoading } = usePerfumeSales(salesFilters)
  const { data: overdueData } = useOverdueInstallments()
  const { data: clientSummaries } = usePerfumeClientSummaries()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // ── KPIs ──
  const totalSales = salesData?.count || 0
  const overdueCount = (overdueData || []).filter(i => i.is_overdue).length
  const totalRevenue = (salesData?.data || []).reduce((s, sale) => s + Number(sale.total_price), 0)
  const totalPending = (clientSummaries || []).reduce((s, c) => s + Number(c.total_pending || 0), 0)

  const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')

  // ── Sales Table Columns ──
  const salesColumns: ColumnDef<any>[] = [
    {
      accessorKey: "sale_date",
      header: "Data",
      cell: ({ row }) => <span className="text-xs">{formatDate(row.original.sale_date)}</span>,
    },
    {
      accessorKey: "perfume_name_snapshot",
      header: "Perfume",
      cell: ({ row }) => (
        <div>
          <span className="font-medium text-sm">{row.original.perfume_name_snapshot}</span>
          {row.original.external_code_snapshot && (
            <span className="ml-2 text-[10px] text-[var(--text-muted)]">{row.original.external_code_snapshot}</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "customer_name_snapshot",
      header: "Cliente",
      cell: ({ row }) => (
        <div className="text-sm">
          <span>{row.original.customer_name_snapshot}</span>
          {row.original.customer_phone_snapshot && (
            <span className="ml-2 text-[10px] text-[var(--text-muted)]">{row.original.customer_phone_snapshot}</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "professional",
      header: "Profissional",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.professional?.display_name || row.original.professional?.name || "—"}</span>
      ),
    },
    {
      accessorKey: "total_price",
      header: "Valor",
      cell: ({ row }) => <span className="font-bold text-emerald-500">R$ {formatCurrency(row.original.total_price)}</span>,
    },
    {
      accessorKey: "payment_mode",
      header: "Pagamento",
      cell: ({ row }) => (
        <span className="text-xs">
          {PAYMENT_MODE_LABELS[row.original.payment_mode] || row.original.payment_mode}
          {row.original.installment_count && ` (${row.original.installment_count}x)`}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <span className={`px-2 py-1 rounded-full text-[10px] font-medium ${PERFUME_SALE_STATUS_COLORS[row.original.status] || ""}`}>
          {PERFUME_SALE_STATUS_LABELS[row.original.status] || row.original.status}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          {row.original.status !== "cancelled" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-red-500 hover:text-red-400"
              onClick={() => setCancelDialog({
                open: true,
                saleId: row.original.id,
                saleName: row.original.perfume_name_snapshot,
              })}
            >
              <XCircle size={12} className="mr-1" /> Cancelar
            </Button>
          )}
        </div>
      ),
    },
  ]

  // ── Installments / Debtors Table Columns ──
  const installmentColumns: ColumnDef<any>[] = [
    {
      accessorKey: "due_date",
      header: "Vencimento",
      cell: ({ row }) => {
        const isOverdue = row.original.is_overdue
        return (
          <span className={`text-xs font-medium ${isOverdue ? "text-red-400" : ""}`}>
            {formatDate(row.original.due_date)}
            {isOverdue && <AlertTriangle size={10} className="inline ml-1 text-red-400" />}
          </span>
        )
      },
    },
    {
      accessorKey: "customer",
      header: "Cliente",
      cell: ({ row }) => (
        <div className="text-sm">
          <span className="font-medium">{row.original.perfume_sale?.customer_name_snapshot || "—"}</span>
          <span className="ml-2 text-[10px] text-[var(--text-muted)]">{row.original.perfume_sale?.customer_phone_snapshot}</span>
        </div>
      ),
    },
    {
      accessorKey: "perfume",
      header: "Perfume",
      cell: ({ row }) => <span className="text-sm">{row.original.perfume_sale?.perfume_name_snapshot || "—"}</span>,
    },
    {
      accessorKey: "installment_number",
      header: "Parcela",
      cell: ({ row }) => <span className="text-xs font-bold">{row.original.installment_number}</span>,
    },
    {
      accessorKey: "amount",
      header: "Valor",
      cell: ({ row }) => <span className="font-bold text-amber-500">R$ {formatCurrency(row.original.amount)}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const computedStatus = row.original.computed_status || row.original.status
        return (
          <span className={`px-2 py-1 rounded-full text-[10px] font-medium ${PERFUME_INSTALLMENT_STATUS_COLORS[computedStatus] || ""}`}>
            {computedStatus === "overdue" ? "🔴 Vencida" : PERFUME_INSTALLMENT_STATUS_LABELS[computedStatus] || computedStatus}
          </span>
        )
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const computedStatus = row.original.computed_status || row.original.status
        return (
          <div className="flex items-center gap-1 justify-end">
            {(computedStatus === "open" || computedStatus === "overdue") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-emerald-500 hover:text-emerald-400"
                onClick={() => setPayDialog({
                  open: true,
                  installmentId: row.original.id,
                  amount: row.original.amount,
                  saleName: row.original.perfume_sale?.perfume_name_snapshot || "",
                })}
              >
                <CheckCircle size={12} className="mr-1" /> Receber
              </Button>
            )}
            {computedStatus === "paid" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-red-400 hover:text-red-300"
                onClick={() => setReverseDialog({
                  open: true,
                  installmentId: row.original.id,
                  saleName: row.original.perfume_sale?.perfume_name_snapshot || "",
                })}
              >
                <RotateCcw size={12} className="mr-1" /> Estornar
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  // ── Client Summary Columns ──
  const clientColumns: ColumnDef<any>[] = [
    {
      accessorKey: "customer_name",
      header: "Cliente",
      cell: ({ row }) => <span className="font-medium text-sm">{row.original.customer_name}</span>,
    },
    {
      accessorKey: "customer_phone",
      header: "Telefone",
      cell: ({ row }) => <span className="text-xs text-[var(--text-muted)]">{row.original.customer_phone || "—"}</span>,
    },
    {
      accessorKey: "total_purchases",
      header: "Compras",
      cell: ({ row }) => <span className="text-sm">{row.original.total_purchases}</span>,
    },
    {
      accessorKey: "total_amount",
      header: "Total",
      cell: ({ row }) => <span className="font-medium text-sm">R$ {formatCurrency(row.original.total_amount)}</span>,
    },
    {
      accessorKey: "total_paid",
      header: "Pago",
      cell: ({ row }) => <span className="text-emerald-500 text-sm">R$ {formatCurrency(row.original.total_paid)}</span>,
    },
    {
      accessorKey: "total_pending",
      header: "Pendente",
      cell: ({ row }) => (
        <span className={`text-sm font-bold ${row.original.total_pending > 0 ? "text-amber-500" : "text-[var(--text-muted)]"}`}>
          R$ {formatCurrency(row.original.total_pending)}
        </span>
      ),
    },
    {
      accessorKey: "overdue_count",
      header: "Vencidas",
      cell: ({ row }) => (
        row.original.overdue_count > 0 ? (
          <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-red-950 text-red-400">
            {row.original.overdue_count} parcela(s)
          </span>
        ) : (
          <span className="text-[10px] text-[var(--text-muted)]">—</span>
        )
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Sparkles className="text-purple-400" size={22} />
            Vendas de Perfumes
          </h1>
          <p className="page-subtitle">Registro, clientes, parcelas e controle de recebíveis.</p>
        </div>
        <div className="page-actions">
          <Button onClick={() => setRegisterOpen(true)} className="gap-2">
            <Plus size={14} /> Nova Venda
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <KPICard
          title="Total Vendas"
          value={totalSales.toString()}
          icon={<ShoppingBag className="text-purple-400" />}
          description="Vendas registradas"
        />
        <KPICard
          title="Receita Total"
          value={`R$ ${formatCurrency(totalRevenue)}`}
          icon={<DollarSign className="text-emerald-500" />}
          description="Valor total vendido"
        />
        <KPICard
          title="A Receber"
          value={`R$ ${formatCurrency(totalPending)}`}
          icon={<Clock className="text-amber-500" />}
          description="Parcelas pendentes"
        />
        <KPICard
          title="Parcelas Vencidas"
          value={overdueCount.toString()}
          icon={<AlertTriangle className={overdueCount > 0 ? "text-red-400" : "text-[var(--text-muted)]"} />}
          description={overdueCount > 0 ? "Atenção! Cobranças pendentes" : "Sem atrasos"}
        />
      </div>

      {/* Overdue Alert Banner */}
      {overdueCount > 0 && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-950/20 flex items-center gap-3">
          <AlertTriangle className="text-red-400 flex-shrink-0" size={20} />
          <div>
            <p className="text-sm font-bold text-red-400">
              {overdueCount} parcela(s) vencida(s)!
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Verifique a aba "Devedores / Parcelas" para detalhes e cobranças pendentes.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="vendas" className="gap-1.5">
            <ShoppingBag size={13} /> Vendas
          </TabsTrigger>
          <TabsTrigger value="clientes" className="gap-1.5">
            <Users size={13} /> Clientes Perfumes
          </TabsTrigger>
          <TabsTrigger value="devedores" className="gap-1.5 relative">
            <CreditCard size={13} /> Devedores / Parcelas
            {overdueCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold">
                {overdueCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Vendas ── */}
        <TabsContent value="vendas" className="space-y-4">
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <Input
                placeholder="Buscar perfume ou cliente..."
                className="pl-9"
                value={salesFilters.search}
                onChange={(e) => setSalesFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
              />
            </div>
            <Select
              value={salesFilters.status}
              onValueChange={(v) => setSalesFilters(prev => ({ ...prev, status: v, page: 1 }))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="completed">Concluídas</SelectItem>
                <SelectItem value="receivable_open">A Receber</SelectItem>
                <SelectItem value="receivable_settled">Quitadas</SelectItem>
                <SelectItem value="cancelled">Canceladas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="data-table-wrapper p-4">
            {salesLoading ? (
              <div className="h-32 flex items-center justify-center text-[var(--text-muted)]">Carregando vendas...</div>
            ) : (salesData?.data || []).length === 0 ? (
              <div className="empty-state">
                <Sparkles className="empty-state-icon" />
                <h3 className="empty-state-title">Nenhuma venda de perfume registrada</h3>
                <p className="empty-state-description">Clique em "Nova Venda" para registrar a primeira venda de perfume.</p>
              </div>
            ) : (
              <DataTable columns={salesColumns} data={salesData?.data || []} />
            )}
          </div>
        </TabsContent>

        {/* ── Tab: Clientes Perfumes ── */}
        <TabsContent value="clientes" className="space-y-4">
          <div className="data-table-wrapper p-4">
            {(clientSummaries || []).length === 0 ? (
              <div className="empty-state">
                <Users className="empty-state-icon" />
                <h3 className="empty-state-title">Nenhum cliente de perfumes ainda</h3>
                <p className="empty-state-description">Registre vendas de perfume para ver os clientes aqui.</p>
              </div>
            ) : (
              <DataTable columns={clientColumns} data={clientSummaries || []} />
            )}
          </div>
        </TabsContent>

        {/* ── Tab: Devedores / Parcelas ── */}
        <TabsContent value="devedores" className="space-y-4">
          <div className="data-table-wrapper p-4">
            {(overdueData || []).length === 0 ? (
              <div className="empty-state">
                <CreditCard className="empty-state-icon" />
                <h3 className="empty-state-title">Nenhuma parcela pendente</h3>
                <p className="empty-state-description">Todas as parcelas estão quitadas.</p>
              </div>
            ) : (
              <DataTable columns={installmentColumns} data={overdueData || []} />
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ══════════════════════════════════════════════════ */}
      {/* REGISTER PERFUME SALE DIALOG */}
      {/* ══════════════════════════════════════════════════ */}
      <RegisterPerfumeSaleDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
      />

      {/* ══════════════════════════════════════════════════ */}
      {/* CANCEL SALE DIALOG */}
      {/* ══════════════════════════════════════════════════ */}
      <CancelSaleDialog
        open={cancelDialog.open}
        onOpenChange={(open) => setCancelDialog(prev => ({ ...prev, open }))}
        saleId={cancelDialog.saleId}
        saleName={cancelDialog.saleName}
      />

      {/* ══════════════════════════════════════════════════ */}
      {/* PAY INSTALLMENT DIALOG */}
      {/* ══════════════════════════════════════════════════ */}
      <PayInstallmentDialog
        open={payDialog.open}
        onOpenChange={(open) => setPayDialog(prev => ({ ...prev, open }))}
        installmentId={payDialog.installmentId}
        amount={payDialog.amount}
        saleName={payDialog.saleName}
      />

      {/* ══════════════════════════════════════════════════ */}
      {/* REVERSE INSTALLMENT DIALOG */}
      {/* ══════════════════════════════════════════════════ */}
      <ReverseInstallmentDialog
        open={reverseDialog.open}
        onOpenChange={(open) => setReverseDialog(prev => ({ ...prev, open }))}
        installmentId={reverseDialog.installmentId}
        saleName={reverseDialog.saleName}
      />
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// REGISTER PERFUME SALE DIALOG
// ══════════════════════════════════════════════════════════

function RegisterPerfumeSaleDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [form, setForm] = useState({
    professional_id: "",
    customer_id: null as string | null,
    customer_name: "",
    customer_phone: "",
    inventory_product_id: "",
    payment_mode: "cash" as "cash" | "installments",
    installment_count: 3,
    due_day: 10,
    unit_price: 0,
    quantity: 1,
    commission_percent: 47,
    payment_method: "",
    notes: "",
  })
  const [isWalkin, setIsWalkin] = useState(true)
  const [customerSearch, setCustomerSearch] = useState("")
  const [customerResults, setCustomerResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)

  const { data: products } = usePerfumeProducts()
  const { data: professionals } = usePerfumeProfessionals()
  const { data: paymentMethods } = usePaymentMethods()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const selectedProduct = (products || []).find(p => p.id === form.inventory_product_id)
  const totalPrice = form.unit_price * form.quantity
  const commissionAmount = totalPrice * (form.commission_percent / 100)

  const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const handleProductChange = (productId: string) => {
    const product = (products || []).find(p => p.id === productId)
    const price = product
      ? (form.payment_mode === 'cash'
          ? (product.sale_price_cash ?? product.sale_price_generated ?? 0)
          : (product.sale_price_installment ?? product.sale_price_generated ?? 0))
      : 0
    setForm(prev => ({
      ...prev,
      inventory_product_id: productId,
      unit_price: price,
    }))
  }

  // Auto-update price when payment mode changes (if a product is selected)
  const handlePaymentModeChange = (mode: 'cash' | 'installments') => {
    const product = (products || []).find(p => p.id === form.inventory_product_id)
    const price = product
      ? (mode === 'cash'
          ? (product.sale_price_cash ?? product.sale_price_generated ?? 0)
          : (product.sale_price_installment ?? product.sale_price_generated ?? 0))
      : form.unit_price
    setForm(prev => ({
      ...prev,
      payment_mode: mode,
      unit_price: price,
    }))
  }

  const handleCustomerSearch = async (term: string) => {
    setCustomerSearch(term)
    if (term.length >= 2) {
      setSearching(true)
      const results = await searchCustomers(term)
      setCustomerResults(results)
      setSearching(false)
    } else {
      setCustomerResults([])
    }
  }

  const selectCustomer = (customer: any) => {
    setForm(prev => ({
      ...prev,
      customer_id: customer.id,
      customer_name: customer.full_name,
      customer_phone: customer.mobile_phone || customer.phone || "",
    }))
    setIsWalkin(false)
    setCustomerSearch("")
    setCustomerResults([])
  }

  const mutation = useMutation({
    mutationFn: registerPerfumeSale,
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ["perfumeSales"] })
        queryClient.invalidateQueries({ queryKey: ["perfumeOverdueInstallments"] })
        queryClient.invalidateQueries({ queryKey: ["perfumeClientSummaries"] })
        queryClient.invalidateQueries({ queryKey: ["perfumeProducts"] })
        toast({ title: "Venda registrada!", description: "Perfume vendido com sucesso." })
        onOpenChange(false)
        // Reset form
        setForm({
          professional_id: "", customer_id: null, customer_name: "", customer_phone: "",
          inventory_product_id: "", payment_mode: "cash", installment_count: 3, due_day: 10,
          unit_price: 0, quantity: 1, commission_percent: 47, payment_method: "", notes: "",
        })
        setIsWalkin(true)
      } else {
        toast({ title: "Erro", description: res.error, variant: "destructive" })
      }
    },
  })

  const handleSubmit = () => {
    if (!form.professional_id) return toast({ title: "Erro", description: "Selecione o profissional", variant: "destructive" })
    if (!form.inventory_product_id) return toast({ title: "Erro", description: "Selecione o perfume", variant: "destructive" })
    if (!form.customer_name || form.customer_name.length < 2) return toast({ title: "Erro", description: "Nome do cliente obrigatório", variant: "destructive" })
    if (form.payment_mode === 'installments' && (!form.customer_phone || form.customer_phone.length < 8)) {
      return toast({ title: "Erro", description: "Telefone obrigatório para vendas a prazo", variant: "destructive" })
    }
    if (!form.customer_phone || form.customer_phone.length < 8) {
      return toast({ title: "Erro", description: "Telefone do cliente obrigatório", variant: "destructive" })
    }

    mutation.mutate({
      ...form,
      customer_id: form.customer_id || null,
    })
  }

  const handleProfessionalChange = (profId: string) => {
    const prof = (professionals || []).find(p => p.id === profId)
    setForm(prev => ({
      ...prev,
      professional_id: profId,
      commission_percent: Number(prof?.default_commission_percent) || 47,
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={18} className="text-purple-400" />
            Registrar Venda de Perfume
          </DialogTitle>
          <DialogDescription>Preencha os dados da venda. Estoque será deduzido automaticamente.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Professional */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider">Profissional *</Label>
            <Select value={form.professional_id} onValueChange={handleProfessionalChange}>
              <SelectTrigger><SelectValue placeholder="Selecione o profissional" /></SelectTrigger>
              <SelectContent>
                {(professionals || []).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.display_name || p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Customer */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider">Cliente *</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => {
                  setIsWalkin(!isWalkin)
                  if (!isWalkin) {
                    setForm(prev => ({ ...prev, customer_id: null, customer_name: "", customer_phone: "" }))
                  }
                }}
              >
                {isWalkin ? <><Search size={10} className="mr-1" /> Buscar cadastrado</> : <><User size={10} className="mr-1" /> Cliente avulso</>}
              </Button>
            </div>

            {!isWalkin ? (
              <div className="relative">
                <Input
                  placeholder="Buscar por nome ou telefone..."
                  value={customerSearch}
                  onChange={(e) => handleCustomerSearch(e.target.value)}
                />
                {customerResults.length > 0 && (
                  <div className="absolute z-50 top-full mt-1 w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg shadow-xl max-h-40 overflow-y-auto">
                    {customerResults.map(c => (
                      <button
                        key={c.id}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--bg-active)] flex items-center gap-2"
                        onClick={() => selectCustomer(c)}
                      >
                        <User size={12} className="text-[var(--text-muted)]" />
                        <span className="font-medium">{c.full_name}</span>
                        {c.mobile_phone && <span className="text-[10px] text-[var(--text-muted)]">{c.mobile_phone}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {form.customer_id && (
                  <p className="text-xs text-emerald-500 mt-1">✓ {form.customer_name} — {form.customer_phone}</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <User size={11} className="text-[var(--text-muted)]" />
                    <span className="text-[10px] text-[var(--text-muted)] uppercase">Nome *</span>
                  </div>
                  <Input
                    placeholder="Nome do cliente"
                    value={form.customer_name}
                    onChange={(e) => setForm(prev => ({ ...prev, customer_name: e.target.value }))}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Phone size={11} className="text-[var(--text-muted)]" />
                    <span className="text-[10px] text-[var(--text-muted)] uppercase">Telefone *</span>
                  </div>
                  <Input
                    placeholder="(00) 00000-0000"
                    value={form.customer_phone}
                    onChange={(e) => setForm(prev => ({ ...prev, customer_phone: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Perfume Product */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
              <Package size={11} /> Perfume *
            </Label>
            <Select value={form.inventory_product_id} onValueChange={handleProductChange}>
              <SelectTrigger><SelectValue placeholder="Selecione o perfume" /></SelectTrigger>
              <SelectContent>
                {(products || []).map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} {p.external_code ? `(${p.external_code})` : ""}
                    {p.sale_price_cash ? ` — Vista R$${p.sale_price_cash.toFixed(2)}` : ""}
                    {p.sale_price_installment ? ` / Prazo R$${p.sale_price_installment.toFixed(2)}` : ` — R$${(p.sale_price_generated || 0).toFixed(2)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Price & Quantity */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px] uppercase">Preço unitário</Label>
              <Input
                type="number"
                step="0.01"
                value={form.unit_price}
                onChange={(e) => setForm(prev => ({ ...prev, unit_price: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase">Quantidade</Label>
              <Input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => setForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase">Comissão %</Label>
              <Input
                type="number"
                step="0.01"
                value={form.commission_percent}
                onChange={(e) => setForm(prev => ({ ...prev, commission_percent: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>

          {/* Payment Mode */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider">Modo de Pagamento *</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                type="button"
                className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                  form.payment_mode === "cash"
                    ? "border-emerald-500/50 bg-emerald-950/20 text-emerald-400"
                    : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                }`}
                onClick={() => handlePaymentModeChange("cash")}
              >
                <DollarSign size={14} className="inline mr-1" /> À Vista
              </button>
              <button
                type="button"
                className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                  form.payment_mode === "installments"
                    ? "border-amber-500/50 bg-amber-950/20 text-amber-400"
                    : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                }`}
                onClick={() => handlePaymentModeChange("installments")}
              >
                <CreditCard size={14} className="inline mr-1" /> A Prazo
              </button>
            </div>
          </div>

          {/* Installment Config */}
          {form.payment_mode === "installments" && (
            <div className="grid grid-cols-2 gap-2 p-3 rounded-lg border border-amber-500/20 bg-amber-950/10">
              <div>
                <Label className="text-[10px] uppercase text-amber-400">Nº de Parcelas</Label>
                <Input
                  type="number"
                  min="2"
                  max="24"
                  value={form.installment_count}
                  onChange={(e) => setForm(prev => ({ ...prev, installment_count: parseInt(e.target.value) || 3 }))}
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase text-amber-400">Dia do Vencimento</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={form.due_day}
                  onChange={(e) => setForm(prev => ({ ...prev, due_day: parseInt(e.target.value) || 10 }))}
                />
              </div>
              <p className="col-span-2 text-xs text-amber-400/60">
                {form.installment_count}x de R$ {formatCurrency(totalPrice / (form.installment_count || 1))} — Vencimento dia {form.due_day}
              </p>
            </div>
          )}

          {/* Payment Method (for cash) */}
          {form.payment_mode === "cash" && (
            <div>
              <Label className="text-[10px] uppercase">Forma de Pagamento</Label>
              <Select value={form.payment_method || ""} onValueChange={(v) => setForm(prev => ({ ...prev, payment_method: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(paymentMethods || []).map(m => (
                    <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label className="text-[10px] uppercase">Observações</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Observações adicionais..."
              rows={2}
            />
          </div>

          {/* Summary */}
          <div className="p-3 rounded-lg bg-[var(--bg-base)] border border-[var(--border)] space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-muted)]">Total da Venda:</span>
              <span className="font-bold text-emerald-500">R$ {formatCurrency(totalPrice)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-muted)]">Comissão ({form.commission_percent}%):</span>
              <span className="font-medium text-blue-400">R$ {formatCurrency(commissionAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-muted)]">Pagamento:</span>
              <span className="font-medium">{form.payment_mode === "cash" ? "À Vista" : `${form.installment_count}x A Prazo`}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending} className="gap-2">
            <CheckCircle size={14} />
            {mutation.isPending ? "Registrando..." : "Confirmar Venda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ══════════════════════════════════════════════════════════
// CANCEL SALE DIALOG
// ══════════════════════════════════════════════════════════

function CancelSaleDialog({ open, onOpenChange, saleId, saleName }: {
  open: boolean; onOpenChange: (v: boolean) => void; saleId: string; saleName: string
}) {
  const [reason, setReason] = useState("")
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const mutation = useMutation({
    mutationFn: () => cancelPerfumeSale({ sale_id: saleId, reason }),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ["perfumeSales"] })
        queryClient.invalidateQueries({ queryKey: ["perfumeOverdueInstallments"] })
        queryClient.invalidateQueries({ queryKey: ["perfumeClientSummaries"] })
        queryClient.invalidateQueries({ queryKey: ["perfumeProducts"] })
        toast({ title: "Venda cancelada", description: "Estoque revertido e movimentos estornados." })
        onOpenChange(false)
        setReason("")
      } else {
        toast({ title: "Erro", description: res.error, variant: "destructive" })
      }
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-400">
            <XCircle size={18} /> Cancelar Venda de Perfume
          </DialogTitle>
          <DialogDescription>
            Esta ação irá cancelar a venda de <strong>{saleName}</strong>, reverter o estoque e estornar movimentos financeiros.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label className="text-xs uppercase font-semibold">Motivo do cancelamento *</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Descreva o motivo..." rows={3} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || reason.length < 3}
          >
            {mutation.isPending ? "Cancelando..." : "Confirmar Cancelamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ══════════════════════════════════════════════════════════
// PAY INSTALLMENT DIALOG
// ══════════════════════════════════════════════════════════

function PayInstallmentDialog({ open, onOpenChange, installmentId, amount, saleName }: {
  open: boolean; onOpenChange: (v: boolean) => void; installmentId: string; amount: number; saleName: string
}) {
  const [paymentMethod, setPaymentMethod] = useState("")
  const { data: paymentMethods } = usePaymentMethods()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const mutation = useMutation({
    mutationFn: () => payPerfumeInstallment({ installment_id: installmentId, payment_method: paymentMethod }),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ["perfumeSales"] })
        queryClient.invalidateQueries({ queryKey: ["perfumeOverdueInstallments"] })
        queryClient.invalidateQueries({ queryKey: ["perfumeClientSummaries"] })
        toast({ title: "Parcela recebida!", description: `R$ ${formatCurrency(amount)} registrado.` })
        onOpenChange(false)
        setPaymentMethod("")
      } else {
        toast({ title: "Erro", description: res.error, variant: "destructive" })
      }
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-500">
            <CheckCircle size={18} /> Receber Parcela
          </DialogTitle>
          <DialogDescription>
            Registrar pagamento de <strong>R$ {formatCurrency(amount)}</strong> — {saleName}
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label className="text-xs uppercase font-semibold">Forma de Pagamento *</Label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {(paymentMethods || []).map(m => (
                <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !paymentMethod}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {mutation.isPending ? "Processando..." : "Confirmar Recebimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ══════════════════════════════════════════════════════════
// REVERSE INSTALLMENT DIALOG
// ══════════════════════════════════════════════════════════

function ReverseInstallmentDialog({ open, onOpenChange, installmentId, saleName }: {
  open: boolean; onOpenChange: (v: boolean) => void; installmentId: string; saleName: string
}) {
  const [reason, setReason] = useState("")
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const mutation = useMutation({
    mutationFn: () => reverseInstallmentPayment({ installment_id: installmentId, reason }),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ["perfumeSales"] })
        queryClient.invalidateQueries({ queryKey: ["perfumeOverdueInstallments"] })
        queryClient.invalidateQueries({ queryKey: ["perfumeClientSummaries"] })
        toast({ title: "Pagamento estornado", description: "Parcela reaberta e movimentos revertidos." })
        onOpenChange(false)
        setReason("")
      } else {
        toast({ title: "Erro", description: res.error, variant: "destructive" })
      }
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-400">
            <RotateCcw size={18} /> Estornar Pagamento de Parcela
          </DialogTitle>
          <DialogDescription>
            Estornar o pagamento da parcela de <strong>{saleName}</strong>. Será criado um movimento inverso no caixa/financeiro.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label className="text-xs uppercase font-semibold">Motivo do estorno *</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Descreva o motivo..." rows={3} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || reason.length < 3}
          >
            {mutation.isPending ? "Estornando..." : "Confirmar Estorno"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
