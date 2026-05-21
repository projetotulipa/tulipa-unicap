// TULIPA · forms · camada de dados do admin (CRUD forms + respostas + anexos).
import { supabase } from '../../js/supabase.js';
import { emptyFormSchema, defaultFormSettings } from './field-types.js';

export const ATTACH_BUCKET = 'form-attachments';

// ---------- slug ----------
export function slugify(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || `form-${Date.now().toString(36)}`;
}

async function uniqueSlug(base) {
  let slug = slugify(base);
  for (let i = 0; i < 50; i++) {
    const { data } = await supabase.from('forms').select('id').eq('slug', slug).maybeSingle();
    if (!data) return slug;
    slug = `${slugify(base)}-${i + 2}`;
  }
  return `${slugify(base)}-${Date.now().toString(36)}`;
}

// ---------- FORMS ----------
export async function listForms() {
  return supabase.from('forms')
    .select('id, slug, title, status, is_listed, response_count, created_at, updated_at')
    .order('updated_at', { ascending: false });
}

export async function getForm(id) {
  return supabase.from('forms').select('*').eq('id', id).maybeSingle();
}

export async function createForm({ title = 'Novo formulário' } = {}) {
  const slug = await uniqueSlug(title);
  const { data: u } = await supabase.auth.getUser();
  return supabase.from('forms').insert({
    title,
    slug,
    description: '',
    status: 'draft',
    is_listed: false,
    schema: emptyFormSchema(),
    settings: defaultFormSettings(),
    created_by: u?.user?.id || null,
    updated_by: u?.user?.id || null,
  }).select().single();
}

export async function updateForm(id, fields) {
  const { data: u } = await supabase.auth.getUser();
  return supabase.from('forms')
    .update({ ...fields, updated_by: u?.user?.id || null })
    .eq('id', id).select().single();
}

export async function setFormStatus(id, status)  { return updateForm(id, { status }); }
export async function setFormListed(id, is_listed){ return updateForm(id, { is_listed }); }
export async function deleteForm(id)             { return supabase.from('forms').delete().eq('id', id); }

export async function duplicateForm(id) {
  const { data: form, error } = await getForm(id);
  if (error || !form) return { data: null, error: error || new Error('não achei') };
  const slug = await uniqueSlug(`${form.title}-copia`);
  const { data: u } = await supabase.auth.getUser();
  return supabase.from('forms').insert({
    title: `${form.title} (cópia)`,
    slug,
    description: form.description,
    status: 'draft',
    is_listed: false,
    schema: form.schema,
    settings: form.settings,
    opens_at: form.opens_at,
    closes_at: form.closes_at,
    max_responses: form.max_responses,
    created_by: u?.user?.id || null,
    updated_by: u?.user?.id || null,
  }).select().single();
}

// ---------- RESPONSES ----------
export async function listResponses(formId, { status = null } = {}) {
  let q = supabase.from('form_responses')
    .select('*')
    .eq('form_id', formId)
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  return q;
}

export async function getResponse(id) {
  return supabase.from('form_responses').select('*').eq('id', id).maybeSingle();
}

export async function updateResponse(id, fields) {
  return supabase.from('form_responses').update(fields).eq('id', id).select().single();
}

export async function deleteResponse(id) {
  return supabase.from('form_responses').delete().eq('id', id);
}

export async function responseStats(formId) {
  const { data, error } = await supabase
    .from('form_responses').select('status').eq('form_id', formId);
  if (error) return { total: 0, new: 0, reviewed: 0, archived: 0, spam: 0 };
  const out = { total: data.length, new: 0, reviewed: 0, archived: 0, spam: 0 };
  for (const r of data) out[r.status] = (out[r.status] || 0) + 1;
  return out;
}

// ---------- ANEXOS ----------
export async function listResponseFiles(responseId) {
  return supabase.from('form_response_files')
    .select('*').eq('response_id', responseId).order('created_at', { ascending: true });
}

// bucket privado → URL temporária assinada p/ o admin baixar
export async function signedFileUrl(storagePath, expiresSec = 600) {
  const { data, error } = await supabase.storage
    .from(ATTACH_BUCKET).createSignedUrl(storagePath, expiresSec);
  return { url: data?.signedUrl || null, error };
}

// ---------- EXPORT CSV ----------
// Recebe o form (com schema) e a lista de respostas → string CSV.
export function responsesToCsv(form, responses) {
  const fields = [];
  for (const page of (form.schema?.pages || [])) {
    for (const f of (page.fields || [])) {
      if (f.type === 'heading' || f.type === 'paragraph' || f.type === 'image' || f.type === 'divider') continue;
      fields.push(f);
    }
  }
  const esc = (v) => {
    let s = Array.isArray(v) ? v.join('; ') : (v == null ? '' : String(v));
    if (/[",\n;]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = ['Data', 'Status', ...fields.map((f) => f.label)];
  const rows = (responses || []).map((r) => {
    const d = r.data || {};
    return [
      new Date(r.created_at).toLocaleString('pt-BR'),
      r.status,
      ...fields.map((f) => esc(d[f.key])),
    ].join(',');
  });
  return [header.map(esc).join(','), ...rows].join('\n');
}
