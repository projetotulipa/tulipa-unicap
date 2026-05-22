import { icon } from '../icons.js';

const ITEMS = [
  { key: 'dashboard', label: 'Visão geral',    hash: '#/midia',          iconName: 'attendance' },
  { key: 'posts',     label: 'Posts recebidos',hash: '#/midia/posts',    iconName: 'spark' },
  { key: 'tasks',     label: 'Tarefas',        hash: '#/midia/tarefas',  iconName: 'check-circle' },
  { key: 'teams',     label: 'Equipes',        hash: '#/midia/equipes',  iconName: 'group' },
  { key: 'calendar',  label: 'Calendário',     hash: '#/midia/calendario', iconName: 'calendar' },
  { key: 'useful',    label: 'Úteis',          hash: '#/midia/uteis',    iconName: 'external' },
];

export function renderMediaNav(active) {
  return `
    <nav class="sub-nav" aria-label="Navegação interna de Mídia">
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
