// TULIPA · LPs setoriais — render dinâmico dos diretores
// Procura por elementos com data-directors-sector="X" e injeta cards
// com foto + bio + redes pros profiles do setor com is_director_visible=true.
//
// Usado em /atividades/pesquisa.html, midia.html, tesouraria.html, secretaria.html,
// presidencia.html, professor-orientador.html, professor-colaborador.html.

import { listDirectorsBySector } from './directors.js';

async function init() {
  const slots = document.querySelectorAll('[data-directors-sector]');
  if (!slots.length) return;

  // agrupa slots por sector pra fazer 1 query por sector
  const bySector = new Map();
  for (const slot of slots) {
    const s = slot.dataset.directorsSector;
    if (!bySector.has(s)) bySector.set(s, []);
    bySector.get(s).push(slot);
  }

  for (const [sector, targets] of bySector) {
    const { data, error } = await listDirectorsBySector(sector);
    if (error) {
      console.warn('[directors] erro ao buscar setor', sector, error);
      continue;
    }
    if (!data.length) {
      // sem diretores visíveis — esconde o slot
      for (const t of targets) t.hidden = true;
      continue;
    }
    for (const t of targets) renderInto(t, data);
  }
}

function renderInto(target, directors) {
  target.hidden = false;
  target.innerHTML = `<div class="director-grid ${directors.length >= 2 ? 'is-compact' : ''}">${directors.map(directorCard).join('')}</div>`;
  // se o slot tem irmão `.direction-duo` ou `.profile-card--simple`, esconde
  // (substituição do estático pelo dinâmico)
  let sib = target.nextElementSibling;
  while (sib) {
    if (sib.classList?.contains('direction-duo') || (sib.classList?.contains('profile-card') && sib.classList?.contains('profile-card--simple'))) {
      sib.hidden = true;
    }
    sib = sib.nextElementSibling;
  }
  // se está dentro de uma section com [data-director-section] hidden, revela
  const parentSection = target.closest('[data-director-section]');
  if (parentSection) parentSection.hidden = false;
}

function directorCard(d) {
  const initials = (d.display_name || '?').split(/\s+/).slice(0, 2).map((s) => s[0] || '').join('').toUpperCase();
  const igHref = d.instagram ? `https://instagram.com/${encodeURIComponent(d.instagram.replace(/^@/, ''))}` : '';
  const roleLabel = d.role === 'coordinator' ? 'Coordenação' : d.role === 'admin' ? 'Direção' : 'Membro';

  return `
    <article class="profile-card profile-card--simple director-card">
      <div class="profile-card__avatar director-card__avatar">
        ${d.avatar_url
          ? `<img src="${escapeAttr(d.avatar_url)}" alt="Foto de ${escapeAttr(d.display_name)}" loading="lazy" onerror="this.parentElement.classList.add('is-broken')" />`
          : `<span class="director-card__initials">${escapeHtml(initials || '?')}</span>`}
      </div>
      <div class="profile-card__main director-card__main">
        <h3>${escapeHtml(d.display_name || '')}</h3>
        <p class="profile-card__role">— ${escapeHtml(roleLabel)}${d.team ? ` · ${escapeHtml(d.team)}` : ''}</p>
        ${d.bio_md ? `<div class="director-card__bio">${renderMarkdown(d.bio_md)}</div>` : ''}
        ${directorSocials(d, igHref)}
      </div>
    </article>
  `;
}

function directorSocials(d, igHref) {
  const links = [];
  if (d.instagram) links.push({ label: '@' + d.instagram.replace(/^@/, ''), href: igHref, icon: 'instagram' });
  for (const extra of (d.social_links || [])) {
    if (extra.label && extra.url) links.push({ label: extra.label, href: extra.url, icon: 'link' });
  }
  if (links.length === 0) return '';
  return `
    <div class="director-card__socials">
      ${links.map((l) => `
        <a href="${escapeAttr(l.href)}" target="_blank" rel="noopener" class="director-card__social director-card__social--${l.icon}">
          ${socialIcon(l.icon)}<span>${escapeHtml(l.label)}</span>
        </a>
      `).join('')}
    </div>
  `;
}

function socialIcon(kind) {
  const icons = {
    instagram: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/></svg>`,
    link:      `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M10 14a4 4 0 0 1 0-6l3-3a4 4 0 0 1 6 6l-1.5 1.5"/><path d="M14 10a4 4 0 0 1 0 6l-3 3a4 4 0 0 1-6-6l1.5-1.5"/></svg>`,
  };
  return icons[kind] || icons.link;
}

// markdown leve (mesma lógica do grupo-renderer)
function renderMarkdown(src) {
  if (!src) return '';
  let s = String(src).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = s.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    let m = line.match(/^(#{1,3})\s+(.+)$/);
    if (m) { out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); i++; continue; }
    if (/^>\s?/.test(line)) {
      const blk = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { blk.push(lines[i].replace(/^>\s?/, '')); i++; }
      out.push(`<blockquote>${inline(blk.join('<br/>'))}</blockquote>`); continue;
    }
    if (/^-\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^-\s+/.test(lines[i])) { items.push(`<li>${inline(lines[i].replace(/^-\s+/, ''))}</li>`); i++; }
      out.push(`<ul>${items.join('')}</ul>`); continue;
    }
    if (line.trim() === '') { i++; continue; }
    const para = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,3}|>|-|\d+\.)/.test(lines[i])) { para.push(lines[i]); i++; }
    out.push(`<p>${inline(para.join('<br/>'))}</p>`);
  }
  return out.join('\n');
}
function inline(text) {
  let s = text;
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^_])_([^_\n]+?)_(?!_)/g, '$1<em>$2</em>');
  return s;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

init();
