-- TULIPA · Setores de Pesquisa e Mídia
-- Pesquisa: fichamentos teóricos por aula + posts de Instagram
-- Mídia: recebe posts publicados internamente, organiza em equipes e tarefas

-- ===== helpers =====
create or replace function public.is_pesquisa() returns boolean
  language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid()
      and sector = 'pesquisa'
      and role in ('admin','coordinator','member')
  );
$$;

create or replace function public.is_midia() returns boolean
  language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid()
      and sector = 'midia'
      and role in ('admin','coordinator','member')
  );
$$;

-- ===== research_notes =====
create table public.research_notes (
  id          uuid primary key default gen_random_uuid(),
  meeting_id  uuid references public.meetings(id) on delete set null,
  group_id    uuid references public.attendance_groups(id) on delete set null,
  title       text not null,
  body        text not null default '',
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id),
  updated_at  timestamptz not null default now()
);

create index on public.research_notes (meeting_id);
create index on public.research_notes (group_id, created_at desc);

alter table public.research_notes enable row level security;
create policy "read auth" on public.research_notes for select to authenticated using (true);
create policy "write pesquisa+admin" on public.research_notes for all to authenticated
  using (public.is_admin() or public.is_pesquisa())
  with check (public.is_admin() or public.is_pesquisa());

-- ===== instagram_posts =====
create table public.instagram_posts (
  id                 uuid primary key default gen_random_uuid(),
  research_note_id   uuid references public.research_notes(id) on delete set null,
  title              text not null,
  body               text not null default '',
  status             text not null default 'draft' check (status in (
    'draft', 'sent_to_media', 'scheduled', 'published'
  )),
  scheduled_for      date,
  created_at         timestamptz not null default now(),
  created_by         uuid references auth.users(id),
  updated_at         timestamptz not null default now()
);

create index on public.instagram_posts (status, created_at desc);
create index on public.instagram_posts (research_note_id);

alter table public.instagram_posts enable row level security;
create policy "read auth" on public.instagram_posts for select to authenticated using (true);
-- pesquisa cria/edita rascunhos e move pra sent_to_media; mídia move pra scheduled/published
create policy "write pesquisa+admin" on public.instagram_posts for all to authenticated
  using (public.is_admin() or public.is_pesquisa() or public.is_midia())
  with check (public.is_admin() or public.is_pesquisa() or public.is_midia());

-- ===== media_teams =====
create table public.media_teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  is_archived boolean not null default false,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

alter table public.media_teams enable row level security;
create policy "read auth" on public.media_teams for select to authenticated using (true);
create policy "write midia+admin" on public.media_teams for all to authenticated
  using (public.is_admin() or public.is_midia())
  with check (public.is_admin() or public.is_midia());

-- ===== media_team_members =====
create table public.media_team_members (
  team_id    uuid not null references public.media_teams(id) on delete cascade,
  person_id  uuid not null references public.people(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (team_id, person_id)
);

create index on public.media_team_members (person_id);

alter table public.media_team_members enable row level security;
create policy "read auth" on public.media_team_members for select to authenticated using (true);
create policy "write midia+admin" on public.media_team_members for all to authenticated
  using (public.is_admin() or public.is_midia())
  with check (public.is_admin() or public.is_midia());

-- ===== media_tasks =====
create table public.media_tasks (
  id                       uuid primary key default gen_random_uuid(),
  post_id                  uuid references public.instagram_posts(id) on delete set null,
  team_id                  uuid references public.media_teams(id) on delete set null,
  assigned_to_person_id    uuid references public.people(id) on delete set null,
  title                    text not null,
  description              text,
  due_date                 date,
  status                   text not null default 'todo' check (status in ('todo','in_progress','done')),
  created_at               timestamptz not null default now(),
  created_by               uuid references auth.users(id),
  completed_at             timestamptz
);

create index on public.media_tasks (status, due_date);
create index on public.media_tasks (team_id);
create index on public.media_tasks (assigned_to_person_id);
create index on public.media_tasks (due_date) where status <> 'done';

alter table public.media_tasks enable row level security;
create policy "read auth" on public.media_tasks for select to authenticated using (true);
create policy "write midia+admin" on public.media_tasks for all to authenticated
  using (public.is_admin() or public.is_midia())
  with check (public.is_admin() or public.is_midia());
