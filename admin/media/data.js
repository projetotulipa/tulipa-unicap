// CRUD wrappers do módulo de Mídia.

import { supabase } from '../../js/supabase.js';

// ---------- media_teams ----------
export async function listTeams({ includeArchived = false } = {}) {
  let q = supabase.from('media_teams').select('*').order('name');
  if (!includeArchived) q = q.eq('is_archived', false);
  return q;
}

export async function getTeam(id) {
  return supabase.from('media_teams').select('*').eq('id', id).maybeSingle();
}

export async function createTeam(fields) {
  return supabase.from('media_teams').insert(fields).select().single();
}

export async function updateTeam(id, fields) {
  return supabase.from('media_teams').update(fields).eq('id', id).select().single();
}

export async function deleteTeam(id) {
  return supabase.from('media_teams').delete().eq('id', id);
}

// ---------- media_team_members ----------
export async function listTeamMembers(teamId) {
  return supabase
    .from('media_team_members')
    .select('team_id, person_id, person:people(*)')
    .eq('team_id', teamId);
}

export async function addTeamMember(teamId, personId) {
  return supabase
    .from('media_team_members')
    .upsert({ team_id: teamId, person_id: personId }, { onConflict: 'team_id,person_id' });
}

export async function removeTeamMember(teamId, personId) {
  return supabase
    .from('media_team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('person_id', personId);
}

// ---------- posts recebidos ----------
export async function listIncomingPosts() {
  return supabase
    .from('instagram_posts')
    .select('*, research_note:research_notes(id, title, body)')
    .in('status', ['sent_to_media', 'scheduled'])
    .order('created_at', { ascending: false });
}

// ---------- media_tasks ----------
export async function listTasks({ status = null, teamId = null } = {}) {
  let q = supabase
    .from('media_tasks')
    .select(`
      *,
      team:media_teams(id, name),
      assignee:people(id, full_name),
      post:instagram_posts(id, title, body, status, research_note:research_notes(id, title))
    `)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  if (teamId) q = q.eq('team_id', teamId);
  return q;
}

export async function getTask(id) {
  return supabase
    .from('media_tasks')
    .select(`
      *,
      team:media_teams(id, name),
      assignee:people(id, full_name),
      post:instagram_posts(*, research_note:research_notes(*))
    `)
    .eq('id', id)
    .maybeSingle();
}

export async function createTask(fields) {
  return supabase.from('media_tasks').insert(fields).select().single();
}

export async function updateTask(id, fields) {
  const patch = { ...fields };
  if (fields.status === 'done' && !fields.completed_at) {
    patch.completed_at = new Date().toISOString();
  } else if (fields.status && fields.status !== 'done') {
    patch.completed_at = null;
  }
  return supabase.from('media_tasks').update(patch).eq('id', id).select().single();
}

export async function deleteTask(id) {
  return supabase.from('media_tasks').delete().eq('id', id);
}
