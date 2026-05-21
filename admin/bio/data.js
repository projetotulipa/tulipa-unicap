// Bio system — /bio/ é o Linktree-style da TULIPA pra ir na bio do Instagram.
// Armazenamento: site_content scope `bio:default` (reusa infra). Sem migration nova.
// Imagens: Supabase Storage bucket `bio-assets` (público pra leitura).

import { supabase } from '../../js/supabase.js';

export const BIO_SCOPE = 'bio:default';
export const BIO_BUCKET = 'bio-assets';

// ===== DEFAULTS (2 cards pré-cadastrados, deletáveis) =====
export const BIO_DEFAULTS = Object.freeze({
  identity: {
    avatar: null,
    name: 'TULIPA',
    tagline: 'Tessitura Universitária de Linguagens em Psicologia Analítica',
    bio: 'Projeto de extensão em Psicologia Analítica Junguiana da UNICAP. Recife, Pernambuco.',
  },
  links: [
    {
      id: 'default-site',
      label: 'Conheça o projeto',
      href: 'https://projetotulipa.github.io/tulipa-unicap/',
      description: 'O site completo da TULIPA — manifesto, atividades, departamentos e grupos de estudo.',
      image: null,
      icon: 'brand',
      hidden: false,
    },
    {
      id: 'default-allos',
      label: 'Saiba mais',
      href: 'https://allos.org.br/terapiasocial',
      description: 'Terapia social pela Allos — psicoterapia acessível conduzida por profissionais em formação supervisionada.',
      image: null,
      icon: 'heart',
      hidden: false,
    },
  ],
});

// ===== Cache local =====
const LS_BIO_CACHE = 'tulipa:bio-cache';

function readCache() {
  try { return JSON.parse(localStorage.getItem(LS_BIO_CACHE) || 'null'); }
  catch { return null; }
}
function writeCache(content) {
  try { localStorage.setItem(LS_BIO_CACHE, JSON.stringify(content)); } catch {}
}

// Normaliza qualquer payload pra ter shape consistente (preenche missing keys)
function normalize(raw) {
  const out = {
    identity: {
      ...BIO_DEFAULTS.identity,
      ...(raw?.identity || {}),
    },
    links: Array.isArray(raw?.links) ? raw.links.map((l, i) => ({
      id: l.id || `link-${Date.now()}-${i}`,
      label: String(l.label || ''),
      href: String(l.href || ''),
      description: String(l.description || ''),
      image: l.image || null,
      icon: l.icon || null,
      hidden: !!l.hidden,
    })) : [],
  };
  return out;
}

// ===== Leitura =====
export async function getBioContent() {
  try {
    const { data, error } = await supabase
      .from('site_content')
      .select('data, version')
      .eq('scope', BIO_SCOPE)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data?.data) {
      const content = { ...normalize(data.data), isDefault: false, version: data.version };
      writeCache(content);
      return content;
    }
  } catch (e) {
    console.warn('[bio] getBioContent erro:', e?.message);
  }

  const cached = readCache();
  if (cached) return cached;
  return { ...normalize(BIO_DEFAULTS), isDefault: true };
}

// ===== Escrita =====
export async function setBioContent(payload) {
  try {
    const { data: userResp } = await supabase.auth.getUser();
    if (!userResp?.user) throw new Error('não autenticado');
    const version = Date.now();
    const data = normalize(payload);
    const { error } = await supabase
      .from('site_content')
      .insert({
        scope: BIO_SCOPE,
        version,
        data,
        note: 'bio atualizada',
        published_by: userResp.user.id,
      });
    if (error) throw error;
    writeCache({ ...data, isDefault: false, version });
    return { data: { version }, error: null };
  } catch (e) {
    return { data: null, error: e };
  }
}

// Restaura pros defaults (salva uma nova versão com payload default).
export async function resetBioContent() {
  return setBioContent(BIO_DEFAULTS);
}

// ===== Upload pra Supabase Storage =====
// Path: bio/<user-id>/<timestamp>-<random>.<ext>
export async function uploadBioImage(file) {
  try {
    const { data: userResp } = await supabase.auth.getUser();
    if (!userResp?.user) throw new Error('não autenticado');

    const ext = (file.name || 'png').split('.').pop().toLowerCase().slice(0, 5) || 'png';
    const rand = Math.random().toString(36).slice(2, 8);
    const path = `bio/${userResp.user.id}/${Date.now()}-${rand}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(BIO_BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
      });
    if (upErr) throw upErr;

    const { data: { publicUrl } } = supabase.storage
      .from(BIO_BUCKET)
      .getPublicUrl(path);

    return { url: publicUrl, path, error: null };
  } catch (e) {
    return { url: null, path: null, error: e };
  }
}

// Remove imagem do storage (best-effort — se falhar não impede o save).
export async function removeBioImage(pathOrUrl) {
  try {
    let path = pathOrUrl;
    // se for URL pública, extrai o path
    if (path?.includes('/storage/v1/object/public/')) {
      const m = path.match(/\/public\/[^/]+\/(.+)$/);
      if (m) path = m[1];
    }
    if (!path) return { error: null };
    return await supabase.storage.from(BIO_BUCKET).remove([path]);
  } catch (e) {
    return { error: e };
  }
}
