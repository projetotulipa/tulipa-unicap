-- TULIPA · Coordenadores de grupo de estudo + bios ricas em profiles
-- Cada grupo de estudo pode ter N coordenadores (foto + bio + redes), gerenciados
-- pela presidência. Profiles (membros da equipe) ganham campos pra bio rica +
-- avatar real + redes — usadas nas LPs setoriais dos diretores.
--
-- Roda no SQL Editor depois de 020.

-- ===== 1. Tabela study_group_coordinators =====
create table public.study_group_coordinators (
  id            uuid primary key default gen_random_uuid(),
  page_id       uuid not null references public.study_group_pages(id) on delete cascade,
  sort_order    integer not null default 0,
  is_hidden     boolean not null default false,
  full_name     text not null,
  role_label    text not null default 'Coordenação',
  bio_md        text not null default '',
  avatar_url    text not null default '',
  instagram     text not null default '',
  email         text not null default '',
  lattes        text not null default '',
  linkedin      text not null default '',
  social_links  jsonb not null default '[]'::jsonb,  -- [{label, url}]
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id),
  updated_at    timestamptz not null default now()
);

create index on public.study_group_coordinators (page_id, sort_order);

-- trigger updated_at (reusa a função criada em 018)
create trigger trg_coord_touch
  before update on public.study_group_coordinators
  for each row execute function public.tg_meeting_pages_touch_updated_at();

-- RLS
alter table public.study_group_coordinators enable row level security;

create policy "coordinators: read anon if page published" on public.study_group_coordinators
  for select to anon using (
    is_hidden = false and exists (
      select 1 from public.study_group_pages p
      where p.id = study_group_coordinators.page_id and p.is_published = true
    )
  );

create policy "coordinators: read auth" on public.study_group_coordinators
  for select to authenticated using (true);

create policy "coordinators: write admin+presidencia" on public.study_group_coordinators
  for all to authenticated
  using (public.is_admin() or public.is_presidencia())
  with check (public.is_admin() or public.is_presidencia());

-- ===== 2. Profiles ganha campos pra bio rica =====
alter table public.profiles
  add column if not exists avatar_url text not null default '',
  add column if not exists bio_md text not null default '',
  add column if not exists instagram text not null default '',
  add column if not exists social_links jsonb not null default '[]'::jsonb,
  add column if not exists is_director_visible boolean not null default false;

-- ===== 3. Policies pra os campos novos =====

-- anon lê profiles cujo is_director_visible=true (pras LPs setoriais)
create policy "profiles: read anon directors" on public.profiles
  for select to anon using (is_director_visible = true);

-- usuário autenticado pode UPDATE seu próprio profile (qualquer campo);
-- pra mudar role/sector, continua via RPC update_user_role (valida is_admin).
-- Esta policy é apenas pra campos da bio (avatar, bio_md, instagram, etc).
create policy "profiles: update self" on public.profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- admin pode UPDATE qualquer profile (já tinha select all auth via 001/002,
-- aqui adicionamos write explicit)
create policy "profiles: update admin" on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ===== 4. RPC pra admin atualizar bio de outro usuário =====
-- (atalho — admin também pode fazer update direto pela policy acima)
create or replace function public.update_user_profile_bio(
  p_target_user uuid,
  p_display_name text,
  p_avatar_url text,
  p_bio_md text,
  p_instagram text,
  p_social_links jsonb,
  p_is_director_visible boolean
) returns void
  language plpgsql security definer set search_path = public
as $$
begin
  if not (p_target_user = auth.uid() or public.is_admin()) then
    raise exception 'Sem permissão pra editar este perfil';
  end if;
  update public.profiles
     set display_name        = coalesce(p_display_name, display_name),
         avatar_url          = coalesce(p_avatar_url, avatar_url),
         bio_md              = coalesce(p_bio_md, bio_md),
         instagram           = coalesce(p_instagram, instagram),
         social_links        = coalesce(p_social_links, social_links),
         is_director_visible = coalesce(p_is_director_visible, is_director_visible)
   where user_id = p_target_user;
end $$;

grant execute on function public.update_user_profile_bio(uuid, text, text, text, text, jsonb, boolean) to authenticated;

-- ===== 5. View utilitária: directors_public =====
-- Profiles marcados como diretores visíveis, joinados com auth.users pra email.
-- Usada pelas LPs setoriais (anon) pra puxar nome+foto+bio+redes do diretor.
create or replace view public.directors_public as
  select
    p.user_id           as user_id,
    p.display_name      as display_name,
    p.role              as role,
    p.sector            as sector,
    p.team              as team,
    p.avatar_url        as avatar_url,
    p.bio_md            as bio_md,
    p.instagram         as instagram,
    p.social_links      as social_links,
    p.is_director_visible as is_director_visible
  from public.profiles p
  where p.is_director_visible = true;

grant select on public.directors_public to anon, authenticated;

-- ===== 6. Atualiza get_users_admin pra incluir campos novos =====
drop function if exists public.get_users_admin();
create or replace function public.get_users_admin()
  returns table (
    user_id uuid,
    email text,
    role text,
    display_name text,
    sector text,
    team text,
    avatar_url text,
    bio_md text,
    instagram text,
    social_links jsonb,
    is_director_visible boolean,
    created_at timestamptz
  )
  language plpgsql
  security definer
  set search_path = public, auth
as $$
#variable_conflict use_column
begin
  if not exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'apenas admin pode listar usuários';
  end if;
  return query
    select p.user_id, u.email::text, p.role, p.display_name, p.sector, p.team,
           p.avatar_url, p.bio_md, p.instagram, p.social_links,
           p.is_director_visible, p.created_at
      from public.profiles p
      left join auth.users u on u.id = p.user_id
     order by p.created_at desc;
end $$;

grant execute on function public.get_users_admin() to authenticated;
