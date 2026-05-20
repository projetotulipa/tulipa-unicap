import { icon } from '../icons.js';

const ITEMS = [
  { key: 'dashboard',    label: 'Visão geral',  hash: '#/pesquisa',              iconName: 'attendance' },
  { key: 'fichamentos',  label: 'Fichamentos',  hash: '#/pesquisa/fichamentos',  iconName: 'page' },
  { key: 'posts',        label: 'Posts',        hash: '#/pesquisa/posts',        iconName: 'spark' },
];

export function renderResearchNav(active) {
  return `
    <nav class="sub-nav" aria-label="Navegação interna de Pesquisa">
      ${ITEMS.map((it) => `
        <a href="${it.hash}" class="${active === it.key ? 'is-active' : ''}">
          ${icon(it.iconName, { size: 14 })}
          <span>${escapeHtml(it.label)}</span>
        </a>
      `).join('')}
    </nav>
  `;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
