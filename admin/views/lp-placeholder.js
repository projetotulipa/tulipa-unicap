import { PAGES } from '../pages-meta.js';
import { icon } from '../icons.js';

export function renderLpPlaceholder(ctx, slug) {
  const { root } = ctx;
  const page = PAGES.find((p) => p.scope === `lp:${slug}`) || PAGES.find((p) => p.scope === slug);

  if (!page) {
    root.innerHTML = `
      <div class="view">
        <p class="view__crumbs"><a href="#/paginas">${icon('arrow-left', { size: 14 })}<span style="margin-left:6px;">Páginas</span></a></p>
        <h1>Página não encontrada</h1>
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <div class="view">
      <p class="view__crumbs"><a href="#/paginas">${icon('arrow-left', { size: 14 })}<span style="margin-left:6px;">Páginas</span></a></p>
      <h1>${escapeHtml(page.label)}</h1>
      <div class="empty-state empty-state--soft">
        <p style="font-size:18px;">Editor visual desta página ainda não foi criado.</p>
        <p>Por enquanto a única página com edição completa é a <a href="#/paginas/home">Home</a>. Quando você precisar editar “${escapeHtml(page.label)}”, é só pedir e eu monto o esquema dela.</p>
        <p class="muted" style="margin-top:24px;">Você pode <strong>ocultar</strong> esta página inteira pelo interruptor na aba Páginas — isso remove de todos os menus, mas a URL continua acessível.</p>
      </div>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
