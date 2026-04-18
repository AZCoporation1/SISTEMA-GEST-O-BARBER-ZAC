"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form"
import { CustomerNode } from "../types"
import { customerSchema, CustomerFormValues } from "../validators"
import { useCustomerMutations } from "../hooks/useCustomers"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer?: CustomerNode | null
}

export function CustomerFormDialog({ open, onOpenChange, customer }: Props) {
  const { saveCustomer, isSaving } = useCustomerMutations()

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      id: customer?.id || "",
      full_name: customer?.full_name || "",
      mobile_phone: customer?.mobile_phone || "",
      email: customer?.email || "",
      cpf: customer?.cpf || "",
      rg: customer?.rg || "",
      gender: customer?.gender || "",
      birth_date: customer?.birth_date || "",
      address_line: customer?.address_line || "",
      neighborhood: customer?.neighborhood || "",
      city: customer?.city || "",
      state: customer?.state || "",
      postal_code: customer?.postal_code || "",
      address_number: customer?.address_number || "",
      complement: customer?.complement || "",
      notes: customer?.notes || "",
      referral_source: customer?.referral_source || "",
      is_active: customer ? customer.is_active : true,
    }
  })

  useEffect(() => {
    if (open) {
      if (customer) {
        form.reset({
          id: customer.id,
          full_name: customer.full_name,
          mobile_phone: customer.mobile_phone || "",
          email: customer.email || "",
          cpf: customer.cpf || "",
          rg: customer.rg || "",
          gender: customer.gender || "",
          birth_date: customer.birth_date || "",
          address_line: customer.address_line || "",
          neighborhood: customer.neighborhood || "",
          city: customer.city || "",
          state: customer.state || "",
          postal_code: customer.postal_code || "",
          address_number: customer.address_number || "",
          complement: customer.complement || "",
          notes: customer.notes || "",
          referral_source: customer.referral_source || "",
          is_active: customer.is_active ?? true,
        })
      } else {
        form.reset({
          id: "",
          full_name: "",
          mobile_phone: "",
          email: "",
          cpf: "",
          rg: "",
          gender: "",
          birth_date: "",
          address_line: "",
          neighborhood: "",
          city: "",
          state: "",
          postal_code: "",
          address_number: "",
          complement: "",
          notes: "",
          referral_source: "",
          is_active: true,
        })
      }
    }
  }, [open, customer, form])

  const onSubmit = async (data: CustomerFormValues) => {
    await saveCustomer(data)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{customer ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            
            <div className="grid grid-cols-2 gap-4 border-b pb-4">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem className="col-span-2 sm:col-span-1">
                    <FormLabel>Nome Completo *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do cliente" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mobile_phone"
                render={({ field }) => (
                  <FormItem className="col-span-2 sm:col-span-1">
                    <FormLabel>Celular</FormLabel>
                    <FormControl>
                      <Input placeholder="(00) 00000-0000" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-6">
              <div className="border rounded-md p-4">
                <h3 className="text-sm font-semibold mb-3">Dados Pessoais</h3>
                  <div className="grid grid-cols-2 gap-4 px-1 py-0">
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem className="col-span-2"><FormLabel>E-mail</FormLabel><FormControl><Input placeholder="email@exemplo.com" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="cpf" render={({ field }) => (
                      <FormItem className="col-span-2 sm:col-span-1"><FormLabel>CPF</FormLabel><FormControl><Input placeholder="000.000.000-00" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="rg" render={({ field }) => (
                      <FormItem className="col-span-2 sm:col-span-1"><FormLabel>RG</FormLabel><FormControl><Input placeholder="00.000.000-0" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="birth_date" render={({ field }) => (
                      <FormItem className="col-span-2 sm:col-span-1"><FormLabel>Nascimento</FormLabel><FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="gender" render={({ field }) => (
                      <FormItem className="col-span-2 sm:col-span-1"><FormLabel>Sexo</FormLabel><FormControl><Input placeholder="M / F" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
              </div>

              <div className="border rounded-md p-4">
                <h3 className="text-sm font-semibold mb-3">Endereço</h3>
                  <div className="grid grid-cols-6 gap-4 px-1 py-0">
                    <FormField control={form.control} name="postal_code" render={({ field }) => (
                      <FormItem className="col-span-6 sm:col-span-2"><FormLabel>CEP</FormLabel><FormControl><Input placeholder="00000-000" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="address_line" render={({ field }) => (
                      <FormItem className="col-span-6 sm:col-span-4"><FormLabel>Endereço</FormLabel><FormControl><Input placeholder="Rua, Avenida..." {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="address_number" render={({ field }) => (
                      <FormItem className="col-span-6 sm:col-span-2"><FormLabel>Número</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="complement" render={({ field }) => (
                      <FormItem className="col-span-6 sm:col-span-4"><FormLabel>Complemento</FormLabel><FormControl><Input placeholder="Apto, Bloco, etc" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="neighborhood" render={({ field }) => (
                      <FormItem className="col-span-6 sm:col-span-2"><FormLabel>Bairro</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="city" render={({ field }) => (
                      <FormItem className="col-span-6 sm:col-span-3"><FormLabel>Cidade</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="state" render={({ field }) => (
                      <FormItem className="col-span-6 sm:col-span-1"><FormLabel>UF</FormLabel><FormControl><Input placeholder="SP" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
              </div>

              <div className="border rounded-md p-4">
                <h3 className="text-sm font-semibold mb-3">Outras Informações</h3>
                  <div className="grid grid-cols-1 gap-4 px-1 py-0">
                    <FormField control={form.control} name="referral_source" render={({ field }) => (
                      <FormItem><FormLabel>Como Soube</FormLabel><FormControl><Input placeholder="Insta, Google, Amigo..." {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="notes" render={({ field }) => (
                      <FormItem><FormLabel>Observações</FormLabel><FormControl><Textarea placeholder="Observações..." {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
