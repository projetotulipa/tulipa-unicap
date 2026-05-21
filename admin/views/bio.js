// Bio editor — /admin/#/bio
// Edita identidade (avatar/nome/tagline/bio) + cards (label/href/imagem/desc/hidden/order).
// Upload de imagens via Supabase Storage (bucket bio-assets).

import { icon } from '../icons.js';
import { stampSeal } from '../pages/signet.js';
import { toastSuccess, toastError } from '../toast.js';

const PUBLIC_BIO_URL = '../bio/';

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
    </div>
  `;

  renderLinks();
  bindIdentity();
  bindHeroActions();
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
  return `
    <article class="bio-link-card ${link.hidden ? 'is-hidden' : ''}" data-idx="${idx}">
      <div class="bio-link-card__image">
        ${link.image
          ? `<img src="${escapeAttr(link.image)}" alt="" />`
          : `<span class="bio-link-card__image-placeholder">sem<br/>imagem</span>`}
      </div>
      <div class="bio-link-card__main">
        <div class="bio-link-card__row">
          <div class="bio-editor-field" style="flex: 1; min-width: 0;">
            <label class="bio-editor-label">Texto do botão</label>
            <input type="text" class="bio-editor-input bio-link-card__label-input" maxlength="60"
                   data-bind="label" value="${escapeAttr(link.label)}" placeholder="Saiba mais" />
          </div>
        </div>
        <div class="bio-link-card__row">
          <div class="bio-editor-field" style="flex: 1; min-width: 0;">
            <label class="bio-editor-label">Link (href)</label>
            <input type="url" class="bio-editor-input"
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
        <button class="bio-link-card__action-btn bio-link-card__action-btn--danger" data-action="remove" title="Remover">
          ${icon('trash', { size: 14 })}
          <span>remover</span>
        </button>
      </div>
    </article>
  `;
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
        }
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

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
