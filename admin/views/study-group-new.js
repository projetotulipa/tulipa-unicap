// TULIPA · admin · wizard de criação de Grupo de Estudo (LP filha)
// Permite 2 fluxos:
//  1. Vincular a um attendance_group já existente (criado pela secretaria)
//  2. Criar grupo novo do zero (atendance_group + study_group_page numa só operação)

import { icon } from '../icons.js';
import { stampSeal } from '../pages/signet.js';
import {
  attendanceGroupsWithoutPage,
  createStudyGroupPage,
  createGroupAndPage,
  slugify,
} from '../../js/study-groups.js';
import { toastSuccess, toastError } from '../toast.js';

const ACCENT_OPTIONS = [
  { value: 'wine',   label: 'Vinho',   hex: '#5C2230' },
  { value: 'rose',   label: 'Rosé',    hex: '#9F5A6B' },
  { value: 'sage',   label: 'Sage',    hex: '#8FA084' },
  { value: 'gold',   label: 'Dourado', hex: '#C8A14A' },
  { value: 'moss',   label: 'Musgo',   hex: '#4A5C36' },
  { value: 'plum',   label: 'Ameixa',  hex: '#7B5EA7' },
  { value: 'cream',  label: 'Creme',   hex: '#EDDFC2' },
];

const COVER_EMOJIS = ['📖', '🌹', '🌙', '🔮', '🎭', '🌳', '🏛️', '⚱️', '🌀', '🪞', '🌌', '✦', '⚘', '🔍', '🦋'];

const state = {
  mode: 'pick',          // pick | existing | new
  selectedGroupId: null,
  newGroupName: '',
  newGroupDesc: '',
  slug: '',
  slugTouched: false,    // se user editou o slug, não auto-regerar
  heroSubtitle: '',
  lede: '',
  accent: 'wine',
  emoji: '📖',
  saving: false,
};

let freeGroups = [];

export async function renderStudyGroupNew(ctx) {
  const { root } = ctx;
  Object.assign(state, {
    mode: 'pick', selectedGroupId: null, newGroupName: '', newGroupDesc: '',
    slug: '', slugTouched: false, heroSubtitle: '', lede: '',
    accent: 'wine', emoji: '📖', saving: false,
  });

  root.innerHTML = `
    <div class="view view--study-new">
      <header class="pages-editor-hero">
        <div class="pages-editor-hero__seal-wrap">
          <span class="pages-signet pages-signet--wine">${stampSeal({ size: 30 })}</span>
        </div>
        <div class="pages-editor-hero__inner">
          <p class="pages-editor-hero__crumbs">
            <a href="#/grupos-estudo">${icon('arrow-left', { size: 12 })}<span style="margin-left:6px;">Grupos de Estudo</span></a>
          </p>
          <p class="pages-editor-hero__eyebrow">nova folha</p>
          <h1>Criar grupo de estudo</h1>
          <p class="pages-editor-hero__lede">
            Uma <strong>folha</strong> é a landing page de UM grupo concreto. Você pode partir
            de um grupo já cadastrado na Secretaria, ou criar um do zero.
          </p>
        </div>
      </header>

      <div class="study-new-wrap">
        <div id="studyNewBody"></div>
        <footer class="study-new-foot" id="studyNewFoot" hidden>
          <a class="btn btn--ghost btn--small" href="#/grupos-estudo">Cancelar</a>
          <button class="btn btn--primary" id="createBtn" disabled>
            ${icon('plus', { size: 14 })}<span style="margin-left:6px;">Criar folha</span>
          </button>
        </footer>
      </div>
    </div>
  `;

  // carrega grupos sem página em background
  attendanceGroupsWithoutPage().then(({ data, error }) => {
    if (error) {
      toastError('Erro ao carregar grupos da Secretaria: ' + error.message);
      return;
    }
    freeGroups = data;
    if (state.mode === 'existing') renderBody(ctx);
  });

  renderBody(ctx);
}

function renderBody(ctx) {
  const body = document.getElementById('studyNewBody');
  const foot = document.getElementById('studyNewFoot');
  if (!body) return;

  if (state.mode === 'pick') {
    foot.hidden = true;
    body.innerHTML = pickOriginHtml();
    body.querySelectorAll('[data-pick]').forEach((el) => {
      el.addEventListener('click', () => {
        state.mode = el.dataset.pick;
        renderBody(ctx);
      });
    });
    return;
  }

  foot.hidden = false;
  body.innerHTML = formHtml();
  bindForm(ctx);
  validate();
}

function pickOriginHtml() {
  return `
    <div class="study-new-pick">
      <h2>Como você quer começar?</h2>
      <div class="study-new-pick__options">
        <button class="study-new-pick__opt" data-pick="existing">
          <span class="study-new-pick__emoji">📋</span>
          <strong>A partir de um grupo existente</strong>
          <span class="study-new-pick__hint">Escolha um grupo já cadastrado pela Secretaria que ainda não tem página.</span>
        </button>
        <button class="study-new-pick__opt" data-pick="new">
          <span class="study-new-pick__emoji">✨</span>
          <strong>Criar grupo novo do zero</strong>
          <span class="study-new-pick__hint">Cria o grupo na Secretaria + a folha aqui de uma vez. Você define presença depois.</span>
        </button>
      </div>
    </div>
  `;
}

function formHtml() {
  const isExisting = state.mode === 'existing';
  const groupOptions = freeGroups.map((g) =>
    `<option value="${escapeAttr(g.id)}"${state.selectedGroupId === g.id ? ' selected' : ''}>${escapeHtml(g.name)}${g.is_archived ? ' (arquivado)' : ''}</option>`
  ).join('');

  return `
    <div class="study-new-form">
      <div class="study-new-form__back">
        <button class="btn btn--ghost btn--small" data-back>
          ${icon('arrow-left', { size: 12 })}<span style="margin-left:6px;">trocar origem</span>
        </button>
      </div>

      ${isExisting ? `
        <section class="study-new-section">
          <h3>1. Qual grupo da Secretaria?</h3>
          <label class="study-new-field">
            <span>Grupo</span>
            <select id="existingGroupSelect">
              <option value="">— escolha um grupo —</option>
              ${freeGroups.length === 0
                ? '<option disabled>(carregando ou nenhum grupo livre)</option>'
                : groupOptions}
            </select>
            <small>Só aparecem grupos que ainda não têm folha vinculada.</small>
          </label>
        </section>
      ` : `
        <section class="study-new-section">
          <h3>1. Criar o grupo</h3>
          <label class="study-new-field">
            <span>Nome do grupo *</span>
            <input type="text" id="newGroupName" value="${escapeAttr(state.newGroupName)}"
                   placeholder="Ex.: A Prática da Psicoterapia" />
          </label>
          <label class="study-new-field">
            <span>Descrição curta (opcional)</span>
            <textarea id="newGroupDesc" rows="2" placeholder="Resumo de uma linha — aparece pra Secretaria gerir presença.">${escapeHtml(state.newGroupDesc)}</textarea>
          </label>
        </section>
      `}

      <section class="study-new-section">
        <h3>2. Aparência da folha</h3>
        <label class="study-new-field">
          <span>Slug (URL) *</span>
          <div class="study-new-slug">
            <code>/atividades/grupos-de-estudo/grupo.html?id=</code>
            <input type="text" id="slugInput" value="${escapeAttr(state.slug)}"
                   placeholder="ex: pratica-da-psicoterapia" />
          </div>
          <small>Letras minúsculas, números e hífens. Você pode editar — se deixar em branco, gero a partir do nome.</small>
        </label>

        <div class="study-new-row">
          <label class="study-new-field study-new-field--narrow">
            <span>Emoji da capa</span>
            <div class="study-new-emojis" id="emojiPicker">
              ${COVER_EMOJIS.map((e) => `
                <button type="button" class="study-new-emoji ${state.emoji === e ? 'is-active' : ''}" data-emoji="${escapeAttr(e)}">${e}</button>
              `).join('')}
            </div>
          </label>

          <label class="study-new-field study-new-field--narrow">
            <span>Cor de destaque</span>
            <div class="study-new-accents" id="accentPicker">
              ${ACCENT_OPTIONS.map((a) => `
                <button type="button" class="study-new-accent ${state.accent === a.value ? 'is-active' : ''}"
                        data-accent="${escapeAttr(a.value)}"
                        style="--accent: ${a.hex}" title="${escapeAttr(a.label)}" aria-label="${escapeAttr(a.label)}">
                  <span class="study-new-accent__dot"></span>
                  <span>${escapeHtml(a.label)}</span>
                </button>
              `).join('')}
            </div>
          </label>
        </div>
      </section>

      <section class="study-new-section">
        <h3>3. Conteúdo inicial (opcional)</h3>
        <p class="study-new-section__hint">
          Você pode editar tudo isso depois. Preenche o que vier à mão agora.
        </p>
        <label class="study-new-field">
          <span>Subtítulo (linha em itálico abaixo do título)</span>
          <input type="text" id="heroSubtitle" value="${escapeAttr(state.heroSubtitle)}"
                 placeholder="Ex.: Encontros quinzenais com a clínica junguiana" />
        </label>
        <label class="study-new-field">
          <span>Parágrafo de boas-vindas (lede)</span>
          <textarea id="lede" rows="3" placeholder="Como você apresenta esse grupo para alguém que nunca participou.">${escapeHtml(state.lede)}</textarea>
        </label>
      </section>
    </div>
  `;
}

function bindForm(ctx) {
  // back button
  document.querySelector('[data-back]')?.addEventListener('click', () => {
    state.mode = 'pick';
    renderBody(ctx);
  });

  const sel = document.getElementById('existingGroupSelect');
  if (sel) {
    sel.addEventListener('change', () => {
      state.selectedGroupId = sel.value || null;
      const g = freeGroups.find((g) => g.id === sel.value);
      if (g && !state.slugTouched) {
        state.slug = slugify(g.name);
        document.getElementById('slugInput').value = state.slug;
      }
      validate();
    });
  }

  const nameInp = document.getElementById('newGroupName');
  if (nameInp) {
    nameInp.addEventListener('input', () => {
      state.newGroupName = nameInp.value;
      if (!state.slugTouched) {
        state.slug = slugify(nameInp.value);
        document.getElementById('slugInput').value = state.slug;
      }
      validate();
    });
  }
  const descInp = document.getElementById('newGroupDesc');
  if (descInp) descInp.addEventListener('input', () => { state.newGroupDesc = descInp.value; });

  const slugInp = document.getElementById('slugInput');
  if (slugInp) {
    slugInp.addEventListener('input', () => {
      state.slugTouched = true;
      state.slug = slugInp.value.trim();
      // normaliza só os caracteres claramente errados em tempo real (sem reformatar tudo)
      const cleaned = state.slug.replace(/[^a-z0-9-]/gi, '').toLowerCase();
      if (cleaned !== slugInp.value) {
        slugInp.value = cleaned;
        state.slug = cleaned;
      }
      validate();
    });
  }

  document.querySelectorAll('[data-emoji]').forEach((el) => {
    el.addEventListener('click', () => {
      state.emoji = el.dataset.emoji;
      document.querySelectorAll('[data-emoji]').forEach((e) => e.classList.toggle('is-active', e.dataset.emoji === state.emoji));
    });
  });
  document.querySelectorAll('[data-accent]').forEach((el) => {
    el.addEventListener('click', () => {
      state.accent = el.dataset.accent;
      document.querySelectorAll('[data-accent]').forEach((e) => e.classList.toggle('is-active', e.dataset.accent === state.accent));
    });
  });

  document.getElementById('heroSubtitle')?.addEventListener('input', (e) => { state.heroSubtitle = e.target.value; });
  document.getElementById('lede')?.addEventListener('input', (e) => { state.lede = e.target.value; });

  document.getElementById('createBtn')?.addEventListener('click', () => handleCreate(ctx));
}

function validate() {
  const btn = document.getElementById('createBtn');
  if (!btn) return;
  const isExisting = state.mode === 'existing';
  const slugOk = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(state.slug);
  let valid = slugOk && state.slug.length >= 2;
  if (isExisting) valid = valid && !!state.selectedGroupId;
  else valid = valid && state.newGroupName.trim().length >= 2;
  btn.disabled = !valid || state.saving;
}

async function handleCreate(ctx) {
  state.saving = true;
  validate();
  const btn = document.getElementById('createBtn');
  const originalHTML = btn.innerHTML;
  btn.innerHTML = `${icon('refresh', { size: 14 })}<span style="margin-left:6px;">Criando…</span>`;

  const pagePayload = {
    slug: state.slug,
    hero_subtitle: state.heroSubtitle || '',
    lede: state.lede || '',
    accent_color: state.accent,
    cover_emoji: state.emoji,
    is_published: false,
    show_on_index: true,
    sort_order: 0,
  };

  let result;
  if (state.mode === 'existing') {
    result = await createStudyGroupPage({ group_id: state.selectedGroupId, ...pagePayload });
    if (!result.error) {
      // result.data é a página direta
      ctx.api.navigate(`#/grupos-estudo/${result.data.id}`);
    }
  } else {
    const { data, error } = await createGroupAndPage({
      name: state.newGroupName.trim(),
      description: state.newGroupDesc.trim() || null,
      ...pagePayload,
    });
    result = { data: data?.page, error };
    if (!error && data) {
      ctx.api.navigate(`#/grupos-estudo/${data.page.id}`);
    }
  }

  if (result.error) {
    btn.innerHTML = originalHTML;
    state.saving = false;
    const msg = result.error.message || String(result.error);
    if (msg.includes('study_group_pages_slug_key') || msg.includes('duplicate')) {
      toastError('Esse slug já está em uso. Escolha outro.');
    } else {
      toastError('Não consegui criar: ' + msg);
    }
    validate();
    return;
  }

  toastSuccess('Folha criada — agora preencha o conteúdo.');
}

// ---------- helpers ----------
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
