// TULIPA · admin · Formulários — dashboard (lista / criar / publicar / ocultar).
import * as Forms from '../forms/data.js';
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
        <p class="admin-sub">Crie formulários, publique e receba as respostas aqui.</p>
      </div>
      <button class="btn btn--primary" id="newFormBtn">${icon('plus', { size: 14 })}<span>Novo formulário</span></button>
    </div>
    <div id="formsList" class="forms-grid"><div class="empty-state">Carregando…</div></div>
  `;

  root.querySelector('#newFormBtn').addEventListener('click', async () => {
    const title = prompt('Nome do formulário:', 'Novo formulário');
    if (title === null) return;
    const { data, error } = await Forms.createForm({ title: (title || '').trim() || 'Novo formulário' });
    if (error) return toastError('Erro ao criar: ' + error.message);
    api.navigate(`#/forms/editar/${data.id}`);
  });

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
    return `
      <article class="form-card" data-id="${f.id}" data-slug="${esc(f.slug)}" data-status="${f.status}" data-listed="${f.is_listed}">
        <div class="form-card__top">
          <span class="form-status ${st.cls}">${st.label}</span>
          ${f.is_listed ? '' : `<span class="form-chip" title="Não listada (só por link)">${icon('eye-off', { size: 12 })} oculta</span>`}
        </div>
        <h3 class="form-card__title">${esc(f.title)}</h3>
        <p class="form-card__meta">${f.response_count || 0} resposta(s) · atualizado ${new Date(f.updated_at).toLocaleDateString('pt-BR')}</p>
        <div class="form-card__actions">
          <button class="btn btn--ghost btn--small" data-act="edit">${icon('edit', { size: 12 })}<span>Editar</span></button>
          <button class="btn btn--ghost btn--small" data-act="responses">${icon('pages', { size: 12 })}<span>Respostas (${f.response_count || 0})</span></button>
          <button class="btn btn--ghost btn--small" data-act="toggle-pub">${f.status === 'published' ? 'Despublicar' : 'Publicar'}</button>
          <button class="btn btn--ghost btn--small" data-act="toggle-list">${f.is_listed ? 'Ocultar' : 'Listar'}</button>
          <button class="admin-link-btn" data-act="link" title="Copiar link público">${icon('external', { size: 12 })}</button>
          <button class="admin-link-btn" data-act="dup" title="Duplicar">${icon('refresh', { size: 12 })}</button>
          <button class="admin-link-btn danger" data-act="del" title="Excluir">${icon('trash', { size: 12 })}</button>
        </div>
      </article>`;
  }

  function bind(box) {
    box.querySelectorAll('.form-card').forEach((card) => {
      const id = card.dataset.id;
      const slug = card.dataset.slug;
      card.querySelector('[data-act="edit"]').onclick = () => api.navigate(`#/forms/editar/${id}`);
      card.querySelector('[data-act="responses"]').onclick = () => api.navigate(`#/forms/respostas/${id}`);
      card.querySelector('[data-act="toggle-pub"]').onclick = async () => {
        const next = card.dataset.status === 'published' ? 'draft' : 'published';
        const { error } = await Forms.setFormStatus(id, next);
        if (error) return toastError(error.message);
        toastSuccess(next === 'published' ? 'Publicado!' : 'Despublicado.');
        load();
      };
      card.querySelector('[data-act="toggle-list"]').onclick = async () => {
        const next = card.dataset.listed !== 'true';
        const { error } = await Forms.setFormListed(id, next);
        if (error) return toastError(error.message);
        toastSuccess(next ? 'Listada.' : 'Ocultada (só por link).');
        load();
      };
      card.querySelector('[data-act="link"]').onclick = async () => {
        const url = formPublicUrl(slug);
        try { await navigator.clipboard.writeText(url); toastSuccess('Link copiado!'); }
        catch { prompt('Copie o link:', url); }
      };
      card.querySelector('[data-act="dup"]').onclick = async () => {
        const { error } = await Forms.duplicateForm(id);
        if (error) return toastError(error.message);
        toastSuccess('Duplicado.'); load();
      };
      card.querySelector('[data-act="del"]').onclick = async () => {
        if (!confirm('Excluir este formulário e TODAS as respostas? Não dá pra desfazer.')) return;
        const { error } = await Forms.deleteForm(id);
        if (error) return toastError(error.message);
        toastSuccess('Excluído.'); load();
      };
    });
  }
}
