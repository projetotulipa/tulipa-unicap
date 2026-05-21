// Help banner — pílula discreta no topo dos painéis admin que abre
// "como funciona este módulo" em Cormorant italic. Estado salvo por slot.

import { icon } from '../icons.js';
import { stampSeal } from '../pages/signet.js';

const LS_HELP_OPEN = 'tulipa:help-open';

function readOpenState() {
  try {
    const raw = localStorage.getItem(LS_HELP_OPEN);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function writeOpenState(state) {
  try { localStorage.setItem(LS_HELP_OPEN, JSON.stringify(state)); } catch {}
}

export function renderHelpBanner({ slot, title }) {
  return `
    <div class="help-banner" data-slot="${escapeAttr(slot)}" data-open="0">
      <button class="help-banner__toggle" data-action="help-toggle" aria-expanded="false">
        <span class="help-banner__signet" aria-hidden="true">${stampSeal({ size: 14 })}</span>
        <span class="help-banner__label">${escapeHtml(title)}</span>
        <span class="help-banner__chev" aria-hidden="true">${icon('chevron', { size: 12 })}</span>
      </button>
      <div class="help-banner__body" hidden>
        <div class="help-banner__loading">
          <span class="help-banner__bloom"><span class="help-banner__signet">${stampSeal({ size: 18 })}</span></span>
        </div>
      </div>
    </div>
  `;
}

// chama depois que o HTML está no DOM; carrega conteúdo e bind toggle
export async function wireHelpBanner(ctx, slot) {
  const banner = document.querySelector(`.help-banner[data-slot="${cssEscape(slot)}"]`);
  if (!banner) return;

  const toggleBtn = banner.querySelector('[data-action="help-toggle"]');
  const bodyEl = banner.querySelector('.help-banner__body');

  const openState = readOpenState();
  let isOpen = !!openState[slot];

  function applyOpen(open) {
    isOpen = open;
    banner.dataset.open = open ? '1' : '0';
    bodyEl.hidden = !open;
    toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    openState[slot] = open;
    writeOpenState(openState);
  }
  applyOpen(isOpen);

  toggleBtn.addEventListener('click', () => applyOpen(!isOpen));

  // carrega conteúdo
  try {
    const content = await ctx.api.getHelpContent(slot);
    bodyEl.innerHTML = `
      <div class="help-banner__content">
        ${renderHelpMarkdown(content.body)}
      </div>
    `;
    // atualiza label se o título salvo for diferente do original
    const labelEl = banner.querySelector('.help-banner__label');
    if (labelEl && content.title) labelEl.textContent = content.title;
  } catch (e) {
    bodyEl.innerHTML = `<p class="help-banner__error">não foi possível carregar o texto: ${escapeHtml(e.message || String(e))}</p>`;
  }
}

// Renderizador de markdown leve específico pro help (headings + listas + ênfase).
// Não usa o admin/markdown.js (que é mais simples — só ênfase + br).
export function renderHelpMarkdown(md) {
  if (md == null) return '';
  const src = String(md).replace(/\r\n/g, '\n');
  const lines = src.split('\n');
  const out = [];
  let inList = false;
  let paraBuf = [];

  function flushPara() {
    if (paraBuf.length) {
      out.push(`<p>${inline(paraBuf.join(' '))}</p>`);
      paraBuf = [];
    }
  }
  function closeList() {
    if (inList) { out.push('</ul>'); inList = false; }
  }

  for (let raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      closeList();
      continue;
    }

    if (line === '---' || line === '***') {
      flushPara();
      closeList();
      out.push('<hr/>');
      continue;
    }

    // headings: ##, ###, ####
    let m;
    if ((m = line.match(/^(#{2,4})\s+(.+)$/))) {
      flushPara();
      closeList();
      const level = m[1].length; // 2..4 → h3..h5
      const tag = `h${Math.min(level + 1, 5)}`;
      out.push(`<${tag}>${inline(m[2])}</${tag}>`);
      continue;
    }

    // lista com - ou *
    if ((m = line.match(/^[-*]\s+(.+)$/))) {
      flushPara();
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(m[1])}</li>`);
      continue;
    }

    // parágrafo (acumula)
    paraBuf.push(line);
  }
  flushPara();
  closeList();
  return out.join('');
}

function inline(s) {
  let v = String(s);
  // escape básico
  v = v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // **bold**
  v = v.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
  // *italic* (sem pisar no **)
  v = v.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
  // _italic_
  v = v.replace(/(^|[^_])_([^_\n]+?)_(?!_)/g, '$1<em>$2</em>');
  return v;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
function cssEscape(s) {
  return (window.CSS && window.CSS.escape) ? window.CSS.escape(s) : String(s).replace(/"/g, '\\"');
}
