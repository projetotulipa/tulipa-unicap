// Posts recebidos da Pesquisa — diretor cria tarefas a partir deles.

import { icon } from '../icons.js';
import * as data from '../media/data.js';
import * as researchData from '../research/data.js';
import { renderMediaNav } from './media-nav.js';
import { toastSuccess, toastError } from '../toast.js';

// pétala watermark dos cards
const POST_WATERMARK = `
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M50 18 C 32 28, 26 50, 32 66 C 38 80, 50 82, 50 82 C 50 82, 62 80, 68 66 C 74 50, 68 28, 50 18 Z" fill="currentColor"/>
    <path d="M50 78 L50 96" stroke="currentColor" stroke-width="1.5" fill="none"/>
  </svg>
`;

// estado da view (persiste durante a sessão da página)
const viewState = {
  status: 'all',     // 'all' | 'sent_to_media' | 'scheduled' | 'published'
  sort: 'recent',    // 'recent' | 'oldest' | 'title' | 'origin'
  layout: 'grid',    // 'grid' | 'list'
};

let cachedPosts = [];

export async function renderMediaPosts(ctx) {
  const { root } = ctx;

  root.innerHTML = `
    <div class="view">
      ${renderMediaNav('posts')}

      <header class="view__header">
        <div class="media-section-petal">${POST_WATERMARK}</div>
        <div>
          <h1>Posts recebidos</h1>
          <p class="view__lede">Conteúdo escrito pela Pesquisa, pronto pra virar arte. Arraste pra uma zona de status pra criar tarefa direto.</p>
        </div>
      </header>

      <div id="postsToolbar"></div>

      <div id="postsList" class="empty-state"><div class="skel skel--block"></div></div>
    </div>
  `;

  await loadPosts();
}

async function loadPosts() {
  const { data: posts, error } = await data.listIncomingPosts();
  if (error) {
    document.getElementById('postsList').innerHTML = `<p class="muted">${error.message}</p>`;
    return;
  }
  cachedPosts = posts || [];

  if (!cachedPosts.length) {
    document.getElementById('postsToolbar').innerHTML = '';
    document.getElementById('postsList').innerHTML = `
      <div class="media-empty">
        <div class="media-empty__art">${icon('spark', { size: 48 })}</div>
        <h3>Nenhum post aguardando</h3>
        <p>Quando a Pesquisa enviar um post, ele aparece aqui pra virar arte.</p>
      </div>
    `;
    return;
  }

  renderToolbar();
  renderList();
}

function renderToolbar() {
  const counts = countByStatus(cachedPosts);
  const chips = [
    { key: 'all',           label: 'todos',       count: cachedPosts.length },
    { key: 'sent_to_media', label: 'aguardando',  count: counts.sent_to_media || 0 },
    { key: 'scheduled',     label: 'agendado',    count: counts.scheduled || 0 },
    { key: 'published',     label: 'publicado',   count: counts.published || 0 },
  ];

  document.getElementById('postsToolbar').innerHTML = `
    <div class="media-toolbar">
      <div class="media-toolbar__group" role="tablist" aria-label="Filtrar por status">
        ${chips.map((c) => `
          <button class="media-chip ${viewState.status === c.key ? 'is-active' : ''}"
                  data-chip="${c.key}"
                  ${c.count === 0 && c.key !== 'all' ? 'disabled' : ''}>
            <span>${escapeHtml(c.label)}</span>
            <span class="media-chip__count">${c.count}</span>
          </button>
        `).join('')}
      </div>

      <span class="media-toolbar__sep"></span>

      <div class="media-toolbar__group">
        <span class="media-toolbar__label">ordenar</span>
        <select id="postsSort">
          <option value="recent" ${viewState.sort === 'recent' ? 'selected' : ''}>mais recente</option>
          <option value="oldest" ${viewState.sort === 'oldest' ? 'selected' : ''}>mais antigo</option>
          <option value="title"  ${viewState.sort === 'title'  ? 'selected' : ''}>título (a-z)</option>
          <option value="origin" ${viewState.sort === 'origin' ? 'selected' : ''}>fichamento</option>
        </select>
      </div>

      <span class="media-toolbar__spacer"></span>

      <div class="media-view-toggle" role="tablist" aria-label="Visualização">
        <button data-layout="grid" class="${viewState.layout === 'grid' ? 'is-active' : ''}" title="Grade">
          ${icon('departamentos', { size: 14 })}<span>grade</span>
        </button>
        <button data-layout="list" class="${viewState.layout === 'list' ? 'is-active' : ''}" title="Lista">
          ${icon('marquee', { size: 14 })}<span>lista</span>
        </button>
      </div>
    </div>
  `;

  // bind events
  const toolbar = document.getElementById('postsToolbar');
  toolbar.querySelectorAll('[data-chip]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.hasAttribute('disabled')) return;
      viewState.status = btn.dataset.chip;
      renderToolbar();
      renderList();
    });
  });
  toolbar.querySelector('#postsSort').addEventListener('change', (e) => {
    viewState.sort = e.target.value;
    renderList();
  });
  toolbar.querySelectorAll('[data-layout]').forEach((btn) => {
    btn.addEventListener('click', () => {
      viewState.layout = btn.dataset.layout;
      renderToolbar();
      renderList();
    });
  });
}

function renderList() {
  const box = document.getElementById('postsList');
  const filtered = applyFilters(cachedPosts);

  box.className = '';

  if (!filtered.length) {
    box.innerHTML = `
      <div class="media-no-results">
        <span>Nada por aqui ainda</span>
        Nenhum post bate com esse filtro. Tenta outro estado ou ordenação.
      </div>
    `;
    return;
  }

  if (viewState.layout === 'list') {
    box.innerHTML = `<div class="media-post-list">${filtered.map(postListRow).join('')}</div>`;
  } else {
    box.innerHTML = `<div class="res-post-grid">${filtered.map(postCard).join('')}</div>`;
  }

  box.querySelectorAll('[data-post-id]').forEach((el) => {
    const id = el.dataset.postId;
    el.querySelectorAll('[data-action="open"]').forEach((btn) => {
      btn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        const { data: full } = await researchData.getPost(id);
        if (full) openPostDetail(full);
      });
    });
    if (viewState.layout === 'list') {
      el.addEventListener('click', async () => {
        const { data: full } = await researchData.getPost(id);
        if (full) openPostDetail(full);
      });
    }
  });

  bindPostDragToTask();
}

// ---------- arrastar post pra criar tarefa ----------
function bindPostDragToTask() {
  let draggedPostId = null;

  // garante que o overlay existe no DOM (uma vez só)
  let overlay = document.getElementById('postDropOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'postDropOverlay';
    overlay.className = 'media-drop-overlay';
    overlay.innerHTML = `
      <div class="media-drop-overlay__hint">
        <span>criar tarefa</span>
        soltar em um status
      </div>
      ${dropZone('todo',        'A fazer',     'check-circle')}
      ${dropZone('in_progress', 'Em produção', 'clock')}
      ${dropZone('done',        'Concluído',   'check')}
    `;
    document.body.appendChild(overlay);
  }

  function showOverlay() { overlay.classList.add('is-visible'); }
  function hideOverlay() {
    overlay.classList.remove('is-visible');
    overlay.querySelectorAll('.media-drop-zone').forEach((z) => z.classList.remove('is-hover'));
  }

  // listeners das zonas
  overlay.querySelectorAll('.media-drop-zone').forEach((zone) => {
    zone.addEventListener('dragover', (ev) => {
      if (!draggedPostId) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'copy';
      zone.classList.add('is-hover');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('is-hover'));
    zone.addEventListener('drop', async (ev) => {
      ev.preventDefault();
      const postId = draggedPostId || ev.dataTransfer.getData('text/plain');
      hideOverlay();
      if (!postId) return;
      const { data: full } = await researchData.getPost(postId);
      if (!full) { toastError('Não consegui carregar o post.'); return; }
      const targetStatus = zone.dataset.zone;
      const { openTaskForm } = await import('./media-tasks.js');
      openTaskForm(null, {
        prefilledPost: full,
        prefilledStatus: targetStatus,
        onSaved: () => loadPosts(),
      });
    });
  });

  // listeners de cada card de post
  document.querySelectorAll('.media-post-card[data-post-id], .media-post-list-row[data-post-id]').forEach((el) => {
    el.setAttribute('draggable', 'true');
    el.addEventListener('dragstart', (ev) => {
      draggedPostId = el.dataset.postId;
      el.classList.add('is-dragging');
      try { ev.dataTransfer.setData('text/plain', draggedPostId); } catch {}
      ev.dataTransfer.effectAllowed = 'copy';
      showOverlay();
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('is-dragging');
      draggedPostId = null;
      hideOverlay();
    });
  });
}

function dropZone(status, label, iconName) {
  return `
    <div class="media-drop-zone media-drop-zone--${status}" data-zone="${status}">
      <span class="media-drop-zone__icon">${iconForZone(iconName)}</span>
      <span>${escapeHtml(label)}</span>
    </div>
  `;
}

function iconForZone(name) {
  // ícones locais pra não acoplar com import dinâmico
  const map = {
    'check-circle': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="8 12 11 15 16 9"/></svg>',
    'clock':        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>',
    'check':        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  };
  return map[name] || '';
}

function applyFilters(list) {
  let out = list;
  if (viewState.status !== 'all') {
    out = out.filter((p) => p.status === viewState.status);
  }
  switch (viewState.sort) {
    case 'oldest':
      out = [...out].sort((a, b) => cmpDate(a.created_at, b.created_at));
      break;
    case 'title':
      out = [...out].sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR'));
      break;
    case 'origin':
      out = [...out].sort((a, b) => {
        const oa = a.research_note?.title || '~';
        const ob = b.research_note?.title || '~';
        return oa.localeCompare(ob, 'pt-BR');
      });
      break;
    case 'recent':
    default:
      out = [...out].sort((a, b) => cmpDate(b.created_at, a.created_at));
      break;
  }
  return out;
}

function cmpDate(a, b) {
  return new Date(a || 0).getTime() - new Date(b || 0).getTime();
}

function countByStatus(posts) {
  const out = {};
  for (const p of posts) out[p.status] = (out[p.status] || 0) + 1;
  return out;
}

function postCard(p) {
  const isScheduled = p.status === 'scheduled';
  const isPublished = p.status === 'published';
  const pillClass   = isPublished ? 'media-pill--done'
                    : isScheduled ? 'media-pill--scheduled'
                    : 'media-pill--progress';
  const statusLabel = isPublished ? 'publicado'
                    : isScheduled ? 'agendado'
                    : 'aguardando';
  const preview     = (p.body || '').replace(/\s+/g, ' ').slice(0, 220);
  const isNew       = isPostNew(p);
  const eyebrowText = p.research_note ? `de "${p.research_note.title}"` : 'recebido';
  return `
    <article class="media-post-card" data-post-id="${escapeAttr(p.id)}">
      <div class="media-post-card__watermark">${POST_WATERMARK}</div>
      <p class="media-post-card__eyebrow">
        ${icon('page', { size: 13 })}
        <span>${escapeHtml(eyebrowText)}</span>
      </p>
      <div class="media-post-card__head">
        <h3>${escapeHtml(p.title)}</h3>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px; flex-shrink:0;">
          ${isNew ? `<span class="media-badge-new">novo</span>` : ''}
          <span class="media-pill ${pillClass}">${escapeHtml(statusLabel)}</span>
        </div>
      </div>
      ${preview ? `<p class="media-post-card__preview">${escapeHtml(preview)}${p.body.length > 220 ? '…' : ''}</p>` : ''}
      <footer class="media-post-card__foot">
        <button class="btn btn--ghost btn--small" data-action="open">${icon('edit', { size: 12 })}<span style="margin-left:6px;">Detalhe</span></button>
        <button class="btn btn--primary btn--small" data-action="open">${icon('plus', { size: 12 })}<span style="margin-left:6px;">Criar tarefa</span></button>
      </footer>
    </article>
  `;
}

function postListRow(p) {
  const isScheduled = p.status === 'scheduled';
  const isPublished = p.status === 'published';
  const bulletClass = isScheduled ? 'media-post-list-row__bullet--scheduled' :
                      isPublished ? 'media-post-list-row__bullet--scheduled' : '';
  const statusLabel = isPublished ? 'publicado' : isScheduled ? 'agendado' : 'aguardando';
  const isNew = isPostNew(p);
  const dateStr = p.created_at ? formatShortDate(p.created_at) : '—';
  return `
    <div class="media-post-list-row" data-post-id="${escapeAttr(p.id)}" role="button" tabindex="0">
      <span class="media-post-list-row__bullet ${bulletClass}" aria-hidden="true"></span>
      <div class="media-post-list-row__title">
        <strong>${escapeHtml(p.title)}</strong>
        <span>${escapeHtml(statusLabel)}${isNew ? ' · novo' : ''}</span>
      </div>
      <div class="media-post-list-row__origin">${p.research_note ? escapeHtml(p.research_note.title) : '—'}</div>
      <div class="media-post-list-row__date">${escapeHtml(dateStr)}</div>
      <div style="display:flex; gap:6px; justify-self:end;">
        <button class="btn btn--ghost btn--small" data-action="open">${icon('edit', { size: 12 })}</button>
      </div>
    </div>
  `;
}

function isPostNew(p) {
  if (!p.created_at) return false;
  const created = new Date(p.created_at).getTime();
  const now = Date.now();
  const hours = (now - created) / 3600000;
  return hours <= 24 && p.status === 'sent_to_media';
}

function formatShortDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('pt-BR', sameYear
    ? { day: '2-digit', month: 'short' }
    : { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function openPostDetail(post) {
  document.querySelectorAll('.block-drawer-overlay').forEach((el) => el.remove());

  const overlay = document.createElement('div');
  overlay.className = 'block-drawer-overlay';
  overlay.innerHTML = `
    <div class="block-drawer block-drawer--wide">
      <header class="block-drawer__head">
        <div>
          <p class="block-drawer__crumb">Post recebido</p>
          <h2><span class="block-drawer__icon">${icon('spark', { size: 26 })}</span> ${escapeHtml(post.title)}</h2>
          ${post.research_note ? `<p class="block-drawer__desc">Baseado em: ${escapeHtml(post.research_note.title)}</p>` : ''}
        </div>
        <button class="icon-btn" data-action="close">${icon('x', { size: 16 })}</button>
      </header>
      <div class="block-drawer__body">
        <h3 style="font-family:'Cormorant Garamond',serif; font-style:italic; font-size:18px; color:var(--cream); margin:0 0 8px;">Texto do post</h3>
        <div class="res-text-block">${escapeHtml(post.body || '').replace(/\n/g, '<br/>')}</div>

        ${post.research_note ? `
          <details style="margin-top:18px;">
            <summary class="muted" style="cursor:pointer; font-size:13px;">ver fichamento original</summary>
            <h4 style="margin: 12px 0 6px; color: var(--cream);">${escapeHtml(post.research_note.title)}</h4>
            <div class="res-text-block">${escapeHtml(post.research_note.body || '').replace(/\n/g, '<br/>')}</div>
          </details>
        ` : ''}

        <hr style="margin:24px 0; border:none; border-top:1px solid var(--border);">
        <h3 style="font-family:'Cormorant Garamond',serif; font-style:italic; font-size:18px; color:var(--cream); margin:0 0 8px;">Status do post</h3>
        <label class="drawer-field">
          <select id="postStatusSel" class="drawer-field__input">
            <option value="sent_to_media" ${post.status === 'sent_to_media' ? 'selected' : ''}>Aguardando produção</option>
            <option value="scheduled"     ${post.status === 'scheduled'     ? 'selected' : ''}>Agendado</option>
            <option value="published"     ${post.status === 'published'     ? 'selected' : ''}>Publicado</option>
          </select>
        </label>
      </div>
      <footer class="block-drawer__foot">
        <span class="spacer"></span>
        <button class="btn btn--ghost" data-action="close">Fechar</button>
        <button class="btn btn--primary" data-action="new-task">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Criar tarefa</span></button>
      </footer>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('is-open'));

  function close() {
    overlay.classList.remove('is-open');
    setTimeout(() => overlay.remove(), 220);
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);

  overlay.querySelector('#postStatusSel').addEventListener('change', async (ev) => {
    const { error } = await researchData.updatePost(post.id, { status: ev.target.value });
    if (error) { toastError(error.message); return; }
    toastSuccess('Status atualizado.');
  });

  overlay.addEventListener('click', async (ev) => {
    if (ev.target === overlay) return close();
    const action = ev.target.closest('[data-action]')?.dataset?.action;
    if (action === 'close') return close();
    if (action === 'new-task') {
      close();
      const { openTaskForm } = await import('./media-tasks.js');
      openTaskForm(null, { prefilledPost: post, onSaved: () => loadPosts() });
    }
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
