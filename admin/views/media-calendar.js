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
      <div class="att-empty">
        <div class="att-empty__art">${icon('calendar', { size: 56 })}</div>
        <h3>Nenhuma tarefa com prazo</h3>
        <p>Defina datas-limite nas tarefas pra elas aparecerem aqui.</p>
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

  box.className = '';
  box.innerHTML = dates.map((d) => {
    const ts = byDate.get(d);
    const dObj = new Date(d + 'T00:00:00');
    const label = dObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
    const isPast = d < today;
    return `
      <section class="media-cal-day ${isPast ? 'is-past' : ''}">
        <header class="media-cal-day__head">
          <span class="media-cal-day__date">
            <strong>${dObj.getDate()}</strong>
            <span>${escapeHtml(label)}</span>
          </span>
          <span class="muted">${ts.length} ${ts.length === 1 ? 'tarefa' : 'tarefas'}</span>
        </header>
        <ul class="media-cal-day__list">
          ${ts.map((t) => `
            <li class="media-cal-day__item">
              <span class="att-dot att-dot--${statusToDot(t.status)}"></span>
              <strong>${escapeHtml(t.title)}</strong>
              ${t.team ? `<span class="pill">${escapeHtml(t.team.name)}</span>` : ''}
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
