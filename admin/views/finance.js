// Dashboard de tesouraria — Sprint 1 (identidade editorial "Tesouro Contado").
// Hero selo + stats Cormorant gold-deep + paneis Pendências/Categorias + Planos.

import { icon } from '../icons.js';
import * as data from '../finance/data.js';
import { brl, brlCompact, currentMonth, monthLabel, isoMonthRange } from '../finance/format.js';
import { EXPENSE_CATEGORIES, categoryIconHtml } from '../finance/categories.js';
import { stampSeal, stampPage, stampEmblem } from '../finance/seal.js';
import { renderFinanceNav } from './finance-nav.js';

export async function renderFinanceDashboard(ctx) {
  const { root } = ctx;
  const { year, month } = currentMonth();
  const { from, to } = isoMonthRange(year, month);

  root.innerHTML = `
    <div class="view">
      ${renderFinanceNav('dashboard')}

      <header class="fin-hero-v2">
        <div class="fin-hero-v2__seal-wrap">
          <span class="fin-seal">${stampSeal({ size: 32 })}</span>
        </div>
        <div class="fin-hero-v2__inner">
          <p class="fin-hero-v2__eyebrow">tesouro contado · ${escapeHtml(monthLabel(year, month))}</p>
          <h1>Visão geral</h1>
          <p class="fin-hero-v2__lede">
            Cada moeda contada. Acompanhe <strong>entradas</strong>, <strong>gastos</strong> e <strong>saldo</strong> do mês — e o que está planejado para frente.
          </p>
        </div>
        <div class="fin-hero-v2__page">${stampPage({ size: 220 })}</div>
      </header>

      <section class="fin-stats-v2" id="financeStats">
        ${skel()}${skel()}${skel()}${skel()}
      </section>

      <section class="fin-pane-v2-row">
        <div class="fin-pane-v2">
          <header class="fin-pane-v2__head">
            <span class="fin-pane-v2__icon fin-pane-v2__icon--rose">${icon('alert', { size: 18 })}</span>
            <h2>Pendências</h2>
            <p class="fin-pane-v2__hint">pessoas que ainda não pagaram</p>
          </header>
          <div id="finPendencias" class="fin-pane-v2__body">
            ${renderLoadingBlock()}
          </div>
        </div>

        <div class="fin-pane-v2">
          <header class="fin-pane-v2__head">
            <span class="fin-pane-v2__icon">${icon('attendance', { size: 18 })}</span>
            <h2>Gastos por categoria</h2>
          </header>
          <div id="finByCategory" class="fin-pane-v2__body">
            ${renderLoadingBlock()}
          </div>
        </div>
      </section>

      <section class="fin-pane-v2 fin-pane-v2--full">
        <header class="fin-pane-v2__head">
          <span class="fin-pane-v2__icon fin-pane-v2__icon--sage">${icon('spark', { size: 18 })}</span>
          <h2>Planos ativos</h2>
          <p class="fin-pane-v2__hint">objetivos financeiros em aberto</p>
        </header>
        <div id="finPlans" class="fin-pane-v2__body">
          ${renderLoadingBlock()}
        </div>
      </section>
    </div>
  `;

  loadAll(year, month, from, to).catch((err) => {
    console.error('[finance dashboard] erro carregando:', err);
    const fail = (id, msg) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = `<p class="muted">Erro ao carregar: ${escapeHtml(msg)}</p>`;
    };
    fail('financeStats', err.message || String(err));
    fail('finPendencias', '');
    fail('finByCategory', '');
    fail('finPlans', '');
  });
}

function skel() {
  return `<div class="fin-stat-v2 fin-stat-v2--skel"><div class="skel skel--block"></div></div>`;
}

function renderLoadingBlock() {
  return `
    <div class="fin-loading-wrap">
      <span class="fin-bloom"><span class="fin-seal">${stampSeal({ size: 24 })}</span></span>
    </div>
  `;
}

async function loadAll(year, month, from, to) {
  const [
    { data: dues }, { data: payments },
    { data: expensesAgg }, { data: people }, { data: plans },
  ] = await Promise.all([
    data.getMonthlyDues(year, month),
    data.listMonthlyPayments(year, month),
    data.sumExpensesByCategory({ from, to }),
    data.listPayingPeople(),
    data.listPlans({ includeCompleted: false }),
  ]);

  const defaultDues = Number(dues?.amount || 0);
  const totalPeople = people?.length || 0;

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
  const pctPaid = totalPeople > 0 ? Math.round(paidCount / totalPeople * 100) : 0;

  // ===== stats v2 (4 KPIs) =====
  const statsHtml = `
    ${statCard(icon('check-circle', { size: 22 }), brlCompact(arrecadado), 'arrecadado no mês', 'success', `${paidCount} de ${totalPeople} pagaram`)}
    ${statCard(icon('trash', { size: 22 }), brlCompact(totalGastos), 'gastos no mês', totalGastos > arrecadado ? 'danger' : 'rose', expensesAgg && expensesAgg.total > 0 ? `em ${countCats(expensesAgg)} categoria${countCats(expensesAgg) === 1 ? '' : 's'}` : 'sem gastos')}
    ${statCard(icon('spark', { size: 22 }), brlCompact(saldoMes), 'saldo do mês', saldoMes >= 0 ? 'success' : 'danger', saldoMes >= 0 ? 'sobra positiva' : 'gastos acima da arrecadação')}
    ${statCard(icon('users', { size: 22 }), pctPaid + '%', 'recebido', pctPaid >= 80 ? 'success' : pctPaid >= 50 ? null : pctPaid >= 30 ? 'warning' : 'danger', pending === 0 ? 'todos pagaram' : `${pending} ${pending === 1 ? 'pendente' : 'pendentes'}`)}
  `;
  document.getElementById('financeStats').innerHTML = statsHtml;

  // ===== pendências =====
  const pendentes = (people || []).filter((p) => !payMap.get(p.id)?.paid);
  const pBox = document.getElementById('finPendencias');
  if (totalPeople === 0) {
    pBox.innerHTML = `<p class="muted" style="padding: 8px 0;">Nenhuma pessoa ativa pagante cadastrada.</p>`;
  } else if (pendentes.length === 0) {
    pBox.innerHTML = `
      <div class="fin-empty-v2 fin-empty-v2--ok" style="padding: 32px 18px;">
        <div class="fin-empty-v2__art">${icon('check-circle', { size: 44 })}</div>
        <p>Ninguém deve nada este mês. Balanço selado.</p>
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
              <span class="fin-pill-v2 fin-pill-v2--rose-late">${escapeHtml(brl(v))}</span>
            </li>
          `;
        }).join('')}
        ${pendentes.length > 8 ? `<li class="muted" style="padding: 6px 0; font-style: italic;">+ ${pendentes.length - 8} pessoa${pendentes.length - 8 === 1 ? '' : 's'}</li>` : ''}
      </ul>
      <a class="btn btn--ghost btn--small" href="#/financeiro/mensalidades" style="margin-top: 14px;">
        Abrir planilha ${icon('arrow-right', { size: 12 })}
      </a>
    `;
  }

  // ===== gastos por categoria =====
  const catBox = document.getElementById('finByCategory');
  const byCat = expensesAgg?.byCategory || {};
  const totalAll = expensesAgg?.total || 0;
  if (totalAll === 0) {
    catBox.innerHTML = `<p class="muted" style="padding: 8px 0;">Nenhum gasto registrado este mês.</p>`;
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

  // ===== planos =====
  const planBox = document.getElementById('finPlans');
  if (!plans?.length) {
    planBox.innerHTML = `
      <div class="fin-empty-v2" style="padding: 32px 18px;">
        <div class="fin-empty-v2__art">${icon('spark', { size: 44 })}</div>
        <p>Nenhum plano financeiro registrado.</p>
        <a class="btn btn--ghost btn--small" href="#/financeiro/planejamento">criar primeiro plano</a>
      </div>
    `;
  } else {
    planBox.innerHTML = `
      <ul class="fin-list">
        ${plans.slice(0, 6).map((pl) => `
          <li class="fin-list-item">
            <div style="min-width: 0; flex: 1;">
              <strong>${escapeHtml(pl.title)}</strong>
              ${pl.description ? `<span class="muted" style="display:block; font-size:12px; margin-top: 2px;">${escapeHtml(pl.description.slice(0, 80))}${pl.description.length > 80 ? '…' : ''}</span>` : ''}
            </div>
            ${pl.estimated_amount != null ? `<span class="fin-pill-v2 fin-pill-v2--gold">${escapeHtml(brlCompact(pl.estimated_amount))}</span>` : ''}
          </li>
        `).join('')}
      </ul>
    `;
  }
}

function statCard(iconHtml, value, label, tone = null, hint = null) {
  const toneClass = tone ? ` fin-stat-v2--${tone}` : '';
  const numClass = tone === 'success' ? ' fin-stat-v2__num--positive'
                 : tone === 'danger' ? ' fin-stat-v2__num--negative'
                 : '';
  return `
    <div class="fin-stat-v2${toneClass}">
      <div class="fin-stat-v2__body">
        <strong class="fin-stat-v2__num${numClass}">${escapeHtml(String(value))}</strong>
        <span class="fin-stat-v2__label">${escapeHtml(label)}</span>
        ${hint ? `<span class="fin-stat-v2__hint">${escapeHtml(hint)}</span>` : ''}
      </div>
      <span class="fin-stat-v2__icon">${iconHtml}</span>
    </div>
  `;
}

function countCats(expensesAgg) {
  if (!expensesAgg || !expensesAgg.byCategory) return 0;
  return Object.values(expensesAgg.byCategory).filter((v) => v > 0).length;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
