-- TULIPA · Hierarquia de roles (admin > coordinator > member)
-- + setor (8 fixos) + equipe (texto livre opcional)
-- Roda no SQL Editor depois do 001 e 002.

-- 1. campos novos na tabela profiles
alter table public.profiles add column if not exists sector text;
alter table public.profiles add column if not exists team   text;

-- 2. nova constraint do role (4 valores)
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('pending', 'admin', 'coordinator', 'member'));

-- 3. constraint do sector (8 setores fixos, nullable)
alter table public.profiles drop constraint if exists profiles_sector_check;
alter table public.profiles add constraint profiles_sector_check
  check (
    sector is null
    or sector in (
      'presidencia', 'professor-orientador', 'professor-colaborador',
      'midia', 'pesquisa', 'tesouraria', 'secretaria', 'atividades'
    )
  );

-- 4. invariantes lógicos: admin/pending sem setor; coord/member com setor
alter table public.profiles drop constraint if exists profiles_role_sector_consistent;
alter table public.profiles add constraint profiles_role_sector_consistent
  check (
    (role in ('admin', 'pending') and sector is null and team is null)
    or (role = 'coordinator' and sector is not null and team is null)
    or (role = 'member' and sector is not null)
  );

-- 5. helper my_sector()
create or replace function public.my_sector() returns text
  language sql stable security definer
  set search_path = public
as $$
  select sector from public.profiles where user_id = auth.uid()
$$;

-- 6. reescrever policy "scoped write" pra usar nova taxonomia
-- (coord/member do setor X podem publicar em lp:X; setor "atividades" cobre as 3 LPs)
drop policy if exists "scoped write" on public.site_content;
create policy "scoped write" on public.site_content for insert to authenticated
  with check (
    public.is_admin()
    or (
      (
        (select role from public.profiles where user_id = auth.uid()) = 'coordinator'
        and public.my_sector() is not null
        and (
          scope = 'lp:' || public.my_sector()
          or (
            public.my_sector() = 'atividades'
            and scope in ('lp:grupos-de-estudo', 'lp:leitura-conjunta', 'lp:arteterapia')
          )
        )
      )
    )
  );
-- nota: member NÃO pode publicar nas LPs por enquanto (só coord+admin).
-- features de member serão implementadas em outras tabelas no futuro.

-- 7. atualiza update_user_role (nova assinatura: + sector + team)
drop function if exists public.update_user_role(uuid, text, text);
create or replace function public.update_user_role(
  target_user uuid,
  new_role text,
  new_display_name text default null,
  new_sector text default null,
  new_team text default null
)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  valid_sectors text[] := array[
    'presidencia', 'professor-orientador', 'professor-colaborador',
    'midia', 'pesquisa', 'tesouraria', 'secretaria', 'atividades'
  ];
begin
  if not exists (select 1 from public.profiles where user_id = auth.uid() and role = 'admin') then
    raise exception 'apenas admin pode mudar roles';
  end if;

  if new_role not in ('pending', 'admin', 'coordinator', 'member') then
    raise exception 'role inválido: %', new_role;
  end if;

  -- normaliza campos de acordo com a role
  if new_role in ('admin', 'pending') then
    new_sector := null;
    new_team := null;
  elsif new_role = 'coordinator' then
    if new_sector is null then
      raise exception 'setor é obrigatório para coordenador';
    end if;
    if not (new_sector = any(valid_sectors)) then
      raise exception 'setor inválido: %', new_sector;
    end if;
    new_team := null;
  elsif new_role = 'member' then
    if new_sector is null then
      raise exception 'setor é obrigatório para membro';
    end if;
    if not (new_sector = any(valid_sectors)) then
      raise exception 'setor inválido: %', new_sector;
    end if;
    -- team fica como veio (pode ser null ou texto)
    if new_team is not null then
      new_team := nullif(trim(new_team), '');
    end if;
  end if;

  -- proteção: admin não pode rebaixar a si mesmo (evita ficar sem admin)
  if target_user = auth.uid() and new_role <> 'admin' then
    raise exception 'você não pode rebaixar sua própria conta';
  end if;

  update public.profiles
     set role = new_role,
         display_name = coalesce(new_display_name, display_name),
         sector = new_sector,
         team = new_team
   where user_id = target_user;
end $$;

grant execute on function public.update_user_role(uuid, text, text, text, text) to authenticated;

-- 8. atualiza get_users_admin (retorna + sector + team)
drop function if exists public.get_users_admin();
create or replace function public.get_users_admin()
  returns table (
    user_id uuid,
    email text,
    role text,
    display_name text,
    sector text,
    team text,
    created_at timestamptz
  )
  language plpgsql
  security definer
  set search_path = public, auth
as $$
begin
  if not exists (
    select 1 from public.profiles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'apenas admin pode listar usuários';
  end if;

  return query
    select p.user_id, u.email::text, p.role, p.display_name, p.sector, p.team, p.created_at
    from public.profiles p
    left join auth.users u on u.id = p.user_id
    order by p.created_at desc;
end $$;

grant execute on function public.get_users_admin() to authenticated;
