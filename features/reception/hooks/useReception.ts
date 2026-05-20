import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  getReceptionStaff,
  getReceptionAdvances,
  getReceptionClosures,
  getProductsForWithdrawal,
} from "../services/reception.service"
import {
  updateReceptionSalary,
  registerReceptionAdvance,
  cancelReceptionAdvance,
  confirmReceptionClosure,
  payReceptionClosure,
  cancelReceptionClosure,
  generateReceptionClosurePreview,
} from "../actions/reception.actions"
import type { RegisterReceptionAdvanceInput, ConfirmReceptionClosureInput } from "../types"

// ── Staff Query ───────────────────────────────────────────
export function useReceptionStaff() {
  return useQuery({
    queryKey: ["reception", "staff"],
    queryFn: () => getReceptionStaff(),
  })
}

// ── Closures Query ────────────────────────────────────────
export function useReceptionClosures(staffId?: string) {
  return useQuery({
    queryKey: ["reception", "closures", staffId || "all"],
    queryFn: () => getReceptionClosures(staffId),
  })
}

// ── Advances Query ────────────────────────────────────────
export function useReceptionAdvances(
  staffId: string,
  periodStart?: string,
  periodEnd?: string,
  statusFilter: string = "all"
) {
  return useQuery({
    queryKey: ["reception", "advances", staffId, periodStart || "all", periodEnd || "all", statusFilter],
    queryFn: () => getReceptionAdvances(staffId, periodStart, periodEnd, statusFilter),
    enabled: !!staffId,
  })
}

// ── Products for Withdrawal Query ─────────────────────────
export function useProductsForWithdrawal() {
  return useQuery({
    queryKey: ["reception", "products-withdrawal"],
    queryFn: () => getProductsForWithdrawal(),
  })
}

// ── Closure Preview (Dynamic Query / Mutation Hybrid) ─────
export function useReceptionClosurePreview() {
  const mutation = useMutation({
    mutationFn: async ({
      staffId,
      periodStart,
      periodEnd,
    }: {
      staffId: string
      periodStart: string
      periodEnd: string
    }) => {
      const res = await generateReceptionClosurePreview(staffId, periodStart, periodEnd)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
  })

  return {
    loadPreview: mutation.mutateAsync,
    previewData: mutation.data,
    isLoading: mutation.isPending,
    error: mutation.error,
  }
}

// ── Centralized Mutations ─────────────────────────────────
export function useReceptionMutations() {
  const queryClient = useQueryClient()

  // Invalidate all reception queries
  const invalidateReception = () => {
    queryClient.invalidateQueries({ queryKey: ["reception"] })
  }

  // 1. Update Salary
  const updateSalaryMutation = useMutation({
    mutationFn: async (variables: {
      staffId: string
      periodStart: string
      periodEnd: string
      salaryAmount: number
      updateBaseSalary: boolean
    }) => {
      const res = await updateReceptionSalary(
        variables.staffId,
        variables.periodStart,
        variables.periodEnd,
        variables.salaryAmount,
        variables.updateBaseSalary
      )
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      toast.success("Salário atualizado com sucesso!")
      invalidateReception()
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao atualizar salário")
    },
  })

  // 2. Register Advance
  const registerAdvanceMutation = useMutation({
    mutationFn: async (data: RegisterReceptionAdvanceInput) => {
      const res = await registerReceptionAdvance(data)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: (data: any) => {
      if (!data) return
      const label =
        data.type === "stock_withdrawal"
          ? "Retirada de estoque registrada!"
          : "Adiantamento/vale lançado com sucesso!"
      toast.success(label)
      invalidateReception()
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao registrar adiantamento")
    },
  })

  // 3. Cancel Advance
  const cancelAdvanceMutation = useMutation({
    mutationFn: async (variables: { advanceId: string; reason: string }) => {
      const res = await cancelReceptionAdvance(variables.advanceId, variables.reason)
      if (!res.success) throw new Error(res.error)
      return res
    },
    onSuccess: () => {
      toast.success("Adiantamento cancelado e estornos efetuados!")
      invalidateReception()
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao cancelar adiantamento")
    },
  })

  // 4. Confirm Closure
  const confirmClosureMutation = useMutation({
    mutationFn: async (data: ConfirmReceptionClosureInput) => {
      const res = await confirmReceptionClosure(data)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      toast.success("Fechamento quinzenal confirmado com sucesso!")
      invalidateReception()
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao confirmar fechamento")
    },
  })

  // 5. Pay Closure
  const payClosureMutation = useMutation({
    mutationFn: async (variables: { closureId: string; paidMethod: "caixa" | "pix" }) => {
      const res = await payReceptionClosure(variables.closureId, variables.paidMethod)
      if (!res.success) throw new Error(res.error)
      return res
    },
    onSuccess: (_, variables) => {
      toast.success(`Fechamento marcado como pago via ${variables.paidMethod.toUpperCase()}!`)
      invalidateReception()
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao registrar pagamento")
    },
  })

  // 6. Cancel Closure
  const cancelClosureMutation = useMutation({
    mutationFn: async (variables: { closureId: string; reason: string }) => {
      const res = await cancelReceptionClosure(variables.closureId, variables.reason)
      if (!res.success) throw new Error(res.error)
      return res
    },
    onSuccess: () => {
      toast.success("Fechamento cancelado e estornos efetuados!")
      invalidateReception()
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao cancelar fechamento")
    },
  })

  return {
    updateSalary: updateSalaryMutation.mutateAsync,
    isUpdatingSalary: updateSalaryMutation.isPending,
    registerAdvance: registerAdvanceMutation.mutateAsync,
    isRegisteringAdvance: registerAdvanceMutation.isPending,
    cancelAdvance: cancelAdvanceMutation.mutateAsync,
    isCancellingAdvance: cancelAdvanceMutation.isPending,
    confirmClosure: confirmClosureMutation.mutateAsync,
    isConfirmingClosure: confirmClosureMutation.isPending,
    payClosure: payClosureMutation.mutateAsync,
    isPayingClosure: payClosureMutation.isPending,
    cancelClosure: cancelClosureMutation.mutateAsync,
    isCancellingClosure: cancelClosureMutation.isPending,
  }
}
