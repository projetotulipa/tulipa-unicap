// Editor visual de página — Sprint 2 ("Folha Viva": hero signet + block-list editorial + toolbar).
// Carrega a página num iframe escondido, obtém o schema (explícito ou auto)
// e renderiza a lista de blocos editáveis como cartas refinadas.

import { openBlockDrawer } from './block-drawer.js';
import { loadIframe } from './editor-shared.js';
import { icon } from '../icons.js';
import { PAGES, slugToScope } from '../pages-meta.js';
import { getSchema } from '../schemas/index.js';
import { stampSeal, stampPage } from '../pages/signet.js';

let currentScope = null;
let currentSchema = null;
let originalsByEditId = null;
let activeBlockId = null;

const viewState = {
  filter: 'all', // all | visible | hidden
};

export async function renderPageEditor(ctx, slug) {
  const { root } = ctx;
  const scope = slug === 'home' ? 'global' : slugToScope(slug);
  const page = PAGES.find((p) => p.scope === scope);

  if (!page) {
    root.innerHTML = `
      <div class="view">
        <p class="view__crumbs"><a href="#/paginas">${icon('arrow-left', { size: 14 })}<span style="margin-left:6px;">Páginas</span></a></p>
        <div class="pages-empty-v2">
          <div class="pages-empty-v2__art">${stampSeal({ size: 52 })}</div>
          <h3>Página não encontrada</h3>
          <p>"${escapeHtml(slug)}" não está catalogada nas folhas conhecidas.</p>
        </div>
      </div>
    `;
    return;
  }

  if (!ctx.api.canEditScope(scope)) {
    root.innerHTML = `
      <div class="view">
        <p class="view__crumbs"><a href="#/paginas">${icon('arrow-left', { size: 14 })}<span style="margin-left:6px;">Páginas</span></a></p>
        <div class="pages-empty-v2">
          <div class="pages-empty-v2__art">${icon('eye-off', { size: 52 })}</div>
          <h3>Sem permissão</h3>
          <p>Você não tem permissão para editar "${escapeHtml(page.label)}".</p>
        </div>
      </div>
    `;
    return;
  }

  currentScope = scope;
  activeBlockId = null;
  const isHome = page.isHome;
  const pathLabel = page.path.replace('../', '/');

  root.innerHTML = `
    <div class="view view--page-editor">
      <header class="pages-editor-hero">
        <div class="pages-editor-hero__seal-wrap">
          <span class="pages-signet">${stampSeal({ size: 30 })}</span>
        </div>
        <div class="pages-editor-hero__inner">
          <p class="pages-editor-hero__crumbs">
            <a href="#/paginas">${icon('arrow-left', { size: 12 })}<span style="margin-left:6px;">Páginas</span></a>
          </p>
          <p class="pages-editor-hero__eyebrow">${escapeHtml(pathLabel)}</p>
          <h1>${escapeHtml(page.label)}</h1>
          <p class="pages-editor-hero__lede">
            Reorganize, oculte ou edite cada bloco. As alterações aparecem no <strong>preview do site</strong> imediatamente.
          </p>
        </div>
        <div class="pages-editor-hero__actions">
          <a class="btn btn--ghost btn--small" href="${escapeAttr(page.path)}" target="_blank" rel="noopener">
            ${icon('external', { size: 14 })}<span style="margin-left:6px;">Ver no site</span>
          </a>
        </div>
        <div class="pages-editor-hero__page">${stampPage({ size: 180 })}</div>
      </header>

      <iframe id="pagePreview" src="${escapeAttr(page.path)}"
              style="position:fixed;top:-9999px;left:-9999px;width:1200px;height:800px;border:0;"
              aria-hidden="true"></iframe>

      <div id="editorStats" class="pages-editor-stats" hidden></div>
      <div id="editorToolbar"></div>

      <div id="blockList" class="pages-block-list">
        <div class="pages-loading-wrap">
          <span class="pages-bloom"><span class="pages-signet">${stampSeal({ size: 24 })}</span></span>
          <p>Abrindo a folha…</p>
        </div>
      </div>

      <div class="pages-publish-bar" id="publishBar">
        <span class="pages-publish-bar__seal" id="publishSeal">${icon('check-circle', { size: 14 })}</span>
        <span id="publishStatus" class="pages-publish-bar__status">tudo publicado</span>
        <button id="resetBtn" class="btn btn--ghost btn--small">Descartar</button>
        <button id="publishBtn" class="btn btn--primary">Publicar alterações</button>
      </div>
    </div>
  `;

  const iframe = document.getElementById('pagePreview');
  let iframeDoc;
  try {
    iframeDoc = await loadIframe(iframe);
  } catch (e) {
    document.getElementById('blockList').innerHTML =
      `<div class="pages-empty-v2"><div class="pages-empty-v2__art">${icon('alert', { size: 52 })}</div><h3>Preview não carregou</h3><p>${escapeHtml(e.message)}</p></div>`;
    return;
  }

  currentSchema = getSchema(scope, iframeDoc);
  originalsByEditId = collectOriginals(iframeDoc);

  notifyPreview();
  renderStats(ctx);
  renderToolbar(ctx);
  draw(ctx);
  bindPublishBar(ctx);
}

function collectOriginals(doc) {
  const out = {};
  for (const el of doc.querySelectorAll('[data-edit-id]')) {
    out[el.dataset.editId] = el.dataset.editOriginal || el.innerHTML;
  }
  return out;
}

export function getOriginalFor(editId) {
  return originalsByEditId?.[editId] ?? '';
}

function renderStats(ctx) {
  const slot = document.getElementById('editorStats');
  if (!slot || !currentSchema?.blocks?.length) return;
  const data = ctx.api.getScope(currentScope);
  const total = currentSchema.blocks.length;
  let visible = 0, hidden = 0, fieldCount = 0;
  for (const b of currentSchema.blocks) {
    if (data.hidden?.[b.sectionId]) hidden++;
    else visible++;
    fieldCount += (b.fields?.length || 0);
  }
  slot.hidden = false;
  slot.innerHTML = `
    <div class="pages-editor-stats__cell">
      <strong>${total}</strong>
      <span>${total === 1 ? 'bloco' : 'blocos'}</span>
    </div>
    <div class="pages-editor-stats__cell">
      <strong>${visible}</strong>
      <span>${visible === 1 ? 'visível' : 'visíveis'}</span>
    </div>
    <div class="pages-editor-stats__cell pages-editor-stats__cell--rose">
      <strong>${hidden}</strong>
      <span>${hidden === 1 ? 'oculto' : 'ocultos'}</span>
    </div>
    <div class="pages-editor-stats__cell pages-editor-stats__cell--gold">
      <strong>${fieldCount}</strong>
      <span>campos editáveis</span>
    </div>
  `;
}

function renderToolbar(ctx) {
  const slot = document.getElementById('editorToolbar');
  if (!slot || !currentSchema?.blocks?.length) return;
  const data = ctx.api.getScope(currentScope);
  let visible = 0, hidden = 0;
  for (const b of currentSchema.blocks) {
    if (data.hidden?.[b.sectionId]) hidden++;
    else visible++;
  }
  const total = currentSchema.blocks.length;

  slot.innerHTML = `
    <div class="pages-editor-toolbar">
      <div class="pages-editor-toolbar__group">
        <span class="pages-editor-toolbar__label">mostrar</span>
        ${chip('all', 'todos', total)}
        ${chip('visible', 'visíveis', visible)}
        ${chip('hidden', 'ocultos', hidden)}
      </div>
    </div>
  `;
  slot.querySelectorAll('[data-chip]').forEach((el) => {
    el.addEventListener('click', () => {
      viewState.filter = el.dataset.chip;
      renderToolbar(ctx);
      draw(ctx);
    });
  });
}

function chip(key, label, count) {
  const active = viewState.filter === key ? ' is-active' : '';
  return `<button class="pages-editor-toolbar__chip${active}" data-chip="${key}">
    <span>${escapeHtml(label)}</span>
    <span class="pages-editor-toolbar__count">${count}</span>
  </button>`;
}

function currentBlockOrder(api) {
  const saved = api.getScope(currentScope).blockOrder || [];
  const defaultOrder = currentSchema.blocks.map((b) => b.sectionId);
  const merged = [];
  for (const id of saved) {
    if (defaultOrder.includes(id) && !merged.includes(id)) merged.push(id);
  }
  for (const id of defaultOrder) {
    if (!merged.includes(id)) merged.push(id);
  }
  return merged;
}

function draw(ctx) {
  const list = document.getElementById('blockList');
  if (!list) return;
  list.innerHTML = '';

  if (!currentSchema.blocks.length) {
    list.innerHTML = `
      <div class="pages-empty-v2">
        <div class="pages-empty-v2__art">${stampSeal({ size: 52 })}</div>
        <h3>Sem blocos editáveis</h3>
        <p>Esta página ainda não tem elementos marcados como editáveis. Peça pro time técnico marcar os blocos com <code>data-edit-id</code>.</p>
      </div>
    `;
    return;
  }

  const order = currentBlockOrder(ctx.api);
  const blocksById = new Map(currentSchema.blocks.map((b) => [b.sectionId, b]));
  const data = ctx.api.getScope(currentScope);

  let shown = 0;
  for (const sectionId of order) {
    const block = blocksById.get(sectionId);
    if (!block) continue;
    const isHidden = !!data.hidden?.[block.sectionId];
    if (viewState.filter === 'visible' && isHidden) continue;
    if (viewState.filter === 'hidden' && !isHidden) continue;
    list.appendChild(buildCard(ctx, block, isHidden));
    shown++;
  }

  if (shown === 0) {
    list.innerHTML = `<div class="pages-no-results">
      <span>Nada por aqui</span>
      <p>nenhum bloco corresponde ao filtro atual.</p>
    </div>`;
    return;
  }

  bindDragDrop(ctx, list);
  syncPublishStatus(ctx);
}

function buildCard(ctx, block, isHidden) {
  const summaryText = (block.summaryFields || [])
    .map((fid) => extractPlainText(getEffectiveValue(ctx, fid)))
    .filter(Boolean)
    .join(' · ');

  const fieldCount = block.fields.length;
  const isActive = activeBlockId === block.sectionId;

  const card = document.createElement('article');
  card.className = `pages-block-letter ${isHidden ? 'is-hidden' : ''} ${isActive ? 'is-active' : ''}`;
  card.draggable = true;
  card.dataset.sectionId = block.sectionId;
  card.dataset.blockId = block.id;

  card.innerHTML = `
    <div class="pages-block-letter__handle" title="Arraste para reordenar" aria-hidden="true">${icon('drag', { size: 18 })}</div>
    <div class="pages-block-letter__icon">${icon(block.iconName || 'page', { size: 20 })}</div>
    <div class="pages-block-letter__main">
      <div class="pages-block-letter__title">
        <h3>${escapeHtml(block.label)}</h3>
        <span class="${isHidden ? 'pages-pill-v2 pages-pill-v2--rose' : 'pages-pill-v2 pages-pill-v2--sage'}">
          ${icon(isHidden ? 'eye-off' : 'eye', { size: 10 })}<span style="margin-left:4px;">${isHidden ? 'oculto' : 'visível'}</span>
        </span>
      </div>
      ${block.description ? `<p class="pages-block-letter__desc">${escapeHtml(block.description)}</p>` : ''}
      ${summaryText
        ? `<p class="pages-block-letter__preview">${escapeHtml(truncate(summaryText, 160))}</p>`
        : `<p class="pages-block-letter__preview pages-block-letter__preview--empty">sem preview de texto</p>`}
      <p class="pages-block-letter__meta">${fieldCount > 0 ? `${fieldCount} campo${fieldCount === 1 ? '' : 's'} editável${fieldCount === 1 ? '' : 'is'}` : 'sem campos — apenas reordenar ou ocultar'}</p>
    </div>
    <div class="pages-block-letter__actions">
      <button class="icon-btn" data-action="move-up" title="Mover para cima" aria-label="Mover para cima">${icon('arrow-up', { size: 14 })}</button>
      <button class="icon-btn" data-action="move-down" title="Mover para baixo" aria-label="Mover para baixo">${icon('arrow-down', { size: 14 })}</button>
      <button class="icon-btn ${isHidden ? 'is-active' : ''}" data-action="toggle-hide"
              title="${isHidden ? 'Mostrar no site' : 'Ocultar do site'}"
              aria-label="${isHidden ? 'Mostrar' : 'Ocultar'}">${icon(isHidden ? 'eye-off' : 'eye', { size: 14 })}</button>
      ${fieldCount > 0
        ? `<button class="btn btn--ghost btn--small" data-action="edit" aria-label="Editar textos do bloco">${icon('edit', { size: 12 })}<span style="margin-left:6px;">Editar</span></button>`
        : ''
      }
    </div>
  `;

  card.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-action]');
    if (!btn) return;
    ev.preventDefault();
    handleAction(ctx, btn.dataset.action, block);
  });

  return card;
}

function handleAction(ctx, action, block) {
  const { api } = ctx;
  switch (action) {
    case 'move-up':
      moveBlock(ctx, block.sectionId, -1);
      break;
    case 'move-down':
      moveBlock(ctx, block.sectionId, +1);
      break;
    case 'toggle-hide': {
      const data = api.getScope(currentScope);
      const currentlyHidden = !!data.hidden?.[block.sectionId];
      api.patchEdit(currentScope, 'hidden', block.sectionId, currentlyHidden ? null : true);
      api.markDirty(currentScope);
      notifyPreview();
      renderStats(ctx);
      renderToolbar(ctx);
      draw(ctx);
      break;
    }
    case 'edit':
      activeBlockId = block.sectionId;
      draw(ctx);
      openBlockDrawer(ctx, block, {
        scope: currentScope,
        onChange: () => draw(ctx),
        notifyPreview,
        onClose: () => {
          activeBlockId = null;
          draw(ctx);
        },
      });
      break;
  }
}

function moveBlock(ctx, sectionId, delta) {
  const { api } = ctx;
  const order = currentBlockOrder(api);
  const idx = order.indexOf(sectionId);
  if (idx === -1) return;
  const newIdx = idx + delta;
  if (newIdx < 0 || newIdx >= order.length) return;
  const moved = [...order];
  [moved[idx], moved[newIdx]] = [moved[newIdx], moved[idx]];
  api.setBlockOrder(currentScope, moved);
  api.markDirty(currentScope);
  notifyPreview();
  draw(ctx);
}

function bindDragDrop(ctx, container) {
  const { api } = ctx;
  let dragged = null;

  container.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.pages-block-letter');
    if (!card) return;
    dragged = card;
    card.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', card.dataset.sectionId); } catch {}
  });

  container.addEventListener('dragover', (e) => {
    if (!dragged) return;
    e.preventDefault();
    const target = e.target.closest('.pages-block-letter');
    if (!target || target === dragged) return;
    const rect = target.getBoundingClientRect();
    const before = (e.clientY - rect.top) < rect.height / 2;
    container.querySelectorAll('.is-drop-target').forEach((el) => el.classList.remove('is-drop-target'));
    target.classList.add('is-drop-target');
    container.insertBefore(dragged, before ? target : target.nextSibling);
  });

  container.addEventListener('dragend', () => {
    container.querySelectorAll('.is-drop-target').forEach((el) => el.classList.remove('is-drop-target'));
    if (!dragged) return;
    dragged.classList.remove('is-dragging');
    dragged.classList.add('is-dropped');
    setTimeout(() => dragged && dragged.classList.remove('is-dropped'), 600);
    const newOrder = Array.from(container.children)
      .filter((c) => c.classList.contains('pages-block-letter'))
      .map((c) => c.dataset.sectionId);
    api.setBlockOrder(currentScope, newOrder);
    api.markDirty(currentScope);
    notifyPreview();
    dragged = null;
    syncPublishStatus(ctx);
  });

  container.addEventListener('drop', (e) => e.preventDefault());
}

function getEffectiveValue(ctx, editId) {
  const { api } = ctx;
  const data = api.getScope(currentScope);
  if (data.text?.[editId] !== undefined) return data.text[editId];
  if (data.labels?.[editId] !== undefined) return data.labels[editId];
  return getOriginalFor(editId);
}

function extractPlainText(html) {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = String(html);
  return tmp.textContent.replace(/\s+/g, ' ').trim();
}

function truncate(s, n) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}

function notifyPreview() {
  const iframe = document.getElementById('pagePreview');
  if (!iframe?.contentWindow) return;
  try {
    iframe.contentWindow.postMessage({ kind: 'tulipa:re-render' }, location.origin);
  } catch {}
}

function syncPublishStatus(ctx) {
  const bar = document.getElementById('publishBar');
  const status = document.getElementById('publishStatus');
  if (!status || !bar) return;
  if (ctx.state.dirty.has(currentScope)) {
    status.textContent = 'Alterações pendentes — clique em "Publicar"';
    status.className = 'pages-publish-bar__status is-dirty';
    bar.classList.add('is-dirty');
    bar.classList.remove('is-success');
  } else {
    status.textContent = 'tudo publicado';
    status.className = 'pages-publish-bar__status';
    bar.classList.remove('is-dirty', 'is-success');
  }
}

function bindPublishBar(ctx) {
  const bar = document.getElementById('publishBar');
  const btn = document.getElementById('publishBtn');
  const resetBtn = document.getElementById('resetBtn');
  const status = document.getElementById('publishStatus');

  btn?.addEventListener('click', async () => {
    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = 'Publicando…';
    try {
      await ctx.api.publish(currentScope, `edição: ${currentScope}`);
      ctx.api.clearDirty(currentScope);
      status.textContent = 'Publicado com sucesso · folha selada';
      status.className = 'pages-publish-bar__status is-success';
      bar.classList.remove('is-dirty');
      bar.classList.add('is-success');
      setTimeout(() => syncPublishStatus(ctx), 2500);
    } catch (e) {
      status.textContent = `Erro: ${e.message}`;
      status.className = 'pages-publish-bar__status is-error';
      bar.classList.remove('is-dirty', 'is-success');
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  });

  resetBtn?.addEventListener('click', () => {
    if (!confirm('Descartar todas as alterações não publicadas e recarregar a versão publicada?')) return;
    location.reload();
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function escapeAttr(s) {
  return escapeHtml(s);
}
