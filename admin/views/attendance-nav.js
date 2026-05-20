// Sub-nav (pills) compartilhada entre as views de Presença.

import { icon } from '../icons.js';

const ITEMS = [
  { key: 'dashboard', label: 'Visão geral', hash: '#/presenca',         iconName: 'attendance' },
  { key: 'grupos',    label: 'Grupos',      hash: '#/presenca/grupos',  iconName: 'group' },
  { key: 'pessoas',   label: 'Pessoas',     hash: '#/presenca/pessoas', iconName: 'users' },
];

export function renderSubNav(active) {
  return `
    <nav class="sub-nav" aria-label="Navegação interna de Presença">
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
