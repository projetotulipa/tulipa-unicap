-- TULIPA · Policies do bucket bio-assets pra coordenadores e diretores
-- Resolve "new row violates row-level security policy" no upload de avatar.

-- ===== 1. Garante que o bucket existe e é público =====
insert into storage.buckets (id, name, public)
  values ('bio-assets', 'bio-assets', true)
  on conflict (id) do update set public = true;

-- ===== 2. Limpa policies antigas (idempotente) =====
drop policy if exists "bio-assets: public read"  on storage.objects;
drop policy if exists "bio-assets: auth read"    on storage.objects;
drop policy if exists "bio-assets: upload"       on storage.objects;
drop policy if exists "bio-assets: update"       on storage.objects;
drop policy if exists "bio-assets: delete"       on storage.objects;

-- ===== 3. SELECT — qualquer um lê (bucket público) =====
create policy "bio-assets: public read" on storage.objects
  for select to anon using (bucket_id = 'bio-assets');

create policy "bio-assets: auth read" on storage.objects
  for select to authenticated using (bucket_id = 'bio-assets');

-- ===== 4. INSERT — admin OR presidência OR próprio user (path scoped) =====
create policy "bio-assets: upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'bio-assets'
    and (
      public.is_admin()
      or public.is_presidencia()
      -- diretores: usuário sobe foto no próprio path directors/<uid>/...
      or name like ('directors/' || auth.uid()::text || '/%')
      -- bio (linktree compartilhado): admin only — já coberto acima
      or name like ('bio/' || auth.uid()::text || '/%')
    )
  );

-- ===== 5. UPDATE — mesma regra =====
create policy "bio-assets: update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'bio-assets'
    and (
      public.is_admin()
      or public.is_presidencia()
      or name like ('directors/' || auth.uid()::text || '/%')
      or name like ('bio/' || auth.uid()::text || '/%')
    )
  );

-- ===== 6. DELETE — mesma regra =====
create policy "bio-assets: delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'bio-assets'
    and (
      public.is_admin()
      or public.is_presidencia()
      or name like ('directors/' || auth.uid()::text || '/%')
      or name like ('bio/' || auth.uid()::text || '/%')
    )
  );
