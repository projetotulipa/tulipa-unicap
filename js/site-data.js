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
