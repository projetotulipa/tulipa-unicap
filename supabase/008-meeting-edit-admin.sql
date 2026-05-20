-- TULIPA · Apenas admin pode UPDATE/DELETE encontros.
-- Secretaria continua podendo SELECT e INSERT (gerar encontros, criar manuais).

drop policy if exists "write secretaria+admin" on public.meetings;

create policy "meetings: insert secretaria+admin" on public.meetings
  for insert to authenticated
  with check (public.is_admin() or public.is_secretaria());

create policy "meetings: update admin only" on public.meetings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "meetings: delete admin only" on public.meetings
  for delete to authenticated
  using (public.is_admin());

-- SELECT continua via policy existente "read auth"
