// TULIPA · /forms — renderizador público do formulário + envio (anônimo) ao Supabase.
import { supabase } from '../js/supabase.js';

const ATTACH_BUCKET = 'form-attachments';

// ---------------- ícones SVG (creme+verde) ----------------
const I = {
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
  star:  `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3l2.6 5.6 6.1.7-4.5 4.1 1.2 6L12 16.9 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/></svg>`,
  up:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>`,
  down:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>`,
  next:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
  back:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>`,
  file:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v5h5M14 3l5 5v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/></svg>`,
  alert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>`,
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const isEmpty = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0)
  || (typeof v === 'object' && !Array.isArray(v) && Object.values(v).every((x) => x == null || x === ''));

const root = document.getElementById('formRoot');
const STATIC = new Set(['heading', 'paragraph', 'image', 'divider']);

let FORM = null;
let PAGES = [];
let pageIdx = 0;
let captcha = null;

// ---------------- boot ----------------
(async function boot() {
  const slug = new URLSearchParams(location.search).get('f');
  if (!slug) return msg('Link inválido', 'Falta o identificador do formulário.');

  let data, error;
  try {
    ({ data, error } = await supabase.from('forms').select('*').eq('slug', slug).eq('status', 'published').maybeSingle());
  } catch (e) { return msg('Erro', 'Não foi possível carregar agora.'); }

  if (error || !data) return msg('Formulário indisponível', 'Este formulário não existe, não está publicado ou foi fechado.');

  const now = Date.now();
  if (data.opens_at && now < new Date(data.opens_at).getTime())
    return msg('Ainda não abriu', 'Este formulário ainda não está aberto para respostas.');
  if (data.closes_at && now > new Date(data.closes_at).getTime())
    return msg('Encerrado', 'O período para responder este formulário já terminou.');
  if (data.max_responses != null && (data.response_count || 0) >= data.max_responses)
    return msg('Vagas esgotadas', 'Este formulário atingiu o limite de respostas.');

  FORM = data;
  FORM.settings = FORM.settings || {};
  PAGES = (FORM.schema?.pages || []).filter((p) => p);
  if (!PAGES.length) PAGES = [{ id: 'p1', fields: [] }];
  applyTheme(FORM.settings);
  document.title = `${FORM.title} · TULIPA`;

  if (FORM.settings.introScreen?.enabled) renderIntro();
  else renderForm();
})();

function applyTheme(s) {
  const accent = s?.theme?.accent;
  if (accent) document.documentElement.style.setProperty('--accent', accent);
  if (s?.showFlora === false) document.body.classList.add('no-flora');
}

// ---------------- telas auxiliares ----------------
function msg(title, text) {
  root.innerHTML = `<div class="ff-card ff-msg">
    <h1>${esc(title)}</h1><p>${esc(text)}</p>
    <a class="ff-btn ff-btn--ghost" href="../">Ir ao site da TULIPA</a></div>`;
}

function renderIntro() {
  const s = FORM.settings.introScreen || {};
  root.innerHTML = `<div class="ff-card ff-intro">
    ${FORM.settings.coverImage ? `<img class="ff-cover" src="${esc(FORM.settings.coverImage)}" alt="">` : ''}
    <h1 class="ff-title">${esc(s.title || FORM.title)}</h1>
    ${s.text ? `<p class="ff-desc">${esc(s.text)}</p>` : (FORM.description ? `<p class="ff-desc">${esc(FORM.description)}</p>` : '')}
    <button class="ff-btn ff-btn--primary" id="ffStart">Começar</button>
  </div>`;
  document.getElementById('ffStart').onclick = renderForm;
}

function successScreen() {
  const s = FORM.settings;
  if (s.redirectUrl) { location.href = s.redirectUrl; return; }
  root.innerHTML = `<div class="ff-card ff-success">
    <span class="ff-success__mark">${I.check}</span>
    <h1>${esc(s.successMessage || 'Recebemos sua resposta. Obrigado!')}</h1>
    <button class="ff-btn ff-btn--ghost" id="ffAgain">Enviar outra resposta</button>
  </div>`;
  document.getElementById('ffAgain').onclick = () => { pageIdx = 0; renderForm(); window.scrollTo(0, 0); };
}

// ---------------- render do formulário ----------------
function renderForm() {
  const s = FORM.settings;
  const multi = !!s.multiStep && PAGES.length > 1;
  const cols = s.layoutColumns === 2 ? 'ff-grid--2' : '';
  captcha = s.captcha ? { a: 1 + Math.floor(Math.random() * 8), b: 1 + Math.floor(Math.random() * 8) } : null;
  const onSubmitStep = !multi || pageIdx === PAGES.length - 1;

  root.innerHTML = `<form class="ff-card ff-form" id="ffForm" novalidate>
    ${s.coverImage ? `<img class="ff-cover" src="${esc(s.coverImage)}" alt="">` : ''}
    <header class="ff-head">
      <h1 class="ff-title">${esc(FORM.title)}</h1>
      ${FORM.description ? `<p class="ff-desc">${esc(FORM.description)}</p>` : ''}
    </header>
    ${multi && s.showProgress !== false ? `<div class="ff-progress"><span id="ffBar"></span></div>` : ''}
    <div id="ffPages">
      ${PAGES.map((p, i) => `
        <section class="ff-page" data-page="${i}" ${i === pageIdx ? '' : 'hidden'}>
          ${p.title ? `<h2 class="ff-page__title">${esc(p.title)}</h2>` : ''}
          <div class="ff-grid ${cols}">
            ${(p.fields || []).map(fieldHtml).join('')}
          </div>
        </section>`).join('')}
    </div>
    ${s.consentText ? `<label class="ff-consent"><input type="checkbox" id="ffConsent"><span>${esc(s.consentText)}</span></label>` : ''}
    ${captcha && onSubmitStep ? `<label class="ff-field ff-field--full ff-captcha"><span class="ff-label">Confirme que é humano — quanto é ${captcha.a} + ${captcha.b}? <span class="ff-req">*</span></span><input class="ff-input" id="ffCaptcha" inputmode="numeric" autocomplete="off"></label>` : ''}
    <!-- honeypot anti-bot -->
    <div class="ff-hp" aria-hidden="true"><label>Não preencha<input type="text" id="ffHp" tabindex="-1" autocomplete="off"></label></div>
    <p class="ff-formerror" id="ffFormError" hidden></p>
    <footer class="ff-foot">
      ${multi ? `<button type="button" class="ff-btn ff-btn--ghost" id="ffBack" ${pageIdx === 0 ? 'hidden' : ''}>${I.back} Voltar</button>` : ''}
      ${multi && pageIdx < PAGES.length - 1
        ? `<button type="button" class="ff-btn ff-btn--primary" id="ffNext">Continuar ${I.next}</button>`
        : `<button type="submit" class="ff-btn ff-btn--primary" id="ffSubmit">${esc(s.submitLabel || 'Enviar')}</button>`}
    </footer>
    <p class="ff-credit">TULIPA · UNICAP</p>
  </form>`;

  prefillFromUrl();
  bindLiveLogic();
  applyLogic();
  bindControls();

  const form = document.getElementById('ffForm');
  form.addEventListener('submit', onSubmit);
  if (multi) {
    updateBar();
    const nextBtn = document.getElementById('ffNext');
    if (nextBtn) nextBtn.onclick = () => {
      if (!validatePage(pageIdx)) return;
      pageIdx++; renderForm(); window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const backBtn = document.getElementById('ffBack');
    if (backBtn) backBtn.onclick = () => { pageIdx--; renderForm(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  }
}

function updateBar() {
  const bar = document.getElementById('ffBar');
  if (bar) bar.style.width = `${Math.round(((pageIdx + 1) / PAGES.length) * 100)}%`;
}

function allFields() {
  const out = [];
  for (const p of PAGES) for (const f of (p.fields || [])) out.push(f);
  return out;
}

// ---------------- HTML por campo ----------------
function fieldHtml(f) {
  if (STATIC.has(f.type)) return staticHtml(f);
  const wide = f.width === 'half' ? '' : 'ff-field--full';
  const req = f.required ? '<span class="ff-req">*</span>' : '';
  const help = f.description ? `<p class="ff-help">${esc(f.description)}</p>` : '';
  const lbl = f.type === 'consent' ? '' : `<label class="ff-label" for="fld_${f.key}">${esc(f.label)} ${req}</label>`;
  return `<div class="ff-field ${wide}" data-key="${esc(f.key)}" data-type="${f.type}">
    ${lbl}${help}
    <div class="ff-control">${controlHtml(f)}</div>
    <p class="ff-error" hidden></p>
  </div>`;
}

function staticHtml(f) {
  if (f.type === 'heading')   return `<div class="ff-field ff-field--full ff-static" data-key="${esc(f.key)}" data-type="heading"><h2 class="ff-heading">${esc(f.content || f.label)}</h2></div>`;
  if (f.type === 'paragraph') return `<div class="ff-field ff-field--full ff-static" data-key="${esc(f.key)}" data-type="paragraph"><p class="ff-para">${esc(f.content || '')}</p></div>`;
  if (f.type === 'image')     return f.imageUrl ? `<div class="ff-field ff-field--full ff-static" data-key="${esc(f.key)}" data-type="image"><img class="ff-img" src="${esc(f.imageUrl)}" alt=""></div>` : '';
  if (f.type === 'divider')   return `<div class="ff-field ff-field--full ff-static" data-key="${esc(f.key)}" data-type="divider"><hr class="ff-divider"></div>`;
  return '';
}

function controlHtml(f) {
  const id = `fld_${f.key}`;
  const ph = f.placeholder ? `placeholder="${esc(f.placeholder)}"` : '';
  const ro = f.readonly ? 'readonly' : '';
  const dv = f.defaultValue != null ? esc(f.defaultValue) : '';
  switch (f.type) {
    case 'long_text': return `<textarea id="${id}" class="ff-input" rows="4" ${ph} ${ro}>${dv}</textarea>`;
    case 'email':     return `<input id="${id}" class="ff-input" type="email" inputmode="email" ${ph} ${ro} value="${dv}">`;
    case 'phone':     return `<input id="${id}" class="ff-input" type="tel" inputmode="tel" data-mask="phone" ${ph} ${ro} value="${dv}">`;
    case 'number':    return `<input id="${id}" class="ff-input" type="number" inputmode="decimal" ${numAttrs(f)} ${ph} ${ro} value="${dv}">`;
    case 'url':       return `<input id="${id}" class="ff-input" type="url" inputmode="url" ${ph} ${ro} value="${dv}">`;
    case 'cpf':       return `<input id="${id}" class="ff-input" type="text" inputmode="numeric" data-mask="cpf" maxlength="14" ${ph} ${ro} value="${dv}">`;
    case 'date':      return `<input id="${id}" class="ff-input" type="date" ${dateAttrs(f)} ${ro} value="${dv}">`;
    case 'time':      return `<input id="${id}" class="ff-input" type="time" ${ro} value="${dv}">`;
    case 'datetime':  return `<input id="${id}" class="ff-input" type="datetime-local" ${ro} value="${dv}">`;
    case 'color':     return `<input id="${id}" class="ff-color" type="color" value="${dv || '#4A5C36'}">`;
    case 'select':    return selectHtml(f, id);
    case 'radio':     return choiceHtml(f, 'radio');
    case 'checkboxes':return choiceHtml(f, 'checkbox');
    case 'yesno':     return `<div class="ff-choice ff-choice--row">
        <label class="ff-opt"><input type="radio" name="${id}" value="Sim"><span>Sim</span></label>
        <label class="ff-opt"><input type="radio" name="${id}" value="Não"><span>Não</span></label></div>`;
    case 'rating':    return ratingHtml(f, id);
    case 'scale':     return scaleHtml(f, id);
    case 'ranking':   return rankingHtml(f);
    case 'slider':    return `<div class="ff-slider"><input id="${id}" type="range" ${numAttrs(f)} value="${dv || f.scaleMin || f.validation?.min || 0}"><output id="${id}_out"></output></div>`;
    case 'file':      return fileHtml(f, id);
    case 'signature': return `<div class="ff-sign"><canvas id="${id}" class="ff-sign__pad" width="600" height="180"></canvas><button type="button" class="ff-link" data-sign-clear="${id}">limpar</button></div>`;
    case 'address':   return addressHtml(f);
    case 'matrix':    return matrixHtml(f);
    case 'consent':   return `<label class="ff-consent"><input type="checkbox" id="${id}"><span>${esc(f.label)} ${f.required ? '<span class="ff-req">*</span>' : ''}</span></label>`;
    case 'hidden':    return `<input id="${id}" type="hidden" value="${dv}">`;
    case 'short_text':
    default:          return `<input id="${id}" class="ff-input" type="text" ${ph} ${ro} value="${dv}">`;
  }
}

function numAttrs(f) {
  const v = f.validation || {};
  const min = v.min != null ? `min="${v.min}"` : (f.scaleMin != null && f.type === 'slider' ? `min="${f.scaleMin}"` : '');
  const max = v.max != null ? `max="${v.max}"` : (f.scaleMax != null && f.type === 'slider' ? `max="${f.scaleMax}"` : '');
  const step = v.step != null ? `step="${v.step}"` : '';
  return `${min} ${max} ${step}`;
}
function dateAttrs(f) {
  const v = f.validation || {};
  return `${v.minDate ? `min="${v.minDate}"` : ''} ${v.maxDate ? `max="${v.maxDate}"` : ''}`;
}
function options(f) {
  const arr = (f.options || []).slice();
  if (f.allowOther) arr.push('__other__');
  return arr;
}
function selectHtml(f, id) {
  return `<select id="${id}" class="ff-input">
    <option value="">— selecione —</option>
    ${(f.options || []).map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}
    ${f.allowOther ? `<option value="__other__">Outro…</option>` : ''}
  </select>${f.allowOther ? `<input class="ff-input ff-other" data-other-for="${id}" placeholder="Outro" hidden>` : ''}`;
}
function choiceHtml(f, kind) {
  const name = `fld_${f.key}`;
  const limit = kind === 'checkbox' && (f.minSelections || f.maxSelections)
    ? `<p class="ff-help ff-help--limit">${f.minSelections ? `mín. ${f.minSelections}` : ''}${f.minSelections && f.maxSelections ? ' · ' : ''}${f.maxSelections ? `máx. ${f.maxSelections}` : ''}</p>` : '';
  const opts = (f.options || []).map((o) => `
    <label class="ff-opt"><input type="${kind}" name="${name}" value="${esc(o)}"><span>${esc(o)}</span></label>`).join('');
  const other = f.allowOther ? `
    <label class="ff-opt"><input type="${kind}" name="${name}" value="__other__"><span>Outro:</span></label>
    <input class="ff-input ff-other" data-other-for="${name}" placeholder="Outro" hidden>` : '';
  return `<div class="ff-choice">${opts}${other}</div>${limit}`;
}
function ratingHtml(f, id) {
  const max = f.scaleMax || 5;
  let s = `<div class="ff-rating" data-for="${id}"><input type="hidden" id="${id}" value="">`;
  for (let i = 1; i <= max; i++) s += `<button type="button" class="ff-star" data-val="${i}" aria-label="${i}">${I.star}</button>`;
  s += `</div>`;
  return s;
}
function scaleHtml(f, id) {
  const min = f.scaleMin ?? 0, max = f.scaleMax ?? 10;
  let btns = '';
  for (let i = min; i <= max; i++) btns += `<label class="ff-scale__btn"><input type="radio" name="${id}" value="${i}"><span>${i}</span></label>`;
  return `<div class="ff-scale">
    ${f.scaleMinLabel ? `<span class="ff-scale__lbl">${esc(f.scaleMinLabel)}</span>` : ''}
    <div class="ff-scale__row">${btns}</div>
    ${f.scaleMaxLabel ? `<span class="ff-scale__lbl">${esc(f.scaleMaxLabel)}</span>` : ''}
  </div>`;
}
function rankingHtml(f) {
  return `<ul class="ff-rank">${(f.options || []).map((o) => `
    <li class="ff-rank__item" data-val="${esc(o)}"><span>${esc(o)}</span>
      <span class="ff-rank__ops"><button type="button" class="ff-link" data-rank="up">${I.up}</button><button type="button" class="ff-link" data-rank="down">${I.down}</button></span>
    </li>`).join('')}</ul>`;
}
function fileHtml(f, id) {
  const acc = f.fileAccept ? `accept="${esc(f.fileAccept)}"` : '';
  const mult = (f.fileMaxCount || 1) > 1 ? 'multiple' : '';
  return `<label class="ff-file"><input id="${id}" type="file" ${acc} ${mult} hidden>
    <span class="ff-file__btn">${I.file} Escolher arquivo${mult ? 's' : ''}</span>
    <span class="ff-file__list" id="${id}_list">nenhum arquivo (até ${f.fileMaxMb || 10} MB${mult ? `, máx ${f.fileMaxCount}` : ''})</span></label>`;
}
function addressHtml(f) {
  const k = `fld_${f.key}`;
  return `<div class="ff-addr">
    <input class="ff-input" data-addr="cep" placeholder="CEP">
    <input class="ff-input ff-addr__street" data-addr="rua" placeholder="Rua">
    <input class="ff-input" data-addr="numero" placeholder="Nº">
    <input class="ff-input" data-addr="bairro" placeholder="Bairro">
    <input class="ff-input" data-addr="cidade" placeholder="Cidade">
    <input class="ff-input ff-addr__uf" data-addr="uf" placeholder="UF" maxlength="2">
  </div>`;
}
function matrixHtml(f) {
  const kind = f.matrixMultiple ? 'checkbox' : 'radio';
  return `<div class="ff-matrix-wrap"><table class="ff-matrix"><thead><tr><th></th>
    ${(f.matrixCols || []).map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>
    ${(f.matrixRows || []).map((r, ri) => `<tr><th>${esc(r)}</th>
      ${(f.matrixCols || []).map((c) => `<td><input type="${kind}" name="mx_${f.key}_${ri}" value="${esc(c)}"></td>`).join('')}
    </tr>`).join('')}</tbody></table></div>`;
}

// ---------------- prefill / máscaras / controles ----------------
function prefillFromUrl() {
  const params = new URLSearchParams(location.search);
  for (const f of allFields()) {
    if (!f.prefillParam) continue;
    const val = params.get(f.prefillParam);
    if (val == null) continue;
    const el = document.getElementById(`fld_${f.key}`);
    if (el && 'value' in el) el.value = val;
  }
}

function bindControls() {
  // máscaras
  root.querySelectorAll('[data-mask]').forEach((el) => {
    el.addEventListener('input', () => {
      if (el.dataset.mask === 'cpf') el.value = maskCpf(el.value);
      if (el.dataset.mask === 'phone') el.value = maskPhone(el.value);
    });
  });
  // "Outro"
  root.querySelectorAll('.ff-choice, select').forEach((box) => {
    box.addEventListener('change', () => {
      const wrap = box.closest('.ff-field'); if (!wrap) return;
      const other = wrap.querySelector('.ff-other'); if (!other) return;
      const sel = isOtherSelected(wrap);
      other.hidden = !sel; if (sel) other.focus();
    });
  });
  // rating
  root.querySelectorAll('.ff-rating').forEach((rt) => {
    rt.querySelectorAll('.ff-star').forEach((b) => {
      b.onclick = () => {
        const val = +b.dataset.val;
        rt.querySelector('input').value = val;
        rt.querySelectorAll('.ff-star').forEach((s) => s.classList.toggle('on', +s.dataset.val <= val));
        rt.dispatchEvent(new Event('change', { bubbles: true }));
      };
    });
  });
  // slider output
  root.querySelectorAll('.ff-slider input').forEach((sl) => {
    const out = document.getElementById(sl.id + '_out');
    const upd = () => { if (out) out.textContent = sl.value; };
    sl.addEventListener('input', upd); upd();
  });
  // ranking
  root.querySelectorAll('.ff-rank').forEach((ul) => {
    ul.querySelectorAll('[data-rank]').forEach((b) => {
      b.onclick = () => {
        const li = b.closest('.ff-rank__item');
        if (b.dataset.rank === 'up' && li.previousElementSibling) li.parentNode.insertBefore(li, li.previousElementSibling);
        if (b.dataset.rank === 'down' && li.nextElementSibling) li.parentNode.insertBefore(li.nextElementSibling, li);
      };
    });
  });
  // file list
  root.querySelectorAll('.ff-file input[type=file]').forEach((inp) => {
    inp.addEventListener('change', () => {
      const list = document.getElementById(inp.id + '_list');
      const names = Array.from(inp.files).map((f) => f.name).join(', ');
      if (list) list.textContent = names || 'nenhum arquivo';
    });
  });
  // signature pads
  root.querySelectorAll('.ff-sign__pad').forEach(initSignPad);
  root.querySelectorAll('[data-sign-clear]').forEach((b) => {
    b.onclick = () => { const c = document.getElementById(b.dataset.signClear); c.getContext('2d').clearRect(0, 0, c.width, c.height); c.dataset.dirty = ''; };
  });
}

function isOtherSelected(wrap) {
  const sel = wrap.querySelector('select');
  if (sel) return sel.value === '__other__';
  return !!wrap.querySelector('input[value="__other__"]:checked');
}

function maskCpf(v) {
  v = v.replace(/\D/g, '').slice(0, 11);
  return v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}
function maskPhone(v) {
  v = v.replace(/\D/g, '').slice(0, 11);
  if (v.length <= 10) return v.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  return v.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

function initSignPad(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#2F3D22'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  let drawing = false;
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: (t.clientX - r.left) * (canvas.width / r.width), y: (t.clientY - r.top) * (canvas.height / r.height) };
  };
  const start = (e) => { drawing = true; canvas.dataset.dirty = '1'; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); e.preventDefault(); };
  const move = (e) => { if (!drawing) return; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); e.preventDefault(); };
  const end = () => { drawing = false; };
  canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, { passive: false }); canvas.addEventListener('touchmove', move, { passive: false }); canvas.addEventListener('touchend', end);
}

// ---------------- lógica condicional ----------------
function bindLiveLogic() {
  document.getElementById('ffForm').addEventListener('input', applyLogic);
  document.getElementById('ffForm').addEventListener('change', applyLogic);
}
function applyLogic() {
  const vals = collectValues(true);
  for (const f of allFields()) {
    if (!f.logic || !(f.logic.rules || []).length) continue;
    const wrap = root.querySelector(`.ff-field[data-key="${cssKey(f.key)}"]`);
    if (!wrap) continue;
    const visible = evalLogic(f.logic, vals);
    wrap.dataset.hidden = visible ? '' : '1';
    wrap.style.display = visible ? '' : 'none';
  }
}
function evalLogic(lg, vals) {
  const res = (lg.rules || []).map((r) => {
    const v = vals[r.field];
    const target = r.value;
    switch (r.op) {
      case 'eq': return Array.isArray(v) ? v.includes(target) : String(v ?? '') === String(target);
      case 'ne': return Array.isArray(v) ? !v.includes(target) : String(v ?? '') !== String(target);
      case 'contains': return String(Array.isArray(v) ? v.join(',') : (v ?? '')).toLowerCase().includes(String(target).toLowerCase());
      case 'filled': return !isEmpty(v);
      case 'empty': return isEmpty(v);
      default: return true;
    }
  });
  const pass = lg.match === 'any' ? res.some(Boolean) : res.every(Boolean);
  return lg.action === 'hide' ? !pass : pass;
}
function cssKey(k) { return String(k).replace(/"/g, '\\"'); }

// ---------------- leitura de valores ----------------
function collectValues(forLogic) {
  const out = {};
  for (const f of allFields()) {
    if (STATIC.has(f.type)) continue;
    out[f.key] = readField(f);
  }
  return out;
}
function readField(f) {
  const wrap = root.querySelector(`.ff-field[data-key="${cssKey(f.key)}"]`);
  if (!wrap) return '';
  const id = `fld_${f.key}`;
  const otherVal = () => { const o = wrap.querySelector('.ff-other'); return o && !o.hidden ? o.value.trim() : ''; };
  switch (f.type) {
    case 'checkboxes': {
      const vals = Array.from(wrap.querySelectorAll('input:checked')).map((i) => i.value);
      return vals.map((v) => v === '__other__' ? otherVal() : v).filter(Boolean);
    }
    case 'radio': case 'yesno': case 'scale': {
      const c = wrap.querySelector('input:checked'); if (!c) return '';
      return c.value === '__other__' ? otherVal() : c.value;
    }
    case 'select': {
      const s = wrap.querySelector('select'); const v = s ? s.value : '';
      return v === '__other__' ? otherVal() : v;
    }
    case 'rating': return wrap.querySelector('input')?.value || '';
    case 'ranking': return Array.from(wrap.querySelectorAll('.ff-rank__item')).map((li) => li.dataset.val);
    case 'consent': return wrap.querySelector('input')?.checked ? 'sim' : '';
    case 'file': { const inp = wrap.querySelector('input[type=file]'); return inp && inp.files.length ? Array.from(inp.files).map((x) => x.name) : []; }
    case 'signature': { const c = wrap.querySelector('canvas'); return c && c.dataset.dirty ? 'assinado' : ''; }
    case 'address': {
      const o = {}; wrap.querySelectorAll('[data-addr]').forEach((i) => { o[i.dataset.addr] = i.value.trim(); });
      return Object.values(o).some(Boolean) ? o : '';
    }
    case 'matrix': {
      const o = {}; (f.matrixRows || []).forEach((r, ri) => {
        const checked = Array.from(wrap.querySelectorAll(`input[name="mx_${cssKey(f.key)}_${ri}"]:checked`)).map((i) => i.value);
        if (checked.length) o[r] = f.matrixMultiple ? checked : checked[0];
      });
      return Object.keys(o).length ? o : '';
    }
    default: { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
  }
}

// ---------------- validação ----------------
function fieldError(f, val) {
  const v = f.validation || {};
  if (f.required && isEmpty(val)) return v.errorMessage || 'Campo obrigatório.';
  if (isEmpty(val)) return '';
  if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return v.errorMessage || 'E-mail inválido.';
  if (f.type === 'cpf' && val.replace(/\D/g, '').length !== 11) return v.errorMessage || 'CPF incompleto.';
  if (typeof val === 'string') {
    if (v.minLen && val.length < v.minLen) return v.errorMessage || `Mínimo ${v.minLen} caracteres.`;
    if (v.maxLen && val.length > v.maxLen) return v.errorMessage || `Máximo ${v.maxLen} caracteres.`;
    if (v.pattern) { try { if (!new RegExp(v.pattern).test(val)) return v.errorMessage || 'Formato inválido.'; } catch {} }
  }
  if (f.type === 'number' || f.type === 'slider') {
    const n = Number(val);
    if (v.min != null && n < v.min) return v.errorMessage || `Mínimo ${v.min}.`;
    if (v.max != null && n > v.max) return v.errorMessage || `Máximo ${v.max}.`;
  }
  if (f.type === 'checkboxes' && Array.isArray(val)) {
    if (f.minSelections && val.length < f.minSelections) return `Selecione ao menos ${f.minSelections}.`;
    if (f.maxSelections && val.length > f.maxSelections) return `Selecione no máximo ${f.maxSelections}.`;
  }
  if (f.type === 'file') {
    const wrap = root.querySelector(`.ff-field[data-key="${cssKey(f.key)}"]`);
    const inp = wrap?.querySelector('input[type=file]');
    if (inp && inp.files.length) {
      if (inp.files.length > (f.fileMaxCount || 1)) return `Máximo ${f.fileMaxCount} arquivo(s).`;
      for (const file of inp.files) if (file.size > (f.fileMaxMb || 10) * 1024 * 1024) return `Cada arquivo até ${f.fileMaxMb || 10} MB.`;
    }
  }
  return '';
}

function validatePage(idx) {
  const sec = root.querySelector(`.ff-page[data-page="${idx}"]`);
  let firstBad = null;
  for (const f of (PAGES[idx].fields || [])) {
    if (STATIC.has(f.type)) continue;
    const wrap = sec.querySelector(`.ff-field[data-key="${cssKey(f.key)}"]`);
    if (!wrap || wrap.dataset.hidden === '1') continue;
    const err = fieldError(f, readField(f));
    const slot = wrap.querySelector('.ff-error');
    if (err) { wrap.classList.add('has-error'); if (slot) { slot.textContent = err; slot.hidden = false; } if (!firstBad) firstBad = wrap; }
    else { wrap.classList.remove('has-error'); if (slot) slot.hidden = true; }
  }
  if (firstBad) firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return !firstBad;
}

// ---------------- envio ----------------
async function onSubmit(e) {
  e.preventDefault();
  // honeypot → finge sucesso
  if (document.getElementById('ffHp')?.value) { successScreen(); return; }
  // captcha simples (conta)
  if (captcha) {
    const ans = parseInt(document.getElementById('ffCaptcha')?.value, 10);
    if (ans !== captcha.a + captcha.b) return showFormError('Verificação incorreta — confira a conta.');
  }
  // LGPD
  const consent = document.getElementById('ffConsent');
  if (consent && !consent.checked) { return showFormError('Você precisa aceitar para enviar.'); }
  // valida todas as páginas
  for (let i = 0; i < PAGES.length; i++) {
    if (!validatePage(i)) { if (FORM.settings.multiStep && PAGES.length > 1 && i !== pageIdx) { pageIdx = i; renderForm(); } return; }
  }

  const btn = document.getElementById('ffSubmit');
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }

  // monta data (campos não-arquivo) + detecta nome/email
  const data = {};
  let respName = null, respEmail = null;
  const fileFields = [];
  for (const f of allFields()) {
    if (STATIC.has(f.type)) continue;
    const wrap = root.querySelector(`.ff-field[data-key="${cssKey(f.key)}"]`);
    if (wrap && wrap.dataset.hidden === '1') continue;
    if (f.type === 'file') { fileFields.push(f); data[f.key] = readField(f); continue; }
    if (f.type === 'signature') { const c = wrap?.querySelector('canvas'); data[f.key] = c && c.dataset.dirty ? c.toDataURL('image/png') : ''; continue; }
    const val = readField(f);
    data[f.key] = val;
    if (!respEmail && f.type === 'email' && val) respEmail = val;
    if (!respName && /nome/i.test(f.label || '') && typeof val === 'string' && val) respName = val;
  }

  try {
    const payload = {
      form_id: FORM.id, data,
      respondent_name: respName, respondent_email: respEmail,
      user_agent: FORM.settings.captureMeta ? navigator.userAgent : null,
    };
    const { data: resp, error } = await supabase.from('form_responses').insert(payload).select('id').single();
    if (error) throw error;

    // upload de anexos
    for (const f of fileFields) {
      const inp = root.querySelector(`.ff-field[data-key="${cssKey(f.key)}"] input[type=file]`);
      if (!inp || !inp.files.length) continue;
      for (const file of inp.files) {
        const safe = file.name.replace(/[^\w.\- ]+/g, '_');
        const path = `${FORM.id}/${resp.id}/${f.key}/${Date.now()}-${safe}`;
        const up = await supabase.storage.from(ATTACH_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
        if (up.error) { console.warn('upload falhou', up.error.message); continue; }
        await supabase.from('form_response_files').insert({
          response_id: resp.id, form_id: FORM.id, field_key: f.key,
          file_name: file.name, file_size: file.size, mime_type: file.type, storage_path: path,
        });
      }
    }
    successScreen();
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = FORM.settings.submitLabel || 'Enviar'; }
    showFormError('Não foi possível enviar: ' + (err?.message || 'erro desconhecido'));
  }
}

function showFormError(text) {
  const box = document.getElementById('ffFormError');
  if (box) { box.innerHTML = `${I.alert} ${esc(text)}`; box.hidden = false; box.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
}
