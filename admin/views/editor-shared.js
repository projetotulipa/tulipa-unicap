// Helpers compartilhados pelas views de editor (navbar + page-editor).

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function loadIframe(iframe) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('iframe demorou demais para carregar')), 10000);
    iframe.addEventListener('load', () => {
      clearTimeout(t);
      try {
        const doc = iframe.contentDocument;
        if (!doc) throw new Error('sem acesso ao contentDocument (cross-origin?)');
        resolve(doc);
      } catch (e) { reject(e); }
    }, { once: true });
  });
}

// Pega todos os elementos com data-edit-id cujo scope efetivo === scope solicitado.
export function scanScopeElements(doc, scope) {
  const bodyScope = doc.body?.dataset?.scope || 'global';
  const result = [];
  for (const el of doc.querySelectorAll('[data-edit-id]')) {
    const effScope = el.dataset.editScope || bodyScope;
    if (effScope === scope) result.push(el);
  }
  return result;
}

// Drag-drop simples entre filhos diretos.
// `onReorder` recebe array de edit-ids na nova ordem.
export function makeDraggable(container, onReorder) {
  let dragged = null;

  container.addEventListener('dragstart', (e) => {
    const row = e.target.closest('.section-row');
    if (!row || row.parentElement !== container) return;
    dragged = row;
    row.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', row.dataset.editId); } catch {}
  });

  container.addEventListener('dragover', (e) => {
    if (!dragged) return;
    e.preventDefault();
    const target = e.target.closest('.section-row');
    if (!target || target === dragged || target.parentElement !== container) return;
    const rect = target.getBoundingClientRect();
    const before = (e.clientY - rect.top) < rect.height / 2;
    container.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
    target.classList.add('drag-over');
    target.parentElement.insertBefore(dragged, before ? target : target.nextSibling);
  });

  container.addEventListener('dragleave', (e) => {
    if (!e.target.classList?.contains('section-row')) return;
    e.target.classList.remove('drag-over');
  });

  container.addEventListener('dragend', () => {
    container.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
    if (dragged) {
      dragged.classList.remove('dragging');
      const order = Array.from(container.children)
        .filter((c) => c.classList.contains('section-row'))
        .map((c) => c.dataset.editId)
        .filter(Boolean);
      onReorder(order);
      dragged = null;
    }
  });

  container.addEventListener('drop', (e) => e.preventDefault());
}

// Renderiza o modal de edição de texto.
export function renderEditPanel({ title, id, original, current, isLabelType, onSave }) {
  // remove qualquer modal existente
  document.querySelectorAll('.edit-panel').forEach((el) => el.remove());

  const panel = document.createElement('div');
  panel.className = 'edit-panel';
  panel.innerHTML = `
    <div class="edit-panel__box" role="dialog" aria-modal="true">
      <header class="edit-panel__head">
        <div>
          <h3>${escapeHtml(title)}</h3>
          <span class="edit-panel__id">${escapeHtml(id)} · ${isLabelType ? 'rótulo (texto puro)' : 'texto/HTML'}</span>
        </div>
        <button class="icon-btn" data-action="close" title="Fechar">✕</button>
      </header>
      <div class="edit-panel__body">
        <textarea id="editTextarea" rows="8">${escapeHtml(current)}</textarea>
        <p class="edit-panel__hint">
          ${isLabelType
            ? 'Apenas texto puro (link). Tags HTML aqui são exibidas literais.'
            : 'Pode incluir HTML simples: <code>&lt;strong&gt;</code>, <code>&lt;em&gt;</code>, <code>&lt;br/&gt;</code>. Cuidado com aspas.'
          }
        </p>
        <details style="margin-top:14px;">
          <summary class="muted" style="cursor:pointer;font-size:13px;">Texto original</summary>
          <pre style="margin:8px 0 0;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:8px;font-size:12px;color:var(--text-dim);white-space:pre-wrap;word-break:break-word;">${escapeHtml(original)}</pre>
        </details>
      </div>
      <footer class="edit-panel__foot">
        <button class="btn btn--ghost" data-action="close">Cancelar</button>
        <button class="btn btn--ghost" data-action="reset" title="Voltar ao texto original">Voltar ao original</button>
        <button class="btn btn--primary" data-action="save">Aplicar</button>
      </footer>
    </div>
  `;
  document.body.appendChild(panel);

  const ta = panel.querySelector('#editTextarea');
  ta.focus();
  ta.setSelectionRange(0, 0);

  function close() { panel.remove(); }
  panel.addEventListener('click', (ev) => {
    const action = ev.target.closest('[data-action]')?.dataset.action;
    if (action === 'close' || ev.target === panel) close();
    if (action === 'reset') ta.value = original;
    if (action === 'save') { onSave(ta.value); close(); }
  });
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
  });
}

export function makePublishBar(label = 'Publicar') {
  return `
    <div class="publish-bar">
      <span id="publishStatus" class="publish-bar__status">—</span>
      <button id="resetBtn" class="btn btn--ghost btn--small">Descartar</button>
      <button id="publishBtn" class="btn btn--primary">${label}</button>
    </div>
  `;
}
