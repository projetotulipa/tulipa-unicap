-- TULIPA · Funções RPC pra gestão de membros (chamadas pelo /admin).
-- Roda no SQL Editor do Supabase tulipa.

-- Lista todos os profiles com email do auth.users.
-- Só admin pode ler.
create or replace function public.get_users_admin()
  returns table (
    user_id uuid,
    email text,
    role text,
    display_name text,
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
    select p.user_id, u.email::text, p.role, p.display_name, p.created_at
    from public.profiles p
    left join auth.users u on u.id = p.user_id
    order by p.created_at desc;
end $$;

grant execute on function public.get_users_admin() to authenticated;

-- Atualiza role + display_name de um usuário.
-- Só admin pode chamar.
create or replace function public.update_user_role(
  target_user uuid,
  new_role text,
  new_display_name text default null
)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'apenas admin pode mudar roles';
  end if;

  if new_role not in (
    'pending', 'admin',
    'dept:presidencia', 'dept:prof-orientador', 'dept:prof-colaborador',
    'dept:midia', 'dept:pesquisa', 'dept:tesouraria', 'dept:secretaria',
    'dept:grupos-de-estudo', 'dept:leitura-conjunta', 'dept:arteterapia'
  ) then
    raise exception 'role inválido: %', new_role;
  end if;

  -- proteção: admin não pode rebaixar a si mesmo (evita ficar sem admin)
  if target_user = auth.uid() and new_role <> 'admin' then
    raise exception 'você não pode rebaixar sua própria conta';
  end if;

  update public.profiles
     set role = new_role,
         display_name = coalesce(new_display_name, display_name)
   where user_id = target_user;
end $$;

grant execute on function public.update_user_role(uuid, text, text) to authenticated;
