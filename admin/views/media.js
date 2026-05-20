// Dashboard de Mídia.

import { icon } from '../icons.js';
import * as data from '../media/data.js';
import { renderMediaNav } from './media-nav.js';

// pétala SVG decorativa (mesma forma do favicon mas isolada)
const PETAL_SVG = `
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M50 18 C 32 28, 26 50, 32 66 C 38 80, 50 82, 50 82 C 50 82, 62 80, 68 66 C 74 50, 68 28, 50 18 Z"
      fill="currentColor" opacity="0.85"/>
    <path d="M50 78 L50 96" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.5"/>
    <path d="M44 36 C 44 46, 46 56, 50 62" stroke="currentColor" stroke-width="0.8" fill="none" opacity="0.4"/>
  </svg>
`;

export async function renderMediaDashboard(ctx) {
  const { root } = ctx;

  root.innerHTML = `
    <div class="view">
      ${renderMediaNav('dashboard')}

      <header class="media-hero">
        <div class="media-hero__petal">${PETAL_SVG}</div>
        <div class="media-hero__inner">
          <p class="media-hero__eyebrow">artes &amp; mídias</p>
          <h1>Visão geral</h1>
          <p class="media-hero__lede">Posts vindos da Pesquisa, tarefas em andamento e equipes ativas. Onde a forma encontra a palavra.</p>
        </div>
      </header>

      <section class="media-stats" id="mediaStats">
        ${skel()}${skel()}${skel()}${skel()}
      </section>

      <section class="media-pane" id="pipelinePane" style="display:none; margin-bottom:14px;">
        <header class="media-pane__head">
          <span class="media-pane__icon">${icon('spark', { size: 18 })}</span>
          <h2>Pipeline editorial</h2>
          <p class="media-pane__hint">do fichamento ao publicado</p>
        </header>
        <div class="media-pipeline" id="pipelineRow"></div>
      </section>

      <section class="media-pane" id="skylinePane" style="display:none; margin-bottom:14px;">
        <header class="media-pane__head">
          <span class="media-pane__icon">${icon('calendar', { size: 18 })}</span>
          <h2>Próximas 4 semanas</h2>
          <p class="media-pane__hint">altura = nº de prazos por dia</p>
        </header>
        <div class="media-skyline" id="skylineRow"></div>
      </section>

      <section class="media-pane__row">
        <div class="media-pane">
          <header class="media-pane__head">
            <span class="media-pane__icon">${icon('spark', { size: 18 })}</span>
            <h2>Posts aguardando produção</h2>
            <p class="media-pane__hint">enviados pela Pesquisa</p>
          </header>
          <div id="incomingPostsBox"><div class="skel skel--block"></div></div>
        </div>
        <div class="media-pane">
          <header class="media-pane__head">
            <span class="media-pane__icon media-pane__icon--alert">${icon('clock', { size: 18 })}</span>
            <h2>Tarefas com prazo próximo</h2>
            <p class="media-pane__hint">próximos 14 dias</p>
          </header>
          <div id="dueTasksBox"><div class="skel skel--block"></div></div>
        </div>
      </section>
    </div>
  `;

  loadAll().catch((e) => console.error(e));
}

function skel() {
  return `<div class="media-stat media-stat--skel"><div class="skel"></div></div>`;
}

async function loadAll() {
  const [{ data: incoming }, { data: tasks }, { data: teams }] = await Promise.all([
    data.listIncomingPosts(),
    data.listTasks(),
    data.listTeams(),
  ]);

  const incomingArr = incoming || [];
  const tasksArr = tasks || [];

  const aguardando  = incomingArr.filter((p) => p.status === 'sent_to_media').length;
  const agendados   = incomingArr.filter((p) => p.status === 'scheduled').length;
  const todoCount   = tasksArr.filter((t) => t.status === 'todo').length;
  const progressCount = tasksArr.filter((t) => t.status === 'in_progress').length;
  const teamCount   = (teams || []).length;

  document.getElementById('mediaStats').innerHTML = `
    ${statCard(icon('spark', { size: 20 }), aguardando, 'aguardando produção', aguardando > 0 ? 'warning' : null)}
    ${statCard(icon('check-circle', { size: 20 }), todoCount, 'tarefas a fazer')}
    ${statCard(icon('clock', { size: 20 }), progressCount, 'em andamento')}
    ${statCard(icon('group', { size: 20 }), teamCount, teamCount === 1 ? 'equipe' : 'equipes', 'success')}
  `;

  // mini-pipeline (mostra só se tiver algo)
  const publicados = incomingArr.filter((p) => p.status === 'published').length;
  const totalPipeline = aguardando + agendados + progressCount + publicados;
  if (totalPipeline > 0 || todoCount > 0) {
    const pane = document.getElementById('pipelinePane');
    const row  = document.getElementById('pipelineRow');
    pane.style.display = '';
    row.innerHTML = pipelineRow([
      { label: 'a fazer',     num: todoCount,      href: '#/midia/tarefas' },
      { label: 'aguardando',  num: aguardando,     href: '#/midia/posts' },
      { label: 'em produção', num: progressCount,  href: '#/midia/tarefas' },
      { label: 'agendado',    num: agendados,      href: '#/midia/posts' },
      { label: 'publicado',   num: publicados,     href: '#/midia/posts' },
    ]);
  }

  // skyline de 4 semanas (mostra só se tiver tarefa com prazo nesse horizonte)
  const tasksWithDate = tasksArr.filter((t) => t.due_date);
  if (tasksWithDate.length > 0) {
    const pane = document.getElementById('skylinePane');
    const row  = document.getElementById('skylineRow');
    const todayStr = new Date().toISOString().slice(0, 10);
    const horizonEnd = addDays(todayStr, 27);
    const inHorizon = tasksWithDate.filter((t) => t.due_date >= todayStr && t.due_date <= horizonEnd);
    if (inHorizon.length > 0) {
      pane.style.display = '';
      row.innerHTML = skylineBars(todayStr, 28, tasksWithDate);
    }
  }

  // posts aguardando
  const incomingBox = document.getElementById('incomingPostsBox');
  const waiting = incomingArr.filter((p) => p.status === 'sent_to_media').slice(0, 5);
  if (!waiting.length) {
    incomingBox.innerHTML = `<p class="muted" style="margin:0;">Nenhum post aguardando. <a href="#/midia/posts">ver todos</a></p>`;
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

  // tarefas com prazo próximo
  const dueBox = document.getElementById('dueTasksBox');
  const today = new Date().toISOString().slice(0, 10);
  const horizon = addDays(today, 14);
  const upcoming = tasksArr
    .filter((t) => t.status !== 'done' && t.due_date && t.due_date >= today && t.due_date <= horizon)
    .slice(0, 5);
  if (!upcoming.length) {
    dueBox.innerHTML = `<p class="muted" style="margin:0;">Nenhuma tarefa nos próximos 14 dias.</p>`;
  } else {
    dueBox.innerHTML = `
      <ul class="fin-list">
        ${upcoming.map((t) => {
          const d = new Date(t.due_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          const days = daysUntil(t.due_date);
          const urgencyClass = urgencyFromDays(days);
          return `
            <li class="fin-list-item">
              <div style="display:flex; align-items:center; gap:10px;">
                <span class="media-urgency ${urgencyClass}" aria-hidden="true"></span>
                <div>
                  <strong>${escapeHtml(t.title)}</strong>
                  <span class="muted" style="display:block; font-size:12px;">${escapeHtml(t.team?.name || 'sem equipe')}${t.assignee ? ' · ' + escapeHtml(t.assignee.full_name) : ''}</span>
                </div>
              </div>
              <span class="media-pill media-pill--progress">${icon('clock', { size: 11 })}<span>${escapeHtml(d)}</span></span>
            </li>
          `;
        }).join('')}
      </ul>
    `;
  }
}

function statCard(iconHtml, value, label, tone = null) {
  const toneClass = tone ? ` media-stat--${tone}` : '';
  return `<div class="media-stat${toneClass}">
    <div class="media-stat__body">
      <strong class="media-stat__num">${escapeHtml(String(value))}</strong>
      <span class="media-stat__label">${escapeHtml(label)}</span>
    </div>
    <span class="media-stat__icon">${iconHtml}</span>
  </div>`;
}

function pipelineRow(nodes) {
  const arrow = `<span class="media-pipeline__arrow" aria-hidden="true">${icon('chevron', { size: 14 })}</span>`;
  return nodes.map((n, i) => {
    const node = `
      <a class="media-pipeline__node" href="${escapeAttr(n.href || '#')}">
        <span class="media-pipeline__num">${escapeHtml(String(n.num))}</span>
        <span class="media-pipeline__label">${escapeHtml(n.label)}</span>
      </a>`;
    return i < nodes.length - 1 ? node + arrow : node;
  }).join('');
}

function escapeAttr(s) { return escapeHtml(s); }

function skylineBars(startIso, days, tasks) {
  // conta tarefas por dia (todas, incluindo done — para mostrar carga histórica + futura)
  const byDate = new Map();
  for (const t of tasks) {
    if (!t.due_date) continue;
    byDate.set(t.due_date, (byDate.get(t.due_date) || 0) + 1);
  }
  // escala: maior valor no horizonte vira 100%
  const horizonDates = [];
  for (let i = 0; i < days; i++) horizonDates.push(addDays(startIso, i));
  const maxN = Math.max(1, ...horizonDates.map((d) => byDate.get(d) || 0));

  const today = startIso;
  return horizonDates.map((iso) => {
    const n = byDate.get(iso) || 0;
    const pct = Math.round((n / maxN) * 100);
    const isToday = iso === today;
    const isLate = iso < today; // não chega aqui já que horizonte = hoje+27, mas defensivo
    const dObj = new Date(iso + 'T00:00:00');
    const tooltip = `${dObj.getDate()}/${dObj.getMonth() + 1} · ${n} ${n === 1 ? 'tarefa' : 'tarefas'}`;
    return `
      <div class="media-skyline__bar ${isToday ? 'media-skyline__bar--today' : ''} ${isLate ? 'media-skyline__bar--late' : ''}"
           data-tooltip="${escapeHtml(tooltip)}">
        <div class="media-skyline__fill" style="height:${pct}%;"></div>
      </div>
    `;
  }).join('');
}

function addDays(isoDate, days) {
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysUntil(isoDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate + 'T00:00:00');
  return Math.round((target - today) / 86400000);
}

function urgencyFromDays(days) {
  if (days < 0) return 'media-urgency--late';
  if (days <= 1) return 'media-urgency--close';
  if (days <= 6) return 'media-urgency--soon';
  return 'media-urgency--ok';
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
