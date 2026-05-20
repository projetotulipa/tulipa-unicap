// Dashboard de Pesquisa — visão editorial com selo P + pipeline + skyline + mural.

import { icon } from '../icons.js';
import * as data from '../research/data.js';
import * as attData from '../attendance/data.js';
import { renderResearchNav } from './research-nav.js';

// página dobrada decorativa
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

      <section class="research-pane" id="pipelinePane" style="display:none; margin-bottom:14px;">
        <header class="research-pane__head">
          <span class="research-pane__icon">${icon('spark', { size: 18 })}</span>
          <h2>Pipeline editorial</h2>
          <p class="research-pane__hint">da aula ao publicado</p>
        </header>
        <div class="research-pipeline" id="pipelineRow"></div>
      </section>

      <section class="research-pane" id="skylinePane" style="display:none; margin-bottom:14px;">
        <header class="research-pane__head">
          <span class="research-pane__icon">${icon('calendar', { size: 18 })}</span>
          <h2>Próximas 4 semanas de aulas</h2>
          <p class="research-pane__hint">altura = nº de aulas · laranja = sem fichamento</p>
        </header>
        <div class="research-skyline" id="skylineRow"></div>
        <div class="research-skyline__legend">
          <span class="research-skyline__legend-item">
            <span class="research-skyline__legend-swatch"></span> aulas com fichamento
          </span>
          <span class="research-skyline__legend-item">
            <span class="research-skyline__legend-swatch research-skyline__legend-swatch--missing"></span> aulas sem fichamento
          </span>
        </div>
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

      <section class="research-pane" id="moodboardPane" style="display:none; margin-top:14px;">
        <header class="research-pane__head">
          <span class="research-pane__icon">${icon('star', { size: 18 })}</span>
          <h2>Mural dos publicados</h2>
          <p class="research-pane__hint">o que já chegou no feed</p>
        </header>
        <div class="research-moodboard" id="moodboardGrid"></div>
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
  const todayStr = isoDate(new Date());
  const horizonEnd = addDays(todayStr, 27);

  const [{ data: notes }, { data: posts }, { data: meetings }] = await Promise.all([
    data.listNotes({ limit: 200 }),
    data.listPosts(),
    attData.listMeetingsBetween({ from: todayStr, to: horizonEnd }).catch(() => ({ data: [] })),
  ]);
  const notesArr    = notes || [];
  const postsArr    = posts || [];
  const meetingsArr = meetings || [];

  // --- stats principais ---
  const noteCount      = notesArr.length;
  const draftCount     = postsArr.filter((p) => p.status === 'draft').length;
  const sentCount      = postsArr.filter((p) => p.status === 'sent_to_media').length;
  const scheduledCount = postsArr.filter((p) => p.status === 'scheduled').length;
  const publishedCount = postsArr.filter((p) => p.status === 'published').length;

  // aulas no horizonte: quais NÃO têm fichamento ainda
  const meetingIdsWithNote = new Set(notesArr.map((n) => n.meeting_id).filter(Boolean));
  const meetingsMissingNote = meetingsArr.filter((m) => !meetingIdsWithNote.has(m.id));

  document.getElementById('researchStats').innerHTML = `
    ${statCard(icon('page', { size: 20 }), noteCount, noteCount === 1 ? 'fichamento' : 'fichamentos')}
    ${statCard(icon('edit', { size: 20 }), draftCount, 'rascunhos de post', draftCount > 0 ? 'warning' : null)}
    ${statCard(icon('spark', { size: 20 }), sentCount, 'enviados à mídia', sentCount > 0 ? 'gold' : null)}
    ${statCard(icon('check-circle', { size: 20 }), publishedCount, 'publicados', publishedCount > 0 ? 'success' : null)}
  `;

  // --- pipeline editorial ---
  const totalActivity = meetingsMissingNote.length + noteCount + draftCount + sentCount + scheduledCount + publishedCount;
  if (totalActivity > 0) {
    const pane = document.getElementById('pipelinePane');
    const row  = document.getElementById('pipelineRow');
    pane.style.display = '';
    row.innerHTML = pipelineRow([
      { label: 'aulas pendentes', num: meetingsMissingNote.length, href: '#/pesquisa/fichamentos', urgent: meetingsMissingNote.length >= 3 },
      { label: 'fichamentos',     num: noteCount,        href: '#/pesquisa/fichamentos' },
      { label: 'rascunhos',       num: draftCount,       href: '#/pesquisa/posts' },
      { label: 'enviados',        num: sentCount,        href: '#/pesquisa/posts' },
      { label: 'agendados',       num: scheduledCount,   href: '#/pesquisa/posts' },
      { label: 'publicados',      num: publishedCount,   href: '#/pesquisa/posts' },
    ]);
  }

  // --- skyline de 28 dias de aulas próximas ---
  if (meetingsArr.length > 0) {
    const pane = document.getElementById('skylinePane');
    const row  = document.getElementById('skylineRow');
    pane.style.display = '';
    row.innerHTML = skylineBars(todayStr, 28, meetingsArr, meetingIdsWithNote);
  }

  // --- fichamentos recentes ---
  const notesBox = document.getElementById('recentNotes');
  if (!notesArr.length) {
    notesBox.innerHTML = `<p class="muted" style="margin:0;">Nenhum fichamento ainda. <a href="#/pesquisa/fichamentos">criar primeiro</a>.</p>`;
  } else {
    notesBox.innerHTML = `<ul class="fin-list">${notesArr.slice(0, 5).map(noteRow).join('')}</ul>`;
  }

  // --- posts em andamento ---
  const postsBox = document.getElementById('recentPosts');
  const inFlight = postsArr.filter((p) => p.status !== 'published').slice(0, 5);
  if (!inFlight.length) {
    postsBox.innerHTML = `<p class="muted" style="margin:0;">Nenhum post em andamento. <a href="#/pesquisa/posts">criar primeiro</a>.</p>`;
  } else {
    postsBox.innerHTML = `<ul class="fin-list">${inFlight.map(postRow).join('')}</ul>`;
  }

  // --- mural de publicados (últimos 6) ---
  const published = postsArr
    .filter((p) => p.status === 'published')
    .slice(0, 6);
  if (published.length > 0) {
    const pane = document.getElementById('moodboardPane');
    const grid = document.getElementById('moodboardGrid');
    pane.style.display = '';
    grid.innerHTML = published.map(moodCard).join('');
  }
}

// ===== components =====

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

function pipelineRow(nodes) {
  const arrow = `<span class="research-pipeline__arrow" aria-hidden="true">${icon('chevron', { size: 14 })}</span>`;
  return nodes.map((n, i) => {
    const urgentCls = n.urgent ? ' is-urgent' : '';
    const node = `
      <a class="research-pipeline__node${urgentCls}" href="${escapeAttr(n.href || '#')}">
        <span class="research-pipeline__num">${escapeHtml(String(n.num))}</span>
        <span class="research-pipeline__label">${escapeHtml(n.label)}</span>
      </a>`;
    return i < nodes.length - 1 ? node + arrow : node;
  }).join('');
}

function skylineBars(startIso, days, meetings, meetingIdsWithNote) {
  // conta meetings por data + flag se TODAS as meetings daquele dia já têm fichamento
  // (se alguma estiver sem, dia inteiro entra em modo "missing" colorido)
  const byDate = new Map();
  for (const m of meetings) {
    if (!m.date) continue;
    if (!byDate.has(m.date)) byDate.set(m.date, []);
    byDate.get(m.date).push(m);
  }
  const horizonDates = [];
  for (let i = 0; i < days; i++) horizonDates.push(addDays(startIso, i));
  const maxN = Math.max(1, ...horizonDates.map((d) => (byDate.get(d) || []).length));

  return horizonDates.map((iso) => {
    const ms = byDate.get(iso) || [];
    const n = ms.length;
    const pct = Math.round((n / maxN) * 100);
    const isToday = iso === startIso;
    const hasMissing = ms.some((m) => !meetingIdsWithNote.has(m.id));
    const dObj = new Date(iso + 'T00:00:00');
    let tooltip = `${dObj.getDate()}/${dObj.getMonth() + 1}`;
    if (n > 0) tooltip += ` · ${n} ${n === 1 ? 'aula' : 'aulas'}`;
    else tooltip += ' · sem aulas';
    if (hasMissing && n > 0) tooltip += ' (sem fichamento)';

    const cls = [
      'research-skyline__bar',
      isToday && 'research-skyline__bar--today',
      n > 0 && hasMissing && 'research-skyline__bar--missing',
    ].filter(Boolean).join(' ');

    return `
      <div class="${cls}" data-tooltip="${escapeAttr(tooltip)}">
        <div class="research-skyline__fill" style="height:${pct}%;"></div>
      </div>
    `;
  }).join('');
}

function moodCard(post) {
  const date = post.created_at ? formatMoodDate(post.created_at) : '';
  const origin = post.research_note?.title || 'recebido';
  return `
    <a class="research-moodboard__card" href="#/pesquisa/posts" title="${escapeAttr(post.title)}">
      <div class="research-moodboard__page">${PAGE_SVG}</div>
      <p class="research-moodboard__eyebrow">publicado</p>
      <h3 class="research-moodboard__title">${escapeHtml(post.title)}</h3>
      <div class="research-moodboard__foot">
        <span class="research-moodboard__date">${escapeHtml(date)}</span>
        <span class="research-moodboard__seal">— ${escapeHtml(origin)}</span>
      </div>
    </a>
  `;
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
  const pillClass = p.status === 'sent_to_media' ? 'research-pill--sent'
                  : p.status === 'scheduled'     ? 'research-pill--scheduled'
                  : 'research-pill--draft';
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

// ===== helpers =====

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function addDays(iso, days) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

function formatMoodDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
