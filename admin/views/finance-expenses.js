// Gastos — Sprint 3 (cartas editoriais + distribuição visual + drawer com cards).

import { icon } from '../icons.js';
import * as data from '../finance/data.js';
import { brl, brlCompact, currentMonth, monthLabel, isoMonthRange } from '../finance/format.js';
import { EXPENSE_CATEGORIES, categoryById, categoryIconHtml, categoryLabel } from '../finance/categories.js';
import { stampSeal, stampPage } from '../finance/seal.js';
import { renderFinanceNav } from './finance-nav.js';
import { toastSuccess, toastError } from '../toast.js';

const viewState = {
  year: null,
  month: null,
  search: '',
  activeCats: new Set(EXPENSE_CATEGORIES.map((c) => c.id)),
  sort: 'recent', // recent | older | high | low
  layout: 'grid', // grid | list
};

let cached = null;

export async function renderFinanceExpenses(ctx) {
  const { root } = ctx;
  if (viewState.year == null) {
    const cur = currentMonth();
    viewState.year = cur.year;
    viewState.month = cur.month;
  }

  root.innerHTML = `
    <div class="view">
      ${renderFinanceNav('gastos')}

      <header class="fin-hero-v2">
        <div class="fin-hero-v2__seal-wrap">
          <span class="fin-seal">${stampSeal({ size: 32 })}</span>
        </div>
        <div class="fin-hero-v2__inner">
          <p class="fin-hero-v2__eyebrow">gastos · contas a relatar</p>
          <h1>Gastos</h1>
          <p class="fin-hero-v2__lede">
            Cada gasto é um registro com categoria, valor e data. <strong>Excepcionais</strong> (palestras, professores) exigem descrição.
          </p>
        </div>
        <div class="fin-hero-v2__cta">
          <button id="newExpenseBtn" class="btn btn--primary">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Novo gasto</span></button>
        </div>
        <div class="fin-hero-v2__page">${stampPage({ size: 200 })}</div>
      </header>

      <div id="expCatsBar"></div>
      <div id="expToolbar"></div>
      <div id="expContent">
        <div class="fin-loading-wrap">
          <span class="fin-bloom"><span class="fin-seal">${stampSeal({ size: 24 })}</span></span>
          <p>Abrindo o livro de gastos…</p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('newExpenseBtn').addEventListener('click', () => openExpenseForm(null));

  await loadAll(ctx);
}

async function loadAll(ctx) {
  const { from, to } = isoMonthRange(viewState.year, viewState.month);
  const { data: rows, error } = await data.listExpenses({ from, to });
  if (error) {
    document.getElementById('expContent').innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`;
    return;
  }
  cached = { rows: rows || [], ctx };
  renderCatBars();
  renderToolbar();
  renderContent();
}

function renderCatBars() {
  const box = document.getElementById('expCatsBar');
  if (!box) return;

  const byCat = {};
  let total = 0;
  for (const r of cached.rows) {
    const v = Number(r.amount || 0);
    byCat[r.category] = (byCat[r.category] || 0) + v;
    total += v;
  }
  const max = Math.max(1, ...Object.values(byCat));

  box.innerHTML = `
    <div class="fin-cat-bars">
      ${EXPENSE_CATEGORIES.map((c) => {
        const v = byCat[c.id] || 0;
        const pct = total > 0 ? Math.round((v / total) * 100) : 0;
        const fillWidth = max > 0 ? Math.max(2, Math.round(v / max * 100)) : 0;
        const isEmpty = v === 0;
        const isActive = viewState.activeCats.has(c.id);
        const allActive = viewState.activeCats.size === EXPENSE_CATEGORIES.length;
        const cls = `fin-cat-bar-card fin-cat-bar-card--${c.id}` +
                    (isEmpty ? ' is-empty' : '') +
                    (!allActive && isActive ? ' is-active' : '') +
                    (!allActive && !isActive ? ' is-inactive' : '');
        return `
          <button class="${cls}" data-cat="${escapeAttr(c.id)}" type="button">
            <div class="fin-cat-bar-card__head">
              <span class="fin-cat-bar-card__icon">${categoryIconHtml(c.id, 18)}</span>
              <span class="fin-cat-bar-card__label">${escapeHtml(c.label)}</span>
              <span class="fin-cat-bar-card__num">${brlCompact(v)}</span>
            </div>
            <div class="fin-cat-bar-card__bar">
              <div class="fin-cat-bar-card__bar-fill" style="width: ${fillWidth}%;"></div>
            </div>
            <div class="fin-cat-bar-card__foot">
              <span>${countByCat(c.id)} ${countByCat(c.id) === 1 ? 'gasto' : 'gastos'}</span>
              <span class="fin-cat-bar-card__pct">${pct}%</span>
            </div>
          </button>
        `;
      }).join('')}
    </div>
  `;

  document.querySelectorAll('.fin-cat-bar-card').forEach((card) => {
    card.addEventListener('click', () => {
      const cat = card.dataset.cat;
      const allActive = viewState.activeCats.size === EXPENSE_CATEGORIES.length;
      if (allActive) {
        viewState.activeCats = new Set([cat]);
      } else if (viewState.activeCats.has(cat) && viewState.activeCats.size === 1) {
        viewState.activeCats = new Set(EXPENSE_CATEGORIES.map((c) => c.id));
      } else if (viewState.activeCats.has(cat)) {
        viewState.activeCats.delete(cat);
      } else {
        viewState.activeCats.add(cat);
      }
      renderCatBars();
      renderContent();
    });
  });
}

function countByCat(catId) {
  return cached.rows.filter((r) => r.category === catId).length;
}

function renderToolbar() {
  const box = document.getElementById('expToolbar');
  if (!box) return;

  const cur = currentMonth();
  const isFuture = (viewState.year > cur.year) || (viewState.year === cur.year && viewState.month >= cur.month);
  const isToday = viewState.year === cur.year && viewState.month === cur.month;

  box.innerHTML = `
    <div class="att-toolbar" style="margin-bottom: 16px;">
      <div class="att-toolbar__group">
        <div class="fin-monthnav-v2">
          <button class="fin-monthnav-v2__arrow" id="prevMonthBtn" aria-label="Mês anterior">${icon('arrow-left', { size: 14 })}</button>
          <span class="fin-monthnav-v2__label">${escapeHtml(monthLabel(viewState.year, viewState.month))}</span>
          <button class="fin-monthnav-v2__arrow" id="nextMonthBtn" aria-label="Próximo mês" ${isFuture ? 'disabled' : ''}>${icon('arrow-right', { size: 14 })}</button>
        </div>
        ${!isToday ? `<button class="fin-monthnav-v2__today" id="todayBtn">hoje</button>` : ''}
      </div>
      <div class="att-toolbar__group">
        <input type="text" id="expSearch" placeholder="Buscar descrição…" value="${escapeAttr(viewState.search)}" style="min-width: 200px;" />
      </div>
      <span class="att-toolbar__spacer"></span>
      <div class="att-toolbar__group">
        <span class="att-toolbar__label">ordenar</span>
        <select id="expSort">
          <option value="recent" ${viewState.sort === 'recent' ? 'selected' : ''}>mais recente</option>
          <option value="older"  ${viewState.sort === 'older'  ? 'selected' : ''}>mais antigo</option>
          <option value="high"   ${viewState.sort === 'high'   ? 'selected' : ''}>maior valor</option>
          <option value="low"    ${viewState.sort === 'low'    ? 'selected' : ''}>menor valor</option>
        </select>
      </div>
      <div class="att-view-toggle">
        <button data-layout="grid" class="${viewState.layout === 'grid' ? 'is-active' : ''}" aria-label="Cartas">
          ${icon('users', { size: 14 })}<span style="margin-left:4px;">cartas</span>
        </button>
        <button data-layout="list" class="${viewState.layout === 'list' ? 'is-active' : ''}" aria-label="Lista">
          ${icon('drag', { size: 14 })}<span style="margin-left:4px;">lista</span>
        </button>
      </div>
    </div>
  `;

  document.getElementById('prevMonthBtn').addEventListener('click', () => navigateMonth(-1));
  const nextBtn = document.getElementById('nextMonthBtn');
  if (!nextBtn.disabled) nextBtn.addEventListener('click', () => navigateMonth(+1));
  document.getElementById('todayBtn')?.addEventListener('click', () => {
    viewState.year = cur.year;
    viewState.month = cur.month;
    loadAll(cached.ctx);
  });
  document.getElementById('expSearch').addEventListener('input', (e) => {
    viewState.search = e.target.value;
    renderContent();
  });
  document.getElementById('expSort').addEventListener('change', (e) => {
    viewState.sort = e.target.value;
    renderContent();
  });
  document.querySelectorAll('.att-view-toggle button').forEach((btn) => {
    btn.addEventListener('click', () => {
      viewState.layout = btn.dataset.layout;
      renderToolbar();
      renderContent();
    });
  });
}

function navigateMonth(delta) {
  let y = viewState.year, m = viewState.month + delta;
  while (m < 1) { m += 12; y--; }
  while (m > 12) { m -= 12; y++; }
  viewState.year = y;
  viewState.month = m;
  loadAll(cached.ctx);
}

function renderContent() {
  const box = document.getElementById('expContent');
  if (!box) return;

  if (cached.rows.length === 0) {
    box.innerHTML = `
      <div class="fin-empty-v2">
        <div class="fin-empty-v2__art">${icon('trash', { size: 48 })}</div>
        <h3>Nenhum gasto neste mês</h3>
        <p>Quando registrar o primeiro gasto, ele aparece aqui em ordem cronológica.</p>
        <button class="btn btn--primary" id="emptyNewExpBtn">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Registrar primeiro</span></button>
      </div>
    `;
    document.getElementById('emptyNewExpBtn').addEventListener('click', () => openExpenseForm(null));
    return;
  }

  const q = viewState.search.toLowerCase().trim();
  let arr = cached.rows.filter((r) => {
    if (!viewState.activeCats.has(r.category)) return false;
    if (q) {
      const desc = (r.description || '').toLowerCase();
      const cat = (categoryLabel(r.category) || '').toLowerCase();
      if (!desc.includes(q) && !cat.includes(q)) return false;
    }
    return true;
  });
  arr.sort(sorter(viewState.sort));

  if (arr.length === 0) {
    box.innerHTML = `<div class="fin-no-results">
      <span>Nada por aqui</span>
      <p>nenhum gasto corresponde aos filtros atuais.</p>
    </div>`;
    return;
  }

  if (viewState.layout === 'grid') {
    box.innerHTML = `<div class="fin-exp-letter-grid">${arr.map(expLetter).join('')}</div>`;
  } else {
    box.innerHTML = `<div class="fin-exp-list-v2">${arr.map(expDense).join('')}</div>`;
  }
  wireRows();
}

function sorter(key) {
  switch (key) {
    case 'older': return (a, b) => (a.spent_on || '').localeCompare(b.spent_on || '') || Number(a.amount) - Number(b.amount);
    case 'high':  return (a, b) => Number(b.amount) - Number(a.amount);
    case 'low':   return (a, b) => Number(a.amount) - Number(b.amount);
    case 'recent':
    default:      return (a, b) => (b.spent_on || '').localeCompare(a.spent_on || '');
  }
}

function expLetter(e) {
  const cat = categoryById(e.category);
  const d = new Date(e.spent_on + 'T00:00:00');
  const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  const weekday = d.toLocaleDateString('pt-BR', { weekday: 'short' });
  const isExc = e.category === 'excepcionais';

  return `
    <article class="fin-exp-letter fin-exp-letter--${escapeAttr(e.category)}"
             data-id="${escapeAttr(e.id)}"
             data-cat="${escapeAttr(e.category)}">
      ${isExc ? `<span class="fin-exp-letter__seal">${icon('star', { size: 10 })}<span>excepcional</span></span>` : ''}
      <div class="fin-exp-letter__head">
        <span class="fin-exp-letter__icon">${categoryIconHtml(e.category, 20)}</span>
        <div class="fin-exp-letter__title">
          <p class="fin-exp-letter__eyebrow">${escapeHtml(cat?.label || e.category)}</p>
          <h3>${escapeHtml(brl(e.amount))}</h3>
        </div>
      </div>
      ${e.description
        ? `<p class="fin-exp-letter__desc">${escapeHtml(e.description)}</p>`
        : `<p class="fin-exp-letter__desc fin-exp-letter__desc--empty">sem descrição</p>`}
      <div class="fin-exp-letter__foot">
        <span class="fin-exp-letter__date">
          ${icon('calendar', { size: 11 })}
          <strong>${escapeHtml(dateStr)}</strong>
          <span>· ${escapeHtml(weekday)}</span>
        </span>
      </div>
      <div class="fin-exp-letter__menu">
        <button class="icon-btn icon-btn--xs" data-action="edit" title="Editar" aria-label="Editar">${icon('edit', { size: 12 })}</button>
        <button class="icon-btn icon-btn--xs" data-action="delete" title="Excluir" aria-label="Excluir">${icon('trash', { size: 12 })}</button>
      </div>
    </article>
  `;
}

function expDense(e) {
  const cat = categoryById(e.category);
  const d = new Date(e.spent_on + 'T00:00:00');
  const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `
    <div class="fin-exp-row-v2 fin-exp-row-v2--${escapeAttr(e.category)}"
         data-id="${escapeAttr(e.id)}"
         data-cat="${escapeAttr(e.category)}">
      <span class="fin-exp-row-v2__icon">${categoryIconHtml(e.category, 14)}</span>
      <div class="fin-exp-row-v2__main">
        <strong>${escapeHtml(cat?.label || e.category)}${e.category === 'excepcionais' ? ' · excepcional' : ''}</strong>
        <span>${e.description ? escapeHtml(e.description) : 'sem descrição'}</span>
      </div>
      <span class="fin-exp-row-v2__date">${escapeHtml(dateStr)}</span>
      <span class="fin-exp-row-v2__amount">${escapeHtml(brl(e.amount))}</span>
      <span class="fin-exp-row-v2__chevron">${icon('chevron', { size: 14 })}</span>
    </div>
  `;
}

function wireRows() {
  document.querySelectorAll('[data-id][data-cat]').forEach((row) => {
    const id = row.dataset.id;
    row.querySelector('[data-action="edit"]')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const exp = cached.rows.find((r) => r.id === id);
      if (exp) openExpenseForm(exp);
    });
    row.querySelector('[data-action="delete"]')?.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      if (!confirm('Excluir este gasto?')) return;
      const { error } = await data.deleteExpense(id);
      if (error) { toastError(error.message); return; }
      toastSuccess('Gasto excluído.');
      await loadAll(cached.ctx);
    });
    row.addEventListener('click', (ev) => {
      if (ev.target.closest('button')) return;
      const exp = cached.rows.find((r) => r.id === id);
      if (exp) openExpenseForm(exp);
    });
  });
}

// ============================================================
// Drawer com cards de categoria (paralelo att-just-cards)
// ============================================================

function openExpenseForm(existing) {
  document.querySelectorAll('.block-drawer-overlay').forEach((el) => el.remove());

  const isEdit = !!existing;
  let selectedCat = existing?.category || 'alimentacao';
  let livePreview = Number(existing?.amount || 0);

  const overlay = document.createElement('div');
  overlay.className = 'block-drawer-overlay';
  overlay.innerHTML = `
    <div class="block-drawer">
      <header class="block-drawer__head">
        <div>
          <p class="block-drawer__crumb">${isEdit ? 'Editando gasto' : 'Novo gasto'}</p>
          <h2><span class="block-drawer__icon">${icon('trash', { size: 24 })}</span> Registrar gasto</h2>
        </div>
        <button class="icon-btn" data-action="close" aria-label="Fechar">${icon('x', { size: 16 })}</button>
      </header>
      <form class="block-drawer__body" id="expenseForm">
        <div class="fin-amount-preview">
          <span class="fin-amount-preview__label">valor</span>
          <span class="fin-amount-preview__value" id="amountPreview">${escapeHtml(brl(livePreview))}</span>
        </div>

        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <label class="drawer-field" style="flex:1; min-width:160px;">
            <span class="drawer-field__label">Valor (R$)</span>
            <input type="number" step="0.01" min="0.01" name="amount" class="drawer-field__input" required value="${existing ? existing.amount : ''}" placeholder="0,00" id="amountInput" />
          </label>
          <label class="drawer-field" style="flex:1; min-width:160px;">
            <span class="drawer-field__label">Data</span>
            <input type="date" name="spent_on" class="drawer-field__input" required value="${escapeAttr(existing?.spent_on || new Date().toISOString().slice(0,10))}" />
          </label>
        </div>

        <label class="drawer-field">
          <span class="drawer-field__label">Categoria</span>
          <div class="fin-cat-cards" role="radiogroup" aria-label="Categoria de gasto">
            ${EXPENSE_CATEGORIES.map((c) => `
              <label class="fin-cat-card-pick fin-cat-card-pick--${c.id} ${selectedCat === c.id ? 'is-selected' : ''}" data-cat="${escapeAttr(c.id)}">
                <input type="radio" name="category" value="${c.id}" ${selectedCat === c.id ? 'checked' : ''} />
                <span class="fin-cat-card-pick__icon">${categoryIconHtml(c.id, 22)}</span>
                <span class="fin-cat-card-pick__label">${escapeHtml(c.label)}</span>
                ${c.hint ? `<span class="fin-cat-card-pick__hint">${escapeHtml(c.hint)}</span>` : ''}
              </label>
            `).join('')}
          </div>
        </label>

        <label class="drawer-field">
          <span class="drawer-field__label" id="descLabel">Descrição</span>
          <textarea name="description" class="drawer-field__input" rows="3" placeholder="O que foi gasto?" maxlength="500">${escapeHtml(existing?.description || '')}</textarea>
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

  // sync visual de categoria + label da descrição
  function syncCategoryUI() {
    overlay.querySelectorAll('.fin-cat-card-pick').forEach((el) => {
      const isSel = el.dataset.cat === selectedCat;
      el.classList.toggle('is-selected', isSel);
      const radio = el.querySelector('input[type="radio"]');
      if (radio) radio.checked = isSel;
    });
    const cat = categoryById(selectedCat);
    const label = overlay.querySelector('#descLabel');
    const hint = overlay.querySelector('#descHint');
    if (cat?.requiresDescription) {
      label.innerHTML = 'Descrição <span style="color: var(--danger-soft);">*</span>';
      hint.textContent = cat.hint || '';
    } else {
      label.textContent = 'Descrição (opcional)';
      hint.textContent = '';
    }
  }

  overlay.querySelectorAll('.fin-cat-card-pick').forEach((cardEl) => {
    cardEl.addEventListener('click', (ev) => {
      ev.preventDefault();
      selectedCat = cardEl.dataset.cat;
      syncCategoryUI();
    });
  });
  syncCategoryUI();

  // sync preview do valor em tempo real
  const amountInput = overlay.querySelector('#amountInput');
  const amountPreview = overlay.querySelector('#amountPreview');
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
      category: selectedCat,
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
    await loadAll(cached.ctx);
  }

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
      await loadAll(cached.ctx);
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
