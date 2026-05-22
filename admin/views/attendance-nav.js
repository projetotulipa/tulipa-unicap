// Sub-nav (pills) compartilhada entre as views da Secretaria.

import { icon } from '../icons.js';

const ITEMS = [
  { key: 'dashboard', label: 'Visão geral', hash: '#/presenca',           iconName: 'attendance' },
  { key: 'grupos',    label: 'Grupos',      hash: '#/presenca/grupos',    iconName: 'group' },
  { key: 'pessoas',   label: 'Pessoas',     hash: '#/presenca/pessoas',   iconName: 'users' },
  { key: 'semestres', label: 'Semestres',   hash: '#/presenca/semestres', iconName: 'calendar', adminOnly: true },
  { key: 'useful',    label: 'Úteis',       hash: '#/presenca/uteis',     iconName: 'external' },
];

export function renderSubNav(active, opts = {}) {
  const isAdmin = !!opts.isAdmin;
  return `
    <nav class="sub-nav" aria-label="Navegação interna da Secretaria">
      ${ITEMS.filter((it) => !it.adminOnly || isAdmin).map((it) => `
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
