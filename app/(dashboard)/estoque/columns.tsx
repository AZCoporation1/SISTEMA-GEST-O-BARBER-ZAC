"use client"

import { ColumnDef } from "@tanstack/react-table"
import Link from "next/link"
import { ProductWithStatus } from "@/types/supabase"
import { formatCurrency, formatPercent, getStockStatus, stockStatusLabels, stockStatusColors } from "@/lib/formatters"

// We use any or a partial type since this depends on the specific query from page.tsx
export type ProductRow = {
  id: string
  code: string
  description: string
  brand: string | null
  category: { name: string; color: string } | null
  purchase_price: number | null
  markup_percent: number
  sale_price: number | null
  qty_current: number
  qty_min: number
  qty_max: number
}

export const columns: ColumnDef<ProductRow>[] = [
  {
    accessorKey: "code",
    header: "Código",
    cell: ({ row }) => <span style={{ fontWeight: 500 }}>{row.original.code}</span>,
  },
  {
    accessorKey: "description",
    header: "Descrição",
    cell: ({ row }) => (
      <div>
        <span style={{ display: 'block', color: 'var(--text-primary)' }}>{row.original.description}</span>
        {row.original.brand && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.original.brand}</span>}
      </div>
    ),
  },
  {
    accessorKey: "category",
    header: "Categoria",
    cell: ({ row }) => {
      const cat = row.original.category
      if (!cat) return <span style={{ color: 'var(--text-muted)' }}>Sem categoria</span>
      return (
        <span className="badge" style={{ background: `${cat.color}20`, color: cat.color }}>
          {cat.name}
        </span>
      )
    },
  },
  {
    accessorKey: "purchase_price",
    header: "Custo",
    cell: ({ row }) => formatCurrency(row.original.purchase_price),
  },
  {
    accessorKey: "markup_percent",
    header: "Markup",
    cell: ({ row }) => formatPercent(row.original.markup_percent),
  },
  {
    accessorKey: "sale_price",
    header: "Venda",
    cell: ({ row }) => (
      <span style={{ fontWeight: 600, color: 'var(--accent-gold-light)' }}>
        {formatCurrency(row.original.sale_price)}
      </span>
    ),
  },
  {
    accessorKey: "qty_current",
    header: "Atual",
    cell: ({ row }) => <span style={{ fontWeight: 600 }}>{row.original.qty_current}</span>,
  },
  {
    id: "minMax",
    header: "Mín/Máx",
    cell: ({ row }) => (
      <span style={{ color: 'var(--text-muted)' }}>
        {row.original.qty_min} / {row.original.qty_max}
      </span>
    ),
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = getStockStatus(row.original.qty_current, row.original.qty_min || 0, row.original.qty_max || 0)
      const statusClasses = stockStatusColors[status]
      return (
        <span className={`badge ${statusClasses}`}>
          {stockStatusLabels[status]}
        </span>
      )
    },
  },
  {
    id: "actions",
    header: () => <div style={{ textAlign: 'right' }}>Ações</div>,
    cell: ({ row }) => (
      <div style={{ textAlign: 'right' }}>
        <Link 
          href={`/estoque/${row.original.id}`}
          style={{ fontSize: 13, color: 'var(--accent-gold)', textDecoration: 'none', fontWeight: 500 }}
        >
          Editar
        </Link>
      </div>
    ),
  },
]
