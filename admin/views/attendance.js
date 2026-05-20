// Dashboard de presença reformulado.

import { icon } from '../icons.js';
import * as data from '../attendance/data.js';
import { calcMonthlyStatus, STATUS_COLORS, severityOf, currentMonthRange, monthLabel } from '../attendance/status.js';
import { renderSubNav } from './attendance-nav.js';
import { avatarHtml } from '../avatar.js';

const WEEKDAY_LABELS = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

export async function renderAttendanceDashboard(ctx) {
  const { root, state } = ctx;
  const { year, month, from, to } = currentMonthRange();
  const today = new Date();

  root.innerHTML = `
    <div class="view">
      ${renderSubNav('dashboard')}

      <header class="att-hero">
        <div>
          <p class="att-hero__eyebrow">${escapeHtml(greeting(today))} · ${escapeHtml(formatDate(today, 'long'))}</p>
          <h1>Presença</h1>
          <p class="view__lede">
            Acompanhe quem está em dia e quem precisa de atenção em <strong>${escapeHtml(monthLabel(year, month))}</strong>.
          </p>
        </div>
        <div class="att-hero__cta">
          ${ctx.api.canManageAttendance() && state.role === 'admin' ? `
            <a class="btn btn--ghost btn--small" href="#/presenca/grupos">
              ${icon('plus', { size: 14 })}<span style="margin-left:6px;">novo grupo</span>
            </a>
          ` : ''}
        </div>
      </header>

      <section class="att-stats" id="attStats">
        ${renderStatSkel()}${renderStatSkel()}${renderStatSkel()}${renderStatSkel()}
      </section>

      <section class="att-row">
        <div class="att-pane att-pane--today">
          <header class="att-pane__head">
            <span class="att-pane__icon">${icon('clock', { size: 18 })}</span>
            <h2>Hoje</h2>
          </header>
          <div id="attToday" class="att-pane__body">
            <div class="skel skel--block"></div>
          </div>
        </div>

        <div class="att-pane">
          <header class="att-pane__head">
            <span class="att-pane__icon">${icon('calendar', { size: 18 })}</span>
            <h2>Próximos 7 dias</h2>
          </header>
          <div id="attUpcoming" class="att-pane__body">
            <div class="skel skel--block"></div>
          </div>
        </div>
      </section>

      <section class="att-pane att-pane--full">
        <header class="att-pane__head">
          <span class="att-pane__icon att-pane__icon--alert">${icon('alert', { size: 18 })}</span>
          <h2>Alertas do mês</h2>
          <p class="att-pane__hint">Pessoas em laranja ou vermelho. Prioritários listados primeiro.</p>
        </header>
        <div id="attAlerts" class="att-pane__body">
          <div class="skel skel--block"></div>
        </div>
      </section>
    </div>
  `;

  // carrega tudo em paralelo
  loadEverything({ year, month, from, to, today });
}

async function loadEverything({ year, month, from, to, today }) {
  const { data: groups } = await data.listGroups();
  const { data: people } = await data.listPeople();

  if (!groups?.length) {
    document.getElementById('attStats').innerHTML = '';
    document.getElementById('attToday').innerHTML = '';
    document.getElementById('attUpcoming').innerHTML = '';
    document.getElementById('attAlerts').innerHTML = `
      <div class="att-empty">
        <div class="att-empty__art">${icon('group', { size: 56 })}</div>
        <h3>Nenhum grupo ainda</h3>
        <p>Comece criando um grupo para começar a registrar presenças.</p>
        <a class="btn btn--primary" href="#/presenca/grupos">Criar primeiro grupo</a>
      </div>
    `;
    return;
  }

  // === stats agregados ===
  const todayStr = isoDate(today);
  const weekFromStr = todayStr;
  const weekToStr = isoDate(new Date(today.getTime() + 6 * 86400000));

  const perGroupData = await Promise.all(groups.map(async (g) => {
    const [meetingsRes, membersRes] = await Promise.all([
      data.listAttendanceByGroupInRange(g.id, from, to),
      data.listMembershipsOfGroup(g.id),
    ]);
    return {
      group: g,
      meetings: meetingsRes.data || [],
      members: membersRes.data || [],
    };
  }));

  // % presença geral do mês (soma presentes / soma esperadas em meetings que aconteceram)
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

  document.getElementById('attStats').innerHTML = `
    ${statCard(icon('group', { size: 20 }), groups.length, groups.length === 1 ? 'grupo ativo' : 'grupos ativos')}
    ${statCard(icon('users', { size: 20 }), people?.length || 0, (people?.length === 1) ? 'pessoa cadastrada' : 'pessoas cadastradas')}
    ${statCard(icon('calendar', { size: 20 }), perGroupData.reduce((acc, x) => acc + x.meetings.filter(m => m.status === 'happened').length, 0), 'encontros este mês')}
    ${statCard(icon('check-circle', { size: 20 }), pct === null ? '—' : `${pct}%`, 'presença média', pct !== null ? (pct >= 70 ? 'success' : pct >= 50 ? 'warning' : 'danger') : null)}
  `;

  // Hoje
  upcomingMeetings.sort((a, b) => a.meeting.date.localeCompare(b.meeting.date));
  const todayBox = document.getElementById('attToday');
  if (todaysMeetings.length === 0) {
    todayBox.innerHTML = `<p class="muted att-pane__empty">Nenhum encontro hoje.</p>`;
  } else {
    todayBox.innerHTML = todaysMeetings.map(({ group, meeting }) => meetingChipBig(group, meeting)).join('');
  }

  const upBox = document.getElementById('attUpcoming');
  if (upcomingMeetings.length === 0) {
    upBox.innerHTML = `<p class="muted att-pane__empty">Nenhum encontro nos próximos 7 dias.</p>`;
  } else {
    upBox.innerHTML = upcomingMeetings.slice(0, 5).map(({ group, meeting }) => meetingChipBig(group, meeting)).join('');
  }

  // Alertas
  alerts.sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return severityOf(b.status.color) - severityOf(a.status.color);
  });
  const alertsBox = document.getElementById('attAlerts');
  if (alerts.length === 0) {
    alertsBox.innerHTML = `
      <div class="att-empty att-empty--ok">
        <div class="att-empty__art">${icon('check-circle', { size: 56 })}</div>
        <p>Ninguém em laranja ou vermelho este mês.</p>
      </div>
    `;
  } else {
    alertsBox.innerHTML = `<ul class="att-alerts">${alerts.map(alertRow).join('')}</ul>`;
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

function renderStatSkel() {
  return `<div class="att-stat att-stat--skel"><div class="skel skel--block" style="height:48px;"></div></div>`;
}

function meetingChipBig(group, meeting) {
  const date = new Date(meeting.date + 'T00:00:00');
  const day = String(date.getDate()).padStart(2, '0');
  const monthShort = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][date.getMonth()];
  const weekday = WEEKDAY_LABELS[date.getDay()].slice(0, 3).toLowerCase();
  const time = group.start_time ? group.start_time.slice(0, 5) : null;
  return `
    <a class="att-meeting-big att-meeting-big--${meeting.status}" href="#/presenca/encontros/${escapeAttr(meeting.id)}">
      <div class="att-meeting-big__date">
        <strong>${day}</strong>
        <span>${escapeHtml(monthShort)} · ${escapeHtml(weekday)}</span>
      </div>
      <div class="att-meeting-big__info">
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
  return `
    <li class="att-alert att-alert--${status.color}">
      ${avatarHtml(person?.full_name, { size: 'sm' })}
      <span class="att-dot att-dot--${status.color}" title="${escapeHtml(sc.label)}"></span>
      <div class="att-alert__main">
        <strong>${escapeHtml(person?.full_name || '—')}</strong>
        <span class="muted">${escapeHtml(group.name)}${isPrimary ? ' · prioritário' : ''}</span>
      </div>
      <span class="att-alert__detail">${escapeHtml(detail)}</span>
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
