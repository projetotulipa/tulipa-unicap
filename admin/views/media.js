// Dashboard de Mídia.

import { icon } from '../icons.js';
import * as data from '../media/data.js';
import { renderMediaNav } from './media-nav.js';

export async function renderMediaDashboard(ctx) {
  const { root } = ctx;

  root.innerHTML = `
    <div class="view">
      ${renderMediaNav('dashboard')}

      <header class="att-hero">
        <div>
          <p class="att-hero__eyebrow">artes &amp; mídias</p>
          <h1>Visão geral</h1>
          <p class="view__lede">Posts vindos da Pesquisa, tarefas em andamento e equipes ativas.</p>
        </div>
      </header>

      <section class="att-stats" id="mediaStats">
        ${skel()}${skel()}${skel()}${skel()}
      </section>

      <section class="att-row">
        <div class="att-pane">
          <header class="att-pane__head">
            <span class="att-pane__icon">${icon('spark', { size: 18 })}</span>
            <h2>Posts aguardando produção</h2>
            <p class="att-pane__hint">enviados pela Pesquisa</p>
          </header>
          <div id="incomingPostsBox" class="att-pane__body"><div class="skel skel--block"></div></div>
        </div>
        <div class="att-pane">
          <header class="att-pane__head">
            <span class="att-pane__icon att-pane__icon--alert">${icon('clock', { size: 18 })}</span>
            <h2>Tarefas com prazo próximo</h2>
          </header>
          <div id="dueTasksBox" class="att-pane__body"><div class="skel skel--block"></div></div>
        </div>
      </section>
    </div>
  `;

  loadAll().catch((e) => console.error(e));
}

function skel() { return `<div class="att-stat att-stat--skel"><div class="skel" style="height:70px;"></div></div>`; }

async function loadAll() {
  const [{ data: incoming }, { data: tasks }, { data: teams }] = await Promise.all([
    data.listIncomingPosts(),
    data.listTasks(),
    data.listTeams(),
  ]);

  const incomingCount = (incoming || []).filter((p) => p.status === 'sent_to_media').length;
  const todoCount = (tasks || []).filter((t) => t.status === 'todo').length;
  const progressCount = (tasks || []).filter((t) => t.status === 'in_progress').length;
  const teamCount = (teams || []).length;

  document.getElementById('mediaStats').innerHTML = `
    ${statCard(icon('spark', { size: 20 }), incomingCount, 'aguardando produção', incomingCount > 0 ? 'warning' : null)}
    ${statCard(icon('check-circle', { size: 20 }), todoCount, 'tarefas a fazer')}
    ${statCard(icon('clock', { size: 20 }), progressCount, 'em andamento')}
    ${statCard(icon('group', { size: 20 }), teamCount, teamCount === 1 ? 'equipe' : 'equipes')}
  `;

  // posts aguardando
  const incomingBox = document.getElementById('incomingPostsBox');
  const waiting = (incoming || []).filter((p) => p.status === 'sent_to_media').slice(0, 5);
  if (!waiting.length) {
    incomingBox.innerHTML = `<p class="muted">Nenhum post aguardando. <a href="#/midia/posts">ver todos</a></p>`;
  } else {
    incomingBox.innerHTML = `
      <ul class="fin-list">
        ${waiting.map((p) => `
          <li class="fin-list-item">
            <div>
              <strong>${escapeHtml(p.title)}</strong>
              ${p.research_note ? `<span class="muted" style="display:block; font-size:12px;">de ${escapeHtml(p.research_note.title)}</span>` : ''}
            </div>
            <a class="btn btn--ghost btn--small" href="#/midia/posts">abrir</a>
          </li>
        `).join('')}
      </ul>
    `;
  }

  // tarefas com prazo
  const dueBox = document.getElementById('dueTasksBox');
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (tasks || [])
    .filter((t) => t.status !== 'done' && t.due_date && t.due_date >= today)
    .slice(0, 5);
  if (!upcoming.length) {
    dueBox.innerHTML = `<p class="muted">Nenhuma tarefa com prazo próximo.</p>`;
  } else {
    dueBox.innerHTML = `
      <ul class="fin-list">
        ${upcoming.map((t) => {
          const d = new Date(t.due_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          return `
            <li class="fin-list-item">
              <div>
                <strong>${escapeHtml(t.title)}</strong>
                <span class="muted" style="display:block; font-size:12px;">${escapeHtml(t.team?.name || 'sem equipe')}${t.assignee ? ' · ' + escapeHtml(t.assignee.full_name) : ''}</span>
              </div>
              <span class="pill pill--gold">${escapeHtml(d)}</span>
            </li>
          `;
        }).join('')}
      </ul>
    `;
  }
}

function statCard(iconHtml, value, label, tone = null) {
  const toneClass = tone ? ` att-stat--${tone}` : '';
  return `<div class="att-stat${toneClass}">
    <span class="att-stat__icon">${iconHtml}</span>
    <div><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(label)}</span></div>
  </div>`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
