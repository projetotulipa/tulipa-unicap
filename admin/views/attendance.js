// Dashboard de presença — Sprint 1 (identidade editorial "Registro Aberto").
// Hero codex + stats Cormorant 42px + paneis Hoje/Próximos + Alertas, paleta sage+rose+gold.

import { icon } from '../icons.js';
import * as data from '../attendance/data.js';
import { calcMonthlyStatus, STATUS_COLORS, severityOf, currentMonthRange, monthLabel, shortRangeLabel } from '../attendance/status.js';
import { renderSubNav } from './attendance-nav.js';
import { avatarHtml } from '../avatar.js';
import { codexSeal, codexPage, codexEmblem } from '../attendance/codex.js';

const WEEKDAY_LABELS = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

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

      <header class="att-hero-v2">
        <div class="att-hero-v2__seal-wrap">
          <span class="att-codex-seal">${codexSeal({ size: 32 })}</span>
        </div>
        <div class="att-hero-v2__inner">
          <p class="att-hero-v2__eyebrow">${escapeHtml(greeting(today))} · ${escapeHtml(formatDate(today, 'long'))}</p>
          <h1>Registro de presenças</h1>
          <p class="att-hero-v2__lede">
            Acompanhe quem está em dia e quem pede atenção em <strong>${escapeHtml(periodLabel)}</strong>.
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
    </div>
  `;

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

  let totalSlots = 0;
  let totalPresent = 0;
  const todaysMeetings = [];
  const upcomingMeetings = [];
  const alerts = [];

  for (const { group, meetings, members } of perGroupData) {
    for (const m of meetings) {
      if (m.status === 'happened') {
        totalSlots += members.length;
        totalPresent += (m.attendance || []).filter((a) => a.is_present).length;
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
      }
    }
  }

  const pct = totalSlots > 0 ? Math.round((totalPresent / totalSlots) * 100) : null;
  const happenedCount = perGroupData.reduce((acc, x) => acc + x.meetings.filter(m => m.status === 'happened').length, 0);

  const pctTone = pct === null ? null
    : pct >= 70 ? 'success'
    : pct >= 50 ? 'gold'
    : pct >= 30 ? 'warning'
    : 'danger';

  document.getElementById('attStats').innerHTML = `
    ${statCard(icon('group', { size: 22 }), groups.length, groups.length === 1 ? 'grupo ativo' : 'grupos ativos', null)}
    ${statCard(icon('users', { size: 22 }), people.length, people.length === 1 ? 'pessoa cadastrada' : 'pessoas cadastradas', 'rose')}
    ${statCard(icon('calendar', { size: 22 }), happenedCount, range.semester ? 'encontros no semestre' : 'encontros no mês', 'gold')}
    ${statCard(icon('check-circle', { size: 22 }), pct === null ? '—' : `${pct}%`, 'presença média', pctTone)}
  `;

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

function meetingBigV2(group, meeting) {
  const date = new Date(meeting.date + 'T00:00:00');
  const day = String(date.getDate()).padStart(2, '0');
  const monthShort = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][date.getMonth()];
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

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
