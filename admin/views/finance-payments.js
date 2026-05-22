// Mensalidades — Sprint 2 (heatmap pessoa × mês + lista densa toggle + drawer mini).

import { icon } from '../icons.js';
import * as data from '../finance/data.js';
import { brl, brlCompact, currentMonth, monthLabel } from '../finance/format.js';
import { stampSeal, stampPage } from '../finance/seal.js';
import { renderFinanceNav } from './finance-nav.js';
import { toastSuccess, toastError } from '../toast.js';

const MONTH_SHORT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const HEATMAP_MONTHS = 6; // últimos 6 meses no heatmap

const viewState = {
  year: null,
  month: null,
  search: '',
  sort: 'name', // name | pct_low | pct_high | pending
  layout: 'heatmap', // heatmap | list
};

let cached = null;

export async function renderFinancePayments(ctx) {
  const { root } = ctx;
  if (viewState.year == null) {
    const cur = currentMonth();
    viewState.year = cur.year;
    viewState.month = cur.month;
  }

  root.innerHTML = `
    <div class="view">
      ${renderFinanceNav('mensalidades')}

      <header class="fin-hero-v2">
        <div class="fin-hero-v2__seal-wrap">
          <span class="fin-seal">${stampSeal({ size: 32 })}</span>
        </div>
        <div class="fin-hero-v2__inner">
          <p class="fin-hero-v2__eyebrow">mensalidades · livro-caixa</p>
          <h1>Mensalidades</h1>
          <p class="fin-hero-v2__lede">
            Clique em qualquer célula pra marcar pago ou pendente. <strong>Ouro</strong> = pago, <strong>vermelho</strong> = pendente, <strong>traço</strong> = isenta. Pessoas com valor individual seguem o próprio.
          </p>
        </div>
        <div class="fin-hero-v2__page">${stampPage({ size: 200 })}</div>
      </header>

      <div id="duesBar"></div>

      <div class="fin-pane-v2" style="margin-bottom: 14px;">
        <div id="paymentsToolbar"></div>
        <div id="paymentsContent">
          <div class="fin-loading-wrap">
            <span class="fin-bloom"><span class="fin-seal">${stampSeal({ size: 24 })}</span></span>
            <p>Abrindo o livro-caixa…</p>
          </div>
        </div>
        <div id="paymentsLegend" hidden>
          <div class="fin-heatmap__legend">
            <span class="fin-heatmap__legend-item"><span class="fin-heatmap__legend-swatch fin-heatmap__legend-swatch--paid"></span>pago</span>
            <span class="fin-heatmap__legend-item"><span class="fin-heatmap__legend-swatch fin-heatmap__legend-swatch--pending"></span>pendente</span>
            <span class="fin-heatmap__legend-item"><span class="fin-heatmap__legend-swatch fin-heatmap__legend-swatch--late"></span>em atraso</span>
            <span class="fin-heatmap__legend-item"><span class="fin-heatmap__legend-swatch fin-heatmap__legend-swatch--exempt"></span>isenta / futuro</span>
          </div>
        </div>
      </div>
    </div>
  `;

  await loadAll(ctx);
}

async function loadAll(ctx) {
  const cur = currentMonth();
  const lastYear = viewState.year;
  const lastMonth = viewState.month;

  // calcular ano range pra cobrir os últimos HEATMAP_MONTHS meses
  const months = lastNMonths(lastYear, lastMonth, HEATMAP_MONTHS);
  const years = [...new Set(months.map((m) => m.year))];
  const minY = Math.min(...years);
  const maxY = Math.max(...years);

  const [{ data: dues }, { data: people }, { data: allPayments }, { data: allDues }] = await Promise.all([
    data.getMonthlyDues(lastYear, lastMonth),
    data.listPayingPeople(),
    data.listPaymentsRange({ fromYear: minY, toYear: maxY }),
    data.listDuesRange({ fromYear: minY, toYear: maxY }),
  ]);

  const defaultDues = Number(dues?.amount || 0);

  // index pagamentos por (year, month, person_id)
  const payIdx = new Map();
  for (const p of (allPayments || [])) {
    payIdx.set(`${p.year}-${p.month}-${p.person_id}`, p);
  }

  // index dues padrão por (year, month)
  const duesIdx = new Map();
  for (const d of (allDues || [])) {
    duesIdx.set(`${d.year}-${d.month}`, Number(d.amount || 0));
  }

  cached = {
    ctx,
    people: people || [],
    months,
    payIdx,
    duesIdx,
    defaultDues,
    currentYear: cur.year,
    currentMonth: cur.month,
    lastYear,
    lastMonth,
  };

  renderDuesBar();
  renderToolbar();
  renderContent();
}

function renderDuesBar() {
  const box = document.getElementById('duesBar');
  if (!box) return;
  box.innerHTML = `
    <div class="fin-dues-bar-v2">
      <div class="fin-dues-bar-v2__label">
        <span class="fin-dues-bar-v2__label-eyebrow">valor padrão</span>
        <span class="fin-dues-bar-v2__label-main">mensalidade de ${escapeHtml(monthLabel(viewState.year, viewState.month))}</span>
      </div>
      <div class="fin-dues-bar-v2__input-wrap">
        <span class="fin-dues-bar-v2__prefix">R$</span>
        <input type="number" step="0.01" min="0" id="duesInput" class="fin-dues-bar-v2__input" value="${cached.defaultDues}" />
      </div>
      <span class="fin-dues-bar-v2__status" id="duesStatus"></span>
      <span class="fin-dues-bar-v2__hint">pessoas com valor próprio seguem o seu</span>
    </div>
  `;
  document.getElementById('duesInput').addEventListener('change', async (ev) => {
    const v = Number(ev.target.value) || 0;
    const status = document.getElementById('duesStatus');
    status.textContent = 'salvando…';
    const { error } = await data.setMonthlyDues(viewState.year, viewState.month, v);
    if (error) { status.textContent = `erro: ${error.message}`; return; }
    status.innerHTML = `${icon('check', { size: 11 })} <span style="margin-left:4px;">salvo</span>`;
    setTimeout(() => { status.textContent = ''; }, 1500);
    toastSuccess(`Mensalidade ajustada pra ${brl(v)}.`);
    cached.defaultDues = v;
    cached.duesIdx.set(`${viewState.year}-${viewState.month}`, v);
    renderContent();
  });
}

function renderToolbar() {
  const box = document.getElementById('paymentsToolbar');
  if (!box) return;

  // navegação de mês: nav só desativa "próximo" quando passar do mês atual
  const cur = currentMonth();
  const isFuture = (viewState.year > cur.year) || (viewState.year === cur.year && viewState.month >= cur.month);

  box.innerHTML = `
    <div class="att-toolbar" style="margin-bottom: 16px;">
      <div class="att-toolbar__group">
        <div class="fin-monthnav-v2">
          <button class="fin-monthnav-v2__arrow" id="prevMonthBtn" aria-label="Mês anterior">${icon('arrow-left', { size: 14 })}</button>
          <span class="fin-monthnav-v2__label">${escapeHtml(monthLabel(viewState.year, viewState.month))}</span>
          <button class="fin-monthnav-v2__arrow" id="nextMonthBtn" aria-label="Próximo mês" ${isFuture ? 'disabled' : ''}>${icon('arrow-right', { size: 14 })}</button>
        </div>
        ${!(viewState.year === cur.year && viewState.month === cur.month) ? `
          <button class="fin-monthnav-v2__today" id="todayBtn">hoje</button>
        ` : ''}
      </div>
      <div class="att-toolbar__group">
        <input type="text" id="paySearch" placeholder="Buscar pessoa…" value="${escapeAttr(viewState.search)}" style="min-width: 200px;" />
      </div>
      <span class="att-toolbar__spacer"></span>
      <div class="att-toolbar__group">
        <span class="att-toolbar__label">ordenar</span>
        <select id="paySort">
          <option value="name" ${viewState.sort === 'name' ? 'selected' : ''}>nome</option>
          <option value="pending" ${viewState.sort === 'pending' ? 'selected' : ''}>pendentes primeiro</option>
          <option value="pct_low" ${viewState.sort === 'pct_low' ? 'selected' : ''}>menor % pago</option>
          <option value="pct_high" ${viewState.sort === 'pct_high' ? 'selected' : ''}>maior % pago</option>
        </select>
      </div>
      <div class="att-view-toggle">
        <button data-layout="heatmap" class="${viewState.layout === 'heatmap' ? 'is-active' : ''}" aria-label="Heatmap">
          ${icon('attendance', { size: 14 })}<span style="margin-left:4px;">mapa</span>
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
  document.getElementById('paySearch').addEventListener('input', (e) => {
    viewState.search = e.target.value;
    renderContent();
  });
  document.getElementById('paySort').addEventListener('change', (e) => {
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
  const box = document.getElementById('paymentsContent');
  if (!box) return;
  const legend = document.getElementById('paymentsLegend');

  const people = filteredSortedPeople();

  if (cached.people.length === 0) {
    if (legend) legend.hidden = true;
    box.innerHTML = `
      <div class="fin-empty-v2">
        <div class="fin-empty-v2__art">${icon('users', { size: 52 })}</div>
        <h3>Nenhuma pessoa pagante cadastrada</h3>
        <p>Cadastre em <strong>Secretaria → Pessoas</strong>. Pessoas isentas não aparecem aqui.</p>
      </div>
    `;
    return;
  }

  if (people.length === 0) {
    if (legend) legend.hidden = true;
    box.innerHTML = `<div class="fin-no-results">
      <span>Nada por aqui</span>
      <p>nenhuma pessoa corresponde aos filtros atuais.</p>
    </div>`;
    return;
  }

  if (viewState.layout === 'heatmap') {
    box.innerHTML = renderHeatmap(people);
    if (legend) legend.hidden = false;
    wireHeatmap();
  } else {
    box.innerHTML = renderList(people);
    if (legend) legend.hidden = true;
    wireList();
  }
}

function filteredSortedPeople() {
  const q = viewState.search.toLowerCase().trim();
  let arr = cached.people.filter((p) => {
    if (!q) return true;
    const name = (p.full_name || '').toLowerCase();
    const email = (p.email || '').toLowerCase();
    const phone = (p.phone || '').toLowerCase();
    return name.includes(q) || email.includes(q) || phone.includes(q);
  });

  arr.sort((a, b) => {
    if (viewState.sort === 'pending') {
      const ap = isPaidInCurrent(a) ? 1 : 0;
      const bp = isPaidInCurrent(b) ? 1 : 0;
      if (ap !== bp) return ap - bp;
    } else if (viewState.sort === 'pct_low') {
      const pa = pctPaidRange(a);
      const pb = pctPaidRange(b);
      if (pa !== pb) return pa - pb;
    } else if (viewState.sort === 'pct_high') {
      const pa = pctPaidRange(a);
      const pb = pctPaidRange(b);
      if (pa !== pb) return pb - pa;
    }
    return (a.full_name || '').localeCompare(b.full_name || '', 'pt-BR');
  });
  return arr;
}

function isPaidInCurrent(person) {
  const key = `${viewState.year}-${viewState.month}-${person.id}`;
  return !!cached.payIdx.get(key)?.paid;
}

function pctPaidRange(person) {
  let total = 0, paid = 0;
  for (const m of cached.months) {
    total++;
    const p = cached.payIdx.get(`${m.year}-${m.month}-${person.id}`);
    if (p?.paid) paid++;
  }
  return total > 0 ? Math.round(paid / total * 100) : 0;
}

// ---------- heatmap ----------
function renderHeatmap(people) {
  const months = cached.months;
  const headerMonths = months.map((m) => {
    const isCurr = m.year === cached.currentYear && m.month === cached.currentMonth;
    return `<div class="fin-heatmap__month ${isCurr ? 'is-current' : ''}">
      <strong>${MONTH_SHORT[m.month - 1]}</strong>
      <span>${String(m.year).slice(-2)}</span>
    </div>`;
  }).join('');

  const rows = people.map((person) => {
    const monogram = monogramOf(person.full_name);
    const pct = pctPaidRange(person);
    const pctClass = person.is_exempt ? 'exempt'
      : pct >= 80 ? 'ok'
      : pct >= 60 ? 'mid'
      : pct >= 40 ? 'low'
      : 'bad';
    const pctLabel = person.is_exempt ? 'isenta' : `${pct}%`;

    const cells = months.map((m) => {
      return cellHtml(person, m);
    }).join('');

    return `<div class="fin-heatmap__row">
      <div class="fin-heatmap__name">
        <span class="fin-heatmap__name-mono" aria-hidden="true">${escapeHtml(monogram)}</span>
        <strong title="${escapeAttr(person.full_name)}">${escapeHtml(person.full_name || '—')}</strong>
        <span class="fin-heatmap__name-pct fin-heatmap__name-pct--${pctClass}">${pctLabel}</span>
      </div>
      <div class="fin-heatmap__cells">${cells}</div>
    </div>`;
  }).join('');

  return `
    <div class="fin-heatmap">
      <div class="fin-heatmap__header">
        <span class="muted" style="font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;">pessoa · % pago</span>
        <div class="fin-heatmap__header-months">${headerMonths}</div>
      </div>
      ${rows}
    </div>
  `;
}

function cellHtml(person, m) {
  const key = `${m.year}-${m.month}-${person.id}`;
  const pay = cached.payIdx.get(key);
  const cur = currentMonth();
  const isFuture = (m.year > cur.year) || (m.year === cur.year && m.month > cur.month);
  const isPast = (m.year < cur.year) || (m.year === cur.year && m.month < cur.month);
  const monthLab = `${MONTH_SHORT[m.month - 1]}/${String(m.year).slice(-2)}`;

  if (person.is_exempt) {
    return `<span class="fin-heatmap__cell fin-heatmap__cell--exempt" data-tooltip="${escapeAttr(person.full_name)} · ${monthLab} · isenta"></span>`;
  }
  if (isFuture) {
    return `<span class="fin-heatmap__cell fin-heatmap__cell--future" data-tooltip="${escapeAttr(person.full_name)} · ${monthLab} · futuro"></span>`;
  }

  const amount = pay?.amount != null ? Number(pay.amount)
              : person.custom_dues != null ? Number(person.custom_dues)
              : (cached.duesIdx.get(`${m.year}-${m.month}`) || cached.defaultDues);

  if (pay?.paid) {
    const paidAt = pay.paid_at ? new Date(pay.paid_at + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
    const tip = `${person.full_name} · ${monthLab} · pago${paidAt ? ' em ' + paidAt : ''} · ${brl(amount)}`;
    return `<button class="fin-heatmap__cell fin-heatmap__cell--paid"
      data-person-id="${escapeAttr(person.id)}"
      data-year="${m.year}"
      data-month="${m.month}"
      data-status="paid"
      data-tooltip="${escapeAttr(tip)}">${brlCompact(amount).replace('R$ ', '')}</button>`;
  }

  // não pago — pendente; se é mês passado, conta como atrasado
  const cls = isPast ? 'late' : 'pending';
  const tip = `${person.full_name} · ${monthLab} · ${isPast ? 'em atraso' : 'pendente'} · ${brl(amount)}`;
  return `<button class="fin-heatmap__cell fin-heatmap__cell--${cls}"
    data-person-id="${escapeAttr(person.id)}"
    data-year="${m.year}"
    data-month="${m.month}"
    data-status="${cls}"
    data-tooltip="${escapeAttr(tip)}"></button>`;
}

function wireHeatmap() {
  document.querySelectorAll('.fin-heatmap__cell[data-person-id]').forEach((cell) => {
    cell.addEventListener('click', () => {
      const personId = cell.dataset.personId;
      const year = Number(cell.dataset.year);
      const month = Number(cell.dataset.month);
      openCellDrawer({ personId, year, month });
    });
  });
}

// ---------- lista densa ----------
function renderList(people) {
  return `
    <div class="fin-pay-list-v2">
      ${people.map((p) => listRow(p)).join('')}
    </div>
  `;
}

function listRow(person) {
  const key = `${viewState.year}-${viewState.month}-${person.id}`;
  const pay = cached.payIdx.get(key);
  const isPaid = !!pay?.paid;
  const monogram = monogramOf(person.full_name);
  const amount = pay?.amount != null ? Number(pay.amount)
              : person.custom_dues != null ? Number(person.custom_dues)
              : cached.defaultDues;
  const hasCustom = person.custom_dues != null;
  const paidAt = pay?.paid_at ? new Date(pay.paid_at + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : null;

  return `
    <div class="fin-pay-row-v2 ${isPaid ? 'is-paid' : ''}"
         data-person-id="${escapeAttr(person.id)}"
         data-amount="${amount}">
      <span class="fin-pay-row-v2__mono" aria-hidden="true">${escapeHtml(monogram)}</span>
      <div class="fin-pay-row-v2__main">
        <strong>${escapeHtml(person.full_name || '—')}</strong>
        <span>${hasCustom ? 'valor próprio' : 'padrão do mês'}${person.email ? ' · ' + escapeHtml(person.email) : ''}</span>
      </div>
      <span class="${isPaid ? 'fin-pill-v2 fin-pill-v2--gold' : 'fin-pill-v2 fin-pill-v2--rose-late'}">
        ${isPaid ? icon('check', { size: 11 }) : icon('clock', { size: 11 })}
        <span style="margin-left:4px;">${isPaid ? 'pago' : 'pendente'}</span>
      </span>
      <span class="fin-pay-row-v2__amount">${escapeHtml(brl(amount))}</span>
      <span class="fin-pay-row-v2__date">${paidAt ? `em ${paidAt}` : '—'}</span>
    </div>
  `;
}

function wireList() {
  document.querySelectorAll('.fin-pay-row-v2[data-person-id]').forEach((row) => {
    row.addEventListener('click', () => {
      openCellDrawer({
        personId: row.dataset.personId,
        year: viewState.year,
        month: viewState.month,
      });
    });
  });
}

// ---------- drawer mini ----------
function openCellDrawer({ personId, year, month }) {
  const person = cached.people.find((p) => p.id === personId);
  if (!person) return;
  const key = `${year}-${month}-${personId}`;
  const pay = cached.payIdx.get(key);
  const isPaid = !!pay?.paid;
  const amount = pay?.amount != null ? Number(pay.amount)
              : person.custom_dues != null ? Number(person.custom_dues)
              : (cached.duesIdx.get(`${year}-${month}`) || cached.defaultDues);

  document.querySelectorAll('.fin-cell-drawer-overlay').forEach((el) => el.remove());

  const overlay = document.createElement('div');
  overlay.className = 'fin-cell-drawer-overlay';
  overlay.innerHTML = `
    <div class="fin-cell-drawer">
      <header class="fin-cell-drawer__head">
        <p class="fin-cell-drawer__crumb">${escapeHtml(monthLabel(year, month))}</p>
        <h2><span style="font-family: 'Cormorant Garamond', serif; font-style: italic;">${escapeHtml(person.full_name)}</span></h2>
        <button class="icon-btn fin-cell-drawer__close" data-action="close" aria-label="Fechar">${icon('x', { size: 16 })}</button>
      </header>
      <div class="fin-cell-drawer__body">
        <div class="fin-cell-drawer__amount">
          <span class="fin-cell-drawer__amount-label">valor</span>
          <span class="fin-cell-drawer__amount-value">${escapeHtml(brl(amount))}</span>
          ${person.custom_dues != null ? '<span class="fin-pill-v2 fin-pill-v2--gold" style="margin-left: auto;">individual</span>' : ''}
        </div>
        <div class="fin-cell-drawer__actions">
          <button class="fin-cell-drawer__action ${isPaid ? 'is-current' : ''}" data-target="paid" ${isPaid ? 'disabled' : ''}>
            <span class="fin-cell-drawer__action-icon">${icon('check-circle', { size: 20 })}</span>
            <span><strong>marcar pago</strong></span>
          </button>
          <button class="fin-cell-drawer__action ${!isPaid ? 'is-current' : ''}" data-target="pending" ${!isPaid ? 'disabled' : ''}>
            <span class="fin-cell-drawer__action-icon">${icon('x-circle', { size: 20 })}</span>
            <span><strong>marcar pendente</strong></span>
          </button>
        </div>
      </div>
      <footer class="fin-cell-drawer__foot">
        <button class="btn btn--ghost btn--small" data-action="close">Fechar</button>
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

  overlay.addEventListener('click', async (ev) => {
    if (ev.target === overlay) return close();
    const closeAction = ev.target.closest('[data-action="close"]');
    if (closeAction) return close();

    const actionBtn = ev.target.closest('[data-target]');
    if (!actionBtn || actionBtn.disabled) return;
    const target = actionBtn.dataset.target;
    const wantPaid = target === 'paid';

    actionBtn.disabled = true;
    const { error } = await data.markPayment({
      person_id: personId,
      year, month,
      paid: wantPaid,
      amount: wantPaid ? amount : null,
      paid_at: wantPaid ? new Date().toISOString().slice(0, 10) : null,
    });
    if (error) {
      toastError(error.message);
      actionBtn.disabled = false;
      return;
    }
    // atualizar cache local
    cached.payIdx.set(key, {
      person_id: personId, year, month,
      paid: wantPaid,
      amount: wantPaid ? amount : null,
      paid_at: wantPaid ? new Date().toISOString().slice(0, 10) : null,
    });
    toastSuccess(wantPaid ? `${person.full_name} marcada como paga em ${monthLabel(year, month)}.` : `Pagamento removido.`);
    close();
    renderContent();
  });
}

// ---------- utils ----------
function lastNMonths(year, month, n) {
  const arr = [];
  let y = year, m = month;
  for (let i = 0; i < n; i++) {
    arr.unshift({ year: y, month: m });
    m--;
    if (m < 1) { m = 12; y--; }
  }
  return arr;
}

function monogramOf(name) {
  if (!name) return '·';
  const cleaned = String(name).trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    return ((parts[0][0] || '') + (parts[parts.length - 1][0] || '')).toUpperCase();
  }
  return (cleaned[0] || '·').toUpperCase();
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
