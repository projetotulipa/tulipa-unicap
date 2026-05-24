// TULIPA · admin · dashboard de Grupos de Estudo (LPs filhas)
// Lista todas as páginas de grupos (publicadas ou não), com filtros e CTA "Novo grupo".
// Permissão: admin OU sector='presidencia' (já validada em app.js antes de chamar).

import { icon } from '../icons.js';
import { stampSeal, stampPage } from '../pages/signet.js';
import { listStudyGroupPagesAdmin, deleteStudyGroupPage, updateStudyGroupPage } from '../../js/study-groups.js';
import { coverIcon } from '../../js/study-group-icons.js';
import { toastSuccess, toastError } from '../toast.js';

const viewState = { filter: 'all' }; // all | published | drafts | archived

export async function renderStudyGroups(ctx) {
  const { root } = ctx;

  root.innerHTML = `
    <div class="view view--study">
      ${heroHtml()}
      <div id="studyStats" class="pages-editor-stats" hidden></div>
      <div id="studyToolbar"></div>
      <div id="studyList" class="pages-block-list">
        <div class="pages-loading-wrap">
          <span class="pages-bloom"><span class="pages-signet">${stampSeal({ size: 24 })}</span></span>
          <p>Abrindo a biblioteca…</p>
        </div>
      </div>
    </div>
  `;

  const { data: groups, error } = await listStudyGroupPagesAdmin();
  if (error) {
    document.getElementById('studyList').innerHTML = `
      <div class="pages-empty-v2">
        <div class="pages-empty-v2__art">${icon('alert', { size: 52 })}</div>
        <h3>Erro ao carregar</h3>
        <p>${escapeHtml(error.message || String(error))}</p>
        <p class="muted" style="margin-top: 12px; font-size: 12px;">
          Verifique se a migration <code>016-study-pages.sql</code> foi rodada no Supabase.
        </p>
      </div>
    `;
    return;
  }

  renderStats(groups);
  renderToolbar(ctx, groups);
  renderList(ctx, groups);
}

function heroHtml() {
  return `
    <header class="pages-hero-v2 pages-hero-v2--study">
      <div class="pages-hero-v2__seal-wrap">
        <span class="pages-signet pages-signet--wine">${stampSeal({ size: 36 })}</span>
      </div>
      <div class="pages-hero-v2__inner">
        <p class="pages-hero-v2__eyebrow">biblioteca viva · grupos de estudo</p>
        <h1>Folhas de Estudo</h1>
        <p class="pages-hero-v2__lede">
          Cada grupo de estudo ganha uma <strong>landing page própria</strong> com descrição,
          encontros, fichamentos e material complementar. Aqui você cria, edita e organiza
          essas folhas.
        </p>
      </div>
      <div class="pages-hero-v2__actions">
        <a class="btn btn--primary" href="#/grupos-estudo/novo">
          ${icon('plus', { size: 14 })}<span style="margin-left:6px;">Novo grupo</span>
        </a>
      </div>
      <div class="pages-hero-v2__page">${stampPage({ size: 200 })}</div>
    </header>
  `;
}

function renderStats(groups) {
  const slot = document.getElementById('studyStats');
  if (!slot) return;
  const total = groups.length;
  const published = groups.filter((g) => g.is_published).length;
  const drafts = groups.filter((g) => !g.is_published).length;
  const archived = groups.filter((g) => g.is_archived).length;

  slot.hidden = false;
  slot.innerHTML = `
    <div class="pages-editor-stats__cell">
      <strong>${total}</strong>
      <span>${total === 1 ? 'folha' : 'folhas'}</span>
    </div>
    <div class="pages-editor-stats__cell">
      <strong>${published}</strong>
      <span>${published === 1 ? 'publicada' : 'publicadas'}</span>
    </div>
    <div class="pages-editor-stats__cell pages-editor-stats__cell--gold">
      <strong>${drafts}</strong>
      <span>${drafts === 1 ? 'rascunho' : 'rascunhos'}</span>
    </div>
    <div class="pages-editor-stats__cell pages-editor-stats__cell--rose">
      <strong>${archived}</strong>
      <span>${archived === 1 ? 'arquivada' : 'arquivadas'}</span>
    </div>
  `;
}

function renderToolbar(ctx, groups) {
  const slot = document.getElementById('studyToolbar');
  if (!slot) return;
  const counts = {
    all: groups.length,
    published: groups.filter((g) => g.is_published && !g.is_archived).length,
    drafts: groups.filter((g) => !g.is_published).length,
    archived: groups.filter((g) => g.is_archived).length,
  };

  slot.innerHTML = `
    <div class="pages-editor-toolbar">
      <div class="pages-editor-toolbar__group">
        <span class="pages-editor-toolbar__label">mostrar</span>
        ${chip('all', 'todos', counts.all)}
        ${chip('published', 'publicados', counts.published)}
        ${chip('drafts', 'rascunhos', counts.drafts)}
        ${chip('archived', 'arquivados', counts.archived)}
      </div>
    </div>
  `;
  slot.querySelectorAll('[data-chip]').forEach((el) => {
    el.addEventListener('click', () => {
      viewState.filter = el.dataset.chip;
      renderToolbar(ctx, groups);
      renderList(ctx, groups);
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

function filterGroups(groups) {
  switch (viewState.filter) {
    case 'published': return groups.filter((g) => g.is_published && !g.is_archived);
    case 'drafts':    return groups.filter((g) => !g.is_published);
    case 'archived':  return groups.filter((g) => g.is_archived);
    default:          return groups;
  }
}

function renderList(ctx, groups) {
  const list = document.getElementById('studyList');
  if (!list) return;
  const filtered = filterGroups(groups);

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="pages-empty-v2">
        <div class="pages-empty-v2__art">${stampSeal({ size: 52 })}</div>
        <h3>${viewState.filter === 'all' ? 'Nenhum grupo catalogado ainda' : 'Nada nesse filtro'}</h3>
        <p>${viewState.filter === 'all'
          ? 'Comece criando a primeira folha. Você pode vincular a um grupo já existente na Secretaria ou criar um grupo novo do zero.'
          : 'Tente outro filtro.'}</p>
        ${viewState.filter === 'all' ? `
          <a class="btn btn--primary" href="#/grupos-estudo/novo" style="margin-top: 16px;">
            ${icon('plus', { size: 14 })}<span style="margin-left:6px;">Criar primeira folha</span>
          </a>
        ` : ''}
      </div>
    `;
    return;
  }

  list.innerHTML = '';
  for (const g of filtered) {
    list.appendChild(buildCard(ctx, g, groups));
  }
}

function buildCard(ctx, group, allGroups) {
  const accent = group.accent_color || 'wine';
  const url = `../atividades/grupos-de-estudo/grupo.html?id=${encodeURIComponent(group.slug)}`;
  const updatedAt = group.updated_at ? new Date(group.updated_at) : null;
  const updatedLabel = updatedAt
    ? updatedAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  const card = document.createElement('article');
  card.className = `study-card study-card--accent-${accent} ${group.is_archived ? 'is-archived' : ''} ${!group.is_published ? 'is-draft' : ''}`;
  card.dataset.pageId = group.page_id;

  card.innerHTML = `
    <div class="study-card__emoji" aria-hidden="true">${coverIcon(group.cover_emoji || 'book', 32)}</div>
    <div class="study-card__main">
      <header class="study-card__head">
        <h3>${escapeHtml(group.group_name || '(sem nome)')}</h3>
        <div class="study-card__badges">
          ${group.is_published
            ? `<span class="study-card__badge study-card__badge--success">${icon('check-circle', { size: 10 })}<span>publicado</span></span>`
            : `<span class="study-card__badge study-card__badge--gold">${icon('edit', { size: 10 })}<span>rascunho</span></span>`}
          ${group.is_archived
            ? `<span class="study-card__badge study-card__badge--rose">${icon('clock', { size: 10 })}<span>arquivado</span></span>`
            : ''}
          ${!group.show_on_index && group.is_published
            ? `<span class="study-card__badge study-card__badge--muted">${icon('eye-off', { size: 10 })}<span>fora da LP genérica</span></span>`
            : ''}
        </div>
      </header>
      <p class="study-card__path">
        <code>/atividades/grupos-de-estudo/grupo.html?id=${escapeHtml(group.slug)}</code>
      </p>
      ${group.lede ? `<p class="study-card__lede">${escapeHtml(truncate(stripHtml(group.lede), 180))}</p>` : ''}
      <footer class="study-card__foot">
        <span class="study-card__meta">${icon('clock', { size: 11 })}<span style="margin-left: 4px;">atualizado em ${escapeHtml(updatedLabel)}</span></span>
        <span class="study-card__meta">${icon('calendar', { size: 11 })}<span style="margin-left: 4px;">${group.schedule_kind || 'manual'}</span></span>
      </footer>
    </div>
    <div class="study-card__actions">
      ${group.is_published ? `
        <a class="icon-btn" href="${escapeAttr(url)}" target="_blank" rel="noopener" title="Ver no site" aria-label="Ver no site">
          ${icon('external', { size: 14 })}
        </a>
      ` : ''}
      <button class="icon-btn" data-action="toggle-published" title="${group.is_published ? 'Despublicar' : 'Publicar'}" aria-label="${group.is_published ? 'Despublicar' : 'Publicar'}">
        ${icon(group.is_published ? 'eye-off' : 'eye', { size: 14 })}
      </button>
      <a class="btn btn--primary btn--small" href="#/grupos-estudo/${encodeURIComponent(group.page_id)}">
        ${icon('edit', { size: 12 })}<span style="margin-left:6px;">Editar</span>
      </a>
      <button class="icon-btn icon-btn--danger" data-action="delete" title="Remover folha" aria-label="Remover folha">
        ${icon('trash', { size: 14 })}
      </button>
    </div>
  `;

  card.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('[data-action]');
    if (!btn) return;
    ev.preventDefault();
    const action = btn.dataset.action;

    if (action === 'toggle-published') {
      btn.disabled = true;
      const newVal = !group.is_published;
      const { error } = await updateStudyGroupPage(group.page_id, { is_published: newVal });
      btn.disabled = false;
      if (error) {
        toastError(`Não consegui ${newVal ? 'publicar' : 'despublicar'}: ${error.message}`);
        return;
      }
      group.is_published = newVal;
      // re-render local em vez de fetch
      renderStats(allGroups);
      renderToolbar({}, allGroups);
      renderList({}, allGroups);
      toastSuccess(newVal ? 'Folha publicada — visível no site.' : 'Folha despublicada — só você vê.');
      return;
    }

    if (action === 'delete') {
      if (!confirm(`Remover a folha de "${group.group_name}"?\n\nIsso apaga a página, o material complementar e desvincula da Secretaria.\nO grupo em si (presença, encontros, fichamentos) permanece intocado.`)) return;
      if (!confirm('Tem certeza? Esta ação não pode ser desfeita.')) return;
      const { error } = await deleteStudyGroupPage(group.page_id);
      if (error) {
        toastError(`Erro ao remover: ${error.message}`);
        return;
      }
      // remove do array local + re-render
      const idx = allGroups.indexOf(group);
      if (idx >= 0) allGroups.splice(idx, 1);
      renderStats(allGroups);
      renderToolbar({}, allGroups);
      renderList({}, allGroups);
      toastSuccess('Folha removida.');
    }
  });

  return card;
}

// ---------- helpers ----------
function truncate(s, n) {
  if (!s) return '';
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

function stripHtml(html) {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = String(html);
  return tmp.textContent.replace(/\s+/g, ' ').trim();
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function escapeAttr(s) {
  return escapeHtml(s);
}
