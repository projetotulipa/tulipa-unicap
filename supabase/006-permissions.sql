-- TULIPA · Permissões refinadas
-- Antes: secretaria podia CRUD em grupos. Agora só admin cria/edita/exclui grupos.
-- Secretaria continua com leitura + CRUD em people/memberships/meetings/attendance.

drop policy if exists "write secretaria+admin" on public.attendance_groups;

create policy "groups: write admin only" on public.attendance_groups
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- demais políticas continuam (secretaria pode CRUD em people, memberships, meetings, attendance).
