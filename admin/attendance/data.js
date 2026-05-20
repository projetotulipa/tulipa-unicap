// CRUD wrappers do módulo de presença. Todos retornam { data, error }.

import { supabase } from '../../js/supabase.js';

// ---------- groups ----------
export async function listGroups({ includeArchived = false } = {}) {
  let q = supabase.from('attendance_groups').select('*').order('name');
  if (!includeArchived) q = q.eq('is_archived', false);
  return q;
}

export async function getGroup(id) {
  return supabase.from('attendance_groups').select('*').eq('id', id).maybeSingle();
}

export async function createGroup(fields) {
  return supabase.from('attendance_groups').insert(fields).select().single();
}

export async function updateGroup(id, fields) {
  return supabase.from('attendance_groups').update(fields).eq('id', id).select().single();
}

export async function archiveGroup(id) {
  return updateGroup(id, { is_archived: true });
}

export async function unarchiveGroup(id) {
  return updateGroup(id, { is_archived: false });
}

export async function deleteGroup(id) {
  return supabase.from('attendance_groups').delete().eq('id', id);
}

// ---------- people ----------
export async function listPeople({ includeInactive = false } = {}) {
  let q = supabase.from('people').select('*').order('full_name');
  if (!includeInactive) q = q.eq('is_active', true);
  return q;
}

export async function getPerson(id) {
  return supabase.from('people').select('*').eq('id', id).maybeSingle();
}

export async function createPerson(fields) {
  return supabase.from('people').insert(fields).select().single();
}

export async function updatePerson(id, fields) {
  return supabase.from('people').update(fields).eq('id', id).select().single();
}

export async function deactivatePerson(id) {
  return updatePerson(id, { is_active: false });
}

export async function activatePerson(id) {
  return updatePerson(id, { is_active: true });
}

export async function deletePerson(id) {
  return supabase.from('people').delete().eq('id', id);
}

// ---------- person notes (anotações sobre pessoas) ----------
export async function listPersonNotes(personId) {
  return supabase
    .from('person_notes')
    .select('*')
    .eq('person_id', personId)
    .order('created_at', { ascending: false });
}

export async function addPersonNote(personId, body) {
  return supabase
    .from('person_notes')
    .insert({ person_id: personId, body })
    .select()
    .single();
}

export async function updatePersonNote(id, body) {
  return supabase
    .from('person_notes')
    .update({ body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
}

export async function deletePersonNote(id) {
  return supabase.from('person_notes').delete().eq('id', id);
}

// ---------- memberships ----------
export async function listMembershipsOfGroup(groupId) {
  return supabase
    .from('group_memberships')
    .select('group_id, person_id, is_primary, joined_at, person:people(*)')
    .eq('group_id', groupId)
    .order('is_primary', { ascending: false });
}

export async function listMembershipsOfPerson(personId) {
  return supabase
    .from('group_memberships')
    .select('group_id, person_id, is_primary, joined_at, group:attendance_groups(*)')
    .eq('person_id', personId);
}

export async function setMembership({ group_id, person_id, is_primary = false }) {
  return supabase
    .from('group_memberships')
    .upsert({ group_id, person_id, is_primary }, { onConflict: 'group_id,person_id' })
    .select()
    .single();
}

export async function removeMembership(group_id, person_id) {
  return supabase
    .from('group_memberships')
    .delete()
    .eq('group_id', group_id)
    .eq('person_id', person_id);
}

// "promove" a pessoa pra primário num grupo (desliga primário em outros).
export async function setPrimaryGroup(person_id, primary_group_id) {
  // tira primary de todos os outros vínculos da pessoa
  await supabase
    .from('group_memberships')
    .update({ is_primary: false })
    .eq('person_id', person_id);
  // marca o escolhido como primary
  return setMembership({ group_id: primary_group_id, person_id, is_primary: true });
}

// ---------- meetings ----------
export async function listMeetings(group_id, { from, to } = {}) {
  let q = supabase
    .from('meetings')
    .select('*')
    .eq('group_id', group_id)
    .order('date');
  if (from) q = q.gte('date', from);
  if (to) q = q.lte('date', to);
  return q;
}

// retorna todas as meetings (de quaisquer grupos) numa janela de datas.
// usada pelo dashboard de Pesquisa pra desenhar o skyline de aulas.
export async function listMeetingsBetween({ from, to } = {}) {
  let q = supabase
    .from('meetings')
    .select('*, group:attendance_groups(id, name)')
    .order('date');
  if (from) q = q.gte('date', from);
  if (to)   q = q.lte('date', to);
  return q;
}

export async function getMeeting(id) {
  return supabase.from('meetings').select('*, group:attendance_groups(*)').eq('id', id).maybeSingle();
}

export async function createMeeting(fields) {
  return supabase.from('meetings').insert(fields).select().single();
}

export async function updateMeeting(id, fields) {
  return supabase.from('meetings').update(fields).eq('id', id).select().single();
}

export async function deleteMeeting(id) {
  return supabase.from('meetings').delete().eq('id', id);
}

export async function generateMonthlyMeetings(group_id, year, month) {
  return supabase.rpc('generate_monthly_meetings', {
    p_group_id: group_id,
    p_year: year,
    p_month: month,
  });
}

export async function generateMeetingsInRange(group_id, start_date, end_date) {
  return supabase.rpc('generate_meetings_in_range', {
    p_group_id: group_id,
    p_start_date: start_date,
    p_end_date: end_date,
  });
}

// ---------- semesters ----------
export async function listSemesters() {
  return supabase.from('semesters').select('*').order('start_date', { ascending: false });
}

export async function getSemester(id) {
  return supabase.from('semesters').select('*').eq('id', id).maybeSingle();
}

export async function getCurrentSemester() {
  try {
    const { data, error } = await supabase
      .from('semesters')
      .select('*')
      .eq('is_current', true)
      .maybeSingle();
    if (error) {
      // se a tabela ainda não existe (migration 007 não rodada), retorna null silenciosamente
      if (/relation .* does not exist/i.test(error.message)) {
        return { data: null, error: null };
      }
      return { data: null, error };
    }
    return { data, error: null };
  } catch (e) {
    return { data: null, error: null };
  }
}

export async function createSemester(fields) {
  return supabase.from('semesters').insert(fields).select().single();
}

export async function updateSemester(id, fields) {
  return supabase.from('semesters').update(fields).eq('id', id).select().single();
}

export async function deleteSemester(id) {
  return supabase.from('semesters').delete().eq('id', id);
}

export async function setCurrentSemester(id) {
  return supabase.rpc('set_current_semester', { p_id: id });
}

// ---------- attendance ----------
export async function listAttendance(meeting_id) {
  return supabase
    .from('attendance')
    .select('meeting_id, person_id, is_present, justified, notes, marked_at, person:people(*)')
    .eq('meeting_id', meeting_id);
}

export async function listAttendanceByGroupInRange(group_id, from, to) {
  // join meetings + attendance — útil pra calcular status mensal
  return supabase
    .from('meetings')
    .select('id, date, status, group_id, attendance(*)')
    .eq('group_id', group_id)
    .gte('date', from)
    .lte('date', to)
    .order('date');
}

export async function initMeetingAttendance(meeting_id) {
  return supabase.rpc('init_meeting_attendance', { p_meeting_id: meeting_id });
}

export async function markPresent(meeting_id, person_id, is_present, opts = {}) {
  const { justified = false, notes = null, justification_category = null } = opts;
  return supabase
    .from('attendance')
    .upsert(
      {
        meeting_id, person_id, is_present, justified,
        notes,
        justification_category: justified ? justification_category : null,
        marked_at: new Date().toISOString(),
      },
      { onConflict: 'meeting_id,person_id' }
    );
}

export async function listJustifications(group_id, from, to) {
  // todas as faltas justificadas de um grupo num intervalo
  return supabase
    .from('attendance')
    .select(`
      meeting_id, person_id, justified, justification_category, notes, marked_at,
      meeting:meetings!inner(date, group_id, status),
      person:people(full_name, email)
    `)
    .eq('justified', true)
    .eq('meeting.group_id', group_id)
    .gte('meeting.date', from)
    .lte('meeting.date', to)
    .order('marked_at', { ascending: false });
}

// histórico de presença de uma pessoa específica (todos os grupos dela)
// usado no drawer de pessoa pra montar o skyline individual.
export async function listAttendanceOfPerson(personId, { from, to } = {}) {
  let q = supabase
    .from('attendance')
    .select(`
      meeting_id, is_present, justified, justification_category, notes, marked_at,
      meeting:meetings!inner(id, date, status, group_id, group:attendance_groups(id, name))
    `)
    .eq('person_id', personId);
  if (from) q = q.gte('meeting.date', from);
  if (to)   q = q.lte('meeting.date', to);
  return q;
}

export async function bulkUpdateAttendance(meeting_id, rows) {
  // rows: [{ person_id, is_present, justified?, notes? }]
  const records = rows.map((r) => ({
    meeting_id,
    person_id: r.person_id,
    is_present: !!r.is_present,
    justified: !!r.justified,
    notes: r.notes || null,
    marked_at: new Date().toISOString(),
  }));
  return supabase
    .from('attendance')
    .upsert(records, { onConflict: 'meeting_id,person_id' });
}
