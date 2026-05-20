// Gastos — lista cronológica + form de novo gasto.

import { icon } from '../icons.js';
import * as data from '../finance/data.js';
import { brl, currentMonth, monthLabel, isoMonthRange } from '../finance/format.js';
import { EXPENSE_CATEGORIES, categoryById, categoryIconHtml, categoryLabel } from '../finance/categories.js';
import { renderFinanceNav } from './finance-nav.js';
import { toastSuccess, toastError } from '../toast.js';

let viewYear, viewMonth;
let allRows = [];

export async function renderFinanceExpenses(ctx) {
  const { root } = ctx;
  if (!viewYear) ({ year: viewYear, month: viewMonth } = currentMonth());

  root.innerHTML = `
    <div class="view">
      ${renderFinanceNav('gastos')}

      <header class="view__header" style="display:flex; align-items:flex-end; justify-content:space-between; gap:14px; flex-wrap:wrap;">
        <div>
          <h1>Gastos · ${escapeHtml(monthLabel(viewYear, viewMonth))}</h1>
          <p class="view__lede">Registre cada gasto com categoria, valor e data. Excepcionais exigem descrição (palestrante, atividade, etc).</p>
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <div class="fin-monthnav">
            <button class="icon-btn" id="prevMonthBtn" title="Mês anterior">${icon('arrow-left', { size: 14 })}</button>
            <span class="fin-monthnav__label">${escapeHtml(monthLabel(viewYear, viewMonth))}</span>
            <button class="icon-btn" id="nextMonthBtn" title="Próximo mês">${icon('arrow-right', { size: 14 })}</button>
          </div>
          <button class="btn btn--primary" id="newExpenseBtn">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Novo gasto</span></button>
        </div>
      </header>

      <div id="expensesSummary" class="fin-cat-summary">
        ${EXPENSE_CATEGORIES.map((c) => `
          <button class="fin-cat-chip" data-cat="${c.id}" data-active="1">
            <span class="fin-cat-chip__icon">${categoryIconHtml(c.id, 14)}</span>
            <span class="fin-cat-chip__label">${escapeHtml(c.label)}</span>
            <strong data-cat-total>R$ 0,00</strong>
          </button>
        `).join('')}
      </div>

      <div id="expensesList" class="empty-state">
        <div class="skel skel--block"></div>
      </div>
    </div>
  `;

  document.getElementById('prevMonthBtn').addEventListener('click', () => navigateMonth(ctx, -1));
  document.getElementById('nextMonthBtn').addEventListener('click', () => navigateMonth(ctx, +1));
  document.getElementById('newExpenseBtn').addEventListener('click', () => openExpenseForm(null));

  // filtros por categoria
  document.querySelectorAll('.fin-cat-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const active = chip.dataset.active === '1';
      chip.dataset.active = active ? '0' : '1';
      chip.classList.toggle('is-inactive', active);
      applyFilters();
    });
  });

  await loadExpenses();
}

function navigateMonth(ctx, delta) {
  let y = viewYear, m = viewMonth + delta;
  while (m < 1) { m += 12; y--; }
  while (m > 12) { m -= 12; y++; }
  viewYear = y; viewMonth = m;
  renderFinanceExpenses(ctx);
}

async function loadExpenses() {
  const { from, to } = isoMonthRange(viewYear, viewMonth);
  const { data: rows, error } = await data.listExpenses({ from, to });
  if (error) {
    document.getElementById('expensesList').innerHTML = `<p class="muted">${error.message}</p>`;
    return;
  }
  allRows = rows || [];

  // summary
  const byCat = {};
  for (const r of allRows) {
    byCat[r.category] = (byCat[r.category] || 0) + Number(r.amount || 0);
  }
  for (const chip of document.querySelectorAll('.fin-cat-chip')) {
    const cat = chip.dataset.cat;
    chip.querySelector('[data-cat-total]').textContent = brl(byCat[cat] || 0);
  }

  const box = document.getElementById('expensesList');
  if (!allRows.length) {
    box.innerHTML = `
      <div class="att-empty">
        <div class="att-empty__art">${icon('trash', { size: 48 })}</div>
        <h3>Nenhum gasto este mês</h3>
        <p>Quando registrar o primeiro gasto, ele aparece aqui em ordem cronológica.</p>
        <button class="btn btn--primary" id="emptyNewExpBtn">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Registrar primeiro</span></button>
      </div>
    `;
    document.getElementById('emptyNewExpBtn').addEventListener('click', () => openExpenseForm(null));
    return;
  }

  box.className = '';
  box.innerHTML = `<ul class="fin-exp-list">${allRows.map(expRow).join('')}</ul>`;
  wireRows();
  applyFilters();
}

function expRow(e) {
  const cat = categoryById(e.category);
  const d = new Date(e.spent_on + 'T00:00:00');
  const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `
    <li class="fin-exp-row" data-cat="${escapeAttr(e.category)}" data-id="${escapeAttr(e.id)}">
      <span class="fin-exp-row__cat fin-exp-row__cat--${e.category}">
        ${categoryIconHtml(e.category, 14)}
      </span>
      <div class="fin-exp-row__main">
        <strong>${escapeHtml(cat?.label || e.category)}</strong>
        ${e.description ? `<span class="muted">${escapeHtml(e.description)}</span>` : ''}
      </div>
      <span class="fin-exp-row__date">${escapeHtml(dateStr)}</span>
      <strong class="fin-exp-row__amount">${escapeHtml(brl(e.amount))}</strong>
      <div class="fin-exp-row__menu">
        <button class="icon-btn icon-btn--xs" data-action="edit">${icon('edit', { size: 12 })}</button>
        <button class="icon-btn icon-btn--xs" data-action="delete">${icon('trash', { size: 12 })}</button>
      </div>
    </li>
  `;
}

function wireRows() {
  document.querySelectorAll('.fin-exp-row').forEach((row) => {
    row.querySelector('[data-action="edit"]')?.addEventListener('click', () => {
      const exp = allRows.find((r) => r.id === row.dataset.id);
      if (exp) openExpenseForm(exp);
    });
    row.querySelector('[data-action="delete"]')?.addEventListener('click', async () => {
      if (!confirm('Excluir este gasto?')) return;
      const { error } = await data.deleteExpense(row.dataset.id);
      if (error) { toastError(error.message); return; }
      toastSuccess('Gasto excluído.');
      await loadExpenses();
    });
  });
}

function applyFilters() {
  const active = new Set(
    Array.from(document.querySelectorAll('.fin-cat-chip[data-active="1"]'))
      .map((c) => c.dataset.cat)
  );
  for (const row of document.querySelectorAll('.fin-exp-row')) {
    row.hidden = !active.has(row.dataset.cat);
  }
}

function openExpenseForm(existing) {
  document.querySelectorAll('.block-drawer-overlay').forEach((el) => el.remove());

  const isEdit = !!existing;
  const overlay = document.createElement('div');
  overlay.className = 'block-drawer-overlay';
  overlay.innerHTML = `
    <div class="block-drawer">
      <header class="block-drawer__head">
        <div>
          <p class="block-drawer__crumb">${isEdit ? 'Editando gasto' : 'Novo gasto'}</p>
          <h2><span class="block-drawer__icon">${icon('trash', { size: 24 })}</span> ${isEdit ? brl(existing.amount) : 'Registrar gasto'}</h2>
        </div>
        <button class="icon-btn" data-action="close">${icon('x', { size: 16 })}</button>
      </header>
      <form class="block-drawer__body" id="expenseForm">
        <label class="drawer-field">
          <span class="drawer-field__label">Categoria</span>
          <div class="fin-cat-picker">
            ${EXPENSE_CATEGORIES.map((c) => `
              <label class="fin-cat-radio ${existing?.category === c.id ? 'is-selected' : ''}">
                <input type="radio" name="category" value="${c.id}" ${existing?.category === c.id ? 'checked' : (!isEdit && c.id === 'alimentacao' ? 'checked' : '')} />
                <span class="fin-cat-radio__icon">${categoryIconHtml(c.id, 16)}</span>
                <span>${escapeHtml(c.label)}</span>
              </label>
            `).join('')}
          </div>
        </label>
        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <label class="drawer-field" style="flex:1; min-width:160px;">
            <span class="drawer-field__label">Valor (R$)</span>
            <input type="number" step="0.01" min="0.01" name="amount" class="drawer-field__input" required value="${existing ? existing.amount : ''}" placeholder="0,00" />
          </label>
          <label class="drawer-field" style="flex:1; min-width:160px;">
            <span class="drawer-field__label">Data</span>
            <input type="date" name="spent_on" class="drawer-field__input" required value="${escapeAttr(existing?.spent_on || new Date().toISOString().slice(0,10))}" />
          </label>
        </div>
        <label class="drawer-field">
          <span class="drawer-field__label" id="descLabel">Descrição</span>
          <textarea name="description" class="drawer-field__input" rows="3" placeholder="O que foi gasto?">${escapeHtml(existing?.description || '')}</textarea>
          <p class="muted" id="descHint" style="font-size:12px; margin:6px 0 0;"></p>
        </label>
      </form>
      <footer class="block-drawer__foot">
        ${isEdit ? `<button class="btn btn--danger btn--small" data-action="delete">${icon('trash', { size: 14 })}<span style="margin-left:6px;">Excluir</span></button>` : '<span class="spacer"></span>'}
        <span class="spacer"></span>
        <button class="btn btn--ghost" data-action="close">Cancelar</button>
        <button class="btn btn--primary" data-action="save">${isEdit ? 'Salvar' : 'Registrar'}</button>
      </footer>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('is-open'));

  const form = overlay.querySelector('#expenseForm');
  form.addEventListener('submit', (e) => e.preventDefault());

  function syncCategoryUI() {
    const selected = form.querySelector('[name="category"]:checked')?.value;
    overlay.querySelectorAll('.fin-cat-radio').forEach((el) => {
      el.classList.toggle('is-selected', el.querySelector('input').checked);
    });
    const cat = categoryById(selected);
    const label = overlay.querySelector('#descLabel');
    const hint = overlay.querySelector('#descHint');
    if (cat?.requiresDescription) {
      label.innerHTML = 'Descrição <span style="color:var(--danger-soft);">*</span>';
      hint.textContent = cat.hint || '';
    } else {
      label.textContent = 'Descrição (opcional)';
      hint.textContent = '';
    }
  }
  form.querySelectorAll('[name="category"]').forEach((r) => r.addEventListener('change', syncCategoryUI));
  syncCategoryUI();

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
    if (action === 'delete' && existing) {
      if (!confirm('Excluir este gasto?')) return;
      const { error } = await data.deleteExpense(existing.id);
      if (error) { toastError(error.message); return; }
      toastSuccess('Excluído.');
      close();
      await loadExpenses();
      return;
    }
    if (action === 'save') {
      const fd = new FormData(form);
      const fields = {
        category: String(fd.get('category') || ''),
        amount: Number(fd.get('amount') || 0),
        description: String(fd.get('description') || '').trim() || null,
        spent_on: String(fd.get('spent_on') || ''),
      };
      const cat = categoryById(fields.category);
      if (!cat) { toastError('Escolha uma categoria.'); return; }
      if (!fields.amount || fields.amount <= 0) { toastError('Valor precisa ser maior que zero.'); return; }
      if (!fields.spent_on) { toastError('Escolha a data.'); return; }
      if (cat.requiresDescription && !fields.description) {
        toastError('Descrição é obrigatória para gastos excepcionais.'); return;
      }
      const { error } = isEdit
        ? await data.updateExpense(existing.id, fields)
        : await data.createExpense(fields);
      if (error) { toastError(error.message); return; }
      toastSuccess(isEdit ? 'Gasto atualizado.' : 'Gasto registrado.');
      close();
      await loadExpenses();
    }
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
