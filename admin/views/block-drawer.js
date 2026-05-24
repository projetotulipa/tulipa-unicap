// Drawer lateral pra editar campos de um bloco — Sprint 3 ("Folha Viva" com preview live).
// Sprint 6: adicionado suporte a "containers" — listas de items editáveis
// (cards, pills, links) com hide/edit/reorder/add/remove individualmente.
//
// Split-view (textarea + preview) pra fields rich; toolbar markdown visual com atalhos;
// badge de tipo de campo; diff "editado" / "voltar ao original".

import { htmlToMd, mdToHtml } from '../markdown.js';
import { getOriginalFor } from './page-editor.js';
import { icon } from '../icons.js';
import { stampSeal } from '../pages/signet.js';

// state local: items expandidos no drawer atual (recriado por openBlockDrawer)
let expandedItemIds = new Set();

export function openBlockDrawer(ctx, block, { onChange, notifyPreview, onClose, scope = 'global', iframeDoc = null } = {}) {
  document.querySelectorAll('.block-drawer-overlay').forEach((el) => el.remove());
  expandedItemIds = new Set();

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

  // 1. Campos top-level do bloco
  if (block.fields?.length) {
    const fieldsWrap = document.createElement('div');
    fieldsWrap.className = 'pages-drawer-fields';
    for (const field of block.fields) {
      fieldsWrap.appendChild(buildField(ctx, field, { onChange, notifyPreview, scope }));
    }
    body.appendChild(fieldsWrap);
  }

  // 2. Containers (cards, pills, links editáveis individualmente)
  if (block.containers?.length) {
    for (const container of block.containers) {
      const section = document.createElement('section');
      section.className = 'pages-container-section';
      section.dataset.containerKey = container.key;
      body.appendChild(section);
      renderContainerSection(ctx, container, section, { scope, iframeDoc, onChange, notifyPreview });
    }
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
      // se um sub-modal está aberto, não feche o drawer principal
      if (document.querySelector('.container-prompt')) return;
      close();
      onChange?.();
    }
  }
  document.addEventListener('keydown', onKey);

  overlay.addEventListener('click', (ev) => {
    if (ev.target.closest('.container-prompt')) return;
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

// ---------- containers (lista editável de items) ----------

function renderContainerSection(ctx, container, sectionEl, { scope, iframeDoc, onChange, notifyPreview }) {
  const items = collectContainerItems(ctx, container, { scope, iframeDoc });
  const itemNoun = container.itemNoun || 'item';
  const itemNounPlural = container.itemNounPlural || `${itemNoun}s`;
  const visibleCount = items.filter((it) => !it.hidden).length;

  sectionEl.innerHTML = `
    <header class="pages-container-section__head">
      <div class="pages-container-section__title">
        <span class="pages-container-section__icon">${icon('drag', { size: 14 })}</span>
        <h3>${escapeHtml(container.label || capitalize(itemNounPlural))}</h3>
        <span class="pages-container-section__count">${visibleCount}/${items.length}</span>
      </div>
      <button class="btn btn--primary btn--small" data-action="add-item">
        ${icon('plus', { size: 12 })}<span style="margin-left:6px;">Adicionar ${itemNoun}</span>
      </button>
    </header>
    <p class="pages-container-section__hint">
      Cada ${itemNoun} pode ser editado, ocultado ou reordenado individualmente.
      ${container.supportsHref ? `Ao adicionar um novo, o link pode apontar pra outra página.` : ''}
    </p>
    <div class="pages-container-items" data-items-list></div>
  `;

  const itemsList = sectionEl.querySelector('[data-items-list]');
  for (const item of items) {
    itemsList.appendChild(buildItemRow(ctx, container, item, items, { scope, iframeDoc, onChange, notifyPreview }));
  }

  sectionEl.querySelector('[data-action="add-item"]').addEventListener('click', () => {
    promptAddItem(ctx, container, { scope, iframeDoc, onChange, notifyPreview })
      .then((created) => {
        if (created) {
          expandedItemIds.add(created.id);
          refreshContainerSection(ctx, container, { scope, iframeDoc, onChange, notifyPreview });
          notifyPreview?.();
          onChange?.();
        }
      });
  });
}

function refreshContainerSection(ctx, container, opts) {
  const sectionEl = document.querySelector(`[data-container-key="${cssAttr(container.key)}"]`);
  if (!sectionEl) return;
  renderContainerSection(ctx, container, sectionEl, opts);
}

// Coleta items DESTE container — combina originais (do iframe) com customs (do data).
// Aplica ordem efetiva (containerOrder[key] OR ordem natural).
function collectContainerItems(ctx, container, { scope, iframeDoc }) {
  const data = ctx.api.getScope(scope);
  const containerEl = iframeDoc?.querySelector(`[data-edit-container="${cssAttr(container.key)}"]`);

  const originals = [];
  if (containerEl) {
    for (const child of containerEl.children) {
      if (!child.dataset?.editId) continue;
      if (child.dataset.editCustom === '1') continue; // pula clones (renderizados pelo render.js)
      originals.push({
        id: child.dataset.editId,
        isCustom: false,
        hidden: !!data.hidden?.[child.dataset.editId],
        templateEl: child,
        href: getEffectiveHref(ctx, scope, child),
      });
    }
  }

  const customs = (ctx.api.getContainerItems(scope, container.key) || []).map((it) => ({
    id: it.id,
    isCustom: true,
    basedOn: it.basedOn,
    hidden: !!data.hidden?.[it.id],
    href: it.href,
    templateEl: null,
  }));

  const all = [...originals, ...customs];
  const allById = new Map(all.map((it) => [it.id, it]));

  const order = ctx.api.getContainerOrder(scope, container.key);
  if (order && order.length) {
    const ordered = [];
    for (const id of order) {
      if (allById.has(id)) {
        ordered.push(allById.get(id));
        allById.delete(id);
      }
    }
    for (const it of allById.values()) ordered.push(it);
    return ordered;
  }
  return all;
}

function getEffectiveHref(ctx, scope, el) {
  const data = ctx.api.getScope(scope);
  const override = data.attrs?.[el.dataset.editId]?.href;
  if (override != null) return override;
  return el.getAttribute('href') || '';
}

function buildItemRow(ctx, container, item, allItems, opts) {
  const { scope, iframeDoc, onChange, notifyPreview } = opts;
  const noun = container.itemNoun || 'item';
  const fields = (container.itemFieldSuffixes || []).map((suf) => ({
    id: item.id + suf.suffix,
    label: suf.label,
    type: suf.type || 'text',
  }));

  // título preview — pega o primeiro field como rótulo
  const previewLabel = computeItemPreviewLabel(ctx, item, fields, scope);
  const isExpanded = expandedItemIds.has(item.id);

  const row = document.createElement('article');
  row.className = `pages-container-item ${item.hidden ? 'is-hidden' : ''} ${item.isCustom ? 'is-custom' : ''} ${isExpanded ? 'is-expanded' : ''}`;
  row.dataset.itemId = item.id;

  row.innerHTML = `
    <header class="pages-container-item__head">
      <button class="pages-container-item__toggle" data-action="toggle" aria-label="Expandir/recolher" aria-expanded="${isExpanded}">
        <span class="pages-container-item__chev">${icon('chevron', { size: 12 })}</span>
        <span class="pages-container-item__preview">
          <span class="pages-container-item__title">${escapeHtml(previewLabel || `(${noun} sem título)`)}</span>
          ${item.isCustom ? `<span class="pages-container-item__badge pages-container-item__badge--custom">novo</span>` : ''}
          ${item.hidden ? `<span class="pages-container-item__badge pages-container-item__badge--hidden">${icon('eye-off', { size: 9 })}<span>oculto</span></span>` : ''}
        </span>
      </button>
      <div class="pages-container-item__actions">
        <button class="icon-btn" data-action="move-up" title="Mover para cima" aria-label="Mover para cima">${icon('arrow-up', { size: 12 })}</button>
        <button class="icon-btn" data-action="move-down" title="Mover para baixo" aria-label="Mover para baixo">${icon('arrow-down', { size: 12 })}</button>
        <button class="icon-btn ${item.hidden ? 'is-active' : ''}" data-action="toggle-hide"
                title="${item.hidden ? 'Mostrar no site' : 'Ocultar do site'}"
                aria-label="${item.hidden ? 'Mostrar' : 'Ocultar'}">${icon(item.hidden ? 'eye-off' : 'eye', { size: 12 })}</button>
        ${item.isCustom ? `<button class="icon-btn icon-btn--danger" data-action="remove" title="Remover ${noun}" aria-label="Remover">${icon('trash', { size: 12 })}</button>` : ''}
      </div>
    </header>
    <div class="pages-container-item__body" ${isExpanded ? '' : 'hidden'}></div>
  `;

  // construir fields no body
  const bodyEl = row.querySelector('.pages-container-item__body');
  for (const field of fields) {
    bodyEl.appendChild(buildField(ctx, field, { onChange, notifyPreview, scope }));
  }
  if (container.supportsHref) {
    bodyEl.appendChild(buildHrefField(ctx, item, { scope, notifyPreview, onChange }));
  }

  // listeners
  row.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-action]');
    if (!btn) return;
    ev.preventDefault();
    ev.stopPropagation();
    const action = btn.dataset.action;
    handleItemAction(ctx, container, item, allItems, action, opts);
  });

  return row;
}

function computeItemPreviewLabel(ctx, item, fields, scope) {
  const data = ctx.api.getScope(scope);
  for (const f of fields) {
    const fromText = data.text?.[f.id];
    if (fromText) return stripHtml(fromText);
    const fromLabel = data.labels?.[f.id];
    if (fromLabel) return stripHtml(fromLabel);
    const original = getOriginalFor(f.id);
    if (original) return stripHtml(original);
  }
  // fallback: id
  return item.id;
}

function handleItemAction(ctx, container, item, allItems, action, opts) {
  const { scope, iframeDoc, onChange, notifyPreview } = opts;
  const noun = container.itemNoun || 'item';

  switch (action) {
    case 'toggle': {
      if (expandedItemIds.has(item.id)) expandedItemIds.delete(item.id);
      else expandedItemIds.add(item.id);
      refreshContainerSection(ctx, container, opts);
      break;
    }
    case 'toggle-hide': {
      const data = ctx.api.getScope(scope);
      const currentlyHidden = !!data.hidden?.[item.id];
      ctx.api.patchEdit(scope, 'hidden', item.id, currentlyHidden ? null : true);
      ctx.api.markDirty(scope);
      notifyPreview?.();
      onChange?.();
      refreshContainerSection(ctx, container, opts);
      break;
    }
    case 'move-up':
    case 'move-down': {
      const delta = action === 'move-up' ? -1 : +1;
      const ids = allItems.map((it) => it.id);
      const idx = ids.indexOf(item.id);
      const newIdx = idx + delta;
      if (newIdx < 0 || newIdx >= ids.length) return;
      const moved = [...ids];
      [moved[idx], moved[newIdx]] = [moved[newIdx], moved[idx]];
      ctx.api.setContainerOrder(scope, container.key, moved);
      ctx.api.markDirty(scope);
      notifyPreview?.();
      onChange?.();
      refreshContainerSection(ctx, container, opts);
      break;
    }
    case 'remove': {
      if (!item.isCustom) return;
      if (!confirm(`Remover este ${noun}?\n\nIsso apaga o ${noun} novo que você adicionou (os ${noun}s originais não são afetados).`)) return;
      // limpa overrides associados ao id
      const data = ctx.api.getScope(scope);
      for (const bucket of ['text', 'labels', 'hidden', 'attrs']) {
        const map = data[bucket] || {};
        for (const k of Object.keys(map)) {
          if (k === item.id || k.startsWith(`${item.id}.`)) {
            ctx.api.patchEdit(scope, bucket, k, null);
          }
        }
      }
      ctx.api.removeContainerItem(scope, container.key, item.id);
      // tira do containerOrder
      const order = ctx.api.getContainerOrder(scope, container.key);
      if (order) {
        ctx.api.setContainerOrder(scope, container.key, order.filter((id) => id !== item.id));
      }
      ctx.api.markDirty(scope);
      expandedItemIds.delete(item.id);
      notifyPreview?.();
      onChange?.();
      refreshContainerSection(ctx, container, opts);
      break;
    }
  }
}

// Modal pra criar um item novo
function promptAddItem(ctx, container, opts) {
  return new Promise((resolve) => {
    const noun = container.itemNoun || 'item';
    const supportsHref = !!container.supportsHref;
    const suffixes = container.itemFieldSuffixes || [];

    document.querySelectorAll('.container-prompt').forEach((el) => el.remove());

    const modal = document.createElement('div');
    modal.className = 'container-prompt';
    modal.innerHTML = `
      <div class="container-prompt__box" role="dialog" aria-modal="true">
        <header class="container-prompt__head">
          <div>
            <p class="container-prompt__crumb">novo ${noun}</p>
            <h3>Adicionar ${noun}</h3>
            <p class="container-prompt__desc">O novo ${noun} herda o estilo dos demais — você só preenche os textos.</p>
          </div>
          <button class="icon-btn" data-action="cancel" aria-label="Fechar">${icon('x', { size: 16 })}</button>
        </header>
        <div class="container-prompt__body">
          ${suffixes.map((s) => `
            <label class="container-prompt__field">
              <span>${escapeHtml(s.label)}</span>
              ${s.type === 'rich' || s.type === 'text'
                ? `<textarea data-suffix="${escapeHtml(s.suffix)}" rows="2" placeholder="${escapeHtml(placeholderFor(s.label))}"></textarea>`
                : `<input type="text" data-suffix="${escapeHtml(s.suffix)}" placeholder="${escapeHtml(placeholderFor(s.label))}" />`}
            </label>
          `).join('')}
          ${supportsHref ? `
            <label class="container-prompt__field">
              <span>Link (URL)</span>
              <input type="text" data-href placeholder="https://… ou #ancora ou atividades/pagina.html" />
              <small class="container-prompt__hint">Deixe em branco se for um item informativo (sem link).</small>
            </label>
          ` : ''}
        </div>
        <footer class="container-prompt__foot">
          <button class="btn btn--ghost btn--small" data-action="cancel">Cancelar</button>
          <button class="btn btn--primary" data-action="create">Criar ${noun}</button>
        </footer>
      </div>
    `;
    document.body.appendChild(modal);

    function close(result) {
      modal.remove();
      resolve(result);
    }

    modal.addEventListener('click', (ev) => {
      const action = ev.target.closest('[data-action]')?.dataset?.action;
      if (action === 'cancel' || ev.target === modal) return close(null);
      if (action === 'create') {
        const newId = makeCustomId();
        const item = {
          id: newId,
          basedOn: container.defaultBasedOn,
        };
        // recolhe valores dos fields
        for (const s of suffixes) {
          const inp = modal.querySelector(`[data-suffix="${cssAttr(s.suffix)}"]`);
          const raw = inp?.value || '';
          if (!raw.trim()) continue;
          const bucket = s.type === 'link-label' ? 'labels' : 'text';
          const value = s.type === 'link-label' ? raw.trim() : mdToHtml(raw);
          ctx.api.patchEdit(opts.scope, bucket, newId + s.suffix, value);
        }
        if (supportsHref) {
          const href = modal.querySelector('[data-href]')?.value?.trim();
          if (href) item.href = href;
        }
        ctx.api.addContainerItem(opts.scope, container.key, item);
        ctx.api.markDirty(opts.scope);
        close(item);
      }
    });

    setTimeout(() => modal.querySelector('textarea, input')?.focus(), 80);
  });
}

function placeholderFor(label) {
  const l = label.toLowerCase();
  if (l.includes('título') || l.includes('titulo')) return 'Nome do novo card';
  if (l.includes('descri')) return 'Resumo curto de uma ou duas linhas';
  if (l.includes('rótulo') || l.includes('label')) return 'Texto curto';
  return '';
}

function makeCustomId() {
  return 'c_' + Math.random().toString(36).slice(2, 9);
}

function buildHrefField(ctx, item, { scope, notifyPreview, onChange }) {
  const wrap = document.createElement('div');
  wrap.className = 'pages-field pages-field--no-toolbar pages-field--inline';

  // pega href atual: pra item custom é item.href; pra original vem do attrs override ou do DOM
  let currentHref = '';
  if (item.isCustom) {
    currentHref = item.href || '';
  } else {
    const data = ctx.api.getScope(scope);
    currentHref = data.attrs?.[item.id]?.href ?? (item.href || '');
  }

  wrap.innerHTML = `
    <div class="pages-field__head">
      <span class="pages-field__label">Link (URL)</span>
      <span class="pages-field__type-badge pages-field__type-badge--link-label" title="Endereço de destino do link">
        ${icon('external', { size: 11 })}<span>href</span>
      </span>
    </div>
    <input type="text" class="pages-field__input" placeholder="https://… ou atividades/pagina.html" />
  `;

  const input = wrap.querySelector('input');
  input.value = currentHref;

  input.addEventListener('input', () => {
    const v = input.value.trim();
    if (item.isCustom) {
      ctx.api.updateContainerItem(scope, getContainerKeyForItem(item, ctx, scope), item.id, { href: v });
      item.href = v;
    } else {
      ctx.api.setAttr(scope, item.id, 'href', v === '' ? null : v);
    }
    ctx.api.markDirty(scope);
    notifyPreview?.();
    onChange?.();
  });

  return wrap;
}

// helper bem feio porque o item não traz containerKey direto — descobre olhando
// items[*] de cada container do scope.
function getContainerKeyForItem(item, ctx, scope) {
  const data = ctx.api.getScope(scope);
  const items = data.items || {};
  for (const key of Object.keys(items)) {
    if ((items[key] || []).some((it) => it.id === item.id)) return key;
  }
  return null;
}

// ---------- field (reaproveitado, idêntico ao Sprint 3) ----------

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

    if (sameAsOriginal && original) {
      api.patchEdit(scope, bucket, field.id, null);
    } else {
      api.patchEdit(scope, bucket, field.id, newHtml);
    }
    api.markDirty(scope);
    notifyPreview?.();
    refreshEditedBadge(!sameAsOriginal || (!original && !!newHtml));
    renderPreview(userValue);
  }

  renderPreview(initialValue);
  input.addEventListener('input', persistAndPreview);

  input.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key === 'b' || e.key === 'B') { e.preventDefault(); wrapSelection(input, '**', '**'); persistAndPreview(); }
    else if (e.key === 'i' || e.key === 'I') { e.preventDefault(); wrapSelection(input, '*', '*'); persistAndPreview(); }
  });

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

function wrapSelection(input, prefix, suffix) {
  const start = input.selectionStart ?? 0;
  const end = input.selectionEnd ?? 0;
  const value = input.value;
  const before = value.slice(0, start);
  const middle = value.slice(start, end);
  const after = value.slice(end);

  if (
    middle === '' &&
    before.endsWith(prefix) &&
    after.startsWith(suffix)
  ) {
    input.value = before.slice(0, -prefix.length) + after.slice(suffix.length);
    const pos = start - prefix.length;
    input.setSelectionRange(pos, pos);
    return;
  }
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

function stripHtml(html) {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = String(html);
  return tmp.textContent.replace(/\s+/g, ' ').trim();
}

function cssId(s) {
  return String(s).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function cssAttr(s) {
  return String(s).replace(/"/g, '\\"');
}

function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
