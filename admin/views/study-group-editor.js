// TULIPA · admin · editor de Grupo de Estudo (4 abas)
// Conteúdo · Encontros · Materiais · Configurações
//
// Autosave por field (debounce 800ms). Status visual no header.

import { icon } from '../icons.js';
import { stampSeal } from '../pages/signet.js';
import { supabase } from '../../js/supabase.js';
import { attachMarkdownEditor, mdToHtml } from '../markdown-editor.js';
import { COVER_ICONS, coverIcon } from '../../js/study-group-icons.js';
import {
  updateStudyGroupPage,
  deleteStudyGroupPage,
  getStudyGroupMeetings,
  getStudyGroupFichamentos,
  getStudyGroupResources,
  createResource,
  updateResource,
  deleteResource,
  reorderResources,
  RESOURCE_KINDS,
  RESOURCE_GROUPS,
  resourceKindLabel,
  youtubeId,
  driveInfo,
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

// pickers de cover usam SVGs (COVER_ICONS de js/study-group-icons.js)

let page = null;     // payload corrente do study_groups_public
let pageId = null;
let activeTab = 'content';
const saveTimers = new Map();  // field → timeout
let savingFields = new Set();
let ctxRef = null;

export async function renderStudyGroupEditor(ctx, id) {
  ctxRef = ctx;
  pageId = id;
  page = null;
  activeTab = 'content';
  saveTimers.clear();
  savingFields = new Set();

  const { root } = ctx;
  root.innerHTML = `
    <div class="view view--study-editor" id="studyEditorRoot">
      <div class="study-editor-loading">
        <span class="pages-bloom"><span class="pages-signet">${stampSeal({ size: 28 })}</span></span>
        <p>Carregando folha…</p>
      </div>
    </div>
  `;

  const { data, error } = await supabase
    .from('study_groups_public')
    .select('*')
    .eq('page_id', id)
    .maybeSingle();
  if (error || !data) {
    root.querySelector('.study-editor-loading').innerHTML = `
      <div class="pages-empty-v2">
        <div class="pages-empty-v2__art">${icon('alert', { size: 52 })}</div>
        <h3>Folha não encontrada</h3>
        <p>${escapeHtml(error?.message || 'Sem registro pra esse ID.')}</p>
        <a class="btn btn--ghost btn--small" href="#/grupos-estudo" style="margin-top: 14px;">
          ${icon('arrow-left', { size: 12 })}<span style="margin-left:6px;">Voltar</span>
        </a>
      </div>
    `;
    return;
  }
  page = data;
  // view study_groups_public retorna `page_id` (não `id`) — normaliza pro código interno
  page.id = page.page_id;
  renderShell();
  renderTab();
}

function renderShell() {
  const root = document.getElementById('studyEditorRoot');
  const accent = page.accent_color || 'wine';
  const url = `../atividades/grupos-de-estudo/grupo.html?id=${encodeURIComponent(page.slug)}`;
  root.innerHTML = `
    <header class="pages-editor-hero study-editor-hero study-editor-hero--accent-${accent}">
      <div class="pages-editor-hero__seal-wrap">
        <span class="study-editor-hero__emoji" aria-hidden="true">${coverIcon(page.cover_emoji || 'book', 36)}</span>
      </div>
      <div class="pages-editor-hero__inner">
        <p class="pages-editor-hero__crumbs">
          <a href="#/grupos-estudo">${icon('arrow-left', { size: 12 })}<span style="margin-left:6px;">Grupos de Estudo</span></a>
        </p>
        <p class="pages-editor-hero__eyebrow">${page.is_published ? 'publicada · viva no site' : 'rascunho · só você vê'}</p>
        <h1>${escapeHtml(page.group_name || '(sem nome)')}</h1>
        <p class="pages-editor-hero__lede">
          ${page.lede ? escapeHtml(truncate(stripHtml(page.lede), 180)) : '<em>Sem lede ainda — vai pra aba <strong>Conteúdo</strong> e preenche.</em>'}
        </p>
      </div>
      <div class="pages-editor-hero__actions">
        <span class="study-editor-savestate" id="saveState">${icon('check', { size: 12 })}<span style="margin-left:5px;">tudo salvo</span></span>
        ${page.is_published
          ? `<a class="btn btn--ghost btn--small" href="${escapeAttr(url)}" target="_blank" rel="noopener">${icon('external', { size: 12 })}<span style="margin-left:6px;">Ver no site</span></a>`
          : ''}
      </div>
    </header>

    <nav class="study-editor-tabs" id="studyTabs">
      ${tabButton('content',  'Conteúdo',     'edit')}
      ${tabButton('meetings', 'Encontros',    'calendar')}
      ${tabButton('resources','Materiais',    'book')}
      ${tabButton('settings', 'Configurações','filter')}
    </nav>

    <div class="study-editor-body" id="studyTabBody"></div>
  `;

  root.querySelector('#studyTabs').addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-tab]');
    if (!btn) return;
    activeTab = btn.dataset.tab;
    root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === activeTab));
    renderTab();
  });
}

function tabButton(id, label, iconName) {
  const active = activeTab === id ? ' is-active' : '';
  return `<button class="study-editor-tab${active}" data-tab="${id}">
    ${icon(iconName, { size: 14 })}<span style="margin-left:6px;">${label}</span>
  </button>`;
}

function renderTab() {
  switch (activeTab) {
    case 'content':   return renderContentTab();
    case 'meetings':  return renderMeetingsTab();
    case 'resources': return renderResourcesTab();
    case 'settings':  return renderSettingsTab();
  }
}

// =========================================================================
// ABA 1: CONTEÚDO
// =========================================================================
function renderContentTab() {
  const body = document.getElementById('studyTabBody');
  body.innerHTML = `
    <div class="study-tab study-tab--content">
      <section class="study-section">
        <h3>Cabeçalho da página</h3>
        <p class="study-section__hint">O que aparece no topo da landing page do grupo.</p>
        <label class="study-field">
          <span>Eyebrow (linha pequena acima do título)</span>
          <input type="text" data-field="hero_eyebrow" value="${escapeAttr(page.hero_eyebrow || '')}" placeholder="Ex.: Grupo de Estudo · TULIPA" />
        </label>
        <label class="study-field">
          <span>Subtítulo (linha em itálico abaixo do título)</span>
          <input type="text" data-field="hero_subtitle" value="${escapeAttr(page.hero_subtitle || '')}" placeholder="Ex.: Encontros quinzenais com a clínica junguiana" />
        </label>
        <label class="study-field">
          <span>Parágrafo de boas-vindas (lede)</span>
          <textarea data-field="lede" rows="3" placeholder="Como você apresenta esse grupo para alguém que nunca participou.">${escapeHtml(page.lede || '')}</textarea>
        </label>
      </section>

      <section class="study-section">
        <h3>Sobre este grupo</h3>
        <p class="study-section__hint">Descrição rica — pode usar negrito, listas, citações. Markdown leve (Ctrl+B / Ctrl+I).</p>
        <textarea data-field="about_md" rows="10" placeholder="## Sobre este grupo&#10;&#10;Texto livre em markdown...">${escapeHtml(page.about_md || '')}</textarea>
      </section>

      <section class="study-section">
        <h3>Como funciona</h3>
        <p class="study-section__hint">Método, ritmo, expectativas. Opcional — se vazio, não aparece na página.</p>
        <textarea data-field="method_md" rows="8" placeholder="### Como funciona&#10;&#10;- Encontros quinzenais&#10;- Leitura prévia opcional&#10;- ...">${escapeHtml(page.method_md || '')}</textarea>
      </section>
    </div>
  `;

  // attach markdown editors nos textareas md
  body.querySelectorAll('textarea[data-field$="_md"]').forEach((ta) => attachMarkdownEditor(ta));

  bindAutosaveFields(body);
}

// =========================================================================
// ABA 2: ENCONTROS & FICHAMENTOS
// =========================================================================
async function renderMeetingsTab() {
  const body = document.getElementById('studyTabBody');
  body.innerHTML = `
    <div class="study-tab study-tab--meetings">
      <div class="study-loading">
        <span class="pages-bloom"><span class="pages-signet">${stampSeal({ size: 22 })}</span></span>
        <p>Buscando encontros e fichamentos…</p>
      </div>
    </div>
  `;

  const [meetingsRes, fichamentosRes] = await Promise.all([
    getStudyGroupMeetings(page.group_id),
    getStudyGroupFichamentos(page.group_id),
  ]);

  if (meetingsRes.error) {
    body.innerHTML = errorBlock('Erro ao buscar encontros: ' + meetingsRes.error.message);
    return;
  }
  if (fichamentosRes.error) {
    body.innerHTML = errorBlock('Erro ao buscar fichamentos: ' + fichamentosRes.error.message);
    return;
  }

  const meetings = meetingsRes.data;
  const fichamentos = fichamentosRes.data;

  // agrupa fichamentos por meeting_id
  const fichByMeeting = new Map();
  const fichExtras = [];
  for (const f of fichamentos) {
    if (f.meeting_id) {
      if (!fichByMeeting.has(f.meeting_id)) fichByMeeting.set(f.meeting_id, []);
      fichByMeeting.get(f.meeting_id).push(f);
    } else {
      fichExtras.push(f);
    }
  }

  const hadMeetings = meetings.length > 0;
  const hadFichExtras = fichExtras.length > 0;

  body.innerHTML = `
    <div class="study-tab study-tab--meetings">
      <section class="study-section">
        <header class="study-section__head">
          <div>
            <h3>Encontros realizados</h3>
            <p class="study-section__hint">
              Os encontros são criados pela <strong>Secretaria</strong> (presença).
              Os fichamentos são criados pela <strong>Pesquisa</strong>.
              Aqui você só visualiza o que está vinculado a este grupo.
            </p>
          </div>
          <a class="btn btn--ghost btn--small" href="#/presenca/grupos/${escapeAttr(page.group_id)}" target="_blank">
            ${icon('external', { size: 12 })}<span style="margin-left:6px;">Abrir na Secretaria</span>
          </a>
        </header>

        ${hadMeetings ? `
          <div class="study-timeline">
            ${meetings.map((m) => meetingRowHtml(m, fichByMeeting.get(m.id) || [])).join('')}
          </div>
        ` : `
          <div class="study-empty">
            <p>Nenhum encontro registrado ainda. Quando a secretaria criar encontros pra esse grupo, eles aparecem aqui automaticamente.</p>
          </div>
        `}
      </section>

      ${hadFichExtras ? `
        <section class="study-section">
          <h3>Fichamentos sem encontro vinculado</h3>
          <p class="study-section__hint">
            Fichamentos que a Pesquisa criou pro grupo mas não vinculou a um encontro específico.
          </p>
          <div class="study-fichamentos">
            ${fichExtras.map(fichamentoCardHtml).join('')}
          </div>
        </section>
      ` : ''}
    </div>
  `;

  body.querySelectorAll('[data-ficho-toggle]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.fichoToggle;
      const body2 = body.querySelector(`[data-ficho-body="${id}"]`);
      if (body2) body2.toggleAttribute('hidden');
      const chev = el.querySelector('.study-fich__chev');
      if (chev) chev.classList.toggle('is-open');
    });
  });
}

function meetingRowHtml(m, fichs) {
  const date = new Date(m.date + 'T12:00:00');
  const dateLabel = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  const statusLabel = { happened: 'realizado', scheduled: 'agendado', cancelled: 'cancelado' }[m.status] || m.status;
  const statusClass = { happened: 'success', scheduled: 'sage', cancelled: 'rose' }[m.status] || 'muted';
  return `
    <article class="study-meeting study-meeting--${statusClass}">
      <header class="study-meeting__head">
        <div class="study-meeting__date">
          <strong>${escapeHtml(dateLabel)}</strong>
          <span class="study-meeting__status">${escapeHtml(statusLabel)}</span>
        </div>
        ${fichs.length > 0 ? `<span class="study-meeting__count">${fichs.length} fichamento${fichs.length === 1 ? '' : 's'}</span>` : ''}
      </header>
      ${m.notes ? `<p class="study-meeting__notes">${escapeHtml(m.notes)}</p>` : ''}
      ${fichs.length > 0 ? `
        <div class="study-fichamentos">
          ${fichs.map(fichamentoCardHtml).join('')}
        </div>
      ` : ''}
    </article>
  `;
}

function fichamentoCardHtml(f) {
  const created = f.created_at ? new Date(f.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' }) : '';
  return `
    <article class="study-fich">
      <header class="study-fich__head" data-ficho-toggle="${escapeAttr(f.id)}" tabindex="0">
        <span class="study-fich__chev">${icon('chevron', { size: 12 })}</span>
        <div class="study-fich__main">
          <strong>${escapeHtml(f.title || '(sem título)')}</strong>
          <span class="study-fich__meta">criado em ${escapeHtml(created)}</span>
        </div>
      </header>
      <div class="study-fich__body" data-ficho-body="${escapeAttr(f.id)}" hidden>
        ${f.body
          ? `<div class="study-fich__content">${renderFichamentoBody(f.body)}</div>`
          : `<p class="muted" style="font-style: italic;">(corpo vazio)</p>`}
      </div>
    </article>
  `;
}

function renderFichamentoBody(body) {
  // Body é markdown leve (mesmo do markdown-editor da Pesquisa).
  return mdToHtml(body || '');
}

// =========================================================================
// ABA 3: MATERIAIS (RESOURCES)
// =========================================================================
let resourcesCache = [];
let resourcesFilter = 'all';

async function renderResourcesTab() {
  const body = document.getElementById('studyTabBody');
  body.innerHTML = `
    <div class="study-tab study-tab--resources">
      <div class="study-loading">
        <span class="pages-bloom"><span class="pages-signet">${stampSeal({ size: 22 })}</span></span>
        <p>Carregando materiais…</p>
      </div>
    </div>
  `;

  const { data, error } = await getStudyGroupResources(page.id);
  if (error) {
    body.innerHTML = errorBlock('Erro ao buscar materiais: ' + error.message);
    return;
  }
  resourcesCache = data;

  drawResources();
}

function drawResources() {
  const body = document.getElementById('studyTabBody');
  const counts = { all: resourcesCache.length };
  for (const grp of RESOURCE_GROUPS) {
    counts[grp.value] = resourcesCache.filter((r) => RESOURCE_KINDS.find((k) => k.value === r.kind)?.group === grp.value).length;
  }

  body.innerHTML = `
    <div class="study-tab study-tab--resources">
      <section class="study-section">
        <header class="study-section__head">
          <div>
            <h3>Material complementar</h3>
            <p class="study-section__hint">
              Vídeos, leituras, filmes, podcasts e links pro pessoal aprofundar fora dos encontros.
              Use os tipos certos pra cada um aparecer com o visual adequado na LP.
            </p>
          </div>
          <button class="btn btn--primary btn--small" data-action="add">
            ${icon('plus', { size: 12 })}<span style="margin-left:6px;">Adicionar material</span>
          </button>
        </header>

        <div class="study-resources-filter">
          <button class="study-chip ${resourcesFilter === 'all' ? 'is-active' : ''}" data-filter="all">
            todos <span>${counts.all}</span>
          </button>
          ${RESOURCE_GROUPS.map((g) => `
            <button class="study-chip ${resourcesFilter === g.value ? 'is-active' : ''}" data-filter="${escapeAttr(g.value)}">
              ${icon(g.icon, { size: 11 })}<span style="margin-left:4px;">${escapeHtml(g.label)}</span> <span>${counts[g.value]}</span>
            </button>
          `).join('')}
        </div>

        <div class="study-resources-list" id="resourcesList"></div>
      </section>
    </div>
  `;

  body.querySelector('[data-action="add"]').addEventListener('click', openResourceForm);
  body.querySelectorAll('[data-filter]').forEach((el) => {
    el.addEventListener('click', () => {
      resourcesFilter = el.dataset.filter;
      drawResources();
    });
  });

  const list = document.getElementById('resourcesList');
  const filtered = resourcesFilter === 'all'
    ? resourcesCache
    : resourcesCache.filter((r) => RESOURCE_KINDS.find((k) => k.value === r.kind)?.group === resourcesFilter);

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="study-empty">
        <p>${resourcesFilter === 'all'
          ? 'Nenhum material ainda. Adicione vídeos, livros, filmes ou links pra enriquecer o estudo.'
          : 'Nenhum material desse tipo. Tente outro filtro ou adicione um novo.'}</p>
      </div>
    `;
    return;
  }

  list.innerHTML = filtered.map(resourceRowHtml).join('');

  // drag-drop
  bindResourceDragDrop(list);

  list.querySelectorAll('[data-resource-id]').forEach((row) => {
    row.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-action]');
      if (!btn) return;
      ev.preventDefault();
      const id = row.dataset.resourceId;
      const r = resourcesCache.find((x) => x.id === id);
      if (!r) return;
      handleResourceAction(btn.dataset.action, r);
    });
  });
}

function resourceRowHtml(r) {
  const kind = RESOURCE_KINDS.find((k) => k.value === r.kind);
  const kindIcon = kind?.icon || 'star';
  const yt = r.kind === 'youtube' ? youtubeId(r.url) : null;
  const drv = r.kind === 'drive' ? driveInfo(r.url) : null;

  let previewHtml = '';
  if (yt) {
    previewHtml = `<div class="study-resource__embed"><iframe src="https://www.youtube.com/embed/${encodeURIComponent(yt)}" allowfullscreen loading="lazy"></iframe></div>`;
  } else if (drv) {
    const src = drv.kind === 'file'
      ? `https://drive.google.com/file/d/${encodeURIComponent(drv.id)}/preview`
      : `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(drv.id)}`;
    previewHtml = `<div class="study-resource__embed study-resource__embed--drive"><iframe src="${escapeAttr(src)}" allowfullscreen loading="lazy"></iframe></div>`;
  }

  return `
    <article class="study-resource ${r.is_hidden ? 'is-hidden' : ''}" data-resource-id="${escapeAttr(r.id)}" draggable="true">
      <div class="study-resource__handle" aria-hidden="true">${icon('drag', { size: 14 })}</div>
      <div class="study-resource__icon">${icon(kindIcon, { size: 18 })}</div>
      <div class="study-resource__main">
        <header class="study-resource__head">
          <strong>${escapeHtml(r.title)}</strong>
          <span class="study-resource__kind">${escapeHtml(resourceKindLabel(r.kind))}</span>
          ${r.is_hidden ? `<span class="study-resource__badge">oculto</span>` : ''}
        </header>
        ${r.description ? `<p class="study-resource__desc">${escapeHtml(r.description)}</p>` : ''}
        ${r.author || r.year ? `<p class="study-resource__meta">${[r.author, r.year].filter(Boolean).map(escapeHtml).join(' · ')}</p>` : ''}
        ${r.url ? `<a class="study-resource__url" href="${escapeAttr(r.url)}" target="_blank" rel="noopener">${escapeHtml(truncate(r.url, 90))} ↗</a>` : ''}
        ${previewHtml}
      </div>
      <div class="study-resource__actions">
        <button class="icon-btn" data-action="hide" title="${r.is_hidden ? 'Mostrar' : 'Ocultar'}">${icon(r.is_hidden ? 'eye-off' : 'eye', { size: 12 })}</button>
        <button class="icon-btn" data-action="edit" title="Editar">${icon('edit', { size: 12 })}</button>
        <button class="icon-btn icon-btn--danger" data-action="delete" title="Remover">${icon('trash', { size: 12 })}</button>
      </div>
    </article>
  `;
}

async function handleResourceAction(action, r) {
  if (action === 'hide') {
    const { error } = await updateResource(r.id, { is_hidden: !r.is_hidden });
    if (error) return toastError('Erro: ' + error.message);
    r.is_hidden = !r.is_hidden;
    drawResources();
    return;
  }
  if (action === 'edit') {
    openResourceForm(r);
    return;
  }
  if (action === 'delete') {
    if (!confirm(`Remover "${r.title}"?`)) return;
    const { error } = await deleteResource(r.id);
    if (error) return toastError('Erro: ' + error.message);
    resourcesCache = resourcesCache.filter((x) => x.id !== r.id);
    drawResources();
    toastSuccess('Material removido.');
  }
}

function openResourceForm(existing = null) {
  document.querySelectorAll('.container-prompt').forEach((el) => el.remove());

  const isEdit = !!existing?.id;
  const r = existing || { kind: 'youtube', title: '', description: '', url: '', author: '', year: '' };

  const modal = document.createElement('div');
  modal.className = 'container-prompt';
  modal.innerHTML = `
    <div class="container-prompt__box" style="width: min(640px, 100%);">
      <header class="container-prompt__head">
        <div>
          <p class="container-prompt__crumb">material complementar</p>
          <h3>${isEdit ? 'Editar' : 'Adicionar'} material</h3>
          <p class="container-prompt__desc">Cole o link, preencha o título e escolha o tipo. Embed inline pra YouTube e Drive.</p>
        </div>
        <button class="icon-btn" data-action="cancel" aria-label="Fechar">${icon('x', { size: 16 })}</button>
      </header>
      <div class="container-prompt__body">
        <label class="container-prompt__field">
          <span>Tipo *</span>
          <select id="rKind">
            ${RESOURCE_KINDS.map((k) => `<option value="${k.value}" ${r.kind === k.value ? 'selected' : ''}>${escapeHtml(k.label)}</option>`).join('')}
          </select>
        </label>
        <label class="container-prompt__field">
          <span>Título *</span>
          <input type="text" id="rTitle" value="${escapeAttr(r.title || '')}" placeholder="Ex.: Aula 3 — Sombra e individuação" />
        </label>
        <label class="container-prompt__field">
          <span>URL</span>
          <input type="text" id="rUrl" value="${escapeAttr(r.url || '')}" placeholder="https://… (YouTube/Drive/livro/etc)" />
          <small class="container-prompt__hint">Pra YouTube e Drive, qualquer URL válida (watch, share, embed) é aceita.</small>
        </label>
        <label class="container-prompt__field">
          <span>Descrição curta</span>
          <textarea id="rDesc" rows="2" placeholder="Resumo de uma linha ou duas. Opcional.">${escapeHtml(r.description || '')}</textarea>
        </label>
        <div class="container-prompt__row" style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px;">
          <label class="container-prompt__field">
            <span>Autor / Diretor / Apresentador</span>
            <input type="text" id="rAuthor" value="${escapeAttr(r.author || '')}" placeholder="Ex.: Marie-Louise von Franz" />
          </label>
          <label class="container-prompt__field">
            <span>Ano</span>
            <input type="number" id="rYear" value="${escapeAttr(r.year || '')}" placeholder="1980" min="1500" max="2099" />
          </label>
        </div>
      </div>
      <footer class="container-prompt__foot">
        <button class="btn btn--ghost btn--small" data-action="cancel">Cancelar</button>
        <button class="btn btn--primary" data-action="save">${isEdit ? 'Salvar' : 'Adicionar'}</button>
      </footer>
    </div>
  `;
  document.body.appendChild(modal);

  setTimeout(() => modal.querySelector('#rTitle')?.focus(), 80);

  modal.addEventListener('click', async (ev) => {
    const action = ev.target.closest('[data-action]')?.dataset?.action;
    if (action === 'cancel' || ev.target === modal) {
      modal.remove();
      return;
    }
    if (action === 'save') {
      const payload = {
        kind: modal.querySelector('#rKind').value,
        title: modal.querySelector('#rTitle').value.trim(),
        description: modal.querySelector('#rDesc').value.trim(),
        url: modal.querySelector('#rUrl').value.trim(),
        author: modal.querySelector('#rAuthor').value.trim(),
        year: parseInt(modal.querySelector('#rYear').value, 10) || null,
      };
      if (!payload.title) {
        toastError('Título é obrigatório.');
        return;
      }
      modal.querySelector('[data-action="save"]').disabled = true;
      if (isEdit) {
        const { error } = await updateResource(existing.id, payload);
        if (error) return toastError('Erro: ' + error.message);
        Object.assign(existing, payload);
      } else {
        const { data, error } = await createResource(page.id, { ...payload, sort_order: resourcesCache.length });
        if (error) return toastError('Erro: ' + error.message);
        resourcesCache.push(data);
      }
      modal.remove();
      drawResources();
      toastSuccess(isEdit ? 'Material atualizado.' : 'Material adicionado.');
    }
  });
}

function bindResourceDragDrop(container) {
  let dragged = null;
  container.addEventListener('dragstart', (e) => {
    const row = e.target.closest('[data-resource-id]');
    if (!row) return;
    dragged = row;
    row.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  container.addEventListener('dragover', (e) => {
    if (!dragged) return;
    e.preventDefault();
    const target = e.target.closest('[data-resource-id]');
    if (!target || target === dragged) return;
    const rect = target.getBoundingClientRect();
    const before = (e.clientY - rect.top) < rect.height / 2;
    container.insertBefore(dragged, before ? target : target.nextSibling);
  });
  container.addEventListener('dragend', async () => {
    if (!dragged) return;
    dragged.classList.remove('is-dragging');
    const orderedIds = Array.from(container.querySelectorAll('[data-resource-id]')).map((el) => el.dataset.resourceId);
    dragged = null;
    const { error } = await reorderResources(page.id, orderedIds);
    if (error) toastError('Erro ao salvar ordem: ' + error.message);
    else {
      // atualiza cache local
      resourcesCache.sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id));
      resourcesCache.forEach((r, i) => (r.sort_order = i));
    }
  });
}

// =========================================================================
// ABA 4: CONFIGURAÇÕES
// =========================================================================
function renderSettingsTab() {
  const body = document.getElementById('studyTabBody');
  body.innerHTML = `
    <div class="study-tab study-tab--settings">
      <section class="study-section">
        <h3>Aparência</h3>

        <label class="study-field">
          <span>Imagem de capa (URL — opcional)</span>
          <input type="url" data-field="cover_image_url" value="${escapeAttr(page.cover_image_url || '')}" placeholder="https://… (imagem JPG/PNG/WEBP)" />
          <small>
            Se preencher, esta imagem substitui o símbolo SVG nos cards e no hero.
            Recomendado: 1200×800 (ratio 3:2), até 500KB.
            Pode usar imagens do Unsplash, Wikimedia, Google Drive (link compartilhado) ou Imgur.
          </small>
        </label>

        <div class="study-cover-preview" id="coverPreview">
          ${page.cover_image_url
            ? `<img src="${escapeAttr(page.cover_image_url)}" alt="" onerror="this.parentElement.classList.add('is-broken')" />
               <div class="study-cover-preview__broken">⚠ não consegui carregar a imagem</div>`
            : `<div class="study-cover-preview__empty">${coverIcon(page.cover_emoji || 'book', 48)}<p>sem imagem — usando símbolo</p></div>`}
        </div>

        <div class="study-row">
          <label class="study-field study-field--narrow">
            <span>Símbolo da capa <small>(usado se não houver imagem)</small></span>
            <div class="study-new-emojis" id="settingsEmoji">
              ${COVER_ICONS.map((ic) => `<button type="button" class="study-new-emoji ${page.cover_emoji === ic.value ? 'is-active' : ''}" data-emoji="${escapeAttr(ic.value)}" title="${escapeAttr(ic.label)}" aria-label="${escapeAttr(ic.label)}">${coverIcon(ic.value, 22)}</button>`).join('')}
            </div>
          </label>
          <label class="study-field study-field--narrow">
            <span>Cor de destaque</span>
            <div class="study-new-accents" id="settingsAccent">
              ${ACCENT_OPTIONS.map((a) => `
                <button type="button" class="study-new-accent ${page.accent_color === a.value ? 'is-active' : ''}"
                        data-accent="${escapeAttr(a.value)}" style="--accent: ${a.hex}" title="${escapeAttr(a.label)}">
                  <span class="study-new-accent__dot"></span>
                  <span>${escapeHtml(a.label)}</span>
                </button>
              `).join('')}
            </div>
          </label>
        </div>
      </section>

      <section class="study-section">
        <h3>URL e visibilidade</h3>
        <label class="study-field">
          <span>Slug (URL)</span>
          <div class="study-new-slug">
            <code>/atividades/grupos-de-estudo/grupo.html?id=</code>
            <input type="text" data-field="slug" value="${escapeAttr(page.slug || '')}" placeholder="meu-grupo" />
          </div>
          <small>Mudar o slug invalida links antigos. Use só letras minúsculas, números e hífens.</small>
        </label>

        <div class="study-toggle-row">
          <div>
            <strong>Publicar no site</strong>
            <p>Quando ligado, o público consegue acessar essa folha (e o público anônimo também).</p>
          </div>
          <label class="study-switch">
            <input type="checkbox" data-field="is_published" ${page.is_published ? 'checked' : ''} />
            <span></span>
          </label>
        </div>

        <div class="study-toggle-row">
          <div>
            <strong>Aparecer na LP "Grupos de Estudo"</strong>
            <p>Quando ligado, aparece como card na <code>/atividades/grupos-de-estudo.html</code>. Quando desligado, só quem tem o link direto entra.</p>
          </div>
          <label class="study-switch">
            <input type="checkbox" data-field="show_on_index" ${page.show_on_index ? 'checked' : ''} />
            <span></span>
          </label>
        </div>

        <label class="study-field study-field--narrow" style="max-width: 220px;">
          <span>Ordem nos cards (menor = primeiro)</span>
          <input type="number" data-field="sort_order" value="${page.sort_order || 0}" min="-100" max="100" />
        </label>
      </section>

      <section class="study-section study-section--danger">
        <h3>⚠️ Zona de perigo</h3>
        <p class="study-section__hint">
          Remover a folha desfaz a landing page mas <strong>não apaga o grupo</strong> na Secretaria
          (presença, encontros, fichamentos permanecem). Você pode recriar a página depois.
        </p>
        <button class="btn btn--ghost btn--small" id="deletePageBtn" style="color: var(--rose, #9F5A6B); border-color: var(--rose, #9F5A6B);">
          ${icon('trash', { size: 12 })}<span style="margin-left:6px;">Remover folha</span>
        </button>
      </section>
    </div>
  `;

  // emoji
  body.querySelectorAll('#settingsEmoji [data-emoji]').forEach((el) => {
    el.addEventListener('click', async () => {
      const v = el.dataset.emoji;
      body.querySelectorAll('#settingsEmoji [data-emoji]').forEach((e) => e.classList.toggle('is-active', e.dataset.emoji === v));
      await persistField('cover_emoji', v);
    });
  });
  body.querySelectorAll('#settingsAccent [data-accent]').forEach((el) => {
    el.addEventListener('click', async () => {
      const v = el.dataset.accent;
      body.querySelectorAll('#settingsAccent [data-accent]').forEach((e) => e.classList.toggle('is-active', e.dataset.accent === v));
      await persistField('accent_color', v);
    });
  });

  // toggles + slug + sort_order + cover_image_url
  bindAutosaveFields(body);

  // preview live da imagem de capa
  const coverInput = body.querySelector('[data-field="cover_image_url"]');
  if (coverInput) {
    coverInput.addEventListener('input', () => updateCoverPreview(coverInput.value));
  }

  // delete
  document.getElementById('deletePageBtn').addEventListener('click', async () => {
    if (!confirm(`Remover a folha de "${page.group_name}"?\n\nA presença, encontros e fichamentos permanecem na Secretaria.`)) return;
    if (!confirm('Tem certeza? Esta ação não pode ser desfeita.')) return;
    const { error } = await deleteStudyGroupPage(page.id);
    if (error) return toastError('Erro: ' + error.message);
    toastSuccess('Folha removida.');
    ctxRef.api.navigate('#/grupos-estudo');
  });
}

function updateCoverPreview(url) {
  const prev = document.getElementById('coverPreview');
  if (!prev) return;
  const trimmed = (url || '').trim();
  if (!trimmed) {
    prev.classList.remove('is-broken');
    prev.innerHTML = `<div class="study-cover-preview__empty">${coverIcon(page.cover_emoji || 'book', 48)}<p>sem imagem — usando símbolo</p></div>`;
    return;
  }
  prev.classList.remove('is-broken');
  prev.innerHTML = `
    <img src="${escapeAttr(trimmed)}" alt="" onerror="this.parentElement.classList.add('is-broken')" />
    <div class="study-cover-preview__broken">⚠ não consegui carregar a imagem</div>
  `;
}

// =========================================================================
// AUTOSAVE helpers
// =========================================================================
function bindAutosaveFields(scope) {
  scope.querySelectorAll('[data-field]').forEach((el) => {
    const field = el.dataset.field;
    const handler = () => {
      const value = el.type === 'checkbox' ? el.checked
                  : el.type === 'number'   ? (parseInt(el.value, 10) || 0)
                  : el.value;
      scheduleSave(field, value);
    };
    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
  });
}

function scheduleSave(field, value) {
  if (saveTimers.has(field)) clearTimeout(saveTimers.get(field));
  saveTimers.set(field, setTimeout(() => persistField(field, value), 800));
  setSaveStateDirty();
}

async function persistField(field, value) {
  savingFields.add(field);
  setSaveStateSaving();
  const { data, error } = await updateStudyGroupPage(page.id, { [field]: value });
  savingFields.delete(field);
  saveTimers.delete(field);
  if (error) {
    setSaveStateError(error.message);
    if (error.message?.includes('slug')) {
      toastError('Slug já está em uso ou formato inválido.');
    } else {
      toastError('Erro ao salvar: ' + error.message);
    }
    return;
  }
  // atualiza page local
  page[field] = value;
  if (data) {
    Object.assign(page, data);
  }
  if (savingFields.size === 0) setSaveStateSaved();
}

function setSaveStateDirty() {
  const el = document.getElementById('saveState');
  if (!el) return;
  el.className = 'study-editor-savestate is-dirty';
  el.innerHTML = `${icon('edit', { size: 12 })}<span style="margin-left:5px;">não salvo</span>`;
}
function setSaveStateSaving() {
  const el = document.getElementById('saveState');
  if (!el) return;
  el.className = 'study-editor-savestate is-saving';
  el.innerHTML = `${icon('refresh', { size: 12 })}<span style="margin-left:5px;">salvando…</span>`;
}
function setSaveStateSaved() {
  const el = document.getElementById('saveState');
  if (!el) return;
  el.className = 'study-editor-savestate is-saved';
  el.innerHTML = `${icon('check', { size: 12 })}<span style="margin-left:5px;">tudo salvo</span>`;
}
function setSaveStateError(msg) {
  const el = document.getElementById('saveState');
  if (!el) return;
  el.className = 'study-editor-savestate is-error';
  el.innerHTML = `${icon('alert', { size: 12 })}<span style="margin-left:5px;">erro</span>`;
  el.title = msg;
}

// =========================================================================
// utils
// =========================================================================
function errorBlock(msg) {
  return `
    <div class="pages-empty-v2">
      <div class="pages-empty-v2__art">${icon('alert', { size: 52 })}</div>
      <h3>Erro</h3>
      <p>${escapeHtml(msg)}</p>
    </div>
  `;
}

function truncate(s, n) {
  if (!s) return '';
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

function stripHtml(html) {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = String(html);
  return tmp.textContent.replace(/\s+/g, ' ').trim();
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function escapeAttr(s) { return escapeHtml(s); }
