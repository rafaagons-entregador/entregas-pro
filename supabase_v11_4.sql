-- Painel de Entregas Pro v11.4
-- Rode no Supabase em SQL Editor > New query.

alter table public.categorias
add column if not exists participa_indicadores boolean not null default true;

alter table public.rotas
add column if not exists horas numeric(6,2) not null default 0;

-- Garante que categorias antigas continuem participando dos indicadores.
update public.categorias
set participa_indicadores = true
where participa_indicadores is null;

-- Garante valor padrão para rotas antigas.
update public.rotas
set horas = 0
where horas is null;
