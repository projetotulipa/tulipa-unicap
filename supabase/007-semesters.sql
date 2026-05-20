-- TULIPA · Semestres
-- Permite organizar encontros por semestre acadêmico, com data de início/fim
-- definidas pelo admin. Apenas um semestre pode estar marcado como atual.

create table public.semesters (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                       -- ex.: "2026.1", "Verão 2026"
  start_date  date not null,
  end_date    date not null,
  is_current  boolean not null default false,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id),
  check (end_date > start_date)
);

-- garante no máximo 1 semestre como current
create unique index semesters_one_current_idx
  on public.semesters (is_current)
  where is_current = true;

-- vínculo opcional grupo ↔ semestre
alter table public.attendance_groups
  add column if not exists semester_id uuid references public.semesters(id) on delete set null;

-- RLS
alter table public.semesters enable row level security;

create policy "read auth" on public.semesters
  for select to authenticated using (true);

create policy "semesters: write admin only" on public.semesters
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ===== RPC: gera encontros num range arbitrário (semestre inteiro) =====
create or replace function public.generate_meetings_in_range(
  p_group_id uuid,
  p_start_date date,
  p_end_date date
) returns int
language plpgsql security definer
set search_path = public
as $$
declare
  g public.attendance_groups%rowtype;
  d date;
  inserted int := 0;
begin
  if not (public.is_admin() or public.is_secretaria()) then
    raise exception 'sem permissão';
  end if;

  select * into g from public.attendance_groups where id = p_group_id;
  if g.id is null then
    raise exception 'grupo não encontrado';
  end if;

  if g.schedule_kind not in ('weekly', 'biweekly') then
    raise exception 'apenas grupos semanais/quinzenais geram automaticamente';
  end if;

  if g.weekday is null then
    raise exception 'grupo precisa de weekday definido';
  end if;

  if p_end_date <= p_start_date then
    raise exception 'data final precisa ser maior que a inicial';
  end if;

  d := p_start_date;
  -- avança até o primeiro weekday correspondente no range
  while extract(dow from d)::int <> g.weekday and d <= p_end_date loop
    d := d + 1;
  end loop;

  while d <= p_end_date loop
    insert into public.meetings (group_id, date)
    values (g.id, d)
    on conflict (group_id, date) do nothing;
    if found then
      inserted := inserted + 1;
    end if;
    d := d + (case g.schedule_kind when 'biweekly' then 14 else 7 end);
  end loop;

  return inserted;
end $$;

grant execute on function public.generate_meetings_in_range(uuid, date, date) to authenticated;

-- ===== RPC: marcar um semestre como atual (e desmarca os demais) =====
create or replace function public.set_current_semester(p_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'apenas admin pode mudar o semestre atual';
  end if;
  update public.semesters set is_current = false where is_current = true;
  update public.semesters set is_current = true  where id = p_id;
end $$;

grant execute on function public.set_current_semester(uuid) to authenticated;
