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
import { useReceptionMutations } from "../hooks/useReception"
import { AlertTriangle, Banknote, Landmark } from "lucide-react"
import type { ReceptionClosure } from "../types"

interface ReceptionPaymentDialogProps {
  isOpen: boolean
  onClose: () => void
  closure: ReceptionClosure | null
}

export function ReceptionPaymentDialog({
  isOpen,
  onClose,
  closure,
}: ReceptionPaymentDialogProps) {
  const { payClosure, isPayingClosure } = useReceptionMutations()
  const [paidMethod, setPaidMethod] = React.useState<"caixa" | "pix">("caixa")

  React.useEffect(() => {
    if (isOpen) {
      setPaidMethod("caixa")
    }
  }, [isOpen])

  const handlePay = async () => {
    if (!closure) return

    try {
      await payClosure({
        closureId: closure.id,
        paidMethod,
      })
      onClose()
    } catch (err) {
      console.error(err)
    }
  }

  if (!closure) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Efetuar Pagamento de Fechamento</DialogTitle>
          <DialogDescription>
            Defina como deseja registrar a quitação de <strong>R$ {closure.net_payable.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong> para o recepcionista.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Opções de Pagamento */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPaidMethod("caixa")}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all ${
                paidMethod === "caixa"
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                  : "border-[var(--border-strong)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
              }`}
            >
              <Banknote className="size-8 mb-2" />
              <span className="text-xs font-bold block">Dinheiro (Caixa)</span>
              <span className="text-[10px] text-[var(--text-muted)] mt-0.5">Retira do caixa físico aberto</span>
            </button>

            <button
              type="button"
              onClick={() => setPaidMethod("pix")}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all ${
                paidMethod === "pix"
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                  : "border-[var(--border-strong)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
              }`}
            >
              <Landmark className="size-8 mb-2" />
              <span className="text-xs font-bold block">PIX Bancário</span>
              <span className="text-[10px] text-[var(--text-muted)] mt-0.5">Apenas lançamento financeiro</span>
            </button>
          </div>

          {/* Avisos Importantes */}
          {paidMethod === "caixa" ? (
            <div className="p-3.5 rounded-lg bg-[var(--bg-hover)] border border-[var(--border)] text-xs text-[var(--text-secondary)] space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                <AlertTriangle className="size-3.5 text-yellow-500" />
                <span>Requisito de Caixa Aberto</span>
              </div>
              <p className="leading-relaxed">
                Este pagamento exige que exista um <strong>caixa aberto</strong> no sistema. Uma despesa automática de R$ {closure.net_payable.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} será lançada na sessão de caixa atual, reduzindo o saldo físico disponível.
              </p>
            </div>
          ) : (
            <div className="p-3.5 rounded-lg bg-[var(--bg-hover)] border border-[var(--border)] text-xs text-[var(--text-secondary)] space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                <AlertTriangle className="size-3.5 text-blue-500" />
                <span>Lançamento Direto</span>
              </div>
              <p className="leading-relaxed">
                O pagamento via PIX registrará uma despesa operacional na data de hoje em seu **fluxo de caixa**, mas **não afetará** o caixa físico aberto na barbearia. É ideal para transferências feitas diretamente da conta bancária da empresa.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isPayingClosure}
          >
            Cancelar
          </Button>
          <Button
            onClick={handlePay}
            disabled={isPayingClosure}
            className="bg-[var(--accent)] font-bold text-[#0a0a0f]"
          >
            {isPayingClosure ? "Gravando Quitação..." : "Registrar Pagamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
