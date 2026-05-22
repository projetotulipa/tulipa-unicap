-- ============================================================
-- 014-bio-clicks.sql  ·  Click analytics da /bio (Linktree)
-- Conta clicks por link sem PII. Anônimos podem INSERT (com rate limit),
-- admin lê tudo. Sem IP, sem fingerprint — só link_id + ts.
-- ============================================================

-- requisito: public.is_admin() já existe (migrations anteriores).

create table if not exists public.bio_clicks (
  id          bigserial primary key,
  link_id     text not null,
  link_label  text,
  link_href   text,
  ts          timestamptz not null default now(),
  -- agregação rápida por dia
  day         date generated always as ((ts at time zone 'America/Recife')::date) stored
);

create index if not exists bio_clicks_link_idx on public.bio_clicks (link_id);
create index if not exists bio_clicks_day_idx  on public.bio_clicks (day);
create index if not exists bio_clicks_ts_idx   on public.bio_clicks (ts desc);

alter table public.bio_clicks enable row level security;

-- INSERT anônimo: aceita registro com link_id não vazio. Sem PII; rate-limit
-- fica a cargo do PostgREST/Cloudflare (sem proteção dura aqui).
drop policy if exists bio_clicks_anon_insert on public.bio_clicks;
create policy bio_clicks_anon_insert
  on public.bio_clicks
  for insert
  to anon, authenticated
  with check (
    link_id is not null
    and length(link_id) between 1 and 80
    and (link_label is null or length(link_label) <= 80)
    and (link_href  is null or length(link_href)  <= 400)
  );

-- SELECT apenas admin.
drop policy if exists bio_clicks_admin_select on public.bio_clicks;
create policy bio_clicks_admin_select
  on public.bio_clicks
  for select
  to authenticated
  using (public.is_admin());

-- DELETE apenas admin (manutenção/limpeza).
drop policy if exists bio_clicks_admin_delete on public.bio_clicks;
create policy bio_clicks_admin_delete
  on public.bio_clicks
  for delete
  to authenticated
  using (public.is_admin());

-- View agregada por link nos últimos 30 dias (admin only via RLS underlying).
create or replace view public.bio_clicks_summary as
  select
    link_id,
    max(link_label) as link_label,
    max(link_href)  as link_href,
    count(*)::int   as total_30d,
    count(*) filter (where ts >= now() - interval '7 days')::int  as total_7d,
    count(*) filter (where ts >= now() - interval '24 hours')::int as total_24h,
    max(ts) as last_click
  from public.bio_clicks
  where ts >= now() - interval '30 days'
  group by link_id;

-- View por dia (pra sparkline).
create or replace view public.bio_clicks_daily as
  select link_id, day, count(*)::int as clicks
  from public.bio_clicks
  where day >= (current_date - interval '30 days')
  group by link_id, day;

-- Limpeza: corta clicks > 180 dias. Roda manualmente ou via cron pg_cron.
create or replace function public.bio_clicks_prune(days int default 180)
returns int
language plpgsql security definer set search_path = public
as $$
declare deleted int;
begin
  if not public.is_admin() then
    raise exception 'only admin';
  end if;
  delete from public.bio_clicks where ts < now() - (days || ' days')::interval;
  get diagnostics deleted = row_count;
  return deleted;
end $$;

grant execute on function public.bio_clicks_prune(int) to authenticated;
