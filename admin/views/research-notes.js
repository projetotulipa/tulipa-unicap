// Fichamentos teóricos — CRUD com vínculo a meeting.

import { icon } from '../icons.js';
import * as data from '../research/data.js';
import * as attData from '../attendance/data.js';
import { renderResearchNav } from './research-nav.js';
import { toastSuccess, toastError } from '../toast.js';
import { FICHAMENTO_TEMPLATES, FICHAMENTO_GUIDE, templateById } from '../research/template.js';
import { attachMarkdownEditor } from '../markdown-editor.js';

// página dobrada (mesma do dashboard, em escala de card)
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

const MONTH_NAMES_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const viewState = {
  status:  'all',     // 'all' | 'with_post' | 'no_post' | 'this_month'
  team:    '',        // research_group_id (filtro adicional)
  sort:    'recent',  // 'recent' | 'oldest' | 'title' | 'most_posts'
  layout:  'grid',    // 'grid' | 'list'
  search:  '',
};

let cachedNotes = [];
let cachedPosts = [];
let cachedTeams = [];
// notes_with_posts: Map<note_id, count>
let postCountByNote = new Map();

export async function renderResearchNotes(ctx) {
  const { root } = ctx;

  root.innerHTML = `
    <div class="view">
      ${renderResearchNav('fichamentos')}

      <header class="view__header" style="display:flex; align-items:flex-end; justify-content:space-between; gap:14px;">
        <div class="research-section-petal">${PAGE_WATERMARK}</div>
        <div>
          <h1>Fichamentos teóricos</h1>
          <p class="view__lede">Registre o estudo de cada aula. Arraste um card pra zona "criar post" pra transformar o fichamento em conteúdo.</p>
        </div>
        <button class="btn btn--primary" id="newNoteBtn">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Novo fichamento</span></button>
      </header>

      <div class="search-bar">
        <span class="search-bar__icon">${icon('search', { size: 16 })}</span>
        <input type="text" id="noteSearch" placeholder="Buscar fichamento por título ou conteúdo…" value="${escapeAttr(viewState.search)}" />
      </div>

      <div id="notesToolbar"></div>

      <div id="notesList" class="empty-state">
        <div class="research-loading-wrap">
          <span class="research-seal" aria-hidden="true"><span class="research-seal__letter">P</span></span>
          <span>carregando…</span>
        </div>
      </div>
    </div>
  `;

  document.getElementById('newNoteBtn').addEventListener('click', () => openNoteForm(null));
  document.getElementById('noteSearch').addEventListener('input', (ev) => {
    viewState.search = ev.target.value;
    renderList();
  });

  await loadAll();
}

async function loadAll() {
  const [{ data: notes, error }, { data: posts }, { data: teams }] = await Promise.all([
    data.listNotes(),
    data.listPosts(),
    data.listGroups(),
  ]);
  if (error) {
    document.getElementById('notesList').innerHTML = `<p class="muted">${error.message}</p>`;
    return;
  }
  cachedNotes = notes || [];
  cachedPosts = posts || [];
  cachedTeams = teams || [];

  // contagem de posts por fichamento
  postCountByNote = new Map();
  for (const p of cachedPosts) {
    if (!p.research_note_id) continue;
    postCountByNote.set(p.research_note_id, (postCountByNote.get(p.research_note_id) || 0) + 1);
  }

  if (!cachedNotes.length) {
    document.getElementById('notesToolbar').innerHTML = '';
    document.getElementById('notesList').innerHTML = `
      <div class="research-empty">
        <div class="research-empty__art">${icon('page', { size: 48 })}</div>
        <h3>Nenhum fichamento ainda</h3>
        <p>Comece registrando o estudo da última aula. Cada fichamento pode virar um (ou vários) posts pra Mídia.</p>
        <button class="btn btn--primary" id="emptyNew">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Criar primeiro fichamento</span></button>
      </div>
    `;
    document.getElementById('emptyNew').addEventListener('click', () => openNoteForm(null));
    return;
  }

  renderToolbar();
  renderList();
}

function renderToolbar() {
  const counts = countByFilter();
  const chips = [
    { key: 'all',         label: 'todos',          count: counts.all },
    { key: 'with_post',   label: 'com post',       count: counts.with_post },
    { key: 'no_post',     label: 'sem post',       count: counts.no_post },
    { key: 'this_month',  label: 'este mês',       count: counts.this_month },
  ];

  document.getElementById('notesToolbar').innerHTML = `
    <div class="research-toolbar">
      <div class="research-toolbar__group" role="tablist" aria-label="Filtrar fichamentos">
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

      <div class="research-toolbar__group">
        <span class="research-toolbar__label">equipe</span>
        <select id="filterTeam">
          <option value="">todas</option>
          ${cachedTeams.map((t) => `
            <option value="${escapeAttr(t.id)}" ${viewState.team === t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>
          `).join('')}
        </select>
      </div>

      <div class="research-toolbar__group">
        <span class="research-toolbar__label">ordenar</span>
        <select id="notesSort">
          <option value="recent"     ${viewState.sort === 'recent'     ? 'selected' : ''}>mais recente</option>
          <option value="oldest"     ${viewState.sort === 'oldest'     ? 'selected' : ''}>mais antigo</option>
          <option value="title"      ${viewState.sort === 'title'      ? 'selected' : ''}>título (a-z)</option>
          <option value="most_posts" ${viewState.sort === 'most_posts' ? 'selected' : ''}>+ posts derivados</option>
        </select>
      </div>

      <span class="research-toolbar__spacer"></span>

      <div class="research-view-toggle" role="tablist" aria-label="Visualização">
        <button data-layout="grid" class="${viewState.layout === 'grid' ? 'is-active' : ''}" title="Grade">
          ${icon('departamentos', { size: 14 })}<span>grade</span>
        </button>
        <button data-layout="list" class="${viewState.layout === 'list' ? 'is-active' : ''}" title="Lista">
          ${icon('marquee', { size: 14 })}<span>lista</span>
        </button>
      </div>
    </div>
  `;

  const toolbar = document.getElementById('notesToolbar');
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
  toolbar.querySelector('#notesSort').addEventListener('change', (e) => {
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
  const box = document.getElementById('notesList');
  const filtered = applyFilters(cachedNotes);

  box.className = '';

  if (!filtered.length) {
    box.innerHTML = `
      <div class="research-no-results">
        <span>Nada por aqui</span>
        Nenhum fichamento bate com esse filtro. Tenta outro estado, equipe ou ordenação.
      </div>
    `;
    return;
  }

  if (viewState.layout === 'list') {
    box.innerHTML = `<div class="research-note-list">${filtered.map(noteListRow).join('')}</div>`;
  } else {
    box.innerHTML = `<div class="res-notes-list">${filtered.map(noteCard).join('')}</div>`;
  }

  box.querySelectorAll('[data-id]').forEach((el) => {
    el.addEventListener('click', async (ev) => {
      // dnd-related interactions não devem abrir modal
      if (ev.target.closest('button')) return;
      const { data: full } = await data.getNote(el.dataset.id);
      if (full) openNoteForm(full);
    });
  });

  bindNoteDragToPost();
}

function applyFilters(list) {
  const today = new Date();
  const thisMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  let out = list;

  // chip de status
  if (viewState.status === 'with_post') {
    out = out.filter((n) => (postCountByNote.get(n.id) || 0) > 0);
  } else if (viewState.status === 'no_post') {
    out = out.filter((n) => !(postCountByNote.get(n.id) || 0));
  } else if (viewState.status === 'this_month') {
    out = out.filter((n) => {
      const ref = n.meeting?.date || n.created_at;
      if (!ref) return false;
      return ref.slice(0, 7) === thisMonthKey;
    });
  }

  // equipe
  if (viewState.team) {
    out = out.filter((n) => n.research_group_id === viewState.team);
  }

  // busca
  const q = viewState.search.toLowerCase().trim();
  if (q) {
    out = out.filter((n) =>
      (n.title || '').toLowerCase().includes(q) ||
      (n.body || '').toLowerCase().includes(q)
    );
  }

  // sort
  switch (viewState.sort) {
    case 'oldest':
      out = [...out].sort((a, b) => cmpDate(a.created_at, b.created_at));
      break;
    case 'title':
      out = [...out].sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR'));
      break;
    case 'most_posts':
      out = [...out].sort((a, b) => (postCountByNote.get(b.id) || 0) - (postCountByNote.get(a.id) || 0));
      break;
    case 'recent':
    default:
      out = [...out].sort((a, b) => cmpDate(b.created_at, a.created_at));
      break;
  }
  return out;
}

function countByFilter() {
  const today = new Date();
  const thisMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  let withPost = 0;
  let noPost = 0;
  let thisMonth = 0;
  for (const n of cachedNotes) {
    const has = (postCountByNote.get(n.id) || 0) > 0;
    if (has) withPost++; else noPost++;
    const ref = n.meeting?.date || n.created_at;
    if (ref && ref.slice(0, 7) === thisMonthKey) thisMonth++;
  }
  return { all: cachedNotes.length, with_post: withPost, no_post: noPost, this_month: thisMonth };
}

function cmpDate(a, b) {
  return new Date(a || 0).getTime() - new Date(b || 0).getTime();
}

function noteCard(n) {
  const meetingDate = n.meeting?.date
    ? new Date(n.meeting.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : null;
  const preview = (n.body || '').replace(/\s+/g, ' ').slice(0, 220);
  const hasContent = preview.length > 0;
  const eyebrowText = buildEyebrow(n);
  const postCount = postCountByNote.get(n.id) || 0;
  const groupLabel = n.research_group?.name;
  const hasNoContentClass = hasContent ? '' : 'has-no-content';

  return `
    <article class="research-note-card ${hasNoContentClass}" data-id="${escapeAttr(n.id)}" draggable="true">
      <div class="research-note-card__watermark">${PAGE_WATERMARK}</div>
      <p class="research-note-card__eyebrow">
        ${icon('page', { size: 13 })}
        <span>${escapeHtml(eyebrowText)}</span>
      </p>
      <header class="research-note-card__head">
        <h3>${escapeHtml(n.title)}</h3>
      </header>
      ${hasContent
        ? `<p class="research-note-card__preview">${escapeHtml(preview)}${n.body.length > 220 ? '…' : ''}</p>`
        : `<p class="research-note-card__preview">sem conteúdo ainda — abra pra começar a escrever.</p>`
      }
      <footer class="research-note-card__foot">
        ${meetingDate ? `<span class="research-pill">${icon('calendar', { size: 11 })}<span>${escapeHtml(meetingDate)}</span></span>` : ''}
        ${groupLabel ? `<span class="research-pill research-pill--team">${icon('group', { size: 11 })}<span>${escapeHtml(groupLabel)}</span></span>` : ''}
        ${postCount > 0
          ? `<span class="research-pill research-pill--posts" style="margin-left:auto;">${icon('spark', { size: 11 })}<span>${postCount} ${postCount === 1 ? 'post' : 'posts'}</span></span>`
          : `<span class="research-pill research-pill--no-posts" style="margin-left:auto;">ainda sem post</span>`
        }
      </footer>
    </article>
  `;
}

function noteListRow(n) {
  const eyebrowText = buildEyebrow(n);
  const postCount = postCountByNote.get(n.id) || 0;
  const ref = n.meeting?.date || n.created_at;
  const refDate = ref ? new Date(ref.length === 10 ? ref + 'T00:00:00' : ref) : null;
  const dayNum = refDate ? refDate.getDate() : '·';
  const monthShort = refDate ? MONTH_NAMES_SHORT[refDate.getMonth()] : '';

  return `
    <div class="research-note-list-row" data-id="${escapeAttr(n.id)}" draggable="true" role="button" tabindex="0">
      <div class="research-note-list-row__date">
        ${dayNum}<small>${escapeHtml(monthShort)}</small>
      </div>
      <div class="research-note-list-row__title">
        <strong>${escapeHtml(n.title)}</strong>
        <span>${escapeHtml(eyebrowText)}</span>
      </div>
      <div class="research-note-list-row__origin">${escapeHtml(n.research_group?.name || '—')}</div>
      <div class="research-note-list-row__posts">
        ${postCount > 0
          ? `${postCount} ${postCount === 1 ? 'post' : 'posts'}`
          : `<span style="opacity:0.5;">sem post</span>`
        }
      </div>
    </div>
  `;
}

function buildEyebrow(n) {
  const parts = [];
  if (n.group?.name) parts.push(`grupo ${n.group.name}`);
  if (n.meeting?.date) {
    const d = new Date(n.meeting.date + 'T00:00:00');
    parts.push(`aula de ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`);
  }
  return parts.length ? parts.join(' · ') : 'fichamento livre';
}

// ---------- drag-and-drop: arrastar fichamento → criar post ----------
function bindNoteDragToPost() {
  let draggedNoteId = null;

  let overlay = document.getElementById('researchDropOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'researchDropOverlay';
    overlay.className = 'research-drop-overlay';
    overlay.innerHTML = `
      <div class="research-drop-overlay__hint">
        <span>criar post</span>
        soltar em um destino
      </div>
      ${dropZone('draft',         'Rascunho')}
      ${dropZone('sent_to_media', 'Enviar à Mídia')}
    `;
    document.body.appendChild(overlay);
  }

  function showOverlay() { overlay.classList.add('is-visible'); }
  function hideOverlay() {
    overlay.classList.remove('is-visible');
    overlay.querySelectorAll('.research-drop-zone').forEach((z) => z.classList.remove('is-hover'));
  }

  overlay.querySelectorAll('.research-drop-zone').forEach((zone) => {
    zone.addEventListener('dragover', (ev) => {
      if (!draggedNoteId) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'copy';
      zone.classList.add('is-hover');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('is-hover'));
    zone.addEventListener('drop', async (ev) => {
      ev.preventDefault();
      const noteId = draggedNoteId || ev.dataTransfer.getData('text/plain');
      hideOverlay();
      if (!noteId) return;
      const { data: full } = await data.getNote(noteId);
      if (!full) { toastError('Não consegui carregar o fichamento.'); return; }
      const targetStatus = zone.dataset.zone;
      const { openPostForm } = await import('./research-posts.js');
      openPostForm(null, {
        prefilledNote: full,
        prefilledStatus: targetStatus,
        onSaved: () => loadAll(),
      });
    });
  });

  document
    .querySelectorAll('.research-note-card[data-id], .research-note-list-row[data-id]')
    .forEach((el) => {
      el.setAttribute('draggable', 'true');
      el.addEventListener('dragstart', (ev) => {
        draggedNoteId = el.dataset.id;
        el.classList.add('is-dragging');
        try { ev.dataTransfer.setData('text/plain', draggedNoteId); } catch {}
        ev.dataTransfer.effectAllowed = 'copy';
        showOverlay();
      });
      el.addEventListener('dragend', () => {
        el.classList.remove('is-dragging');
        draggedNoteId = null;
        hideOverlay();
      });
    });
}

function dropZone(status, label) {
  const iconSvg = status === 'sent_to_media'
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="14" x2="15" y2="14"/></svg>';
  return `
    <div class="research-drop-zone" data-zone="${status}">
      <span class="research-drop-zone__icon">${iconSvg}</span>
      <span>${escapeHtml(label)}</span>
    </div>
  `;
}

// ========================================================================
// FORM (drawer de criar/editar fichamento) — preservado do código anterior
// ========================================================================
async function openNoteForm(existing) {
  document.querySelectorAll('.block-drawer-overlay').forEach((el) => el.remove());

  const isEdit = !!existing;
  const [{ data: groups }, { data: researchTeams }] = await Promise.all([
    attData.listGroups(),
    data.listGroups(),
  ]);

  const overlay = document.createElement('div');
  overlay.className = 'block-drawer-overlay';
  overlay.innerHTML = `
    <div class="block-drawer block-drawer--wide">
      <header class="block-drawer__head">
        <div>
          <p class="block-drawer__crumb">${isEdit ? 'Editando fichamento' : 'Novo fichamento'}</p>
          <h2><span class="block-drawer__icon">${icon('page', { size: 26 })}</span> ${isEdit ? escapeHtml(existing.title) : 'Fichamento'}</h2>
        </div>
        <button class="icon-btn" data-action="close">${icon('x', { size: 16 })}</button>
      </header>
      <form class="block-drawer__body" id="noteForm">
        <label class="drawer-field">
          <span class="drawer-field__label">Título</span>
          <input type="text" name="title" class="drawer-field__input" required value="${escapeAttr(existing?.title || '')}" placeholder="Ex.: Capítulo 3 — Sombra (von Franz)" />
        </label>
        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <label class="drawer-field" style="flex:1; min-width:200px;">
            <span class="drawer-field__label">Grupo (aulas)</span>
            <select name="group_id" class="drawer-field__input" id="noteGroup">
              <option value="">— sem vínculo —</option>
              ${(groups || []).map((g) => `<option value="${escapeAttr(g.id)}" ${existing?.group_id === g.id ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('')}
            </select>
          </label>
          <label class="drawer-field" style="flex:1; min-width:200px;">
            <span class="drawer-field__label">Aula (data)</span>
            <select name="meeting_id" class="drawer-field__input" id="noteMeeting">
              <option value="">— escolha um grupo primeiro —</option>
            </select>
          </label>
        </div>
        <label class="drawer-field">
          <span class="drawer-field__label">Equipe responsável (pesquisa)</span>
          <select name="research_group_id" class="drawer-field__input">
            <option value="">— nenhuma —</option>
            ${(researchTeams || []).map((t) => `<option value="${escapeAttr(t.id)}" ${existing?.research_group_id === t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
          </select>
          <p class="drawer-field__hint">Quem dentro da Pesquisa está cuidando deste fichamento.</p>
        </label>
        <label class="drawer-field">
          <div class="drawer-field__head" style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
            <span class="drawer-field__label">Conteúdo</span>
            <div style="display:flex; gap:6px;">
              <button type="button" class="btn btn--ghost btn--small" data-action="insert-template">
                ${icon('page', { size: 12 })}<span style="margin-left:6px;">Inserir modelo</span>
              </button>
              <button type="button" class="btn btn--ghost btn--small" data-action="toggle-guide">
                ${icon('spark', { size: 12 })}<span style="margin-left:6px;">Como fichar</span>
              </button>
            </div>
          </div>
          <div id="fichGuide" class="fich-guide" hidden>
            ${FICHAMENTO_GUIDE.map((g, i) => `
              <details ${i === 0 ? 'open' : ''}>
                <summary>${escapeHtml(g.title)}</summary>
                <p>${escapeHtml(g.body).replace(/\n/g, '<br/>')}</p>
              </details>
            `).join('')}
          </div>
          <textarea name="body" class="drawer-field__input drawer-field__input--tall" rows="14" placeholder="Resumo do estudo, citações, observações, perguntas… ou clique em &quot;Inserir modelo&quot;.">${escapeHtml(existing?.body || '')}</textarea>
          <p class="drawer-field__hint">Texto livre. Aceita quebras de linha e markdown leve (** negrito **, * itálico *, &gt; citação).</p>
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

  const form = overlay.querySelector('#noteForm');
  form.addEventListener('submit', (e) => e.preventDefault());

  attachMarkdownEditor(overlay.querySelector('textarea[name="body"]'));

  const groupSel = overlay.querySelector('#noteGroup');
  const meetingSel = overlay.querySelector('#noteMeeting');

  async function loadMeetings(groupId) {
    if (!groupId) {
      meetingSel.innerHTML = '<option value="">— escolha um grupo primeiro —</option>';
      return;
    }
    const { data: meetings } = await attData.listMeetings(groupId, {});
    const options = ['<option value="">— sem aula específica —</option>'];
    for (const m of (meetings || [])) {
      const d = new Date(m.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      options.push(`<option value="${m.id}" ${existing?.meeting_id === m.id ? 'selected' : ''}>${d} (${m.status})</option>`);
    }
    meetingSel.innerHTML = options.join('');
  }
  groupSel.addEventListener('change', () => loadMeetings(groupSel.value));
  if (existing?.group_id) loadMeetings(existing.group_id);

  function close() {
    overlay.classList.remove('is-open');
    setTimeout(() => overlay.remove(), 220);
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
    // Ctrl+S salva
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
    if (action === 'insert-template') {
      openTemplatePicker(overlay);
      return;
    }
    if (action === 'toggle-guide') {
      const g = overlay.querySelector('#fichGuide');
      g.hidden = !g.hidden;
      return;
    }
    if (action === 'delete' && existing) {
      if (!confirm(`Excluir o fichamento "${existing.title}"?`)) return;
      const { error } = await data.deleteNote(existing.id);
      if (error) { toastError(error.message); return; }
      toastSuccess('Fichamento excluído.');
      close();
      await loadAll();
      return;
    }
    if (action === 'save') {
      const fd = new FormData(form);
      const fields = {
        title: String(fd.get('title') || '').trim(),
        body: String(fd.get('body') || ''),
        group_id: fd.get('group_id') || null,
        meeting_id: fd.get('meeting_id') || null,
        research_group_id: fd.get('research_group_id') || null,
      };
      if (!fields.title) { toastError('Título é obrigatório.'); return; }
      const { error } = isEdit ? await data.updateNote(existing.id, fields) : await data.createNote(fields);
      if (error) { toastError(error.message); return; }
      toastSuccess(isEdit ? 'Fichamento atualizado.' : 'Fichamento criado.');
      close();
      await loadAll();
    }
  });
}

function openTemplatePicker(parentOverlay) {
  const picker = document.createElement('div');
  picker.className = 'fich-picker-overlay';
  picker.innerHTML = `
    <div class="fich-picker">
      <header class="fich-picker__head">
        <div>
          <p class="block-drawer__crumb">Escolha um modelo</p>
          <h2 style="margin:0; font-family:'Cormorant Garamond',serif; font-style:italic; font-size:22px; color:var(--cream);">Modelos ABNT</h2>
        </div>
        <button class="icon-btn" data-action="close-picker" aria-label="Fechar">${icon('x', { size: 16 })}</button>
      </header>
      <div class="fich-picker__list">
        ${FICHAMENTO_TEMPLATES.map((t) => `
          <button class="fich-picker__option" data-template-id="${escapeAttr(t.id)}">
            <header class="fich-picker__option-head">
              <strong>${escapeHtml(t.label)}</strong>
              <span class="pill pill--gold">${escapeHtml(t.abnt)}</span>
            </header>
            <p>${escapeHtml(t.description)}</p>
          </button>
        `).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(picker);
  requestAnimationFrame(() => picker.classList.add('is-open'));

  function close() {
    picker.classList.remove('is-open');
    setTimeout(() => picker.remove(), 200);
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);

  picker.addEventListener('click', (ev) => {
    if (ev.target === picker) return close();
    if (ev.target.closest('[data-action="close-picker"]')) return close();
    const opt = ev.target.closest('[data-template-id]');
    if (!opt) return;
    const tmpl = templateById(opt.dataset.templateId);
    if (!tmpl) return;
    const ta = parentOverlay.querySelector('textarea[name="body"]');
    if (ta.value.trim() && !confirm('Isso vai substituir o conteúdo atual pelo modelo. Continuar?')) return;
    ta.value = tmpl.body;
    ta.focus();
    ta.setSelectionRange(0, 0);
    close();
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
