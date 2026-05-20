// Planejamento financeiro — Sprint 5 (cartas anais + selo gold animado + polish).

import { icon } from '../icons.js';
import * as data from '../finance/data.js';
import { brl, brlCompact } from '../finance/format.js';
import { stampSeal, stampPage } from '../finance/seal.js';
import { renderFinanceNav } from './finance-nav.js';
import { toastSuccess, toastError } from '../toast.js';

const viewState = {
  filter: 'active', // active | completed | all
  search: '',
  sort: 'recent', // recent | high | low | title
};

let cached = [];

export async function renderFinancePlans(ctx) {
  const { root } = ctx;

  root.innerHTML = `
    <div class="view">
      ${renderFinanceNav('planejamento')}

      <header class="fin-hero-v2">
        <div class="fin-hero-v2__seal-wrap">
          <span class="fin-seal">${stampSeal({ size: 32 })}</span>
        </div>
        <div class="fin-hero-v2__inner">
          <p class="fin-hero-v2__eyebrow">anais · destinos planejados</p>
          <h1>Planejamento</h1>
          <p class="fin-hero-v2__lede">
            Cada plano é uma página dos anais. Anote ideias, marque quando virar gasto real — concluídos ganham <strong>selo dourado</strong>.
          </p>
        </div>
        <div class="fin-hero-v2__cta">
          <button id="newPlanBtn" class="btn btn--primary">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Novo plano</span></button>
        </div>
        <div class="fin-hero-v2__page">${stampPage({ size: 200 })}</div>
      </header>

      <div id="plansToolbar"></div>

      <div id="plansList">
        <div class="fin-loading-wrap">
          <span class="fin-bloom"><span class="fin-seal">${stampSeal({ size: 24 })}</span></span>
          <p>Abrindo os anais…</p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('newPlanBtn').addEventListener('click', () => openPlanForm(null));
  await loadAll();
}

async function loadAll() {
  const { data: rows, error } = await data.listPlans({ includeCompleted: true });
  if (error) {
    document.getElementById('plansList').innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`;
    return;
  }
  cached = rows || [];
  if (!cached.length) {
    document.getElementById('plansToolbar').innerHTML = '';
    document.getElementById('plansList').innerHTML = `
      <div class="fin-empty-v2">
        <div class="fin-empty-v2__art">${icon('spark', { size: 56 })}</div>
        <h3>Nenhum plano registrado</h3>
        <p>Use o botão "Novo plano" pra anotar destinos possíveis pro dinheiro do projeto. Cada plano vira página dos anais.</p>
        <button class="btn btn--primary" id="emptyNewPlanBtn">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Criar primeiro</span></button>
      </div>
    `;
    document.getElementById('emptyNewPlanBtn').addEventListener('click', () => openPlanForm(null));
    return;
  }
  renderToolbar();
  renderList();
}

function renderToolbar() {
  const counts = {
    active: cached.filter((p) => !p.is_completed).length,
    completed: cached.filter((p) => p.is_completed).length,
    all: cached.length,
  };
  document.getElementById('plansToolbar').innerHTML = `
    <div class="att-toolbar">
      <div class="att-toolbar__group">
        <input type="text" id="planSearch" placeholder="Buscar plano…" value="${escapeAttr(viewState.search)}" style="min-width: 220px;" />
      </div>
      <div class="att-toolbar__group">
        ${chip('active', 'em aberto', counts.active)}
        ${chip('completed', 'concluídos', counts.completed)}
        ${chip('all', 'todos', counts.all)}
      </div>
      <span class="att-toolbar__spacer"></span>
      <div class="att-toolbar__group">
        <span class="att-toolbar__label">ordenar</span>
        <select id="planSort">
          <option value="recent" ${viewState.sort === 'recent' ? 'selected' : ''}>mais recente</option>
          <option value="title"  ${viewState.sort === 'title'  ? 'selected' : ''}>título</option>
          <option value="high"   ${viewState.sort === 'high'   ? 'selected' : ''}>maior valor</option>
          <option value="low"    ${viewState.sort === 'low'    ? 'selected' : ''}>menor valor</option>
        </select>
      </div>
    </div>
  `;
  document.getElementById('planSearch').addEventListener('input', (e) => {
    viewState.search = e.target.value;
    renderList();
  });
  document.getElementById('planSort').addEventListener('change', (e) => {
    viewState.sort = e.target.value;
    renderList();
  });
  document.querySelectorAll('.att-toolbar [data-chip]').forEach((el) => {
    el.addEventListener('click', () => {
      viewState.filter = el.dataset.chip;
      renderToolbar();
      renderList();
    });
  });
}

function chip(key, label, count) {
  const active = viewState.filter === key ? ' is-active' : '';
  return `<button class="att-chip${active}" data-chip="${key}">
    <span>${escapeHtml(label)}</span>
    <span class="att-chip__count">${count}</span>
  </button>`;
}

function renderList() {
  const box = document.getElementById('plansList');
  const q = viewState.search.toLowerCase().trim();
  let arr = cached.filter((p) => {
    if (viewState.filter === 'active' && p.is_completed) return false;
    if (viewState.filter === 'completed' && !p.is_completed) return false;
    if (q) {
      const t = (p.title || '').toLowerCase();
      const d = (p.description || '').toLowerCase();
      if (!t.includes(q) && !d.includes(q)) return false;
    }
    return true;
  });
  arr.sort(sorter(viewState.sort));

  if (arr.length === 0) {
    box.innerHTML = `<div class="fin-no-results">
      <span>Nada por aqui</span>
      <p>nenhum plano corresponde aos filtros atuais.</p>
    </div>`;
    return;
  }

  box.innerHTML = `<div class="fin-plan-grid-v2">${arr.map(planLetter).join('')}</div>`;
  wireCards();
}

function sorter(key) {
  switch (key) {
    case 'title': return (a, b) => (a.title || '').localeCompare(b.title || '', 'pt-BR');
    case 'high':  return (a, b) => (Number(b.estimated_amount) || 0) - (Number(a.estimated_amount) || 0);
    case 'low':   return (a, b) => {
      // null por último em "menor valor"
      const av = a.estimated_amount;
      const bv = b.estimated_amount;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return Number(av) - Number(bv);
    };
    case 'recent':
    default: return (a, b) => (b.created_at || '').localeCompare(a.created_at || '');
  }
}

function planLetter(p) {
  const isDone = !!p.is_completed;
  return `
    <article class="fin-plan-letter ${isDone ? 'is-completed' : ''}" data-id="${escapeAttr(p.id)}">
      <div class="fin-plan-letter__page">${stampPage({ size: 150 })}</div>

      ${isDone ? `
        <span class="fin-plan-letter__stamp" title="Plano concluído">
          ${icon('check', { size: 11 })}<span>concluído</span>
        </span>
      ` : ''}

      <div class="fin-plan-letter__head">
        <span class="fin-plan-letter__seal" aria-hidden="true">${stampSeal({ size: 22 })}</span>
        <div class="fin-plan-letter__title">
          <p class="fin-plan-letter__eyebrow ${isDone ? 'fin-plan-letter__eyebrow--completed' : ''}">${isDone ? 'destino realizado' : 'destino planejado'}</p>
          <h3 class="fin-plan-letter__name">${escapeHtml(p.title)}</h3>
        </div>
      </div>

      ${p.description
        ? `<p class="fin-plan-letter__desc">${escapeHtml(p.description)}</p>`
        : `<p class="fin-plan-letter__desc fin-plan-letter__desc--empty">sem descrição</p>`}

      ${p.estimated_amount != null
        ? `<div class="fin-plan-letter__amount">
             <strong>${escapeHtml(brl(p.estimated_amount))}</strong>
             <span>orçamento previsto</span>
           </div>`
        : `<div class="fin-plan-letter__amount">
             <span class="fin-plan-letter__amount--empty">sem orçamento estimado</span>
           </div>`}

      <div class="fin-plan-letter__actions">
        <button class="btn btn--ghost btn--small" data-action="toggle" aria-label="${isDone ? 'Reabrir plano' : 'Marcar como concluído'}">
          ${isDone ? icon('refresh', { size: 12 }) : icon('check-circle', { size: 12 })}
          <span style="margin-left:6px;">${isDone ? 'reabrir' : 'marcar concluído'}</span>
        </button>
        <span class="spacer"></span>
        <button class="icon-btn icon-btn--xs" data-action="edit" title="Editar" aria-label="Editar plano">${icon('edit', { size: 12 })}</button>
        <button class="icon-btn icon-btn--xs" data-action="delete" title="Excluir" aria-label="Excluir plano">${icon('trash', { size: 12 })}</button>
      </div>
    </article>
  `;
}

function wireCards() {
  document.querySelectorAll('.fin-plan-letter').forEach((card) => {
    const id = card.dataset.id;
    const plan = cached.find((p) => p.id === id);
    if (!plan) return;

    card.querySelector('[data-action="toggle"]')?.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      const wantCompleted = !plan.is_completed;
      const { error } = await data.togglePlanCompleted(id, wantCompleted);
      if (error) { toastError(error.message); return; }
      toastSuccess(wantCompleted ? 'Plano selado como concluído.' : 'Plano reaberto.');
      // pulse-check antes de reload
      if (wantCompleted) {
        card.classList.add('is-just-completed', 'is-completed');
        setTimeout(() => { loadAll(); }, 750);
      } else {
        await loadAll();
      }
    });
    card.querySelector('[data-action="edit"]')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      openPlanForm(plan);
    });
    card.querySelector('[data-action="delete"]')?.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      if (!confirm(`Excluir o plano "${plan.title}"?`)) return;
      const { error } = await data.deletePlan(id);
      if (error) { toastError(error.message); return; }
      toastSuccess('Plano excluído.');
      await loadAll();
    });
  });
}

function openPlanForm(existing) {
  document.querySelectorAll('.block-drawer-overlay').forEach((el) => el.remove());

  const isEdit = !!existing;
  let livePreview = Number(existing?.estimated_amount || 0);

  const overlay = document.createElement('div');
  overlay.className = 'block-drawer-overlay';
  overlay.innerHTML = `
    <div class="block-drawer">
      <header class="block-drawer__head">
        <div>
          <p class="block-drawer__crumb">${isEdit ? 'Editando plano' : 'Novo plano'}</p>
          <h2><span class="block-drawer__icon">${icon('spark', { size: 24 })}</span> ${isEdit ? escapeHtml(existing.title) : 'Anotar destino'}</h2>
        </div>
        <button class="icon-btn" data-action="close" aria-label="Fechar">${icon('x', { size: 16 })}</button>
      </header>
      <form class="block-drawer__body" id="planForm">
        <label class="drawer-field">
          <span class="drawer-field__label">Título</span>
          <input type="text" name="title" class="drawer-field__input" required maxlength="120" value="${escapeAttr(existing?.title || '')}" placeholder="Ex.: comprar projetor pra eventos" />
        </label>
        <label class="drawer-field">
          <span class="drawer-field__label">Descrição (opcional)</span>
          <textarea name="description" class="drawer-field__input" rows="3" maxlength="500" placeholder="Por que esse plano? O que precisa pra concretizar?">${escapeHtml(existing?.description || '')}</textarea>
        </label>
        <div class="fin-amount-preview">
          <span class="fin-amount-preview__label">orçamento</span>
          <span class="fin-amount-preview__value" id="planAmountPreview">${escapeHtml(brl(livePreview))}</span>
        </div>
        <label class="drawer-field">
          <span class="drawer-field__label">Valor estimado (R$) — opcional</span>
          <input type="number" step="0.01" min="0" name="estimated_amount" class="drawer-field__input" value="${existing?.estimated_amount ?? ''}" placeholder="0,00" id="planAmountInput" />
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

  const form = overlay.querySelector('#planForm');
  form.addEventListener('submit', (e) => e.preventDefault());

  // preview do valor em tempo real
  const amountInput = overlay.querySelector('#planAmountInput');
  const amountPreview = overlay.querySelector('#planAmountPreview');
  amountInput.addEventListener('input', () => {
    const v = Number(amountInput.value) || 0;
    amountPreview.textContent = brl(v);
  });

  function close() {
    overlay.classList.remove('is-open');
    setTimeout(() => overlay.remove(), 220);
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
    if ((e.key === 's' || e.key === 'S') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      doSave();
    }
  }
  document.addEventListener('keydown', onKey);

  async function doSave() {
    const fd = new FormData(form);
    const fields = {
      title: String(fd.get('title') || '').trim(),
      description: String(fd.get('description') || '').trim() || null,
      estimated_amount: fd.get('estimated_amount') ? Number(fd.get('estimated_amount')) : null,
    };
    if (!fields.title) { toastError('Título é obrigatório.'); return; }
    const { error } = isEdit ? await data.updatePlan(existing.id, fields) : await data.createPlan(fields);
    if (error) { toastError(error.message); return; }
    toastSuccess(isEdit ? 'Plano atualizado.' : 'Plano criado.');
    close();
    await loadAll();
  }

  overlay.addEventListener('click', async (ev) => {
    if (ev.target === overlay) return close();
    const action = ev.target.closest('[data-action]')?.dataset?.action;
    if (action === 'close') return close();
    if (action === 'delete' && existing) {
      if (!confirm(`Excluir o plano "${existing.title}"?`)) return;
      const { error } = await data.deletePlan(existing.id);
      if (error) { toastError(error.message); return; }
      toastSuccess('Plano excluído.');
      close();
      await loadAll();
      return;
    }
    if (action === 'save') await doSave();
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
