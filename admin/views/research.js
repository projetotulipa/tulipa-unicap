// Dashboard de Pesquisa — visão editorial com selo P + stats Cormorant.

import { icon } from '../icons.js';
import * as data from '../research/data.js';
import { renderResearchNav } from './research-nav.js';

// página dobrada decorativa (watermark de Pesquisa)
const PAGE_SVG = `
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M22 14 L62 14 L78 30 L78 86 L22 86 Z" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M62 14 L62 30 L78 30" fill="none" stroke="currentColor" stroke-width="2"/>
    <line x1="30" y1="42" x2="70" y2="42" stroke="currentColor" stroke-width="1.5"/>
    <line x1="30" y1="52" x2="68" y2="52" stroke="currentColor" stroke-width="1.5"/>
    <line x1="30" y1="62" x2="64" y2="62" stroke="currentColor" stroke-width="1.5"/>
    <line x1="30" y1="72" x2="58" y2="72" stroke="currentColor" stroke-width="1.5"/>
  </svg>
`;

const SEAL_HTML = `
  <span class="research-seal" aria-hidden="true">
    <span class="research-seal__letter">P</span>
  </span>
`;

export async function renderResearchDashboard(ctx) {
  const { root } = ctx;

  root.innerHTML = `
    <div class="view">
      ${renderResearchNav('dashboard')}

      <header class="research-hero">
        <div class="research-hero__page">${PAGE_SVG}</div>
        <div class="research-hero__seal-wrap">${SEAL_HTML}</div>
        <div class="research-hero__inner">
          <p class="research-hero__eyebrow">pesquisa</p>
          <h1>Estudo &amp; escrita</h1>
          <p class="research-hero__lede">Fichamentos teóricos das aulas e posts pra mandar à Mídia. Cada leitura vira palavra, cada palavra vira arte.</p>
        </div>
      </header>

      <section class="research-stats" id="researchStats">
        ${skel()}${skel()}${skel()}${skel()}
      </section>

      <section class="research-pane__row">
        <div class="research-pane">
          <header class="research-pane__head">
            <span class="research-pane__icon">${icon('page', { size: 18 })}</span>
            <h2>Fichamentos recentes</h2>
            <p class="research-pane__hint">últimas leituras</p>
          </header>
          <div id="recentNotes">${bloomLoading('carregando…')}</div>
        </div>

        <div class="research-pane">
          <header class="research-pane__head">
            <span class="research-pane__icon">${icon('spark', { size: 18 })}</span>
            <h2>Posts em andamento</h2>
            <p class="research-pane__hint">rascunhos e enviados</p>
          </header>
          <div id="recentPosts">${bloomLoading('carregando…')}</div>
        </div>
      </section>
    </div>
  `;

  loadAll().catch((e) => { console.error(e); });
}

function skel() {
  return `<div class="research-stat" style="opacity:0.6;"><div class="research-stat__body"><strong class="research-stat__num">·</strong><span class="research-stat__label">…</span></div></div>`;
}

function bloomLoading(label = '') {
  return `
    <div class="research-loading-wrap">
      ${SEAL_HTML}
      ${label ? `<span>${escapeHtml(label)}</span>` : ''}
    </div>
  `;
}

async function loadAll() {
  const [{ data: notes }, { data: posts }] = await Promise.all([
    data.listNotes({ limit: 50 }),
    data.listPosts(),
  ]);
  const notesArr = notes || [];
  const postsArr = posts || [];

  const noteCount      = notesArr.length;
  const draftCount     = postsArr.filter((p) => p.status === 'draft').length;
  const sentCount      = postsArr.filter((p) => p.status === 'sent_to_media').length;
  const publishedCount = postsArr.filter((p) => p.status === 'published').length;

  document.getElementById('researchStats').innerHTML = `
    ${statCard(icon('page', { size: 20 }), noteCount, noteCount === 1 ? 'fichamento' : 'fichamentos')}
    ${statCard(icon('edit', { size: 20 }), draftCount, 'rascunhos de post', draftCount > 0 ? 'warning' : null)}
    ${statCard(icon('spark', { size: 20 }), sentCount, 'enviados à mídia', sentCount > 0 ? 'gold' : null)}
    ${statCard(icon('check-circle', { size: 20 }), publishedCount, 'publicados', publishedCount > 0 ? 'success' : null)}
  `;

  // fichamentos recentes
  const notesBox = document.getElementById('recentNotes');
  if (!notesArr.length) {
    notesBox.innerHTML = `<p class="muted" style="margin:0;">Nenhum fichamento ainda. <a href="#/pesquisa/fichamentos">criar primeiro</a>.</p>`;
  } else {
    notesBox.innerHTML = `<ul class="fin-list">${notesArr.slice(0, 5).map(noteRow).join('')}</ul>`;
  }

  // posts em andamento (não-publicados)
  const postsBox = document.getElementById('recentPosts');
  const inFlight = postsArr.filter((p) => p.status !== 'published').slice(0, 5);
  if (!inFlight.length) {
    postsBox.innerHTML = `<p class="muted" style="margin:0;">Nenhum post em andamento. <a href="#/pesquisa/posts">criar primeiro</a>.</p>`;
  } else {
    postsBox.innerHTML = `<ul class="fin-list">${inFlight.map(postRow).join('')}</ul>`;
  }
}

function statCard(iconHtml, value, label, tone = null) {
  const toneClass = tone ? ` research-stat--${tone}` : '';
  return `<div class="research-stat${toneClass}">
    <div class="research-stat__body">
      <strong class="research-stat__num">${escapeHtml(String(value))}</strong>
      <span class="research-stat__label">${escapeHtml(label)}</span>
    </div>
    <span class="research-stat__icon">${iconHtml}</span>
  </div>`;
}

function noteRow(n) {
  const d = n.meeting?.date
    ? new Date(n.meeting.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    : '';
  return `
    <li class="fin-list-item">
      <div>
        <strong>${escapeHtml(n.title)}</strong>
        <span class="muted" style="display:block; font-size:12px;">${escapeHtml(n.group?.name || 'sem grupo')}${d ? ` · ${d}` : ''}</span>
      </div>
      <a class="btn btn--ghost btn--small" href="#/pesquisa/fichamentos">abrir</a>
    </li>
  `;
}

function postRow(p) {
  const statusLabels = { draft: 'rascunho', sent_to_media: 'na mídia', scheduled: 'agendado', published: 'publicado' };
  const pillClass = p.status === 'sent_to_media' || p.status === 'scheduled'
    ? 'research-pill--posts'
    : 'research-pill';
  return `
    <li class="fin-list-item">
      <div>
        <strong>${escapeHtml(p.title)}</strong>
        ${p.research_note ? `<span class="muted" style="display:block; font-size:12px;">de "${escapeHtml(p.research_note.title)}"</span>` : ''}
      </div>
      <span class="research-pill ${pillClass}">${escapeHtml(statusLabels[p.status] || p.status)}</span>
    </li>
  `;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
