// Editor visual da Home — lista de blocos com drag, hide, edit.

import { HOME_SCHEMA, blockById } from '../schemas/home.js';
import { openBlockDrawer } from './block-drawer.js';
import { loadIframe } from './editor-shared.js';
import { icon } from '../icons.js';

const SCOPE = HOME_SCHEMA.scope; // 'global'

let originalsByEditId = null; // valores originais (do HTML) pra editar
let iframeDoc = null;

export async function renderHomeEditor(ctx) {
  const { root, api } = ctx;

  root.innerHTML = `
    <div class="view view--home-editor">
      <header class="editor-head">
        <div>
          <p class="view__crumbs"><a href="#/paginas">${icon('arrow-left', { size: 14 })}<span style="margin-left:6px;">Páginas</span></a></p>
          <h1><span class="editor-head__icon">${icon(HOME_SCHEMA.iconName, { size: 30 })}</span> ${escapeHtml(HOME_SCHEMA.label)}</h1>
          <p class="view__lede">Reorganize, oculte ou edite cada seção. As alterações aparecem na hora no preview.</p>
        </div>
        <div class="editor-head__actions">
          <a class="btn btn--ghost btn--small" href="../index.html" target="_blank" rel="noopener">${icon('external', { size: 14 })}<span style="margin-left:6px;">Ver no site</span></a>
        </div>
      </header>

      <iframe id="homePreview" src="../index.html"
              style="position:fixed;top:-9999px;left:-9999px;width:1200px;height:800px;"
              aria-hidden="true"></iframe>

      <div id="blockList" class="block-list">
        <div class="empty-state">carregando blocos…</div>
      </div>

      <div class="publish-bar publish-bar--editor">
        <span id="publishStatus" class="publish-bar__status">tudo publicado</span>
        <button id="resetBtn" class="btn btn--ghost btn--small">Descartar alterações</button>
        <button id="publishBtn" class="btn btn--primary">Publicar alterações</button>
      </div>
    </div>
  `;

  const iframe = document.getElementById('homePreview');
  try {
    iframeDoc = await loadIframe(iframe);
  } catch (e) {
    document.getElementById('blockList').innerHTML =
      `<div class="empty-state">Não foi possível carregar a preview: ${escapeHtml(e.message)}</div>`;
    return;
  }

  originalsByEditId = collectOriginals(iframeDoc);

  // Aplica blockOrder atual do site-data ao iframe imediatamente (sincroniza preview com admin state)
  notifyPreview();

  draw(ctx);
  bindPublishBar(ctx);
}

function collectOriginals(doc) {
  const out = {};
  for (const el of doc.querySelectorAll('[data-edit-id]')) {
    // Se o iframe já aplicou override, render.js guarda original em dataset.editOriginal.
    out[el.dataset.editId] = el.dataset.editOriginal || el.innerHTML;
  }
  return out;
}

export function getOriginalFor(editId) {
  return originalsByEditId?.[editId] ?? '';
}

function currentBlockOrder(api) {
  const saved = api.getScope(SCOPE).blockOrder || [];
  const defaultOrder = HOME_SCHEMA.blocks.map((b) => b.sectionId);
  // mescla: saved primeiro (filtrando ids ainda existentes), depois faltantes na ordem default
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
  const { api } = ctx;
  const list = document.getElementById('blockList');
  if (!list) return;
  list.innerHTML = '';

  const order = currentBlockOrder(api);
  const blocksById = new Map(HOME_SCHEMA.blocks.map((b) => [b.sectionId, b]));

  for (const sectionId of order) {
    const block = blocksById.get(sectionId);
    if (!block) continue;
    list.appendChild(buildCard(ctx, block));
  }

  bindDragDrop(ctx, list);
  syncPublishStatus(ctx);
}

function buildCard(ctx, block) {
  const { api } = ctx;
  const data = api.getScope(SCOPE);
  const isHidden = !!data.hidden?.[block.sectionId];

  const summaryText = block.summaryFields
    .map((fid) => extractPlainText(getEffectiveValue(ctx, fid)))
    .filter(Boolean)
    .join(' · ');

  const fieldCount = block.fields.length;

  const card = document.createElement('article');
  card.className = `block-card ${isHidden ? 'block-card--hidden' : ''}`;
  card.draggable = true;
  card.dataset.sectionId = block.sectionId;
  card.dataset.blockId = block.id;

  card.innerHTML = `
    <div class="block-card__handle" title="Arraste para reordenar" aria-hidden="true">${icon('drag', { size: 18 })}</div>
    <div class="block-card__main">
      <header class="block-card__head">
        <span class="block-card__icon">${icon(block.iconName, { size: 22 })}</span>
        <h3>${escapeHtml(block.label)}</h3>
        <span class="block-card__badge ${isHidden ? 'is-hidden' : 'is-visible'}">${isHidden ? 'oculto' : 'visível'}</span>
      </header>
      <p class="block-card__desc">${escapeHtml(block.description)}</p>
      ${summaryText ? `<p class="block-card__preview">${escapeHtml(truncate(summaryText, 160))}</p>` : ''}
      <p class="block-card__meta">${fieldCount > 0 ? `${fieldCount} campo${fieldCount === 1 ? '' : 's'} editável${fieldCount === 1 ? '' : 'is'}` : 'sem campos — apenas reordenar ou ocultar'}</p>
    </div>
    <div class="block-card__actions">
      <button class="icon-btn" data-action="move-up" title="Mover para cima" aria-label="Mover para cima">${icon('arrow-up', { size: 16 })}</button>
      <button class="icon-btn" data-action="move-down" title="Mover para baixo" aria-label="Mover para baixo">${icon('arrow-down', { size: 16 })}</button>
      <button class="icon-btn ${isHidden ? 'is-active' : ''}" data-action="toggle-hide"
              title="${isHidden ? 'Mostrar no site' : 'Ocultar do site'}"
              aria-label="${isHidden ? 'Mostrar' : 'Ocultar'}">${icon(isHidden ? 'eye-off' : 'eye', { size: 16 })}</button>
      ${fieldCount > 0
        ? `<button class="btn btn--ghost btn--small" data-action="edit">${icon('edit', { size: 14 })}<span style="margin-left:6px;">Editar textos</span></button>`
        : ''
      }
    </div>
  `;

  card.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-action]');
    if (!btn) return;
    ev.preventDefault();
    handleAction(ctx, btn.dataset.action, block, card);
  });

  return card;
}

function handleAction(ctx, action, block, card) {
  const { api } = ctx;
  switch (action) {
    case 'move-up':
      moveBlock(ctx, block.sectionId, -1);
      break;
    case 'move-down':
      moveBlock(ctx, block.sectionId, +1);
      break;
    case 'toggle-hide': {
      const data = api.getScope(SCOPE);
      const currentlyHidden = !!data.hidden?.[block.sectionId];
      api.patchEdit(SCOPE, 'hidden', block.sectionId, currentlyHidden ? null : true);
      api.markDirty(SCOPE);
      notifyPreview();
      draw(ctx);
      break;
    }
    case 'edit':
      openBlockDrawer(ctx, block, { onChange: () => draw(ctx), notifyPreview });
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
  api.setBlockOrder(SCOPE, moved);
  api.markDirty(SCOPE);
  notifyPreview();
  draw(ctx);
}

function bindDragDrop(ctx, container) {
  const { api } = ctx;
  let dragged = null;

  container.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.block-card');
    if (!card) return;
    dragged = card;
    card.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', card.dataset.sectionId); } catch {}
  });

  container.addEventListener('dragover', (e) => {
    if (!dragged) return;
    e.preventDefault();
    const target = e.target.closest('.block-card');
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
    const newOrder = Array.from(container.children)
      .filter((c) => c.classList.contains('block-card'))
      .map((c) => c.dataset.sectionId);
    api.setBlockOrder(SCOPE, newOrder);
    api.markDirty(SCOPE);
    notifyPreview();
    dragged = null;
    syncPublishStatus(ctx);
  });

  container.addEventListener('drop', (e) => e.preventDefault());
}

function getEffectiveValue(ctx, editId) {
  const { api } = ctx;
  const data = api.getScope(SCOPE);
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
  const iframe = document.getElementById('homePreview');
  if (!iframe?.contentWindow) return;
  try {
    iframe.contentWindow.postMessage({ kind: 'tulipa:re-render' }, location.origin);
  } catch {}
}

function syncPublishStatus(ctx) {
  const status = document.getElementById('publishStatus');
  if (!status) return;
  if (ctx.state.dirty.has(SCOPE)) {
    status.textContent = 'Alterações pendentes — clique em "Publicar"';
    status.className = 'publish-bar__status is-dirty';
  } else {
    status.textContent = 'tudo publicado';
    status.className = 'publish-bar__status';
  }
}

function bindPublishBar(ctx) {
  const btn = document.getElementById('publishBtn');
  const resetBtn = document.getElementById('resetBtn');
  const status = document.getElementById('publishStatus');

  btn?.addEventListener('click', async () => {
    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = 'Publicando…';
    try {
      await ctx.api.publish(SCOPE, 'edição da Home');
      ctx.api.clearDirty(SCOPE);
      status.textContent = 'Publicado com sucesso';
      status.className = 'publish-bar__status is-success';
      setTimeout(() => syncPublishStatus(ctx), 2500);
    } catch (e) {
      status.textContent = `Erro: ${e.message}`;
      status.className = 'publish-bar__status is-error';
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
