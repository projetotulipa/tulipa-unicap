-- TULIPA · Anotações em pessoas + sistema de tesouraria.

-- ===== 1. anotações em pessoas =====
create table public.person_notes (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references public.people(id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id),
  updated_at  timestamptz not null default now()
);

create index on public.person_notes (person_id, created_at desc);

alter table public.person_notes enable row level security;
create policy "read auth" on public.person_notes
  for select to authenticated using (true);
create policy "write secretaria+admin" on public.person_notes
  for all to authenticated
  using (public.is_admin() or public.is_secretaria())
  with check (public.is_admin() or public.is_secretaria());

-- ===== 2. pessoas: isenção + mensalidade custom =====
alter table public.people
  add column if not exists is_exempt    boolean not null default false,
  add column if not exists custom_dues  numeric(10,2);

-- ===== 3. tesouraria helper =====
create or replace function public.is_tesouraria() returns boolean
  language sql stable security definer
  set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid()
      and sector = 'tesouraria'
      and role in ('admin','coordinator','member')
  );
$$;

-- ===== 4. mensalidade padrão por mês =====
create table public.monthly_dues (
  year       int not null,
  month      int not null check (month between 1 and 12),
  amount     numeric(10,2) not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  primary key (year, month)
);

alter table public.monthly_dues enable row level security;
create policy "read auth" on public.monthly_dues
  for select to authenticated using (true);
create policy "write tesouraria+admin" on public.monthly_dues
  for all to authenticated
  using (public.is_admin() or public.is_tesouraria())
  with check (public.is_admin() or public.is_tesouraria());

-- ===== 5. pagamentos mensais =====
create table public.monthly_payments (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references public.people(id) on delete cascade,
  year        int not null,
  month       int not null check (month between 1 and 12),
  paid        boolean not null default false,
  amount      numeric(10,2),  -- valor efetivamente pago (pode diferir do padrão)
  paid_at     date,
  notes       text,
  marked_by   uuid references auth.users(id),
  marked_at   timestamptz not null default now(),
  unique (person_id, year, month)
);

create index on public.monthly_payments (year, month);
create index on public.monthly_payments (person_id);

alter table public.monthly_payments enable row level security;
create policy "read auth" on public.monthly_payments
  for select to authenticated using (true);
create policy "write tesouraria+admin" on public.monthly_payments
  for all to authenticated
  using (public.is_admin() or public.is_tesouraria())
  with check (public.is_admin() or public.is_tesouraria());

-- ===== 6. gastos =====
create table public.expenses (
  id          uuid primary key default gen_random_uuid(),
  category    text not null check (category in ('alimentacao','materiais','excepcionais','investimentos')),
  amount      numeric(10,2) not null check (amount > 0),
  description text,
  spent_on    date not null default current_date,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id),
  -- excepcionais OBRIGA descrição
  check (category <> 'excepcionais' or (description is not null and length(trim(description)) > 0))
);

create index on public.expenses (spent_on desc);
create index on public.expenses (category);

alter table public.expenses enable row level security;
create policy "read auth" on public.expenses
  for select to authenticated using (true);
create policy "write tesouraria+admin" on public.expenses
  for all to authenticated
  using (public.is_admin() or public.is_tesouraria())
  with check (public.is_admin() or public.is_tesouraria());

-- ===== 7. planejamento financeiro =====
create table public.financial_plans (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  description       text,
  estimated_amount  numeric(10,2),
  is_completed      boolean not null default false,
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id)
);

alter table public.financial_plans enable row level security;
create policy "read auth" on public.financial_plans
  for select to authenticated using (true);
create policy "write tesouraria+admin" on public.financial_plans
  for all to authenticated
  using (public.is_admin() or public.is_tesouraria())
  with check (public.is_admin() or public.is_tesouraria());
