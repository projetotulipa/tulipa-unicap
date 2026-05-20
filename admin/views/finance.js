// Dashboard de tesouraria — saldo, arrecadado vs gasto, pendências, planos.

import { icon } from '../icons.js';
import * as data from '../finance/data.js';
import { brl, currentMonth, monthLabel, isoMonthRange } from '../finance/format.js';
import { EXPENSE_CATEGORIES, categoryById, categoryIconHtml, categoryLabel } from '../finance/categories.js';
import { renderFinanceNav } from './finance-nav.js';

export async function renderFinanceDashboard(ctx) {
  const { root } = ctx;
  const { year, month } = currentMonth();
  const { from, to } = isoMonthRange(year, month);

  root.innerHTML = `
    <div class="view">
      ${renderFinanceNav('dashboard')}

      <header class="att-hero">
        <div>
          <p class="att-hero__eyebrow">tesouraria · ${escapeHtml(monthLabel(year, month))}</p>
          <h1>Visão geral</h1>
          <p class="view__lede">Acompanhe entradas, gastos e saldo do mês corrente, e o que está planejado pra frente.</p>
        </div>
      </header>

      <section class="att-stats" id="financeStats">
        ${skel()}${skel()}${skel()}${skel()}
      </section>

      <section class="att-row">
        <div class="att-pane">
          <header class="att-pane__head">
            <span class="att-pane__icon">${icon('alert', { size: 18 })}</span>
            <h2>Pendências</h2>
            <p class="att-pane__hint">pessoas que ainda não pagaram</p>
          </header>
          <div id="finPendencias" class="att-pane__body">
            <div class="skel skel--block"></div>
          </div>
        </div>

        <div class="att-pane">
          <header class="att-pane__head">
            <span class="att-pane__icon">${icon('attendance', { size: 18 })}</span>
            <h2>Gastos por categoria</h2>
          </header>
          <div id="finByCategory" class="att-pane__body">
            <div class="skel skel--block"></div>
          </div>
        </div>
      </section>

      <section class="att-pane att-pane--full">
        <header class="att-pane__head">
          <span class="att-pane__icon">${icon('spark', { size: 18 })}</span>
          <h2>Planos ativos</h2>
          <p class="att-pane__hint">objetivos financeiros em aberto</p>
        </header>
        <div id="finPlans" class="att-pane__body">
          <div class="skel skel--block"></div>
        </div>
      </section>
    </div>
  `;

  await loadAll(year, month, from, to);
}

function skel() { return `<div class="att-stat att-stat--skel"><div class="skel" style="height:70px;"></div></div>`; }

async function loadAll(year, month, from, to) {
  const [
    { data: dues }, { data: payments },
    { data: expensesAgg }, { data: people }, { data: plans }
  ] = await Promise.all([
    data.getMonthlyDues(year, month),
    data.listMonthlyPayments(year, month),
    data.sumExpensesByCategory({ from, to }),
    data.listPayingPeople(),
    data.listPlans({ includeCompleted: false }),
  ]);

  const defaultDues = Number(dues?.amount || 0);
  const totalPeople = people?.length || 0;

  // arrecadado = soma dos pagamentos com paid=true (usa amount ou custom_dues ou default)
  let arrecadado = 0;
  let paidCount = 0;
  const payMap = new Map((payments || []).map((p) => [p.person_id, p]));
  for (const person of (people || [])) {
    const pay = payMap.get(person.id);
    if (pay?.paid) {
      const v = pay.amount != null ? Number(pay.amount)
              : person.custom_dues != null ? Number(person.custom_dues)
              : defaultDues;
      arrecadado += v;
      paidCount++;
    }
  }
  const pending = totalPeople - paidCount;
  const totalGastos = expensesAgg?.total || 0;
  const saldoMes = arrecadado - totalGastos;

  document.getElementById('financeStats').innerHTML = `
    ${statCard(icon('check-circle', { size: 20 }), brl(arrecadado), 'arrecadado no mês', 'success')}
    ${statCard(icon('trash', { size: 20 }), brl(totalGastos), 'gastos no mês', totalGastos > arrecadado ? 'danger' : null)}
    ${statCard(icon('spark', { size: 20 }), brl(saldoMes), 'saldo do mês', saldoMes >= 0 ? 'success' : 'danger')}
    ${statCard(icon('users', { size: 20 }), `${paidCount}/${totalPeople}`, paidCount === totalPeople ? 'todos pagaram' : 'pagamentos confirmados', paidCount === totalPeople ? 'success' : pending > totalPeople / 2 ? 'warning' : null)}
  `;

  // pendências
  const pendentes = (people || []).filter((p) => !payMap.get(p.id)?.paid);
  const pBox = document.getElementById('finPendencias');
  if (pendentes.length === 0) {
    pBox.innerHTML = `
      <div class="att-empty att-empty--ok" style="padding: 22px 18px;">
        <div class="att-empty__art">${icon('check-circle', { size: 36 })}</div>
        <p>Ninguém deve nada este mês.</p>
      </div>
    `;
  } else {
    pBox.innerHTML = `
      <ul class="fin-list">
        ${pendentes.slice(0, 8).map((p) => {
          const v = p.custom_dues != null ? Number(p.custom_dues) : defaultDues;
          return `
            <li class="fin-list-item">
              <strong>${escapeHtml(p.full_name)}</strong>
              <span class="muted">${escapeHtml(brl(v))}</span>
            </li>
          `;
        }).join('')}
        ${pendentes.length > 8 ? `<li class="muted" style="padding: 6px 0;">+ ${pendentes.length - 8} pessoa${pendentes.length - 8 === 1 ? '' : 's'}</li>` : ''}
      </ul>
      <a class="btn btn--ghost btn--small" href="#/financeiro/mensalidades" style="margin-top: 12px;">
        Abrir planilha de mensalidades ${icon('arrow-right', { size: 12 })}
      </a>
    `;
  }

  // gastos por categoria
  const catBox = document.getElementById('finByCategory');
  const byCat = expensesAgg?.byCategory || {};
  const totalAll = expensesAgg?.total || 0;
  if (totalAll === 0) {
    catBox.innerHTML = `<p class="muted">Nenhum gasto registrado este mês.</p>`;
  } else {
    catBox.innerHTML = `
      <ul class="fin-cat-list">
        ${EXPENSE_CATEGORIES.map((c) => {
          const v = byCat[c.id] || 0;
          const pct = totalAll > 0 ? Math.round((v / totalAll) * 100) : 0;
          return `
            <li class="fin-cat-row">
              <span class="fin-cat-row__icon">${categoryIconHtml(c.id, 14)}</span>
              <strong>${escapeHtml(c.label)}</strong>
              <span class="fin-cat-row__bar"><span style="width:${pct}%"></span></span>
              <span class="fin-cat-row__val">${escapeHtml(brl(v))}</span>
            </li>
          `;
        }).join('')}
      </ul>
    `;
  }

  // planos
  const planBox = document.getElementById('finPlans');
  if (!plans?.length) {
    planBox.innerHTML = `
      <div class="att-empty">
        <div class="att-empty__art">${icon('spark', { size: 36 })}</div>
        <p>Nenhum plano financeiro registrado.</p>
        <a class="btn btn--ghost btn--small" href="#/financeiro/planejamento">criar primeiro plano</a>
      </div>
    `;
  } else {
    planBox.innerHTML = `
      <ul class="fin-list">
        ${plans.slice(0, 6).map((pl) => `
          <li class="fin-list-item">
            <div>
              <strong>${escapeHtml(pl.title)}</strong>
              ${pl.description ? `<span class="muted" style="display:block; font-size:12px;">${escapeHtml(pl.description.slice(0, 80))}${pl.description.length > 80 ? '…' : ''}</span>` : ''}
            </div>
            ${pl.estimated_amount != null ? `<span class="muted">${escapeHtml(brl(pl.estimated_amount))}</span>` : ''}
          </li>
        `).join('')}
      </ul>
    `;
  }
}

function statCard(iconHtml, value, label, tone = null) {
  const toneClass = tone ? ` att-stat--${tone}` : '';
  return `
    <div class="att-stat${toneClass}">
      <span class="att-stat__icon">${iconHtml}</span>
      <div>
        <strong>${escapeHtml(String(value))}</strong>
        <span>${escapeHtml(label)}</span>
      </div>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
