"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"
import { Building2, Bell, Bot } from "lucide-react"

import { useAppSettings, useSettingsMutations } from "../hooks/useSettings"
import { settingsSchema, SettingsFormValues } from "../validators"

export function SettingsView() {
  const { data: settings, isLoading: isFetching } = useAppSettings()
  const { updateSettings, isUpdating } = useSettingsMutations()

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      organization_name: "Barber Zac",
      currency: "BRL",
      timezone: "America/Sao_Paulo",
      default_markup: 60,
      low_stock_alert_enabled: true,
      critical_stock_alert_enabled: true,
      ai_enabled: true,
    }
  })

  // Reset form when settings load
  useEffect(() => {
    if (settings) {
      form.reset(settings as any)
    }
  }, [settings, form])

  const onSubmit = async (data: SettingsFormValues) => {
    await updateSettings(data)
  }

  if (isFetching) {
    return <div className="p-6 text-center text-muted-foreground">Carregando configurações...</div>
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Configurações</h1>
          <p className="page-subtitle">Parâmetros globais do sistema.</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Company Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Empresa</CardTitle>
              <CardDescription>Informações da organização exibidas no sistema.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name="organization_name" render={({ field }) => (
                  <FormItem className="space-y-2">
                    <Label>Nome da Organização</Label>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="currency" render={({ field }) => (
                  <FormItem className="space-y-2">
                    <Label>Moeda</Label>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="timezone" render={({ field }) => (
                  <FormItem className="space-y-2">
                    <Label>Fuso Horário</Label>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="default_markup" render={({ field }) => (
                  <FormItem className="space-y-2">
                    <Label>Markup Padrão (%)</Label>
                    <FormControl>
                      <Input type="number" min={0} max={1000} {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          {/* Alerts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4" /> Alertas de Estoque</CardTitle>
              <CardDescription>Configure as notificações automáticas do sistema.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="low_stock_alert_enabled" render={({ field }) => (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Alerta de Estoque Baixo</p>
                    <p className="text-sm text-muted-foreground">Notifica quando o saldo cai abaixo do mínimo cadastrado.</p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </div>
              )} />
              <FormField control={form.control} name="critical_stock_alert_enabled" render={({ field }) => (
                <div className="flex items-center justify-between mt-4">
                  <div>
                    <p className="font-medium">Alerta de Estoque Crítico / Zerado</p>
                    <p className="text-sm text-muted-foreground">Notifica quando o saldo chega a zero.</p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </div>
              )} />
            </CardContent>
          </Card>

          {/* AI */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bot className="h-4 w-4" /> Inteligência Artificial</CardTitle>
              <CardDescription>Habilite ou desabilite os recursos de IA do sistema.</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField control={form.control} name="ai_enabled" render={({ field }) => (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Ativar Módulo de IA</p>
                    <p className="text-sm text-muted-foreground">Comandos de linguagem natural, alertas automáticos e sugestões.</p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </div>
              )} />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={isUpdating} size="lg">
              {isUpdating ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
