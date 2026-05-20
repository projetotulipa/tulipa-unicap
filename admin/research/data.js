// CRUD wrappers do módulo de Pesquisa.

import { supabase } from '../../js/supabase.js';

// ---------- research_notes (fichamentos) ----------
export async function listNotes({ groupId = null, limit = null } = {}) {
  let q = supabase
    .from('research_notes')
    .select('*, group:attendance_groups(id, name), meeting:meetings(id, date, status)')
    .order('created_at', { ascending: false });
  if (groupId) q = q.eq('group_id', groupId);
  if (limit) q = q.limit(limit);
  return q;
}

export async function getNote(id) {
  return supabase
    .from('research_notes')
    .select('*, group:attendance_groups(id, name), meeting:meetings(id, date, status)')
    .eq('id', id)
    .maybeSingle();
}

export async function createNote(fields) {
  return supabase.from('research_notes').insert(fields).select().single();
}

export async function updateNote(id, fields) {
  return supabase
    .from('research_notes')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
}

export async function deleteNote(id) {
  return supabase.from('research_notes').delete().eq('id', id);
}

// ---------- instagram_posts ----------
export async function listPosts({ status = null } = {}) {
  let q = supabase
    .from('instagram_posts')
    .select('*, research_note:research_notes(id, title)')
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  return q;
}

export async function getPost(id) {
  return supabase
    .from('instagram_posts')
    .select('*, research_note:research_notes(*)')
    .eq('id', id)
    .maybeSingle();
}

export async function createPost(fields) {
  return supabase.from('instagram_posts').insert(fields).select().single();
}

export async function updatePost(id, fields) {
  return supabase
    .from('instagram_posts')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
}

export async function deletePost(id) {
  return supabase.from('instagram_posts').delete().eq('id', id);
}
