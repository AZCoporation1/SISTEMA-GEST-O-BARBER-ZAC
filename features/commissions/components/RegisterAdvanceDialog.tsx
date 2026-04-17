"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { useProductsForAdvance } from "../hooks/useProfessionals"
import { registerAdvance } from "../actions/professionals.actions"
import { ADVANCE_TYPE_LABELS } from "../types"
import type { RegisterAdvanceInput } from "../types"
import type { AdvanceTypeEnum, AdvanceSourceMethodEnum } from "@/types/supabase"
import { Banknote, CreditCard, Package, PenTool, Clock } from "lucide-react"

interface RegisterAdvanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  professionalId: string
  professionalName: string
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  cash_advance: Banknote,
  pix_advance: CreditCard,
  stock_consumption: Package,
  manual_deduction: PenTool,
  deferred_deduction: Clock,
}

const TYPE_TO_SOURCE: Record<AdvanceTypeEnum, AdvanceSourceMethodEnum> = {
  cash_advance: 'caixa',
  pix_advance: 'pix',
  stock_consumption: 'estoque',
  manual_deduction: 'manual',
  deferred_deduction: 'manual',
}

export function RegisterAdvanceDialog({
  open,
  onOpenChange,
  professionalId,
  professionalName,
}: RegisterAdvanceDialogProps) {
  const [type, setType] = useState<AdvanceTypeEnum>('cash_advance')
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [unitAmount, setUnitAmount] = useState(0)
  const [productId, setProductId] = useState<string>('')
  const [carryOver, setCarryOver] = useState(false)
  const [notes, setNotes] = useState('')

  const { data: products } = useProductsForAdvance()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const mutation = useMutation({
    mutationFn: (data: RegisterAdvanceInput) => registerAdvance(data),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ["professionalAdvances"] })
        queryClient.invalidateQueries({ queryKey: ["professionalSales"] })
        queryClient.invalidateQueries({ queryKey: ["professionals"] })
        queryClient.invalidateQueries({ queryKey: ["cash"] })
        queryClient.invalidateQueries({ queryKey: ["inventory"] })
        toast({ title: "Adiantamento registrado!", description: `R$ ${(quantity * unitAmount).toFixed(2)}` })
        resetForm()
        onOpenChange(false)
      } else {
        toast({ title: "Erro", description: res.error, variant: "destructive" })
      }
    },
    onError: (err: any) => {
      toast({ title: "Erro inesperado", description: err.message, variant: "destructive" })
    }
  })

  const resetForm = () => {
    setType('cash_advance')
    setDescription('')
    setQuantity(1)
    setUnitAmount(0)
    setProductId('')
    setCarryOver(false)
    setNotes('')
  }

  const handleProductSelect = (pId: string) => {
    setProductId(pId)
    const product = (products || []).find((p: any) => p.product_id === pId) as any
    if (product) {
      setUnitAmount(product.sale_price || 0)
      setDescription(product.product_name || '')
    }
  }

  const totalAmount = quantity * unitAmount
  const isValid = description.trim() !== '' && unitAmount > 0 && quantity > 0

  const handleSubmit = () => {
    if (!isValid) return
    mutation.mutate({
      professional_id: professionalId,
      type,
      source_method: TYPE_TO_SOURCE[type],
      description,
      quantity,
      unit_amount: unitAmount,
      total_amount: totalAmount,
      product_id: type === 'stock_consumption' ? productId || null : null,
      carry_over_to_next_period: carryOver || type === 'deferred_deduction',
      notes: notes || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar Adiantamento / Pego</DialogTitle>
          <DialogDescription>
            Profissional: <span className="font-semibold text-[var(--text-primary)]">{professionalName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Type selector */}
          <div>
            <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider block mb-2">
              Tipo do Adiantamento
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(ADVANCE_TYPE_LABELS) as AdvanceTypeEnum[]).map((t) => {
                const Icon = TYPE_ICONS[t]
                const isSelected = type === t
                return (
                  <button
                    key={t}
                    onClick={() => { setType(t); setProductId(''); setDescription(''); setUnitAmount(0) }}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                      isSelected
                        ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]'
                        : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <Icon size={14} />
                    <span className="truncate">{ADVANCE_TYPE_LABELS[t].replace('Adiantamento ', '').replace('Dedução ', '')}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Product picker for stock consumption */}
          {type === 'stock_consumption' && (
            <div>
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider block mb-1.5">
                Produto do Estoque
              </label>
              <Select value={productId} onValueChange={handleProductSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto..." />
                </SelectTrigger>
                <SelectContent>
                  {(products || []).map((p: any) => (
                    <SelectItem key={p.product_id} value={p.product_id}>
                      {p.product_name} — R$ {p.sale_price?.toFixed(2)} (est: {p.current_balance})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider block mb-1.5">
              Descrição
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: 2 Coca, Relógio, Adiantamento..."
            />
          </div>

          {/* Quantity + Unit Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider block mb-1.5">
                Quantidade
              </label>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider block mb-1.5">
                Valor Unitário (R$)
              </label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={unitAmount || ''}
                onChange={(e) => setUnitAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-border)]">
            <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Total</span>
            <span className="text-lg font-bold text-[var(--accent)]">R$ {totalAmount.toFixed(2)}</span>
          </div>

          {/* Carry over toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)]">
            <div>
              <p className="text-sm font-medium">Descontar no próximo período</p>
              <p className="text-xs text-[var(--text-secondary)]">Ex: "Relógio 323,00 (mês que vem)"</p>
            </div>
            <Switch checked={carryOver} onCheckedChange={setCarryOver} />
          </div>

          {/* Notes */}
          <div>
            <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider block mb-1.5">
              Observações (opcional)
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionais..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            className="btn-primary"
            disabled={!isValid || mutation.isPending}
            onClick={handleSubmit}
          >
            {mutation.isPending ? 'Registrando...' : 'Confirmar Adiantamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
