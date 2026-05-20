// Planejamento financeiro — lista de planos com título, descrição e valor estimado.

import { icon } from '../icons.js';
import * as data from '../finance/data.js';
import { brl } from '../finance/format.js';
import { renderFinanceNav } from './finance-nav.js';
import { toastSuccess, toastError } from '../toast.js';

let cachedPlans = [];

export async function renderFinancePlans(ctx) {
  const { root } = ctx;

  root.innerHTML = `
    <div class="view">
      ${renderFinanceNav('planejamento')}

      <header class="view__header" style="display:flex; align-items:flex-end; justify-content:space-between; gap:14px;">
        <div>
          <h1>Planejamento financeiro</h1>
          <p class="view__lede">Anote ideias e objetivos pra onde o dinheiro pode ir. Marque como concluído quando virar gasto real.</p>
        </div>
        <button class="btn btn--primary" id="newPlanBtn">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Novo plano</span></button>
      </header>

      <div id="plansList" class="empty-state">
        <div class="skel skel--block"></div>
      </div>
    </div>
  `;

  document.getElementById('newPlanBtn').addEventListener('click', () => openPlanForm(null));
  await loadPlans();
}

async function loadPlans() {
  const box = document.getElementById('plansList');
  const { data: rows, error } = await data.listPlans({ includeCompleted: true });
  if (error) { box.innerHTML = `<p class="muted">${error.message}</p>`; return; }
  cachedPlans = rows || [];
  if (!cachedPlans.length) {
    box.innerHTML = `
      <div class="att-empty">
        <div class="att-empty__art">${icon('spark', { size: 48 })}</div>
        <h3>Nenhum plano registrado</h3>
        <p>Use o "Novo plano" pra anotar destinos possíveis pro dinheiro do projeto.</p>
        <button class="btn btn--primary" id="emptyNewPlanBtn">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Criar primeiro</span></button>
      </div>
    `;
    document.getElementById('emptyNewPlanBtn').addEventListener('click', () => openPlanForm(null));
    return;
  }

  const active = cachedPlans.filter((p) => !p.is_completed);
  const done = cachedPlans.filter((p) => p.is_completed);

  box.className = '';
  box.innerHTML = `
    ${active.length ? `
      <h2>Em aberto</h2>
      <div class="fin-plan-grid">${active.map(planCard).join('')}</div>
    ` : '<p class="muted">Nenhum plano em aberto.</p>'}

    ${done.length ? `
      <h2 style="margin-top: 28px;">Concluídos</h2>
      <div class="fin-plan-grid">${done.map(planCard).join('')}</div>
    ` : ''}
  `;
  wireCards();
}

function planCard(p) {
  return `
    <article class="fin-plan-card ${p.is_completed ? 'is-completed' : ''}" data-id="${escapeAttr(p.id)}">
      <header class="fin-plan-card__head">
        <strong>${escapeHtml(p.title)}</strong>
        ${p.estimated_amount != null ? `<span class="pill pill--gold">${escapeHtml(brl(p.estimated_amount))}</span>` : ''}
      </header>
      ${p.description ? `<p class="fin-plan-card__desc">${escapeHtml(p.description)}</p>` : ''}
      <footer class="fin-plan-card__foot">
        <button class="btn btn--ghost btn--small" data-action="toggle">
          ${p.is_completed ? icon('refresh', { size: 12 }) : icon('check-circle', { size: 12 })}
          <span style="margin-left:6px;">${p.is_completed ? 'reabrir' : 'marcar concluído'}</span>
        </button>
        <span class="spacer"></span>
        <button class="icon-btn icon-btn--xs" data-action="edit" title="Editar">${icon('edit', { size: 12 })}</button>
        <button class="icon-btn icon-btn--xs" data-action="delete" title="Excluir">${icon('trash', { size: 12 })}</button>
      </footer>
    </article>
  `;
}

function wireCards() {
  document.querySelectorAll('.fin-plan-card').forEach((card) => {
    const id = card.dataset.id;
    const plan = cachedPlans.find((p) => p.id === id);
    card.querySelector('[data-action="toggle"]')?.addEventListener('click', async () => {
      const { error } = await data.togglePlanCompleted(id, !plan.is_completed);
      if (error) { toastError(error.message); return; }
      toastSuccess(plan.is_completed ? 'Plano reaberto.' : 'Plano marcado como concluído.');
      await loadPlans();
    });
    card.querySelector('[data-action="edit"]')?.addEventListener('click', () => openPlanForm(plan));
    card.querySelector('[data-action="delete"]')?.addEventListener('click', async () => {
      if (!confirm(`Excluir o plano "${plan.title}"?`)) return;
      const { error } = await data.deletePlan(id);
      if (error) { toastError(error.message); return; }
      toastSuccess('Plano excluído.');
      await loadPlans();
    });
  });
}

function openPlanForm(existing) {
  document.querySelectorAll('.block-drawer-overlay').forEach((el) => el.remove());

  const isEdit = !!existing;
  const overlay = document.createElement('div');
  overlay.className = 'block-drawer-overlay';
  overlay.innerHTML = `
    <div class="block-drawer">
      <header class="block-drawer__head">
        <div>
          <p class="block-drawer__crumb">${isEdit ? 'Editando plano' : 'Novo plano'}</p>
          <h2><span class="block-drawer__icon">${icon('spark', { size: 24 })}</span> ${isEdit ? escapeHtml(existing.title) : 'Anotar destino'}</h2>
        </div>
        <button class="icon-btn" data-action="close">${icon('x', { size: 16 })}</button>
      </header>
      <form class="block-drawer__body" id="planForm">
        <label class="drawer-field">
          <span class="drawer-field__label">Título</span>
          <input type="text" name="title" class="drawer-field__input" required value="${escapeAttr(existing?.title || '')}" placeholder="Ex.: comprar projetor pra eventos" />
        </label>
        <label class="drawer-field">
          <span class="drawer-field__label">Descrição (opcional)</span>
          <textarea name="description" class="drawer-field__input" rows="3" placeholder="Por que esse plano? O que precisa pra concretizar?">${escapeHtml(existing?.description || '')}</textarea>
        </label>
        <label class="drawer-field">
          <span class="drawer-field__label">Valor estimado (R$) — opcional</span>
          <input type="number" step="0.01" min="0" name="estimated_amount" class="drawer-field__input" value="${existing?.estimated_amount ?? ''}" placeholder="0,00" />
        </label>
      </form>
      <footer class="block-drawer__foot">
        <span class="spacer"></span>
        <button class="btn btn--ghost" data-action="close">Cancelar</button>
        <button class="btn btn--primary" data-action="save">${isEdit ? 'Salvar' : 'Criar'}</button>
      </footer>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('is-open'));

  overlay.querySelector('#planForm').addEventListener('submit', (e) => e.preventDefault());

  function close() {
    overlay.classList.remove('is-open');
    setTimeout(() => overlay.remove(), 220);
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);

  overlay.addEventListener('click', async (ev) => {
    if (ev.target === overlay) return close();
    const action = ev.target.closest('[data-action]')?.dataset?.action;
    if (action === 'close') return close();
    if (action === 'save') {
      const form = overlay.querySelector('#planForm');
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
      await loadPlans();
    }
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
