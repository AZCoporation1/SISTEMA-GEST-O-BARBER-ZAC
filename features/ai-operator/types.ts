import { Database } from "@/types/supabase"

export type AiCommand = Database['public']['Tables']['ai_commands']['Row']
export type AiCommandInsert = Database['public']['Tables']['ai_commands']['Insert']

export type AuditLog = Database['public']['Tables']['audit_logs']['Row']
export type AuditLogInsert = Database['public']['Tables']['audit_logs']['Insert']

export type StockInconsistency = {
  product_id: string;
  name: string;
  code: string;
  category_name?: string;
  qty_min: number;
  qty_current: number;
  cost_price: number | null;
  anomaly_type: 'negative_stock' | 'zero_stock' | 'critical_stock' | 'missing_cost' | 'attention_stock';
  suggested_buy_qty: number;
  estimated_buy_cost: number;
}

export type AiIntentType = 
  | 'consultar_estoque'
  | 'consultar_produto'
  | 'registrar_entrada'
  | 'registrar_saida_interna'
  | 'registrar_perda'
  | 'registrar_ajuste'
  | 'registrar_venda_simples'
  | 'sugerir_compra'
  | 'listar_alertas'
  | 'resumir_periodo'
  | 'unknown';

export type AiActionPayload = {
  type: AiIntentType;
  actionParams?: any;
  message: string;
  preview?: string;
  requiresConfirmation: boolean;
}

export type AiResponse = {
  type: 'action' | 'query' | 'alert' | 'error';
  message: string;
  preview?: string;
  action?: {
    type: AiIntentType;
    payload: any;
  };
  severity?: 'info' | 'warning' | 'critical';
  items?: any[];
}
