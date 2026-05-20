-- TULIPA · Pesquisa também se divide em sub-equipes (grupos).

create table public.research_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  is_archived boolean not null default false,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

alter table public.research_groups enable row level security;
create policy "read auth" on public.research_groups for select to authenticated using (true);
create policy "write pesquisa+admin" on public.research_groups for all to authenticated
  using (public.is_admin() or public.is_pesquisa())
  with check (public.is_admin() or public.is_pesquisa());

create table public.research_group_members (
  group_id   uuid not null references public.research_groups(id) on delete cascade,
  person_id  uuid not null references public.people(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (group_id, person_id)
);

create index on public.research_group_members (person_id);

alter table public.research_group_members enable row level security;
create policy "read auth" on public.research_group_members for select to authenticated using (true);
create policy "write pesquisa+admin" on public.research_group_members for all to authenticated
  using (public.is_admin() or public.is_pesquisa())
  with check (public.is_admin() or public.is_pesquisa());

-- vínculo opcional: fichamentos e posts agora podem ser atribuídos a uma sub-equipe de pesquisa
alter table public.research_notes
  add column if not exists research_group_id uuid references public.research_groups(id) on delete set null;

alter table public.instagram_posts
  add column if not exists research_group_id uuid references public.research_groups(id) on delete set null;
