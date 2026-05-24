// TULIPA · LP genérica de Grupos de Estudo — popula cards dinâmicos
// Busca grupos publicados, separa ativos/arquivados, renderiza cards linkando
// pra LP filha (atualmente grupo.html?id=<slug>; Pretty URLs via 404 redirect).

import { listPublishedStudyGroups } from './study-groups.js';
import { coverIcon } from './study-group-icons.js';

const ACTIVE_SECTION  = document.getElementById('grupos-ativos');
const ACTIVE_GRID     = document.getElementById('gruposAtivosGrid');
const ARCHIVE_SECTION = document.getElementById('grupos-arquivo');
const ARCHIVE_GRID    = document.getElementById('gruposArquivoGrid');

async function init() {
  if (!ACTIVE_GRID || !ARCHIVE_GRID) return;

  const { active, archived, error } = await listPublishedStudyGroups();
  if (error) {
    console.warn('[grupos-list] erro:', error);
    return;
  }

  if (active.length > 0) {
    ACTIVE_GRID.innerHTML = active.map(cardHtml).join('');
    ACTIVE_SECTION.removeAttribute('hidden');
  }
  if (archived.length > 0) {
    ARCHIVE_GRID.innerHTML = archived.map((g) => cardHtml(g, true)).join('');
    ARCHIVE_SECTION.removeAttribute('hidden');
  }
}

function cardHtml(g, isArchived = false) {
  const accent = g.accent_color || 'wine';
  const url = `grupos-de-estudo/${encodeURIComponent(g.slug)}`;
  const lede = g.lede ? truncate(stripHtml(g.lede), 140) : 'Clique pra ver descrição, encontros e material complementar.';
  const hasCover = !!g.cover_image_url;
  return `
    <a class="grupo-card grupo-card--${accent} ${hasCover ? 'has-cover' : ''} ${isArchived ? 'is-archived' : ''}" href="${escapeAttr(url)}">
      <div class="grupo-card__cover" aria-hidden="true">
        ${hasCover
          ? `<img src="${escapeAttr(g.cover_image_url)}" alt="" loading="lazy" onerror="this.parentElement.classList.remove('has-img');this.parentElement.innerHTML='${escapeAttr(coverIcon(g.cover_emoji || 'book', 42))}';" />
             <div class="grupo-card__cover-overlay"></div>`
          : coverIcon(g.cover_emoji || 'book', 42)}
      </div>
      <div class="grupo-card__main">
        <h3 class="grupo-card__title">${escapeHtml(g.group_name || '(sem nome)')}</h3>
        <p class="grupo-card__lede">${escapeHtml(lede)}</p>
        <span class="grupo-card__cta">${isArchived ? 'ver memória' : 'explorar'} →</span>
      </div>
    </a>
  `;
}

function truncate(s, n) {
  if (!s) return '';
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}
function stripHtml(html) {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = String(html);
  return tmp.textContent.replace(/\s+/g, ' ').trim();
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

init();
