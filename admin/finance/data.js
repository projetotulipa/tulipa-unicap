// CRUD wrappers do módulo de tesouraria.

import { supabase } from '../../js/supabase.js';

// ---------- monthly_dues (valor padrão por mês) ----------
export async function getMonthlyDues(year, month) {
  return supabase
    .from('monthly_dues')
    .select('*')
    .eq('year', year)
    .eq('month', month)
    .maybeSingle();
}

export async function setMonthlyDues(year, month, amount) {
  return supabase
    .from('monthly_dues')
    .upsert({ year, month, amount, updated_at: new Date().toISOString() }, { onConflict: 'year,month' })
    .select()
    .single();
}

// ---------- monthly_payments ----------
export async function listMonthlyPayments(year, month) {
  return supabase
    .from('monthly_payments')
    .select('*, person:people(*)')
    .eq('year', year)
    .eq('month', month);
}

export async function markPayment({ person_id, year, month, paid, amount = null, notes = null, paid_at = null }) {
  return supabase
    .from('monthly_payments')
    .upsert({
      person_id, year, month, paid, amount, notes, paid_at,
      marked_at: new Date().toISOString(),
    }, { onConflict: 'person_id,year,month' });
}

// pessoas ativas que pagam mensalidade (não isentas)
export async function listPayingPeople() {
  return supabase
    .from('people')
    .select('*')
    .eq('is_active', true)
    .eq('is_exempt', false)
    .order('full_name');
}

// ---------- expenses ----------
export async function listExpenses({ from, to } = {}) {
  let q = supabase.from('expenses').select('*').order('spent_on', { ascending: false });
  if (from) q = q.gte('spent_on', from);
  if (to)   q = q.lte('spent_on', to);
  return q;
}

export async function createExpense(fields) {
  return supabase.from('expenses').insert(fields).select().single();
}

export async function updateExpense(id, fields) {
  return supabase.from('expenses').update(fields).eq('id', id).select().single();
}

export async function deleteExpense(id) {
  return supabase.from('expenses').delete().eq('id', id);
}

export async function sumExpensesByCategory({ from, to } = {}) {
  const { data, error } = await listExpenses({ from, to });
  if (error) return { data: null, error };
  const byCat = {};
  let total = 0;
  for (const e of (data || [])) {
    const v = Number(e.amount || 0);
    byCat[e.category] = (byCat[e.category] || 0) + v;
    total += v;
  }
  return { data: { byCategory: byCat, total }, error: null };
}

// ---------- financial_plans ----------
export async function listPlans({ includeCompleted = true } = {}) {
  let q = supabase.from('financial_plans').select('*').order('created_at', { ascending: false });
  if (!includeCompleted) q = q.eq('is_completed', false);
  return q;
}

export async function createPlan(fields) {
  return supabase.from('financial_plans').insert(fields).select().single();
}

export async function updatePlan(id, fields) {
  return supabase.from('financial_plans').update(fields).eq('id', id).select().single();
}

export async function togglePlanCompleted(id, completed) {
  return updatePlan(id, {
    is_completed: completed,
    completed_at: completed ? new Date().toISOString() : null,
  });
}

export async function deletePlan(id) {
  return supabase.from('financial_plans').delete().eq('id', id);
}
