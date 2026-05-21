# /bio — setup do Supabase Storage

A página `/bio/` (Linktree da TULIPA) suporta **upload de imagens** pelo editor admin.
Pra que o upload funcione, é preciso criar **uma vez** um bucket público no Supabase.

## 1. Criar bucket `bio-assets`

No painel do Supabase do projeto (`lqarbyzehqrxlkavzgpo`):

1. Vai em **Storage** (ícone de pasta na sidebar).
2. Clica em **New bucket**.
3. Preenche:
   - **Name**: `bio-assets`
   - **Public bucket**: ✅ ligado (pra leitura pública dos avatares/cards na /bio)
   - **File size limit**: `2 MB` (recomendado; o editor limita em 1MB pra UX boa)
   - **Allowed MIME types** (opcional): `image/png, image/jpeg, image/webp, image/svg+xml, image/gif`
4. Clica em **Create bucket**.

## 2. Política RLS (geralmente já vem pronto pra public buckets)

O Supabase já cria automaticamente as policies necessárias quando o bucket é marcado como público. Mas se precisar conferir:

**Storage → bio-assets → Policies**:

- ✅ `SELECT` (leitura pública): qualquer um (auth.role = anon ou authenticated)
- ✅ `INSERT` (upload): só usuários autenticados — `auth.role() = 'authenticated'`

Se faltar a policy de INSERT, criar manualmente:

```sql
-- Permitir upload por usuários autenticados
CREATE POLICY "Upload bio-assets if authenticated"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'bio-assets');
```

## 3. Testar

1. Loga no admin: `/admin/`
2. Vai em **Bio** na sidebar
3. No campo "Foto de perfil", clica em **Enviar** e seleciona uma imagem
4. Se o upload funcionar e a preview aparecer → pronto ✅
5. Se der erro, verifica:
   - Bucket existe e é público?
   - Policy de INSERT pra authenticated existe?
   - Usuário está logado (não-expired)?

## 4. URL pública das imagens

Após upload, a imagem fica em:
```
https://lqarbyzehqrxlkavzgpo.supabase.co/storage/v1/object/public/bio-assets/bio/<user-id>/<timestamp>-<rand>.<ext>
```

Essas URLs são gravadas dentro do `site_content.scope = 'bio:default'` e renderizadas pela `/bio/`.

## Resumo

| Item | Valor |
|---|---|
| Bucket name | `bio-assets` |
| Public | sim |
| Size limit | 2 MB |
| Path pattern | `bio/<user>/<ts>-<rand>.<ext>` |
| Tabela usada | `site_content` (scope `bio:default`) |
| Quem edita | `role='admin'` (sidebar item escondido pros demais) |
