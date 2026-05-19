-- TULIPA · Sistema de presença
-- Grupos · Pessoas · Vínculos · Encontros · Presença
-- Roda no SQL Editor depois de 001/002/003.

create extension if not exists pgcrypto;

-- ===== 1. attendance_groups =====
create table public.attendance_groups (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  schedule_kind text not null default 'weekly' check (schedule_kind in ('weekly','biweekly','monthly','manual')),
  weekday       smallint check (weekday is null or weekday between 0 and 6),  -- 0=domingo, 6=sábado
  start_time    time,
  is_archived   boolean not null default false,
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id)
);

-- ===== 2. people =====
create table public.people (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  email       text,
  notes       text,
  is_active   boolean not null default true,
  user_id     uuid references auth.users(id),  -- opcional: vínculo com profile/auth
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

-- ===== 3. group_memberships =====
create table public.group_memberships (
  group_id    uuid not null references public.attendance_groups(id) on delete cascade,
  person_id   uuid not null references public.people(id) on delete cascade,
  is_primary  boolean not null default false,
  joined_at   timestamptz not null default now(),
  primary key (group_id, person_id)
);

-- ===== 4. meetings =====
create table public.meetings (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.attendance_groups(id) on delete cascade,
  date        date not null,
  status      text not null default 'scheduled' check (status in ('scheduled','happened','cancelled')),
  notes       text,
  created_at  timestamptz not null default now(),
  unique (group_id, date)
);

-- ===== 5. attendance =====
create table public.attendance (
  meeting_id  uuid not null references public.meetings(id) on delete cascade,
  person_id   uuid not null references public.people(id) on delete cascade,
  is_present  boolean not null default false,
  justified   boolean not null default false,
  notes       text,
  marked_by   uuid references auth.users(id),
  marked_at   timestamptz not null default now(),
  primary key (meeting_id, person_id)
);

-- ===== índices =====
create index on public.meetings (group_id, date desc);
create index on public.attendance (person_id, meeting_id);
create index on public.group_memberships (person_id);
create index on public.people (is_active);

-- ===== helper: is_secretaria() =====
create or replace function public.is_secretaria() returns boolean
  language sql stable security definer
  set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid()
      and sector = 'secretaria'
      and role in ('admin','coordinator','member')
  );
$$;

-- ===== RLS =====
alter table public.attendance_groups   enable row level security;
alter table public.people              enable row level security;
alter table public.group_memberships   enable row level security;
alter table public.meetings            enable row level security;
alter table public.attendance          enable row level security;

-- read pra qualquer logado
create policy "read auth" on public.attendance_groups
  for select to authenticated using (true);
create policy "read auth" on public.people
  for select to authenticated using (true);
create policy "read auth" on public.group_memberships
  for select to authenticated using (true);
create policy "read auth" on public.meetings
  for select to authenticated using (true);
create policy "read auth" on public.attendance
  for select to authenticated using (true);

-- write: admin OR secretaria
create policy "write secretaria+admin" on public.attendance_groups
  for all to authenticated
  using (public.is_admin() or public.is_secretaria())
  with check (public.is_admin() or public.is_secretaria());

create policy "write secretaria+admin" on public.people
  for all to authenticated
  using (public.is_admin() or public.is_secretaria())
  with check (public.is_admin() or public.is_secretaria());

create policy "write secretaria+admin" on public.group_memberships
  for all to authenticated
  using (public.is_admin() or public.is_secretaria())
  with check (public.is_admin() or public.is_secretaria());

create policy "write secretaria+admin" on public.meetings
  for all to authenticated
  using (public.is_admin() or public.is_secretaria())
  with check (public.is_admin() or public.is_secretaria());

create policy "write secretaria+admin" on public.attendance
  for all to authenticated
  using (public.is_admin() or public.is_secretaria())
  with check (public.is_admin() or public.is_secretaria());

-- ===== RPC: gera encontros do mês =====
create or replace function public.generate_monthly_meetings(
  p_group_id uuid,
  p_year int,
  p_month int
) returns int
language plpgsql security definer
set search_path = public
as $$
declare
  g public.attendance_groups%rowtype;
  d date;
  end_date date;
  inserted int := 0;
  was_inserted boolean;
begin
  if not (public.is_admin() or public.is_secretaria()) then
    raise exception 'sem permissão';
  end if;

  select * into g from public.attendance_groups where id = p_group_id;
  if g.id is null then
    raise exception 'grupo não encontrado';
  end if;

  if g.schedule_kind not in ('weekly', 'biweekly') then
    raise exception 'apenas grupos semanais/quinzenais geram automaticamente. Use criação manual.';
  end if;

  if g.weekday is null then
    raise exception 'grupo precisa de weekday definido';
  end if;

  d := make_date(p_year, p_month, 1);
  end_date := (d + interval '1 month')::date;

  -- pula até o primeiro weekday do mês
  while extract(dow from d)::int <> g.weekday loop
    d := d + 1;
  end loop;

  while d < end_date loop
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

grant execute on function public.generate_monthly_meetings(uuid, int, int) to authenticated;

-- ===== RPC: bulk-init attendance para um meeting =====
-- Cria registros de attendance (is_present=false) pra todos os membros do grupo.
-- Idempotente.
create or replace function public.init_meeting_attendance(p_meeting_id uuid)
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  m public.meetings%rowtype;
  inserted int := 0;
begin
  if not (public.is_admin() or public.is_secretaria()) then
    raise exception 'sem permissão';
  end if;

  select * into m from public.meetings where id = p_meeting_id;
  if m.id is null then
    raise exception 'encontro não encontrado';
  end if;

  insert into public.attendance (meeting_id, person_id)
  select m.id, gm.person_id
    from public.group_memberships gm
    join public.people p on p.id = gm.person_id
   where gm.group_id = m.group_id
     and p.is_active
  on conflict (meeting_id, person_id) do nothing;

  get diagnostics inserted = row_count;
  return inserted;
end $$;

grant execute on function public.init_meeting_attendance(uuid) to authenticated;
