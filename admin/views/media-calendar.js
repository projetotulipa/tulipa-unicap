// Calendário de tarefas — 3 views: mensal (grade), semanal e lista.

import { icon } from '../icons.js';
import * as data from '../media/data.js';
import { renderMediaNav } from './media-nav.js';
import { avatarHtml } from '../avatar.js';

const PETAL_MINI = `
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M50 18 C 32 28, 26 50, 32 66 C 38 80, 50 82, 50 82 C 50 82, 62 80, 68 66 C 74 50, 68 28, 50 18 Z" fill="currentColor"/>
    <path d="M50 78 L50 96" stroke="currentColor" stroke-width="1.5" fill="none"/>
  </svg>
`;

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const calState = {
  view: 'month',          // 'month' | 'week' | 'list'
  cursor: startOfMonth(new Date()), // mês ou semana visível
};
let cachedTasks = [];

export async function renderMediaCalendar(ctx) {
  const { root } = ctx;

  root.innerHTML = `
    <div class="view">
      ${renderMediaNav('calendar')}

      <header class="view__header">
        <div class="media-section-petal">${PETAL_MINI}</div>
        <div>
          <h1>Calendário de tarefas</h1>
          <p class="view__lede">Veja o ritmo das entregas no mês ou na semana. Click num dia abre as tarefas daquela data.</p>
        </div>
      </header>

      <div id="calNav"></div>

      <div id="calBody"><div class="media-loading-wrap"><div class="media-bloom"><span class="media-bloom__petal" aria-hidden="true"></span></div><span>carregando calendário…</span></div></div>
    </div>
  `;

  await loadCalendar();
}

async function loadCalendar() {
  const { data: tasks, error } = await data.listTasks();
  if (error) {
    document.getElementById('calBody').innerHTML = `<p class="muted">${error.message}</p>`;
    return;
  }
  cachedTasks = (tasks || []).filter((t) => t.due_date);
  renderNav();
  renderView();
}

function renderNav() {
  const box = document.getElementById('calNav');
  const titleTxt = calState.view === 'week'
    ? formatWeekRange(calState.cursor)
    : `${MONTHS[calState.cursor.getMonth()]} ${calState.cursor.getFullYear()}`;

  box.innerHTML = `
    <div class="media-cal-nav">
      <button class="media-cal-nav__arrow" id="calPrev" aria-label="Anterior">${arrowIcon('left')}</button>
      <h2 class="media-cal-nav__title">${escapeHtml(titleTxt)}</h2>
      <button class="media-cal-nav__arrow" id="calNext" aria-label="Próximo">${arrowIcon('right')}</button>
      <button class="media-cal-nav__today" id="calToday">hoje</button>

      <span class="media-cal-nav__spacer"></span>

      <div class="media-view-toggle">
        <button data-view="month" class="${calState.view === 'month' ? 'is-active' : ''}">${icon('departamentos', { size: 14 })}<span>mês</span></button>
        <button data-view="week"  class="${calState.view === 'week'  ? 'is-active' : ''}">${icon('marquee', { size: 14 })}<span>semana</span></button>
        <button data-view="list"  class="${calState.view === 'list'  ? 'is-active' : ''}">${icon('attendance', { size: 14 })}<span>lista</span></button>
      </div>
    </div>
  `;

  box.querySelector('#calPrev').addEventListener('click', () => { stepCursor(-1); });
  box.querySelector('#calNext').addEventListener('click', () => { stepCursor(+1); });
  box.querySelector('#calToday').addEventListener('click', () => {
    calState.cursor = calState.view === 'week' ? startOfWeek(new Date()) : startOfMonth(new Date());
    renderNav();
    renderView();
  });
  box.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const newView = btn.dataset.view;
      // ao trocar de view, mantém referência sensata
      if (newView === 'week') {
        calState.cursor = startOfWeek(calState.cursor);
      } else if (newView === 'month') {
        calState.cursor = startOfMonth(calState.cursor);
      }
      calState.view = newView;
      renderNav();
      renderView();
    });
  });
}

function stepCursor(direction) {
  const d = new Date(calState.cursor);
  if (calState.view === 'week') {
    d.setDate(d.getDate() + 7 * direction);
    calState.cursor = startOfWeek(d);
  } else if (calState.view === 'month') {
    d.setMonth(d.getMonth() + direction);
    calState.cursor = startOfMonth(d);
  } else {
    d.setMonth(d.getMonth() + direction);
    calState.cursor = startOfMonth(d);
  }
  renderNav();
  renderView();
}

function renderView() {
  const box = document.getElementById('calBody');

  if (!cachedTasks.length) {
    box.innerHTML = `
      <div class="media-empty">
        <div class="media-empty__art">${icon('calendar', { size: 48 })}</div>
        <h3>Nenhuma tarefa com prazo</h3>
        <p>Defina datas-limite nas tarefas pra elas aparecerem aqui — assim você acompanha o ritmo das entregas no calendário.</p>
      </div>
    `;
    return;
  }

  // banner de atrasadas (sempre que houver, em qualquer view)
  const today = isoDate(new Date());
  const lateCount = cachedTasks.filter((t) => t.due_date < today && t.status !== 'done').length;
  const banner = lateCount > 0
    ? `<div class="media-cal-banner">
         ${icon('alert', { size: 18 })}
         <span><strong>${lateCount}</strong> ${lateCount === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'} aguardando ação.</span>
         <a href="#/midia/tarefas" class="media-pill media-pill--late">ver no kanban</a>
       </div>`
    : '';

  let html = banner;
  if (calState.view === 'month') html += renderMonth();
  else if (calState.view === 'week') html += renderWeek();
  else html += renderList();

  box.innerHTML = html;

  // bind clicks em células do mês
  if (calState.view === 'month') {
    box.querySelectorAll('[data-day]').forEach((cell) => {
      cell.addEventListener('click', () => openDayDrawer(cell.dataset.day));
    });
  }
  // bind clicks em blocos da semana
  if (calState.view === 'week') {
    box.querySelectorAll('[data-task-id]').forEach((el) => {
      el.addEventListener('click', () => location.hash = '#/midia/tarefas');
    });
  }
}

function renderMonth() {
  const cursor = calState.cursor; // 1º dia do mês
  const firstDay = new Date(cursor);
  const startOffset = firstDay.getDay(); // 0 = dom
  const gridStart = new Date(firstDay);
  gridStart.setDate(gridStart.getDate() - startOffset);

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    cells.push(d);
  }

  const today = isoDate(new Date());
  const tasksByDate = groupTasksByDate(cachedTasks);
  const month = cursor.getMonth();

  const weekdayHdr = WEEKDAYS.map((w) => `<div class="media-month-weekday">${w}</div>`).join('');

  const cellsHtml = cells.map((d) => {
    const iso = isoDate(d);
    const inMonth = d.getMonth() === month;
    const isToday = iso === today;
    const dayTasks = tasksByDate.get(iso) || [];
    const hasLate = dayTasks.some((t) => iso < today && t.status !== 'done');
    const classes = [
      'media-month-day',
      !inMonth && 'media-month-day--outside',
      isToday && 'media-month-day--today',
      hasLate && 'media-month-day--has-late',
    ].filter(Boolean).join(' ');

    // limita 4 dots, +N
    const dots = dayTasks.slice(0, 4).map((t) => {
      const cls = (iso < today && t.status !== 'done') ? 'late' : t.status;
      return `<span class="media-month-day__dot media-month-day__dot--${cls}"></span>`;
    }).join('');
    const more = dayTasks.length > 4 ? `<span class="media-month-day__count">+${dayTasks.length - 4}</span>` : '';

    return `
      <div class="${classes}" data-day="${iso}" role="button" tabindex="0">
        <span class="media-month-day__num">${d.getDate()}</span>
        <div class="media-month-day__dots">${dots}${more}</div>
      </div>
    `;
  }).join('');

  return `<div class="media-month-grid">${weekdayHdr}${cellsHtml}</div>`;
}

function renderWeek() {
  const start = startOfWeek(calState.cursor);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  const today = isoDate(new Date());
  const tasksByDate = groupTasksByDate(cachedTasks);

  return `
    <div class="media-week">
      ${days.map((d) => {
        const iso = isoDate(d);
        const isToday = iso === today;
        const isPast = iso < today && !isToday;
        const dayTasks = tasksByDate.get(iso) || [];
        const blocks = dayTasks.length ? dayTasks.map((t) => {
          const cls = (iso < today && t.status !== 'done') ? 'late' : t.status;
          return `
            <div class="media-week-block media-week-block--${cls}" data-task-id="${escapeAttr(t.id)}">
              <strong>${escapeHtml(t.title)}</strong>
              ${t.team ? `<span>${escapeHtml(t.team.name)}</span>` : ''}
            </div>
          `;
        }).join('') : `<p class="media-week-col__empty">vazio</p>`;
        return `
          <div class="media-week-col ${isToday ? 'media-week-col--today' : ''} ${isPast ? 'media-week-col--past' : ''}">
            <header class="media-week-col__head">
              <span class="media-week-col__weekday">${WEEKDAYS[d.getDay()]}</span>
              <span class="media-week-col__date">${d.getDate()}</span>
            </header>
            <div class="media-week-col__body">${blocks}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderList() {
  // mesma lista cronológica de antes, com hoje destacado
  const tasksByDate = groupTasksByDate(cachedTasks);
  const dates = Array.from(tasksByDate.keys()).sort();
  const today = isoDate(new Date());

  return dates.map((d) => {
    const ts = tasksByDate.get(d);
    const dObj = new Date(d + 'T00:00:00');
    const label = dObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
    const isPast  = d < today;
    const isToday = d === today;
    return `
      <section class="media-cal-day ${isPast ? 'is-past' : ''} ${isToday ? 'is-today' : ''}">
        <header class="media-cal-day__head">
          <span class="media-cal-day__date">
            <strong>${dObj.getDate()}</strong>
            <span>${escapeHtml(label)}${isToday ? ' · <em style="color:var(--rose-soft);">hoje</em>' : ''}</span>
          </span>
          <span class="muted">${ts.length} ${ts.length === 1 ? 'tarefa' : 'tarefas'}</span>
        </header>
        <ul class="media-cal-day__list">
          ${ts.map((t) => `
            <li class="media-cal-day__item">
              <span class="att-dot att-dot--${statusToDot(t.status)}"></span>
              <strong>${escapeHtml(t.title)}</strong>
              ${t.team ? `<span class="media-pill">${escapeHtml(t.team.name)}</span>` : ''}
              ${t.assignee ? avatarHtml(t.assignee.full_name, { size: 'sm' }) : ''}
            </li>
          `).join('')}
        </ul>
      </section>
    `;
  }).join('');
}

function openDayDrawer(iso) {
  const tasksByDate = groupTasksByDate(cachedTasks);
  const dayTasks = tasksByDate.get(iso) || [];
  if (!dayTasks.length) return;

  document.querySelectorAll('.media-cal-drawer').forEach((el) => el.remove());

  const dObj = new Date(iso + 'T00:00:00');
  const label = dObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const today = isoDate(new Date());

  const overlay = document.createElement('div');
  overlay.className = 'media-cal-drawer';
  overlay.innerHTML = `
    <div class="media-cal-drawer__panel" role="dialog" aria-modal="true">
      <header class="media-cal-drawer__head">
        <div>
          <h3>${dObj.getDate()} · ${MONTHS[dObj.getMonth()]}</h3>
          <p>${escapeHtml(label)} · ${dayTasks.length} ${dayTasks.length === 1 ? 'tarefa' : 'tarefas'}</p>
        </div>
        <button class="icon-btn" data-action="close" aria-label="Fechar">${icon('x', { size: 16 })}</button>
      </header>
      <div class="media-cal-drawer__body">
        ${dayTasks.map((t) => {
          const cls = (iso < today && t.status !== 'done') ? 'late' : t.status;
          return `
            <div class="media-cal-drawer__row media-cal-drawer__row--${cls}" data-task-id="${escapeAttr(t.id)}">
              <div>
                <strong>${escapeHtml(t.title)}</strong>
                <span>${escapeHtml(t.team?.name || 'sem equipe')}${t.assignee ? ' · ' + escapeHtml(t.assignee.full_name) : ''}</span>
              </div>
              <div class="media-cal-drawer__row-meta">
                ${t.assignee ? avatarHtml(t.assignee.full_name, { size: 'sm' }) : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
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

  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) return close();
    if (ev.target.closest('[data-action="close"]')) return close();
    const row = ev.target.closest('[data-task-id]');
    if (row) {
      location.hash = '#/midia/tarefas';
      close();
    }
  });
}

// ===== helpers =====

function groupTasksByDate(tasks) {
  const m = new Map();
  for (const t of tasks) {
    if (!t.due_date) continue;
    if (!m.has(t.due_date)) m.set(t.due_date, []);
    m.get(t.due_date).push(t);
  }
  return m;
}

function statusToDot(s) {
  return { todo: 'yellow', in_progress: 'orange', done: 'green' }[s] || 'gray';
}

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfWeek(d) {
  const out = new Date(d);
  out.setDate(out.getDate() - out.getDay()); // domingo como início
  out.setHours(0, 0, 0, 0);
  return out;
}

function formatWeekRange(start) {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${start.getDate()}–${end.getDate()} ${MONTHS[start.getMonth()]} ${start.getFullYear()}`;
  }
  const sameYear = start.getFullYear() === end.getFullYear();
  if (sameYear) {
    return `${start.getDate()} ${MONTHS[start.getMonth()].slice(0,3)} – ${end.getDate()} ${MONTHS[end.getMonth()].slice(0,3)} ${start.getFullYear()}`;
  }
  return `${start.getDate()} ${MONTHS[start.getMonth()].slice(0,3)} ${start.getFullYear()} – ${end.getDate()} ${MONTHS[end.getMonth()].slice(0,3)} ${end.getFullYear()}`;
}

function arrowIcon(dir) {
  // chevron reusado da icons.js, mas rotacionado
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true" style="transform: rotate(${dir === 'left' ? 90 : -90}deg);">
    <polyline points="6 9 12 15 18 9"/>
  </svg>`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
