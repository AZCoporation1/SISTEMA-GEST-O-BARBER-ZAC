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
import { useReceptionMutations } from "../hooks/useReception"
import { receptionPeriodToISO } from "../services/receptionPeriodUtils"
import type { ReceptionStaff, ReceptionPeriod, ReceptionAdvanceTypeEnum, ReceptionAdvanceSourceMethodEnum } from "../types"

interface ReceptionAdvanceDialogProps {
  isOpen: boolean
  onClose: () => void
  staff: ReceptionStaff | null
  currentPeriod: ReceptionPeriod | null
}

export function ReceptionAdvanceDialog({
  isOpen,
  onClose,
  staff,
  currentPeriod,
}: ReceptionAdvanceDialogProps) {
  const { registerAdvance, isRegisteringAdvance } = useReceptionMutations()
  const [type, setType] = React.useState<"cash_advance" | "pix_advance" | "manual_deduction">("cash_advance")
  const [description, setDescription] = React.useState("")
  const [amountStr, setAmountStr] = React.useState("")
  const [notes, setNotes] = React.useState("")

  React.useEffect(() => {
    if (isOpen) {
      setType("cash_advance")
      setDescription("")
      setAmountStr("")
      setNotes("")
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!staff || !currentPeriod) return

    const amountVal = parseFloat(amountStr)
    if (isNaN(amountVal) || amountVal <= 0) {
      alert("Por favor, insira um valor válido maior que zero.")
      return
    }

    if (!description.trim()) {
      alert("Por favor, insira uma descrição do vale.")
      return
    }

    const isoPeriod = receptionPeriodToISO(currentPeriod)

    let sourceMethod: ReceptionAdvanceSourceMethodEnum = "caixa"
    if (type === "pix_advance") sourceMethod = "pix"
    if (type === "manual_deduction") sourceMethod = "manual"

    try {
      await registerAdvance({
        staff_id: staff.id,
        type: type as ReceptionAdvanceTypeEnum,
        source_method: sourceMethod,
        description: description.trim(),
        quantity: 1,
        unit_amount: amountVal,
        total_amount: amountVal,
        product_id: null,
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
            <DialogTitle>Lançar Adiantamento / Vale / Dedução</DialogTitle>
            <DialogDescription>
              Lance uma retirada financeira para <strong>{staff.display_name}</strong> que será deduzida do fechamento do período <strong>{currentPeriod.label}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="advanceType">Tipo de Lançamento</Label>
              <select
                id="advanceType"
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="h-9 w-full rounded-lg border px-3 py-1.5 text-sm bg-[var(--bg-elevated)] border-[var(--border-strong)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                disabled={isRegisteringAdvance}
              >
                <option value="cash_advance">Adiantamento em Dinheiro (Retira do Caixa)</option>
                <option value="pix_advance">Adiantamento via PIX (Não retira do Caixa)</option>
                <option value="manual_deduction">Dedução Manual (Apenas ajuste de saldo)</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="description">Descrição / Motivo</Label>
              <Input
                id="description"
                placeholder="Ex: Adiantamento quinzena, Vale almoço, etc."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                disabled={isRegisteringAdvance}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Ex: 150.00"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                required
                disabled={isRegisteringAdvance}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="notes">Observações (Opcional)</Label>
              <Input
                id="notes"
                placeholder="Informações adicionais..."
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
            <Button type="submit" disabled={isRegisteringAdvance}>
              {isRegisteringAdvance ? "Registrando..." : "Registrar Lançamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
