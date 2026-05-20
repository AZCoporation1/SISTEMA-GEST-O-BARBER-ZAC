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
import type { ReceptionStaff, ReceptionPeriod } from "../types"

interface ReceptionSalaryDialogProps {
  isOpen: boolean
  onClose: () => void
  staff: ReceptionStaff | null
  currentPeriod: ReceptionPeriod | null
  initialSalary?: number | null
}

export function ReceptionSalaryDialog({
  isOpen,
  onClose,
  staff,
  currentPeriod,
  initialSalary,
}: ReceptionSalaryDialogProps) {
  const { updateSalary, isUpdatingSalary } = useReceptionMutations()
  const [salaryStr, setSalaryStr] = React.useState("")
  const [updateBase, setUpdateBase] = React.useState(false)

  React.useEffect(() => {
    if (isOpen && staff) {
      const val = initialSalary !== undefined && initialSalary !== null
        ? initialSalary
        : staff.base_salary_per_period
      setSalaryStr(val ? val.toString() : "")
      setUpdateBase(false)
    }
  }, [isOpen, staff, initialSalary])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!staff || !currentPeriod) return

    const salaryVal = parseFloat(salaryStr)
    if (isNaN(salaryVal) || salaryVal < 0) {
      alert("Por favor, insira um valor de salário válido maior ou igual a zero.")
      return
    }

    const isoPeriod = receptionPeriodToISO(currentPeriod)

    try {
      await updateSalary({
        staffId: staff.id,
        periodStart: isoPeriod.start,
        periodEnd: isoPeriod.end,
        salaryAmount: salaryVal,
        updateBaseSalary: updateBase,
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
            <DialogTitle>Ajustar Salário Quinzenal</DialogTitle>
            <DialogDescription>
              Defina o salário de <strong>{staff.display_name}</strong> para o período de <strong>{currentPeriod.label}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="salaryAmount">Valor do Salário (R$)</Label>
              <Input
                id="salaryAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="Ex: 2500.00"
                value={salaryStr}
                onChange={(e) => setSalaryStr(e.target.value)}
                required
                disabled={isUpdatingSalary}
                autoFocus
              />
            </div>

            <div className="flex items-start gap-2 pt-2">
              <input
                id="updateBase"
                type="checkbox"
                checked={updateBase}
                onChange={(e) => setUpdateBase(e.target.checked)}
                className="mt-1 size-4 rounded border-[var(--border-strong)] accent-[var(--accent)] text-[var(--accent-foreground)]"
                disabled={isUpdatingSalary}
              />
              <div className="grid gap-1.5 leading-none">
                <Label
                  htmlFor="updateBase"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Definir como salário base definitivo
                </Label>
                <p className="text-xs text-[var(--text-muted)]">
                  Se marcado, atualiza o salário padrão das próximas quinzenas no perfil do funcionário.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isUpdatingSalary}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isUpdatingSalary}>
              {isUpdatingSalary ? "Gravando..." : "Salvar Salário"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
