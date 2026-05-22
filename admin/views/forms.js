// TULIPA · admin · Formulários — dashboard (lista / criar / publicar / ocultar).
import * as Forms from '../forms/data.js';
import { FORM_TEMPLATES, buildFromTemplate } from '../forms/templates.js';
import { icon } from '../icons.js';
import { toastSuccess, toastError } from '../toast.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const STATUS = {
  draft:     { label: 'Rascunho',  cls: 'is-draft' },
  published: { label: 'Publicado', cls: 'is-published' },
  closed:    { label: 'Fechado',   cls: 'is-closed' },
  archived:  { label: 'Arquivado', cls: 'is-archived' },
};

// URL pública do formulário (página única /forms/?f=slug)
export function formPublicUrl(slug) {
  const base = location.origin + location.pathname.replace(/\/admin\/.*$/, '');
  return `${base}/forms/?f=${encodeURIComponent(slug)}`;
}

export async function renderFormsDashboard(ctx) {
  const { root, api } = ctx;
  root.innerHTML = `
    <div class="admin-head">
      <div>
        <h1>Formulários</h1>
        <p class="admin-sub">Crie, publique e receba respostas. Cada cartão tem ações rápidas — o resto vive no menu ⋯.</p>
      </div>
      <button class="btn btn--primary" id="newFormBtn">${icon('plus', { size: 14 })}<span>Novo formulário</span></button>
    </div>
    <div id="formsList" class="forms-grid"><div class="empty-state">Carregando…</div></div>
  `;

  root.querySelector('#newFormBtn').addEventListener('click', () => openTemplatePicker());

  function openTemplatePicker() {
    document.querySelectorAll('.tpl-picker').forEach((el) => el.remove());
    const overlay = document.createElement('div');
    overlay.className = 'tpl-picker';
    overlay.innerHTML = `
      <div class="tpl-picker__box" role="dialog" aria-labelledby="tplTitle">
        <header class="tpl-picker__head">
          <div>
            <h2 id="tplTitle">Começar de um modelo</h2>
            <p class="tpl-picker__sub">Escolha um ponto de partida — você pode editar tudo depois.</p>
          </div>
          <button class="admin-link-btn" data-act="close" aria-label="Fechar">${icon('x', { size: 14 })}</button>
        </header>
        <div class="tpl-picker__grid">
          ${FORM_TEMPLATES.map((t) => `
            <button class="tpl-card" data-tpl="${t.id}" type="button">
              <span class="tpl-card__ico">${icon(t.icon || 'edit', { size: 18 })}</span>
              <strong class="tpl-card__label">${esc(t.label)}</strong>
              <span class="tpl-card__desc">${esc(t.description || '')}</span>
            </button>
          `).join('')}
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
      if (ev.target.closest('[data-act="close"]')) return close();
      const card = ev.target.closest('[data-tpl]');
      if (!card) return;
      const tplId = card.dataset.tpl;
      card.classList.add('is-loading');
      const payload = buildFromTemplate(tplId);
      const { data, error } = await Forms.createForm(payload);
      if (error) { toastError('Erro ao criar: ' + error.message); card.classList.remove('is-loading'); return; }
      close();
      api.navigate(`#/forms/editar/${data.id}`);
    });
  }

  await load();

  async function load() {
    const box = root.querySelector('#formsList');
    const { data, error } = await Forms.listForms();
    if (error) { box.innerHTML = `<div class="empty-state">Erro: ${esc(error.message)}</div>`; return; }
    if (!data.length) {
      box.innerHTML = `<div class="empty-state">Nenhum formulário ainda. Clique em <strong>Novo formulário</strong>.</div>`;
      return;
    }
    box.innerHTML = data.map(cardHtml).join('');
    bind(box);
  }

  function cardHtml(f) {
    const st = STATUS[f.status] || STATUS.draft;
    const date = new Date(f.updated_at).toLocaleDateString('pt-BR');
    const isPub = f.status === 'published';
    return `
      <article class="form-card" data-id="${f.id}" data-slug="${esc(f.slug)}" data-status="${f.status}" data-listed="${f.is_listed}">
        <div class="form-card__top">
          <span class="form-status ${st.cls}">${st.label}</span>
          ${!f.is_listed && isPub ? `<span class="form-chip" title="Só por link — não aparece em listas públicas">${icon('eye-off', { size: 12 })} oculta</span>` : ''}
          <div class="form-card__menu-wrap">
            <button class="admin-link-btn form-card__kebab" data-act="menu" aria-label="Mais opções" title="Mais opções">${icon('drag', { size: 14 })}</button>
            <div class="form-card__menu" hidden>
              <button data-act="toggle-pub">${isPub ? 'Despublicar' : 'Publicar'}</button>
              <button data-act="toggle-list">${f.is_listed ? 'Tornar oculta (só por link)' : 'Listar publicamente'}</button>
              <button data-act="link">Copiar link público</button>
              <button data-act="dup">Duplicar</button>
              <hr>
              <button data-act="del" class="is-danger">Excluir</button>
            </div>
          </div>
        </div>
        <h3 class="form-card__title">${esc(f.title)}</h3>
        <p class="form-card__meta">${f.response_count || 0} resposta(s) · atualizado ${date}</p>
        <div class="form-card__actions">
          <button class="btn btn--ghost btn--small" data-act="edit">${icon('edit', { size: 12 })}<span>Editar</span></button>
          <button class="btn btn--ghost btn--small" data-act="responses">${icon('pages', { size: 12 })}<span>Respostas (${f.response_count || 0})</span></button>
        </div>
      </article>`;
  }

  function closeAllMenus() {
    document.querySelectorAll('.form-card__menu').forEach((m) => { m.hidden = true; });
  }

  function bind(box) {
    box.querySelectorAll('.form-card').forEach((card) => {
      const id = card.dataset.id;
      const slug = card.dataset.slug;
      const menu = card.querySelector('.form-card__menu');

      card.querySelector('[data-act="edit"]').onclick = () => api.navigate(`#/forms/editar/${id}`);
      card.querySelector('[data-act="responses"]').onclick = () => api.navigate(`#/forms/respostas/${id}`);

      card.querySelector('[data-act="menu"]').onclick = (ev) => {
        ev.stopPropagation();
        const wasHidden = menu.hidden;
        closeAllMenus();
        menu.hidden = !wasHidden;
      };

      card.querySelector('[data-act="toggle-pub"]').onclick = async () => {
        closeAllMenus();
        const next = card.dataset.status === 'published' ? 'draft' : 'published';
        const { error } = await Forms.setFormStatus(id, next);
        if (error) return toastError(error.message);
        toastSuccess(next === 'published' ? 'Publicado!' : 'Despublicado.');
        load();
      };
      card.querySelector('[data-act="toggle-list"]').onclick = async () => {
        closeAllMenus();
        const next = card.dataset.listed !== 'true';
        const { error } = await Forms.setFormListed(id, next);
        if (error) return toastError(error.message);
        toastSuccess(next ? 'Listada publicamente.' : 'Oculta — só por link.');
        load();
      };
      card.querySelector('[data-act="link"]').onclick = async () => {
        closeAllMenus();
        const url = formPublicUrl(slug);
        try { await navigator.clipboard.writeText(url); toastSuccess('Link copiado!'); }
        catch { prompt('Copie o link:', url); }
      };
      card.querySelector('[data-act="dup"]').onclick = async () => {
        closeAllMenus();
        const { error } = await Forms.duplicateForm(id);
        if (error) return toastError(error.message);
        toastSuccess('Duplicado.'); load();
      };
      card.querySelector('[data-act="del"]').onclick = async () => {
        closeAllMenus();
        if (!confirm('Excluir este formulário e TODAS as respostas? Não dá pra desfazer.')) return;
        const { error } = await Forms.deleteForm(id);
        if (error) return toastError(error.message);
        toastSuccess('Excluído.'); load();
      };
    });

    // Fecha menu ao clicar fora ou pressionar Escape
    if (!box._menuBound) {
      document.addEventListener('click', closeAllMenus);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAllMenus(); });
      box._menuBound = true;
    }
  }
}
