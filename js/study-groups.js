// TULIPA · Camada de acesso aos Grupos de Estudo (LPs filhas)
// As páginas vivem em study_group_pages, vinculadas 1:1 com attendance_groups.
// Material complementar fica em study_group_resources.
//
// Usado por:
//  - admin (CRUD via presidência/admin)
//  - LP genérica /atividades/grupos-de-estudo.html (cards dos grupos publicados)
//  - LP filha   /atividades/grupos-de-estudo/grupo.html?id=<slug>

import { supabase } from './supabase.js';

// ---------- listagem ----------

// Pro admin: traz TODAS as páginas (publicadas ou não, arquivadas ou não), ordenadas.
export async function listStudyGroupPagesAdmin() {
  const { data, error } = await supabase
    .from('study_groups_public')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  return { data: data || [], error };
}

// Pro site público: traz só publicadas, separadas em ativas / arquivadas.
// Filtra também show_on_index (admin pode esconder da LP genérica sem despublicar).
export async function listPublishedStudyGroups() {
  const { data, error } = await supabase
    .from('study_groups_public')
    .select('*')
    .eq('is_published', true)
    .eq('show_on_index', true)
    .order('sort_order', { ascending: true })
    .order('updated_at', { ascending: false });
  if (error) return { active: [], archived: [], error };
  const active = [], archived = [];
  for (const g of data || []) {
    (g.is_archived ? archived : active).push(g);
  }
  return { active, archived, error: null };
}

// Pra LP filha: pega 1 grupo por slug (anon vê só publicado por RLS).
export async function getStudyGroupBySlug(slug) {
  const { data, error } = await supabase
    .from('study_groups_public')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  return { data, error };
}

// ---------- attendance_groups sem página (pro wizard) ----------
export async function attendanceGroupsWithoutPage() {
  const { data: pages, error: e1 } = await supabase
    .from('study_group_pages')
    .select('group_id');
  if (e1) return { data: [], error: e1 };
  const usedIds = new Set((pages || []).map((p) => p.group_id));

  const { data: groups, error: e2 } = await supabase
    .from('attendance_groups')
    .select('id, name, description, is_archived, semester_id')
    .order('name', { ascending: true });
  if (e2) return { data: [], error: e2 };

  const free = (groups || []).filter((g) => !usedIds.has(g.id));
  return { data: free, error: null };
}

// ---------- meetings + fichamentos (pra LP filha) ----------
export async function getStudyGroupMeetings(groupId, { onlyHappened = false } = {}) {
  let q = supabase
    .from('meetings')
    .select('id, date, status, notes')
    .eq('group_id', groupId)
    .order('date', { ascending: false });
  if (onlyHappened) q = q.eq('status', 'happened');
  const { data, error } = await q;
  return { data: data || [], error };
}

// Busca meeting_pages pra um array de meeting_ids (retorna mapa { meeting_id → page }).
export async function getMeetingPages(meetingIds) {
  if (!meetingIds?.length) return { data: {}, error: null };
  const { data, error } = await supabase
    .from('meeting_pages')
    .select('*')
    .in('meeting_id', meetingIds);
  if (error) return { data: {}, error };
  const map = {};
  for (const p of data || []) map[p.meeting_id] = p;
  return { data: map, error: null };
}

// Upsert do meeting_page (cria se não existe, atualiza se existe).
export async function upsertMeetingPage(meeting_id, patch) {
  const { data: userResp } = await supabase.auth.getUser();
  const created_by = userResp?.user?.id ?? null;
  const { data, error } = await supabase
    .from('meeting_pages')
    .upsert({ meeting_id, created_by, ...patch }, { onConflict: 'meeting_id' })
    .select()
    .single();
  return { data, error };
}

// Atribui/desvincula fichamento a meeting (via RPC).
export async function assignFichamento(researchNoteId, meetingId) {
  const { error } = await supabase.rpc('assign_fichamento_to_meeting', {
    p_research_note_id: researchNoteId,
    p_meeting_id: meetingId,
  });
  return { error };
}

// Marca status do meeting (via RPC) — atalho pra presidência.
export async function markMeetingStatus(meetingId, status) {
  const { error } = await supabase.rpc('mark_meeting_status', {
    p_meeting_id: meetingId,
    p_status: status,
  });
  return { error };
}

// Lista fichamentos do grupo SEM meeting_id (pra modal "atribuir fichamento").
export async function listUnassignedFichamentos(groupId) {
  const { data, error } = await supabase
    .from('research_notes')
    .select('id, title, body, created_at')
    .eq('group_id', groupId)
    .is('meeting_id', null)
    .order('created_at', { ascending: false });
  return { data: data || [], error };
}

// Pega fichamentos de UM grupo (todos), com info do meeting vinculado quando houver.
export async function getStudyGroupFichamentos(groupId) {
  const { data, error } = await supabase
    .from('research_notes')
    .select('id, title, body, created_at, meeting_id')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });
  return { data: data || [], error };
}

// ---------- recursos (material complementar) ----------
export async function getStudyGroupResources(pageId, { onlyVisible = false } = {}) {
  let q = supabase
    .from('study_group_resources')
    .select('*')
    .eq('page_id', pageId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (onlyVisible) q = q.eq('is_hidden', false);
  const { data, error } = await q;
  return { data: data || [], error };
}

// ---------- mutations (admin) ----------

export async function createStudyGroupPage(payload) {
  const { data: userResp } = await supabase.auth.getUser();
  const created_by = userResp?.user?.id ?? null;
  const { data, error } = await supabase
    .from('study_group_pages')
    .insert({ ...payload, created_by })
    .select()
    .single();
  return { data, error };
}

export async function updateStudyGroupPage(id, patch) {
  const { data, error } = await supabase
    .from('study_group_pages')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}

export async function deleteStudyGroupPage(id) {
  const { error } = await supabase
    .from('study_group_pages')
    .delete()
    .eq('id', id);
  return { error };
}

// Cria um attendance_group novo + a página numa só operação JS (não é atomic, mas
// cobre o cenário comum de "criar grupo do zero pela presidência").
export async function createGroupAndPage({ name, description, slug, ...pagePatch }) {
  const { data: userResp } = await supabase.auth.getUser();
  const created_by = userResp?.user?.id ?? null;

  const { data: grp, error: e1 } = await supabase
    .from('attendance_groups')
    .insert({ name, description: description || null, created_by })
    .select()
    .single();
  if (e1) return { data: null, error: e1 };

  const { data: page, error: e2 } = await supabase
    .from('study_group_pages')
    .insert({
      group_id: grp.id,
      slug,
      created_by,
      ...pagePatch,
    })
    .select()
    .single();
  if (e2) {
    // rollback manual do grupo recém-criado
    await supabase.from('attendance_groups').delete().eq('id', grp.id);
    return { data: null, error: e2 };
  }
  return { data: { group: grp, page }, error: null };
}

// ---------- resources mutations ----------

export async function createResource(pageId, payload) {
  const { data: userResp } = await supabase.auth.getUser();
  const created_by = userResp?.user?.id ?? null;
  const { data, error } = await supabase
    .from('study_group_resources')
    .insert({ page_id: pageId, created_by, ...payload })
    .select()
    .single();
  return { data, error };
}

export async function updateResource(id, patch) {
  const { data, error } = await supabase
    .from('study_group_resources')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}

export async function deleteResource(id) {
  const { error } = await supabase
    .from('study_group_resources')
    .delete()
    .eq('id', id);
  return { error };
}

// Reordena recursos: aceita lista de ids na nova ordem; atualiza sort_order em batch.
export async function reorderResources(pageId, orderedIds) {
  // estratégia simples: updates sequenciais (lista é pequena)
  const updates = orderedIds.map((id, idx) =>
    supabase.from('study_group_resources').update({ sort_order: idx }).eq('id', id).eq('page_id', pageId)
  );
  const results = await Promise.all(updates);
  const firstError = results.find((r) => r.error)?.error;
  return { error: firstError || null };
}

// ---------- utils ----------

// Slug determinístico a partir de um nome: minúsculas, sem acento, hífens.
export function slugify(name) {
  return String(name || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// Extrai ID do YouTube de qualquer URL (watch, youtu.be, embed, shorts).
export function youtubeId(url) {
  if (!url) return null;
  const s = String(url);
  // formatos comuns
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{6,})/,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) return m[1];
  }
  return null;
}

// Extrai ID do Drive (file ou folder).
export function driveInfo(url) {
  if (!url) return null;
  const s = String(url);
  const fileMatch = s.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{10,})/);
  if (fileMatch) return { kind: 'file', id: fileMatch[1] };
  const folderMatch = s.match(/drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (folderMatch) return { kind: 'folder', id: folderMatch[1] };
  const openMatch = s.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]{10,})/);
  if (openMatch) return { kind: 'file', id: openMatch[1] };
  return null;
}

// Pra renderização: tipos amigáveis pra label/ícone.
export const RESOURCE_KINDS = [
  { value: 'youtube',       label: 'Vídeo (YouTube)',  icon: 'play',      group: 'video' },
  { value: 'drive',         label: 'Google Drive',      icon: 'document',  group: 'video' },
  { value: 'external_link', label: 'Link externo',      icon: 'external',  group: 'link' },
  { value: 'book',          label: 'Livro',             icon: 'book',      group: 'reading' },
  { value: 'article',       label: 'Artigo',            icon: 'page',      group: 'reading' },
  { value: 'movie',         label: 'Filme',             icon: 'film',      group: 'culture' },
  { value: 'series',        label: 'Série',             icon: 'film',      group: 'culture' },
  { value: 'anime',         label: 'Anime',             icon: 'film',      group: 'culture' },
  { value: 'podcast',       label: 'Podcast',           icon: 'mic',       group: 'culture' },
  { value: 'image',         label: 'Imagem',            icon: 'image',     group: 'media' },
  { value: 'document',      label: 'Documento (PDF)',   icon: 'document',  group: 'reading' },
  { value: 'other',         label: 'Outro',             icon: 'star',      group: 'other' },
];

export function resourceKindLabel(kind) {
  return RESOURCE_KINDS.find((k) => k.value === kind)?.label || kind;
}

export const RESOURCE_GROUPS = [
  { value: 'video',   label: 'Vídeos',         icon: 'play' },
  { value: 'reading', label: 'Leituras',       icon: 'book' },
  { value: 'culture', label: 'Cultura',        icon: 'film' },
  { value: 'link',    label: 'Links',          icon: 'external' },
  { value: 'media',   label: 'Mídia visual',   icon: 'image' },
  { value: 'other',   label: 'Outros',         icon: 'star' },
];
