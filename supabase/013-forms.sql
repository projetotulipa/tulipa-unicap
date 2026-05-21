-- ============================================================
-- 013-forms.sql  ·  Sistema de Formulários TULIPA
-- Tabelas: forms (definição + todas as configs em JSONB),
--          form_responses (envios), form_response_files (anexos).
-- Acesso: leitura pública só de forms PUBLICADOS; insert ANÔNIMO de
--         respostas/anexos quando o form está publicado e na janela;
--         leitura/gestão das respostas só p/ admin.
-- Storage: bucket 'form-attachments' (criar no dashboard como PRIVADO).
-- ============================================================

-- garante helper de admin (idempotente; outras policies já usam is_admin())
create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- ===================== FORMS =====================
create table if not exists public.forms (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  title          text not null,
  description    text not null default '',

  -- publicação / visibilidade (o usuário controla por formulário)
  status         text not null default 'draft'
                   check (status in ('draft','published','closed','archived')),
  is_listed      boolean not null default false,   -- false = oculta (só por link)

  -- estrutura completa (páginas/etapas + campos + lógica) em JSONB
  schema         jsonb not null default '{"pages":[{"id":"p1","title":"","fields":[]}]}'::jsonb,
  -- aparência, mensagens, anti-spam, LGPD, redirecionamento, etc.
  settings       jsonb not null default '{}'::jsonb,

  -- janela e limite (denormalizado p/ a policy de insert anônimo)
  opens_at       timestamptz,
  closes_at      timestamptz,
  max_responses  int,
  response_count int not null default 0,

  created_at     timestamptz not null default now(),
  created_by     uuid references auth.users(id),
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users(id)
);
create index if not exists forms_status_idx on public.forms (status);
create index if not exists forms_slug_idx   on public.forms (slug);

-- ===================== RESPONSES =====================
create table if not exists public.form_responses (
  id               uuid primary key default gen_random_uuid(),
  form_id          uuid not null references public.forms(id) on delete cascade,
  data             jsonb not null default '{}'::jsonb,   -- { fieldKey: valor }

  respondent_name  text,
  respondent_email text,

  status           text not null default 'new'
                     check (status in ('new','reviewed','archived','spam')),
  admin_notes      text not null default '',

  submitted_by     uuid references auth.users(id),       -- null = anônimo
  ip               text,
  user_agent       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists form_responses_form_idx   on public.form_responses (form_id, created_at desc);
create index if not exists form_responses_status_idx on public.form_responses (form_id, status);

-- ===================== RESPONSE FILES (anexos) =====================
create table if not exists public.form_response_files (
  id            uuid primary key default gen_random_uuid(),
  response_id   uuid not null references public.form_responses(id) on delete cascade,
  form_id       uuid not null references public.forms(id) on delete cascade,
  field_key     text not null,
  file_name     text not null,
  file_size     bigint not null default 0,
  mime_type     text,
  storage_path  text not null,
  created_at    timestamptz not null default now()
);
create index if not exists form_response_files_response_idx on public.form_response_files (response_id);

-- ===================== TRIGGERS =====================
create or replace function public.set_updated_at() returns trigger
  language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists forms_updated_at on public.forms;
create trigger forms_updated_at before update on public.forms
  for each row execute function public.set_updated_at();

drop trigger if exists form_responses_updated_at on public.form_responses;
create trigger form_responses_updated_at before update on public.form_responses
  for each row execute function public.set_updated_at();

-- conta respostas (usado pela policy de max_responses e pelos badges do admin)
create or replace function public.bump_form_response_count() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  update public.forms set response_count = response_count + 1 where id = new.form_id;
  return new;
end; $$;
drop trigger if exists form_responses_count on public.form_responses;
create trigger form_responses_count after insert on public.form_responses
  for each row execute function public.bump_form_response_count();

-- ===================== RLS =====================
alter table public.forms               enable row level security;
alter table public.form_responses      enable row level security;
alter table public.form_response_files enable row level security;

-- FORMS: público lê só publicados; admin lê tudo e gerencia
drop policy if exists "forms public read" on public.forms;
create policy "forms public read" on public.forms
  for select to anon, authenticated
  using (status = 'published');

drop policy if exists "forms admin read all" on public.forms;
create policy "forms admin read all" on public.forms
  for select to authenticated using (public.is_admin());

drop policy if exists "forms admin write" on public.forms;
create policy "forms admin write" on public.forms
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- RESPONSES: insert anônimo só se o form está publicado e dentro da janela/limite
drop policy if exists "responses anon insert" on public.form_responses;
create policy "responses anon insert" on public.form_responses
  for insert to anon, authenticated
  with check (
    exists (
      select 1 from public.forms f
      where f.id = form_id
        and f.status = 'published'
        and (f.opens_at  is null or now() >= f.opens_at)
        and (f.closes_at is null or now() <= f.closes_at)
        and (f.max_responses is null or f.response_count < f.max_responses)
    )
  );

drop policy if exists "responses admin read" on public.form_responses;
create policy "responses admin read" on public.form_responses
  for select to authenticated using (public.is_admin());

drop policy if exists "responses admin update" on public.form_responses;
create policy "responses admin update" on public.form_responses
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "responses admin delete" on public.form_responses;
create policy "responses admin delete" on public.form_responses
  for delete to authenticated using (public.is_admin());

-- RESPONSE FILES: insert anônimo vinculado a form publicado; leitura/gestão admin
drop policy if exists "files anon insert" on public.form_response_files;
create policy "files anon insert" on public.form_response_files
  for insert to anon, authenticated
  with check (
    exists (select 1 from public.forms f where f.id = form_id and f.status = 'published')
  );

drop policy if exists "files admin read" on public.form_response_files;
create policy "files admin read" on public.form_response_files
  for select to authenticated using (public.is_admin());

drop policy if exists "files admin delete" on public.form_response_files;
create policy "files admin delete" on public.form_response_files
  for delete to authenticated using (public.is_admin());

-- ===================== STORAGE (bucket form-attachments) =====================
-- Crie o bucket 'form-attachments' no dashboard como PRIVADO,
-- com limite de tamanho (ex.: 10MB) e MIME allowlist. Depois as policies:
drop policy if exists "form-attach anon upload" on storage.objects;
create policy "form-attach anon upload" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'form-attachments');

drop policy if exists "form-attach admin read" on storage.objects;
create policy "form-attach admin read" on storage.objects
  for select to authenticated
  using (bucket_id = 'form-attachments' and public.is_admin());

drop policy if exists "form-attach admin delete" on storage.objects;
create policy "form-attach admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'form-attachments' and public.is_admin());

-- FIM 013-forms.sql
