// Dashboard de presença — Sprint 1 (identidade) + Sprint 4 (dashboard rico).
// Hero codex + stats + paneis Hoje/Próximos + alertas + pipeline + skyline + trend
// + heatmap pessoa×encontro + mural dos encontros conduzidos + categorias justificadas.

import { icon } from '../icons.js';
import * as data from '../attendance/data.js';
import { calcMonthlyStatus, STATUS_COLORS, severityOf, currentMonthRange, monthLabel, shortRangeLabel } from '../attendance/status.js';
import { JUSTIFICATION_CATEGORIES, categoryLabel, categoryIcon } from '../attendance/categories.js';
import { renderSubNav } from './attendance-nav.js';
import { avatarHtml } from '../avatar.js';
import { codexSeal, codexPage, codexEmblem } from '../attendance/codex.js';
import { renderHelpBanner, wireHelpBanner } from './help-banner.js';
import { helpDefault } from '../help/data.js';

const WEEKDAY_LABELS = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const MONTH_SHORT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

// estado do heatmap: grupo selecionado (id ou 'auto' = grupo com mais alertas)
const heatmapState = { groupId: 'auto' };

export async function renderAttendanceDashboard(ctx) {
  const { root, state } = ctx;
  const today = new Date();

  const { data: currentSem } = await data.getCurrentSemester();
  const monthRange = currentMonthRange();
  const range = currentSem
    ? { from: currentSem.start_date, to: currentSem.end_date, semester: currentSem }
    : { from: monthRange.from, to: monthRange.to, year: monthRange.year, month: monthRange.month };
  const { year, month, from, to } = { ...monthRange, ...range };
  const periodLabel = range.semester
    ? `${range.semester.name} · ${shortRangeLabel(range.semester.start_date, range.semester.end_date)}`
    : monthLabel(year, month);

  const canCreateGroup = ctx.api.canManageAttendance() && state.role === 'admin';

  root.innerHTML = `
    <div class="view">
      ${renderSubNav('dashboard', { isAdmin: state.role === 'admin' })}

      ${renderHelpBanner({ slot: 'presenca', title: helpDefault('presenca').title })}

      <header class="att-hero-v2">
        <div class="att-hero-v2__seal-wrap">
          <span class="att-codex-seal">${codexSeal({ size: 32 })}</span>
        </div>
        <div class="att-hero-v2__inner">
          <p class="att-hero-v2__eyebrow">secretaria · ${escapeHtml(greeting(today))} · ${escapeHtml(formatDate(today, 'long'))}</p>
          <h1>Secretaria</h1>
          <p class="att-hero-v2__lede">
            Registro de presenças, comunicação dos encontros e organização do dia-a-dia em <strong>${escapeHtml(periodLabel)}</strong>.
          </p>
        </div>
        ${canCreateGroup ? `
          <div class="att-hero-v2__cta">
            <a class="btn btn--ghost btn--small" href="#/presenca/grupos">
              ${icon('plus', { size: 14 })}<span style="margin-left:6px;">novo grupo</span>
            </a>
          </div>
        ` : ''}
        <div class="att-hero-v2__page">${codexPage({ size: 220 })}</div>
      </header>

      <section class="att-stats-v2" id="attStats">
        ${renderStatSkel()}${renderStatSkel()}${renderStatSkel()}${renderStatSkel()}
      </section>

      <section class="att-pane-v2 att-pane-v2--full">
        <header class="att-pane-v2__head">
          <span class="att-pane-v2__icon att-pane-v2__icon--gold">${icon('spark', { size: 18 })}</span>
          <h2>Pulso do registro</h2>
          <p class="att-pane-v2__hint">Do plano à comparência — fluxo do período inteiro.</p>
        </header>
        <div id="attPipeline">${renderLoadingBlock()}</div>
        <div id="attTrendRow" class="att-pane-v2-row" style="margin-top: 16px; margin-bottom: 0;">
          <div>
            <p class="muted" style="font-size: 12px; margin: 0 0 4px; letter-spacing: 0.08em; text-transform: uppercase;">Tendência semanal</p>
            <div id="attTrend" class="att-fol-trend"></div>
          </div>
          <div>
            <p class="muted" style="font-size: 12px; margin: 0 0 4px; letter-spacing: 0.08em; text-transform: uppercase;">Skyline · últimos 28 dias</p>
            <div id="attSkyline"></div>
            <div class="att-fol-skyline__legend">
              <span class="att-fol-skyline__legend-item"><span class="att-fol-skyline__legend-swatch"></span>encontros realizados</span>
              <span class="att-fol-skyline__legend-item"><span class="att-fol-skyline__legend-swatch att-fol-skyline__legend-swatch--past"></span>agendados</span>
            </div>
          </div>
        </div>
      </section>

      <section class="att-pane-v2-row">
        <div class="att-pane-v2">
          <header class="att-pane-v2__head">
            <span class="att-pane-v2__icon att-pane-v2__icon--rose">${icon('clock', { size: 18 })}</span>
            <h2>Hoje</h2>
          </header>
          <div id="attToday" class="att-pane-v2__body">
            ${renderLoadingBlock()}
          </div>
        </div>

        <div class="att-pane-v2">
          <header class="att-pane-v2__head">
            <span class="att-pane-v2__icon">${icon('calendar', { size: 18 })}</span>
            <h2>Próximos 7 dias</h2>
          </header>
          <div id="attUpcoming" class="att-pane-v2__body">
            ${renderLoadingBlock()}
          </div>
        </div>
      </section>

      <section class="att-pane-v2 att-pane-v2--full">
        <header class="att-pane-v2__head">
          <span class="att-pane-v2__icon att-pane-v2__icon--alert">${icon('alert', { size: 18 })}</span>
          <h2>Atenção do período</h2>
          <p class="att-pane-v2__hint">Pessoas em laranja ou vermelho. Prioritários listados primeiro.</p>
        </header>
        <div id="attAlerts" class="att-pane-v2__body">
          ${renderLoadingBlock()}
        </div>
      </section>

      <section class="att-fol-heatmap-wrap" id="attHeatmapWrap" hidden>
        <header class="att-pane-v2__head" style="margin-bottom: 0;">
          <span class="att-pane-v2__icon">${icon('group', { size: 18 })}</span>
          <h2>Mapa de comparência</h2>
          <p class="att-pane-v2__hint">Cada célula é um encontro. Verde=presente, dourado=justificado, vermelho=falta.</p>
        </header>
        <div class="att-fol-heatmap-toolbar" id="attHeatmapToolbar"></div>
        <div id="attHeatmap"></div>
        <div class="att-fol-heatmap__legend">
          <span class="att-fol-heatmap__legend-item"><span class="att-fol-heatmap__legend-swatch att-fol-heatmap__legend-swatch--present"></span>presente</span>
          <span class="att-fol-heatmap__legend-item"><span class="att-fol-heatmap__legend-swatch att-fol-heatmap__legend-swatch--justified"></span>justificada</span>
          <span class="att-fol-heatmap__legend-item"><span class="att-fol-heatmap__legend-swatch att-fol-heatmap__legend-swatch--absent"></span>ausente</span>
          <span class="att-fol-heatmap__legend-item"><span class="att-fol-heatmap__legend-swatch att-fol-heatmap__legend-swatch--cancelled"></span>cancelado</span>
        </div>
      </section>

      <section class="att-pane-v2 att-pane-v2--full" id="attMuralPane" hidden>
        <header class="att-pane-v2__head">
          <span class="att-pane-v2__icon">${icon('check-circle', { size: 18 })}</span>
          <h2>Encontros conduzidos</h2>
          <p class="att-pane-v2__hint">Os últimos selos fechados — em ordem do mais recente.</p>
        </header>
        <div id="attMural" class="att-fol-mural"></div>
      </section>

      <section class="att-pane-v2 att-pane-v2--full" id="attCatsPane" hidden>
        <header class="att-pane-v2__head">
          <span class="att-pane-v2__icon att-pane-v2__icon--gold">${icon('alert', { size: 18 })}</span>
          <h2>Justificativas por categoria</h2>
          <p class="att-pane-v2__hint">Como as faltas justificadas se distribuem no período.</p>
        </header>
        <div id="attCats" class="att-fol-cats"></div>
      </section>
    </div>
  `;

  wireHelpBanner(ctx, 'presenca').catch((err) => console.warn('[help-banner]', err));

  loadEverything({ year, month, from, to, today, range }).catch((err) => {
    console.error('[attendance dashboard] erro carregando:', err);
    const fail = (id, msg) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = `<p class="muted">Erro ao carregar: ${escapeHtml(msg)}</p>`;
    };
    fail('attStats', err.message || String(err));
    fail('attToday', '');
    fail('attUpcoming', '');
    fail('attAlerts', err.message || String(err));
    fail('attPipeline', '');
  });
}

async function loadEverything({ year, month, from, to, today, range }) {
  const groupsRes = await data.listGroups();
  if (groupsRes.error) throw new Error(`listGroups: ${groupsRes.error.message}`);
  const groups = groupsRes.data || [];

  const peopleRes = await data.listPeople();
  if (peopleRes.error) throw new Error(`listPeople: ${peopleRes.error.message}`);
  const people = peopleRes.data || [];

  if (!groups.length) {
    document.getElementById('attStats').innerHTML = '';
    document.getElementById('attToday').innerHTML = '';
    document.getElementById('attUpcoming').innerHTML = '';
    document.getElementById('attPipeline').innerHTML = '';
    document.getElementById('attAlerts').innerHTML = `
      <div class="att-empty-v2">
        <div class="att-empty-v2__art">${codexEmblem({ size: 56 })}</div>
        <h3>Nenhum grupo ainda</h3>
        <p>Comece criando um grupo para abrir o primeiro livro de presenças.</p>
        <a class="btn btn--primary" href="#/presenca/grupos">Criar primeiro grupo</a>
      </div>
    `;
    return;
  }

  const todayStr = isoDate(today);
  const weekToStr = isoDate(new Date(today.getTime() + 6 * 86400000));

  const perGroupData = await Promise.all(groups.map(async (g) => {
    try {
      const [meetingsRes, membersRes] = await Promise.all([
        data.listAttendanceByGroupInRange(g.id, from, to),
        data.listMembershipsOfGroup(g.id),
      ]);
      return {
        group: g,
        meetings: meetingsRes.data || [],
        members: membersRes.data || [],
      };
    } catch (e) {
      console.error('[attendance dashboard] grupo', g.id, e);
      return { group: g, meetings: [], members: [] };
    }
  }));

  // ===== agregados =====
  let totalSlots = 0;
  let totalPresent = 0;
  let totalJustified = 0;
  let totalHappened = 0;
  let totalScheduled = 0;
  const todaysMeetings = [];
  const upcomingMeetings = [];
  const alerts = [];
  const allMeetings = []; // flat com group nested pra skyline/mural
  const groupAlerts = new Map(); // groupId -> alertsCount

  for (const { group, meetings, members } of perGroupData) {
    let groupAlertCount = 0;
    for (const m of meetings) {
      allMeetings.push({ ...m, group });
      if (m.status === 'happened') {
        totalHappened++;
        totalSlots += members.length;
        const presentN = (m.attendance || []).filter((a) => a.is_present).length;
        const justN    = (m.attendance || []).filter((a) => !a.is_present && a.justified).length;
        totalPresent += presentN;
        totalJustified += justN;
      } else if (m.status === 'scheduled') {
        totalScheduled++;
      }
      if (m.date === todayStr) todaysMeetings.push({ group, meeting: m });
      else if (m.date > todayStr && m.date <= weekToStr) {
        upcomingMeetings.push({ group, meeting: m });
      }
    }
    for (const mem of members) {
      const st = calcMonthlyStatus(meetings, mem.person_id, { isWeekly: group.schedule_kind === 'weekly' });
      if (st.color === 'orange' || st.color === 'red') {
        alerts.push({ person: mem.person, group, isPrimary: mem.is_primary, status: st });
        groupAlertCount++;
      }
    }
    groupAlerts.set(group.id, groupAlertCount);
  }

  const pct = totalSlots > 0 ? Math.round((totalPresent / totalSlots) * 100) : null;
  const pctTone = pct === null ? null
    : pct >= 70 ? 'success'
    : pct >= 50 ? 'gold'
    : pct >= 30 ? 'warning'
    : 'danger';

  // ===== stats v2 =====
  document.getElementById('attStats').innerHTML = `
    ${statCard(icon('group', { size: 22 }), groups.length, groups.length === 1 ? 'grupo ativo' : 'grupos ativos', null)}
    ${statCard(icon('users', { size: 22 }), people.length, people.length === 1 ? 'pessoa cadastrada' : 'pessoas cadastradas', 'rose')}
    ${statCard(icon('calendar', { size: 22 }), totalHappened, range.semester ? 'encontros no semestre' : 'encontros no mês', 'gold')}
    ${statCard(icon('check-circle', { size: 22 }), pct === null ? '—' : `${pct}%`, 'presença média', pctTone)}
  `;

  // ===== pipeline =====
  renderPipeline({
    groupsCount: groups.length,
    peopleCount: people.length,
    scheduled: totalScheduled,
    happened: totalHappened,
    pct,
    alertsCount: alerts.length,
  });

  // ===== trend (esta semana vs anterior) =====
  renderTrend(perGroupData, today);

  // ===== skyline 28 dias =====
  renderSkyline(allMeetings, today);

  // ===== Hoje / Próximos =====
  upcomingMeetings.sort((a, b) => a.meeting.date.localeCompare(b.meeting.date));
  const todayBox = document.getElementById('attToday');
  if (todaysMeetings.length === 0) {
    todayBox.innerHTML = `<p class="muted att-pane-v2__empty">Nenhum encontro hoje.</p>`;
  } else {
    todayBox.innerHTML = todaysMeetings.map(({ group, meeting }) => meetingBigV2(group, meeting)).join('');
  }

  const upBox = document.getElementById('attUpcoming');
  if (upcomingMeetings.length === 0) {
    upBox.innerHTML = `<p class="muted att-pane-v2__empty">Nenhum encontro nos próximos 7 dias.</p>`;
  } else {
    upBox.innerHTML = upcomingMeetings.slice(0, 5).map(({ group, meeting }) => meetingBigV2(group, meeting)).join('');
  }

  // ===== alertas =====
  alerts.sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return severityOf(b.status.color) - severityOf(a.status.color);
  });
  const alertsBox = document.getElementById('attAlerts');
  if (alerts.length === 0) {
    alertsBox.innerHTML = `
      <div class="att-empty-v2 att-empty-v2--ok">
        <div class="att-empty-v2__art">${icon('check-circle', { size: 52 })}</div>
        <p>Ninguém em laranja ou vermelho ${range.semester ? 'no semestre atual' : 'este mês'}.</p>
      </div>
    `;
  } else {
    alertsBox.innerHTML = `<ul class="att-alerts-v2">${alerts.map(alertRow).join('')}</ul>`;
  }

  // ===== heatmap =====
  if (totalHappened > 0 || totalScheduled > 0) {
    document.getElementById('attHeatmapWrap').hidden = false;
    setupHeatmap(perGroupData, groupAlerts);
  }

  // ===== mural dos encontros conduzidos =====
  renderMural(allMeetings);

  // ===== categorias justificadas =====
  renderCategories(perGroupData);
}

function statCard(iconHtml, value, label, tone = null) {
  const toneClass = tone ? ` att-stat-v2--${tone}` : '';
  return `
    <div class="att-stat-v2${toneClass}">
      <div class="att-stat-v2__body">
        <strong class="att-stat-v2__num">${escapeHtml(String(value))}</strong>
        <span class="att-stat-v2__label">${escapeHtml(label)}</span>
      </div>
      <span class="att-stat-v2__icon">${iconHtml}</span>
    </div>
  `;
}

function renderStatSkel() {
  return `<div class="att-stat-v2 att-stat-v2--skel"><div class="skel skel--block"></div></div>`;
}

function renderLoadingBlock() {
  return `
    <div class="att-loading-wrap">
      <span class="att-bloom"><span class="att-codex-seal">${codexSeal({ size: 24 })}</span></span>
    </div>
  `;
}

// ---------- pipeline ----------
function renderPipeline({ groupsCount, peopleCount, scheduled, happened, pct, alertsCount }) {
  const box = document.getElementById('attPipeline');
  if (!box) return;
  const arrow = icon('arrow-right', { size: 14 });

  const nodes = [
    {
      num: groupsCount, label: 'grupos', href: '#/presenca/grupos',
      tone: '', hint: groupsCount === 1 ? 'em atividade' : 'em atividade',
    },
    {
      num: peopleCount, label: 'pessoas', href: '#/presenca/pessoas',
      tone: 'rose', hint: 'vinculadas',
    },
    {
      num: scheduled, label: 'agendados', href: null,
      tone: 'gold', hint: scheduled === 0 ? 'nada à frente' : 'próximos',
    },
    {
      num: happened, label: 'realizados', href: null,
      tone: 'sage', hint: 'comparências no período',
    },
    {
      num: pct === null ? '—' : `${pct}%`, label: 'presença média', href: null,
      tone: pct === null ? '' : pct >= 70 ? 'sage' : pct >= 50 ? 'gold' : 'rose',
      hint: alertsCount > 0 ? `${alertsCount} ${alertsCount === 1 ? 'alerta' : 'alertas'}` : 'sem alertas',
      urgent: alertsCount >= 3,
    },
  ];

  box.innerHTML = `
    <div class="att-fol-pipeline">
      ${nodes.map((n, i) => `
        ${i > 0 ? `<span class="att-fol-pipeline__arrow">${arrow}</span>` : ''}
        ${n.href
          ? `<a class="att-fol-pipeline__node ${n.tone ? 'att-fol-pipeline__node--' + n.tone : ''} ${n.urgent ? 'is-urgent' : ''}" href="${n.href}">
              <span class="att-fol-pipeline__num">${escapeHtml(String(n.num))}</span>
              <span class="att-fol-pipeline__label">${escapeHtml(n.label)}</span>
              <span class="att-fol-pipeline__hint">${escapeHtml(n.hint)}</span>
            </a>`
          : `<div class="att-fol-pipeline__node ${n.tone ? 'att-fol-pipeline__node--' + n.tone : ''} ${n.urgent ? 'is-urgent' : ''}">
              <span class="att-fol-pipeline__num">${escapeHtml(String(n.num))}</span>
              <span class="att-fol-pipeline__label">${escapeHtml(n.label)}</span>
              <span class="att-fol-pipeline__hint">${escapeHtml(n.hint)}</span>
            </div>`}
      `).join('')}
    </div>
  `;
}

// ---------- trend semanal ----------
function renderTrend(perGroupData, today) {
  const box = document.getElementById('attTrend');
  if (!box) return;
  const todayStart = startOfDay(today);
  // semana atual = últimos 7 dias (incluindo hoje); anterior = 8-14 dias atrás
  const cur = pctInWindow(perGroupData, daysAgo(todayStart, 6), todayStart);
  const prev = pctInWindow(perGroupData, daysAgo(todayStart, 13), daysAgo(todayStart, 7));

  if (cur === null && prev === null) {
    box.innerHTML = `<span class="att-fol-trend__big" style="color: var(--text-mute); font-size: 22px;">—</span>
      <span class="att-fol-trend__label">sem encontros recentes</span>`;
    return;
  }

  const curStr = cur === null ? '—' : `${cur}%`;
  let deltaHtml = '';
  if (cur !== null && prev !== null) {
    const diff = cur - prev;
    const sign = diff > 0 ? '+' : '';
    const tone = diff > 2 ? 'up' : diff < -2 ? 'down' : 'neutral';
    const arrow = diff > 2 ? icon('arrow-up', { size: 11 })
                : diff < -2 ? icon('arrow-down', { size: 11 })
                : icon('chevron', { size: 11 });
    deltaHtml = `<span class="att-fol-trend__delta att-fol-trend__delta--${tone}">${arrow}<span>${sign}${diff} pp</span></span>`;
  } else if (prev === null) {
    deltaHtml = `<span class="att-fol-trend__delta att-fol-trend__delta--neutral">primeira semana com dados</span>`;
  }

  box.innerHTML = `
    <span class="att-fol-trend__big">${curStr}</span>
    ${deltaHtml}
    <span class="att-fol-trend__label">presença · esta semana</span>
  `;
}

function pctInWindow(perGroupData, from, to) {
  const fromStr = isoDate(from);
  const toStr = isoDate(to);
  let slots = 0, present = 0;
  for (const { meetings, members } of perGroupData) {
    for (const m of meetings) {
      if (m.status !== 'happened') continue;
      if (m.date < fromStr || m.date > toStr) continue;
      slots += members.length;
      present += (m.attendance || []).filter((a) => a.is_present).length;
    }
  }
  return slots > 0 ? Math.round(present / slots * 100) : null;
}

// ---------- skyline 28 dias ----------
function renderSkyline(allMeetings, today) {
  const box = document.getElementById('attSkyline');
  if (!box) return;
  const todayStr = isoDate(today);
  const days = [];
  for (let i = 27; i >= 0; i--) {
    const d = daysAgo(today, i);
    days.push({ date: isoDate(d), label: d, happened: 0, scheduled: 0, cancelled: 0 });
  }
  const idx = new Map(days.map((d, i) => [d.date, i]));
  for (const m of allMeetings) {
    if (!idx.has(m.date)) continue;
    const d = days[idx.get(m.date)];
    if (m.status === 'happened') d.happened++;
    else if (m.status === 'scheduled') d.scheduled++;
    else if (m.status === 'cancelled') d.cancelled++;
  }
  const maxN = Math.max(1, ...days.map((d) => d.happened + d.scheduled));

  box.outerHTML = `<div class="att-fol-skyline" id="attSkyline">
    ${days.map((d) => {
      const total = d.happened + d.scheduled;
      const isToday = d.date === todayStr;
      const isPast = d.date < todayStr;
      const cls = isToday ? ' att-fol-skyline__bar--today'
                : isPast && d.happened === 0 && d.scheduled === 0 ? ''
                : isPast && d.happened > 0 ? ''
                : d.scheduled > 0 ? ' att-fol-skyline__bar--past' : '';
      const h = total > 0 ? Math.max(8, Math.round(total / maxN * 100)) : 0;
      const dayLab = d.label.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const tip = total === 0
        ? `${dayLab} · sem encontros`
        : `${dayLab} · ${d.happened} realizado${d.happened === 1 ? '' : 's'}${d.scheduled ? ` · ${d.scheduled} agendado${d.scheduled === 1 ? '' : 's'}` : ''}`;
      return `<div class="att-fol-skyline__bar${cls}" data-tooltip="${escapeAttr(tip)}">
        ${h > 0 ? `<div class="att-fol-skyline__fill" style="height: ${h}%;"></div>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

// ---------- heatmap ----------
function setupHeatmap(perGroupData, groupAlerts) {
  const toolbar = document.getElementById('attHeatmapToolbar');
  if (!toolbar) return;

  // grupo "auto" = grupo com mais alertas (ou maior, se zero alertas em todos)
  if (heatmapState.groupId === 'auto') {
    let bestId = null, bestScore = -1;
    for (const { group, members } of perGroupData) {
      const al = groupAlerts.get(group.id) || 0;
      const score = al * 100 + members.length;
      if (score > bestScore) { bestScore = score; bestId = group.id; }
    }
    if (bestId) heatmapState.groupId = bestId;
  }

  const options = perGroupData.map(({ group, members }) => {
    const al = groupAlerts.get(group.id) || 0;
    const tail = al > 0 ? ` · ${al} ${al === 1 ? 'alerta' : 'alertas'}` : ` · ${members.length} ${members.length === 1 ? 'pessoa' : 'pessoas'}`;
    return `<option value="${escapeAttr(group.id)}" ${heatmapState.groupId === group.id ? 'selected' : ''}>${escapeHtml(group.name)}${escapeHtml(tail)}</option>`;
  }).join('');

  toolbar.innerHTML = `
    <label>
      <span>grupo:</span>
      <select id="attHeatmapGroup">${options}</select>
    </label>
    <span class="muted" style="font-size: 12px; font-style: italic;">colunas = encontros (mais recentes à direita)</span>
  `;

  document.getElementById('attHeatmapGroup').addEventListener('change', (ev) => {
    heatmapState.groupId = ev.target.value;
    renderHeatmap(perGroupData);
  });

  renderHeatmap(perGroupData);
}

function renderHeatmap(perGroupData) {
  const box = document.getElementById('attHeatmap');
  if (!box) return;
  const groupData = perGroupData.find((g) => g.group.id === heatmapState.groupId);
  if (!groupData) {
    box.innerHTML = `<div class="att-fol-heatmap-empty">Selecione um grupo.</div>`;
    return;
  }

  const { meetings, members } = groupData;
  const meetingsSorted = [...meetings].sort((a, b) => a.date.localeCompare(b.date));
  // Pega últimos 16 encontros (cabe na tela; scroll horizontal se passar)
  const visibleMeetings = meetingsSorted.slice(-16);

  if (members.length === 0 || visibleMeetings.length === 0) {
    box.innerHTML = `<div class="att-fol-heatmap-empty">${members.length === 0 ? 'Nenhuma pessoa vinculada a este grupo.' : 'Nenhum encontro ainda neste período.'}</div>`;
    return;
  }

  // index attendance por (meetingId, personId)
  const attIdx = new Map();
  for (const m of visibleMeetings) {
    for (const a of (m.attendance || [])) {
      attIdx.set(`${m.id}::${a.person_id}`, a);
    }
  }

  // % presença por pessoa nos encontros happened
  function pctOf(personId) {
    let happened = 0, present = 0, justified = 0;
    for (const m of visibleMeetings) {
      if (m.status !== 'happened') continue;
      const a = attIdx.get(`${m.id}::${personId}`);
      if (a?.justified) { justified++; continue; }
      happened++;
      if (a?.is_present) present++;
    }
    if (happened === 0) return null;
    return Math.round(present / happened * 100);
  }

  // ordena membros: primários antes, depois por % crescente (alertas pra cima)
  const membersSorted = [...members].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    const pa = pctOf(a.person_id) ?? 999;
    const pb = pctOf(b.person_id) ?? 999;
    return pa - pb;
  });

  const headerDates = visibleMeetings.map((m) => {
    const d = new Date(m.date + 'T00:00:00');
    return `<div class="att-fol-heatmap__date">
      <strong>${String(d.getDate()).padStart(2, '0')}</strong>
      <span>${MONTH_SHORT[d.getMonth()]}</span>
    </div>`;
  }).join('');

  const rows = membersSorted.map((mem) => {
    const personName = mem.person?.full_name || '—';
    const pct = pctOf(mem.person_id);
    const pctClass = pct === null ? '' :
      pct >= 80 ? 'ok' :
      pct >= 60 ? 'mid' :
      pct >= 40 ? 'low' : 'bad';
    const cells = visibleMeetings.map((m) => {
      const d = new Date(m.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (m.status === 'cancelled') {
        return `<a class="att-fol-heatmap__cell att-fol-heatmap__cell--cancelled" href="#/presenca/encontros/${escapeAttr(m.id)}" data-tooltip="${escapeAttr(personName + ' · ' + d + ' · cancelado')}"></a>`;
      }
      const a = attIdx.get(`${m.id}::${mem.person_id}`);
      let cls = 'att-fol-heatmap__cell--absent';
      let label = 'falta';
      if (a?.is_present) { cls = 'att-fol-heatmap__cell--present'; label = 'presente'; }
      else if (a?.justified) { cls = 'att-fol-heatmap__cell--justified'; label = 'justificada' + (a.justification_category ? ` (${categoryLabel(a.justification_category)})` : ''); }
      else if (m.status === 'scheduled') { cls = 'att-fol-heatmap__cell--no-membership'; label = 'agendado'; }
      return `<a class="att-fol-heatmap__cell ${cls}" href="#/presenca/encontros/${escapeAttr(m.id)}" data-tooltip="${escapeAttr(personName + ' · ' + d + ' · ' + label)}"></a>`;
    }).join('');

    return `<div class="att-fol-heatmap__row">
      <div class="att-fol-heatmap__name">
        <strong title="${escapeAttr(personName)}">${escapeHtml(personName)}</strong>
        <span class="att-fol-heatmap__name-pct ${pctClass ? 'att-fol-heatmap__name-pct--' + pctClass : ''}">${pct === null ? '—' : pct + '%'}</span>
      </div>
      <div class="att-fol-heatmap__cells">${cells}</div>
    </div>`;
  }).join('');

  box.innerHTML = `
    <div class="att-fol-heatmap">
      <div class="att-fol-heatmap__header">
        <span class="muted" style="font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;">pessoa</span>
        <div class="att-fol-heatmap__header-dates">${headerDates}</div>
      </div>
      ${rows}
    </div>
  `;
}

// ---------- mural ----------
function renderMural(allMeetings) {
  const pane = document.getElementById('attMuralPane');
  const box = document.getElementById('attMural');
  if (!box || !pane) return;
  const happened = allMeetings
    .filter((m) => m.status === 'happened')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  if (happened.length === 0) {
    pane.hidden = true;
    return;
  }
  pane.hidden = false;

  box.innerHTML = happened.map((m) => {
    const d = new Date(m.date + 'T00:00:00');
    const day = String(d.getDate()).padStart(2, '0');
    const monthLab = MONTH_SHORT[d.getMonth()];
    const total = (m.attendance || []).length;
    const present = (m.attendance || []).filter((a) => a.is_present).length;
    const pct = total > 0 ? Math.round(present / total * 100) : 0;
    return `
      <a class="att-fol-mural__card" href="#/presenca/encontros/${escapeAttr(m.id)}">
        <div>
          <p class="att-fol-mural__eyebrow">${escapeHtml(d.toLocaleDateString('pt-BR', { weekday: 'short' }))}</p>
          <p class="att-fol-mural__date">${day} <span style="font-size: 22px; color: var(--gold-soft);">${monthLab}</span></p>
          <p class="att-fol-mural__title">${escapeHtml(m.group?.name || 'Encontro')}</p>
        </div>
        <div class="att-fol-mural__foot">
          <span>${present} de ${total} presentes</span>
          <span class="att-fol-mural__seal">${pct}%</span>
        </div>
        <div class="att-fol-mural__page">${codexPage({ size: 160 })}</div>
      </a>
    `;
  }).join('');
}

// ---------- categorias justificadas ----------
function renderCategories(perGroupData) {
  const pane = document.getElementById('attCatsPane');
  const box = document.getElementById('attCats');
  if (!box || !pane) return;

  const counts = Object.fromEntries(JUSTIFICATION_CATEGORIES.map((c) => [c.value, 0]));
  let nullCount = 0;
  let total = 0;
  for (const { meetings } of perGroupData) {
    for (const m of meetings) {
      if (m.status !== 'happened') continue;
      for (const a of (m.attendance || [])) {
        if (!a.justified || a.is_present) continue;
        total++;
        const cat = a.justification_category;
        if (cat && counts[cat] !== undefined) counts[cat]++;
        else nullCount++;
      }
    }
  }

  if (total === 0) {
    pane.hidden = true;
    return;
  }
  pane.hidden = false;

  const max = Math.max(1, ...Object.values(counts), nullCount);
  box.innerHTML = JUSTIFICATION_CATEGORIES.map((c) => {
    const n = counts[c.value] + (c.value === 'outro' ? nullCount : 0);
    const isEmpty = n === 0;
    const pct = total > 0 ? Math.round(n / total * 100) : 0;
    const barWidth = max > 0 ? Math.max(2, Math.round(n / max * 100)) : 0;
    return `
      <div class="att-fol-cat-card ${isEmpty ? 'is-empty' : ''}">
        <div class="att-fol-cat-card__head">
          <span class="att-fol-cat-card__icon">${categoryIcon(c.value, { size: 20 })}</span>
          <span class="att-fol-cat-card__label">${escapeHtml(c.label)}</span>
        </div>
        <span class="att-fol-cat-card__num">${n}<small>· ${pct}%</small></span>
        <div class="att-fol-cat-card__bar"><div class="att-fol-cat-card__bar-fill" style="width: ${barWidth}%;"></div></div>
      </div>
    `;
  }).join('');
}

// ---------- helpers de UI mantidos ----------
function meetingBigV2(group, meeting) {
  const date = new Date(meeting.date + 'T00:00:00');
  const day = String(date.getDate()).padStart(2, '0');
  const monthShort = MONTH_SHORT[date.getMonth()];
  const weekday = WEEKDAY_LABELS[date.getDay()].slice(0, 3).toLowerCase();
  const time = group.start_time ? group.start_time.slice(0, 5) : null;
  return `
    <a class="att-meeting-big-v2 att-meeting-big-v2--${meeting.status}" href="#/presenca/encontros/${escapeAttr(meeting.id)}">
      <div class="att-meeting-big-v2__date">
        <strong>${day}</strong>
        <span>${escapeHtml(monthShort)} · ${escapeHtml(weekday)}</span>
      </div>
      <div class="att-meeting-big-v2__info">
        <strong>${escapeHtml(group.name)}</strong>
        <span>${time ? time + ' · ' : ''}${meetingStatusLabel(meeting.status)}</span>
      </div>
      ${icon('arrow-right', { size: 14 })}
    </a>
  `;
}

function meetingStatusLabel(s) {
  return { scheduled: 'agendado', happened: 'aconteceu', cancelled: 'cancelado' }[s] || s;
}

function alertRow(a) {
  const { person, group, isPrimary, status } = a;
  const sc = STATUS_COLORS[status.color];
  const detail = `${status.absences} falta${status.absences === 1 ? '' : 's'}` +
    (status.maxConsecutive > 1 ? ` · ${status.maxConsecutive} seguidas` : '');
  const severity = status.color === 'red' ? 'red' : 'orange';
  return `
    <li class="att-alert-v2 att-alert-v2--${severity}">
      ${avatarHtml(person?.full_name, { size: 'sm' })}
      <span class="att-dot att-dot--${status.color}" title="${escapeHtml(sc.label)}" aria-label="${escapeHtml(sc.label)}"></span>
      <div class="att-alert-v2__main">
        <strong>${escapeHtml(person?.full_name || '—')}</strong>
        <span class="muted">${escapeHtml(group.name)}${isPrimary ? ' · prioritário' : ''}</span>
      </div>
      <span class="att-alert-v2__detail">${escapeHtml(detail)}</span>
      <a class="btn btn--ghost btn--small" href="#/presenca/grupos/${escapeAttr(group.id)}">abrir</a>
    </li>
  `;
}

function greeting(d) {
  const h = d.getHours();
  if (h < 5) return 'boa madrugada';
  if (h < 12) return 'bom dia';
  if (h < 18) return 'boa tarde';
  return 'boa noite';
}

function formatDate(d, kind = 'short') {
  return d.toLocaleDateString('pt-BR', kind === 'long'
    ? { weekday: 'long', day: '2-digit', month: 'long' }
    : { day: '2-digit', month: '2-digit' });
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysAgo(base, n) {
  const x = new Date(base);
  x.setDate(x.getDate() - n);
  x.setHours(0, 0, 0, 0);
  return x;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
