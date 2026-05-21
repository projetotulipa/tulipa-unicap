// Páginas — Sprint 1 ("Folha Viva": hero signet + galeria mood board com thumbs iframe lazy).

import { PAGES } from '../pages-meta.js';
import { HOME_SCHEMA } from '../schemas/home.js';
import { icon } from '../icons.js';
import { stampSeal, stampPage } from '../pages/signet.js';

const viewState = {
  search: '',
  status: 'all', // all | live | hidden
  sort: 'natural', // natural | name
};

let cached = null;
let thumbObserver = null;

export function renderPages(ctx) {
  const { root, api } = ctx;
  const data = api.getData();
  const home = PAGES.find((p) => p.isHome);
  const sectors = PAGES.filter((p) => !p.isHome);

  cached = { ctx, home, sectors, data };

  root.innerHTML = `
    <div class="view">
      <header class="pages-hero-v2">
        <div class="pages-hero-v2__seal-wrap">
          <span class="pages-signet">${stampSeal({ size: 32 })}</span>
        </div>
        <div class="pages-hero-v2__inner">
          <p class="pages-hero-v2__eyebrow">folha viva · ${PAGES.length} páginas catalogadas</p>
          <h1>Páginas do site</h1>
          <p class="pages-hero-v2__lede">
            Cada folha é uma página viva. Clique para editar seções; use o interruptor para <strong>ocultar do site</strong> (sumirá da navbar, do rodapé e da home).
          </p>
        </div>
        <div class="pages-hero-v2__page">${stampPage({ size: 220 })}</div>
      </header>

      <section class="pages-stats-v2" id="pagesStats">
        ${renderStatSkel()}${renderStatSkel()}${renderStatSkel()}${renderStatSkel()}
      </section>

      <div id="pagesToolbar"></div>

      <div id="pagesGallery"></div>
    </div>
  `;

  renderStats();
  renderToolbar();
  renderGallery();
  setupThumbObserver();
}

function renderStatSkel() {
  return `<div class="pages-stat-v2 pages-stat-v2--skel"><div class="skel skel--block"></div></div>`;
}

function renderStats() {
  const { sectors, data } = cached;
  const hidden = data.global?.hidden || {};
  let liveCount = 0, hiddenCount = 0;
  for (const p of sectors) {
    const key = `page.${p.scope.replace('lp:', '')}`;
    if (hidden[key]) hiddenCount++;
    else liveCount++;
  }
  // home conta como live se não escondida (nunca esconde a home)
  const totalLive = liveCount + 1;
  const totalBlocos = countBlocos();

  document.getElementById('pagesStats').innerHTML = `
    ${statCard(icon('page', { size: 22 }), PAGES.length, 'páginas catalogadas', 'cream')}
    ${statCard(icon('eye', { size: 22 }), totalLive, totalLive === 1 ? 'no ar' : 'no ar', 'sage')}
    ${statCard(icon('eye-off', { size: 22 }), hiddenCount, hiddenCount === 1 ? 'oculta' : 'ocultas', hiddenCount > 0 ? 'rose' : null)}
    ${statCard(icon('attendance', { size: 22 }), totalBlocos, 'blocos editáveis', 'gold')}
  `;
}

function countBlocos() {
  // home tem schema explícito; LPs detectam blocos via DOM ao abrir (não dá pra contar sem carregar iframe).
  // mostramos só os blocos catalogados da home + estimativa por LP (4 blocos médio)
  const homeBlocks = HOME_SCHEMA.blocks?.length || 0;
  const lpEstimate = (PAGES.length - 1) * 4;
  return homeBlocks + lpEstimate;
}

function statCard(iconHtml, value, label, tone = null) {
  const toneClass = tone ? ` pages-stat-v2--${tone}` : '';
  return `
    <div class="pages-stat-v2${toneClass}">
      <div class="pages-stat-v2__body">
        <strong class="pages-stat-v2__num">${escapeHtml(String(value))}</strong>
        <span class="pages-stat-v2__label">${escapeHtml(label)}</span>
      </div>
      <span class="pages-stat-v2__icon">${iconHtml}</span>
    </div>
  `;
}

function renderToolbar() {
  document.getElementById('pagesToolbar').innerHTML = `
    <div class="pages-toolbar">
      <input type="text" id="pageSearch" placeholder="Buscar página…" value="${escapeAttr(viewState.search)}" />
      <span class="pages-toolbar__label">visibilidade</span>
      <select id="pageStatus">
        <option value="all"    ${viewState.status === 'all'    ? 'selected' : ''}>todas</option>
        <option value="live"   ${viewState.status === 'live'   ? 'selected' : ''}>no ar</option>
        <option value="hidden" ${viewState.status === 'hidden' ? 'selected' : ''}>ocultas</option>
      </select>
      <span class="pages-toolbar__spacer"></span>
      <span class="pages-toolbar__label">ordenar</span>
      <select id="pageSort">
        <option value="natural" ${viewState.sort === 'natural' ? 'selected' : ''}>por seção</option>
        <option value="name"    ${viewState.sort === 'name'    ? 'selected' : ''}>nome (a-z)</option>
      </select>
    </div>
  `;
  document.getElementById('pageSearch').addEventListener('input', (e) => {
    viewState.search = e.target.value;
    renderGallery();
    setupThumbObserver();
  });
  document.getElementById('pageStatus').addEventListener('change', (e) => {
    viewState.status = e.target.value;
    renderGallery();
    setupThumbObserver();
  });
  document.getElementById('pageSort').addEventListener('change', (e) => {
    viewState.sort = e.target.value;
    renderGallery();
    setupThumbObserver();
  });
}

function renderGallery() {
  const { home, sectors, data } = cached;
  const hidden = data.global?.hidden || {};

  const filtered = sectors.filter((p) => {
    const key = `page.${p.scope.replace('lp:', '')}`;
    const isHidden = !!hidden[key];
    if (viewState.status === 'live' && isHidden) return false;
    if (viewState.status === 'hidden' && !isHidden) return false;
    if (viewState.search) {
      const q = viewState.search.toLowerCase();
      const haystack = `${p.label} ${p.scope} ${p.description || ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  // Sort: natural = por categoria (depts/cargos depois atividades); name = alfa
  let depts = [], acts = [];
  if (viewState.sort === 'natural') {
    depts = filtered.filter((p) => /presidencia|professor-|midia|pesquisa|tesouraria|secretaria/.test(p.scope));
    acts = filtered.filter((p) => /grupos|leitura|arteterapia/.test(p.scope));
  } else {
    const sorted = [...filtered].sort((a, b) => (a.label || '').localeCompare(b.label || '', 'pt-BR'));
    depts = sorted; // mostra tudo num único grupo
    acts = [];
  }

  const homeVisible = viewState.status === 'all' || viewState.status === 'live';
  const matchesSearch = viewState.search === '' || `${home.label} ${home.description || ''}`.toLowerCase().includes(viewState.search.toLowerCase());
  const showHome = homeVisible && matchesSearch;

  const totalShown = (showHome ? 1 : 0) + depts.length + acts.length;
  const box = document.getElementById('pagesGallery');

  if (totalShown === 0) {
    box.innerHTML = `<div class="pages-no-results">
      <span>Nada por aqui</span>
      <p>nenhuma página corresponde aos filtros atuais.</p>
    </div>`;
    return;
  }

  const sections = [];

  if (showHome) {
    sections.push(`
      <section class="pages-section-v2">
        <header class="pages-section-v2__head">
          <h2>Página inicial</h2>
        </header>
        <div class="pages-letter-grid">
          ${renderLetter(home, { featured: true })}
        </div>
      </section>
    `);
  }

  if (viewState.sort === 'natural') {
    if (depts.length > 0) {
      sections.push(`
        <section class="pages-section-v2">
          <header class="pages-section-v2__head">
            <h2>Departamentos &amp; cargos <span class="pages-section-v2__count">${depts.length}</span></h2>
          </header>
          <div class="pages-letter-grid">
            ${depts.map((p) => renderLetter(p)).join('')}
          </div>
        </section>
      `);
    }
    if (acts.length > 0) {
      sections.push(`
        <section class="pages-section-v2">
          <header class="pages-section-v2__head">
            <h2>Atividades <span class="pages-section-v2__count">${acts.length}</span></h2>
          </header>
          <div class="pages-letter-grid">
            ${acts.map((p) => renderLetter(p)).join('')}
          </div>
        </section>
      `);
    }
  } else if (depts.length > 0) {
    sections.push(`
      <section class="pages-section-v2">
        <header class="pages-section-v2__head">
          <h2>Todas <span class="pages-section-v2__count">${depts.length}</span></h2>
        </header>
        <div class="pages-letter-grid">
          ${depts.map((p) => renderLetter(p)).join('')}
        </div>
      </section>
    `);
  }

  box.innerHTML = sections.join('');
  bindCards();
}

function renderLetter(page, opts = {}) {
  const featured = !!opts.featured;
  const { data } = cached;
  const slug = pageSlug(page);
  const isHome = !!page.isHome;
  const hiddenKey = `page.${page.scope.replace('lp:', '')}`;
  const globalHidden = data.global?.hidden || {};
  const isHidden = !isHome && !!globalHidden[hiddenKey];

  const monogram = monogramOf(page.label);
  const pathLabel = page.path.replace('../', '/');

  return `
    <article class="pages-letter ${featured ? 'pages-letter--featured' : ''} ${isHidden ? 'is-hidden' : ''}"
             data-page-scope="${escapeAttr(page.scope)}"
             data-hidden-key="${escapeAttr(hiddenKey)}"
             data-page-path="${escapeAttr(page.path)}"
             data-slug="${escapeAttr(slug)}">
      <div class="pages-letter__thumb-wrap">
        <span class="pages-letter__thumb-mono" aria-hidden="true">${escapeHtml(monogram)}</span>
        <iframe class="pages-letter__thumb-iframe" data-src="${escapeAttr(page.path)}" aria-hidden="true" loading="lazy" sandbox="allow-same-origin allow-scripts"></iframe>
        <span class="pages-letter__thumb-status">
          ${isHidden
            ? `<span class="pages-pill-v2 pages-pill-v2--rose">${icon('eye-off', { size: 11 })}<span style="margin-left:4px;">oculta</span></span>`
            : `<span class="pages-pill-v2 pages-pill-v2--sage">${icon('eye', { size: 11 })}<span style="margin-left:4px;">no ar</span></span>`}
        </span>
        <span class="pages-letter__thumb-signet" aria-hidden="true">${isHome ? icon('brand', { size: 18 }) : stampSeal({ size: 16 })}</span>
      </div>

      <div class="pages-letter__body">
        <div class="pages-letter__head">
          <div class="pages-letter__title">
            <p class="pages-letter__eyebrow">${escapeHtml(pathLabel)}</p>
            <h3>${escapeHtml(page.label)}</h3>
          </div>
        </div>

        ${page.description
          ? `<p class="pages-letter__desc">${escapeHtml(page.description)}</p>`
          : `<p class="pages-letter__desc pages-letter__desc--empty">sem descrição catalogada</p>`}

        <div class="pages-letter__foot">
          <a class="pages-letter__cta" href="#/paginas/${escapeAttr(slug)}">
            <span>${icon('edit', { size: 12 })}<span style="margin-left:6px;">editar página</span></span>
            ${icon('arrow-right', { size: 12 })}
          </a>
          ${!isHome ? `
            <label class="pages-letter__switch" title="${isHidden ? 'Oculta — clique para mostrar' : 'No ar — clique para ocultar'}">
              <input type="checkbox" data-action="toggle-visibility" ${!isHidden ? 'checked' : ''} aria-label="${isHidden ? 'Mostrar página no site' : 'Ocultar página do site'}" />
              <span class="pages-letter__switch-track">
                <span class="pages-letter__switch-thumb"></span>
              </span>
              <span class="pages-letter__switch-status">${isHidden ? 'oculta' : 'no ar'}</span>
            </label>
          ` : ''}
          <span class="pages-letter__publish-status" data-publish-status></span>
        </div>
      </div>
    </article>
  `;
}

function bindCards() {
  const { ctx } = cached;
  const { api } = ctx;
  document.querySelectorAll('.pages-letter').forEach((card) => {
    const toggle = card.querySelector('[data-action="toggle-visibility"]');
    if (!toggle) return;
    const statusEl = card.querySelector('[data-publish-status]');
    const hiddenKey = card.dataset.hiddenKey;

    toggle.addEventListener('change', async (ev) => {
      ev.stopPropagation();
      const shouldHide = !toggle.checked;
      api.patchEdit('global', 'hidden', hiddenKey, shouldHide ? true : null);

      card.classList.toggle('is-hidden', shouldHide);
      const label = card.querySelector('.pages-letter__switch-status');
      if (label) label.textContent = shouldHide ? 'oculta' : 'no ar';

      // atualiza pill no thumb
      const thumbStatus = card.querySelector('.pages-letter__thumb-status');
      if (thumbStatus) {
        thumbStatus.innerHTML = shouldHide
          ? `<span class="pages-pill-v2 pages-pill-v2--rose">${icon('eye-off', { size: 11 })}<span style="margin-left:4px;">oculta</span></span>`
          : `<span class="pages-pill-v2 pages-pill-v2--sage">${icon('eye', { size: 11 })}<span style="margin-left:4px;">no ar</span></span>`;
      }

      statusEl.textContent = 'salvando…';
      statusEl.dataset.state = 'saving';
      try {
        await api.publish('global', `toggle ${hiddenKey} -> ${shouldHide ? 'oculta' : 'no ar'}`);
        statusEl.innerHTML = `${icon('check', { size: 12 })} <span style="margin-left:4px;">${shouldHide ? 'oculta' : 'no ar'}</span>`;
        statusEl.dataset.state = 'success';
        // atualiza stats com novo cache
        cached.data = api.getData();
        renderStats();
        setTimeout(() => { statusEl.textContent = ''; statusEl.dataset.state = ''; }, 2500);
      } catch (e) {
        statusEl.textContent = `erro: ${e.message}`;
        statusEl.dataset.state = 'error';
        toggle.checked = !shouldHide;
        card.classList.toggle('is-hidden', !shouldHide);
        if (label) label.textContent = !shouldHide ? 'oculta' : 'no ar';
        api.patchEdit('global', 'hidden', hiddenKey, !shouldHide ? true : null);
      }
    });

    // click no card (não em controles) → ir pro editor
    card.addEventListener('click', (ev) => {
      if (ev.target.closest('button, a, input, label')) return;
      const slug = card.dataset.slug;
      if (slug) location.hash = `#/paginas/${slug}`;
    });
  });
}

// IntersectionObserver pra carregar thumbs só quando visíveis
function setupThumbObserver() {
  if (thumbObserver) thumbObserver.disconnect();
  thumbObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const iframe = entry.target;
      const src = iframe.dataset.src;
      if (src && !iframe.src) {
        iframe.src = src;
        iframe.addEventListener('load', () => iframe.classList.add('is-loaded'), { once: true });
      }
      thumbObserver.unobserve(iframe);
    }
  }, { rootMargin: '300px' });

  document.querySelectorAll('.pages-letter__thumb-iframe').forEach((el) => {
    thumbObserver.observe(el);
  });
}

function pageSlug(page) {
  if (page.isHome) return 'home';
  return page.scope.replace('lp:', '');
}

function monogramOf(name) {
  if (!name) return '·';
  const cleaned = String(name).trim().replace(/^(Departamento de|Grupo de|Oficina de|Prof\.|Página)\s+/i, '');
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    return ((parts[0][0] || '') + (parts[parts.length - 1][0] || '')).toUpperCase();
  }
  return (cleaned[0] || '·').toUpperCase();
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
