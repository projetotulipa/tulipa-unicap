import { supabase } from './supabase.js';
import { SCOPES, LS_DATA, LS_SNAPSHOT_VERSION } from './config.js';

// ---------- localStorage helpers (defensivos) ----------
function readLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// ---------- data layer ----------
// Estrutura do snapshot por scope:
// {
//   text:    { 'edit-id': 'novo texto', ... },     // override de innerHTML
//   hidden:  { 'edit-id': true, ... },             // visibility
//   order:   ['edit-id-1', 'edit-id-2', ...],      // ordem das seções (parcial ou completa)
//   labels:  { 'edit-id': 'novo label', ... },     // override de labels (links de nav)
// }

const EMPTY_SCOPE = () => ({ text: {}, hidden: {}, order: [], blockOrder: [], labels: {} });

function ensureShape(data) {
  data ||= {};
  for (const scope of Object.keys(SCOPES)) {
    data[scope] = { ...EMPTY_SCOPE(), ...(data[scope] || {}) };
  }
  return data;
}

let currentData = ensureShape(readLS(LS_DATA, {}));
const listeners = new Set();

export function getData() {
  return currentData;
}

export function getScope(scope) {
  return currentData[scope] || EMPTY_SCOPE();
}

export function setScope(scope, partial) {
  currentData[scope] = { ...EMPTY_SCOPE(), ...currentData[scope], ...partial };
  writeLS(LS_DATA, currentData);
  emit();
}

export function patchEdit(scope, kind, id, value) {
  const s = { ...EMPTY_SCOPE(), ...currentData[scope] };
  const bucket = { ...(s[kind] || {}) };
  if (value === undefined || value === null || value === false) {
    delete bucket[id];
  } else {
    bucket[id] = value;
  }
  s[kind] = bucket;
  currentData[scope] = s;
  writeLS(LS_DATA, currentData);
  emit();
}

export function setOrder(scope, order) {
  const s = { ...EMPTY_SCOPE(), ...currentData[scope] };
  s.order = Array.isArray(order) ? [...order] : [];
  currentData[scope] = s;
  writeLS(LS_DATA, currentData);
  emit();
}

export function setBlockOrder(scope, blockOrder) {
  const s = { ...EMPTY_SCOPE(), ...currentData[scope] };
  s.blockOrder = Array.isArray(blockOrder) ? [...blockOrder] : [];
  currentData[scope] = s;
  writeLS(LS_DATA, currentData);
  emit();
}

export function getBlockOrder(scope) {
  return currentData[scope]?.blockOrder || [];
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) {
    try { fn(currentData); } catch (e) { console.error(e); }
  }
}

// Multi-tab sync via storage event
window.addEventListener('storage', (e) => {
  if (e.key === LS_DATA) {
    currentData = ensureShape(readLS(LS_DATA, {}));
    emit();
  }
});

// ---------- Bootstrap: pega snapshot mais novo do Supabase ----------
// Cada scope tem seu próprio versionamento (uma linha por publish).
// No bootstrap, busca a versão mais nova POR scope e hidrata se for mais recente que o localStorage.

const LAST_LOAD_KEY = LS_SNAPSHOT_VERSION; // map<scope, version>

export async function bootstrap() {
  let lastLoad = readLS(LAST_LOAD_KEY, {});
  if (typeof lastLoad !== 'object' || lastLoad === null) lastLoad = {};

  try {
    const { data: rows, error } = await supabase
      .from('site_content')
      .select('scope, version, data')
      .order('version', { ascending: false });

    if (error) throw error;
    if (!Array.isArray(rows)) return;

    // Pega a versão mais nova por scope (já ordenado desc)
    const latestByScope = {};
    for (const row of rows) {
      if (!(row.scope in latestByScope)) {
        latestByScope[row.scope] = row;
      }
    }

    let changed = false;
    for (const [scope, row] of Object.entries(latestByScope)) {
      const local = lastLoad[scope] || 0;
      if (row.version > local) {
        currentData[scope] = { ...EMPTY_SCOPE(), ...(row.data || {}) };
        lastLoad[scope] = row.version;
        changed = true;
      }
    }

    if (changed) {
      currentData = ensureShape(currentData);
      writeLS(LS_DATA, currentData);
      writeLS(LAST_LOAD_KEY, lastLoad);
      emit();
    }
  } catch (e) {
    console.warn('[tulipa] bootstrap falhou (usando localStorage):', e?.message);
  }
}

// ---------- Histórico de snapshots (usado pelo dashboard de Páginas) ----------
// Retorna { data: [{scope, version, note, published_by, created_at}], error }
// Limitado aos últimos N snapshots por scope (pra alimentar skyline e timeline).
export async function listRecentSnapshots({ limit = 200 } = {}) {
  try {
    const { data, error } = await supabase
      .from('site_content')
      .select('scope, version, note, published_by, created_at')
      .order('version', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (e) {
    return { data: [], error: e };
  }
}

// histórico de UM scope (pra timeline no editor)
export async function listSnapshotsByScope(scope, { limit = 20 } = {}) {
  try {
    const { data, error } = await supabase
      .from('site_content')
      .select('scope, version, note, published_by, created_at')
      .eq('scope', scope)
      .order('version', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (e) {
    return { data: [], error: e };
  }
}

// pega dados completos de um snapshot (pra preview/diff/revert)
export async function getSnapshotData(scope, version) {
  try {
    const { data, error } = await supabase
      .from('site_content')
      .select('scope, version, data, note, published_by, created_at')
      .eq('scope', scope)
      .eq('version', version)
      .maybeSingle();
    if (error) throw error;
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e };
  }
}

// reverte um scope para os dados de uma versão antiga (insere nova versão com data antiga)
export async function revertToSnapshot(scope, version, { note } = {}) {
  try {
    const { data: snap, error: e1 } = await getSnapshotData(scope, version);
    if (e1) throw e1;
    if (!snap) throw new Error('snapshot não encontrado');

    const { data: userResp } = await supabase.auth.getUser();
    if (!userResp?.user) throw new Error('não autenticado');

    const newVersion = Date.now();
    const whenLabel = snap.created_at
      ? new Date(snap.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
      : `versão ${snap.version}`;
    const noteText = note || `reverter para versão de ${whenLabel}`;

    const { error: e2 } = await supabase
      .from('site_content')
      .insert({
        scope,
        version: newVersion,
        data: snap.data,
        note: noteText,
        published_by: userResp.user.id,
      });
    if (e2) throw e2;

    // atualiza estado local com os dados restaurados
    currentData[scope] = { ...EMPTY_SCOPE(), ...(snap.data || {}) };
    const lastLoad = readLS(LAST_LOAD_KEY, {});
    lastLoad[scope] = newVersion;
    currentData = ensureShape(currentData);
    writeLS(LS_DATA, currentData);
    writeLS(LAST_LOAD_KEY, lastLoad);
    emit();

    return { data: { version: newVersion }, error: null };
  } catch (e) {
    return { data: null, error: e };
  }
}

// diff resumido entre dois snapshots de dados (objects). Retorna lista de mudanças.
// Compara: text/hidden/labels (chaves modificadas/adicionadas/removidas) e blockOrder (mudança).
export function diffSnapshotData(oldData, newData) {
  const changes = [];
  const buckets = ['text', 'labels', 'hidden'];
  for (const b of buckets) {
    const o = oldData?.[b] || {};
    const n = newData?.[b] || {};
    const keys = new Set([...Object.keys(o), ...Object.keys(n)]);
    for (const k of keys) {
      const ov = o[k];
      const nv = n[k];
      if (JSON.stringify(ov) === JSON.stringify(nv)) continue;
      changes.push({
        bucket: b,
        key: k,
        before: ov,
        after: nv,
        kind: ov === undefined ? 'add' : nv === undefined ? 'remove' : 'change',
      });
    }
  }
  const oOrder = JSON.stringify(oldData?.blockOrder || []);
  const nOrder = JSON.stringify(newData?.blockOrder || []);
  if (oOrder !== nOrder) {
    changes.push({ bucket: 'blockOrder', key: '_order_', kind: 'change', before: oldData?.blockOrder, after: newData?.blockOrder });
  }
  return changes;
}

// ---------- Publish (usado pelo admin) ----------
export async function publish(scope, note = '') {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) throw new Error('Não autenticado');

  const version = Date.now();
  const payload = currentData[scope] || EMPTY_SCOPE();

  const { error } = await supabase
    .from('site_content')
    .insert({
      scope,
      version,
      data: payload,
      note: note || null,
      published_by: user.user.id,
    });

  if (error) throw error;

  // Atualiza lastLoad pra não rebaixar o snapshot que acabamos de subir
  const lastLoad = readLS(LAST_LOAD_KEY, {});
  lastLoad[scope] = version;
  writeLS(LAST_LOAD_KEY, lastLoad);

  return version;
}
