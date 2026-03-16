-- ============================================================
-- Migration: Barber Zac ERP — Initial Schema
-- Date: 2026-03-13
-- ============================================================

-- Helper: update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper: audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (table_name, record_id, action, old_data, new_data)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE row_to_json(OLD)::jsonb END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE row_to_json(NEW)::jsonb END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- AUDIT LOG (first — referenced by triggers)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT CHECK (action IN ('INSERT','UPDATE','DELETE','SOFT_DELETE','AI_ACTION')),
  old_data JSONB,
  new_data JSONB,
  performed_by UUID,
  performed_by_ai BOOLEAN DEFAULT false,
  ip_address TEXT,
  user_agent TEXT,
  performed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read audit" ON audit_log FOR SELECT TO authenticated USING (true);

-- ============================================================
-- SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read settings" ON settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write settings" ON settings FOR ALL TO authenticated USING (true);

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_prefix TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6b7280',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read categories" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write categories" ON categories FOR ALL TO authenticated USING (true);

-- ============================================================
-- COLLABORATORS
-- ============================================================
CREATE TABLE IF NOT EXISTS collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT DEFAULT 'barbeiro',
  commission_percent NUMERIC(5,2) DEFAULT 0,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read collaborators" ON collaborators FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write collaborators" ON collaborators FOR ALL TO authenticated USING (true);

CREATE TRIGGER update_collaborators_updated_at
  BEFORE UPDATE ON collaborators FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER audit_collaborators
  AFTER INSERT OR UPDATE OR DELETE ON collaborators FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- ============================================================
-- COMMISSION RULES
-- ============================================================
CREATE TABLE IF NOT EXISTS commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id UUID REFERENCES collaborators(id),
  applies_to TEXT CHECK (applies_to IN ('product','category','global')) DEFAULT 'global',
  reference_id UUID,
  percent NUMERIC(5,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE commission_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated commission_rules" ON commission_rules FOR ALL TO authenticated USING (true);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  category_id UUID REFERENCES categories(id),
  brand TEXT,
  purchase_price NUMERIC(10,2),
  markup_percent NUMERIC(5,2) DEFAULT 45,
  qty_current INTEGER DEFAULT 0,
  qty_min INTEGER DEFAULT 0,
  qty_max INTEGER DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Computed columns as regular columns (updated by trigger)
ALTER TABLE products ADD COLUMN IF NOT EXISTS markup_value NUMERIC(10,2) GENERATED ALWAYS AS (
  CASE WHEN purchase_price IS NOT NULL THEN ROUND(purchase_price * markup_percent / 100, 2) ELSE NULL END
) STORED;

ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_price NUMERIC(10,2) GENERATED ALWAYS AS (
  CASE WHEN purchase_price IS NOT NULL THEN ROUND(purchase_price + purchase_price * markup_percent / 100, 2) ELSE NULL END
) STORED;

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read products" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write products" ON products FOR ALL TO authenticated USING (true);

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER audit_products
  AFTER INSERT OR UPDATE OR DELETE ON products FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- ============================================================
-- STOCK MOVEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  type TEXT NOT NULL CHECK (type IN ('entrada','saida','ajuste','perda','consumo_interno','venda')),
  qty INTEGER NOT NULL,
  unit_cost NUMERIC(10,2),
  unit_price NUMERIC(10,2),
  reference_id UUID,
  notes TEXT,
  performed_by UUID REFERENCES collaborators(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read movements" ON stock_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write movements" ON stock_movements FOR ALL TO authenticated USING (true);

CREATE TRIGGER audit_stock_movements
  AFTER INSERT OR UPDATE OR DELETE ON stock_movements FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Trigger to update product qty_current after movement
CREATE OR REPLACE FUNCTION update_product_qty()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.type IN ('entrada','ajuste') AND NEW.qty > 0 THEN
      UPDATE products SET qty_current = qty_current + NEW.qty WHERE id = NEW.product_id;
    ELSIF NEW.type IN ('saida','perda','consumo_interno','venda') THEN
      UPDATE products SET qty_current = qty_current - ABS(NEW.qty) WHERE id = NEW.product_id;
    ELSIF NEW.type = 'ajuste' AND NEW.qty < 0 THEN
      UPDATE products SET qty_current = qty_current + NEW.qty WHERE id = NEW.product_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_product_qty
  AFTER INSERT ON stock_movements FOR EACH ROW EXECUTE FUNCTION update_product_qty();

-- ============================================================
-- SALES
-- ============================================================
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number BIGINT GENERATED ALWAYS AS IDENTITY,
  customer_name TEXT,
  collaborator_id UUID REFERENCES collaborators(id),
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  payment_method TEXT CHECK (payment_method IN ('dinheiro','pix','cartao_debito','cartao_credito','misto')),
  commission_amount NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed','cancelled','pending')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  qty INTEGER NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  unit_cost NUMERIC(10,2),
  discount NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated sales" ON sales FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated sale_items" ON sale_items FOR ALL TO authenticated USING (true);

CREATE TRIGGER update_sales_updated_at
  BEFORE UPDATE ON sales FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER audit_sales
  AFTER INSERT OR UPDATE OR DELETE ON sales FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- ============================================================
-- CASH REGISTERS
-- ============================================================
CREATE TABLE IF NOT EXISTS cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  opening_balance NUMERIC(10,2) DEFAULT 0,
  closing_balance NUMERIC(10,2),
  total_receipts NUMERIC(10,2) DEFAULT 0,
  total_expenses NUMERIC(10,2) DEFAULT 0,
  opened_by UUID REFERENCES collaborators(id),
  closed_by UUID REFERENCES collaborators(id),
  status TEXT DEFAULT 'open' CHECK (status IN ('open','closed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cash_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  register_id UUID NOT NULL REFERENCES cash_registers(id),
  type TEXT NOT NULL CHECK (type IN ('receita','despesa')),
  category TEXT CHECK (category IN ('venda','custo_fixo','custo_variavel','comissao','sangria','suprimento','outro')),
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated cash_registers" ON cash_registers FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated cash_transactions" ON cash_transactions FOR ALL TO authenticated USING (true);

CREATE TRIGGER audit_cash_registers
  AFTER INSERT OR UPDATE OR DELETE ON cash_registers FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_cash_transactions
  AFTER INSERT OR UPDATE OR DELETE ON cash_transactions FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- ============================================================
-- COSTS
-- ============================================================
CREATE TABLE IF NOT EXISTS costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('fixo','variavel')),
  amount NUMERIC(10,2),
  recurrence TEXT CHECK (recurrence IN ('mensal','semanal','anual','unico')),
  due_day INTEGER,
  category TEXT DEFAULT 'outro',
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated costs" ON costs FOR ALL TO authenticated USING (true);

CREATE TRIGGER update_costs_updated_at
  BEFORE UPDATE ON costs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER audit_costs
  AFTER INSERT OR UPDATE OR DELETE ON costs FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- ============================================================
-- SEED: Categories
-- ============================================================
INSERT INTO categories (code_prefix, name, color) VALUES
  ('1', 'Finalizador Capilar', '#6366f1'),
  ('2', 'Insumos', '#f59e0b'),
  ('3', 'Home Care', '#10b981'),
  ('4', 'Lavatório', '#3b82f6'),
  ('5', 'Minoxidil', '#8b5cf6'),
  ('6', 'Produto de Limpeza', '#06b6d4'),
  ('7', 'Produto Limpeza de Pele', '#ec4899'),
  ('8', 'Químicas', '#ef4444')
ON CONFLICT (code_prefix) DO NOTHING;

-- ============================================================
-- SEED: Settings
-- ============================================================
INSERT INTO settings (key, value, description) VALUES
  ('business_name', 'Barber Zac', 'Nome do estabelecimento'),
  ('default_markup_percent', '45', 'Markup padrão para novos produtos (%)'),
  ('timezone', 'America/Sao_Paulo', 'Fuso horário do sistema'),
  ('currency', 'BRL', 'Moeda do sistema'),
  ('low_stock_alert_enabled', 'true', 'Alertas de estoque baixo'),
  ('version', '1.0.0', 'Versão do sistema')
ON CONFLICT (key) DO NOTHING;
