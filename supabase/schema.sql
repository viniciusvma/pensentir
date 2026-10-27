-- =========================================================
-- PENSENTIR — schema do banco (rode inteiro no SQL Editor do Supabase)
-- Pode rodar mais de uma vez sem quebrar.
-- =========================================================

create extension if not exists pgcrypto;

-- ---------- PRODUTOS ----------
create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  subtitle      text,
  description   text,
  price         numeric(10,2) not null default 0,
  old_price     numeric(10,2),
  image_url     text,
  checkout_url  text not null,
  badge         text,
  active        boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------- FRASES DA ROLETA ----------
create table if not exists public.phrases (
  id          uuid primary key default gen_random_uuid(),
  pillar      text not null,
  text        text not null,
  author      text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- CONFIGURAÇÕES (links, token do Instagram) ----------
create table if not exists public.settings (
  key         text primary key,
  value       text,
  updated_at  timestamptz not null default now()
);

-- ---------- LEADS (lista VIP do ebook) ----------
create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  email       text not null unique,
  source      text default 'site',
  created_at  timestamptz not null default now()
);

-- ---------- EVENTOS (acessos, cliques, giros) ----------
create table if not exists public.events (
  id          bigint generated always as identity primary key,
  type        text not null,          -- pageview | spin | product_click | ig_click | fb_click
  path        text,
  referrer    text,
  device      text,
  visitor_id  text,
  product_id  uuid references public.products(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists events_created_at_idx on public.events (created_at desc);
create index if not exists events_type_created_idx on public.events (type, created_at desc);

-- ---------- SEGURANÇA ----------
-- RLS ligado e SEM políticas = ninguém acessa pela chave pública.
-- Só o servidor (chave secreta / service_role) lê e escreve.
alter table public.products enable row level security;
alter table public.phrases  enable row level security;
alter table public.settings enable row level security;
alter table public.leads    enable row level security;
alter table public.events   enable row level security;

grant all on public.products, public.phrases, public.settings, public.leads, public.events to service_role;
grant usage, select on all sequences in schema public to service_role;

-- ---------- ESTATÍSTICAS DO ADMIN ----------
create or replace function public.admin_stats(p_days int default 30)
returns json
language sql
stable
set search_path = public
as $$
  with
  tz as (select 'America/Sao_Paulo'::text as z),
  ev as (
    select * from events
    where created_at >= now() - make_interval(days => p_days)
  ),
  today_start as (
    select (date_trunc('day', now() at time zone (select z from tz)) at time zone (select z from tz)) as t
  ),
  days as (
    select gs::date as day
    from generate_series(
      ((now() at time zone (select z from tz))::date - (p_days - 1))::timestamp,
      ((now() at time zone (select z from tz))::date)::timestamp,
      interval '1 day'
    ) gs
  )
  select json_build_object(
    'pageviews',       (select count(*) from ev where type = 'pageview'),
    'visitors',        (select count(distinct visitor_id) from ev where type = 'pageview'),
    'today_pageviews', (select count(*) from events where type = 'pageview' and created_at >= (select t from today_start)),
    'today_visitors',  (select count(distinct visitor_id) from events where type = 'pageview' and created_at >= (select t from today_start)),
    'product_clicks',  (select count(*) from ev where type = 'product_click'),
    'spins',           (select count(*) from ev where type = 'spin'),
    'social_clicks',   (select count(*) from ev where type in ('ig_click','fb_click')),
    'leads',           (select count(*) from leads where created_at >= now() - make_interval(days => p_days)),
    'leads_total',     (select count(*) from leads),
    'daily', (
      select coalesce(json_agg(json_build_object('day', d.day, 'views', d.views, 'visitors', d.visitors) order by d.day), '[]'::json)
      from (
        select days.day,
               count(ev.id) as views,
               count(distinct ev.visitor_id) as visitors
        from days
        left join ev
          on ev.type = 'pageview'
         and (ev.created_at at time zone (select z from tz))::date = days.day
        group by days.day
      ) d
    ),
    'referrers', (
      select coalesce(json_agg(r), '[]'::json) from (
        select coalesce(nullif(referrer, ''), 'Direto') as source, count(*) as total
        from ev where type = 'pageview'
        group by 1 order by 2 desc limit 8
      ) r
    ),
    'devices', (
      select coalesce(json_agg(r), '[]'::json) from (
        select coalesce(device, 'desconhecido') as device, count(*) as total
        from ev where type = 'pageview'
        group by 1 order by 2 desc
      ) r
    ),
    'top_products', (
      select coalesce(json_agg(r), '[]'::json) from (
        select p.title, count(*) as total
        from ev join products p on p.id = ev.product_id
        where ev.type = 'product_click'
        group by p.title order by 2 desc limit 5
      ) r
    )
  );
$$;

revoke execute on function public.admin_stats(int) from public, anon, authenticated;
grant execute on function public.admin_stats(int) to service_role;

-- ---------- BUCKET DE IMAGENS DOS PRODUTOS ----------
insert into storage.buckets (id, name, public)
values ('produtos', 'produtos', true)
on conflict (id) do nothing;

-- ---------- CONFIGURAÇÕES INICIAIS ----------
insert into public.settings (key, value) values
  ('instagram_url', 'https://www.instagram.com/pensentir/'),
  ('facebook_url', ''),
  ('contact_email', '')
on conflict (key) do nothing;

-- ---------- FRASES INICIAIS (só insere se a tabela estiver vazia) ----------
insert into public.phrases (pillar, text)
select * from (values
  ('Foco', 'Onde você coloca sua atenção, você coloca sua vida.'),
  ('Foco', 'Menos coisas, feitas por inteiro.'),
  ('Foco', 'Hoje, escolha uma única coisa e entregue o seu melhor nela.'),
  ('Foco', 'Distração é só um caminho mais longo para lugar nenhum.'),
  ('Reflexão', 'Antes de reagir, respire. Antes de decidir, sinta.'),
  ('Reflexão', 'Nem todo silêncio é vazio. Alguns são respostas.'),
  ('Reflexão', 'Olhe para trás só para ver o quanto você já caminhou.'),
  ('Reflexão', 'A pergunta certa vale mais que mil respostas prontas.'),
  ('Evolução', 'Um passo pequeno ainda é um passo pra frente.'),
  ('Evolução', 'Você não precisa ser melhor que ninguém. Só melhor que ontem.'),
  ('Evolução', 'Crescer dói menos do que ficar onde não cabe mais.'),
  ('Evolução', 'Constância transforma o comum em extraordinário.'),
  ('Mentalidade', 'O que você repete pra si mesmo, vira o que você acredita.'),
  ('Mentalidade', 'Troque o "não consigo" por "ainda não consegui".'),
  ('Mentalidade', 'Problemas são convites disfarçados para você crescer.'),
  ('Mentalidade', 'Sua mente é terreno: cuide do que você planta nela.'),
  ('Autoconfiança', 'Confiança não é saber que vai dar certo. É saber que você aguenta se não der.'),
  ('Autoconfiança', 'Você já sobreviveu a 100% dos seus piores dias.'),
  ('Autoconfiança', 'Pare de pedir permissão para ser quem você é.'),
  ('Autoconfiança', 'Sua voz merece ocupar espaço.'),
  ('Motivação', 'Não desista só porque ainda não deu certo.'),
  ('Motivação', 'Comece com o que tem. O resto vem no caminho.'),
  ('Motivação', 'Dias difíceis também contam como progresso.'),
  ('Motivação', 'A vontade aparece depois que você começa.')
) as v(pillar, text)
where not exists (select 1 from public.phrases);
