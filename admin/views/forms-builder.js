// TULIPA · admin · Formulários — construtor (editor de campos + configs).
import * as Forms from '../forms/data.js';
import {
  FIELD_TYPES, FIELD_TYPE_MAP,
  fieldCaps, makeField, isStaticField,
} from '../forms/field-types.js';
import { defaultFormSettings } from '../forms/field-types.js';
import { icon } from '../icons.js';
import { toastSuccess, toastError } from '../toast.js';
import { formPublicUrl } from './forms.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const attr = (s) => esc(s);

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fromLocalInput(v) { return v ? new Date(v).toISOString() : null; }

// quais tabs do inspector existem por contexto
const FORM_TABS = [
  { id: 'geral',    label: 'Geral' },
  { id: 'visual',   label: 'Aparência' },
  { id: 'acesso',   label: 'Acesso' },
  { id: 'pos',      label: 'Pós-envio' },
  { id: 'avancado', label: 'Avançado' },
];
const FIELD_TABS = [
  { id: 'basico',   label: 'Básico' },
  { id: 'avancado', label: 'Avançado' },
  { id: 'logica',   label: 'Lógica' },
];

export async function renderFormsBuilder(ctx, formId) {
  const { root, api } = ctx;
  root.innerHTML = `<div class="empty-state">Carregando construtor…</div>`;

  const { data: form, error } = await Forms.getForm(formId);
  if (error || !form) { root.innerHTML = `<div class="empty-state">Não achei esse formulário.</div>`; return; }

  // garante estrutura
  if (!form.schema || !Array.isArray(form.schema.pages) || !form.schema.pages.length) {
    form.schema = { pages: [{ id: 'p1', title: '', fields: [] }] };
  }
  form.settings = { ...defaultFormSettings(), ...(form.settings || {}) };

  const S = {
    form,
    pageIdx: 0,
    selected: 'form',
    dirty: false,
    formTab: 'geral',
    fieldTab: 'basico',
  };
  let dragId = null;

  root.innerHTML = `
    <div class="fb fb--v2">
      <header class="fb__bar">
        <button class="admin-link-btn" id="fbBack">${icon('arrow-left', { size: 14 })} Voltar</button>
        <div class="fb__title">
          <strong id="fbTitle">${esc(form.title)}</strong>
          <span class="form-status ${form.status === 'published' ? 'is-published' : 'is-draft'}" id="fbStatus">${form.status === 'published' ? 'Publicado' : 'Rascunho'}</span>
          <span class="fb__autosave" id="fbAutosave" aria-live="polite"></span>
        </div>
        <div class="fb__bar-actions">
          <button class="btn btn--ghost btn--small" id="fbLink" title="Copiar link público">${icon('external', { size: 12 })} Link</button>
          <button class="btn btn--primary btn--small" id="fbPublish">${form.status === 'published' ? 'Despublicar' : 'Publicar'}</button>
        </div>
      </header>
      <div class="fb__cols fb__cols--two">
        <section class="fb__canvas" id="fbCanvas"></section>
        <aside class="fb__inspector" id="fbInspector"></aside>
      </div>
    </div>`;

  // ----- header actions -----
  root.querySelector('#fbBack').onclick = () => maybeLeave(() => api.navigate('#/forms'));
  root.querySelector('#fbLink').onclick = async () => {
    if (S.dirty) await save();
    const url = formPublicUrl(S.form.slug);
    try { await navigator.clipboard.writeText(url); toastSuccess('Link copiado!'); }
    catch { prompt('Link público:', url); }
  };
  root.querySelector('#fbPublish').onclick = publishToggle;

  // ----- autosave (8s quando dirty) -----
  let savingNow = false;
  const autosaveTimer = setInterval(async () => {
    if (S.dirty && !savingNow && document.visibilityState === 'visible') {
      savingNow = true;
      await save({ silent: true });
      savingNow = false;
    }
  }, 8000);
  window.addEventListener('beforeunload', () => clearInterval(autosaveTimer));

  // ----- atalhos teclado (Ctrl+S, Ctrl+Shift+D, "/") -----
  function onKey(e) {
    if (!document.body.contains(root)) {
      document.removeEventListener('keydown', onKey);
      clearInterval(autosaveTimer);
      return;
    }
    const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName);

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (S.dirty) save({ manual: true });
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      if (S.selected && S.selected !== 'form') duplicateField(S.selected);
      return;
    }
    if (e.key === '/' && !inInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      openQuickAdd();
    }
  }
  document.addEventListener('keydown', onKey);

  renderCanvas();
  renderInspector();

  // ---------- helpers ----------
  function curPage() { return S.form.schema.pages[S.pageIdx]; }
  function markDirty() { S.dirty = true; }

  function addField(type) {
    const f = makeField(type);
    curPage().fields.push(f);
    S.selected = f.id;
    S.fieldTab = 'basico';
    markDirty();
    renderCanvas(); renderInspector();
  }

  function findField(id) {
    for (const p of S.form.schema.pages) {
      const i = p.fields.findIndex((f) => f.id === id);
      if (i >= 0) return { page: p, idx: i, field: p.fields[i] };
    }
    return null;
  }

  async function save({ silent = false, manual = false } = {}) {
    const auto = root.querySelector('#fbAutosave');
    if (auto) auto.textContent = 'salvando…';
    const patch = {
      title: S.form.title, slug: S.form.slug, description: S.form.description,
      status: S.form.status, is_listed: S.form.is_listed,
      schema: S.form.schema, settings: S.form.settings,
      opens_at: S.form.opens_at || null, closes_at: S.form.closes_at || null,
      max_responses: S.form.max_responses || null,
    };
    const { error } = await Forms.updateForm(S.form.id, patch);
    if (error) {
      if (auto) auto.textContent = '⚠ erro ao salvar';
      return toastError('Erro ao salvar: ' + error.message);
    }
    S.dirty = false;
    const hhmm = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (auto) auto.textContent = `salvo ${hhmm}`;
    if (manual && !silent) toastSuccess('Salvo!');
  }

  async function publishToggle() {
    const btn = root.querySelector('#fbPublish');
    btn.disabled = true;
    const next = S.form.status === 'published' ? 'draft' : 'published';
    S.form.status = next;
    btn.textContent = next === 'published' ? 'publicando…' : 'despublicando…';
    if (S.dirty) await save({ silent: true });
    else {
      const { error } = await Forms.setFormStatus(S.form.id, next);
      if (error) {
        S.form.status = next === 'published' ? 'draft' : 'published';
        toastError('Erro: ' + error.message);
        btn.disabled = false;
        btn.textContent = S.form.status === 'published' ? 'Despublicar' : 'Publicar';
        return;
      }
    }
    btn.disabled = false;
    btn.textContent = next === 'published' ? 'Despublicar' : 'Publicar';
    updateStatusPill();
    if (next === 'published') {
      openShareModal();
    } else {
      toastSuccess('Despublicado.');
    }
    if (S.selected === 'form') renderInspector();
  }

  async function openShareModal() {
    const url = formPublicUrl(S.form.slug);
    document.querySelectorAll('.fb-share-modal').forEach((el) => el.remove());
    const overlay = document.createElement('div');
    overlay.className = 'fb-share-modal';
    overlay.innerHTML = `
      <div class="fb-share-modal__box" role="dialog" aria-labelledby="fbShareTitle">
        <header class="fb-share-modal__head">
          <div>
            <p class="fb-share-modal__crumb">publicado · pronto pra compartilhar</p>
            <h2 id="fbShareTitle">${esc(S.form.title)}</h2>
          </div>
          <button class="admin-link-btn" data-act="close" aria-label="Fechar">${icon('x', { size: 14 })}</button>
        </header>
        <div class="fb-share-modal__body">
          <div class="fb-share-url">
            <input class="adm-input" id="fbShareUrl" readonly value="${attr(url)}" />
            <button class="btn btn--primary btn--small" data-act="copy">${icon('external', { size: 12 })} Copiar</button>
          </div>
          <div class="fb-share-actions">
            <a class="btn btn--ghost btn--small" data-act="open" target="_blank" rel="noopener" href="${attr(url)}">Abrir formulário</a>
            <a class="btn btn--ghost btn--small" data-act="wa" target="_blank" rel="noopener"
               href="https://wa.me/?text=${encodeURIComponent('Respondam aqui: ' + url)}">Compartilhar no WhatsApp</a>
            <button class="btn btn--ghost btn--small" data-act="share-native" ${navigator.share ? '' : 'hidden'}>Compartilhar (nativo)</button>
          </div>
          <div class="fb-share-qr" id="fbShareQr">
            <div class="fb-share-qr__placeholder">gerando QR…</div>
          </div>
          <p class="fb-share-modal__hint">Imprima o QR num cartaz ou compartilhe a imagem. Funciona offline.</p>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-open'));

    const close = () => {
      overlay.classList.remove('is-open');
      setTimeout(() => overlay.remove(), 200);
      document.removeEventListener('keydown', onKey);
    };
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);

    overlay.addEventListener('click', async (ev) => {
      if (ev.target === overlay) return close();
      const act = ev.target.closest('[data-act]')?.dataset?.act;
      if (act === 'close') return close();
      if (act === 'copy') {
        try { await navigator.clipboard.writeText(url); toastSuccess('Link copiado!'); }
        catch { prompt('Copie o link:', url); }
      }
      if (act === 'share-native' && navigator.share) {
        try {
          await navigator.share({ title: S.form.title, text: 'Respondam aqui: ', url });
        } catch (e) { if (e?.name !== 'AbortError') toastError('Não foi possível compartilhar.'); }
      }
    });

    try {
      const { default: QRCode } = await import('https://esm.sh/qrcode-svg@1.1.0');
      const qr = new QRCode({
        content: url, padding: 2, width: 240, height: 240,
        color: '#1B0810', background: '#F4E5C2', ecl: 'M', join: true,
      });
      const svg = qr.svg();
      const box = overlay.querySelector('#fbShareQr');
      if (box) {
        box.innerHTML = `${svg}
          <button class="btn btn--ghost btn--small" data-act-qr="download">${icon('external', { size: 12 })} Baixar QR (SVG)</button>`;
        box.querySelector('[data-act-qr="download"]').onclick = () => {
          const blob = new Blob([svg], { type: 'image/svg+xml' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `${S.form.slug}-qr.svg`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        };
      }
    } catch (e) {
      const box = overlay.querySelector('#fbShareQr');
      if (box) box.innerHTML = `<p class="muted">Não foi possível gerar o QR agora.</p>`;
    }
  }
  function maybeLeave(go) {
    if (!S.dirty || confirm('Você tem alterações não salvas. Sair mesmo assim?')) go();
  }

  // ---------- CANVAS ----------
  function renderCanvas() {
    const c = root.querySelector('#fbCanvas');
    const pages = S.form.schema.pages;
    const tabs = (S.form.settings.multiStep && pages.length > 1)
      ? `<div class="fb-pages">${pages.map((p, i) => `
          <button class="fb-page-tab ${i === S.pageIdx ? 'is-on' : ''}" data-page="${i}">Etapa ${i + 1}</button>`).join('')}
          <button class="fb-page-tab add" id="fbAddPage">+ etapa</button></div>`
      : (S.form.settings.multiStep ? `<div class="fb-pages"><button class="fb-page-tab add" id="fbAddPage">+ etapa</button></div>` : '');

    const page = curPage();
    const fields = page.fields;
    c.innerHTML = `
      ${tabs}
      <div class="fb-canvas-head">
        <button class="fb-form-settings ${S.selected === 'form' ? 'is-on' : ''}" id="fbFormBtn">${icon('edit', { size: 12 })} Configurações do formulário</button>
      </div>
      <div class="fb-fields" id="fbFields">
        ${fields.length ? fields.map((f, i) => fieldCardHtml(f, i, fields.length)).join('')
          : `<div class="fb-empty">
              <div class="fb-empty__title">Nenhum campo ainda.</div>
              <div class="fb-empty__sub">Clique em <strong>+ Adicionar campo</strong> abaixo, ou digite <kbd>/</kbd> em qualquer lugar.</div>
            </div>`}
      </div>
      <div class="fb-add-row">
        <button class="fb-add-btn" id="fbAddBtn">${icon('plus', { size: 14 })} Adicionar campo</button>
        <span class="fb-add-hint">ou <kbd>/</kbd></span>
      </div>`;

    c.querySelector('#fbFormBtn').onclick = () => { S.selected = 'form'; S.formTab = 'geral'; renderCanvas(); renderInspector(); };
    c.querySelector('#fbAddBtn').onclick = () => openQuickAdd();
    if (c.querySelector('#fbAddPage')) c.querySelector('#fbAddPage').onclick = () => {
      pages.push({ id: 'p' + (pages.length + 1) + Date.now().toString(36), title: '', fields: [] });
      S.pageIdx = pages.length - 1; markDirty(); renderCanvas();
    };
    c.querySelectorAll('.fb-page-tab[data-page]').forEach((t) => {
      t.onclick = () => { S.pageIdx = +t.dataset.page; renderCanvas(); };
    });
    c.querySelectorAll('.fb-field').forEach((card) => {
      const id = card.dataset.id;
      card.querySelector('.fb-field__body').onclick = () => { S.selected = id; S.fieldTab = 'basico'; renderCanvas(); renderInspector(); };
      card.querySelector('[data-act="up"]').onclick = (e) => { e.stopPropagation(); move(id, -1); };
      card.querySelector('[data-act="down"]').onclick = (e) => { e.stopPropagation(); move(id, 1); };
      card.querySelector('[data-act="dup"]').onclick = (e) => { e.stopPropagation(); duplicateField(id); };
      card.querySelector('[data-act="del"]').onclick = (e) => {
        e.stopPropagation();
        const loc = findField(id); if (!loc) return;
        loc.page.fields.splice(loc.idx, 1);
        if (S.selected === id) S.selected = 'form';
        markDirty(); renderCanvas(); renderInspector();
      };
      // arrastar-soltar pra reordenar
      card.setAttribute('draggable', 'true');
      card.addEventListener('dragstart', (e) => { dragId = id; card.classList.add('fb-drag'); e.dataTransfer.effectAllowed = 'move'; });
      card.addEventListener('dragend', () => { dragId = null; c.querySelectorAll('.fb-field').forEach((x) => x.classList.remove('fb-drag', 'fb-over')); });
      card.addEventListener('dragover', (e) => { if (dragId && dragId !== id) { e.preventDefault(); card.classList.add('fb-over'); } });
      card.addEventListener('dragleave', () => card.classList.remove('fb-over'));
      card.addEventListener('drop', (e) => {
        e.preventDefault(); card.classList.remove('fb-over');
        if (!dragId || dragId === id) return;
        const arr = curPage().fields;
        const from = arr.findIndex((f) => f.id === dragId);
        if (from < 0) return;
        const before = (e.clientY - card.getBoundingClientRect().top) < card.offsetHeight / 2;
        const [moved] = arr.splice(from, 1);
        let to = arr.findIndex((f) => f.id === id);
        if (!before) to += 1;
        arr.splice(to, 0, moved);
        markDirty(); renderCanvas();
      });
    });
  }

  function move(id, dir) {
    const loc = findField(id); if (!loc) return;
    const arr = loc.page.fields; const j = loc.idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[loc.idx], arr[j]] = [arr[j], arr[loc.idx]];
    markDirty(); renderCanvas();
  }

  function fieldCardHtml(f, i, total) {
    const def = FIELD_TYPE_MAP[f.type];
    const sel = S.selected === f.id ? 'is-selected' : '';
    const reqd = f.required ? '<span class="fb-req">obrigatório</span>' : '';
    const sub = isStaticField(f.type) ? '<em>bloco de layout</em>' : esc(def?.label || f.type);
    return `
      <div class="fb-field ${sel}" data-id="${f.id}">
        <div class="fb-field__body">
          <span class="fb-field__ico">${icon(def?.icon || 'edit', { size: 14 })}</span>
          <div class="fb-field__txt">
            <strong>${esc(f.label || '(sem rótulo)')}</strong>
            <small>${sub} ${reqd}</small>
          </div>
        </div>
        <div class="fb-field__ops">
          <button class="admin-link-btn" data-act="up" ${i === 0 ? 'disabled' : ''} title="Subir">${icon('arrow-up', { size: 12 })}</button>
          <button class="admin-link-btn" data-act="down" ${i === total - 1 ? 'disabled' : ''} title="Descer">${icon('arrow-down', { size: 12 })}</button>
          <button class="admin-link-btn" data-act="dup" title="Duplicar (Ctrl+Shift+D)">${icon('copy', { size: 12 })}</button>
          <button class="admin-link-btn danger" data-act="del" title="Remover">${icon('trash', { size: 12 })}</button>
        </div>
      </div>`;
  }

  // ===== Quick-add popup (/ trigger ou botão "+ Adicionar campo") =====
  function openQuickAdd() {
    document.querySelectorAll('.fb-quickadd').forEach((el) => el.remove());
    const overlay = document.createElement('div');
    overlay.className = 'fb-quickadd';
    overlay.innerHTML = `
      <div class="fb-quickadd__box" role="dialog">
        <input class="fb-quickadd__search" id="qaSearch" type="text" placeholder="adicionar campo: digite pra buscar (escape pra fechar)" autocomplete="off" />
        <div class="fb-quickadd__list" id="qaList"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-open'));
    const search = overlay.querySelector('#qaSearch');
    const list = overlay.querySelector('#qaList');

    let cursor = 0;
    let filtered = FIELD_TYPES.slice();

    const close = () => {
      overlay.classList.remove('is-open');
      setTimeout(() => overlay.remove(), 150);
      document.removeEventListener('keydown', onQaKey, true);
    };

    function normalize(s) {
      return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    }

    function render() {
      list.innerHTML = filtered.map((t, i) => `
        <button class="fb-quickadd__item ${i === cursor ? 'is-cur' : ''}" data-type="${t.type}" type="button">
          <span class="fb-quickadd__ico">${icon(t.icon, { size: 14 })}</span>
          <span class="fb-quickadd__lbl">${esc(t.label)}</span>
          <span class="fb-quickadd__cat">${esc(t.category)}</span>
        </button>
      `).join('') || `<p class="fb-quickadd__empty">nenhum tipo combina.</p>`;
      const cur = list.querySelector('.fb-quickadd__item.is-cur');
      if (cur) cur.scrollIntoView({ block: 'nearest' });
    }

    function pick(type) { addField(type); close(); }

    search.addEventListener('input', () => {
      const q = normalize(search.value.trim());
      filtered = q ? FIELD_TYPES.filter((t) =>
        normalize(t.label).includes(q) || normalize(t.type).includes(q) || normalize(t.category).includes(q)
      ) : FIELD_TYPES.slice();
      cursor = 0;
      render();
    });

    function onQaKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); cursor = Math.min(cursor + 1, filtered.length - 1); render(); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); cursor = Math.max(cursor - 1, 0); render(); return; }
      if (e.key === 'Enter') { e.preventDefault(); if (filtered[cursor]) pick(filtered[cursor].type); return; }
    }
    document.addEventListener('keydown', onQaKey, true);

    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) return close();
      const btn = ev.target.closest('[data-type]');
      if (btn) pick(btn.dataset.type);
    });

    render();
    setTimeout(() => search.focus(), 50);
  }

  function duplicateField(id) {
    const loc = findField(id);
    if (!loc) return;
    const f = loc.field;
    const clone = JSON.parse(JSON.stringify(f));
    clone.id = `${f.type}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`;
    clone.key = clone.id;
    if (clone.label) clone.label = `${clone.label} (cópia)`;
    loc.page.fields.splice(loc.idx + 1, 0, clone);
    S.selected = clone.id;
    S.fieldTab = 'basico';
    markDirty();
    renderCanvas();
    renderInspector();
  }

  // ---------- INSPECTOR ----------
  function renderInspector() {
    const ins = root.querySelector('#fbInspector');
    if (S.selected === 'form') {
      ins.innerHTML = formInspectorHtml();
      bindFormTabs(ins);
      bindFormSettings(ins);
      return;
    }
    const loc = findField(S.selected);
    if (!loc) {
      ins.innerHTML = `<div class="fb-insp-empty">
        <p>Nada selecionado.</p>
        <p>Clique num campo para editar, ou em <strong>Configurações do formulário</strong>.</p>
      </div>`;
      return;
    }
    ins.innerHTML = fieldInspectorHtml(loc.field);
    bindFieldTabs(ins, loc.field);
    bindFieldConfig(ins, loc.field);
  }

  // ---- FORM INSPECTOR (com tabs) ----
  function formInspectorHtml() {
    const f = S.form;
    const s = f.settings;
    const tab = S.formTab;
    const tabsHtml = `<nav class="fb-tabs" role="tablist">${FORM_TABS.map((t) => `
      <button class="fb-tab ${t.id === tab ? 'is-on' : ''}" data-tab="${t.id}" role="tab">${esc(t.label)}</button>`).join('')}</nav>`;

    let body = '';
    if (tab === 'geral') {
      body = `
        ${row('Título', `<input class="adm-input" id="s_title" value="${attr(f.title)}">`)}
        ${row('Descrição', `<textarea class="adm-input" id="s_desc" rows="3" placeholder="aparece logo abaixo do título do formulário">${esc(f.description)}</textarea>`)}
        ${row('Texto do botão enviar', `<input class="adm-input" id="s_submit" value="${attr(s.submitLabel || 'Enviar')}">`)}
        ${row('Link curto (slug)', `<input class="adm-input" id="s_slug" value="${attr(f.slug)}">
          <small class="fb-hint">só letras minúsculas, números e hífen — é o que aparece na URL</small>`)}`;
    } else if (tab === 'visual') {
      body = `
        ${row('Colunas', `<select class="adm-input" id="s_cols">
          <option value="1" ${s.layoutColumns===1?'selected':''}>1 coluna (recomendado)</option>
          <option value="2" ${s.layoutColumns===2?'selected':''}>2 colunas</option>
        </select>`)}
        ${row('Cor de destaque', `<input type="color" class="adm-color" id="s_accent" value="${attr(s.theme?.accent || '#4A5C36')}">`)}
        ${check('s_flora', 'Flores secas no fundo', s.showFlora)}
        ${row('Imagem de capa (URL)', `<input class="adm-input" id="s_cover" placeholder="https://… (opcional)" value="${attr(s.coverImage || '')}">`)}`;
    } else if (tab === 'acesso') {
      body = `
        ${row('Status', `<select class="adm-input" id="s_status">
          ${['draft','published','closed','archived'].map((v) => `<option value="${v}" ${f.status === v ? 'selected' : ''}>${({draft:'Rascunho',published:'Publicado',closed:'Fechado',archived:'Arquivado'})[v]}</option>`).join('')}
        </select>`)}
        ${check('s_listed', 'Listar publicamente (desmarcado = só por link)', f.is_listed)}
        <hr class="fb-hr">
        ${row('Abre em', `<input type="datetime-local" class="adm-input" id="s_opens" value="${toLocalInput(f.opens_at)}">`)}
        ${row('Fecha em', `<input type="datetime-local" class="adm-input" id="s_closes" value="${toLocalInput(f.closes_at)}">`)}
        ${row('Limite de respostas', `<input type="number" min="1" class="adm-input" id="s_max" placeholder="sem limite" value="${f.max_responses ?? ''}">`)}`;
    } else if (tab === 'pos') {
      body = `
        ${row('Mensagem de sucesso', `<textarea class="adm-input" id="s_success" rows="3">${esc(s.successMessage || '')}</textarea>`)}
        ${row('Ou redirecionar para (URL)', `<input class="adm-input" id="s_redirect" placeholder="https://… (opcional — se preenchido, ignora a mensagem)" value="${attr(s.redirectUrl || '')}">`)}`;
    } else if (tab === 'avancado') {
      body = `
        <h4 class="fb-insp-sub">Multi-etapas</h4>
        ${check('s_multi', 'Dividir em etapas (multi-página)', s.multiStep)}
        ${check('s_prog', 'Mostrar barra de progresso', s.showProgress)}
        ${check('s_intro', 'Tela de introdução antes de começar', s.introScreen?.enabled)}
        <hr class="fb-hr">
        <h4 class="fb-insp-sub">Anti-spam & LGPD</h4>
        ${check('s_honey', 'Honeypot (anti-bot oculto)', s.honeypot)}
        ${check('s_captcha', 'Captcha (fase 2)', s.captcha)}
        ${check('s_meta', 'Guardar IP/navegador na resposta', s.captureMeta)}
        ${row('Texto de consentimento LGPD', `<textarea class="adm-input" id="s_consent" rows="3" placeholder="texto curto que aparece junto do envio">${esc(s.consentText || '')}</textarea>`)}`;
    }

    return `
      <h3 class="fb-insp-title">Configurações do formulário</h3>
      ${tabsHtml}
      <div class="fb-tab-body">${body}</div>`;
  }

  function bindFormTabs(ins) {
    ins.querySelectorAll('.fb-tab').forEach((t) => {
      t.onclick = () => { S.formTab = t.dataset.tab; renderInspector(); };
    });
  }

  function bindFormSettings(ins) {
    const f = S.form; const s = f.settings;
    const on = (id, ev, fn) => { const el = ins.querySelector('#' + id); if (el) el.addEventListener(ev, fn); };
    on('s_title', 'input', (e) => { f.title = e.target.value; root.querySelector('#fbTitle').textContent = e.target.value; markDirty(); });
    on('s_slug', 'change', (e) => { f.slug = Forms.slugify(e.target.value); e.target.value = f.slug; markDirty(); });
    on('s_desc', 'input', (e) => { f.description = e.target.value; markDirty(); });
    on('s_status', 'change', (e) => { f.status = e.target.value; markDirty(); updateStatusPill(); });
    on('s_listed', 'change', (e) => { f.is_listed = e.target.checked; markDirty(); });
    on('s_opens', 'change', (e) => { f.opens_at = fromLocalInput(e.target.value); markDirty(); });
    on('s_closes', 'change', (e) => { f.closes_at = fromLocalInput(e.target.value); markDirty(); });
    on('s_max', 'input', (e) => { f.max_responses = e.target.value ? +e.target.value : null; markDirty(); });
    on('s_cols', 'change', (e) => { s.layoutColumns = +e.target.value; markDirty(); });
    on('s_accent', 'input', (e) => { s.theme = { ...(s.theme||{}), accent: e.target.value }; markDirty(); });
    on('s_flora', 'change', (e) => { s.showFlora = e.target.checked; markDirty(); });
    on('s_cover', 'input', (e) => { s.coverImage = e.target.value; markDirty(); });
    on('s_multi', 'change', (e) => { s.multiStep = e.target.checked; markDirty(); renderCanvas(); });
    on('s_prog', 'change', (e) => { s.showProgress = e.target.checked; markDirty(); });
    on('s_intro', 'change', (e) => { s.introScreen = { ...(s.introScreen||{}), enabled: e.target.checked }; markDirty(); });
    on('s_submit', 'input', (e) => { s.submitLabel = e.target.value; markDirty(); });
    on('s_success', 'input', (e) => { s.successMessage = e.target.value; markDirty(); });
    on('s_redirect', 'input', (e) => { s.redirectUrl = e.target.value; markDirty(); });
    on('s_honey', 'change', (e) => { s.honeypot = e.target.checked; markDirty(); });
    on('s_captcha', 'change', (e) => { s.captcha = e.target.checked; markDirty(); });
    on('s_meta', 'change', (e) => { s.captureMeta = e.target.checked; markDirty(); });
    on('s_consent', 'input', (e) => { s.consentText = e.target.value; markDirty(); });
  }

  function updateStatusPill() {
    const el = root.querySelector('#fbStatus');
    el.textContent = ({ published: 'Publicado', draft: 'Rascunho', closed: 'Fechado', archived: 'Arquivado' })[S.form.status] || 'Rascunho';
    el.className = 'form-status ' + (S.form.status === 'published' ? 'is-published' : 'is-draft');
    const btn = root.querySelector('#fbPublish');
    if (btn) btn.textContent = S.form.status === 'published' ? 'Despublicar' : 'Publicar';
  }

  // ---- FIELD INSPECTOR (com tabs) ----
  function fieldInspectorHtml(f) {
    const caps = fieldCaps(f.type);
    const def = FIELD_TYPE_MAP[f.type];
    const tab = S.fieldTab;
    const showLogic = !caps.staticBlock;
    const showAdvanced = !caps.staticBlock || caps.staticBlock; // sempre mostra (largura/conteúdo)
    const tabs = FIELD_TABS.filter((t) => {
      if (t.id === 'logica') return showLogic;
      return true;
    });
    const tabsHtml = `<nav class="fb-tabs" role="tablist">${tabs.map((t) => `
      <button class="fb-tab ${t.id === tab ? 'is-on' : ''}" data-tab="${t.id}" role="tab">${esc(t.label)}</button>`).join('')}</nav>`;

    let body = '';
    if (tab === 'basico') {
      body = fieldBasicHtml(f, caps);
    } else if (tab === 'avancado') {
      body = fieldAdvancedHtml(f, caps);
    } else if (tab === 'logica') {
      body = logicHtml(f);
    }

    return `
      <h3 class="fb-insp-title">${icon(def?.icon || 'edit', { size: 14 })} ${esc(def?.label || f.type)}</h3>
      ${tabsHtml}
      <div class="fb-tab-body">${body}</div>`;
  }

  function bindFieldTabs(ins, f) {
    ins.querySelectorAll('.fb-tab').forEach((t) => {
      t.onclick = () => { S.fieldTab = t.dataset.tab; renderInspector(); };
    });
  }

  function fieldBasicHtml(f, caps) {
    let html = '';
    // bloco estático: heading/paragraph/image/divider
    if (caps.staticBlock) {
      if (f.type === 'image') {
        html += row('URL da imagem', `<input class="adm-input" id="c_img" placeholder="https://…" value="${attr(f.imageUrl)}">`);
      } else if (f.type !== 'divider') {
        html += row(f.type === 'heading' ? 'Texto do título' : 'Texto', `<textarea class="adm-input" id="c_content" rows="${f.type==='heading'?1:4}">${esc(f.content)}</textarea>`);
      } else {
        html += `<p class="fb-insp-empty">Divisória — sem configurações básicas. Ajuste a largura na aba <strong>Avançado</strong>.</p>`;
      }
      return html;
    }

    html += row('Rótulo (pergunta)', `<input class="adm-input" id="c_label" placeholder="Ex.: Seu nome" value="${attr(f.label)}">`);
    html += row('Texto de ajuda', `<textarea class="adm-input" id="c_desc" rows="2" placeholder="aparece em letra menor abaixo da pergunta (opcional)">${esc(f.description)}</textarea>`);
    if (caps.placeholder) html += row('Placeholder (dica dentro do campo)', `<input class="adm-input" id="c_ph" value="${attr(f.placeholder)}">`);
    html += check('c_req', 'Obrigatório', f.required);

    // opções inline (radio/checkbox/select/ranking) — essas SEMPRE no básico
    if (caps.options) {
      html += `<hr class="fb-hr"><h4 class="fb-insp-sub">Opções</h4>
        <div id="c_opts" class="fb-opts">${(f.options||[]).map((o, i) => optRow(o, i)).join('')}</div>
        <button class="btn btn--ghost btn--small" id="c_addopt">+ opção</button>`;
    }

    // escala
    if (caps.scale) {
      html += `<hr class="fb-hr"><h4 class="fb-insp-sub">Escala</h4>`;
      html += `<div class="fb-row-2col">
        ${row('De', `<input type="number" class="adm-input" id="c_smin" value="${f.scaleMin}">`)}
        ${row('Até', `<input type="number" class="adm-input" id="c_smax" value="${f.scaleMax}">`)}
      </div>`;
      html += row('Rótulo (início) — opcional', `<input class="adm-input" id="c_slmin" placeholder="ex.: nada provável" value="${attr(f.scaleMinLabel)}">`);
      html += row('Rótulo (fim) — opcional', `<input class="adm-input" id="c_slmax" placeholder="ex.: muito provável" value="${attr(f.scaleMaxLabel)}">`);
    }

    // matriz
    if (caps.matrix) {
      html += `<hr class="fb-hr"><h4 class="fb-insp-sub">Linhas</h4>
        <div id="c_rows" class="fb-opts">${(f.matrixRows||[]).map((o,i)=>optRow(o,i,'row')).join('')}</div>
        <button class="btn btn--ghost btn--small" id="c_addrow">+ linha</button>
        <h4 class="fb-insp-sub">Colunas</h4>
        <div id="c_cols" class="fb-opts">${(f.matrixCols||[]).map((o,i)=>optRow(o,i,'col')).join('')}</div>
        <button class="btn btn--ghost btn--small" id="c_addcol">+ coluna</button>`;
    }

    return html;
  }

  function fieldAdvancedHtml(f, caps) {
    const v = f.validation || {};
    let html = '';

    html += row('Largura', widthSelect(f));
    if (caps.staticBlock) return html;

    html += check('c_ro', 'Somente leitura', f.readonly);
    html += row('Pré-preencher via URL (?param=)', `<input class="adm-input" id="c_prefill" placeholder="ex.: nome" value="${attr(f.prefillParam)}">
      <small class="fb-hint">passa <code>?nome=Maria</code> na URL pra preencher esse campo</small>`);

    // limites de opções
    if (caps.allowOther) html += check('c_other', 'Permitir opção "Outro"', f.allowOther);
    if (caps.choiceLimits) {
      html += `<div class="fb-row-2col">
        ${row('Mín. seleções', `<input type="number" min="0" class="adm-input" id="c_minsel" value="${f.minSelections ?? ''}">`)}
        ${row('Máx. seleções', `<input type="number" min="1" class="adm-input" id="c_maxsel" value="${f.maxSelections ?? ''}">`)}
      </div>`;
    }

    // matriz: múltipla por linha
    if (caps.matrix) html += check('c_mmult', 'Múltipla escolha por linha', f.matrixMultiple);

    // anexo
    if (caps.attachment) {
      html += `<hr class="fb-hr"><h4 class="fb-insp-sub">Anexo</h4>`;
      html += `<div class="fb-row-2col">
        ${row('Tamanho máx (MB)', `<input type="number" min="1" class="adm-input" id="c_fmb" value="${f.fileMaxMb}">`)}
        ${row('Qtd. máx de arquivos', `<input type="number" min="1" class="adm-input" id="c_fcount" value="${f.fileMaxCount}">`)}
      </div>`;
      html += row('Tipos aceitos', `<input class="adm-input" id="c_faccept" placeholder=".pdf,image/*" value="${attr(f.fileAccept)}">`);
    }

    // validação
    if (caps.length || caps.numeric || caps.dateRange) {
      html += `<hr class="fb-hr"><h4 class="fb-insp-sub">Validação</h4>`;
      if (caps.length) {
        html += `<div class="fb-row-2col">
          ${row('Mín. caracteres', `<input type="number" min="0" class="adm-input" id="v_minlen" value="${v.minLen ?? ''}">`)}
          ${row('Máx. caracteres', `<input type="number" min="0" class="adm-input" id="v_maxlen" value="${v.maxLen ?? ''}">`)}
        </div>`;
      }
      if (caps.numeric) {
        html += `<div class="fb-row-2col">
          ${row('Valor mínimo', `<input type="number" class="adm-input" id="v_min" value="${v.min ?? ''}">`)}
          ${row('Valor máximo', `<input type="number" class="adm-input" id="v_max" value="${v.max ?? ''}">`)}
        </div>`;
        html += row('Passo (step)', `<input type="number" class="adm-input" id="v_step" value="${v.step ?? 1}">`);
      }
      if (caps.dateRange) {
        html += `<div class="fb-row-2col">
          ${row('Data mínima', `<input type="date" class="adm-input" id="v_mind" value="${v.minDate ?? ''}">`)}
          ${row('Data máxima', `<input type="date" class="adm-input" id="v_maxd" value="${v.maxDate ?? ''}">`)}
        </div>`;
      }
    }

    html += `<hr class="fb-hr"><h4 class="fb-insp-sub">Padrão personalizado</h4>`;
    html += row('Regex de validação', `<input class="adm-input" id="v_pat" placeholder="ex.: ^[0-9]{11}$" value="${attr(v.pattern)}">`);
    html += row('Mensagem de erro', `<input class="adm-input" id="v_err" placeholder="Aparece quando o valor não casa" value="${attr(v.errorMessage)}">`);

    return html;
  }

  function widthSelect(f) {
    return `<select class="adm-input" id="c_width">
      <option value="full" ${f.width==='full'?'selected':''}>Inteira (1 linha)</option>
      <option value="half" ${f.width==='half'?'selected':''}>Metade (lado a lado)</option>
    </select>`;
  }
  function optRow(val, i, kind) {
    return `<div class="fb-opt" data-i="${i}" data-kind="${kind || 'opt'}">
      <input class="adm-input" value="${attr(val)}">
      <button class="admin-link-btn danger" data-del>${icon('x', { size: 12 })}</button></div>`;
  }
  function logicHtml(f) {
    const others = [];
    for (const p of S.form.schema.pages) for (const o of p.fields) {
      if (o.id !== f.id && !isStaticField(o.type)) others.push(o);
    }
    const lg = f.logic || { action: 'show', match: 'all', rules: [] };
    if (!others.length) {
      return `<p class="fb-insp-empty">Adicione outros campos primeiro pra criar regras de "mostrar/ocultar este campo se…".</p>`;
    }
    return `
      <p class="fb-hint">Defina quando este campo aparece (ou some) dependendo das respostas em outros campos.</p>
      ${row('Ação', `<select class="adm-input" id="l_action">
        <option value="show" ${lg.action==='show'?'selected':''}>Mostrar se</option>
        <option value="hide" ${lg.action==='hide'?'selected':''}>Ocultar se</option>
      </select>`)}
      ${row('Combinar', `<select class="adm-input" id="l_match">
        <option value="all" ${lg.match==='all'?'selected':''}>Todas as regras</option>
        <option value="any" ${lg.match==='any'?'selected':''}>Qualquer regra</option>
      </select>`)}
      <div id="l_rules" class="fb-rules">${(lg.rules||[]).map((r,i)=>ruleRow(r,i,others)).join('')}</div>
      <button class="btn btn--ghost btn--small" id="l_add">+ regra</button>`;
  }
  function ruleRow(r, i, others) {
    return `<div class="fb-rule" data-i="${i}">
      <select class="adm-input l_field">${others.map((o)=>`<option value="${o.key}" ${r.field===o.key?'selected':''}>${esc(o.label)}</option>`).join('')}</select>
      <select class="adm-input l_op">
        ${[['eq','é igual a'],['ne','é diferente de'],['contains','contém'],['filled','está preenchido'],['empty','está vazio']].map(([v,t])=>`<option value="${v}" ${r.op===v?'selected':''}>${t}</option>`).join('')}
      </select>
      <input class="adm-input l_val" value="${attr(r.value)}" placeholder="valor">
      <button class="admin-link-btn danger" data-delrule>${icon('x',{size:12})}</button></div>`;
  }

  function bindFieldConfig(ins, f) {
    const caps = fieldCaps(f.type);
    const on = (id, ev, fn) => { const el = ins.querySelector('#' + id); if (el) el.addEventListener(ev, fn); };
    const v = f.validation;
    // estático
    on('c_img', 'input', (e) => { f.imageUrl = e.target.value; markDirty(); });
    on('c_content', 'input', (e) => { f.content = e.target.value; markDirty(); });
    // base
    on('c_label', 'input', (e) => { f.label = e.target.value; markDirty(); });
    on('c_label', 'change', renderCanvas);
    on('c_desc', 'input', (e) => { f.description = e.target.value; markDirty(); });
    on('c_ph', 'input', (e) => { f.placeholder = e.target.value; markDirty(); });
    on('c_req', 'change', (e) => { f.required = e.target.checked; markDirty(); renderCanvas(); });
    on('c_ro', 'change', (e) => { f.readonly = e.target.checked; markDirty(); });
    on('c_width', 'change', (e) => { f.width = e.target.value; markDirty(); });
    on('c_prefill', 'input', (e) => { f.prefillParam = e.target.value; markDirty(); });
    // opções
    if (caps.options) {
      bindOptList(ins, '#c_opts', f.options, () => { renderInspector(); });
      on('c_addopt', 'click', () => { f.options.push('Nova opção'); markDirty(); renderInspector(); });
      on('c_other', 'change', (e) => { f.allowOther = e.target.checked; markDirty(); });
      on('c_minsel', 'input', (e) => { f.minSelections = e.target.value ? +e.target.value : null; markDirty(); });
      on('c_maxsel', 'input', (e) => { f.maxSelections = e.target.value ? +e.target.value : null; markDirty(); });
    }
    // escala
    on('c_smin', 'input', (e) => { f.scaleMin = +e.target.value; markDirty(); });
    on('c_smax', 'input', (e) => { f.scaleMax = +e.target.value; markDirty(); });
    on('c_slmin', 'input', (e) => { f.scaleMinLabel = e.target.value; markDirty(); });
    on('c_slmax', 'input', (e) => { f.scaleMaxLabel = e.target.value; markDirty(); });
    // matriz
    if (caps.matrix) {
      bindOptList(ins, '#c_rows', f.matrixRows, () => renderInspector());
      bindOptList(ins, '#c_cols', f.matrixCols, () => renderInspector());
      on('c_addrow', 'click', () => { f.matrixRows.push('Nova linha'); markDirty(); renderInspector(); });
      on('c_addcol', 'click', () => { f.matrixCols.push('Nova coluna'); markDirty(); renderInspector(); });
      on('c_mmult', 'change', (e) => { f.matrixMultiple = e.target.checked; markDirty(); });
    }
    // anexo
    on('c_fmb', 'input', (e) => { f.fileMaxMb = +e.target.value || 1; markDirty(); });
    on('c_fcount', 'input', (e) => { f.fileMaxCount = +e.target.value || 1; markDirty(); });
    on('c_faccept', 'input', (e) => { f.fileAccept = e.target.value; markDirty(); });
    // validação
    on('v_minlen', 'input', (e) => { v.minLen = e.target.value ? +e.target.value : null; markDirty(); });
    on('v_maxlen', 'input', (e) => { v.maxLen = e.target.value ? +e.target.value : null; markDirty(); });
    on('v_min', 'input', (e) => { v.min = e.target.value ? +e.target.value : null; markDirty(); });
    on('v_max', 'input', (e) => { v.max = e.target.value ? +e.target.value : null; markDirty(); });
    on('v_step', 'input', (e) => { v.step = e.target.value ? +e.target.value : 1; markDirty(); });
    on('v_mind', 'change', (e) => { v.minDate = e.target.value || null; markDirty(); });
    on('v_maxd', 'change', (e) => { v.maxDate = e.target.value || null; markDirty(); });
    on('v_pat', 'input', (e) => { v.pattern = e.target.value; markDirty(); });
    on('v_err', 'input', (e) => { v.errorMessage = e.target.value; markDirty(); });
    // lógica
    on('l_action', 'change', (e) => { f.logic.action = e.target.value; markDirty(); });
    on('l_match', 'change', (e) => { f.logic.match = e.target.value; markDirty(); });
    on('l_add', 'click', () => { f.logic.rules.push({ field: '', op: 'eq', value: '' }); markDirty(); renderInspector(); });
    ins.querySelectorAll('.fb-rule').forEach((rw) => {
      const i = +rw.dataset.i;
      rw.querySelector('.l_field').onchange = (e) => { f.logic.rules[i].field = e.target.value; markDirty(); };
      rw.querySelector('.l_op').onchange = (e) => { f.logic.rules[i].op = e.target.value; markDirty(); };
      rw.querySelector('.l_val').oninput = (e) => { f.logic.rules[i].value = e.target.value; markDirty(); };
      rw.querySelector('[data-delrule]').onclick = () => { f.logic.rules.splice(i, 1); markDirty(); renderInspector(); };
    });
  }

  // edita uma lista de strings (opções/linhas/colunas) in-place
  function bindOptList(ins, sel, arr, onStructural) {
    const box = ins.querySelector(sel); if (!box) return;
    box.querySelectorAll('.fb-opt').forEach((rw) => {
      const i = +rw.dataset.i;
      rw.querySelector('input').oninput = (e) => { arr[i] = e.target.value; markDirty(); };
      rw.querySelector('[data-del]').onclick = () => { arr.splice(i, 1); markDirty(); onStructural(); };
    });
  }

  // ---------- pequenos helpers de markup ----------
  function row(label, control) {
    return `<label class="fb-row"><span class="fb-row__label">${esc(label)}</span>${control}</label>`;
  }
  function check(id, label, checked) {
    return `<label class="fb-check"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''}><span>${esc(label)}</span></label>`;
  }
}
