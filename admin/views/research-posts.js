// Posts de Instagram — escritos pela Pesquisa, enviados à Mídia.

import { icon } from '../icons.js';
import * as data from '../research/data.js';
import { renderResearchNav } from './research-nav.js';
import { toastSuccess, toastError } from '../toast.js';
import { attachMarkdownEditor } from '../markdown-editor.js';

const PAGE_WATERMARK = `
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M22 14 L62 14 L78 30 L78 86 L22 86 Z" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M62 14 L62 30 L78 30" fill="none" stroke="currentColor" stroke-width="2"/>
    <line x1="30" y1="42" x2="70" y2="42" stroke="currentColor" stroke-width="1.5"/>
    <line x1="30" y1="52" x2="68" y2="52" stroke="currentColor" stroke-width="1.5"/>
    <line x1="30" y1="62" x2="64" y2="62" stroke="currentColor" stroke-width="1.5"/>
    <line x1="30" y1="72" x2="58" y2="72" stroke="currentColor" stroke-width="1.5"/>
  </svg>
`;

const STATUS_COLUMNS = [
  { id: 'draft',         label: 'Rascunho',  short: 'rascunho' },
  { id: 'sent_to_media', label: 'Na mídia',  short: 'enviado' },
  { id: 'scheduled',     label: 'Agendado',  short: 'agendado' },
  { id: 'published',     label: 'Publicado', short: 'publicado' },
];

const STATUS_META = {
  draft:         { label: 'rascunho',  pill: 'research-pill--draft' },
  sent_to_media: { label: 'na mídia',  pill: 'research-pill--sent' },
  scheduled:     { label: 'agendado',  pill: 'research-pill--scheduled' },
  published:     { label: 'publicado', pill: 'research-pill--published' },
};

const viewState = {
  status:  'all',     // 'all' | 'draft' | 'sent_to_media' | 'scheduled' | 'published'
  team:    '',
  sort:    'recent',  // 'recent' | 'oldest' | 'title'
  layout:  'grid',    // 'grid' | 'list' | 'kanban'
};

let cachedPosts = [];
let cachedTeams = [];

export async function renderResearchPosts(ctx) {
  const { root } = ctx;

  root.innerHTML = `
    <div class="view">
      ${renderResearchNav('posts')}

      <header class="view__header" style="display:flex; align-items:flex-end; justify-content:space-between; gap:14px;">
        <div class="research-section-petal">${PAGE_WATERMARK}</div>
        <div>
          <h1>Posts de Instagram</h1>
          <p class="view__lede">Escreva e organize as ideias de post. Arraste entre colunas no kanban pra mudar o status — ou abra um pra editar o texto completo.</p>
        </div>
        <button class="btn btn--primary" id="newPostBtn">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Novo post</span></button>
      </header>

      <div id="postsToolbar"></div>

      <div id="postsList" class="empty-state">
        <div class="research-loading-wrap">
          <span class="research-seal" aria-hidden="true"><span class="research-seal__letter">P</span></span>
          <span>carregando…</span>
        </div>
      </div>
    </div>
  `;

  document.getElementById('newPostBtn').addEventListener('click', () => openPostForm(null));
  await loadPosts();
}

async function loadPosts() {
  const [{ data: posts, error }, { data: teams }] = await Promise.all([
    data.listPosts(),
    data.listGroups(),
  ]);
  if (error) {
    document.getElementById('postsList').innerHTML = `<p class="muted">${error.message}</p>`;
    return;
  }
  cachedPosts = posts || [];
  cachedTeams = teams || [];

  if (!cachedPosts.length) {
    document.getElementById('postsToolbar').innerHTML = '';
    document.getElementById('postsList').innerHTML = `
      <div class="research-empty">
        <div class="research-empty__art">${icon('spark', { size: 48 })}</div>
        <h3>Nenhum post ainda</h3>
        <p>Comece transformando um fichamento em conteúdo pra rede. Você pode arrastar um fichamento da aba anterior pra criar um post instantaneamente.</p>
        <button class="btn btn--primary" id="emptyNew">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Escrever primeiro post</span></button>
      </div>
    `;
    document.getElementById('emptyNew').addEventListener('click', () => openPostForm(null));
    return;
  }

  renderToolbar();
  renderList();
}

function renderToolbar() {
  const counts = countByStatus();
  const chips = [
    { key: 'all',           label: 'todos',      count: cachedPosts.length },
    { key: 'draft',         label: 'rascunho',   count: counts.draft || 0 },
    { key: 'sent_to_media', label: 'enviados',   count: counts.sent_to_media || 0 },
    { key: 'scheduled',     label: 'agendados',  count: counts.scheduled || 0 },
    { key: 'published',     label: 'publicados', count: counts.published || 0 },
  ];

  // status filter só aparece quando NÃO está no kanban (o kanban já mostra todos os status)
  const showStatusChips = viewState.layout !== 'kanban';

  document.getElementById('postsToolbar').innerHTML = `
    <div class="research-toolbar">
      ${showStatusChips ? `
        <div class="research-toolbar__group" role="tablist" aria-label="Filtrar posts">
          ${chips.map((c) => `
            <button class="research-chip ${viewState.status === c.key ? 'is-active' : ''}"
                    data-chip="${c.key}"
                    ${c.count === 0 && c.key !== 'all' ? 'disabled' : ''}>
              <span>${escapeHtml(c.label)}</span>
              <span class="research-chip__count">${c.count}</span>
            </button>
          `).join('')}
        </div>
        <span class="research-toolbar__sep"></span>
      ` : ''}

      <div class="research-toolbar__group">
        <span class="research-toolbar__label">equipe</span>
        <select id="filterTeam">
          <option value="">todas</option>
          ${cachedTeams.map((t) => `
            <option value="${escapeAttr(t.id)}" ${viewState.team === t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>
          `).join('')}
        </select>
      </div>

      ${viewState.layout !== 'kanban' ? `
        <div class="research-toolbar__group">
          <span class="research-toolbar__label">ordenar</span>
          <select id="postsSort">
            <option value="recent" ${viewState.sort === 'recent' ? 'selected' : ''}>mais recente</option>
            <option value="oldest" ${viewState.sort === 'oldest' ? 'selected' : ''}>mais antigo</option>
            <option value="title"  ${viewState.sort === 'title'  ? 'selected' : ''}>título (a-z)</option>
          </select>
        </div>
      ` : ''}

      <span class="research-toolbar__spacer"></span>

      <div class="research-view-toggle" role="tablist" aria-label="Visualização">
        <button data-layout="grid"   class="${viewState.layout === 'grid'   ? 'is-active' : ''}" title="Grade">
          ${icon('departamentos', { size: 14 })}<span>grade</span>
        </button>
        <button data-layout="list"   class="${viewState.layout === 'list'   ? 'is-active' : ''}" title="Lista">
          ${icon('marquee', { size: 14 })}<span>lista</span>
        </button>
        <button data-layout="kanban" class="${viewState.layout === 'kanban' ? 'is-active' : ''}" title="Kanban">
          ${icon('atividades', { size: 14 })}<span>kanban</span>
        </button>
      </div>
    </div>
  `;

  const toolbar = document.getElementById('postsToolbar');
  toolbar.querySelectorAll('[data-chip]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.hasAttribute('disabled')) return;
      viewState.status = btn.dataset.chip;
      renderToolbar();
      renderList();
    });
  });
  toolbar.querySelector('#filterTeam').addEventListener('change', (e) => {
    viewState.team = e.target.value;
    renderList();
  });
  toolbar.querySelector('#postsSort')?.addEventListener('change', (e) => {
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
  box.className = '';

  if (viewState.layout === 'kanban') {
    renderKanban(box);
    return;
  }

  const filtered = applyFilters(cachedPosts);

  if (!filtered.length) {
    box.innerHTML = `
      <div class="research-no-results">
        <span>Nada por aqui</span>
        Nenhum post bate com esse filtro. Tenta outro status, equipe ou ordenação.
      </div>
    `;
    return;
  }

  if (viewState.layout === 'list') {
    box.innerHTML = `<div class="research-post-list">${filtered.map(postListRow).join('')}</div>`;
  } else {
    box.innerHTML = `<div class="research-post-grid">${filtered.map(postCard).join('')}</div>`;
  }

  box.querySelectorAll('[data-id]').forEach((el) => {
    el.addEventListener('click', async (ev) => {
      if (ev.target.closest('button')) return;
      const { data: full } = await data.getPost(el.dataset.id);
      if (full) openPostForm(full);
    });
  });
}

function renderKanban(box) {
  // filtros aplicáveis: equipe (mas não status, pois o próprio kanban separa)
  const filtered = (viewState.team
    ? cachedPosts.filter((p) => p.research_group_id === viewState.team)
    : cachedPosts);

  box.innerHTML = `
    <div class="research-kanban">
      ${STATUS_COLUMNS.map((col) => {
        const items = filtered.filter((p) => p.status === col.id);
        return `
          <section class="research-col" data-status="${col.id}">
            <header class="research-col__head">
              <h3>${escapeHtml(col.label)}</h3>
              <span class="research-col__count">${items.length}</span>
            </header>
            <div class="research-col__body" data-target="${col.id}">
              ${items.length
                ? items.map(kanbanCard).join('')
                : `<div class="research-col__empty"><span style="opacity:0.6;">${escapeHtml(emptyHintFor(col.id))}</span></div>`
              }
            </div>
          </section>
        `;
      }).join('')}
    </div>
  `;

  // bind clicks (abre form)
  for (const card of box.querySelectorAll('.research-kanban-card')) {
    card.addEventListener('click', async (ev) => {
      if (ev.target.closest('button')) return;
      const { data: full } = await data.getPost(card.dataset.id);
      if (full) openPostForm(full);
    });
  }

  bindKanbanDnD();
}

// ---------- DnD entre colunas do kanban ----------
function bindKanbanDnD() {
  let draggedId = null;

  for (const card of document.querySelectorAll('.research-kanban-card')) {
    card.setAttribute('draggable', 'true');
    card.addEventListener('dragstart', (ev) => {
      draggedId = card.dataset.id;
      card.classList.add('is-dragging');
      try { ev.dataTransfer.setData('text/plain', draggedId); } catch {}
      ev.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('is-dragging');
      document.querySelectorAll('.is-drop-target').forEach((el) => el.classList.remove('is-drop-target'));
      document.querySelectorAll('.research-col.is-drop-active').forEach((el) => el.classList.remove('is-drop-active'));
      draggedId = null;
    });
  }

  for (const col of document.querySelectorAll('.research-col')) {
    const body = col.querySelector('.research-col__body');
    const targetStatus = body.dataset.target;

    body.addEventListener('dragover', (ev) => {
      if (!draggedId) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'move';
      body.classList.add('is-drop-target');
      col.classList.add('is-drop-active');
    });
    body.addEventListener('dragleave', (ev) => {
      if (ev.target === body) {
        body.classList.remove('is-drop-target');
        col.classList.remove('is-drop-active');
      }
    });
    body.addEventListener('drop', async (ev) => {
      ev.preventDefault();
      body.classList.remove('is-drop-target');
      col.classList.remove('is-drop-active');
      const postId = draggedId || ev.dataTransfer.getData('text/plain');
      if (!postId) return;
      const post = cachedPosts.find((p) => p.id === postId);
      if (!post || post.status === targetStatus) return;

      // optimistic update
      const original = post.status;
      post.status = targetStatus;
      renderList();
      requestAnimationFrame(() => {
        const moved = document.querySelector(`.research-kanban-card[data-id="${cssEscape(postId)}"]`);
        if (moved) {
          moved.classList.add('is-dropped');
          setTimeout(() => moved.classList.remove('is-dropped'), 600);
        }
      });

      const { error } = await data.updatePost(postId, { status: targetStatus });
      if (error) {
        post.status = original;
        renderList();
        toastError(error.message);
        return;
      }
      const meta = STATUS_META[targetStatus];
      const wasSent = original !== 'sent_to_media' && targetStatus === 'sent_to_media';
      toastSuccess(wasSent ? 'Post enviado pra Mídia.' : `Movido pra ${meta.label}.`);
    });
  }
}

function cssEscape(s) {
  if (window.CSS?.escape) return window.CSS.escape(s);
  return String(s).replace(/"/g, '\\"');
}

function applyFilters(list) {
  let out = list;
  if (viewState.status !== 'all') {
    out = out.filter((p) => p.status === viewState.status);
  }
  if (viewState.team) {
    out = out.filter((p) => p.research_group_id === viewState.team);
  }
  switch (viewState.sort) {
    case 'oldest':
      out = [...out].sort((a, b) => cmpDate(a.created_at, b.created_at));
      break;
    case 'title':
      out = [...out].sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR'));
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

function countByStatus() {
  const out = {};
  for (const p of cachedPosts) out[p.status] = (out[p.status] || 0) + 1;
  return out;
}

function emptyHintFor(status) {
  return ({
    draft: 'nenhum rascunho',
    sent_to_media: 'nenhum aguardando arte',
    scheduled: 'nenhum agendado',
    published: 'nenhum publicado ainda',
  })[status] || 'vazio';
}

function postCard(p) {
  const meta = STATUS_META[p.status] || STATUS_META.draft;
  const preview = (p.body || '').replace(/\s+/g, ' ').slice(0, 220);
  const hasContent = preview.length > 0;
  const eyebrowText = p.research_note ? `do fichamento "${p.research_note.title}"` : 'sem fichamento de origem';
  const teamLabel = p.research_group?.name;
  const noContentCls = hasContent ? '' : 'has-no-content';

  return `
    <article class="research-post-card research-post-card--${p.status} ${noContentCls}" data-id="${escapeAttr(p.id)}">
      <div class="research-post-card__watermark">${PAGE_WATERMARK}</div>
      <p class="research-post-card__eyebrow">
        ${icon('page', { size: 13 })}
        <span>${escapeHtml(eyebrowText)}</span>
      </p>
      <div class="research-post-card__head">
        <h3>${escapeHtml(p.title)}</h3>
        <span class="research-pill ${meta.pill}">${escapeHtml(meta.label)}</span>
      </div>
      ${hasContent
        ? `<p class="research-post-card__preview">${escapeHtml(preview)}${p.body.length > 220 ? '…' : ''}</p>`
        : `<p class="research-post-card__preview">sem texto ainda — abra pra escrever.</p>`
      }
      <footer class="research-post-card__foot">
        ${teamLabel ? `<span class="research-pill research-pill--team">${icon('group', { size: 11 })}<span>${escapeHtml(teamLabel)}</span></span>` : ''}
      </footer>
    </article>
  `;
}

function postListRow(p) {
  const meta = STATUS_META[p.status] || STATUS_META.draft;
  const origin = p.research_note?.title || '—';
  const team = p.research_group?.name || '';
  return `
    <div class="research-post-list-row" data-id="${escapeAttr(p.id)}" data-status="${escapeAttr(p.status)}" role="button" tabindex="0">
      <span class="research-post-list-row__bullet" aria-hidden="true"></span>
      <div class="research-post-list-row__title">
        <strong>${escapeHtml(p.title)}</strong>
        <span>${escapeHtml(meta.label)}</span>
      </div>
      <div class="research-post-list-row__origin">${escapeHtml(origin)}</div>
      <div class="research-post-list-row__team">${escapeHtml(team)}</div>
      <div class="research-post-list-row__status">
        <span class="research-pill ${meta.pill}">${escapeHtml(meta.label)}</span>
      </div>
    </div>
  `;
}

function kanbanCard(p) {
  return `
    <article class="research-kanban-card" data-id="${escapeAttr(p.id)}">
      <div class="research-kanban-card__title">${escapeHtml(p.title)}</div>
      ${p.research_note ? `<div class="research-kanban-card__from">de "${escapeHtml(p.research_note.title)}"</div>` : ''}
      <div class="research-kanban-card__meta">
        ${p.research_group ? `<span class="research-pill research-pill--team">${icon('group', { size: 10 })}<span>${escapeHtml(p.research_group.name)}</span></span>` : ''}
      </div>
    </article>
  `;
}

// ========================================================================
// FORM (drawer de criar/editar post)
// ========================================================================
export async function openPostForm(existing, opts = {}) {
  document.querySelectorAll('.block-drawer-overlay').forEach((el) => el.remove());

  const isEdit = !!existing;
  const prefilledNote = opts.prefilledNote || null;
  const prefilledStatus = opts.prefilledStatus || null;
  const prefilledNoteId = prefilledNote?.id || existing?.research_note_id || null;
  const initialStatus = existing?.status || prefilledStatus || 'draft';
  const initialTitle = existing?.title || (prefilledNote ? prefilledNote.title : '');
  const initialResearchGroupId = existing?.research_group_id
    || prefilledNote?.research_group_id
    || null;

  const [{ data: notes }, { data: researchTeams }] = await Promise.all([
    data.listNotes({ limit: 80 }),
    data.listGroups(),
  ]);

  const overlay = document.createElement('div');
  overlay.className = 'block-drawer-overlay';
  overlay.innerHTML = `
    <div class="block-drawer block-drawer--wide">
      <header class="block-drawer__head">
        <div>
          <p class="block-drawer__crumb">${isEdit ? 'Editando post' : 'Novo post'}</p>
          <h2><span class="block-drawer__icon">${icon('spark', { size: 26 })}</span> ${isEdit ? escapeHtml(existing.title) : 'Post de Instagram'}</h2>
        </div>
        <button class="icon-btn" data-action="close">${icon('x', { size: 16 })}</button>
      </header>
      <form class="block-drawer__body" id="postForm">
        <label class="drawer-field">
          <span class="drawer-field__label">Título interno</span>
          <input type="text" name="title" class="drawer-field__input" required value="${escapeAttr(initialTitle)}" placeholder="Como identificar este post" />
        </label>
        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <label class="drawer-field" style="flex:1; min-width:200px;">
            <span class="drawer-field__label">Fichamento base</span>
            <select name="research_note_id" class="drawer-field__input">
              <option value="">— sem vínculo —</option>
              ${(notes || []).map((n) => `<option value="${escapeAttr(n.id)}" ${prefilledNoteId === n.id ? 'selected' : ''}>${escapeHtml(n.title)}</option>`).join('')}
            </select>
          </label>
          <label class="drawer-field" style="flex:1; min-width:200px;">
            <span class="drawer-field__label">Equipe responsável</span>
            <select name="research_group_id" class="drawer-field__input">
              <option value="">— nenhuma —</option>
              ${(researchTeams || []).map((t) => `<option value="${escapeAttr(t.id)}" ${initialResearchGroupId === t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
            </select>
          </label>
        </div>
        <label class="drawer-field">
          <span class="drawer-field__label">Texto do post</span>
          <textarea name="body" class="drawer-field__input drawer-field__input--tall" rows="10" placeholder="Como vai aparecer no feed">${escapeHtml(existing?.body || prefilledNote?.body || '')}</textarea>
        </label>
        <label class="drawer-field">
          <span class="drawer-field__label">Status</span>
          <select name="status" class="drawer-field__input">
            <option value="draft"         ${initialStatus === 'draft'         ? 'selected' : ''}>Rascunho</option>
            <option value="sent_to_media" ${initialStatus === 'sent_to_media' ? 'selected' : ''}>Enviar pra Mídia</option>
            <option value="scheduled"     ${initialStatus === 'scheduled'     ? 'selected' : ''}>Agendado (controle da Mídia)</option>
            <option value="published"     ${initialStatus === 'published'     ? 'selected' : ''}>Publicado no IG</option>
          </select>
          <p class="drawer-field__hint">Mande pra "Enviar pra Mídia" quando o texto estiver pronto pra ser produzido visualmente.</p>
        </label>
      </form>
      <footer class="block-drawer__foot">
        ${isEdit ? `<button class="btn btn--danger btn--small" data-action="delete">${icon('trash', { size: 14 })}<span style="margin-left:6px;">Excluir</span></button>` : '<span class="spacer"></span>'}
        <span class="spacer"></span>
        <button class="btn btn--ghost" data-action="close">Cancelar</button>
        <button class="btn btn--primary" data-action="save">${isEdit ? 'Salvar' : 'Criar'}</button>
      </footer>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('is-open'));

  const form = overlay.querySelector('#postForm');
  form.addEventListener('submit', (e) => e.preventDefault());
  attachMarkdownEditor(overlay.querySelector('textarea[name="body"]'));

  function close() {
    overlay.classList.remove('is-open');
    setTimeout(() => overlay.remove(), 220);
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      overlay.querySelector('[data-action="save"]')?.click();
    }
  }
  document.addEventListener('keydown', onKey);

  overlay.addEventListener('click', async (ev) => {
    if (ev.target === overlay) return close();
    const action = ev.target.closest('[data-action]')?.dataset?.action;
    if (action === 'close') return close();
    if (action === 'delete' && existing) {
      if (!confirm(`Excluir o post "${existing.title}"?`)) return;
      const { error } = await data.deletePost(existing.id);
      if (error) { toastError(error.message); return; }
      toastSuccess('Post excluído.');
      close();
      if (document.getElementById('postsList')) await loadPosts();
      return;
    }
    if (action === 'save') {
      const fd = new FormData(form);
      const fields = {
        title: String(fd.get('title') || '').trim(),
        body: String(fd.get('body') || ''),
        research_note_id: fd.get('research_note_id') || null,
        research_group_id: fd.get('research_group_id') || null,
        status: String(fd.get('status') || 'draft'),
      };
      if (!fields.title) { toastError('Título é obrigatório.'); return; }
      const { error } = isEdit ? await data.updatePost(existing.id, fields) : await data.createPost(fields);
      if (error) { toastError(error.message); return; }
      const sentNow = !isEdit && fields.status === 'sent_to_media' || (isEdit && existing.status !== 'sent_to_media' && fields.status === 'sent_to_media');
      toastSuccess(sentNow ? 'Post enviado pra Mídia.' : (isEdit ? 'Post atualizado.' : 'Post criado.'));
      close();
      opts.onSaved?.();
      if (document.getElementById('postsList')) await loadPosts();
    }
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
