"use client"

import { useEffect, useState } from "react"
import { AlertCircle, PackageX, TrendingDown, DollarSign } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StockInconsistency } from "../types"
import { fetchStockAlertsAction } from "../actions/alerts.actions"

const ANOMALY_MAP = {
  negative_stock: { label: "Saldo Negativo", color: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400", icon: PackageX },
  zero_stock: { label: "Estoque Zerado", color: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-400", icon: AlertCircle },
  critical_stock: { label: "Estoque Crítico (Abaixo do Mín)", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-400", icon: TrendingDown },
  missing_cost: { label: "Sem Custo Definido", color: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400", icon: DollarSign },
  attention_stock: { label: "Atenção", color: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400", icon: AlertCircle },
}

export function AlertsPanel() {
  const [data, setData] = useState<StockInconsistency[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetchStockAlertsAction()
        if (res.success && res.data) {
           setData(res.data)
        } else {
           throw Error(res.error || 'Falha desconhecida ao carregar anomalias.')
        }
      } catch (err: any) {
        setError(err.message || 'Falha ao carregar anomalias do estoque.')
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  if (isLoading) {
    return (
      <Card className="border-amber-500/20 bg-amber-50/10 dark:bg-amber-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2 text-amber-600 dark:text-amber-500">
            <AlertCircle className="h-5 w-5" /> Detecção Contínua de Anomalias
          </CardTitle>
          <CardDescription>Analisando saúde do estoque...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex-1 flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-4 w-4" /> Alertas de Estoque
          </CardTitle>
        </CardHeader>
        <CardContent>
           <p className="text-sm text-muted-foreground text-center py-4">Estoque operando dentro da normalidade.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-amber-500/20 bg-amber-50/10 dark:bg-amber-950/20">
      <CardHeader className="pb-3 flex flex-row items-center">
        <CardTitle className="text-sm font-medium flex-1 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-500" /> 
          Anomalias Detectadas
        </CardTitle>
        <Badge variant="destructive" className="ml-auto">{data.length}</Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((item: any, i: number) => {
            const Config = ANOMALY_MAP[item.anomaly_type as keyof typeof ANOMALY_MAP] || ANOMALY_MAP.critical_stock
            const Icon = Config.icon
             return (
              <div key={item.product_id} className="flex items-start justify-between p-3 rounded-lg border bg-background/50 text-sm">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.external_code && (
                      <span className="text-[11px] font-semibold tracking-wider text-[var(--accent)] font-mono bg-[var(--accent-subtle)] px-1.5 py-0.5 rounded" style={{ letterSpacing: '0.06em' }}>
                        {item.external_code}
                      </span>
                    )}
                    <span className="font-medium">{item.name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${Config.color}`}>
                      <Icon className="h-3 w-3 inline mr-1" />
                      {Config.label}
                    </span>
                  </div>
                  {item.anomaly_type === 'missing_cost' ? (
                     <p className="text-muted-foreground text-xs">Produto sem valor de compra preenchido. Margem de lucro não será calculada.</p>
                  ) : (
                     <div className="text-muted-foreground text-xs flex gap-3">
                        <span>Atual: <strong className="text-foreground">{item.current_balance}</strong></span>
                        <span>Mínimo: {item.min_stock}</span>
                        {item.suggested_buy_qty > 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            Sugestão: {item.suggested_buy_qty}x (R$ {item.estimated_buy_cost.toFixed(2)})
                          </span>
                        )}
                     </div>
                  )}
                </div>
              </div>
             )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
