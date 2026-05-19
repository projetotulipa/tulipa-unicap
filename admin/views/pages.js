// Aba Páginas — lista de cards grandes com toggle de visibilidade + botão editar.

import { PAGES } from '../pages-meta.js';
import { HOME_SCHEMA } from '../schemas/home.js';
import { icon } from '../icons.js';

export function renderPages(ctx) {
  const { root, api } = ctx;

  // separa home, LPs de atividade/depts, e utilitárias
  const home = PAGES.find((p) => p.isHome);
  const sectors = PAGES.filter((p) => !p.isHome && p.scope !== 'global');

  root.innerHTML = `
    <div class="view">
      <header class="view__header">
        <h1>Páginas do site</h1>
        <p class="view__lede">
          Clique em uma página para editar suas seções.
          Use o interruptor para ocultar a página em todo o site (sumirá da navbar, do rodapé e da home).
        </p>
      </header>

      <section class="page-home-section">
        ${renderPageCard(home, api, { featured: true })}
      </section>

      <section class="page-section">
        <h2>Departamentos &amp; cargos</h2>
        <div class="page-grid">
          ${sectors.filter((p) => /presidencia|professor-|midia|pesquisa|tesouraria|secretaria/.test(p.scope))
            .map((p) => renderPageCard(p, api)).join('')}
        </div>
      </section>

      <section class="page-section">
        <h2>Atividades</h2>
        <div class="page-grid">
          ${sectors.filter((p) => /grupos|leitura|arteterapia/.test(p.scope))
            .map((p) => renderPageCard(p, api)).join('')}
        </div>
      </section>
    </div>
  `;

  bindToggles(ctx);
}

function renderPageCard(page, api, opts = {}) {
  const featured = opts.featured;
  const slug = pageSlug(page);
  const isHome = !!page.isHome;
  const hasEditor = isHome; // por enquanto só home tem editor visual
  const hiddenKey = `page.${page.scope.replace('lp:', '')}`;
  const data = api.getData();
  const globalHidden = data.global?.hidden || {};
  const isHidden = !isHome && !!globalHidden[hiddenKey];

  // preview: para home, mostra os blocos; para LP, descrição
  let blocksPreview = '';
  if (isHome) {
    blocksPreview = HOME_SCHEMA.blocks.map((b) =>
      `<span class="page-card__block-chip">${icon(b.iconName, { size: 14 })} ${escapeHtml(b.label)}</span>`
    ).join('');
  }

  return `
    <article class="page-card ${featured ? 'page-card--featured' : ''} ${isHidden ? 'page-card--hidden' : ''}"
             data-page-scope="${escapeHtml(page.scope)}"
             data-hidden-key="${escapeHtml(hiddenKey)}">
      <div class="page-card__head">
        <div class="page-card__title">
          <span class="page-card__icon">${icon(isHome ? 'brand' : 'page', { size: isHome ? 36 : 26 })}</span>
          <div>
            <h3>${escapeHtml(page.label)}</h3>
            <p class="page-card__path">${escapeHtml(page.path.replace('../', '/'))}</p>
          </div>
        </div>

        ${isHome ? '' : `
          <label class="page-card__switch" title="${isHidden ? 'Está oculta — clique para mostrar no site' : 'Está visível — clique para ocultar'}">
            <input type="checkbox" data-action="toggle-visibility" ${!isHidden ? 'checked' : ''} />
            <span class="page-card__switch-track">
              <span class="page-card__switch-thumb"></span>
            </span>
            <span class="page-card__switch-label">${isHidden ? 'oculta' : 'no ar'}</span>
          </label>
        `}
      </div>

      ${page.description ? `<p class="page-card__desc">${escapeHtml(page.description)}</p>` : ''}

      ${blocksPreview ? `<div class="page-card__blocks">${blocksPreview}</div>` : ''}

      <div class="page-card__foot">
        ${hasEditor
          ? `<a class="btn btn--primary" href="#/paginas/${escapeHtml(slug)}"><span>Editar página</span> ${icon('arrow-right', { size: 14 })}</a>`
          : `<a class="btn btn--ghost" href="#/paginas/${escapeHtml(slug)}">Em breve</a>`
        }
        <span class="page-card__publish-status" data-publish-status></span>
      </div>
    </article>
  `;
}

function pageSlug(page) {
  if (page.isHome) return 'home';
  return page.scope.replace('lp:', '');
}

function bindToggles(ctx) {
  const { api, state } = ctx;
  document.querySelectorAll('.page-card').forEach((card) => {
    const toggle = card.querySelector('[data-action="toggle-visibility"]');
    if (!toggle) return;
    const statusEl = card.querySelector('[data-publish-status]');
    const hiddenKey = card.dataset.hiddenKey;

    toggle.addEventListener('change', async () => {
      const shouldHide = !toggle.checked;
      api.patchEdit('global', 'hidden', hiddenKey, shouldHide ? true : null);

      // visual imediato
      card.classList.toggle('page-card--hidden', shouldHide);
      const label = card.querySelector('.page-card__switch-label');
      if (label) label.textContent = shouldHide ? 'oculta' : 'no ar';

      // publica automaticamente (1 toggle = 1 ação atômica)
      statusEl.textContent = 'salvando…';
      statusEl.dataset.state = 'saving';
      try {
        await api.publish('global', `toggle ${hiddenKey} -> ${shouldHide ? 'oculta' : 'no ar'}`);
        statusEl.innerHTML = `${icon('check', { size: 12 })} ${shouldHide ? 'oculta' : 'no ar'}`;
        statusEl.dataset.state = 'success';
        setTimeout(() => { statusEl.textContent = ''; statusEl.dataset.state = ''; }, 2500);
      } catch (e) {
        statusEl.textContent = `erro: ${e.message}`;
        statusEl.dataset.state = 'error';
        // reverte UI
        toggle.checked = !shouldHide;
        card.classList.toggle('page-card--hidden', !shouldHide);
        if (label) label.textContent = !shouldHide ? 'oculta' : 'no ar';
        api.patchEdit('global', 'hidden', hiddenKey, !shouldHide ? true : null);
      }
    });
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
