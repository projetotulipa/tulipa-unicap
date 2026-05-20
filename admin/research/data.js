// CRUD wrappers do módulo de Pesquisa.

import { supabase } from '../../js/supabase.js';

// ---------- research_groups (sub-equipes da pesquisa) ----------
export async function listGroups({ includeArchived = false } = {}) {
  let q = supabase.from('research_groups').select('*').order('name');
  if (!includeArchived) q = q.eq('is_archived', false);
  return q;
}

export async function getGroup(id) {
  return supabase.from('research_groups').select('*').eq('id', id).maybeSingle();
}

export async function createGroup(fields) {
  return supabase.from('research_groups').insert(fields).select().single();
}

export async function updateGroup(id, fields) {
  return supabase.from('research_groups').update(fields).eq('id', id).select().single();
}

export async function deleteGroup(id) {
  return supabase.from('research_groups').delete().eq('id', id);
}

// ---------- research_group_members ----------
export async function listGroupMembers(groupId) {
  return supabase
    .from('research_group_members')
    .select('group_id, person_id, person:people(*)')
    .eq('group_id', groupId);
}

export async function addGroupMember(groupId, personId) {
  return supabase
    .from('research_group_members')
    .upsert({ group_id: groupId, person_id: personId }, { onConflict: 'group_id,person_id' });
}

export async function removeGroupMember(groupId, personId) {
  return supabase
    .from('research_group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('person_id', personId);
}

// ---------- research_notes (fichamentos) ----------
export async function listNotes({ groupId = null, researchGroupId = null, limit = null } = {}) {
  let q = supabase
    .from('research_notes')
    .select('*, group:attendance_groups(id, name), meeting:meetings(id, date, status), research_group:research_groups(id, name)')
    .order('created_at', { ascending: false });
  if (groupId) q = q.eq('group_id', groupId);
  if (researchGroupId) q = q.eq('research_group_id', researchGroupId);
  if (limit) q = q.limit(limit);
  return q;
}

export async function getNote(id) {
  return supabase
    .from('research_notes')
    .select('*, group:attendance_groups(id, name), meeting:meetings(id, date, status), research_group:research_groups(id, name)')
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
export async function listPosts({ status = null, researchGroupId = null } = {}) {
  let q = supabase
    .from('instagram_posts')
    .select('*, research_note:research_notes(id, title), research_group:research_groups(id, name)')
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  if (researchGroupId) q = q.eq('research_group_id', researchGroupId);
  return q;
}

export async function getPost(id) {
  return supabase
    .from('instagram_posts')
    .select('*, research_note:research_notes(*), research_group:research_groups(id, name)')
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
