-- TULIPA · Landing pages dos Grupos de Estudo
-- Cada attendance_group pode ganhar uma "página de estudo" (descrição rica, material
-- complementar, etc) editada pela presidência. A LP é renderizada dinamicamente em
-- /atividades/grupos-de-estudo/grupo.html?id=<slug>.
--
-- Roda no SQL Editor depois de 015.

-- ===== 1. Helper is_presidencia() =====
create or replace function public.is_presidencia() returns boolean
  language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid()
      and sector = 'presidencia'
      and role in ('admin','coordinator','member')
  );
$$;

grant execute on function public.is_presidencia() to authenticated;

-- ===== 2. Tabela study_group_pages =====
create table public.study_group_pages (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null unique references public.attendance_groups(id) on delete cascade,
  slug            text not null unique,
  hero_eyebrow    text not null default '',
  hero_subtitle   text not null default '',
  lede            text not null default '',
  about_md        text not null default '',
  method_md       text not null default '',
  is_published    boolean not null default false,
  show_on_index   boolean not null default true,
  sort_order      integer not null default 0,
  accent_color    text not null default 'wine'
                  check (accent_color in ('wine','sage','rose','gold','cream','moss','plum')),
  cover_emoji     text not null default '📖',
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id),
  updated_at      timestamptz not null default now()
);

create index on public.study_group_pages (is_published, show_on_index, sort_order);
create index on public.study_group_pages (slug);

-- slug deve conter só letras minúsculas, dígitos e hífens
alter table public.study_group_pages add constraint study_group_pages_slug_format
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- ===== 3. Tabela study_group_resources (material complementar) =====
create table public.study_group_resources (
  id              uuid primary key default gen_random_uuid(),
  page_id         uuid not null references public.study_group_pages(id) on delete cascade,
  kind            text not null check (kind in (
                    'youtube','drive','external_link','book','movie',
                    'series','anime','podcast','article','image','document','other'
                  )),
  title           text not null,
  description     text not null default '',
  url             text not null default '',
  author          text not null default '',
  year            integer,
  meeting_id      uuid references public.meetings(id) on delete set null,
  is_hidden       boolean not null default false,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);

create index on public.study_group_resources (page_id, sort_order);
create index on public.study_group_resources (meeting_id) where meeting_id is not null;

-- ===== 4. Triggers de updated_at =====
create or replace function public.tg_study_group_pages_touch_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_study_group_pages_touch
  before update on public.study_group_pages
  for each row execute function public.tg_study_group_pages_touch_updated_at();

-- ===== 5. RLS: study_group_pages =====
alter table public.study_group_pages enable row level security;

-- leitura: anônimos só veem publicados; autenticados veem todas (pra admin gerir)
create policy "study_pages: read anon published" on public.study_group_pages
  for select to anon using (is_published = true);

create policy "study_pages: read auth" on public.study_group_pages
  for select to authenticated using (true);

-- escrita: admin OU sector presidencia
create policy "study_pages: write admin+presidencia" on public.study_group_pages
  for all to authenticated
  using (public.is_admin() or public.is_presidencia())
  with check (public.is_admin() or public.is_presidencia());

-- ===== 6. RLS: study_group_resources =====
alter table public.study_group_resources enable row level security;

-- anon: só recursos não ocultos cuja página esteja publicada
create policy "study_resources: read anon if page published" on public.study_group_resources
  for select to anon using (
    is_hidden = false and exists (
      select 1 from public.study_group_pages p
      where p.id = study_group_resources.page_id and p.is_published = true
    )
  );

create policy "study_resources: read auth" on public.study_group_resources
  for select to authenticated using (true);

create policy "study_resources: write admin+presidencia" on public.study_group_resources
  for all to authenticated
  using (public.is_admin() or public.is_presidencia())
  with check (public.is_admin() or public.is_presidencia());

-- ===== 7. Policies extras pra anon: leitura de attendance_groups, meetings e research_notes =====
-- A LP pública precisa mostrar: nome do grupo, descrição, lista de encontros happened,
-- fichamentos atribuídos. Tudo só pra grupos cujo study_group_pages.is_published = true.

create policy "attendance_groups: read anon if published page" on public.attendance_groups
  for select to anon using (
    exists (
      select 1 from public.study_group_pages p
      where p.group_id = attendance_groups.id and p.is_published = true
    )
  );

create policy "meetings: read anon if published page" on public.meetings
  for select to anon using (
    exists (
      select 1 from public.study_group_pages p
      where p.group_id = meetings.group_id and p.is_published = true
    )
  );

create policy "research_notes: read anon if published page" on public.research_notes
  for select to anon using (
    group_id is not null and exists (
      select 1 from public.study_group_pages p
      where p.group_id = research_notes.group_id and p.is_published = true
    )
  );

-- ===== 8. View utilitária: study_groups_public =====
-- Junta study_group_pages + attendance_groups (nome, archived) numa única select
-- pra simplificar a LP genérica e a LP filha. SECURITY INVOKER (respeita RLS do caller).
create or replace view public.study_groups_public as
  select
    p.id                as page_id,
    p.group_id          as group_id,
    p.slug              as slug,
    g.name              as group_name,
    g.description       as group_description,
    g.is_archived       as is_archived,
    g.schedule_kind     as schedule_kind,
    g.weekday           as weekday,
    g.start_time        as start_time,
    g.semester_id       as semester_id,
    p.hero_eyebrow      as hero_eyebrow,
    p.hero_subtitle     as hero_subtitle,
    p.lede              as lede,
    p.about_md          as about_md,
    p.method_md         as method_md,
    p.is_published      as is_published,
    p.show_on_index     as show_on_index,
    p.sort_order        as sort_order,
    p.accent_color      as accent_color,
    p.cover_emoji       as cover_emoji,
    p.created_at        as created_at,
    p.updated_at        as updated_at
  from public.study_group_pages p
  join public.attendance_groups g on g.id = p.group_id;

grant select on public.study_groups_public to anon, authenticated;
