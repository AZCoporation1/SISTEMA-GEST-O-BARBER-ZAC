"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { movementSchema, MovementFormValues } from "../validators"
import { useInventory } from "@/features/inventory/hooks/useInventory"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Constants } from "@/types/supabase"

interface MovementFormProps {
  onSubmit: (data: MovementFormValues) => void
  isLoading?: boolean
  initialProductId?: string
  initialType?: any
}

const MOVEMENT_LABELS: Record<string, string> = {
  "initial_balance": "Saldo Inicial",
  "purchase_entry": "Entrada de Compra",
  "manual_adjustment_in": "Ajuste Manual (Entrada)",
  "return_from_customer": "Retorno de Cliente",
  "sale_exit": "Saída por Venda",
  "internal_consumption": "Consumo Interno",
  "loss": "Retirada/Perda",
  "damage": "Dano/Avaria",
  "manual_adjustment_out": "Ajuste Manual (Saída)",
  "transfer": "Transferência",
  "supplier_return": "Devolução ao Fornecedor",
}

export function MovementForm({ onSubmit, isLoading, initialProductId, initialType }: MovementFormProps) {
  // Pass realistic wide limit since we haven't implemented async comboboxes yet
  const { data: inventory } = useInventory({ page: 1, perPage: 1000 })

  const form = useForm<MovementFormValues>({
    resolver: zodResolver(movementSchema),
    defaultValues: {
      product_id: initialProductId || "",
      movement_type: initialType || "manual_adjustment_in" as any,
      quantity: 1,
      movement_reason: "",
      notes: "",
    }
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        
        <FormField
          control={form.control}
          name="product_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Produto*</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um produto..." />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(inventory?.data || []).map((item) => (
                    <SelectItem key={item.product_id} value={item.product_id!}>
                      {item.product_name} (Estoque atual: {item.current_balance})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="movement_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Movimentação*</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Constants.public.Enums.movement_type_enum.map((type) => (
                      <SelectItem key={type} value={type}>
                        {MOVEMENT_LABELS[type] || type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantidade*</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min="1"
                    {...field} 
                    onChange={e => field.onChange(parseInt(e.target.value) || 0)} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="movement_reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Motivo*</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Ajuste após contagem..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações (Opcional)</FormLabel>
              <FormControl>
                <Input placeholder="Detalhes adicionais..." {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Registrando..." : "Registrar Movimentação"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
