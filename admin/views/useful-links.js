// View compartilhada — "Links e Textos Úteis" por módulo.
// Cada módulo (Mídia/Pesquisa/Tesouraria/Secretaria) usa esta mesma view, passando
// o `module` como parâmetro. Renderiza a sub-nav do módulo + lista CRUD + drawer
// de edição. Conteúdo persistido em public.useful_links.

import { icon } from '../icons.js';
import * as data from '../useful/data.js';
import { toastSuccess, toastError } from '../toast.js';
import { renderMediaNav }      from './media-nav.js';
import { renderResearchNav }   from './research-nav.js';
import { renderFinanceNav }    from './finance-nav.js';
import { renderSubNav as renderAttendanceSubNav } from './attendance-nav.js';
import { renderHelpMarkdown }  from './help-banner.js';

const ACTIVE_KEY = 'useful';

function renderModuleNav(module, ctx) {
  switch (module) {
    case 'midia':      return renderMediaNav(ACTIVE_KEY);
    case 'pesquisa':   return renderResearchNav(ACTIVE_KEY);
    case 'financeiro': return renderFinanceNav(ACTIVE_KEY);
    case 'secretaria': return renderAttendanceSubNav(ACTIVE_KEY, { isAdmin: ctx?.state?.role === 'admin' });
    default: return '';
  }
}

const HERO_BY_MODULE = {
  midia: {
    eyebrow: 'artes & mídias',
    title: 'Caderno de referências',
    lede: 'Pastas, paletas, briefs e lembretes que o setor precisa ter à mão. Adicione links externos ou colha trechos de texto pra consulta rápida.',
  },
  pesquisa: {
    eyebrow: 'pesquisa',
    title: 'Caderno de referências',
    lede: 'Periódicos, bibliotecas digitais, normas ABNT, drives de fichamento. Aqui ficam os links e padrões que sustentam o trabalho teórico.',
  },
  financeiro: {
    eyebrow: 'tesouraria',
    title: 'Caderno de referências',
    lede: 'Chave PIX padrão, mensagem de cobrança, fornecedores, planilhas espelho. Tudo que a Tesouraria precisa ter à mão durante o mês.',
  },
  secretaria: {
    eyebrow: 'secretaria',
    title: 'Caderno de referências',
    lede: 'Modelos de chamada, drive institucional, comunicados padrão e tudo que ajuda a Secretaria a manter o ritmo dos encontros.',
  },
};

export async function renderUsefulLinks(ctx, module) {
  const { root } = ctx;
  const meta = HERO_BY_MODULE[module] || HERO_BY_MODULE.midia;
  const canEdit = canEditModule(ctx, module);

  root.innerHTML = `
    <div class="view useful-view" data-module="${escapeAttr(module)}">
      ${renderModuleNav(module, ctx)}

      <header class="useful-hero">
        <div class="useful-hero__petal" aria-hidden="true">${PETAL_SVG}</div>
        <div class="useful-hero__inner">
          <p class="useful-hero__eyebrow">${escapeHtml(meta.eyebrow)}</p>
          <h1>${escapeHtml(meta.title)}</h1>
          <p class="useful-hero__lede">${escapeHtml(meta.lede)}</p>
        </div>
        ${canEdit ? `
          <div class="useful-hero__cta">
            <button class="btn btn--ghost" data-action="new-note">${icon('page', { size: 14 })}<span style="margin-left:6px;">Nova nota</span></button>
            <button class="btn btn--primary" data-action="new-link">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Novo link</span></button>
          </div>
        ` : ''}
      </header>

      <div id="usefulList">
        <div class="useful-loading">
          <span class="useful-loading__petal" aria-hidden="true"></span>
          <p>Abrindo o caderno…</p>
        </div>
      </div>
    </div>
  `;

  if (canEdit) {
    root.querySelector('[data-action="new-note"]')?.addEventListener('click', () => openForm(ctx, module, null, 'note'));
    root.querySelector('[data-action="new-link"]')?.addEventListener('click', () => openForm(ctx, module, null, 'link'));
  }

  await loadAll(ctx, module, canEdit);
}

async function loadAll(ctx, module, canEdit) {
  const box = document.getElementById('usefulList');
  if (!box) return;
  const { data: rows, error } = await data.listUseful(module);
  if (error) {
    box.innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`;
    return;
  }
  const arr = rows || [];
  if (!arr.length) {
    box.innerHTML = `
      <div class="useful-empty">
        <div class="useful-empty__art" aria-hidden="true">${icon('star', { size: 48 })}</div>
        <h3>Caderno vazio</h3>
        <p>Comece pelo essencial: link do Drive do setor, planilha-mestra ou um lembrete que vive sumindo no grupo do WhatsApp.</p>
        ${canEdit ? `
          <div class="useful-empty__cta">
            <button class="btn btn--primary" data-action="empty-link">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Adicionar link</span></button>
            <button class="btn btn--ghost"   data-action="empty-note">${icon('page', { size: 14 })}<span style="margin-left:6px;">Adicionar nota</span></button>
          </div>
        ` : '<p class="muted" style="margin-top:14px;font-size:13px;">Só quem tem permissão no setor pode adicionar itens.</p>'}
      </div>
    `;
    if (canEdit) {
      box.querySelector('[data-action="empty-link"]')?.addEventListener('click', () => openForm(ctx, module, null, 'link'));
      box.querySelector('[data-action="empty-note"]')?.addEventListener('click', () => openForm(ctx, module, null, 'note'));
    }
    return;
  }

  box.innerHTML = `
    <ul class="useful-list" id="usefulRows">
      ${arr.map((row, idx) => renderRow(row, idx, arr.length, canEdit)).join('')}
    </ul>
  `;

  if (canEdit) wireRows(ctx, module);
}

function renderRow(row, idx, total, canEdit) {
  const isLink = row.kind === 'link';
  const iconName = isLink ? 'external' : 'page';
  const safeUrl = isLink ? safeHref(row.url) : '';
  const titleHtml = isLink
    ? `<a class="useful-row__title" href="${escapeAttr(safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.title)}<span class="useful-row__ext" aria-hidden="true">${icon('external', { size: 11 })}</span></a>`
    : `<span class="useful-row__title">${escapeHtml(row.title)}</span>`;

  const bodyHtml = row.body
    ? `<div class="useful-row__body">${renderHelpMarkdown(row.body)}</div>`
    : '';
  const urlNote = isLink && row.url
    ? `<p class="useful-row__url" title="${escapeAttr(row.url)}">${escapeHtml(prettyUrl(row.url))}</p>`
    : '';

  return `
    <li class="useful-row useful-row--${isLink ? 'link' : 'note'}" data-id="${escapeAttr(row.id)}">
      <span class="useful-row__icon" aria-hidden="true">${icon(iconName, { size: 18 })}</span>
      <div class="useful-row__main">
        ${titleHtml}
        ${urlNote}
        ${bodyHtml}
      </div>
      ${canEdit ? `
        <div class="useful-row__actions">
          <button class="icon-btn icon-btn--xs" data-action="up"    title="Subir"   aria-label="Subir"   ${idx === 0 ? 'disabled' : ''}>${icon('arrow-up', { size: 12 })}</button>
          <button class="icon-btn icon-btn--xs" data-action="down"  title="Descer"  aria-label="Descer"  ${idx === total - 1 ? 'disabled' : ''}>${icon('arrow-down', { size: 12 })}</button>
          <button class="icon-btn icon-btn--xs" data-action="edit"  title="Editar"  aria-label="Editar">${icon('edit', { size: 12 })}</button>
          <button class="icon-btn icon-btn--xs" data-action="trash" title="Excluir" aria-label="Excluir">${icon('trash', { size: 12 })}</button>
        </div>
      ` : ''}
    </li>
  `;
}

function wireRows(ctx, module) {
  const list = document.getElementById('usefulRows');
  if (!list) return;
  list.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('[data-action]');
    if (!btn) return;
    const li = btn.closest('.useful-row');
    if (!li) return;
    const id = li.dataset.id;
    const action = btn.dataset.action;
    if (action === 'edit') {
      const { data: row } = await data.listUseful(module);
      const item = (row || []).find((r) => r.id === id);
      if (item) openForm(ctx, module, item, item.kind);
      return;
    }
    if (action === 'trash') {
      const title = li.querySelector('.useful-row__title')?.textContent?.trim() || 'este item';
      if (!confirm(`Excluir "${title}"?`)) return;
      const { error } = await data.deleteUseful(id);
      if (error) return toastError(error.message);
      toastSuccess('Item removido.');
      await loadAll(ctx, module, true);
      return;
    }
    if (action === 'up' || action === 'down') {
      btn.disabled = true;
      const { error } = await data.reorderUseful(module, id, action);
      if (error) toastError(error.message);
      await loadAll(ctx, module, true);
      return;
    }
  });
}

function openForm(ctx, module, existing, kind) {
  document.querySelectorAll('.block-drawer-overlay.useful-drawer-overlay').forEach((el) => el.remove());
  const isEdit = !!existing;
  const overlay = document.createElement('div');
  overlay.className = 'block-drawer-overlay useful-drawer-overlay';
  overlay.innerHTML = `
    <div class="block-drawer">
      <header class="block-drawer__head">
        <div>
          <p class="block-drawer__crumb">${isEdit ? 'Editando' : 'Novo'} · ${kind === 'link' ? 'link' : 'nota'}</p>
          <h2><span class="block-drawer__icon" aria-hidden="true">${icon(kind === 'link' ? 'external' : 'page', { size: 22 })}</span> ${isEdit ? escapeHtml(existing.title || '') : (kind === 'link' ? 'Adicionar link' : 'Adicionar nota')}</h2>
        </div>
        <button class="icon-btn" data-action="close" aria-label="Fechar">${icon('x', { size: 16 })}</button>
      </header>
      <form class="block-drawer__body" id="usefulForm">
        <label class="drawer-field">
          <span class="drawer-field__label">Título</span>
          <input type="text" name="title" class="drawer-field__input" required maxlength="160"
                 value="${escapeAttr(existing?.title || '')}"
                 placeholder="${kind === 'link' ? 'Ex.: Drive do setor' : 'Ex.: Modelo de chamada'}" />
        </label>
        ${kind === 'link' ? `
          <label class="drawer-field">
            <span class="drawer-field__label">URL</span>
            <input type="url" name="url" class="drawer-field__input" required maxlength="600"
                   value="${escapeAttr(existing?.url || '')}"
                   placeholder="https://…" />
          </label>
          <label class="drawer-field">
            <span class="drawer-field__label">Descrição (opcional)</span>
            <textarea name="body" class="drawer-field__input" rows="4" maxlength="2000"
                      placeholder="Pra que serve, como usar, regras…">${escapeHtml(existing?.body || '')}</textarea>
          </label>
        ` : `
          <label class="drawer-field">
            <span class="drawer-field__label">Conteúdo</span>
            <textarea name="body" class="drawer-field__input" rows="10" required maxlength="6000"
                      placeholder="Markdown leve: ## título · **negrito** · *itálico* · - lista">${escapeHtml(existing?.body || '')}</textarea>
            <small class="drawer-field__hint">Markdown leve: <code>## título</code>, <code>**negrito**</code>, <code>*itálico*</code>, <code>- item</code></small>
          </label>
        `}
      </form>
      <footer class="block-drawer__foot">
        ${isEdit ? `<button class="btn btn--danger btn--small" data-action="delete">${icon('trash', { size: 14 })}<span style="margin-left:6px;">Excluir</span></button>` : '<span class="spacer"></span>'}
        <span class="spacer"></span>
        <button class="btn btn--ghost"   data-action="close">Cancelar</button>
        <button class="btn btn--primary" data-action="save">${isEdit ? 'Salvar' : 'Criar'}</button>
      </footer>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('is-open'));

  const form = overlay.querySelector('#usefulForm');
  form.addEventListener('submit', (e) => e.preventDefault());

  function close() {
    overlay.classList.remove('is-open');
    setTimeout(() => overlay.remove(), 220);
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
    if ((e.key === 's' || e.key === 'S') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      doSave();
    }
  }
  document.addEventListener('keydown', onKey);

  async function doSave() {
    const fd = new FormData(form);
    const title = String(fd.get('title') || '').trim();
    const url = String(fd.get('url') || '').trim();
    const body = String(fd.get('body') || '').trim();
    if (!title) return toastError('Título é obrigatório.');
    if (kind === 'link' && !url) return toastError('URL é obrigatória.');
    if (kind === 'link' && !/^https?:\/\//i.test(url)) {
      return toastError('A URL precisa começar com http:// ou https://');
    }
    if (kind === 'note' && !body) return toastError('Escreva o conteúdo da nota.');

    const fields = {
      module,
      kind,
      title,
      url: kind === 'link' ? url : null,
      body: body || null,
    };

    const { error } = isEdit
      ? await data.updateUseful(existing.id, fields)
      : await data.createUseful(fields);
    if (error) return toastError(error.message);
    toastSuccess(isEdit ? 'Item atualizado.' : 'Item adicionado.');
    close();
    await loadAll(ctx, module, true);
  }

  overlay.addEventListener('click', async (ev) => {
    if (ev.target === overlay) return close();
    const action = ev.target.closest('[data-action]')?.dataset?.action;
    if (action === 'close') return close();
    if (action === 'delete' && existing) {
      if (!confirm(`Excluir "${existing.title}"?`)) return;
      const { error } = await data.deleteUseful(existing.id);
      if (error) return toastError(error.message);
      toastSuccess('Item removido.');
      close();
      await loadAll(ctx, module, true);
      return;
    }
    if (action === 'save') await doSave();
  });
}

function canEditModule(ctx, module) {
  const role = ctx?.state?.role;
  if (role === 'admin') return true;
  const sector = ctx?.state?.sector;
  if (!sector) return false;
  if (module === 'midia')       return sector === 'midia';
  if (module === 'pesquisa')    return sector === 'pesquisa';
  if (module === 'financeiro')  return sector === 'tesouraria';
  if (module === 'secretaria')  return sector === 'secretaria';
  return false;
}

function safeHref(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '#';
    return u.toString();
  } catch { return '#'; }
}

function prettyUrl(url) {
  try {
    const u = new URL(url);
    let s = u.hostname.replace(/^www\./, '') + (u.pathname === '/' ? '' : u.pathname);
    if (s.length > 60) s = s.slice(0, 57) + '…';
    return s;
  } catch { return url; }
}

const PETAL_SVG = `
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M50 18 C 32 28, 26 50, 32 66 C 38 80, 50 82, 50 82 C 50 82, 62 80, 68 66 C 74 50, 68 28, 50 18 Z"
      fill="currentColor" opacity="0.85"/>
    <path d="M50 78 L50 96" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.5"/>
  </svg>
`;

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
