import { PAGES, scopeToSlug } from '../pages-meta.js';

export function renderPages(ctx) {
  const { root, api } = ctx;
  const data = api.getData();

  const cards = PAGES.map((p) => {
    const scope = p.scope;
    const isHidden = scope !== 'global' && !!data['global']?.hidden?.[`page.${scope.replace('lp:', '')}`];
    const canEdit = api.canEditScope(scope);
    const navLabel = data['global']?.labels?.[`page.${scope.replace('lp:', '')}.nav-label`];

    return `
      <a class="card-item" href="#/paginas/${scopeToSlug(scope)}">
        <div class="flex-row">
          <span class="card-item__badge ${isHidden ? 'is-hidden' : ''}">
            ${p.isHome ? 'home' : isHidden ? 'oculta' : 'visível'}
          </span>
          ${canEdit ? '' : '<span class="card-item__badge">sem permissão</span>'}
        </div>
        <span class="card-item__title">${escapeHtml(p.label)}</span>
        <span class="card-item__meta">${escapeHtml(p.description || p.path.replace('../', ''))}</span>
        ${navLabel ? `<span class="card-item__meta muted">nav: “${escapeHtml(navLabel)}”</span>` : ''}
      </a>
    `;
  }).join('');

  root.innerHTML = `
    <div class="view">
      <h1>Páginas</h1>
      <p class="view__lede">Clique em uma página para editar as seções dela.</p>
      <div class="card-list">${cards}</div>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
