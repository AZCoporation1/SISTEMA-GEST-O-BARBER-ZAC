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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useReceptionMutations, useProductsForWithdrawal } from "../hooks/useReception"
import { receptionPeriodToISO } from "../services/receptionPeriodUtils"
import type { ReceptionStaff, ReceptionPeriod } from "../types"

interface ReceptionStockWithdrawalDialogProps {
  isOpen: boolean
  onClose: () => void
  staff: ReceptionStaff | null
  currentPeriod: ReceptionPeriod | null
}

export function ReceptionStockWithdrawalDialog({
  isOpen,
  onClose,
  staff,
  currentPeriod,
}: ReceptionStockWithdrawalDialogProps) {
  const { registerAdvance, isRegisteringAdvance } = useReceptionMutations()
  const { data: products, isLoading: isLoadingProducts } = useProductsForWithdrawal()

  const [selectedProductId, setSelectedProductId] = React.useState("")
  const [quantity, setQuantity] = React.useState(1)
  const [customPriceStr, setCustomPriceStr] = React.useState("")
  const [notes, setNotes] = React.useState("")

  const selectedProduct = React.useMemo(() => {
    return products?.find((p) => p.product_id === selectedProductId) || null
  }, [products, selectedProductId])

  React.useEffect(() => {
    if (isOpen) {
      setSelectedProductId("")
      setQuantity(1)
      setCustomPriceStr("")
      setNotes("")
    }
  }, [isOpen])

  React.useEffect(() => {
    if (selectedProduct) {
      setCustomPriceStr(selectedProduct.sale_price ? selectedProduct.sale_price.toString() : "")
    }
  }, [selectedProduct])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!staff || !currentPeriod || !selectedProduct) return

    if (quantity <= 0) {
      alert("A quantidade deve ser maior que zero.")
      return
    }

    if (quantity > selectedProduct.current_balance) {
      alert(`Quantidade indisponível no estoque. Saldo atual: ${selectedProduct.current_balance}`)
      return
    }

    const priceVal = parseFloat(customPriceStr)
    if (isNaN(priceVal) || priceVal <= 0) {
      alert("Por favor, insira um valor unitário maior que zero.")
      return
    }

    const isoPeriod = receptionPeriodToISO(currentPeriod)
    const totalAmount = quantity * priceVal

    try {
      await registerAdvance({
        staff_id: staff.id,
        type: "stock_withdrawal",
        source_method: "estoque",
        description: `Retirada produto: ${selectedProduct.product_name} (${quantity}x)`,
        quantity,
        unit_amount: priceVal,
        total_amount: totalAmount,
        product_id: selectedProduct.product_id,
        period_start: isoPeriod.start,
        period_end: isoPeriod.end,
        notes: notes.trim() || null,
      })
      onClose()
    } catch (err) {
      console.error(err)
    }
  }

  if (!staff || !currentPeriod) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Retirada de Produto do Estoque</DialogTitle>
            <DialogDescription>
              Registre a retirada de um produto do estoque por <strong>{staff.display_name}</strong>. O valor total de venda será deduzido de seu saldo quinzenal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="productId">Produto</Label>
              {isLoadingProducts ? (
                <div className="text-xs text-[var(--text-muted)] py-2">Carregando estoque disponível...</div>
              ) : (
                <select
                  id="productId"
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="h-9 w-full rounded-lg border px-3 py-1.5 text-sm bg-[var(--bg-elevated)] border-[var(--border-strong)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                  disabled={isRegisteringAdvance}
                  required
                >
                  <option value="">Selecione um produto...</option>
                  {products?.map((p) => (
                    <option key={p.product_id} value={p.product_id}>
                      {p.product_name} ({p.category_name || "Sem Categoria"}) — {p.current_balance} unid. rest.
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedProduct && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="qty">Quantidade</Label>
                    <Input
                      id="qty"
                      type="number"
                      min="1"
                      max={selectedProduct.current_balance}
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                      required
                      disabled={isRegisteringAdvance}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="unitPrice">Valor de Desconto Unitário (R$)</Label>
                    <Input
                      id="unitPrice"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={customPriceStr}
                      onChange={(e) => setCustomPriceStr(e.target.value)}
                      required
                      disabled={isRegisteringAdvance}
                    />
                  </div>
                </div>

                <div className="rounded-lg p-3 bg-[var(--bg-hover)] border border-[var(--border)] text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Saldo Atual no Estoque:</span>
                    <span className="font-semibold">{selectedProduct.current_balance} unidades</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Preço de Venda Padrão:</span>
                    <span className="font-semibold">R$ {selectedProduct.sale_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="border-t border-[var(--border)] my-1 pt-1 flex justify-between text-sm font-bold">
                    <span>Dedução Total:</span>
                    <span className="text-[var(--danger)]">
                      R$ {((quantity * (parseFloat(customPriceStr) || 0))).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1">
              <Label htmlFor="notes">Observações (Opcional)</Label>
              <Input
                id="notes"
                placeholder="Observações ou motivo do consumo..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isRegisteringAdvance}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isRegisteringAdvance}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isRegisteringAdvance || !selectedProductId}>
              {isRegisteringAdvance ? "Baixando Estoque..." : "Registrar Retirada"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
