// Drawer pra editar textos de help (admin's "como funciona este módulo").
// Reusa a estética split-view + toolbar markdown do block-drawer.

import { icon } from '../icons.js';
import { stampSeal } from '../pages/signet.js';
import { renderHelpMarkdown } from './help-banner.js';

export function openHelpDrawer(ctx, slot, opts = {}) {
  document.querySelectorAll('.block-drawer-overlay').forEach((el) => el.remove());

  const meta = ctx.api.helpSlotByKey(slot);
  const onSaved = opts.onSaved;

  const overlay = document.createElement('div');
  overlay.className = 'block-drawer-overlay';
  overlay.innerHTML = `
    <div class="block-drawer block-drawer--wide">
      <header class="pages-drawer-head">
        <div class="pages-drawer-head__main">
          <p class="pages-drawer-head__crumb">texto do admin · ${escapeHtml(meta?.label || slot)}</p>
          <div class="pages-drawer-head__title">
            <span class="pages-drawer-head__signet">${stampSeal({ size: 18 })}</span>
            <h2 id="helpDrawerTitle">Carregando…</h2>
          </div>
          <p class="pages-drawer-head__desc">
            Este texto aparece no banner colapsável do topo de
            <a href="${escapeAttr(meta?.adminHash || '#')}" style="color: var(--gold-soft);">${escapeHtml(meta?.label || slot)}</a>.
            O administrador edita aqui, o time vê lá no painel.
          </p>
        </div>
        <button class="pages-drawer-head__close icon-btn" data-action="close" aria-label="Fechar">${icon('x', { size: 16 })}</button>
      </header>

      <div class="block-drawer__body" id="helpDrawerBody">
        <div class="pages-loading-wrap">
          <span class="pages-bloom"><span class="pages-signet">${stampSeal({ size: 24 })}</span></span>
          <p>Abrindo o texto…</p>
        </div>
      </div>

      <footer class="pages-drawer-foot">
        <span class="pages-drawer-foot__hint">
          ${stampSeal({ size: 14 })}
          <span>Markdown leve: <code>**negrito**</code>, <code>*itálico*</code>, <code>## seção</code>, <code>- item</code></span>
        </span>
        <button class="btn btn--ghost btn--small" data-action="reset" id="helpResetBtn" title="Voltar ao texto padrão">${icon('refresh', { size: 12 })}<span style="margin-left:6px;">restaurar padrão</span></button>
        <button class="btn btn--primary" data-action="save" id="helpSaveBtn" disabled>Salvar</button>
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
  function onKey(e) {
    if (e.key === 'Escape') close();
    if ((e.key === 's' || e.key === 'S') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      doSave();
    }
  }
  document.addEventListener('keydown', onKey);

  let currentTitle = '';
  let currentBody = '';
  let originalTitle = '';
  let originalBody = '';
  let lastSavedTitle = '';
  let lastSavedBody = '';
  const defaultContent = ctx.api.helpDefault(slot);

  function isDirty() {
    return currentTitle !== lastSavedTitle || currentBody !== lastSavedBody;
  }
  function syncDirty() {
    const dirty = isDirty();
    const btn = overlay.querySelector('#helpSaveBtn');
    if (btn) btn.disabled = !dirty;
  }
  function buildBody() {
    const body = overlay.querySelector('#helpDrawerBody');
    body.innerHTML = `
      <div class="pages-field">
        <div class="pages-field__head">
          <span class="pages-field__label">Título do banner</span>
          <span class="pages-field__type-badge pages-field__type-badge--text">${icon('page', { size: 11 })}<span>text</span></span>
        </div>
        <div class="pages-field__split pages-field--no-toolbar" style="grid-template-columns: 1fr;">
          <input type="text" class="pages-field__input" id="helpTitleInput" maxlength="80" value="${escapeAttr(currentTitle)}" placeholder="${escapeAttr(defaultContent.title)}" />
        </div>
      </div>

      <div class="pages-field">
        <div class="pages-field__head">
          <span class="pages-field__label">Texto (markdown)</span>
          <span class="pages-field__type-badge pages-field__type-badge--rich">${icon('pullquote', { size: 11 })}<span>rich</span></span>
        </div>
        <div class="pages-field__toolbar" role="toolbar" aria-label="Formatação">
          <button type="button" class="pages-field__toolbar-btn" data-md="bold" title="Negrito (Ctrl+B)"><strong>B</strong></button>
          <button type="button" class="pages-field__toolbar-btn" data-md="italic" title="Itálico (Ctrl+I)"><em>I</em></button>
          <span class="pages-field__toolbar-sep"></span>
          <button type="button" class="pages-field__toolbar-btn" data-md="h2" title="Seção (## titulo)"><strong>H</strong></button>
          <button type="button" class="pages-field__toolbar-btn" data-md="li" title="Item de lista (- item)">•</button>
          <span class="pages-field__toolbar-spacer"></span>
          <span class="pages-field__toolbar-hint">## seção · - item · **bold** · *itálico*</span>
        </div>
        <div class="pages-field__split">
          <textarea class="pages-field__textarea" id="helpBodyInput" rows="14" spellcheck="true"></textarea>
          <div class="pages-field__preview help-banner__content" id="helpBodyPreview"></div>
        </div>
      </div>
    `;

    const titleInput = body.querySelector('#helpTitleInput');
    const bodyInput = body.querySelector('#helpBodyInput');
    const preview = body.querySelector('#helpBodyPreview');

    titleInput.value = currentTitle;
    bodyInput.value = currentBody;
    renderPreview(bodyInput.value);

    titleInput.addEventListener('input', () => {
      currentTitle = titleInput.value;
      syncDirty();
    });
    bodyInput.addEventListener('input', () => {
      currentBody = bodyInput.value;
      renderPreview(currentBody);
      syncDirty();
    });
    bodyInput.addEventListener('keydown', (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === 'b' || e.key === 'B') { e.preventDefault(); wrapSelection(bodyInput, '**', '**'); bodyInput.dispatchEvent(new Event('input')); }
      else if (e.key === 'i' || e.key === 'I') { e.preventDefault(); wrapSelection(bodyInput, '*', '*'); bodyInput.dispatchEvent(new Event('input')); }
    });
    body.querySelectorAll('[data-md]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const action = btn.dataset.md;
        if (action === 'bold') wrapSelection(bodyInput, '**', '**');
        else if (action === 'italic') wrapSelection(bodyInput, '*', '*');
        else if (action === 'h2') prefixLine(bodyInput, '## ');
        else if (action === 'li') prefixLine(bodyInput, '- ');
        bodyInput.dispatchEvent(new Event('input'));
        bodyInput.focus();
      });
    });

    function renderPreview(value) {
      const html = renderHelpMarkdown(value);
      if (!value || !value.trim()) {
        preview.classList.add('pages-field__preview--empty');
        preview.textContent = 'sem texto';
      } else {
        preview.classList.remove('pages-field__preview--empty');
        preview.innerHTML = html;
      }
    }
  }

  async function loadInitial() {
    try {
      const content = await ctx.api.getHelpContent(slot);
      originalTitle = defaultContent.title;
      originalBody = defaultContent.body;
      currentTitle = content.title || originalTitle;
      currentBody = content.body || '';
      lastSavedTitle = currentTitle;
      lastSavedBody = currentBody;
      overlay.querySelector('#helpDrawerTitle').textContent = currentTitle || defaultContent.title;
      buildBody();
      syncDirty();
    } catch (e) {
      overlay.querySelector('#helpDrawerBody').innerHTML =
        `<p class="muted" style="color: var(--danger-soft); padding: 12px 0;">erro carregando: ${escapeHtml(e.message || String(e))}</p>`;
    }
  }

  async function doSave() {
    if (!isDirty()) return;
    const saveBtn = overlay.querySelector('#helpSaveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'salvando…';
    try {
      const { error } = await ctx.api.setHelpContent(slot, { title: currentTitle, body: currentBody });
      if (error) throw error;
      lastSavedTitle = currentTitle;
      lastSavedBody = currentBody;
      overlay.querySelector('#helpDrawerTitle').textContent = currentTitle;
      saveBtn.textContent = 'salvo ✓';
      setTimeout(() => { saveBtn.textContent = 'Salvar'; saveBtn.disabled = !isDirty(); }, 1400);
      onSaved?.();
    } catch (e) {
      alert(`Erro ao salvar: ${e.message || e}`);
      saveBtn.textContent = 'Salvar';
      saveBtn.disabled = false;
    }
  }

  async function doReset() {
    if (!confirm('Voltar este texto pro padrão original?')) return;
    currentTitle = defaultContent.title;
    currentBody = defaultContent.body;
    buildBody();
    syncDirty();
    overlay.querySelector('#helpDrawerTitle').textContent = currentTitle;
  }

  overlay.addEventListener('click', async (ev) => {
    if (ev.target === overlay) return close();
    const action = ev.target.closest('[data-action]')?.dataset?.action;
    if (action === 'close') return close();
    if (action === 'save') return doSave();
    if (action === 'reset') return doReset();
  });

  loadInitial();
}

function wrapSelection(input, prefix, suffix) {
  const start = input.selectionStart ?? 0;
  const end = input.selectionEnd ?? 0;
  const value = input.value;
  const before = value.slice(0, start);
  const middle = value.slice(start, end);
  const after = value.slice(end);

  if (middle.startsWith(prefix) && middle.endsWith(suffix) && middle.length > prefix.length + suffix.length) {
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

function prefixLine(input, prefix) {
  const start = input.selectionStart ?? 0;
  const value = input.value;
  // encontra início da linha
  let lineStart = value.lastIndexOf('\n', start - 1) + 1;
  // se a linha já começa com o prefix, remove; senão adiciona
  if (value.slice(lineStart, lineStart + prefix.length) === prefix) {
    input.value = value.slice(0, lineStart) + value.slice(lineStart + prefix.length);
    const pos = Math.max(lineStart, start - prefix.length);
    input.setSelectionRange(pos, pos);
  } else {
    input.value = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    const pos = start + prefix.length;
    input.setSelectionRange(pos, pos);
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
