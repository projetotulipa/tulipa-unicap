// Dashboard de tesouraria — Sprint 1 (identidade) + Sprint 4 (dashboard rico).
// Hero + stats + pulso (pipeline + trend + skyline 12 meses) + pendências
// + top gastos + balanços fechados (mural gold) + planos ativos.

import { icon } from '../icons.js';
import * as data from '../finance/data.js';
import { brl, brlCompact, currentMonth, monthLabel, isoMonthRange } from '../finance/format.js';
import { EXPENSE_CATEGORIES, categoryById, categoryIconHtml, categoryLabel } from '../finance/categories.js';
import { stampSeal, stampPage } from '../finance/seal.js';
import { renderFinanceNav } from './finance-nav.js';

const MONTH_SHORT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

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

      <section class="fin-pane-v2 fin-pane-v2--full">
        <header class="fin-pane-v2__head">
          <span class="fin-pane-v2__icon">${icon('spark', { size: 18 })}</span>
          <h2>Pulso financeiro</h2>
          <p class="fin-pane-v2__hint">Faturado, recebido, gasto, saldo — fluxo do mês corrente.</p>
        </header>
        <div id="finPipeline">${renderLoadingBlock()}</div>
        <div class="fin-pane-v2-row" style="margin-top: 16px; margin-bottom: 0;">
          <div>
            <p class="muted" style="font-size: 12px; margin: 0 0 4px; letter-spacing: 0.08em; text-transform: uppercase;">Saldo desta semana</p>
            <div id="finTrend" class="fin-trend"></div>
          </div>
          <div>
            <p class="muted" style="font-size: 12px; margin: 0 0 4px; letter-spacing: 0.08em; text-transform: uppercase;">Receita × Despesa · últimos 12 meses</p>
            <div id="finSkyline"></div>
            <div id="finSkylineLabels"></div>
            <div class="fin-skyline-dual__legend">
              <span><span class="fin-skyline-dual__legend-swatch fin-skyline-dual__legend-swatch--in"></span>receita</span>
              <span><span class="fin-skyline-dual__legend-swatch fin-skyline-dual__legend-swatch--out"></span>despesa</span>
            </div>
          </div>
        </div>
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

      <section class="fin-pane-v2 fin-pane-v2--full" id="finTopExpPane" hidden>
        <header class="fin-pane-v2__head">
          <span class="fin-pane-v2__icon fin-pane-v2__icon--warning">${icon('trash', { size: 18 })}</span>
          <h2>Maiores gastos do mês</h2>
          <p class="fin-pane-v2__hint">5 registros mais altos do período</p>
        </header>
        <div id="finTopExp"></div>
      </section>

      <section class="fin-pane-v2 fin-pane-v2--full" id="finMuralPane" hidden>
        <header class="fin-pane-v2__head">
          <span class="fin-pane-v2__icon">${icon('check-circle', { size: 18 })}</span>
          <h2>Balanços fechados</h2>
          <p class="fin-pane-v2__hint">meses que terminaram com sobra — selados em ouro</p>
        </header>
        <div id="finMural" class="fin-mural"></div>
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
    fail('finPipeline', '');
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
  // calcula range de 12 meses pra pulso/skyline/mural
  const months12 = lastNMonths(year, month, 12);
  const years12 = [...new Set(months12.map((m) => m.year))];
  const minY = Math.min(...years12);
  const maxY = Math.max(...years12);

  // range de datas pra expenses (yyyy-mm-dd)
  const firstM = months12[0];
  const lastM = months12[months12.length - 1];
  const fromDate = `${firstM.year}-${String(firstM.month).padStart(2, '0')}-01`;
  const lastDay = new Date(lastM.year, lastM.month, 0).getDate();
  const toDate = `${lastM.year}-${String(lastM.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const [
    { data: duesNow }, { data: paymentsNow },
    { data: expensesNow }, { data: people }, { data: plans },
    { data: allPayments }, { data: allDues }, { data: allExpenses },
  ] = await Promise.all([
    data.getMonthlyDues(year, month),
    data.listMonthlyPayments(year, month),
    data.listExpenses({ from, to }),
    data.listPayingPeople(),
    data.listPlans({ includeCompleted: false }),
    data.listPaymentsRange({ fromYear: minY, toYear: maxY }),
    data.listDuesRange({ fromYear: minY, toYear: maxY }),
    data.listExpensesByRange({ from: fromDate, to: toDate }),
  ]);

  const defaultDues = Number(duesNow?.amount || 0);
  const totalPeople = people?.length || 0;

  // ===== mês corrente — agregados =====
  let arrecadado = 0;
  let paidCount = 0;
  const payMapNow = new Map((paymentsNow || []).map((p) => [p.person_id, p]));
  for (const person of (people || [])) {
    const pay = payMapNow.get(person.id);
    if (pay?.paid) {
      const v = pay.amount != null ? Number(pay.amount)
              : person.custom_dues != null ? Number(person.custom_dues)
              : defaultDues;
      arrecadado += v;
      paidCount++;
    }
  }
  const pending = totalPeople - paidCount;
  const totalGastos = (expensesNow || []).reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const saldoMes = arrecadado - totalGastos;
  const pctPaid = totalPeople > 0 ? Math.round(paidCount / totalPeople * 100) : 0;

  // gastos por categoria mês corrente
  const byCatNow = {};
  for (const e of (expensesNow || [])) {
    byCatNow[e.category] = (byCatNow[e.category] || 0) + Number(e.amount || 0);
  }

  // ===== 12 meses — agregar por mês =====
  const payIdx = new Map();
  for (const p of (allPayments || [])) payIdx.set(`${p.year}-${p.month}-${p.person_id}`, p);
  const duesIdx = new Map();
  for (const d of (allDues || [])) duesIdx.set(`${d.year}-${d.month}`, Number(d.amount || 0));

  // index expenses por (year, month)
  const expByMonth = new Map();
  for (const e of (allExpenses || [])) {
    const d = new Date(e.spent_on + 'T00:00:00');
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    expByMonth.set(key, (expByMonth.get(key) || 0) + Number(e.amount || 0));
  }

  const monthlySaldos = months12.map((m) => {
    let inMonth = 0;
    for (const person of (people || [])) {
      if (person.is_exempt) continue;
      const pay = payIdx.get(`${m.year}-${m.month}-${person.id}`);
      if (pay?.paid) {
        const v = pay.amount != null ? Number(pay.amount)
                : person.custom_dues != null ? Number(person.custom_dues)
                : (duesIdx.get(`${m.year}-${m.month}`) || 0);
        inMonth += v;
      }
    }
    const outMonth = expByMonth.get(`${m.year}-${m.month}`) || 0;
    return { ...m, in: inMonth, out: outMonth, saldo: inMonth - outMonth };
  });

  // valor previsto (faturado) do mês corrente
  let faturadoPrevisto = 0;
  for (const person of (people || [])) {
    if (person.is_exempt) continue;
    faturadoPrevisto += person.custom_dues != null ? Number(person.custom_dues) : defaultDues;
  }

  // ===== stats v2 =====
  const pctTone = pctPaid >= 80 ? 'success' : pctPaid >= 50 ? null : pctPaid >= 30 ? 'warning' : 'danger';
  document.getElementById('financeStats').innerHTML = `
    ${statCard(icon('check-circle', { size: 22 }), brlCompact(arrecadado), 'arrecadado no mês', 'success', `${paidCount} de ${totalPeople} pagaram`)}
    ${statCard(icon('trash', { size: 22 }), brlCompact(totalGastos), 'gastos no mês', totalGastos > arrecadado ? 'danger' : 'rose', countCatsActive(byCatNow) > 0 ? `em ${countCatsActive(byCatNow)} categoria${countCatsActive(byCatNow) === 1 ? '' : 's'}` : 'sem gastos')}
    ${statCard(icon('spark', { size: 22 }), brlCompact(saldoMes), 'saldo do mês', saldoMes >= 0 ? 'success' : 'danger', saldoMes >= 0 ? 'sobra positiva' : 'gastos acima da arrecadação')}
    ${statCard(icon('users', { size: 22 }), pctPaid + '%', 'recebido', pctTone, pending === 0 ? 'todos pagaram' : `${pending} ${pending === 1 ? 'pendente' : 'pendentes'}`)}
  `;

  // ===== pipeline (4 nós) =====
  renderPipeline({
    faturado: faturadoPrevisto,
    recebido: arrecadado,
    gastos: totalGastos,
    saldo: saldoMes,
    pctPaid,
  });

  // ===== trend semanal =====
  renderTrend(monthlySaldos, year, month);

  // ===== skyline dual 12 meses =====
  renderSkyline(monthlySaldos, year, month);

  // ===== pendências =====
  const pendentes = (people || []).filter((p) => !payMapNow.get(p.id)?.paid);
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

  // ===== gastos por categoria (mês) =====
  const catBox = document.getElementById('finByCategory');
  if (totalGastos === 0) {
    catBox.innerHTML = `<p class="muted" style="padding: 8px 0;">Nenhum gasto registrado este mês.</p>`;
  } else {
    catBox.innerHTML = `
      <ul class="fin-cat-list">
        ${EXPENSE_CATEGORIES.map((c) => {
          const v = byCatNow[c.id] || 0;
          const pct = totalGastos > 0 ? Math.round((v / totalGastos) * 100) : 0;
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

  // ===== top gastos (5 maiores do mês) =====
  renderTopExpenses(expensesNow || []);

  // ===== mural de balanços fechados (saldo >= 0 nos últimos 12) =====
  renderMural(monthlySaldos, year, month);

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

function countCatsActive(byCat) {
  return Object.values(byCat || {}).filter((v) => v > 0).length;
}

// ---------- pipeline ----------
function renderPipeline({ faturado, recebido, gastos, saldo, pctPaid }) {
  const box = document.getElementById('finPipeline');
  if (!box) return;
  const arrow = icon('arrow-right', { size: 14 });

  const saldoTone = saldo >= 0 ? 'positive' : 'negative';
  const recebidoTone = pctPaid >= 80 ? 'sage' : pctPaid >= 50 ? 'gold' : 'rose';

  const nodes = [
    { num: brlCompact(faturado), label: 'faturado', hint: 'previsto no mês', tone: 'gold' },
    { num: brlCompact(recebido), label: 'recebido', hint: `${pctPaid}% pago`, tone: recebidoTone, href: '#/financeiro/mensalidades' },
    { num: brlCompact(gastos), label: 'gastos', hint: countCatsActive({}) + '', tone: 'rose', href: '#/financeiro/gastos' },
    { num: brlCompact(saldo), label: 'saldo', hint: saldo >= 0 ? 'sobra' : 'déficit', tone: saldoTone },
  ];

  box.innerHTML = `
    <div class="fin-pipeline">
      ${nodes.map((n, i) => {
        const inner = `
          <span class="fin-pipeline__num fin-pipeline__num--${n.tone}">${escapeHtml(String(n.num))}</span>
          <span class="fin-pipeline__label">${escapeHtml(n.label)}</span>
          <span class="fin-pipeline__hint">${escapeHtml(n.hint)}</span>
        `;
        const node = n.href
          ? `<a class="fin-pipeline__node" href="${n.href}">${inner}</a>`
          : `<div class="fin-pipeline__node">${inner}</div>`;
        return (i > 0 ? `<span class="fin-pipeline__arrow">${arrow}</span>` : '') + node;
      }).join('')}
    </div>
  `;
}

// ---------- trend semanal ----------
function renderTrend(monthlySaldos, year, month) {
  const box = document.getElementById('finTrend');
  if (!box) return;

  const cur = monthlySaldos[monthlySaldos.length - 1];
  const prev = monthlySaldos[monthlySaldos.length - 2];

  if (!cur && !prev) {
    box.innerHTML = `<span class="fin-trend__big" style="color: var(--text-mute); font-size: 22px;">—</span>
      <span class="fin-trend__label">sem dados recentes</span>`;
    return;
  }

  const saldoTone = cur.saldo >= 0 ? 'positive' : 'negative';
  let deltaHtml = '';
  if (prev) {
    const diff = cur.saldo - prev.saldo;
    const sign = diff > 0 ? '+' : diff < 0 ? '−' : '';
    const tone = diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral';
    const arrow = diff > 0 ? icon('arrow-up', { size: 11 })
                : diff < 0 ? icon('arrow-down', { size: 11 })
                : icon('chevron', { size: 11 });
    deltaHtml = `<span class="fin-trend__delta fin-trend__delta--${tone}">${arrow}<span>${sign}${brlCompact(Math.abs(diff)).replace('R$ ', '')}</span></span>`;
  }

  box.innerHTML = `
    <span class="fin-trend__big fin-trend__big--${saldoTone}">${brlCompact(cur.saldo)}</span>
    ${deltaHtml}
    <span class="fin-trend__label">saldo · ${escapeHtml(MONTH_SHORT[cur.month - 1])}/${String(cur.year).slice(-2)}${prev ? ` vs ${MONTH_SHORT[prev.month - 1]}/${String(prev.year).slice(-2)}` : ''}</span>
  `;
}

// ---------- skyline dual 12 meses ----------
function renderSkyline(monthlySaldos, year, month) {
  const box = document.getElementById('finSkyline');
  const labelsBox = document.getElementById('finSkylineLabels');
  if (!box) return;

  const maxV = Math.max(1, ...monthlySaldos.map((m) => Math.max(m.in, m.out)));

  box.outerHTML = `<div class="fin-skyline-dual" id="finSkyline">
    ${monthlySaldos.map((m) => {
      const isCurr = m.year === year && m.month === month;
      const inH = m.in > 0 ? Math.max(4, Math.round(m.in / maxV * 100)) : 0;
      const outH = m.out > 0 ? Math.max(4, Math.round(m.out / maxV * 100)) : 0;
      const monthLab = `${MONTH_SHORT[m.month - 1]}/${String(m.year).slice(-2)}`;
      const tip = `${monthLab} · receita ${brlCompact(m.in)} · despesa ${brlCompact(m.out)} · saldo ${brlCompact(m.saldo)}`;
      return `<div class="fin-skyline-dual__group ${isCurr ? 'fin-skyline-dual__group--current' : ''}" data-tooltip="${escapeAttr(tip)}">
        <div class="fin-skyline-dual__bar fin-skyline-dual__bar--in" style="height: ${inH}%;"></div>
        <div class="fin-skyline-dual__bar fin-skyline-dual__bar--out" style="height: ${outH}%;"></div>
      </div>`;
    }).join('')}
  </div>`;

  if (labelsBox) {
    labelsBox.outerHTML = `<div class="fin-skyline-dual__labels" id="finSkylineLabels">
      ${monthlySaldos.map((m) => {
        const isCurr = m.year === year && m.month === month;
        return `<div class="fin-skyline-dual__labels-item ${isCurr ? 'is-current' : ''}">${MONTH_SHORT[m.month - 1]}</div>`;
      }).join('')}
    </div>`;
  }
}

// ---------- top gastos (5 maiores) ----------
function renderTopExpenses(expensesNow) {
  const pane = document.getElementById('finTopExpPane');
  const box = document.getElementById('finTopExp');
  if (!box || !pane) return;
  if (!expensesNow.length) {
    pane.hidden = true;
    return;
  }
  const top = [...expensesNow]
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 5);
  pane.hidden = false;
  box.innerHTML = `
    <div class="fin-top-list">
      ${top.map((e) => {
        const cat = categoryById(e.category);
        const d = new Date(e.spent_on + 'T00:00:00');
        const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        return `
          <a class="fin-top-item fin-top-item--${escapeAttr(e.category)}" href="#/financeiro/gastos">
            <span class="fin-top-item__icon">${categoryIconHtml(e.category, 14)}</span>
            <div class="fin-top-item__main">
              <strong>${escapeHtml(e.description || cat?.label || '—')}</strong>
              <span>${escapeHtml(cat?.label || '')} · ${escapeHtml(dateStr)}</span>
            </div>
            <span class="fin-top-item__amount">${escapeHtml(brl(e.amount))}</span>
          </a>
        `;
      }).join('')}
    </div>
  `;
}

// ---------- mural balanços fechados ----------
function renderMural(monthlySaldos, year, month) {
  const pane = document.getElementById('finMuralPane');
  const box = document.getElementById('finMural');
  if (!box || !pane) return;

  // só meses com saldo > 0 E que tiveram alguma atividade (receita ou despesa)
  // ignora mês corrente (ainda aberto)
  const closed = monthlySaldos
    .filter((m) => !(m.year === year && m.month === month))
    .filter((m) => m.saldo > 0 && (m.in > 0 || m.out > 0))
    .sort((a, b) => (b.year - a.year) || (b.month - a.month))
    .slice(0, 6);

  if (closed.length === 0) {
    pane.hidden = true;
    return;
  }
  pane.hidden = false;

  box.innerHTML = closed.map((m) => {
    const monthFull = monthLabel(m.year, m.month).split(' de ')[0];
    return `
      <div class="fin-mural__card">
        <span class="fin-mural__seal-corner" title="balanço fechado">${icon('check', { size: 13 })}</span>
        <div>
          <p class="fin-mural__eyebrow">balanço fechado</p>
          <p class="fin-mural__month">${escapeHtml(monthFull)}</p>
          <p class="fin-mural__year">${m.year}</p>
        </div>
        <div class="fin-mural__foot">
          <span class="fin-mural__saldo">
            ${brlCompact(m.saldo)}
            <small>sobra · ${brlCompact(m.in)} entradas</small>
          </span>
        </div>
        <div class="fin-mural__page">${stampPage({ size: 160 })}</div>
      </div>
    `;
  }).join('');
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

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
