// TULIPA · admin · Formulários — construtor (editor de campos + configs).
import * as Forms from '../forms/data.js';
import {
  FIELD_TYPES, FIELD_CATEGORIES, FIELD_TYPE_MAP,
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

  const S = { form, pageIdx: 0, selected: 'form', dirty: false };

  root.innerHTML = `
    <div class="fb">
      <header class="fb__bar">
        <button class="admin-link-btn" id="fbBack">${icon('arrow-left', { size: 14 })} Voltar</button>
        <div class="fb__title"><strong id="fbTitle">${esc(form.title)}</strong>
          <span class="form-status ${form.status === 'published' ? 'is-published' : 'is-draft'}" id="fbStatus">${form.status === 'published' ? 'Publicado' : 'Rascunho'}</span>
        </div>
        <div class="fb__bar-actions">
          <button class="btn btn--ghost btn--small" id="fbLink">${icon('external', { size: 12 })} Link</button>
          <button class="btn btn--primary btn--small" id="fbSave">Salvar</button>
        </div>
      </header>
      <div class="fb__cols">
        <aside class="fb__palette" id="fbPalette"></aside>
        <section class="fb__canvas" id="fbCanvas"></section>
        <aside class="fb__inspector" id="fbInspector"></aside>
      </div>
    </div>`;

  // ----- palette -----
  const pal = root.querySelector('#fbPalette');
  pal.innerHTML = FIELD_CATEGORIES.map((cat) => `
    <div class="fb-pal-cat">
      <h4>${cat.label}</h4>
      <div class="fb-pal-list">
        ${FIELD_TYPES.filter((t) => t.category === cat.id).map((t) => `
          <button class="fb-pal-item" data-type="${t.type}" title="${attr(t.label)}">
            <span class="fb-pal-ico">${icon(t.icon, { size: 14 })}</span>${esc(t.label)}
          </button>`).join('')}
      </div>
    </div>`).join('');
  pal.querySelectorAll('.fb-pal-item').forEach((b) => {
    b.onclick = () => addField(b.dataset.type);
  });

  // ----- header actions -----
  root.querySelector('#fbBack').onclick = () => maybeLeave(() => api.navigate('#/forms'));
  root.querySelector('#fbSave').onclick = save;
  root.querySelector('#fbLink').onclick = async () => {
    if (S.dirty) await save();
    const url = formPublicUrl(S.form.slug);
    try { await navigator.clipboard.writeText(url); toastSuccess('Link copiado!'); }
    catch { prompt('Link público:', url); }
  };

  renderCanvas();
  renderInspector();

  // ---------- helpers ----------
  function curPage() { return S.form.schema.pages[S.pageIdx]; }
  function markDirty() { S.dirty = true; root.querySelector('#fbSave').classList.add('is-dirty'); }

  function addField(type) {
    const f = makeField(type);
    curPage().fields.push(f);
    S.selected = f.id;
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

  async function save() {
    const patch = {
      title: S.form.title, slug: S.form.slug, description: S.form.description,
      status: S.form.status, is_listed: S.form.is_listed,
      schema: S.form.schema, settings: S.form.settings,
      opens_at: S.form.opens_at || null, closes_at: S.form.closes_at || null,
      max_responses: S.form.max_responses || null,
    };
    const { error } = await Forms.updateForm(S.form.id, patch);
    if (error) return toastError('Erro ao salvar: ' + error.message);
    S.dirty = false;
    root.querySelector('#fbSave').classList.remove('is-dirty');
    toastSuccess('Salvo!');
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
          : `<div class="empty-state small">Clique num tipo de campo à esquerda para adicionar.</div>`}
      </div>`;

    c.querySelector('#fbFormBtn').onclick = () => { S.selected = 'form'; renderCanvas(); renderInspector(); };
    if (c.querySelector('#fbAddPage')) c.querySelector('#fbAddPage').onclick = () => {
      pages.push({ id: 'p' + (pages.length + 1) + Date.now().toString(36), title: '', fields: [] });
      S.pageIdx = pages.length - 1; markDirty(); renderCanvas();
    };
    c.querySelectorAll('.fb-page-tab[data-page]').forEach((t) => {
      t.onclick = () => { S.pageIdx = +t.dataset.page; renderCanvas(); };
    });
    c.querySelectorAll('.fb-field').forEach((card) => {
      const id = card.dataset.id;
      card.querySelector('.fb-field__body').onclick = () => { S.selected = id; renderCanvas(); renderInspector(); };
      card.querySelector('[data-act="up"]').onclick = (e) => { e.stopPropagation(); move(id, -1); };
      card.querySelector('[data-act="down"]').onclick = (e) => { e.stopPropagation(); move(id, 1); };
      card.querySelector('[data-act="del"]').onclick = (e) => {
        e.stopPropagation();
        const loc = findField(id); if (!loc) return;
        loc.page.fields.splice(loc.idx, 1);
        if (S.selected === id) S.selected = 'form';
        markDirty(); renderCanvas(); renderInspector();
      };
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
          <button class="admin-link-btn" data-act="up" ${i === 0 ? 'disabled' : ''}>${icon('arrow-up', { size: 12 })}</button>
          <button class="admin-link-btn" data-act="down" ${i === total - 1 ? 'disabled' : ''}>${icon('arrow-down', { size: 12 })}</button>
          <button class="admin-link-btn danger" data-act="del">${icon('trash', { size: 12 })}</button>
        </div>
      </div>`;
  }

  // ---------- INSPECTOR ----------
  function renderInspector() {
    const ins = root.querySelector('#fbInspector');
    if (S.selected === 'form') { ins.innerHTML = formSettingsHtml(); bindFormSettings(ins); return; }
    const loc = findField(S.selected);
    if (!loc) { ins.innerHTML = `<div class="fb-insp-empty">Selecione um campo ou as configurações do formulário.</div>`; return; }
    ins.innerHTML = fieldConfigHtml(loc.field);
    bindFieldConfig(ins, loc.field);
  }

  // ---- FORM SETTINGS ----
  function formSettingsHtml() {
    const f = S.form; const s = f.settings;
    return `
      <h3 class="fb-insp-title">Configurações do formulário</h3>
      ${row('Título', `<input class="adm-input" id="s_title" value="${attr(f.title)}">`)}
      ${row('Link (slug)', `<input class="adm-input" id="s_slug" value="${attr(f.slug)}">`)}
      ${row('Descrição', `<textarea class="adm-input" id="s_desc" rows="2">${esc(f.description)}</textarea>`)}
      <hr class="fb-hr">
      ${row('Status', `<select class="adm-input" id="s_status">
        ${['draft','published','closed','archived'].map((v) => `<option value="${v}" ${f.status === v ? 'selected' : ''}>${({draft:'Rascunho',published:'Publicado',closed:'Fechado',archived:'Arquivado'})[v]}</option>`).join('')}
      </select>`)}
      ${check('s_listed', 'Listar publicamente (desmarcado = só por link)', f.is_listed)}
      <hr class="fb-hr">
      ${row('Abre em', `<input type="datetime-local" class="adm-input" id="s_opens" value="${toLocalInput(f.opens_at)}">`)}
      ${row('Fecha em', `<input type="datetime-local" class="adm-input" id="s_closes" value="${toLocalInput(f.closes_at)}">`)}
      ${row('Limite de respostas', `<input type="number" min="1" class="adm-input" id="s_max" value="${f.max_responses ?? ''}">`)}
      <hr class="fb-hr">
      <h4 class="fb-insp-sub">Aparência</h4>
      ${row('Colunas', `<select class="adm-input" id="s_cols"><option value="1" ${s.layoutColumns===1?'selected':''}>1 coluna</option><option value="2" ${s.layoutColumns===2?'selected':''}>2 colunas</option></select>`)}
      ${row('Cor de destaque', `<input type="color" class="adm-color" id="s_accent" value="${attr(s.theme?.accent || '#4A5C36')}">`)}
      ${check('s_flora', 'Flores secas no fundo', s.showFlora)}
      ${row('Imagem de capa (URL)', `<input class="adm-input" id="s_cover" value="${attr(s.coverImage || '')}">`)}
      <hr class="fb-hr">
      <h4 class="fb-insp-sub">Fluxo</h4>
      ${check('s_multi', 'Multi-etapas (usar etapas)', s.multiStep)}
      ${check('s_prog', 'Mostrar barra de progresso', s.showProgress)}
      ${check('s_intro', 'Tela de introdução', s.introScreen?.enabled)}
      ${row('Texto do botão enviar', `<input class="adm-input" id="s_submit" value="${attr(s.submitLabel || 'Enviar')}">`)}
      <hr class="fb-hr">
      <h4 class="fb-insp-sub">Pós-envio</h4>
      ${row('Mensagem de sucesso', `<textarea class="adm-input" id="s_success" rows="2">${esc(s.successMessage || '')}</textarea>`)}
      ${row('Redirecionar para (URL)', `<input class="adm-input" id="s_redirect" value="${attr(s.redirectUrl || '')}">`)}
      <hr class="fb-hr">
      <h4 class="fb-insp-sub">Anti-spam & LGPD</h4>
      ${check('s_honey', 'Honeypot (anti-bot oculto)', s.honeypot)}
      ${check('s_captcha', 'Captcha (fase 2)', s.captcha)}
      ${check('s_meta', 'Guardar IP/navegador', s.captureMeta)}
      ${row('Texto de consentimento (LGPD)', `<textarea class="adm-input" id="s_consent" rows="2">${esc(s.consentText || '')}</textarea>`)}
    `;
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
    el.textContent = S.form.status === 'published' ? 'Publicado' : 'Rascunho';
    el.className = 'form-status ' + (S.form.status === 'published' ? 'is-published' : 'is-draft');
  }

  // ---- FIELD CONFIG ----
  function fieldConfigHtml(f) {
    const caps = fieldCaps(f.type);
    const def = FIELD_TYPE_MAP[f.type];
    const v = f.validation || {};
    let html = `<h3 class="fb-insp-title">${icon(def?.icon || 'edit', { size: 14 })} ${esc(def?.label || f.type)}</h3>`;

    if (caps.staticBlock) {
      if (f.type === 'image') {
        html += row('URL da imagem', `<input class="adm-input" id="c_img" value="${attr(f.imageUrl)}">`);
      } else if (f.type !== 'divider') {
        html += row(f.type === 'heading' ? 'Texto do título' : 'Texto', `<textarea class="adm-input" id="c_content" rows="${f.type==='heading'?1:3}">${esc(f.content)}</textarea>`);
      } else {
        html += `<p class="fb-insp-empty">Divisória — sem configurações.</p>`;
      }
      html += row('Largura', widthSelect(f));
      return html;
    }

    html += row('Rótulo', `<input class="adm-input" id="c_label" value="${attr(f.label)}">`);
    html += row('Texto de ajuda', `<textarea class="adm-input" id="c_desc" rows="2">${esc(f.description)}</textarea>`);
    if (caps.placeholder) html += row('Placeholder', `<input class="adm-input" id="c_ph" value="${attr(f.placeholder)}">`);
    html += check('c_req', 'Obrigatório', f.required);
    html += check('c_ro', 'Somente leitura', f.readonly);
    html += row('Largura', widthSelect(f));
    html += row('Pré-preencher via URL (?param=)', `<input class="adm-input" id="c_prefill" value="${attr(f.prefillParam)}">`);

    // opções
    if (caps.options) {
      html += `<hr class="fb-hr"><h4 class="fb-insp-sub">Opções</h4>
        <div id="c_opts" class="fb-opts">${(f.options||[]).map((o, i) => optRow(o, i)).join('')}</div>
        <button class="btn btn--ghost btn--small" id="c_addopt">+ opção</button>`;
      if (caps.allowOther) html += check('c_other', 'Permitir "Outro"', f.allowOther);
      if (caps.choiceLimits) {
        html += row('Mín. seleções', `<input type="number" min="0" class="adm-input" id="c_minsel" value="${f.minSelections ?? ''}">`);
        html += row('Máx. seleções', `<input type="number" min="1" class="adm-input" id="c_maxsel" value="${f.maxSelections ?? ''}">`);
      }
    }

    // escala / avaliação
    if (caps.scale) {
      html += `<hr class="fb-hr"><h4 class="fb-insp-sub">Escala</h4>`;
      html += row('De', `<input type="number" class="adm-input" id="c_smin" value="${f.scaleMin}">`);
      html += row('Até', `<input type="number" class="adm-input" id="c_smax" value="${f.scaleMax}">`);
      html += row('Rótulo (início)', `<input class="adm-input" id="c_slmin" value="${attr(f.scaleMinLabel)}">`);
      html += row('Rótulo (fim)', `<input class="adm-input" id="c_slmax" value="${attr(f.scaleMaxLabel)}">`);
    }

    // matriz
    if (caps.matrix) {
      html += `<hr class="fb-hr"><h4 class="fb-insp-sub">Linhas</h4>
        <div id="c_rows" class="fb-opts">${(f.matrixRows||[]).map((o,i)=>optRow(o,i,'row')).join('')}</div>
        <button class="btn btn--ghost btn--small" id="c_addrow">+ linha</button>
        <h4 class="fb-insp-sub">Colunas</h4>
        <div id="c_cols" class="fb-opts">${(f.matrixCols||[]).map((o,i)=>optRow(o,i,'col')).join('')}</div>
        <button class="btn btn--ghost btn--small" id="c_addcol">+ coluna</button>`;
      html += check('c_mmult', 'Múltipla por linha', f.matrixMultiple);
    }

    // anexo
    if (caps.attachment) {
      html += `<hr class="fb-hr"><h4 class="fb-insp-sub">Anexo</h4>`;
      html += row('Tamanho máx (MB)', `<input type="number" min="1" class="adm-input" id="c_fmb" value="${f.fileMaxMb}">`);
      html += row('Qtd. máx de arquivos', `<input type="number" min="1" class="adm-input" id="c_fcount" value="${f.fileMaxCount}">`);
      html += row('Tipos aceitos', `<input class="adm-input" id="c_faccept" placeholder=".pdf,image/*" value="${attr(f.fileAccept)}">`);
    }

    // validação
    if (caps.length || caps.numeric || caps.dateRange) {
      html += `<hr class="fb-hr"><h4 class="fb-insp-sub">Validação</h4>`;
      if (caps.length) {
        html += row('Mín. caracteres', `<input type="number" min="0" class="adm-input" id="v_minlen" value="${v.minLen ?? ''}">`);
        html += row('Máx. caracteres', `<input type="number" min="0" class="adm-input" id="v_maxlen" value="${v.maxLen ?? ''}">`);
      }
      if (caps.numeric) {
        html += row('Valor mínimo', `<input type="number" class="adm-input" id="v_min" value="${v.min ?? ''}">`);
        html += row('Valor máximo', `<input type="number" class="adm-input" id="v_max" value="${v.max ?? ''}">`);
        html += row('Passo (step)', `<input type="number" class="adm-input" id="v_step" value="${v.step ?? 1}">`);
      }
      if (caps.dateRange) {
        html += row('Data mínima', `<input type="date" class="adm-input" id="v_mind" value="${v.minDate ?? ''}">`);
        html += row('Data máxima', `<input type="date" class="adm-input" id="v_maxd" value="${v.maxDate ?? ''}">`);
      }
    }
    html += row('Padrão (regex)', `<input class="adm-input" id="v_pat" value="${attr(v.pattern)}">`);
    html += row('Mensagem de erro', `<input class="adm-input" id="v_err" value="${attr(v.errorMessage)}">`);

    // lógica condicional
    html += logicHtml(f);
    return html;
  }

  function widthSelect(f) {
    return `<select class="adm-input" id="c_width"><option value="full" ${f.width==='full'?'selected':''}>Inteira</option><option value="half" ${f.width==='half'?'selected':''}>Metade</option></select>`;
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
    return `<hr class="fb-hr"><h4 class="fb-insp-sub">Lógica condicional</h4>
      ${others.length ? `
      ${row('Ação', `<select class="adm-input" id="l_action"><option value="show" ${lg.action==='show'?'selected':''}>Mostrar se</option><option value="hide" ${lg.action==='hide'?'selected':''}>Ocultar se</option></select>`)}
      ${row('Combinar', `<select class="adm-input" id="l_match"><option value="all" ${lg.match==='all'?'selected':''}>Todas as regras</option><option value="any" ${lg.match==='any'?'selected':''}>Qualquer regra</option></select>`)}
      <div id="l_rules">${(lg.rules||[]).map((r,i)=>ruleRow(r,i,others)).join('')}</div>
      <button class="btn btn--ghost btn--small" id="l_add">+ regra</button>`
      : `<p class="fb-insp-empty">Adicione outros campos para criar regras.</p>`}`;
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
