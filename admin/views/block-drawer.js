// Drawer lateral pra editar campos de um bloco — Sprint 3 ("Folha Viva" com preview live).
// Split-view (textarea + preview) pra fields rich; toolbar markdown visual com atalhos;
// badge de tipo de campo; diff "editado" / "voltar ao original".

import { htmlToMd, mdToHtml } from '../markdown.js';
import { getOriginalFor } from './page-editor.js';
import { icon } from '../icons.js';
import { stampSeal } from '../pages/signet.js';

export function openBlockDrawer(ctx, block, { onChange, notifyPreview, onClose, scope = 'global' } = {}) {
  document.querySelectorAll('.block-drawer-overlay').forEach((el) => el.remove());

  const overlay = document.createElement('div');
  overlay.className = 'block-drawer-overlay';
  overlay.innerHTML = `
    <div class="block-drawer block-drawer--wide">
      <header class="pages-drawer-head">
        <div class="pages-drawer-head__main">
          <p class="pages-drawer-head__crumb">editando bloco</p>
          <div class="pages-drawer-head__title">
            <span class="pages-drawer-head__signet">${icon(block.iconName || 'page', { size: 22 })}</span>
            <h2>${escapeHtml(block.label)}</h2>
          </div>
          ${block.description ? `<p class="pages-drawer-head__desc">${escapeHtml(block.description)}</p>` : ''}
        </div>
        <button class="pages-drawer-head__close icon-btn" data-action="close" aria-label="Fechar" title="Fechar (Esc)">${icon('x', { size: 16 })}</button>
      </header>

      <div class="block-drawer__body" id="drawerBody"></div>

      <footer class="pages-drawer-foot">
        <span class="pages-drawer-foot__hint">
          ${stampSeal({ size: 14 })}
          <span>As alterações já aparecem no preview. Clique "Publicar" pra selar no site.</span>
        </span>
        <button class="btn btn--primary" data-action="close-and-save">Concluir</button>
      </footer>
    </div>
  `;
  document.body.appendChild(overlay);

  requestAnimationFrame(() => overlay.classList.add('is-open'));

  const body = overlay.querySelector('#drawerBody');
  for (const field of block.fields) {
    body.appendChild(buildField(ctx, field, { onChange, notifyPreview, scope }));
  }

  // foco no primeiro input
  const firstInput = body.querySelector('textarea, input[type="text"]');
  if (firstInput) {
    setTimeout(() => firstInput.focus(), 250);
  }

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    overlay.classList.remove('is-open');
    setTimeout(() => overlay.remove(), 220);
    document.removeEventListener('keydown', onKey);
    onClose?.();
  }
  function onKey(e) {
    if (e.key === 'Escape') {
      close();
      onChange?.();
    }
  }
  document.addEventListener('keydown', onKey);

  overlay.addEventListener('click', (ev) => {
    const action = ev.target.closest('[data-action]')?.dataset?.action;
    if (action === 'close' || action === 'close-and-save') {
      close();
      onChange?.();
      return;
    }
    if (ev.target === overlay) {
      close();
      onChange?.();
    }
  });
}

function fieldTypeBadge(type) {
  if (type === 'rich') {
    return `<span class="pages-field__type-badge pages-field__type-badge--rich" title="Texto rico — aceita **negrito** e *itálico*">
      ${icon('pullquote', { size: 11 })}<span>rich</span>
    </span>`;
  }
  if (type === 'link-label') {
    return `<span class="pages-field__type-badge pages-field__type-badge--link-label" title="Rótulo de link — apenas texto puro">
      ${icon('external', { size: 11 })}<span>link</span>
    </span>`;
  }
  return `<span class="pages-field__type-badge pages-field__type-badge--text" title="Texto simples">
    ${icon('page', { size: 11 })}<span>text</span>
  </span>`;
}

function buildField(ctx, field, { onChange, notifyPreview, scope }) {
  const { api } = ctx;
  const data = api.getScope(scope);
  const isLinkLabel = field.type === 'link-label';
  const isRich = field.type === 'rich';
  const bucket = isLinkLabel ? 'labels' : 'text';

  const original = getOriginalFor(field.id) || '';
  const currentRaw = data[bucket]?.[field.id];
  const currentDisplay = currentRaw !== undefined ? currentRaw : original;

  const initialValue = isRich
    ? htmlToMd(currentDisplay)
    : isLinkLabel
      ? extractPlainText(currentDisplay)
      : htmlToMd(currentDisplay);

  const originalDisplay = isRich
    ? htmlToMd(original)
    : isLinkLabel
      ? extractPlainText(original)
      : htmlToMd(original);

  const isEdited = currentRaw !== undefined && currentRaw !== original;
  const isMultiline = isRich || (initialValue && initialValue.includes('\n'));

  const wrap = document.createElement('div');
  wrap.className = `pages-field ${!isRich && !isMultiline ? 'pages-field--no-toolbar' : ''}`;
  wrap.dataset.fieldId = field.id;

  // estrutura
  wrap.innerHTML = `
    <div class="pages-field__head">
      <span class="pages-field__label">${escapeHtml(field.label)}</span>
      ${fieldTypeBadge(field.type || 'text')}
      ${isEdited ? `<span class="pages-field__edited">${icon('spark', { size: 10 })}<span>editado</span></span>` : ''}
    </div>

    ${(isRich || isMultiline) ? `
      <div class="pages-field__toolbar" role="toolbar" aria-label="Formatação">
        <button type="button" class="pages-field__toolbar-btn" data-md="bold" title="Negrito (Ctrl+B)" aria-label="Negrito">
          <strong>B</strong>
        </button>
        <button type="button" class="pages-field__toolbar-btn" data-md="italic" title="Itálico (Ctrl+I)" aria-label="Itálico">
          <em>I</em>
        </button>
        <span class="pages-field__toolbar-sep"></span>
        ${!isLinkLabel ? `
          <button type="button" class="pages-field__toolbar-btn" data-md="break" title="Quebra de linha (Shift+Enter)" aria-label="Quebra de linha">
            ${icon('arrow-down', { size: 12 })}
          </button>
        ` : ''}
        <span class="pages-field__toolbar-spacer"></span>
        <span class="pages-field__toolbar-hint">Ctrl+B · Ctrl+I</span>
      </div>
    ` : ''}

    <div class="pages-field__split">
      ${isMultiline
        ? `<textarea class="pages-field__textarea" rows="4" spellcheck="true"></textarea>`
        : `<input type="text" class="pages-field__input" spellcheck="true" />`}
      <div class="pages-field__preview" id="preview-${cssId(field.id)}"></div>
    </div>

    <div class="pages-field__foot">
      <button type="button" class="pages-field__revert" data-action="revert" ${!isEdited ? 'disabled' : ''}>
        ${icon('refresh', { size: 11 })}
        <span>Voltar ao original</span>
      </button>
      <details class="pages-field__original">
        <summary>ver original</summary>
        <pre>${escapeHtml(originalDisplay)}</pre>
      </details>
    </div>
  `;

  const input = wrap.querySelector('.pages-field__textarea, .pages-field__input');
  const preview = wrap.querySelector('.pages-field__preview');
  const revertBtn = wrap.querySelector('[data-action="revert"]');

  // value inicial sem escapar (textarea/input cuidam disso)
  input.value = initialValue;

  function refreshEditedBadge(edited) {
    const headEl = wrap.querySelector('.pages-field__head');
    let badge = wrap.querySelector('.pages-field__edited');
    if (edited && !badge) {
      badge = document.createElement('span');
      badge.className = 'pages-field__edited';
      badge.innerHTML = `${icon('spark', { size: 10 })}<span>editado</span>`;
      headEl.appendChild(badge);
    } else if (!edited && badge) {
      badge.remove();
    }
    revertBtn.disabled = !edited;
  }

  function renderPreview(value) {
    const html = isRich ? mdToHtml(value)
              : isLinkLabel ? escapeHtml(value.trim())
              : mdToHtml(value);
    if (!value || !value.trim()) {
      preview.classList.add('pages-field__preview--empty');
      preview.textContent = isLinkLabel ? 'rótulo vazio' : 'sem texto';
    } else {
      preview.classList.remove('pages-field__preview--empty');
      preview.innerHTML = html;
    }
  }

  function persistAndPreview() {
    const userValue = input.value;
    const newHtml = isRich ? mdToHtml(userValue)
                  : isLinkLabel ? userValue.trim()
                  : mdToHtml(userValue);

    const normalize = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
    const sameAsOriginal = normalize(newHtml) === normalize(original);

    if (sameAsOriginal) {
      api.patchEdit(scope, bucket, field.id, null);
    } else {
      api.patchEdit(scope, bucket, field.id, newHtml);
    }
    api.markDirty(scope);
    notifyPreview?.();
    refreshEditedBadge(!sameAsOriginal);
    renderPreview(userValue);
  }

  // preview inicial
  renderPreview(initialValue);

  // listeners
  input.addEventListener('input', persistAndPreview);

  // atalhos de teclado (Ctrl+B / Ctrl+I)
  input.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key === 'b' || e.key === 'B') { e.preventDefault(); wrapSelection(input, '**', '**'); persistAndPreview(); }
    else if (e.key === 'i' || e.key === 'I') { e.preventDefault(); wrapSelection(input, '*', '*'); persistAndPreview(); }
  });

  // toolbar buttons
  wrap.querySelectorAll('[data-md]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const action = btn.dataset.md;
      if (action === 'bold') wrapSelection(input, '**', '**');
      else if (action === 'italic') wrapSelection(input, '*', '*');
      else if (action === 'break') insertAtCursor(input, '\n');
      persistAndPreview();
      input.focus();
    });
  });

  revertBtn?.addEventListener('click', () => {
    input.value = originalDisplay;
    persistAndPreview();
    input.focus();
  });

  return wrap;
}

// envolve a seleção corrente do textarea/input com prefix/suffix.
// se nada selecionado, insere "prefix|cursor|suffix" e posiciona cursor entre.
function wrapSelection(input, prefix, suffix) {
  const start = input.selectionStart ?? 0;
  const end = input.selectionEnd ?? 0;
  const value = input.value;
  const before = value.slice(0, start);
  const middle = value.slice(start, end);
  const after = value.slice(end);

  // se já está envolto com o mesmo marker, remove (toggle)
  if (
    middle === '' &&
    before.endsWith(prefix) &&
    after.startsWith(suffix)
  ) {
    // toggle off — remove marcadores adjacentes
    input.value = before.slice(0, -prefix.length) + after.slice(suffix.length);
    const pos = start - prefix.length;
    input.setSelectionRange(pos, pos);
    return;
  }
  if (middle.startsWith(prefix) && middle.endsWith(suffix) && middle.length > prefix.length + suffix.length) {
    // remove marcadores ao redor do trecho selecionado
    const stripped = middle.slice(prefix.length, middle.length - suffix.length);
    input.value = before + stripped + after;
    input.setSelectionRange(start, start + stripped.length);
    return;
  }

  input.value = before + prefix + middle + suffix + after;
  if (middle === '') {
    const pos = start + prefix.length;
    input.setSelectionRange(pos, pos);
  } else {
    input.setSelectionRange(start + prefix.length, end + prefix.length);
  }
}

function insertAtCursor(input, text) {
  const start = input.selectionStart ?? 0;
  const end = input.selectionEnd ?? 0;
  const value = input.value;
  input.value = value.slice(0, start) + text + value.slice(end);
  const pos = start + text.length;
  input.setSelectionRange(pos, pos);
}

function extractPlainText(html) {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = String(html);
  return tmp.textContent.replace(/\s+/g, ' ').trim();
}

function cssId(s) {
  return String(s).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
