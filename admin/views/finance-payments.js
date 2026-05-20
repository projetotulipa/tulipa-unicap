// Planilha de mensalidades — pessoa × switch pago/não pago.

import { icon } from '../icons.js';
import * as data from '../finance/data.js';
import { brl, currentMonth, monthLabel } from '../finance/format.js';
import { avatarHtml } from '../avatar.js';
import { renderFinanceNav } from './finance-nav.js';
import { toastSuccess, toastError } from '../toast.js';

let viewYear, viewMonth;

export async function renderFinancePayments(ctx) {
  const { root } = ctx;
  if (!viewYear) ({ year: viewYear, month: viewMonth } = currentMonth());

  root.innerHTML = `
    <div class="view">
      ${renderFinanceNav('mensalidades')}

      <header class="view__header" style="display:flex; align-items:flex-end; justify-content:space-between; gap:14px; flex-wrap:wrap;">
        <div>
          <h1>Mensalidades · ${escapeHtml(monthLabel(viewYear, viewMonth))}</h1>
          <p class="view__lede">Ligue o switch quando uma pessoa pagar. O valor padrão pode ser ajustado abaixo — pessoas com valor individual seguem o próprio.</p>
        </div>
        <div class="fin-monthnav">
          <button class="icon-btn" id="prevMonthBtn" title="Mês anterior">${icon('arrow-left', { size: 14 })}</button>
          <span class="fin-monthnav__label">${escapeHtml(monthLabel(viewYear, viewMonth))}</span>
          <button class="icon-btn" id="nextMonthBtn" title="Próximo mês">${icon('arrow-right', { size: 14 })}</button>
        </div>
      </header>

      <div id="duesBar" class="fin-dues-bar">
        <div class="skel skel--block" style="height:60px;"></div>
      </div>

      <div class="search-bar" style="margin-top: 18px;">
        <span class="search-bar__icon">${icon('search', { size: 16 })}</span>
        <input type="text" id="paySearch" placeholder="Buscar pessoa…" />
      </div>

      <div id="paymentsList" class="empty-state">
        <div class="skel skel--block"></div>
      </div>
    </div>
  `;

  document.getElementById('prevMonthBtn').addEventListener('click', () => navigateMonth(ctx, -1));
  document.getElementById('nextMonthBtn').addEventListener('click', () => navigateMonth(ctx, +1));
  document.getElementById('paySearch').addEventListener('input', applySearch);

  await loadAll();
}

function navigateMonth(ctx, delta) {
  let y = viewYear, m = viewMonth + delta;
  while (m < 1) { m += 12; y--; }
  while (m > 12) { m -= 12; y++; }
  viewYear = y; viewMonth = m;
  renderFinancePayments(ctx);
}

async function loadAll() {
  const [{ data: dues }, { data: payments }, { data: people }] = await Promise.all([
    data.getMonthlyDues(viewYear, viewMonth),
    data.listMonthlyPayments(viewYear, viewMonth),
    data.listPayingPeople(),
  ]);

  const defaultDues = Number(dues?.amount || 0);

  // dues bar
  document.getElementById('duesBar').innerHTML = `
    <label class="fin-dues-label">
      <span>Valor padrão da mensalidade em ${escapeHtml(monthLabel(viewYear, viewMonth))}</span>
      <div class="fin-dues-input">
        <span class="fin-dues-prefix">R$</span>
        <input type="number" step="0.01" min="0" id="duesInput" value="${defaultDues}" />
      </div>
      <span class="muted" id="duesStatus"></span>
    </label>
  `;
  document.getElementById('duesInput').addEventListener('change', async (ev) => {
    const v = Number(ev.target.value) || 0;
    const status = document.getElementById('duesStatus');
    status.textContent = 'salvando…';
    const { error } = await data.setMonthlyDues(viewYear, viewMonth, v);
    if (error) { status.textContent = `erro: ${error.message}`; return; }
    status.innerHTML = `${icon('check', { size: 11 })} salvo`;
    setTimeout(() => { status.textContent = ''; }, 1500);
    toastSuccess(`Mensalidade ajustada pra ${brl(v)}.`);
    // recalcular linhas
    for (const li of document.querySelectorAll('.fin-pay-row')) {
      const personId = li.dataset.personId;
      const person = (people || []).find((p) => p.id === personId);
      const valEl = li.querySelector('[data-role="value"]');
      const effective = person?.custom_dues != null ? Number(person.custom_dues) : v;
      if (valEl) valEl.textContent = brl(effective);
      li.dataset.amount = effective;
    }
  });

  // lista
  const box = document.getElementById('paymentsList');
  if (!people?.length) {
    box.innerHTML = `<p class="muted">Nenhuma pessoa ativa pagante cadastrada. Cadastre em Presença → Pessoas.</p>`;
    return;
  }
  const payMap = new Map((payments || []).map((p) => [p.person_id, p]));
  box.className = '';
  box.innerHTML = `<ul class="fin-pay-list">${people.map((p) => payRow(p, payMap.get(p.id), defaultDues)).join('')}</ul>`;
  wireRows();
}

function payRow(person, pay, defaultDues) {
  const isPaid = !!pay?.paid;
  const effective = person.custom_dues != null ? Number(person.custom_dues) : defaultDues;
  const hasCustom = person.custom_dues != null;
  return `
    <li class="fin-pay-row ${isPaid ? 'is-paid' : ''}"
        data-person-id="${escapeAttr(person.id)}"
        data-name="${escapeAttr(person.full_name)}"
        data-amount="${effective}">
      <div class="fin-pay-row__person">
        ${avatarHtml(person.full_name, { size: 'md' })}
        <div>
          <strong>${escapeHtml(person.full_name)}</strong>
          ${person.email ? `<span class="muted">${escapeHtml(person.email)}</span>` : ''}
        </div>
      </div>
      <div class="fin-pay-row__amount">
        <span data-role="value">${escapeHtml(brl(effective))}</span>
        ${hasCustom ? '<span class="pill pill--gold" style="margin-left:8px;">individual</span>' : ''}
      </div>
      <label class="att-switch">
        <input type="checkbox" data-action="toggle-paid" ${isPaid ? 'checked' : ''} />
        <span class="att-switch__track">
          <span class="att-switch__thumb">
            <span class="att-switch__icon-check">${icon('check', { size: 12 })}</span>
          </span>
        </span>
        <span class="att-switch__label">${isPaid ? 'pago' : 'não pago'}</span>
      </label>
    </li>
  `;
}

function wireRows() {
  document.querySelectorAll('.fin-pay-row').forEach((row) => {
    const sw = row.querySelector('[data-action="toggle-paid"]');
    sw.addEventListener('change', async () => {
      const isPaid = sw.checked;
      const lab = row.querySelector('.att-switch__label');
      row.classList.toggle('is-paid', isPaid);
      lab.textContent = isPaid ? 'pago' : 'não pago';
      const amount = Number(row.dataset.amount || 0);
      const { error } = await data.markPayment({
        person_id: row.dataset.personId,
        year: viewYear,
        month: viewMonth,
        paid: isPaid,
        amount: isPaid ? amount : null,
        paid_at: isPaid ? new Date().toISOString().slice(0, 10) : null,
      });
      if (error) {
        toastError(error.message);
        sw.checked = !isPaid;
        row.classList.toggle('is-paid', !isPaid);
        lab.textContent = !isPaid ? 'pago' : 'não pago';
      }
    });
  });
}

function applySearch(ev) {
  const q = ev.target.value.toLowerCase().trim();
  for (const row of document.querySelectorAll('.fin-pay-row')) {
    const name = (row.dataset.name || '').toLowerCase();
    row.hidden = q && !name.includes(q);
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
