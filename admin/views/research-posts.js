// Posts de Instagram — escritos pela Pesquisa, enviados à Mídia.

import { icon } from '../icons.js';
import * as data from '../research/data.js';
import { renderResearchNav } from './research-nav.js';
import { toastSuccess, toastError } from '../toast.js';
import { attachMarkdownEditor } from '../markdown-editor.js';

const STATUS_META = {
  draft:         { label: 'rascunho',  tone: 'muted' },
  sent_to_media: { label: 'na mídia',  tone: 'gold' },
  scheduled:     { label: 'agendado',  tone: 'info' },
  published:     { label: 'publicado', tone: 'success' },
};

export async function renderResearchPosts(ctx) {
  const { root } = ctx;

  root.innerHTML = `
    <div class="view">
      ${renderResearchNav('posts')}

      <header class="view__header" style="display:flex; align-items:flex-end; justify-content:space-between; gap:14px;">
        <div>
          <h1>Posts de Instagram</h1>
          <p class="view__lede">Escreva e organize as ideias de post. Quando estiver pronto, mande pra Mídia.</p>
        </div>
        <button class="btn btn--primary" id="newPostBtn">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Novo post</span></button>
      </header>

      <div id="postsList" class="empty-state"><div class="skel skel--block"></div></div>
    </div>
  `;

  document.getElementById('newPostBtn').addEventListener('click', () => openPostForm(null));
  await loadPosts();
}

async function loadPosts() {
  const box = document.getElementById('postsList');
  const { data: posts, error } = await data.listPosts();
  if (error) { box.innerHTML = `<p class="muted">${error.message}</p>`; return; }
  if (!posts?.length) {
    box.innerHTML = `
      <div class="att-empty">
        <div class="att-empty__art">${icon('spark', { size: 56 })}</div>
        <h3>Nenhum post ainda</h3>
        <p>Comece transformando um fichamento em conteúdo pra rede.</p>
        <button class="btn btn--primary" id="emptyNew">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Escrever primeiro</span></button>
      </div>
    `;
    document.getElementById('emptyNew').addEventListener('click', () => openPostForm(null));
    return;
  }

  box.className = '';
  const grouped = {
    draft: posts.filter((p) => p.status === 'draft'),
    sent_to_media: posts.filter((p) => p.status === 'sent_to_media'),
    scheduled: posts.filter((p) => p.status === 'scheduled'),
    published: posts.filter((p) => p.status === 'published'),
  };
  box.innerHTML = `
    ${grouped.draft.length ? `<h2>Rascunhos</h2><div class="res-post-grid">${grouped.draft.map(postCard).join('')}</div>` : ''}
    ${grouped.sent_to_media.length ? `<h2 style="margin-top:24px;">Enviados à Mídia</h2><div class="res-post-grid">${grouped.sent_to_media.map(postCard).join('')}</div>` : ''}
    ${grouped.scheduled.length ? `<h2 style="margin-top:24px;">Agendados pela Mídia</h2><div class="res-post-grid">${grouped.scheduled.map(postCard).join('')}</div>` : ''}
    ${grouped.published.length ? `<h2 style="margin-top:24px;">Publicados</h2><div class="res-post-grid">${grouped.published.map(postCard).join('')}</div>` : ''}
  `;

  for (const card of box.querySelectorAll('.res-post-card')) {
    card.addEventListener('click', async () => {
      const { data: full } = await data.getPost(card.dataset.id);
      if (full) openPostForm(full);
    });
  }
}

function postCard(p) {
  const meta = STATUS_META[p.status] || STATUS_META.draft;
  const preview = (p.body || '').replace(/\s+/g, ' ').slice(0, 140);
  return `
    <article class="res-post-card res-post-card--${p.status}" data-id="${escapeAttr(p.id)}">
      <header class="res-post-card__head">
        <h3>${escapeHtml(p.title)}</h3>
        <span class="pill ${meta.tone === 'gold' ? 'pill--gold' : meta.tone === 'success' ? 'pill--success' : ''}">${escapeHtml(meta.label)}</span>
      </header>
      ${p.research_note ? `<p class="muted" style="font-size:12px; margin:0;">baseado em: ${escapeHtml(p.research_note.title)}</p>` : ''}
      ${preview ? `<p class="res-post-card__preview">${escapeHtml(preview)}${p.body.length > 140 ? '…' : ''}</p>` : '<p class="muted" style="font-style:italic;">sem conteúdo</p>'}
    </article>
  `;
}

export async function openPostForm(existing, opts = {}) {
  document.querySelectorAll('.block-drawer-overlay').forEach((el) => el.remove());

  const isEdit = !!existing;
  const prefilledNote = opts.prefilledNote || null;
  const prefilledStatus = opts.prefilledStatus || null;
  const prefilledNoteId = prefilledNote?.id || existing?.research_note_id || null;
  const initialStatus = existing?.status || prefilledStatus || 'draft';
  const initialTitle = existing?.title || (prefilledNote ? prefilledNote.title : '');
  const initialResearchGroupId = existing?.research_group_id
    || prefilledNote?.research_group_id
    || null;

  const [{ data: notes }, { data: researchTeams }] = await Promise.all([
    data.listNotes({ limit: 80 }),
    data.listGroups(),
  ]);

  const overlay = document.createElement('div');
  overlay.className = 'block-drawer-overlay';
  overlay.innerHTML = `
    <div class="block-drawer block-drawer--wide">
      <header class="block-drawer__head">
        <div>
          <p class="block-drawer__crumb">${isEdit ? 'Editando post' : 'Novo post'}</p>
          <h2><span class="block-drawer__icon">${icon('spark', { size: 26 })}</span> ${isEdit ? escapeHtml(existing.title) : 'Post de Instagram'}</h2>
        </div>
        <button class="icon-btn" data-action="close">${icon('x', { size: 16 })}</button>
      </header>
      <form class="block-drawer__body" id="postForm">
        <label class="drawer-field">
          <span class="drawer-field__label">Título interno</span>
          <input type="text" name="title" class="drawer-field__input" required value="${escapeAttr(initialTitle)}" placeholder="Como identificar este post" />
        </label>
        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <label class="drawer-field" style="flex:1; min-width:200px;">
            <span class="drawer-field__label">Fichamento base</span>
            <select name="research_note_id" class="drawer-field__input">
              <option value="">— sem vínculo —</option>
              ${(notes || []).map((n) => `<option value="${escapeAttr(n.id)}" ${prefilledNoteId === n.id ? 'selected' : ''}>${escapeHtml(n.title)}</option>`).join('')}
            </select>
          </label>
          <label class="drawer-field" style="flex:1; min-width:200px;">
            <span class="drawer-field__label">Equipe responsável</span>
            <select name="research_group_id" class="drawer-field__input">
              <option value="">— nenhuma —</option>
              ${(researchTeams || []).map((t) => `<option value="${escapeAttr(t.id)}" ${initialResearchGroupId === t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
            </select>
          </label>
        </div>
        <label class="drawer-field">
          <span class="drawer-field__label">Texto do post</span>
          <textarea name="body" class="drawer-field__input drawer-field__input--tall" rows="10" placeholder="Como vai aparecer no feed">${escapeHtml(existing?.body || prefilledNote?.body || '')}</textarea>
        </label>
        <label class="drawer-field">
          <span class="drawer-field__label">Status</span>
          <select name="status" class="drawer-field__input">
            <option value="draft"         ${initialStatus === 'draft'         ? 'selected' : ''}>Rascunho</option>
            <option value="sent_to_media" ${initialStatus === 'sent_to_media' ? 'selected' : ''}>Enviar pra Mídia</option>
            <option value="scheduled"     ${initialStatus === 'scheduled'     ? 'selected' : ''}>Agendado (controle da Mídia)</option>
            <option value="published"     ${initialStatus === 'published'     ? 'selected' : ''}>Publicado no IG</option>
          </select>
          <p class="drawer-field__hint">Mande pra "Enviar pra Mídia" quando o texto estiver pronto pra ser produzido visualmente.</p>
        </label>
      </form>
      <footer class="block-drawer__foot">
        ${isEdit ? `<button class="btn btn--danger btn--small" data-action="delete">${icon('trash', { size: 14 })}<span style="margin-left:6px;">Excluir</span></button>` : '<span class="spacer"></span>'}
        <span class="spacer"></span>
        <button class="btn btn--ghost" data-action="close">Cancelar</button>
        <button class="btn btn--primary" data-action="save">${isEdit ? 'Salvar' : 'Criar'}</button>
      </footer>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('is-open'));

  const form = overlay.querySelector('#postForm');
  form.addEventListener('submit', (e) => e.preventDefault());
  attachMarkdownEditor(overlay.querySelector('textarea[name="body"]'));

  function close() {
    overlay.classList.remove('is-open');
    setTimeout(() => overlay.remove(), 220);
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);

  overlay.addEventListener('click', async (ev) => {
    if (ev.target === overlay) return close();
    const action = ev.target.closest('[data-action]')?.dataset?.action;
    if (action === 'close') return close();
    if (action === 'delete' && existing) {
      if (!confirm(`Excluir o post "${existing.title}"?`)) return;
      const { error } = await data.deletePost(existing.id);
      if (error) { toastError(error.message); return; }
      toastSuccess('Post excluído.');
      close();
      await loadPosts();
      return;
    }
    if (action === 'save') {
      const fd = new FormData(form);
      const fields = {
        title: String(fd.get('title') || '').trim(),
        body: String(fd.get('body') || ''),
        research_note_id: fd.get('research_note_id') || null,
        research_group_id: fd.get('research_group_id') || null,
        status: String(fd.get('status') || 'draft'),
      };
      if (!fields.title) { toastError('Título é obrigatório.'); return; }
      const { error } = isEdit ? await data.updatePost(existing.id, fields) : await data.createPost(fields);
      if (error) { toastError(error.message); return; }
      const sentNow = !isEdit && fields.status === 'sent_to_media' || (isEdit && existing.status !== 'sent_to_media' && fields.status === 'sent_to_media');
      toastSuccess(sentNow ? 'Post enviado pra Mídia.' : (isEdit ? 'Post atualizado.' : 'Post criado.'));
      close();
      opts.onSaved?.();
      // só recarrega se estivermos na view de posts (loadPosts depende do DOM da view)
      if (document.getElementById('postsList')) {
        await loadPosts();
      }
    }
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
