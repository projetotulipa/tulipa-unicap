// Calendário simples — tarefas agrupadas por data.

import { icon } from '../icons.js';
import * as data from '../media/data.js';
import { renderMediaNav } from './media-nav.js';
import { avatarHtml } from '../avatar.js';

export async function renderMediaCalendar(ctx) {
  const { root } = ctx;

  root.innerHTML = `
    <div class="view">
      ${renderMediaNav('calendar')}

      <header class="view__header">
        <div>
          <h1>Calendário de tarefas</h1>
          <p class="view__lede">Tarefas agrupadas por data limite. Em breve uma visão mensal mais visual.</p>
        </div>
      </header>

      <div id="calBody" class="empty-state"><div class="skel skel--block"></div></div>
    </div>
  `;

  await loadCalendar();
}

async function loadCalendar() {
  const box = document.getElementById('calBody');
  const { data: tasks, error } = await data.listTasks();
  if (error) { box.innerHTML = `<p class="muted">${error.message}</p>`; return; }
  const withDate = (tasks || []).filter((t) => t.due_date);
  if (!withDate.length) {
    box.innerHTML = `
      <div class="media-empty">
        <div class="media-empty__art">${icon('calendar', { size: 48 })}</div>
        <h3>Nenhuma tarefa com prazo</h3>
        <p>Defina datas-limite nas tarefas pra elas aparecerem aqui — assim você acompanha o ritmo das entregas em ordem cronológica.</p>
      </div>
    `;
    return;
  }

  // agrupa por data
  const byDate = new Map();
  for (const t of withDate) {
    if (!byDate.has(t.due_date)) byDate.set(t.due_date, []);
    byDate.get(t.due_date).push(t);
  }
  const dates = Array.from(byDate.keys()).sort();
  const today = new Date().toISOString().slice(0, 10);

  // contagem de atrasadas (prazo no passado e não-concluídas)
  const lateCount = withDate.filter((t) => t.due_date < today && t.status !== 'done').length;

  box.className = '';
  const banner = lateCount > 0
    ? `<div class="media-cal-banner">
         ${icon('alert', { size: 18 })}
         <span><strong>${lateCount}</strong> ${lateCount === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'} aguardando ação.</span>
         <a href="#/midia/tarefas" class="media-pill media-pill--late">ver no kanban</a>
       </div>`
    : '';

  box.innerHTML = banner + dates.map((d) => {
    const ts = byDate.get(d);
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

function statusToDot(s) {
  return { todo: 'yellow', in_progress: 'orange', done: 'green' }[s] || 'gray';
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
