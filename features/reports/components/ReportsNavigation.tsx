"use client"

import Link from "next/link"
import { 
  BarChart3, TrendingUp, Package, ArrowLeftRight, ShoppingCart, 
  DollarSign, Wrench, Users
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const REPORT_CARDS = [
  {
    title: "Estoque",
    description: "Posição atual, mínimos, zerados e sugestão de compra por categoria.",
    icon: Package,
    href: "/relatorios/estoque",
    color: "text-blue-500",
  },
  {
    title: "Movimentações",
    description: "Histórico de entradas, saídas, perdas e ajustes no período.",
    icon: ArrowLeftRight,
    href: "/relatorios/movimentacoes",
    color: "text-purple-500",
  },
  {
    title: "Vendas",
    description: "Relatório de vendas por período, produto, colaborador e forma de pagamento.",
    icon: ShoppingCart,
    href: "/relatorios/vendas",
    color: "text-emerald-500",
  },
  {
    title: "Fluxo de Caixa",
    description: "DRE simplificado e fluxo financeiro por período.",
    icon: TrendingUp,
    href: "/fluxo-de-caixa",
    color: "text-cyan-500",
  },
  {
    title: "Custos",
    description: "Mapa de custos fixos e variáveis por período.",
    icon: Wrench,
    href: "/relatorios/custos",
    color: "text-orange-500",
  },
  {
    title: "Comissões",
    description: "Extrato de comissões por colaborador e período de competência.",
    icon: Users,
    href: "/comissoes",
    color: "text-pink-500",
  },
  {
    title: "Resultado Financeiro",
    description: "Margem de contribuição, ticket médio e lucratividade.",
    icon: DollarSign,
    href: "/relatorios/resultado",
    color: "text-yellow-500",
  },
  {
    title: "Dashboard Geral",
    description: "Visão executiva com os KPIs mais importantes do negócio.",
    icon: BarChart3,
    href: "/dashboard",
    color: "text-indigo-500",
  },
]

export function ReportsNavigation() {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Relatórios</h1>
          <p className="page-subtitle">Acesse os relatórios analíticos por área operacional.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {REPORT_CARDS.map((card) => {
          const Icon = card.icon
          return (
            <Link key={card.href} href={card.href}>
              <Card className="h-full cursor-pointer hover:shadow-md hover:border-primary/50 transition-all duration-200 group">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${card.color} group-hover:scale-110 transition-transform`} />
                    <CardTitle className="text-base">{card.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{card.description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
