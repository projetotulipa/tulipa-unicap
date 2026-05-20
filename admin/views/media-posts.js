// Posts recebidos da Pesquisa — diretor cria tarefas a partir deles.

import { icon } from '../icons.js';
import * as data from '../media/data.js';
import * as researchData from '../research/data.js';
import { renderMediaNav } from './media-nav.js';
import { toastSuccess, toastError } from '../toast.js';

export async function renderMediaPosts(ctx) {
  const { root } = ctx;

  root.innerHTML = `
    <div class="view">
      ${renderMediaNav('posts')}

      <header class="view__header">
        <div>
          <h1>Posts recebidos</h1>
          <p class="view__lede">Conteúdo escrito pela Pesquisa, pronto pra virar arte. Crie tarefa pra atribuir a uma equipe ou pessoa.</p>
        </div>
      </header>

      <div id="postsList" class="empty-state"><div class="skel skel--block"></div></div>
    </div>
  `;

  await loadPosts();
}

async function loadPosts() {
  const box = document.getElementById('postsList');
  const { data: posts, error } = await data.listIncomingPosts();
  if (error) { box.innerHTML = `<p class="muted">${error.message}</p>`; return; }
  if (!posts?.length) {
    box.innerHTML = `
      <div class="att-empty">
        <div class="att-empty__art">${icon('spark', { size: 56 })}</div>
        <h3>Nenhum post aguardando</h3>
        <p>Quando a Pesquisa enviar um post, ele aparece aqui pra ser produzido.</p>
      </div>
    `;
    return;
  }
  box.className = '';
  box.innerHTML = `<div class="res-post-grid">${posts.map(postCard).join('')}</div>`;
  for (const card of box.querySelectorAll('.res-post-card')) {
    card.querySelector('[data-action="open"]')?.addEventListener('click', async () => {
      const { data: full } = await researchData.getPost(card.dataset.id);
      if (full) openPostDetail(full);
    });
  }
}

function postCard(p) {
  const statusLabel = p.status === 'scheduled' ? 'agendado' : 'aguardando produção';
  const preview = (p.body || '').replace(/\s+/g, ' ').slice(0, 160);
  return `
    <article class="res-post-card" data-id="${escapeAttr(p.id)}">
      <header class="res-post-card__head">
        <h3>${escapeHtml(p.title)}</h3>
        <span class="pill ${p.status === 'scheduled' ? 'pill--success' : 'pill--gold'}">${escapeHtml(statusLabel)}</span>
      </header>
      ${p.research_note ? `<p class="muted" style="font-size:12px; margin:0;">de "${escapeHtml(p.research_note.title)}"</p>` : ''}
      ${preview ? `<p class="res-post-card__preview">${escapeHtml(preview)}${p.body.length > 160 ? '…' : ''}</p>` : ''}
      <footer style="display:flex; gap:6px; margin-top:10px;">
        <button class="btn btn--ghost btn--small" data-action="open">${icon('edit', { size: 12 })}<span style="margin-left:6px;">Detalhe</span></button>
        <button class="btn btn--primary btn--small" data-action="open">${icon('plus', { size: 12 })}<span style="margin-left:6px;">Criar tarefa</span></button>
      </footer>
    </article>
  `;
}

function openPostDetail(post) {
  document.querySelectorAll('.block-drawer-overlay').forEach((el) => el.remove());

  const overlay = document.createElement('div');
  overlay.className = 'block-drawer-overlay';
  overlay.innerHTML = `
    <div class="block-drawer block-drawer--wide">
      <header class="block-drawer__head">
        <div>
          <p class="block-drawer__crumb">Post recebido</p>
          <h2><span class="block-drawer__icon">${icon('spark', { size: 26 })}</span> ${escapeHtml(post.title)}</h2>
          ${post.research_note ? `<p class="block-drawer__desc">Baseado em: ${escapeHtml(post.research_note.title)}</p>` : ''}
        </div>
        <button class="icon-btn" data-action="close">${icon('x', { size: 16 })}</button>
      </header>
      <div class="block-drawer__body">
        <h3 style="font-family:'Cormorant Garamond',serif; font-style:italic; font-size:18px; color:var(--cream); margin:0 0 8px;">Texto do post</h3>
        <div class="res-text-block">${escapeHtml(post.body || '').replace(/\n/g, '<br/>')}</div>

        ${post.research_note ? `
          <details style="margin-top:18px;">
            <summary class="muted" style="cursor:pointer; font-size:13px;">ver fichamento original</summary>
            <h4 style="margin: 12px 0 6px; color: var(--cream);">${escapeHtml(post.research_note.title)}</h4>
            <div class="res-text-block">${escapeHtml(post.research_note.body || '').replace(/\n/g, '<br/>')}</div>
          </details>
        ` : ''}

        <hr style="margin:24px 0; border:none; border-top:1px solid var(--border);">
        <h3 style="font-family:'Cormorant Garamond',serif; font-style:italic; font-size:18px; color:var(--cream); margin:0 0 8px;">Status do post</h3>
        <label class="drawer-field">
          <select id="postStatusSel" class="drawer-field__input">
            <option value="sent_to_media" ${post.status === 'sent_to_media' ? 'selected' : ''}>Aguardando produção</option>
            <option value="scheduled"     ${post.status === 'scheduled'     ? 'selected' : ''}>Agendado</option>
            <option value="published"     ${post.status === 'published'     ? 'selected' : ''}>Publicado</option>
          </select>
        </label>
      </div>
      <footer class="block-drawer__foot">
        <span class="spacer"></span>
        <button class="btn btn--ghost" data-action="close">Fechar</button>
        <button class="btn btn--primary" data-action="new-task">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Criar tarefa</span></button>
      </footer>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('is-open'));

  function close() {
    overlay.classList.remove('is-open');
    setTimeout(() => overlay.remove(), 220);
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);

  // salva status ao mudar
  overlay.querySelector('#postStatusSel').addEventListener('change', async (ev) => {
    const { error } = await researchData.updatePost(post.id, { status: ev.target.value });
    if (error) { toastError(error.message); return; }
    toastSuccess('Status atualizado.');
  });

  overlay.addEventListener('click', async (ev) => {
    if (ev.target === overlay) return close();
    const action = ev.target.closest('[data-action]')?.dataset?.action;
    if (action === 'close') return close();
    if (action === 'new-task') {
      close();
      const { openTaskForm } = await import('./media-tasks.js');
      openTaskForm(null, { prefilledPost: post, onSaved: () => loadPosts() });
    }
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
