import { icon } from '../icons.js';

const ITEMS = [
  { key: 'dashboard',   label: 'Visão geral',   hash: '#/financeiro',              iconName: 'attendance' },
  { key: 'mensalidades',label: 'Mensalidades',  hash: '#/financeiro/mensalidades', iconName: 'users' },
  { key: 'gastos',      label: 'Gastos',        hash: '#/financeiro/gastos',       iconName: 'trash' },
  { key: 'planejamento',label: 'Planejamento',  hash: '#/financeiro/planejamento', iconName: 'spark' },
  { key: 'useful',      label: 'Úteis',         hash: '#/financeiro/uteis',        iconName: 'external' },
];

export function renderFinanceNav(active) {
  return `
    <nav class="sub-nav" aria-label="Navegação financeira">
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
