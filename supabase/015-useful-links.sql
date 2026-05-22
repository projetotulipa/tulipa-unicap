-- TULIPA · Links e Textos Úteis por módulo
-- Cada setor (Mídia, Pesquisa, Tesouraria, Secretaria) tem sua biblioteca própria
-- de links externos (drives, docs, planilhas) e blocos de texto (lembretes, padrões).

create table if not exists public.useful_links (
  id          uuid primary key default gen_random_uuid(),
  module      text not null check (module in ('midia','pesquisa','financeiro','secretaria')),
  kind        text not null check (kind in ('link','note')),
  title       text not null,
  url         text,            -- só pra kind = 'link'
  body        text,            -- markdown leve, usado por 'note' e como descrição opcional do link
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id),
  updated_at  timestamptz not null default now(),
  -- garante que link tenha url e note tenha body
  check (kind <> 'link' or (url is not null and length(trim(url)) > 0)),
  check (kind <> 'note' or (body is not null and length(trim(body)) > 0))
);

create index if not exists useful_links_module_order_idx
  on public.useful_links (module, sort_order, created_at);

alter table public.useful_links enable row level security;

create policy "read auth"
  on public.useful_links for select to authenticated using (true);

-- escrita: admin sempre + setor responsável pelo módulo
create policy "write by sector"
  on public.useful_links for all to authenticated
  using (
    public.is_admin()
    or (module = 'midia'       and public.is_midia())
    or (module = 'pesquisa'    and public.is_pesquisa())
    or (module = 'financeiro'  and public.is_tesouraria())
    or (module = 'secretaria'  and public.is_secretaria())
  )
  with check (
    public.is_admin()
    or (module = 'midia'       and public.is_midia())
    or (module = 'pesquisa'    and public.is_pesquisa())
    or (module = 'financeiro'  and public.is_tesouraria())
    or (module = 'secretaria'  and public.is_secretaria())
  );

-- touch updated_at em UPDATE
create or replace function public.touch_useful_links_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_useful_links_touch on public.useful_links;
create trigger trg_useful_links_touch
  before update on public.useful_links
  for each row execute function public.touch_useful_links_updated_at();
