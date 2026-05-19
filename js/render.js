// Aplica overrides (visibility/order/text/labels) no DOM, no DOMContentLoaded e a cada bootstrap.
// Cada elemento editável é marcado com:
//   data-edit-id="hero.title"          (id único dentro do scope)
//   data-edit-scope="global"|"lp:..."  (qual scope governa esse elemento)
//   data-edit-type="text|section|link" (texto livre, seção inteira, link de nav)
//
// `data-edit-scope` é opcional — se faltar, o elemento herda do scope do <body data-scope="...">

import { getData, bootstrap, onChange } from './site-data.js';

function getDefaultScope() {
  return document.body?.dataset?.scope || 'global';
}

function* editableElements(root = document) {
  yield* root.querySelectorAll('[data-edit-id]');
}

function resolveScope(el) {
  return el.dataset.editScope || getDefaultScope();
}

// ---------- aplicar visibility ----------
function applyVisibility() {
  const data = getData();
  for (const el of editableElements()) {
    const scope = resolveScope(el);
    const id = el.dataset.editId;
    const isHidden = !!data[scope]?.hidden?.[id];
    el.toggleAttribute('hidden', isHidden);
    if (isHidden) {
      el.setAttribute('aria-hidden', 'true');
    } else {
      el.removeAttribute('aria-hidden');
    }
  }
}

// ---------- aplicar text/label overrides ----------
function applyTextOverrides() {
  const data = getData();
  for (const el of editableElements()) {
    const scope = resolveScope(el);
    const id = el.dataset.editId;
    const type = el.dataset.editType || 'text';

    const labelOverride = data[scope]?.labels?.[id];
    const textOverride = data[scope]?.text?.[id];

    // Guarda o conteúdo original na primeira aplicação pra permitir reverter sem reload
    if (!el.dataset.editOriginal && (textOverride || labelOverride)) {
      el.dataset.editOriginal = el.innerHTML;
    }

    if (type === 'link' && labelOverride !== undefined) {
      // labels mexem só no texto visível do link, preservando markup interno se houver
      el.textContent = labelOverride;
    } else if (textOverride !== undefined) {
      el.innerHTML = textOverride;
    } else if (el.dataset.editOriginal) {
      // reverter pra original se override foi removido
      el.innerHTML = el.dataset.editOriginal;
      delete el.dataset.editOriginal;
    }
  }
}

// ---------- aplicar order ----------
// Reordena os filhos diretos de um container com base num array de edit-ids.
// O container precisa ter `data-edit-container="<scope-key-da-ordem>"`.
// Ex.: <ul data-edit-container="nav.menu"> ... <li data-edit-id="nav.link.sobre">...</li> </ul>
function applyOrder() {
  const data = getData();
  for (const container of document.querySelectorAll('[data-edit-container]')) {
    const scope = resolveScope(container);
    const key = container.dataset.editContainer;
    const order = data[scope]?.order;
    // order é um array global por scope; sub-chave via prefix opcional
    if (!Array.isArray(order) || order.length === 0) continue;

    const orderForContainer = order.filter((id) =>
      Array.from(container.children).some((c) => c.dataset.editId === id)
    );
    if (orderForContainer.length === 0) continue;

    const childrenById = new Map();
    for (const c of container.children) {
      if (c.dataset?.editId) childrenById.set(c.dataset.editId, c);
    }

    // Coloca primeiro os que estão na ordem salva, depois o resto
    const ordered = [];
    for (const id of orderForContainer) {
      if (childrenById.has(id)) {
        ordered.push(childrenById.get(id));
        childrenById.delete(id);
      }
    }
    for (const c of childrenById.values()) ordered.push(c);

    const frag = document.createDocumentFragment();
    for (const c of ordered) frag.appendChild(c);
    container.appendChild(frag);
  }
}

// ---------- aplicar block order (reordena seções top-level de uma página) ----------
// data[scope].blockOrder = ['section.hero', 'section.manifesto', ...]
// Move cada seção (+ seu wave-divider data-edit-bound-to apontando pra ela)
// pra ordem desejada, mantendo elementos não-bloco no lugar.
function applyBlockOrder() {
  const data = getData();
  const scope = getDefaultScope();
  const order = data[scope]?.blockOrder;
  if (!Array.isArray(order) || order.length === 0) return;

  const body = document.body;
  if (!body) return;

  // Acha o range de elementos "reorderáveis" no body — entre o primeiro
  // section.* e a última section.* (não inclui nav, footer, loader, etc.).
  const children = Array.from(body.children);
  const sectionIndexes = [];
  children.forEach((el, idx) => {
    const id = el.dataset?.editId;
    if (id && id.startsWith('section.') && el.tagName !== 'NAV' && el.tagName !== 'FOOTER') {
      sectionIndexes.push(idx);
    }
  });
  if (sectionIndexes.length === 0) return;
  const startIdx = sectionIndexes[0];
  const endIdx = sectionIndexes[sectionIndexes.length - 1];

  // Constrói "unidades": cada seção (+ divider que aponta pra ela) é uma unidade.
  // Divider aparece ANTES da sua seção alvo.
  const range = children.slice(startIdx, endIdx + 1);
  const units = []; // { section, divider, sectionId }
  const consumed = new Set();

  for (const el of range) {
    if (consumed.has(el)) continue;
    const id = el.dataset?.editId;
    if (id && id.startsWith('section.')) {
      // procura divider imediatamente antes que aponte pra essa seção
      let divider = null;
      const prevIdx = range.indexOf(el) - 1;
      if (prevIdx >= 0) {
        const prev = range[prevIdx];
        if (prev.dataset?.editBoundTo === id && !consumed.has(prev)) {
          divider = prev;
        }
      }
      units.push({ section: el, divider, sectionId: id });
      consumed.add(el);
      if (divider) consumed.add(divider);
    }
  }

  // Reordena unidades conforme `order`. Unidades não citadas vão pro fim na ordem original.
  const byId = new Map(units.map((u) => [u.sectionId, u]));
  const ordered = [];
  for (const id of order) {
    if (byId.has(id)) {
      ordered.push(byId.get(id));
      byId.delete(id);
    }
  }
  for (const u of byId.values()) ordered.push(u);

  // Determina elementos "fixos" (não-unidades) dentro do range — preserva posição relativa
  const fixedBefore = []; // antes do primeiro bloco
  const fixedAfter  = []; // depois do último bloco
  // simples: tudo que não foi consumido (não é section nem divider associado) fica no fim da nova lista
  const stragglers = range.filter((el) => !consumed.has(el));

  // Insere na ordem: [unidades ordenadas (cada uma divider+section), stragglers]
  const insertBefore = children[endIdx + 1] || null; // âncora pra reinserir antes
  const frag = document.createDocumentFragment();
  for (const u of ordered) {
    if (u.divider) frag.appendChild(u.divider);
    frag.appendChild(u.section);
  }
  for (const s of stragglers) frag.appendChild(s);
  body.insertBefore(frag, insertBefore);
}

// ---------- bound visibility (dividers seguem a visibilidade da seção alvo) ----------
function applyBoundVisibility() {
  const data = getData();
  const scope = getDefaultScope();
  const hidden = data[scope]?.hidden || {};
  for (const el of document.querySelectorAll('[data-edit-bound-to]')) {
    const targetId = el.dataset.editBoundTo;
    const isTargetHidden = !!hidden[targetId];
    if (isTargetHidden) {
      el.setAttribute('hidden', '');
      el.dataset.boundHidden = '1';
    } else if (el.dataset.boundHidden) {
      el.removeAttribute('hidden');
      delete el.dataset.boundHidden;
    }
  }
}

// ---------- esconder referências a páginas marcadas como hidden ----------
// global.hidden['page.<slug>'] = true → esconde <a href*="<slug>.html"> nos menus
function applyPageVisibility() {
  const data = getData();
  const hidden = data.global?.hidden || {};
  // primeiro re-mostra tudo que pode ter sido escondido por esta regra
  for (const el of document.querySelectorAll('[data-page-link-hidden]')) {
    el.removeAttribute('hidden');
    delete el.dataset.pageLinkHidden;
  }
  for (const key of Object.keys(hidden)) {
    if (!key.startsWith('page.')) continue;
    if (!hidden[key]) continue;
    const slug = key.replace('page.', '');
    const links = document.querySelectorAll(
      `a[href*="atividades/${CSS.escape(slug)}.html"], a[href$="${CSS.escape(slug)}.html"]`
    );
    for (const a of links) {
      const target = a.closest('li, .dept-pill, .card') || a;
      target.setAttribute('hidden', '');
      target.dataset.pageLinkHidden = '1';
    }
  }
}

function applyAll() {
  applyVisibility();
  applyTextOverrides();
  applyOrder();
  applyBlockOrder();
  applyBoundVisibility();
  applyPageVisibility();
}

// ---------- ciclo de vida ----------
function init() {
  // 1. aplicação imediata a partir do localStorage (sem flash, já que o JS é async)
  applyAll();
  // 2. busca snapshot remoto e reaplica se mudou
  bootstrap().then(() => applyAll()).catch(() => {});
  // 3. reaplica quando dados mudarem (admin editando em outra aba, p.ex.)
  onChange(applyAll);
  // 4. listener pro admin: postMessage('tulipa:re-render') força reaplicação
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin) return;
    if (e.data?.kind === 'tulipa:re-render') applyAll();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { applyAll };
