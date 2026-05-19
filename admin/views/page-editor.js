import {
  loadIframe, scanScopeElements, renderEditPanel, makeDraggable,
  makePublishBar, escapeHtml,
} from './editor-shared.js';
import { PAGES, slugToScope } from '../pages-meta.js';

export async function renderPageEditor(ctx, slug) {
  const { root, api, state } = ctx;
  const scope = slugToScope(slug);
  const page = PAGES.find((p) => p.scope === scope);
  if (!page) {
    root.innerHTML = `<div class="empty-state">Página não encontrada.</div>`;
    return;
  }
  if (!api.canEditScope(scope)) {
    root.innerHTML = `<div class="empty-state">Você não tem permissão para editar “${escapeHtml(page.label)}”.</div>`;
    return;
  }

  root.innerHTML = `
    <div class="view">
      <p class="view__crumbs"><a href="#/paginas">← Páginas</a></p>
      <h1>${escapeHtml(page.label)}</h1>
      <p class="view__lede">Edita as seções desta página. Mudanças aqui ficam restritas a esta LP — exceto rodapé e navbar, que vivem em <a href="#/navbar">Navbar &amp; rodapé</a>.</p>

      <iframe id="lpPreview" src="${page.path}" style="position:fixed;top:-9999px;left:-9999px;width:1200px;height:800px;" aria-hidden="true"></iframe>

      ${page.scope !== 'global' ? renderPageSettings(scope, page, api) : ''}

      <h2>Seções</h2>
      <div id="sectionsList" class="section-list">
        <div class="empty-state">analisando a página…</div>
      </div>

      ${makePublishBar('Publicar esta LP')}
    </div>
  `;

  bindPageSettings(ctx, scope, page);

  const iframe = document.getElementById('lpPreview');
  let doc;
  try {
    doc = await loadIframe(iframe);
  } catch (e) {
    document.getElementById('sectionsList').innerHTML = `<div class="empty-state">Erro ao abrir a página: ${escapeHtml(e.message)}</div>`;
    return;
  }

  const els = scanScopeElements(doc, scope);
  renderSectionList(ctx, scope, doc, els);
  attachPublishBar(ctx, scope);
}

// ---------- header de configurações da LP (visibilidade global + nav-label) ----------
function renderPageSettings(scope, page, api) {
  const slug = scope.replace('lp:', '');
  const data = api.getData();
  const globalData = data.global || {};
  const navLabelKey = `page.${slug}.nav-label`;
  const hiddenKey = `page.${slug}`;
  const currentLabel = globalData.labels?.[navLabelKey] || '';
  const isHidden = !!globalData.hidden?.[hiddenKey];

  return `
    <section style="margin: 20px 0 28px;">
      <div class="card-item" style="cursor:default;">
        <strong style="color:var(--cream);font-family:'Cormorant Garamond',serif;font-style:italic;font-size:18px;">Configurações da página</strong>
        <div class="flex-row" style="margin-top:10px;gap:20px;">
          <label class="toggle">
            <input type="checkbox" id="pageHidden" ${isHidden ? 'checked' : ''} />
            <span class="toggle__track"></span>
            <span>Ocultar a página no menu / rodapé</span>
          </label>
        </div>
        <label style="margin-top:14px;display:block;">
          <small class="muted" style="display:block;margin-bottom:4px;letter-spacing:0.06em;text-transform:uppercase;font-size:11px;">Rótulo no menu (opcional)</small>
          <input type="text" id="pageNavLabel" value="${escapeHtml(currentLabel)}" placeholder="${escapeHtml(page.label)}" style="width:100%;max-width:340px;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:8px 12px;border-radius:8px;font:inherit;" />
        </label>
      </div>
    </section>
  `;
}

function bindPageSettings(ctx, scope, page) {
  if (scope === 'global') return;
  const slug = scope.replace('lp:', '');
  const navLabelKey = `page.${slug}.nav-label`;
  const hiddenKey = `page.${slug}`;

  const hiddenInput = document.getElementById('pageHidden');
  const labelInput  = document.getElementById('pageNavLabel');

  if (hiddenInput) {
    hiddenInput.addEventListener('change', () => {
      ctx.api.patchEdit('global', 'hidden', hiddenKey, hiddenInput.checked ? true : null);
      ctx.api.markDirty('global');
      notifyPreview();
    });
  }
  if (labelInput) {
    labelInput.addEventListener('input', () => {
      const v = labelInput.value.trim();
      ctx.api.patchEdit('global', 'labels', navLabelKey, v || null);
      ctx.api.markDirty('global');
      notifyPreview();
    });
  }
}

// ---------- lista de seções ----------
function renderSectionList(ctx, scope, doc, els) {
  const list = document.getElementById('sectionsList');
  list.innerHTML = '';

  if (!els.length) {
    list.innerHTML = `<div class="empty-state">Esta página ainda não tem elementos marcados para edição.</div>`;
    return;
  }

  // separar containers reorderáveis
  const reorderable = new Map();
  for (const cnt of doc.querySelectorAll('[data-edit-container]')) {
    const cScope = cnt.dataset.editScope || doc.body?.dataset?.scope || 'global';
    if (cScope !== scope) continue;
    const childIds = Array.from(cnt.children).map((c) => c.dataset?.editId).filter(Boolean);
    reorderable.set(cnt.dataset.editContainer, childIds);
  }

  // identifica seções "top-level" (data-edit-type="section" cujo edit-id começa com section.)
  const topSections = els.filter((el) => /^section\./.test(el.dataset.editId));
  const otherEls   = els.filter((el) => !/^section\./.test(el.dataset.editId));

  if (topSections.length) {
    const h = document.createElement('h3');
    h.style.cssText = 'margin: 16px 0 8px; font-family: "Cormorant Garamond", serif; font-style: italic; color: var(--text); font-weight: 500;';
    h.textContent = 'Blocos da página (arraste para reordenar)';
    list.appendChild(h);

    const sub = document.createElement('div');
    sub.className = 'section-list';
    for (const el of topSections) sub.appendChild(buildRow(ctx, scope, el, true));
    list.appendChild(sub);

    makeDraggable(sub, (newOrder) => {
      const existing = ctx.api.getScope(scope).order || [];
      const groupIds = new Set(newOrder);
      const others = existing.filter((id) => !groupIds.has(id));
      ctx.api.setOrder(scope, [...newOrder, ...others]);
      ctx.api.markDirty(scope);
      notifyPreview();
    });
  }

  // outros elementos (texto, links, sub-cards)
  if (otherEls.length) {
    const h = document.createElement('h3');
    h.style.cssText = 'margin: 22px 0 8px; font-family: "Cormorant Garamond", serif; font-style: italic; color: var(--text); font-weight: 500;';
    h.textContent = 'Textos e elementos internos';
    list.appendChild(h);

    const sub = document.createElement('div');
    sub.className = 'section-list';
    for (const el of otherEls) sub.appendChild(buildRow(ctx, scope, el, false));
    list.appendChild(sub);
  }
}

function buildRow(ctx, scope, el, draggable) {
  const { api } = ctx;
  const id = el.dataset.editId;
  const type = el.dataset.editType || 'text';
  const data = api.getScope(scope);

  const isHidden = !!data.hidden?.[id];
  const overrideText = data.text?.[id];
  const overrideLabel = data.labels?.[id];
  const preview = (overrideLabel ?? overrideText ?? humanText(el)).slice(0, 80);
  const hasOverride = overrideText !== undefined || overrideLabel !== undefined;

  const row = document.createElement('div');
  row.className = 'section-row' + (isHidden ? ' is-hidden' : '');
  row.dataset.editId = id;
  if (draggable) row.draggable = true;

  row.innerHTML = `
    ${draggable ? '<span class="section-row__handle" title="Arrastar">⋮⋮</span>' : ''}
    <div class="section-row__main">
      <span class="section-row__title">${escapeHtml(preview)}${hasOverride ? ' <small style="color:var(--gold);font-style:italic;">· editado</small>' : ''}</span>
      <span class="section-row__id">${escapeHtml(id)}</span>
    </div>
    <span class="section-row__type">${type}</span>
    <div class="section-row__actions">
      <button class="icon-btn" data-action="edit" title="Editar texto">✎</button>
      <button class="icon-btn ${isHidden ? 'is-active' : ''}" data-action="hide" title="${isHidden ? 'Mostrar' : 'Ocultar'}">${isHidden ? '◉' : '◯'}</button>
      ${hasOverride ? '<button class="icon-btn" data-action="reset" title="Voltar ao original">↺</button>' : ''}
    </div>
  `;

  row.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-action]');
    if (!btn) return;
    ev.preventDefault();
    ev.stopPropagation();
    const action = btn.dataset.action;
    if (action === 'hide') {
      api.patchEdit(scope, 'hidden', id, isHidden ? null : true);
    } else if (action === 'edit') {
      openEditPanel(ctx, scope, el);
      return;
    } else if (action === 'reset') {
      api.patchEdit(scope, 'text', id, null);
      api.patchEdit(scope, 'labels', id, null);
    }
    api.markDirty(scope);
    notifyPreview();
    redraw(ctx);
  });

  return row;
}

function humanText(el) {
  return (el.textContent || '').replace(/\s+/g, ' ').trim() || '(vazio)';
}

function openEditPanel(ctx, scope, el) {
  const { api } = ctx;
  const id = el.dataset.editId;
  const type = el.dataset.editType || 'text';
  const data = api.getScope(scope);
  const isLabelType = type === 'link';
  const kind = isLabelType ? 'labels' : 'text';

  const original = isLabelType
    ? (el.textContent || '').replace(/\s+/g, ' ').trim()
    : el.innerHTML.trim();

  const current = (isLabelType ? data.labels?.[id] : data.text?.[id]) ?? original;

  renderEditPanel({
    title: `Editar: ${id}`,
    id,
    original,
    current,
    isLabelType,
    onSave: (val) => {
      const next = val.trim();
      if (next === original.trim()) {
        api.patchEdit(scope, kind, id, null);
      } else {
        api.patchEdit(scope, kind, id, next);
      }
      api.markDirty(scope);
      notifyPreview();
      redraw(ctx);
    },
  });
}

function redraw(ctx) {
  // re-render preserva scroll
  const list = document.getElementById('sectionsList');
  if (!list) return;
  const scroll = list.scrollTop;
  const slug = location.hash.split('/').filter(Boolean)[1];
  // re-execute o render principal
  renderPageEditor(ctx, slug).then(() => {
    const newList = document.getElementById('sectionsList');
    if (newList) newList.scrollTop = scroll;
  });
}

function notifyPreview() {
  const iframe = document.getElementById('lpPreview');
  if (!iframe?.contentWindow) return;
  try {
    iframe.contentWindow.postMessage({ kind: 'tulipa:re-render' }, location.origin);
  } catch {}
}

function attachPublishBar(ctx, scope) {
  const { api, state } = ctx;
  const statusEl = document.getElementById('publishStatus');
  const btn = document.getElementById('publishBtn');
  const resetBtn = document.getElementById('resetBtn');

  function updateStatus() {
    const anyDirty = state.dirty.has(scope) || state.dirty.has('global');
    if (anyDirty) {
      statusEl.textContent = state.dirty.has('global')
        ? 'Alterações em "global" também — publique pela aba Navbar.'
        : 'Alterações não publicadas.';
      statusEl.className = 'publish-bar__status is-dirty';
    } else {
      statusEl.textContent = 'Tudo publicado.';
      statusEl.className = 'publish-bar__status';
    }
  }
  updateStatus();

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = 'Publicando…';
    try {
      // se houver dirty em global e estiver editando settings da página (label + hidden global),
      // o user vai precisar publicar global também. Por enquanto: publica o scope da LP.
      await api.publish(scope);
      api.clearDirty(scope);
      // Se settings de página (em scope global) também foram tocadas, publicar global junto.
      if (state.dirty.has('global')) {
        await api.publish('global', `auto: ajustes em ${scope}`);
        api.clearDirty('global');
      }
      statusEl.textContent = 'Publicado com sucesso.';
      statusEl.className = 'publish-bar__status is-success';
    } catch (e) {
      statusEl.textContent = `Erro: ${e.message}`;
      statusEl.className = 'publish-bar__status is-error';
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  });

  resetBtn?.addEventListener('click', () => {
    if (!confirm('Descartar todas as alterações desta LP? (recarrega a página inteira)')) return;
    location.reload();
  });
}
