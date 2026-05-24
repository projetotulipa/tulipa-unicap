-- TULIPA · Encontros como peças editoriais da presidência
-- Cada meeting pode ganhar um "meeting_page" com summary_md (escrito pela presidência),
-- e fichamentos podem ser atribuídos a meetings via RPC.
--
-- Roda no SQL Editor depois de 017.

-- ===== 1. Tabela meeting_pages =====
create table public.meeting_pages (
  id           uuid primary key default gen_random_uuid(),
  meeting_id   uuid not null unique references public.meetings(id) on delete cascade,
  summary_md   text not null default '',
  is_public    boolean not null default true,
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id),
  updated_at   timestamptz not null default now()
);

create index on public.meeting_pages (meeting_id);

-- trigger updated_at
create or replace function public.tg_meeting_pages_touch_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_meeting_pages_touch
  before update on public.meeting_pages
  for each row execute function public.tg_meeting_pages_touch_updated_at();

-- ===== 2. RLS: meeting_pages =====
alter table public.meeting_pages enable row level security;

-- anon: lê só se is_public=true E a study_group_page do grupo do meeting está publicada
create policy "meeting_pages: read anon if published" on public.meeting_pages
  for select to anon using (
    is_public = true and exists (
      select 1
      from public.meetings m
      join public.study_group_pages sgp on sgp.group_id = m.group_id
      where m.id = meeting_pages.meeting_id and sgp.is_published = true
    )
  );

create policy "meeting_pages: read auth" on public.meeting_pages
  for select to authenticated using (true);

create policy "meeting_pages: write admin+presidencia" on public.meeting_pages
  for all to authenticated
  using (public.is_admin() or public.is_presidencia())
  with check (public.is_admin() or public.is_presidencia());

-- ===== 3. Policy adicional pra research_notes: presidência pode UPDATE =====
-- Pra permitir atribuir/desvincular fichamentos a meetings via RPC.
-- (Postgres não tem RLS por coluna; UI da presidência só vai mexer em meeting_id
-- + group_id auto-derivado. Pesquisa continua escrevendo livremente.)
create policy "research_notes: presidencia can update" on public.research_notes
  for update to authenticated
  using (public.is_admin() or public.is_presidencia() or public.is_pesquisa())
  with check (public.is_admin() or public.is_presidencia() or public.is_pesquisa());

-- ===== 4. RPC: assign_fichamento_to_meeting =====
-- Atribui (ou desvincula com p_meeting_id=null) um fichamento a um meeting.
-- Auto-deriva group_id do meeting pra manter consistência.
create or replace function public.assign_fichamento_to_meeting(
  p_research_note_id uuid,
  p_meeting_id uuid
) returns void
  language plpgsql security definer set search_path = public
as $$
declare
  v_group_id uuid;
begin
  if not (public.is_admin() or public.is_presidencia() or public.is_pesquisa()) then
    raise exception 'Sem permissão: apenas admin, presidência ou pesquisa podem atribuir fichamentos';
  end if;

  if p_meeting_id is null then
    update public.research_notes
       set meeting_id = null,
           updated_at = now()
     where id = p_research_note_id;
  else
    select group_id into v_group_id from public.meetings where id = p_meeting_id;
    if v_group_id is null then
      raise exception 'Meeting não encontrado: %', p_meeting_id;
    end if;
    update public.research_notes
       set meeting_id = p_meeting_id,
           group_id = v_group_id,
           updated_at = now()
     where id = p_research_note_id;
  end if;
end $$;

grant execute on function public.assign_fichamento_to_meeting(uuid, uuid) to authenticated;

-- ===== 5. RPC: mark_meeting_status (atalho pra presidência marcar realizado/cancelado) =====
create or replace function public.mark_meeting_status(
  p_meeting_id uuid,
  p_status text
) returns void
  language plpgsql security definer set search_path = public
as $$
begin
  if not (public.is_admin() or public.is_presidencia() or public.is_secretaria()) then
    raise exception 'Sem permissão: apenas admin, presidência ou secretaria podem mudar status';
  end if;
  if p_status not in ('scheduled', 'happened', 'cancelled') then
    raise exception 'Status inválido: %', p_status;
  end if;
  update public.meetings
     set status = p_status
   where id = p_meeting_id;
end $$;

grant execute on function public.mark_meeting_status(uuid, text) to authenticated;
