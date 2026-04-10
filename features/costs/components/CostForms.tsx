"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { fixedCostSchema, variableCostSchema, FixedCostFormValues, VariableCostFormValues } from "../types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface FixedCostFormProps {
  onSubmit: (data: FixedCostFormValues) => void
  isLoading?: boolean
  initialData?: any
}

interface VariableCostFormProps {
  onSubmit: (data: VariableCostFormValues) => void
  isLoading?: boolean
}

const COST_CATEGORIES = [
  "Aluguel", "Energia", "Água", "Internet", "Telefone", "Software/Sistema",
  "Contador", "Seguro", "Manutenção", "Materiais de Limpeza", "Marketing",
  "Salários", "Encargos", "Outros"
]

const FREQUENCIES = [
  { value: "monthly", label: "Mensal" },
  { value: "weekly", label: "Semanal" },
  { value: "yearly", label: "Anual" },
  { value: "biweekly", label: "Quinzenal" },
]

export function FixedCostForm({ onSubmit, isLoading, initialData }: FixedCostFormProps) {
  const form = useForm<FixedCostFormValues>({
    resolver: zodResolver(fixedCostSchema),
    defaultValues: {
      name: initialData?.name || "",
      amount: initialData?.amount || 0,
      category: initialData?.category || "",
      frequency: initialData?.frequency || "monthly",
      due_day: initialData?.due_day || null,
      is_active: initialData?.is_active ?? true,
      notes: initialData?.notes || "",
    }
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Nome da Despesa*</FormLabel>
            <FormControl><Input placeholder="Ex: Aluguel do salão" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="amount" render={({ field }) => (
            <FormItem>
              <FormLabel>Valor (R$)*</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" min="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="category" render={({ field }) => (
            <FormItem>
              <FormLabel>Categoria*</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                <SelectContent>
                  {COST_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="frequency" render={({ field }) => (
            <FormItem>
              <FormLabel>Recorrência*</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="due_day" render={({ field }) => (
            <FormItem>
              <FormLabel>Dia de Vencimento</FormLabel>
              <FormControl>
                <Input type="number" min="1" max="31" placeholder="Ex: 10" {...field} value={field.value || ""} onChange={e => field.onChange(parseInt(e.target.value) || null)} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="is_active" render={({ field }) => (
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium text-sm">Ativo</p>
              <p className="text-xs text-muted-foreground">Incluir no cálculo de custos fixos mensais.</p>
            </div>
            <Switch checked={field.value} onCheckedChange={field.onChange} />
          </div>
        )} />

        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem>
            <FormLabel>Observações</FormLabel>
            <FormControl><Input placeholder="Notas opcionais..." {...field} value={field.value || ""} /></FormControl>
          </FormItem>
        )} />

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isLoading}>{isLoading ? "Salvando..." : "Salvar Custo Fixo"}</Button>
        </div>
      </form>
    </Form>
  )
}

export function VariableCostForm({ onSubmit, isLoading }: VariableCostFormProps) {
  const form = useForm<VariableCostFormValues>({
    resolver: zodResolver(variableCostSchema),
    defaultValues: {
      name: "",
      amount: 0,
      category: "",
      occurred_on: new Date().toISOString().split("T")[0],
      notes: "",
    }
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Descrição da Despesa*</FormLabel>
            <FormControl><Input placeholder="Ex: Compra de produto de limpeza" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="amount" render={({ field }) => (
            <FormItem>
              <FormLabel>Valor (R$)*</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" min="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="category" render={({ field }) => (
            <FormItem>
              <FormLabel>Categoria*</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                <SelectContent>
                  {COST_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="occurred_on" render={({ field }) => (
          <FormItem>
            <FormLabel>Data de Ocorrência</FormLabel>
            <FormControl><Input type="date" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem>
            <FormLabel>Observações</FormLabel>
            <FormControl><Input placeholder="Detalhes adicionais..." {...field} value={field.value || ""} /></FormControl>
          </FormItem>
        )} />

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isLoading}>{isLoading ? "Registrando..." : "Registrar Custo Variável"}</Button>
        </div>
      </form>
    </Form>
  )
}
