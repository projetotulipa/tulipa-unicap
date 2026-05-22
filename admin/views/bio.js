// Bio editor — /admin/#/bio
// Edita identidade (avatar/nome/tagline/bio) + cards (label/href/imagem/desc/hidden/order).
// Upload de imagens via Supabase Storage (bucket bio-assets).

import { icon } from '../icons.js';
import { stampSeal } from '../pages/signet.js';
import { toastSuccess, toastError } from '../toast.js';
import { supabase } from '../../js/supabase.js';

const PUBLIC_BIO_URL = '../bio/';
const BIO_SCOPE = 'bio:default';

// Catálogo de ícones — sincronizado com SVG_BY_ICON em bio/bio.js.
// Thumbnails simplificados pra UI compacta.
const ICON_LIBRARY = [
  { id: null,         label: 'nenhum',     thumb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="12" cy="12" r="9" stroke-dasharray="2 3"/></svg>' },
  { id: 'brand',      label: 'tulipa',     thumb: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4 C 8 6 7 10 8 14 C 9 18 12 18 12 18 C 12 18 15 18 16 14 C 17 10 16 6 12 4 Z"/></svg>' },
  { id: 'heart',      label: 'coração',    thumb: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20 C 6 16 3 13 3 9 C 3 6 5 4 8 4 C 10 4 11 5 12 7 C 13 5 14 4 16 4 C 19 4 21 6 21 9 C 21 13 18 16 12 20 Z"/></svg>' },
  { id: 'star',       label: 'estrela',    thumb: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3 L14.5 9 L21 9.5 L16 13.5 L17.5 20 L12 16.5 L6.5 20 L8 13.5 L3 9.5 L9.5 9 Z"/></svg>' },
  { id: 'form',       label: 'formulário', thumb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="5" y="3" width="14" height="18" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="14" y2="12"/><line x1="8" y1="16" x2="12" y2="16"/></svg>' },
  { id: 'book',       label: 'livro',      thumb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4 C 8 3 10 4 12 6 L12 20 C 10 18 8 17 4 18 Z"/><path d="M20 4 C 16 3 14 4 12 6 L12 20 C 14 18 16 17 20 18 Z"/></svg>' },
  { id: 'calendar',   label: 'calendário', thumb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/></svg>' },
  { id: 'coffee',     label: 'café',       thumb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9 L17 9 L16 18 C 16 19.5 14.5 20 13 20 L9 20 C 7.5 20 6 19.5 6 18 Z"/><path d="M17 11 C 19.5 11 20 13 19 14.5 C 18 16 17 15.5 17 15"/><path d="M9 4 V 7 M12 3 V 7 M15 4 V 7"/></svg>' },
  { id: 'email',      label: 'email',      thumb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7 L12 14 L21 7"/></svg>' },
  { id: 'instagram',  label: 'instagram',  thumb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>' },
  { id: 'whatsapp',   label: 'whatsapp',   thumb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12 C 21 17 17 21 12 21 C 10.5 21 9.2 20.6 8 20 L3 21 L4 16 C 3.4 14.8 3 13.5 3 12 C 3 7 7 3 12 3 C 17 3 21 7 21 12 Z"/><path d="M8 9 C 8 12 12 16 15 16 L17 14 L14 13 L12 14 C 11 13 10 12 9 11 L10 9 Z" fill="currentColor"/></svg>' },
  { id: 'pin',        label: 'local',      thumb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 C 8 2 5 5 5 9 C 5 14 12 22 12 22 C 12 22 19 14 19 9 C 19 5 16 2 12 2 Z"/><circle cx="12" cy="9" r="2.5"/></svg>' },
  { id: 'play',       label: 'vídeo',      thumb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M10 8 L16 12 L10 16 Z" fill="currentColor"/></svg>' },
  { id: 'music',      label: 'música',     thumb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18 V 7 L20 5 V 16"/><circle cx="6.5" cy="18" r="2.5" fill="currentColor"/><circle cx="17.5" cy="16" r="2.5" fill="currentColor"/></svg>' },
  { id: 'generic',    label: 'genérico',   thumb: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8" opacity="0.5"/><path d="M12 7 L13.5 11 L18 11 L14.5 13.5 L16 18 L12 15 L8 18 L9.5 13.5 L6 11 L10.5 11 Z"/></svg>' },
];

let cached = null;   // { ctx, state, original }
let isDirty = false;
let unsavedWarner = null;

export async function renderBio(ctx) {
  const { root } = ctx;
  root.innerHTML = `
    <div class="view">
      <div class="bio-editor-loading">
        <span class="pages-bloom"><span class="pages-signet">${stampSeal({ size: 24 })}</span></span>
        <p>Abrindo a bio…</p>
      </div>
    </div>
  `;

  let content;
  try {
    content = await ctx.api.getBioContent();
  } catch (e) {
    root.innerHTML = `<p class="muted" style="padding: 30px;">erro ao carregar: ${escapeHtml(e?.message || String(e))}</p>`;
    return;
  }

  cached = {
    ctx,
    state: deepClone(content),
    original: deepClone(content),
  };
  isDirty = false;

  draw();
  if (unsavedWarner) {
    window.removeEventListener('beforeunload', unsavedWarner);
  }
  unsavedWarner = (ev) => {
    if (isDirty) {
      ev.preventDefault();
      ev.returnValue = 'Você tem alterações não salvas na Bio. Continuar?';
    }
  };
  window.addEventListener('beforeunload', unsavedWarner);
}

function draw() {
  const { ctx } = cached;
  ctx.root.innerHTML = `
    <div class="view">
      <header class="bio-editor-hero">
        <div class="bio-editor-hero__inner">
          <p class="bio-editor-hero__eyebrow">linktree · página /bio</p>
          <h1>Bio / Linktree</h1>
          <p class="bio-editor-hero__lede">Página mobile-first pra ir na bio do Instagram. Edite identidade e cards; cada salvamento publica.</p>
        </div>
        <div class="bio-editor-hero__actions">
          <a class="btn btn--ghost btn--small" href="${PUBLIC_BIO_URL}" target="_blank" rel="noopener" title="Abrir /bio em nova aba">
            ${icon('external', { size: 14 })}<span style="margin-left:6px;">Abrir /bio</span>
          </a>
          <button class="btn btn--ghost btn--small" data-action="history" title="Ver histórico de publicações">
            ${icon('clock', { size: 14 })}<span style="margin-left:6px;">Histórico</span>
          </button>
          <button class="btn btn--ghost btn--small" data-action="reset">
            ${icon('refresh', { size: 14 })}<span style="margin-left:6px;">Restaurar padrão</span>
          </button>
          <button class="btn btn--primary" data-action="save" id="bioSaveBtn" ${isDirty ? '' : 'disabled'}>
            ${isDirty ? 'Salvar' : 'Tudo salvo'}
          </button>
        </div>
      </header>

      <section class="bio-editor-section">
        <header class="bio-editor-section__head">
          <h2>Identidade</h2>
        </header>
        <div class="bio-editor-field">
          <label class="bio-editor-label">Foto de perfil (avatar)</label>
          <div class="bio-editor-avatar-row">
            <span class="bio-editor-avatar-preview">${avatarPreviewHtml(cached.state.identity.avatar, cached.state.identity.name)}</span>
            <input type="url" class="bio-editor-input" id="bioAvatarUrl"
                   value="${escapeAttr(cached.state.identity.avatar || '')}"
                   placeholder="URL da imagem (ou use o botão ao lado)" />
            <input type="file" id="bioAvatarFile" accept="image/*" hidden />
            <button class="btn btn--ghost btn--small" data-action="upload-avatar">${icon('plus', { size: 12 })}<span style="margin-left:4px;">Enviar</span></button>
            ${cached.state.identity.avatar ? `<button class="btn btn--ghost btn--small" data-action="clear-avatar" style="color: var(--danger-soft); border-color: rgba(194, 74, 74, 0.4);">remover</button>` : ''}
          </div>
          <p class="bio-editor-hint">Cole uma URL pública ou envie um arquivo (máx 1MB). É exibida no topo da /bio, redonda.</p>
        </div>

        <div class="bio-editor-row">
          <div class="bio-editor-field">
            <label class="bio-editor-label" for="bioName">Nome exibido</label>
            <input type="text" id="bioName" class="bio-editor-input" maxlength="60"
                   value="${escapeAttr(cached.state.identity.name)}" placeholder="TULIPA" />
          </div>
          <div class="bio-editor-field">
            <label class="bio-editor-label" for="bioTagline">Tagline (linha pequena abaixo)</label>
            <input type="text" id="bioTagline" class="bio-editor-input" maxlength="120"
                   value="${escapeAttr(cached.state.identity.tagline)}" placeholder="Psicologia Analítica · UNICAP" />
          </div>
        </div>

        <div class="bio-editor-field">
          <label class="bio-editor-label" for="bioBio">Bio curta (1-2 frases — aceita <code>**negrito**</code> e <code>*itálico*</code>)</label>
          <textarea id="bioBio" class="bio-editor-input" rows="3" maxlength="280" placeholder="O que descreve o projeto em poucas palavras?">${escapeHtml(cached.state.identity.bio)}</textarea>
        </div>
      </section>

      <section class="bio-editor-section">
        <header class="bio-editor-section__head">
          <h2>Botões e Cards</h2>
          <button class="btn btn--primary btn--small" data-action="add-link">${icon('plus', { size: 12 })}<span style="margin-left:6px;">Adicionar link</span></button>
        </header>
        <p class="bio-editor-hint" style="margin-bottom: 12px;">
          Com imagem/SVG → vira "card carta" (alternando lado). Sem imagem → botão simples. Descrição é opcional.
        </p>
        <div id="bioLinksList" class="bio-editor-links"></div>
      </section>

      <section class="bio-editor-section">
        <header class="bio-editor-section__head">
          <h2>Cliques nos links</h2>
          <button class="btn btn--ghost btn--small" data-action="reload-clicks" title="Atualizar">
            ${icon('refresh', { size: 12 })}<span style="margin-left:6px;">Atualizar</span>
          </button>
        </header>
        <p class="bio-editor-hint" style="margin-bottom: 12px;">
          Contagem dos últimos 30 dias por card. Cliques anônimos, sem PII. Respeita Do Not Track.
        </p>
        <div id="bioClicksList" class="bio-editor-clicks">
          <div class="bio-editor-clicks__loading">carregando…</div>
        </div>
      </section>
    </div>
  `;

  renderLinks();
  bindIdentity();
  bindHeroActions();
  renderClicks().catch((e) => console.warn('[bio] clicks:', e?.message));
}

function bindIdentity() {
  const root = cached.ctx.root;
  root.querySelector('#bioName')?.addEventListener('input', (e) => {
    cached.state.identity.name = e.target.value;
    markDirty();
  });
  root.querySelector('#bioTagline')?.addEventListener('input', (e) => {
    cached.state.identity.tagline = e.target.value;
    markDirty();
  });
  root.querySelector('#bioBio')?.addEventListener('input', (e) => {
    cached.state.identity.bio = e.target.value;
    markDirty();
  });
  root.querySelector('#bioAvatarUrl')?.addEventListener('input', (e) => {
    cached.state.identity.avatar = e.target.value || null;
    markDirty();
    refreshAvatarPreview();
  });

  root.querySelector('[data-action="upload-avatar"]')?.addEventListener('click', () => {
    root.querySelector('#bioAvatarFile')?.click();
  });
  root.querySelector('#bioAvatarFile')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toastError('Arquivo grande demais (máx 1MB).');
      return;
    }
    await uploadAvatar(file);
    e.target.value = '';
  });

  root.querySelector('[data-action="clear-avatar"]')?.addEventListener('click', () => {
    cached.state.identity.avatar = null;
    markDirty();
    draw();
  });
}

async function uploadAvatar(file) {
  const btn = cached.ctx.root.querySelector('[data-action="upload-avatar"]');
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'enviando…';
  try {
    const { url, error } = await cached.ctx.api.uploadBioImage(file);
    if (error) throw error;
    cached.state.identity.avatar = url;
    markDirty();
    toastSuccess('Avatar enviado.');
    draw();
  } catch (e) {
    toastError(`Erro no upload: ${e.message || e}`);
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

function refreshAvatarPreview() {
  const preview = cached.ctx.root.querySelector('.bio-editor-avatar-preview');
  if (preview) {
    preview.innerHTML = avatarPreviewInnerHtml(cached.state.identity.avatar, cached.state.identity.name);
  }
}

function avatarPreviewHtml(url, name) {
  return avatarPreviewInnerHtml(url, name);
}
function avatarPreviewInnerHtml(url, name) {
  if (url) {
    return `<img src="${escapeAttr(url)}" alt="" onerror="this.replaceWith(document.createTextNode('${escapeHtml(initials(name))}'))" />`;
  }
  return escapeHtml(initials(name));
}

function bindHeroActions() {
  const root = cached.ctx.root;
  root.querySelector('[data-action="save"]')?.addEventListener('click', doSave);
  root.querySelector('[data-action="reset"]')?.addEventListener('click', doReset);
  root.querySelector('[data-action="add-link"]')?.addEventListener('click', addLink);
  root.querySelector('[data-action="history"]')?.addEventListener('click', () => openBioHistoryDrawer(cached.ctx));
  root.querySelector('[data-action="reload-clicks"]')?.addEventListener('click', () => {
    renderClicks().catch(() => {});
  });
}

// ===== Analytics — cliques por link =====
async function renderClicks() {
  const box = cached?.ctx?.root?.querySelector('#bioClicksList');
  if (!box) return;
  box.innerHTML = `<div class="bio-editor-clicks__loading">carregando…</div>`;

  // Busca agregado dos últimos 30d + diário pra mini-sparkline
  const [{ data: summary, error: e1 }, { data: daily, error: e2 }] = await Promise.all([
    supabase.from('bio_clicks_summary').select('*').order('total_30d', { ascending: false }),
    supabase.from('bio_clicks_daily').select('*'),
  ]);

  if (e1 || e2) {
    const msg = e1?.message || e2?.message || 'erro desconhecido';
    if (/relation .* does not exist|bio_clicks_summary/i.test(msg)) {
      box.innerHTML = `<div class="bio-editor-clicks__empty">
        <strong>Tracking ainda não habilitado.</strong><br/>
        Rode <code>supabase/014-bio-clicks.sql</code> no Supabase pra criar a tabela <code>bio_clicks</code> + views.
      </div>`;
    } else {
      box.innerHTML = `<div class="bio-editor-clicks__empty">erro: ${escapeHtml(msg)}</div>`;
    }
    return;
  }

  if (!summary || summary.length === 0) {
    box.innerHTML = `<div class="bio-editor-clicks__empty">Nenhum clique nos últimos 30 dias. (Tudo certo se a /bio acabou de ser publicada.)</div>`;
    return;
  }

  const dailyByLink = new Map();
  for (const d of daily || []) {
    if (!dailyByLink.has(d.link_id)) dailyByLink.set(d.link_id, []);
    dailyByLink.get(d.link_id).push({ day: d.day, clicks: d.clicks });
  }

  // Mapa de cards atuais (pra mostrar título atual mesmo se label mudou)
  const currentByLid = new Map(
    (cached?.state?.links || []).map((l) => [l.id, l])
  );

  const total30d = summary.reduce((acc, r) => acc + (r.total_30d || 0), 0);
  const max30d = Math.max(...summary.map((r) => r.total_30d || 0), 1);

  box.innerHTML = `
    <div class="bio-clicks-summary">
      <div class="bio-clicks-summary__total">
        <span class="bio-clicks-summary__total-num">${total30d}</span>
        <span class="bio-clicks-summary__total-label">cliques · 30 dias</span>
      </div>
    </div>
    <div class="bio-clicks-table">
      ${summary.map((r) => {
        const cur = currentByLid.get(r.link_id);
        const label = (cur?.label || r.link_label || '(sem rótulo)');
        const orphan = !cur;
        const pct = Math.round(((r.total_30d || 0) / max30d) * 100);
        const sparkline = sparklineSvg(dailyByLink.get(r.link_id) || []);
        return `
          <article class="bio-clicks-row ${orphan ? 'is-orphan' : ''}">
            <div class="bio-clicks-row__label">
              <span class="bio-clicks-row__name">${escapeHtml(label)}</span>
              ${orphan ? `<span class="bio-clicks-row__orphan-tag">removido</span>` : ''}
              ${r.link_href ? `<a class="bio-clicks-row__href" href="${escapeAttr(r.link_href)}" target="_blank" rel="noopener" title="abrir">${escapeHtml(truncate(r.link_href, 60))}</a>` : ''}
            </div>
            <div class="bio-clicks-row__bars">
              <div class="bio-clicks-row__bar" style="width: ${pct}%"></div>
            </div>
            <div class="bio-clicks-row__nums">
              <span class="bio-clicks-row__big">${r.total_30d}</span>
              <span class="bio-clicks-row__small">${r.total_7d}/7d · ${r.total_24h}/24h</span>
            </div>
            <div class="bio-clicks-row__spark" title="cliques por dia (30d)">${sparkline}</div>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function sparklineSvg(points) {
  if (!points.length) return '';
  // Normaliza pra 30 dias retroativos
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets = new Array(30).fill(0);
  for (const p of points) {
    const d = new Date(p.day + 'T00:00:00');
    const diff = Math.floor((today - d) / (1000 * 60 * 60 * 24));
    if (diff >= 0 && diff < 30) buckets[29 - diff] = p.clicks;
  }
  const max = Math.max(...buckets, 1);
  const W = 110, H = 28;
  const stepX = W / (buckets.length - 1);
  const path = buckets.map((v, i) => {
    const x = (i * stepX).toFixed(1);
    const y = (H - (v / max) * (H - 4) - 2).toFixed(1);
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');
  return `
    <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">
      <path d="${path}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `;
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

async function doSave() {
  if (!isDirty) return;
  const btn = cached.ctx.root.querySelector('#bioSaveBtn');
  btn.disabled = true;
  btn.textContent = 'salvando…';
  try {
    const { error } = await cached.ctx.api.setBioContent(cached.state);
    if (error) throw error;
    isDirty = false;
    cached.original = deepClone(cached.state);
    btn.textContent = 'salvo ✓';
    toastSuccess('Bio publicada — visível em /bio.');
    setTimeout(() => {
      btn.textContent = 'Tudo salvo';
      btn.disabled = true;
    }, 1500);
  } catch (e) {
    toastError(`Erro ao salvar: ${e.message || e}`);
    btn.disabled = false;
    btn.textContent = 'Salvar';
  }
}

async function doReset() {
  if (!confirm('Restaurar a Bio para o padrão original (2 cards padrão da TULIPA)? Suas alterações serão perdidas.')) return;
  const btn = cached.ctx.root.querySelector('[data-action="reset"]');
  btn.disabled = true;
  btn.textContent = 'restaurando…';
  try {
    const { error } = await cached.ctx.api.resetBioContent();
    if (error) throw error;
    toastSuccess('Bio restaurada.');
    await renderBio(cached.ctx);
  } catch (e) {
    toastError(`Erro: ${e.message || e}`);
    btn.disabled = false;
    btn.textContent = 'Restaurar padrão';
  }
}

function addLink() {
  cached.state.links.push({
    id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label: '',
    href: '',
    description: '',
    image: null,
    icon: null,
    hidden: false,
  });
  markDirty();
  renderLinks();
  // foca o input do novo
  setTimeout(() => {
    const inputs = cached.ctx.root.querySelectorAll('.bio-link-card__label-input');
    inputs[inputs.length - 1]?.focus();
  }, 50);
}

function renderLinks() {
  const box = cached.ctx.root.querySelector('#bioLinksList');
  if (!box) return;
  if (!cached.state.links.length) {
    box.innerHTML = `<div class="bio-editor-empty">Nenhum link ainda. Clique em "Adicionar link" pra começar.</div>`;
    return;
  }
  box.innerHTML = cached.state.links.map((link, idx) => linkCardHtml(link, idx)).join('');
  bindLinkActions();
}

function linkCardHtml(link, idx) {
  const total = cached.state.links.length;
  const isFirst = idx === 0;
  const isLast = idx === total - 1;
  const labelLen = (link.label || '').length;
  const labelMax = 60;
  const hrefIssue = hrefValidationIssue(link.href);
  return `
    <article class="bio-link-card ${link.hidden ? 'is-hidden' : ''}" data-idx="${idx}" draggable="true">
      <div class="bio-link-card__drag-handle" title="Arrastar pra reordenar" aria-hidden="true">⋮⋮</div>
      <div class="bio-link-card__image">
        ${link.image
          ? `<img src="${escapeAttr(link.image)}" alt="" />`
          : `<span class="bio-link-card__image-placeholder">sem<br/>imagem</span>`}
      </div>
      <div class="bio-link-card__main">
        <div class="bio-link-card__row">
          <div class="bio-editor-field" style="flex: 1; min-width: 0;">
            <label class="bio-editor-label">
              Texto do botão
              <span class="bio-editor-counter ${labelLen >= labelMax ? 'is-max' : (labelLen >= labelMax - 10 ? 'is-warn' : '')}">${labelLen}/${labelMax}</span>
            </label>
            <input type="text" class="bio-editor-input bio-link-card__label-input" maxlength="${labelMax}"
                   data-bind="label" value="${escapeAttr(link.label)}" placeholder="Saiba mais" />
          </div>
        </div>
        <div class="bio-link-card__row">
          <div class="bio-editor-field" style="flex: 1; min-width: 0;">
            <label class="bio-editor-label">
              Link (href)
              ${hrefIssue ? `<span class="bio-editor-validation" data-issue="${hrefIssue.level}">⚠ ${escapeHtml(hrefIssue.message)}</span>` : ''}
            </label>
            <input type="url" class="bio-editor-input ${hrefIssue?.level === 'err' ? 'has-err' : ''}"
                   data-bind="href" value="${escapeAttr(link.href)}" placeholder="https://…" />
          </div>
        </div>
        <div class="bio-link-card__row bio-link-card__row--split">
          <div class="bio-editor-field" style="flex: 1; min-width: 0;">
            <label class="bio-editor-label">Imagem (URL ou upload)</label>
            <div class="bio-editor-img-row">
              <input type="url" class="bio-editor-input"
                     data-bind="image" value="${escapeAttr(link.image || '')}" placeholder="/images/foto.jpg ou https://…" />
              <input type="file" data-file="image" accept="image/*" hidden />
              <button class="btn btn--ghost btn--small" data-action="upload-link-image">${icon('plus', { size: 12 })}</button>
              ${link.image ? `<button class="btn btn--ghost btn--small" data-action="clear-link-image" style="color: var(--danger-soft);">×</button>` : ''}
            </div>
          </div>
          <div class="bio-editor-field" style="flex: 1; min-width: 0;">
            <label class="bio-editor-label">Descrição (opcional)</label>
            <input type="text" class="bio-editor-input" maxlength="200"
                   data-bind="description" value="${escapeAttr(link.description || '')}" placeholder="Texto curto que aparece no card" />
          </div>
        </div>
        <div class="bio-link-card__row">
          <div class="bio-editor-field" style="flex: 1; min-width: 0;">
            <label class="bio-editor-label">
              Ícone ${link.image ? '<span class="bio-editor-counter">(ignorado — imagem tem prioridade)</span>' : ''}
            </label>
            <div class="bio-icon-picker ${link.image ? 'is-disabled' : ''}" role="radiogroup" aria-label="Ícone do card">
              ${ICON_LIBRARY.map((opt) => `
                <button type="button"
                        class="bio-icon-pick ${ (link.icon || null) === opt.id ? 'is-sel' : ''}"
                        data-action="pick-icon" data-icon-id="${opt.id == null ? '' : escapeAttr(opt.id)}"
                        title="${escapeAttr(opt.label)}" aria-label="${escapeAttr(opt.label)}"
                        ${link.image ? 'disabled' : ''}>
                  ${opt.thumb}
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
      <div class="bio-link-card__actions">
        <button class="bio-link-card__action-btn" data-action="toggle-hide" title="${link.hidden ? 'Mostrar' : 'Ocultar'}">
          ${icon(link.hidden ? 'eye-off' : 'eye', { size: 14 })}
          <span>${link.hidden ? 'oculto' : 'ocultar'}</span>
        </button>
        <button class="bio-link-card__action-btn" data-action="move-up" ${isFirst ? 'disabled' : ''} title="Subir">
          ${icon('arrow-up', { size: 14 })}
        </button>
        <button class="bio-link-card__action-btn" data-action="move-down" ${isLast ? 'disabled' : ''} title="Descer">
          ${icon('arrow-down', { size: 14 })}
        </button>
        <button class="bio-link-card__action-btn" data-action="duplicate" title="Duplicar este card">
          ${icon('copy', { size: 14 })}
        </button>
        <button class="bio-link-card__action-btn bio-link-card__action-btn--danger" data-action="remove" title="Remover">
          ${icon('trash', { size: 14 })}
          <span>remover</span>
        </button>
      </div>
    </article>
  `;
}

function updateLabelCounter(card, value) {
  const max = 60;
  const len = (value || '').length;
  const counter = card.querySelector('.bio-editor-counter');
  if (!counter) return;
  counter.textContent = `${len}/${max}`;
  counter.classList.toggle('is-max', len >= max);
  counter.classList.toggle('is-warn', len >= max - 10 && len < max);
}

function updateHrefValidation(card, value) {
  const labelEl = card.querySelector('input[data-bind="href"]')?.closest('.bio-editor-field')?.querySelector('.bio-editor-label');
  if (!labelEl) return;
  const old = labelEl.querySelector('.bio-editor-validation');
  if (old) old.remove();
  const issue = hrefValidationIssue(value);
  const input = card.querySelector('input[data-bind="href"]');
  if (issue) {
    const span = document.createElement('span');
    span.className = 'bio-editor-validation';
    span.dataset.issue = issue.level;
    span.textContent = `⚠ ${issue.message}`;
    labelEl.appendChild(span);
    input?.classList.toggle('has-err', issue.level === 'err');
  } else {
    input?.classList.remove('has-err');
  }
}

function refreshIconPickerState(card, hasImage) {
  const picker = card.querySelector('.bio-icon-picker');
  if (!picker) return;
  picker.classList.toggle('is-disabled', hasImage);
  picker.querySelectorAll('button').forEach((b) => (b.disabled = hasImage));
}

function hrefValidationIssue(href) {
  if (!href || !href.trim()) return { level: 'warn', message: 'link vazio' };
  const t = href.trim();
  if (/^javascript:/i.test(t) || /^data:/i.test(t)) {
    return { level: 'err', message: 'protocolo bloqueado' };
  }
  if (/^http:/i.test(t)) {
    return { level: 'warn', message: 'use https:' };
  }
  if (/SUA-URL-AQUI|placeholder/i.test(t)) {
    return { level: 'warn', message: 'ainda é placeholder' };
  }
  return null;
}

function bindLinkActions() {
  const root = cached.ctx.root;
  root.querySelectorAll('.bio-link-card').forEach((card) => {
    const idx = Number(card.dataset.idx);

    // inputs bindáveis
    card.querySelectorAll('[data-bind]').forEach((input) => {
      const key = input.dataset.bind;
      input.addEventListener('input', () => {
        cached.state.links[idx][key] = key === 'image' ? (input.value || null) : input.value;
        markDirty();
        if (key === 'image') {
          refreshLinkImage(card, input.value);
          refreshIconPickerState(card, !!input.value);
        }
        if (key === 'label') updateLabelCounter(card, input.value);
        if (key === 'href') updateHrefValidation(card, input.value);
      });
    });

    // upload de imagem do card
    card.querySelector('[data-action="upload-link-image"]')?.addEventListener('click', () => {
      card.querySelector('[data-file="image"]')?.click();
    });
    card.querySelector('[data-file="image"]')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 1024 * 1024) {
        toastError('Arquivo grande demais (máx 1MB).');
        return;
      }
      await uploadLinkImage(idx, file, card);
      e.target.value = '';
    });
    card.querySelector('[data-action="clear-link-image"]')?.addEventListener('click', () => {
      cached.state.links[idx].image = null;
      markDirty();
      renderLinks();
    });

    // toggle hide
    card.querySelector('[data-action="toggle-hide"]')?.addEventListener('click', () => {
      cached.state.links[idx].hidden = !cached.state.links[idx].hidden;
      markDirty();
      renderLinks();
    });

    // move
    card.querySelector('[data-action="move-up"]')?.addEventListener('click', () => moveLink(idx, -1));
    card.querySelector('[data-action="move-down"]')?.addEventListener('click', () => moveLink(idx, +1));

    // remove
    card.querySelector('[data-action="remove"]')?.addEventListener('click', () => {
      const label = cached.state.links[idx].label || `Link ${idx + 1}`;
      if (!confirm(`Remover "${label}"?`)) return;
      cached.state.links.splice(idx, 1);
      markDirty();
      renderLinks();
    });

    // duplicate
    card.querySelector('[data-action="duplicate"]')?.addEventListener('click', () => {
      const orig = cached.state.links[idx];
      const clone = {
        ...deepClone(orig),
        id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: orig.label ? `${orig.label} (cópia)` : '',
      };
      cached.state.links.splice(idx + 1, 0, clone);
      markDirty();
      renderLinks();
    });

    // icon picker
    card.querySelectorAll('[data-action="pick-icon"]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        if (cached.state.links[idx].image) return; // imagem tem prioridade
        const id = btn.dataset.iconId || null;
        cached.state.links[idx].icon = id || null;
        markDirty();
        // update visual selection sem re-render completo
        card.querySelectorAll('[data-action="pick-icon"]').forEach((b) => b.classList.remove('is-sel'));
        btn.classList.add('is-sel');
      });
    });
  });

  bindCardDragDrop();
}

// ===== Drag-drop reorder =====
let dragSourceIdx = null;

function bindCardDragDrop() {
  const root = cached?.ctx?.root;
  if (!root) return;
  root.querySelectorAll('.bio-link-card').forEach((card) => {
    card.addEventListener('dragstart', (e) => {
      const idx = Number(card.dataset.idx);
      dragSourceIdx = idx;
      card.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      // Firefox precisa de dado pra iniciar arrasto
      try { e.dataTransfer.setData('text/plain', String(idx)); } catch {}
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('is-dragging');
      root.querySelectorAll('.bio-link-card').forEach((c) => c.classList.remove('is-drop-target', 'is-drop-above', 'is-drop-below'));
      dragSourceIdx = null;
    });
    card.addEventListener('dragover', (e) => {
      if (dragSourceIdx == null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = card.getBoundingClientRect();
      const above = (e.clientY - rect.top) < rect.height / 2;
      card.classList.toggle('is-drop-above', above);
      card.classList.toggle('is-drop-below', !above);
      card.classList.add('is-drop-target');
    });
    card.addEventListener('dragleave', () => {
      card.classList.remove('is-drop-target', 'is-drop-above', 'is-drop-below');
    });
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      if (dragSourceIdx == null) return;
      const targetIdx = Number(card.dataset.idx);
      const rect = card.getBoundingClientRect();
      const above = (e.clientY - rect.top) < rect.height / 2;
      let insertAt = above ? targetIdx : targetIdx + 1;
      const arr = cached.state.links;
      const [moved] = arr.splice(dragSourceIdx, 1);
      // ajusta índice se source estava antes do destino
      if (dragSourceIdx < insertAt) insertAt--;
      arr.splice(insertAt, 0, moved);
      dragSourceIdx = null;
      markDirty();
      renderLinks();
    });
  });
}

async function uploadLinkImage(idx, file, card) {
  const btn = card.querySelector('[data-action="upload-link-image"]');
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = '…';
  try {
    const { url, error } = await cached.ctx.api.uploadBioImage(file);
    if (error) throw error;
    cached.state.links[idx].image = url;
    markDirty();
    toastSuccess('Imagem enviada.');
    renderLinks();
  } catch (e) {
    toastError(`Erro no upload: ${e.message || e}`);
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

function refreshLinkImage(card, url) {
  const slot = card.querySelector('.bio-link-card__image');
  if (!slot) return;
  if (url) {
    slot.innerHTML = `<img src="${escapeAttr(url)}" alt="" onerror="this.parentElement.innerHTML='<span class=\\'bio-link-card__image-placeholder\\'>imagem<br/>inválida</span>'" />`;
  } else {
    slot.innerHTML = `<span class="bio-link-card__image-placeholder">sem<br/>imagem</span>`;
  }
}

function moveLink(idx, delta) {
  const newIdx = idx + delta;
  if (newIdx < 0 || newIdx >= cached.state.links.length) return;
  const arr = cached.state.links;
  [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
  markDirty();
  renderLinks();
}

function markDirty() {
  const wasDirty = isDirty;
  isDirty = JSON.stringify(cached.state) !== JSON.stringify(cached.original);
  if (wasDirty !== isDirty) {
    const btn = cached.ctx.root.querySelector('#bioSaveBtn');
    if (btn) {
      btn.disabled = !isDirty;
      btn.textContent = isDirty ? 'Salvar' : 'Tudo salvo';
    }
  }
}

function initials(name) {
  if (!name) return 'T';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0][0].toUpperCase();
}

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

// ===== Histórico de versões (reusa pages-timeline-* CSS) =====
async function openBioHistoryDrawer(ctx) {
  document.querySelectorAll('.pages-timeline-drawer').forEach((el) => el.remove());

  const overlay = document.createElement('div');
  overlay.className = 'pages-timeline-drawer';
  overlay.innerHTML = `
    <div class="pages-timeline-drawer__panel">
      <header class="pages-timeline-head">
        <div class="pages-timeline-head__main">
          <p class="pages-timeline-head__crumb">histórico da bio</p>
          <div class="pages-timeline-head__title">
            <span class="pages-timeline-head__signet">${stampSeal({ size: 18 })}</span>
            <h3>Últimas publicações</h3>
          </div>
          <p class="pages-timeline-head__desc">Clique numa versão para ver o que mudou e (se quiser) reverter pra ela.</p>
        </div>
        <button class="icon-btn" data-action="close" aria-label="Fechar histórico">${icon('x', { size: 16 })}</button>
      </header>
      <div class="pages-timeline-body" id="bioTimelineBody">
        <div class="pages-timeline-loading">
          <span class="pages-bloom"><span class="pages-signet">${stampSeal({ size: 24 })}</span></span>
          <p>Carregando histórico…</p>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('is-open'));

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    overlay.classList.remove('is-open');
    setTimeout(() => overlay.remove(), 220);
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) return close();
    if (ev.target.closest('[data-action="close"]')) return close();
  });

  const body = document.getElementById('bioTimelineBody');
  if (!ctx.api.listSnapshotsByScope) {
    body.innerHTML = `<div class="pages-timeline-empty">histórico indisponível.</div>`;
    return;
  }
  const { data: snaps, error } = await ctx.api.listSnapshotsByScope(BIO_SCOPE, { limit: 20 });
  if (error) {
    body.innerHTML = `<div class="pages-timeline-empty">erro: ${escapeHtml(error.message || String(error))}</div>`;
    return;
  }
  if (!snaps?.length) {
    body.innerHTML = `<div class="pages-timeline-empty">nenhuma publicação registrada ainda.</div>`;
    return;
  }
  body.innerHTML = snaps.map((s, idx) => snapshotRowHtml(s, idx === 0)).join('');
  body.querySelectorAll('.pages-timeline-row').forEach((row) => {
    row.addEventListener('click', () => {
      const version = Number(row.dataset.version);
      openBioSnapshotModal(ctx, snaps, version);
    });
  });
}

function snapshotRowHtml(s, isCurrent) {
  const when = s.created_at ? new Date(s.created_at) : new Date(Number(s.version));
  const dateStr = when.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  const timeStr = when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `
    <article class="pages-timeline-row ${isCurrent ? 'is-current' : ''}" data-version="${escapeAttr(s.version)}" tabindex="0">
      <header class="pages-timeline-row__head">
        <span class="pages-timeline-row__date">${escapeHtml(dateStr)}</span>
        <span class="pages-timeline-row__time">${escapeHtml(timeStr)}</span>
        ${isCurrent ? `<span class="pages-timeline-row__current-badge">atual</span>` : ''}
      </header>
      ${s.note
        ? `<p class="pages-timeline-row__note">${escapeHtml(s.note)}</p>`
        : `<p class="pages-timeline-row__note pages-timeline-row__note--empty">sem anotação</p>`}
    </article>
  `;
}

async function openBioSnapshotModal(ctx, snaps, version) {
  document.querySelectorAll('.pages-snap-modal').forEach((el) => el.remove());
  const target = snaps.find((s) => Number(s.version) === Number(version));
  if (!target) return;
  const isCurrent = snaps[0] && Number(snaps[0].version) === Number(version);

  const when = target.created_at ? new Date(target.created_at) : new Date(Number(target.version));
  const whenLabel = when.toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });

  const overlay = document.createElement('div');
  overlay.className = 'pages-snap-modal';
  overlay.innerHTML = `
    <div class="pages-snap-modal__box">
      <header class="pages-snap-modal__head">
        <div style="min-width: 0;">
          <p class="pages-snap-modal__crumb">versão · ${escapeHtml(whenLabel)}</p>
          <h3 class="pages-snap-modal__title">${isCurrent ? 'Versão atual' : 'Versão antiga'}</h3>
          ${target.note ? `<p class="pages-snap-modal__note">${escapeHtml(target.note)}</p>` : ''}
        </div>
        <button class="icon-btn" data-action="close" aria-label="Fechar">${icon('x', { size: 16 })}</button>
      </header>
      <div class="pages-snap-modal__body" id="bioSnapBody">
        <p class="pages-snap-modal__diff-title">Comparando com a versão atual</p>
        <div class="pages-snap-modal__diff" id="bioSnapDiff">
          <div class="pages-timeline-loading">
            <span class="pages-bloom"><span class="pages-signet">${stampSeal({ size: 22 })}</span></span>
            <p>Carregando diff…</p>
          </div>
        </div>
      </div>
      <footer class="pages-snap-modal__foot">
        <button class="btn btn--ghost btn--small" data-action="close">Fechar</button>
        ${!isCurrent ? `<button class="btn btn--primary" data-action="revert">${icon('refresh', { size: 14 })}<span style="margin-left:6px;">Reverter pra esta versão</span></button>` : ''}
      </footer>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('is-open'));

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    overlay.classList.remove('is-open');
    setTimeout(() => overlay.remove(), 220);
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);

  // Diff bio-specific
  const diffBox = document.getElementById('bioSnapDiff');
  if (isCurrent) {
    diffBox.innerHTML = `<div class="pages-diff-empty">esta é a versão atual — sem comparação.</div>`;
  } else {
    const [snapRes, curRes] = await Promise.all([
      ctx.api.getSnapshotData(BIO_SCOPE, version),
      ctx.api.getSnapshotData(BIO_SCOPE, snaps[0].version),
    ]);
    if (!snapRes?.data) {
      diffBox.innerHTML = `<div class="pages-diff-empty">snapshot indisponível.</div>`;
    } else {
      const oldData = snapRes.data.data || {};
      const newData = curRes.data?.data || {};
      const changes = diffBioData(oldData, newData);
      if (!changes.length) {
        diffBox.innerHTML = `<div class="pages-diff-empty">sem diferenças detectadas.</div>`;
      } else {
        diffBox.innerHTML = changes.slice(0, 40).map(bioDiffRowHtml).join('') +
          (changes.length > 40 ? `<p class="muted" style="font-size: 11px; text-align: center; font-style: italic; margin: 8px 0 0;">+ ${changes.length - 40} mudanças</p>` : '');
      }
    }
  }

  overlay.addEventListener('click', async (ev) => {
    if (ev.target === overlay) return close();
    const action = ev.target.closest('[data-action]')?.dataset?.action;
    if (action === 'close') return close();
    if (action === 'revert') {
      if (!confirm('Reverter a bio pra esta versão antiga?\n\nIsso cria uma nova publicação com os dados antigos. Nada é apagado — a versão atual fica no histórico.')) return;
      const btn = ev.target.closest('[data-action="revert"]');
      btn.disabled = true;
      btn.textContent = 'revertendo…';
      try {
        const { error } = await ctx.api.revertToSnapshot(BIO_SCOPE, version);
        if (error) throw error;
        toastSuccess('Bio revertida.');
        close();
        setTimeout(() => {
          if (cached?.ctx) renderBio(cached.ctx);
          document.querySelectorAll('.pages-timeline-drawer').forEach((el) => el.remove());
        }, 400);
      } catch (e) {
        btn.disabled = false;
        btn.innerHTML = `${icon('refresh', { size: 14 })}<span style="margin-left:6px;">Reverter pra esta versão</span>`;
        toastError(`Erro ao reverter: ${e.message || e}`);
      }
    }
  });
}

// Diff específico do shape bio (identity + links). Detecta:
// add/remove de link, mudança de campo de link, reorder, e mudanças em identity.
function diffBioData(oldData, newData) {
  const changes = [];
  const oldId = oldData?.identity || {};
  const newId = newData?.identity || {};
  for (const k of new Set([...Object.keys(oldId), ...Object.keys(newId)])) {
    if (JSON.stringify(oldId[k]) === JSON.stringify(newId[k])) continue;
    changes.push({ kind: 'identity', key: k, before: oldId[k], after: newId[k] });
  }

  const oldLinks = Array.isArray(oldData?.links) ? oldData.links : [];
  const newLinks = Array.isArray(newData?.links) ? newData.links : [];
  const oldById = new Map(oldLinks.map((l, i) => [l.id || `__idx${i}`, { ...l, _i: i }]));
  const newById = new Map(newLinks.map((l, i) => [l.id || `__idx${i}`, { ...l, _i: i }]));

  for (const [id, n] of newById) {
    const o = oldById.get(id);
    if (!o) {
      changes.push({ kind: 'link-add', label: n.label || '(sem rótulo)', id });
    } else {
      const fields = ['label', 'href', 'description', 'image', 'icon', 'hidden'];
      for (const f of fields) {
        if (JSON.stringify(o[f]) !== JSON.stringify(n[f])) {
          changes.push({ kind: 'link-edit', field: f, label: n.label || o.label || '(sem rótulo)', before: o[f], after: n[f] });
        }
      }
    }
  }
  for (const [id, o] of oldById) {
    if (!newById.has(id)) {
      changes.push({ kind: 'link-remove', label: o.label || '(sem rótulo)', id });
    }
  }

  const oOrder = oldLinks.map((l) => l.id || '').join('|');
  const nOrder = newLinks.map((l) => l.id || '').join('|');
  if (oOrder !== nOrder && oldLinks.length === newLinks.length) {
    changes.push({ kind: 'reorder' });
  }
  return changes;
}

function bioDiffRowHtml(c) {
  const truncate = (v) => {
    if (v == null) return '∅';
    const s = typeof v === 'boolean' ? (v ? 'sim' : 'não') : String(v);
    return s.length > 60 ? s.slice(0, 60) + '…' : s;
  };
  if (c.kind === 'identity') {
    return `
      <div class="pages-diff-row">
        <span class="pages-diff-row__bucket">identidade · ${escapeHtml(c.key)}</span>
        <div class="pages-diff-row__values">
          <span class="pages-diff-row__before">${escapeHtml(truncate(c.before))}</span>
          <span class="pages-diff-row__arrow">→</span>
          <span class="pages-diff-row__after">${escapeHtml(truncate(c.after))}</span>
        </div>
      </div>
    `;
  }
  if (c.kind === 'link-add') {
    return `<div class="pages-diff-row"><span class="pages-diff-row__bucket pages-diff-row__bucket--add">+ link</span><div class="pages-diff-row__values"><span class="pages-diff-row__after">${escapeHtml(c.label)}</span></div></div>`;
  }
  if (c.kind === 'link-remove') {
    return `<div class="pages-diff-row"><span class="pages-diff-row__bucket pages-diff-row__bucket--remove">− link</span><div class="pages-diff-row__values"><span class="pages-diff-row__before">${escapeHtml(c.label)}</span></div></div>`;
  }
  if (c.kind === 'link-edit') {
    return `
      <div class="pages-diff-row">
        <span class="pages-diff-row__bucket">${escapeHtml(c.label)} · ${escapeHtml(c.field)}</span>
        <div class="pages-diff-row__values">
          <span class="pages-diff-row__before">${escapeHtml(truncate(c.before))}</span>
          <span class="pages-diff-row__arrow">→</span>
          <span class="pages-diff-row__after">${escapeHtml(truncate(c.after))}</span>
        </div>
      </div>
    `;
  }
  if (c.kind === 'reorder') {
    return `<div class="pages-diff-row"><span class="pages-diff-row__bucket">ordem</span><div class="pages-diff-row__values"><span class="pages-diff-row__after">cards reordenados</span></div></div>`;
  }
  return '';
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
