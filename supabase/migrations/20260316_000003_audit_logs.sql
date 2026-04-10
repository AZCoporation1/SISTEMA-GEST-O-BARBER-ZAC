-- Migração: Criação da Tabela de Auditoria Premium (Bloco 4)
-- Restaurando e aprimorando o sistema de Logs deletado no overhaul.

create table if not exists public.audit_logs (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users(id) on delete set null,
    user_name text, -- Cache do nome p/ evitar joins pesados na UI
    action text not null, -- INSERT, UPDATE, DELETE, IMPORT, EXPORT, REPORT, AI_COMMAND
    entity text not null, -- inventory_products, sales, stock_movements, app_settings, etc.
    entity_id text, -- ID do registro afetado (text p/ flexibilidade)
    old_data jsonb,
    new_data jsonb,
    source text not null default 'web', -- web, ai_operator, import_job, system
    status text not null default 'success', -- success, error, pending
    observation text, -- "Produto X teve preço alterado", "Ajuste manual de estoque", etc.
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_audit_logs_entity on public.audit_logs(entity, entity_id);
create index idx_audit_logs_created_at on public.audit_logs(created_at desc);
create index idx_audit_logs_user on public.audit_logs(user_id);

alter table public.audit_logs enable row level security;

-- Regras de Segurança: 
-- Usuários autenticados podem ver os logs (interno Barber Zac).
-- Apenas o sistema / authenticated users podem inserir via actions. Nunca deletar ou fazer update.
create policy "Enable select for authenticated users" 
    on public.audit_logs for select to authenticated using (true);
    
create policy "Enable insert for authenticated users" 
    on public.audit_logs for insert to authenticated with check (true);

-- Sem policy de UPDATE ou DELETE. Audit Logs são imutáveis.
