"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  openSessionSchema, closeSessionSchema, cashEntrySchema,
  OpenSessionValues, CloseSessionValues, CashEntryValues
} from "../validators"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Constants } from "@/types/supabase"

interface OpenFormProps { onSubmit: (data: OpenSessionValues) => void; isLoading?: boolean }
interface CloseFormProps { onSubmit: (data: CloseSessionValues) => void; isLoading?: boolean; currentBalance: number }
interface EntryFormProps { onSubmit: (data: CashEntryValues) => void; isLoading?: boolean; sessionId: string; paymentMethods: any[] }

const ENTRY_LABELS: Record<string, string> = {
  "income": "Receita Geral",
  "expense": "Despesa",
  "withdrawal": "Retirada / Sangria",
  "reinforcement": "Suprimento / Reforço",
  "manual_income": "Receita Avulsa",
  "manual_expense": "Despesa Avulsa",
}

// Only the entry types allowed for manual entries (not sale_income which is system-generated)
const MANUAL_ENTRY_TYPES = ["expense", "manual_expense", "withdrawal", "reinforcement", "manual_income"] as const

export function OpenSessionForm({ onSubmit, isLoading }: OpenFormProps) {
  const form = useForm<OpenSessionValues>({
    resolver: zodResolver(openSessionSchema),
    // field: opening_amount (matches DB)
    defaultValues: { opening_amount: 0, notes: "" }
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="opening_amount" render={({ field }) => (
          <FormItem>
            <FormLabel>Saldo Inicial (Troco em Caixa) R$*</FormLabel>
            <FormControl>
              <Input type="number" step="0.01" min="0" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem>
            <FormLabel>Observações</FormLabel>
            <FormControl><Input {...field} value={field.value || ""} /></FormControl>
          </FormItem>
        )} />
        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isLoading}>{isLoading ? "Abrindo..." : "Abrir Caixa"}</Button>
        </div>
      </form>
    </Form>
  )
}

export function CloseSessionForm({ onSubmit, isLoading, currentBalance }: CloseFormProps) {
  const form = useForm<CloseSessionValues>({
    resolver: zodResolver(closeSessionSchema),
    // field: closing_amount (matches DB)
    defaultValues: { closing_amount: currentBalance, notes: "" }
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="p-3 bg-muted/50 rounded-md mb-4 text-sm">
          O sistema espera um saldo na gaveta de: <strong>R$ {currentBalance.toFixed(2)}</strong>.<br />
          Conte o dinheiro, informe o valor real e feche o caixa.
        </div>
        <FormField control={form.control} name="closing_amount" render={({ field }) => (
          <FormItem>
            <FormLabel>Saldo Real Conferido R$*</FormLabel>
            <FormControl>
              <Input type="number" step="0.01" min="0" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem>
            <FormLabel>Justificativa / Observações</FormLabel>
            <FormControl><Input {...field} value={field.value || ""} /></FormControl>
          </FormItem>
        )} />
        <div className="flex justify-end pt-2">
          <Button type="submit" variant="destructive" disabled={isLoading}>
            {isLoading ? "Fechando..." : "Encerrar Sessão e Fechar Caixa"}
          </Button>
        </div>
      </form>
    </Form>
  )
}

export function CashEntryForm({ onSubmit, isLoading, sessionId, paymentMethods }: EntryFormProps) {
  const form = useForm<CashEntryValues>({
    resolver: zodResolver(cashEntrySchema),
    defaultValues: {
      cash_session_id: sessionId,
      entry_type: "expense",
      amount: 0,
      category: "",
      description: "",
      payment_method_id: paymentMethods.length > 0 ? paymentMethods[0].id : null,
    }
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="entry_type" render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Lançamento*</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  {MANUAL_ENTRY_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{ENTRY_LABELS[type] || type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="amount" render={({ field }) => (
            <FormItem>
              <FormLabel>Valor R$*</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" min="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="category" render={({ field }) => (
            <FormItem>
              <FormLabel>Categoria*</FormLabel>
              <FormControl><Input placeholder="Ex: Material de Limpeza" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="payment_method_id" render={({ field }) => (
            <FormItem>
              <FormLabel>Forma de Pagamento</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                <FormControl><SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger></FormControl>
                <SelectContent>
                  {paymentMethods.filter(pm => pm.id).map(pm => (
                    <SelectItem key={pm.id} value={pm.id}>{pm.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem>
            <FormLabel>Descrição Detalhada*</FormLabel>
            <FormControl><Input placeholder="Motivo exato da movimentação..." {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isLoading}>{isLoading ? "Registrando..." : "Registrar Lançamento"}</Button>
        </div>
      </form>
    </Form>
  )
}
