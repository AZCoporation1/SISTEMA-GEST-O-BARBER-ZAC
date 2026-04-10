"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { productSchema, ProductFormValues } from "../validators"
import { useCategories, useBrands } from "../hooks/useInventory"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { 
  Form, 
  FormControl, 
  FormDescription, 
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
import { ProductWithRelations } from "../types"

interface ProductFormProps {
  initialData?: ProductWithRelations | null
  onSubmit: (data: ProductFormValues) => void
  isLoading?: boolean
}

export function ProductForm({ initialData, onSubmit, isLoading }: ProductFormProps) {
  const { data: categories } = useCategories()
  const { data: brands } = useBrands()

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema) as any,
    defaultValues: {
      external_code: initialData?.external_code || "",
      name: initialData?.name || "",
      category_id: initialData?.category_id || "",
      brand_id: initialData?.brand_id || null,
      cost_price: initialData?.cost_price || 0,
      markup_percent: initialData?.markup_percent || 0,
      min_stock: initialData?.min_stock || 0,
      max_stock: initialData?.max_stock || 10,
      initial_quantity: 0,
      is_for_resale: initialData?.is_for_resale ?? true,
      is_for_internal_use: initialData?.is_for_internal_use ?? false,
      notes: initialData?.notes || "",
    }
  })

  // Auto-calculate simulation
  const cost = form.watch("cost_price")
  const markup = form.watch("markup_percent")
  const simulatedPrice = cost + (cost * (markup / 100))

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="external_code"
            render={({ field }) => (
              <FormItem className="sm:col-span-1">
                <FormLabel className="text-sm">Código do Produto*</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: PERF 001" {...field} className="h-10" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="sm:col-span-1 md:col-span-2">
                <FormLabel className="text-sm">Nome do Produto*</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Pomada Efeito Matte 100g" {...field} className="h-10" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="category_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoria*</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories?.filter((cat: any) => cat.id).map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="brand_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Marca (Opcional)</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {brands?.filter((brand: any) => brand.id).map((brand: any) => (
                      <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="section-card">
          <div className="section-card-header">
            <h3 className="section-card-title">Precificação</h3>
          </div>
          <div className="section-card-body grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="cost_price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Custo (R$)*</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01" 
                      min="0"
                      {...field} 
                      onChange={e => field.onChange(parseFloat(e.target.value) || 0)} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="markup_percent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Markup (%)*</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.1" 
                      {...field} 
                      onChange={e => field.onChange(parseFloat(e.target.value) || 0)} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <Label>Preço de Venda Simulado</Label>
              <div className="h-10 px-3 py-2 text-xl font-bold rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 flex items-center">
                R$ {simulatedPrice.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {!initialData && (
            <FormField
              control={form.control}
              name="initial_quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Saldo Inicial</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="min_stock"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estoque Mínimo*</FormLabel>
                <FormControl>
                  <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="max_stock"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estoque Máximo*</FormLabel>
                <FormControl>
                  <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="section-card">
          <div className="section-card-header">
            <h3 className="section-card-title">Regras e Finalidade</h3>
          </div>
          <div className="section-card-body flex flex-col sm:flex-row gap-6">
            <FormField
              control={form.control}
              name="is_for_resale"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 w-full bg-background">
                  <div className="space-y-0.5">
                    <FormLabel>Para Revenda</FormLabel>
                    <FormDescription>Disponível no PDV.</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="is_for_internal_use"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 w-full bg-background">
                  <div className="space-y-0.5">
                    <FormLabel>Uso Interno</FormLabel>
                    <FormDescription>Usado pelos profissionais.</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Input placeholder="Notas opcionais..." {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Salvando..." : "Salvar Produto"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
