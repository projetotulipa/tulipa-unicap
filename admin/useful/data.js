// CRUD de useful_links — biblioteca de links e textos por módulo.
// Módulos: 'midia' | 'pesquisa' | 'financeiro' | 'secretaria'.

import { supabase } from '../../js/supabase.js';

export const MODULE_META = {
  midia: {
    label: 'Artes & Mídias',
    homeHash: '#/midia',
    activeKey: 'useful',
  },
  pesquisa: {
    label: 'Pesquisa',
    homeHash: '#/pesquisa',
    activeKey: 'useful',
  },
  financeiro: {
    label: 'Tesouraria',
    homeHash: '#/financeiro',
    activeKey: 'useful',
  },
  secretaria: {
    label: 'Secretaria',
    homeHash: '#/presenca',
    activeKey: 'useful',
  },
};

export async function listUseful(module) {
  return supabase
    .from('useful_links')
    .select('*')
    .eq('module', module)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
}

export async function createUseful(fields) {
  const payload = { ...fields };
  // garante sort_order no fim da lista atual
  if (payload.sort_order == null) {
    const { data: rows } = await supabase
      .from('useful_links')
      .select('sort_order')
      .eq('module', payload.module)
      .order('sort_order', { ascending: false })
      .limit(1);
    const lastOrder = rows?.[0]?.sort_order ?? -1;
    payload.sort_order = Number(lastOrder) + 1;
  }
  return supabase.from('useful_links').insert(payload).select().single();
}

export async function updateUseful(id, fields) {
  return supabase.from('useful_links').update(fields).eq('id', id).select().single();
}

export async function deleteUseful(id) {
  return supabase.from('useful_links').delete().eq('id', id);
}

// Move um item pra cima ou pra baixo na lista (swap com vizinho).
export async function reorderUseful(module, id, direction) {
  const { data: rows, error } = await listUseful(module);
  if (error) return { error };
  const arr = rows || [];
  const idx = arr.findIndex((r) => r.id === id);
  if (idx === -1) return { error: new Error('item não encontrado') };
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= arr.length) return { error: null };
  const a = arr[idx];
  const b = arr[swapIdx];
  // troca os sort_order. Se forem iguais (ambos 0, dados antigos), reescalonamos.
  const updates = [];
  if (a.sort_order === b.sort_order) {
    arr.forEach((r, i) => updates.push({ id: r.id, sort_order: i * 10 }));
    // aplica swap após reorder linear
    const aNew = swapIdx * 10;
    const bNew = idx * 10;
    updates.find((u) => u.id === a.id).sort_order = aNew;
    updates.find((u) => u.id === b.id).sort_order = bNew;
  } else {
    updates.push({ id: a.id, sort_order: b.sort_order });
    updates.push({ id: b.id, sort_order: a.sort_order });
  }
  for (const u of updates) {
    const { error: e } = await supabase
      .from('useful_links')
      .update({ sort_order: u.sort_order })
      .eq('id', u.id);
    if (e) return { error: e };
  }
  return { error: null };
}
