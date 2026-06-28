-- Painel de Entregas Pro v11.5
-- Rode no Supabase em SQL Editor > New query.

create table if not exists public.preferencias_usuario (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dashboard_cards jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.preferencias_usuario enable row level security;

drop policy if exists "preferencias_select_own" on public.preferencias_usuario;
create policy "preferencias_select_own"
on public.preferencias_usuario
for select
using (auth.uid() = user_id);

drop policy if exists "preferencias_insert_own" on public.preferencias_usuario;
create policy "preferencias_insert_own"
on public.preferencias_usuario
for insert
with check (auth.uid() = user_id);

drop policy if exists "preferencias_update_own" on public.preferencias_usuario;
create policy "preferencias_update_own"
on public.preferencias_usuario
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "preferencias_delete_own" on public.preferencias_usuario;
create policy "preferencias_delete_own"
on public.preferencias_usuario
for delete
using (auth.uid() = user_id);

create index if not exists idx_preferencias_usuario_user_id
on public.preferencias_usuario(user_id);
