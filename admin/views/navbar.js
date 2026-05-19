import {
  loadIframe, scanScopeElements, renderEditPanel, makeDraggable,
  makePublishBar, escapeHtml,
} from './editor-shared.js';

export async function renderNavbar(ctx) {
  const { root, api, state } = ctx;
  const scope = 'global';

  if (!api.canEditScope(scope)) {
    root.innerHTML = `<div class="empty-state">Você não tem permissão para editar o escopo global.</div>`;
    return;
  }

  root.innerHTML = `
    <div class="view">
      <h1>Navbar &amp; rodapé</h1>
      <p class="view__lede">Edita os elementos que aparecem em <strong>todas</strong> as páginas — links do topo, brand, rodapé. Mudanças aqui se aplicam ao site inteiro.</p>
      <iframe id="navPreview" src="../index.html" style="position:fixed;top:-9999px;left:-9999px;width:1200px;height:800px;" aria-hidden="true"></iframe>
      <div id="navGroups" class="section-list"></div>
      ${makePublishBar('Publicar navbar &amp; rodapé')}
    </div>
  `;

  const iframe = document.getElementById('navPreview');
  let doc;
  try {
    doc = await loadIframe(iframe);
  } catch (e) {
    document.getElementById('navGroups').innerHTML = `<div class="empty-state">Erro: ${escapeHtml(e.message)}</div>`;
    return;
  }

  const allEls = scanScopeElements(doc, scope);
  if (!allEls.length) {
    document.getElementById('navGroups').innerHTML = `<div class="empty-state">Nenhum elemento marcado com escopo global encontrado.</div>`;
    return;
  }

  const groups = groupByPrefix(allEls);
  renderGroups(ctx, scope, groups, doc);
}

function groupByPrefix(els) {
  const groups = new Map();
  for (const el of els) {
    const id = el.dataset.editId;
    let key;
    if (id.startsWith('nav.brand')) key = 'Marca (topo)';
    else if (id.startsWith('nav.link.')) key = 'Links do topo';
    else if (id === 'nav') key = 'Navbar (container)';
    else if (id.startsWith('footer.brand') || id.startsWith('footer.about') || id.startsWith('footer.social')) key = 'Rodapé · sobre o projeto';
    else if (id.startsWith('footer.col.projeto')) key = 'Rodapé · coluna "O projeto"';
    else if (id.startsWith('footer.col.atividades')) key = 'Rodapé · coluna "Atividades"';
    else if (id.startsWith('footer.col.depts')) key = 'Rodapé · coluna "Departamentos"';
    else if (id.startsWith('footer.bottom')) key = 'Rodapé · rodapé do rodapé';
    else if (id === 'section.footer') key = 'Rodapé · container';
    else key = 'Outros (global)';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(el);
  }
  return groups;
}

function renderGroups(ctx, scope, groups, doc) {
  const { api } = ctx;
  const container = document.getElementById('navGroups');
  container.innerHTML = '';

  const reorderableContainers = new Map();
  for (const cnt of doc.querySelectorAll('[data-edit-container]')) {
    const cScope = cnt.dataset.editScope || doc.body?.dataset?.scope || 'global';
    if (cScope === scope) {
      const childIds = Array.from(cnt.children).map((c) => c.dataset?.editId).filter(Boolean);
      reorderableContainers.set(cnt.dataset.editContainer, childIds);
    }
  }

  for (const [groupName, els] of groups) {
    const sec = document.createElement('section');
    sec.innerHTML = `<h2>${escapeHtml(groupName)}</h2>`;
    const list = document.createElement('div');
    list.className = 'section-list';
    sec.appendChild(list);

    const orderKey = guessOrderContainer(els, reorderableContainers);
    const draggable = !!orderKey;

    for (const el of els) {
      list.appendChild(buildRow(ctx, scope, el, draggable));
    }
    if (draggable) {
      makeDraggable(list, (newOrderIds) => {
        // newOrderIds são edit-ids dos LIs visíveis na ordem nova
        // pega ordem completa do container (incluindo elementos que possam não estar na view)
        const existing = api.getScope(scope).order || [];
        // mescla: novos primeiro (na ordem do drag) + qualquer outro id existente que não esteja no grupo
        const groupIds = new Set(newOrderIds);
        const others = existing.filter((id) => !groupIds.has(id));
        api.setOrder(scope, [...newOrderIds, ...others]);
        api.markDirty(scope);
        notifyPreview(scope);
      });
    }
    container.appendChild(sec);
  }

  attachPublishBar(ctx, scope);
}

function guessOrderContainer(els, reorderableMap) {
  // se TODOS os edit-ids do grupo estão num mesmo container reorderável, ativa drag
  for (const [containerKey, childIds] of reorderableMap) {
    const setIds = new Set(childIds);
    const allInside = els.every((el) => setIds.has(el.dataset.editId));
    if (allInside && els.length >= 2) return containerKey;
  }
  return null;
}

function buildRow(ctx, scope, el, draggable) {
  const { api } = ctx;
  const id = el.dataset.editId;
  const type = el.dataset.editType || 'text';
  const data = api.getScope(scope);

  const isHidden = !!data.hidden?.[id];
  const overrideText = data.text?.[id];
  const overrideLabel = data.labels?.[id];
  const currentPreview = (overrideLabel ?? overrideText ?? humanText(el)).slice(0, 80);
  const hasOverride = overrideText !== undefined || overrideLabel !== undefined;

  const row = document.createElement('div');
  row.className = 'section-row' + (isHidden ? ' is-hidden' : '');
  row.dataset.editId = id;
  if (draggable) row.draggable = true;

  row.innerHTML = `
    ${draggable ? '<span class="section-row__handle" title="Arrastar">⋮⋮</span>' : ''}
    <div class="section-row__main">
      <span class="section-row__title">${escapeHtml(currentPreview)}${hasOverride ? ' <small style="color:var(--gold);font-style:italic;">· editado</small>' : ''}</span>
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
    notifyPreview(scope);
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
      notifyPreview(scope);
      redraw(ctx);
    },
  });
}

function redraw(ctx) {
  // re-render da view inteira (simples)
  const iframe = document.getElementById('navPreview');
  if (!iframe) return;
  renderNavbar(ctx);
}

function notifyPreview(scope) {
  const iframe = document.getElementById('navPreview');
  if (!iframe || !iframe.contentWindow) return;
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
    if (state.dirty.has(scope)) {
      statusEl.textContent = 'Alterações não publicadas.';
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
      await api.publish(scope);
      api.clearDirty(scope);
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
    if (!confirm('Descartar todas as alterações deste escopo e voltar ao último publicado? (recarrega do servidor)')) return;
    location.reload();
  });
}
