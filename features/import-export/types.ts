import { z } from 'zod'

export const importModes = ['append', 'update', 'upsert'] as const
export type ImportMode = typeof importModes[number]

export const exportFormats = ['csv', 'xlsx', 'pdf'] as const
export type ExportFormat = typeof exportFormats[number]

export type ImportedProductRow = {
  codigo: string;
  nome_produto: string;
  categoria: string;
  marca?: string;
  custo: number;
  markup: number;
  preco_venda: number;
  estoque_minimo: number;
  estoque_maximo: number;
  saldo_atual: number;
  status: 'Ativo' | 'Inativo';
}

export const productImportSchema = z.object({
  codigo: z.string().min(1, "Código obrigatório"),
  nome_produto: z.string().min(2, "Nome curto demais"),
  categoria: z.string().min(1, "Categoria obrigatória"),
  marca: z.string().optional(),
  custo: z.coerce.number().min(0).catch(0),
  markup: z.coerce.number().min(0).catch(0),
  preco_venda: z.coerce.number().min(0).catch(0),
  estoque_minimo: z.coerce.number().min(0).catch(0),
  estoque_maximo: z.coerce.number().min(0).catch(0),
  saldo_atual: z.coerce.number().catch(0),
  status: z.enum(['Ativo', 'Inativo']).catch('Ativo')
})

export type ParsedImportResult = {
  validRows: ImportedProductRow[];
  invalidRows: { row: any, errors: string[] }[];
  totalProcessed: number;
}
