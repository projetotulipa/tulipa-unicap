// Drawer lateral pra editar os campos de um bloco.

import { htmlToMd, mdToHtml } from '../markdown.js';
import { getOriginalFor } from './home-editor.js';
import { icon } from '../icons.js';

const SCOPE = 'global';

export function openBlockDrawer(ctx, block, { onChange, notifyPreview } = {}) {
  // remove drawer existente
  document.querySelectorAll('.block-drawer-overlay').forEach((el) => el.remove());

  const overlay = document.createElement('div');
  overlay.className = 'block-drawer-overlay';
  overlay.innerHTML = `
    <div class="block-drawer">
      <header class="block-drawer__head">
        <div>
          <p class="block-drawer__crumb">Editando bloco</p>
          <h2><span class="block-drawer__icon">${icon(block.iconName, { size: 26 })}</span> ${escapeHtml(block.label)}</h2>
          <p class="block-drawer__desc">${escapeHtml(block.description)}</p>
        </div>
        <button class="block-drawer__close icon-btn" data-action="close" aria-label="Fechar" title="Fechar (Esc)">${icon('x', { size: 16 })}</button>
      </header>

      <div class="block-drawer__body" id="drawerBody"></div>

      <footer class="block-drawer__foot">
        <span class="block-drawer__hint">As alterações já aparecem no preview. Clique “Publicar” para salvar de verdade no site.</span>
        <button class="btn btn--primary" data-action="close-and-save">Concluir</button>
      </footer>
    </div>
  `;
  document.body.appendChild(overlay);

  // entrada animada
  requestAnimationFrame(() => overlay.classList.add('is-open'));

  const body = overlay.querySelector('#drawerBody');
  for (const field of block.fields) {
    body.appendChild(buildField(ctx, field, { onChange, notifyPreview }));
  }

  // fechar
  function close() {
    overlay.classList.remove('is-open');
    setTimeout(() => overlay.remove(), 220);
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);

  overlay.addEventListener('click', (ev) => {
    const action = ev.target.closest('[data-action]')?.dataset?.action;
    if (action === 'close' || action === 'close-and-save') {
      close();
      onChange?.();
      return;
    }
    // clica fora do drawer (no backdrop) também fecha
    if (ev.target === overlay) {
      close();
      onChange?.();
    }
  });
}

function buildField(ctx, field, { onChange, notifyPreview }) {
  const { api } = ctx;
  const data = api.getScope(SCOPE);
  const isLinkLabel = field.type === 'link-label';
  const bucket = isLinkLabel ? 'labels' : 'text';

  const original = getOriginalFor(field.id) || '';
  const currentRaw = data[bucket]?.[field.id];
  const currentDisplay = currentRaw !== undefined ? currentRaw : original;

  // convert pra markdown se for rich, ou exibe puro se for text/link-label
  const initialValue = field.type === 'rich'
    ? htmlToMd(currentDisplay)
    : isLinkLabel
      ? extractPlainText(currentDisplay)
      : htmlToMd(currentDisplay);

  const originalDisplay = field.type === 'rich'
    ? htmlToMd(original)
    : isLinkLabel
      ? extractPlainText(original)
      : htmlToMd(original);

  const isEdited = currentRaw !== undefined && currentRaw !== original;

  const wrap = document.createElement('label');
  wrap.className = 'drawer-field';
  wrap.dataset.fieldId = field.id;

  const isMultiline = field.type === 'rich' || (initialValue && initialValue.includes('\n'));
  const tag = isMultiline ? 'textarea' : 'input';
  const attrs = isMultiline ? `rows="3"` : `type="text"`;

  wrap.innerHTML = `
    <div class="drawer-field__head">
      <span class="drawer-field__label">${escapeHtml(field.label)}</span>
      ${isEdited ? '<span class="drawer-field__badge">editado</span>' : ''}
    </div>
    <${tag} class="drawer-field__input" ${attrs}>${escapeAttr(initialValue)}</${tag}>
    ${field.type === 'rich' ? `
      <p class="drawer-field__hint">
        Use <code>**negrito**</code> e <code>*itálico*</code>. Pressione Enter para quebrar linha.
      </p>
    ` : ''}
    <div class="drawer-field__foot">
      <button type="button" class="drawer-field__revert" data-action="revert" ${!isEdited ? 'disabled' : ''}>
        <span class="drawer-field__revert-ic">${icon('refresh', { size: 12 })}</span> Voltar ao original
      </button>
      <details class="drawer-field__original">
        <summary>ver texto original</summary>
        <pre>${escapeHtml(originalDisplay)}</pre>
      </details>
    </div>
  `;

  const input = wrap.querySelector('.drawer-field__input');
  const revertBtn = wrap.querySelector('[data-action="revert"]');
  const badge = wrap.querySelector('.drawer-field__badge');

  // input ao vivo: aplica e re-renderiza preview
  input.addEventListener('input', () => {
    const userValue = input.value;
    const newHtml = field.type === 'rich' ? mdToHtml(userValue)
                  : isLinkLabel ? userValue.trim()
                  : mdToHtml(userValue);

    // compara com original em "espaço normalizado"
    const normalize = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
    const sameAsOriginal = normalize(newHtml) === normalize(original);

    if (sameAsOriginal) {
      api.patchEdit(SCOPE, bucket, field.id, null);
    } else {
      api.patchEdit(SCOPE, bucket, field.id, newHtml);
    }
    api.markDirty(SCOPE);
    notifyPreview?.();

    // atualiza UI do badge/revert
    if (sameAsOriginal) {
      badge?.remove();
      revertBtn.disabled = true;
    } else {
      if (!wrap.querySelector('.drawer-field__badge')) {
        const newBadge = document.createElement('span');
        newBadge.className = 'drawer-field__badge';
        newBadge.textContent = 'editado';
        wrap.querySelector('.drawer-field__head').appendChild(newBadge);
      }
      revertBtn.disabled = false;
    }
  });

  revertBtn?.addEventListener('click', () => {
    input.value = originalDisplay;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  return wrap;
}

function extractPlainText(html) {
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

function escapeAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
