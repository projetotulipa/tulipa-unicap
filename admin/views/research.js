// Dashboard de Pesquisa — atalhos + lista recente.

import { icon } from '../icons.js';
import * as data from '../research/data.js';
import { renderResearchNav } from './research-nav.js';

export async function renderResearchDashboard(ctx) {
  const { root } = ctx;

  root.innerHTML = `
    <div class="view">
      ${renderResearchNav('dashboard')}

      <header class="att-hero">
        <div>
          <p class="att-hero__eyebrow">pesquisa</p>
          <h1>Visão geral</h1>
          <p class="view__lede">Fichamentos teóricos das aulas e posts pra mandar à Mídia.</p>
        </div>
      </header>

      <section class="att-stats" id="researchStats">
        ${skel()}${skel()}${skel()}${skel()}
      </section>

      <section class="att-row">
        <div class="att-pane">
          <header class="att-pane__head">
            <span class="att-pane__icon">${icon('page', { size: 18 })}</span>
            <h2>Fichamentos recentes</h2>
          </header>
          <div id="recentNotes" class="att-pane__body">
            <div class="skel skel--block"></div>
          </div>
        </div>

        <div class="att-pane">
          <header class="att-pane__head">
            <span class="att-pane__icon">${icon('spark', { size: 18 })}</span>
            <h2>Posts em andamento</h2>
          </header>
          <div id="recentPosts" class="att-pane__body">
            <div class="skel skel--block"></div>
          </div>
        </div>
      </section>
    </div>
  `;

  loadAll().catch((e) => { console.error(e); });
}

function skel() { return `<div class="att-stat att-stat--skel"><div class="skel" style="height:70px;"></div></div>`; }

async function loadAll() {
  const [{ data: notes }, { data: posts }] = await Promise.all([
    data.listNotes({ limit: 50 }),
    data.listPosts(),
  ]);
  const noteCount = (notes || []).length;
  const draftCount = (posts || []).filter((p) => p.status === 'draft').length;
  const sentCount  = (posts || []).filter((p) => p.status === 'sent_to_media').length;
  const publishedCount = (posts || []).filter((p) => p.status === 'published').length;

  document.getElementById('researchStats').innerHTML = `
    ${statCard(icon('page', { size: 20 }), noteCount, noteCount === 1 ? 'fichamento' : 'fichamentos')}
    ${statCard(icon('edit', { size: 20 }), draftCount, 'rascunhos de post', draftCount > 0 ? 'warning' : null)}
    ${statCard(icon('arrow-right', { size: 20 }), sentCount, 'na mídia', sentCount > 0 ? 'success' : null)}
    ${statCard(icon('check-circle', { size: 20 }), publishedCount, 'publicados', null)}
  `;

  const notesBox = document.getElementById('recentNotes');
  if (!notes?.length) {
    notesBox.innerHTML = `<p class="muted">Nenhum fichamento ainda. <a href="#/pesquisa/fichamentos">criar primeiro</a>.</p>`;
  } else {
    notesBox.innerHTML = notes.slice(0, 5).map(noteRow).join('');
  }

  const postsBox = document.getElementById('recentPosts');
  if (!posts?.length) {
    postsBox.innerHTML = `<p class="muted">Nenhum post escrito ainda. <a href="#/pesquisa/posts">criar primeiro</a>.</p>`;
  } else {
    postsBox.innerHTML = posts.slice(0, 5).map(postRow).join('');
  }
}

function statCard(iconHtml, value, label, tone = null) {
  const toneClass = tone ? ` att-stat--${tone}` : '';
  return `<div class="att-stat${toneClass}">
    <span class="att-stat__icon">${iconHtml}</span>
    <div><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(label)}</span></div>
  </div>`;
}

function noteRow(n) {
  const d = n.meeting?.date ? new Date(n.meeting.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
  return `
    <a class="fin-list-item" href="#/pesquisa/fichamentos" style="text-decoration:none; color:inherit; padding: 10px 0;">
      <div>
        <strong>${escapeHtml(n.title)}</strong>
        <span class="muted" style="display:block; font-size:12px;">${escapeHtml(n.group?.name || '—')}${d ? ` · ${d}` : ''}</span>
      </div>
      ${icon('arrow-right', { size: 12 })}
    </a>
  `;
}

function postRow(p) {
  const statusLabels = { draft: 'rascunho', sent_to_media: 'na mídia', scheduled: 'agendado', published: 'publicado' };
  return `
    <a class="fin-list-item" href="#/pesquisa/posts" style="text-decoration:none; color:inherit; padding: 10px 0;">
      <div>
        <strong>${escapeHtml(p.title)}</strong>
        <span class="muted" style="display:block; font-size:12px;">${escapeHtml(statusLabels[p.status] || p.status)}</span>
      </div>
      ${icon('arrow-right', { size: 12 })}
    </a>
  `;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
