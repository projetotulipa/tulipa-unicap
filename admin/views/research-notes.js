// Fichamentos teóricos — CRUD com vínculo a meeting.

import { icon } from '../icons.js';
import * as data from '../research/data.js';
import * as attData from '../attendance/data.js';
import { renderResearchNav } from './research-nav.js';
import { toastSuccess, toastError } from '../toast.js';
import { FICHAMENTO_TEMPLATES, FICHAMENTO_GUIDE, templateById } from '../research/template.js';

export async function renderResearchNotes(ctx) {
  const { root } = ctx;

  root.innerHTML = `
    <div class="view">
      ${renderResearchNav('fichamentos')}

      <header class="view__header" style="display:flex; align-items:flex-end; justify-content:space-between; gap:14px;">
        <div>
          <h1>Fichamentos teóricos</h1>
          <p class="view__lede">Registre o estudo de cada aula. Cada fichamento pode ser vinculado a um grupo e a uma data específica de encontro.</p>
        </div>
        <button class="btn btn--primary" id="newNoteBtn">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Novo fichamento</span></button>
      </header>

      <div class="search-bar">
        <span class="search-bar__icon">${icon('search', { size: 16 })}</span>
        <input type="text" id="noteSearch" placeholder="Buscar fichamento por título ou conteúdo…" />
      </div>

      <div id="notesList" class="empty-state"><div class="skel skel--block"></div></div>
    </div>
  `;

  document.getElementById('newNoteBtn').addEventListener('click', () => openNoteForm(null));
  document.getElementById('noteSearch').addEventListener('input', applySearch);

  await loadNotes();
}

async function loadNotes() {
  const box = document.getElementById('notesList');
  const { data: notes, error } = await data.listNotes();
  if (error) { box.innerHTML = `<p class="muted">${error.message}</p>`; return; }
  if (!notes?.length) {
    box.innerHTML = `
      <div class="att-empty">
        <div class="att-empty__art">${icon('page', { size: 56 })}</div>
        <h3>Nenhum fichamento ainda</h3>
        <p>Comece registrando o estudo da última aula.</p>
        <button class="btn btn--primary" id="emptyNew">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Criar primeiro</span></button>
      </div>
    `;
    document.getElementById('emptyNew').addEventListener('click', () => openNoteForm(null));
    return;
  }
  box.className = '';
  box.innerHTML = `<div class="res-notes-list">${notes.map(noteCard).join('')}</div>`;
  for (const card of box.querySelectorAll('.res-note-card')) {
    card.addEventListener('click', async () => {
      const { data: full } = await data.getNote(card.dataset.id);
      if (full) openNoteForm(full);
    });
  }
}

function noteCard(n) {
  const meetingDate = n.meeting?.date ? new Date(n.meeting.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : null;
  const preview = (n.body || '').replace(/\s+/g, ' ').slice(0, 160);
  return `
    <article class="res-note-card" data-id="${escapeAttr(n.id)}" data-title="${escapeAttr(n.title)}" data-body="${escapeAttr(n.body || '')}">
      <header class="res-note-card__head">
        <h3>${escapeHtml(n.title)}</h3>
        ${meetingDate ? `<span class="pill pill--gold">${icon('calendar', { size: 11 })}<span style="margin-left:4px;">${escapeHtml(meetingDate)}</span></span>` : ''}
      </header>
      <p class="muted" style="font-size:12px; margin: 0;">${escapeHtml(n.group?.name || 'sem grupo associado')}</p>
      ${n.research_group ? `<span class="pill" style="align-self:flex-start;">${icon('group', { size: 11 })}<span style="margin-left:4px;">${escapeHtml(n.research_group.name)}</span></span>` : ''}
      ${preview ? `<p class="res-note-card__preview">${escapeHtml(preview)}${n.body && n.body.length > 160 ? '…' : ''}</p>` : '<p class="muted" style="font-style:italic;">sem conteúdo ainda</p>'}
    </article>
  `;
}

function applySearch(ev) {
  const q = ev.target.value.toLowerCase().trim();
  for (const card of document.querySelectorAll('.res-note-card')) {
    const t = (card.dataset.title || '').toLowerCase();
    const b = (card.dataset.body || '').toLowerCase();
    card.hidden = q && !t.includes(q) && !b.includes(q);
  }
}

async function openNoteForm(existing) {
  document.querySelectorAll('.block-drawer-overlay').forEach((el) => el.remove());

  const isEdit = !!existing;
  // carrega grupos pro select
  const [{ data: groups }, { data: researchTeams }] = await Promise.all([
    attData.listGroups(),
    data.listGroups(),
  ]);

  const overlay = document.createElement('div');
  overlay.className = 'block-drawer-overlay';
  overlay.innerHTML = `
    <div class="block-drawer block-drawer--wide">
      <header class="block-drawer__head">
        <div>
          <p class="block-drawer__crumb">${isEdit ? 'Editando fichamento' : 'Novo fichamento'}</p>
          <h2><span class="block-drawer__icon">${icon('page', { size: 26 })}</span> ${isEdit ? escapeHtml(existing.title) : 'Fichamento'}</h2>
        </div>
        <button class="icon-btn" data-action="close">${icon('x', { size: 16 })}</button>
      </header>
      <form class="block-drawer__body" id="noteForm">
        <label class="drawer-field">
          <span class="drawer-field__label">Título</span>
          <input type="text" name="title" class="drawer-field__input" required value="${escapeAttr(existing?.title || '')}" placeholder="Ex.: Capítulo 3 — Sombra (von Franz)" />
        </label>
        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <label class="drawer-field" style="flex:1; min-width:200px;">
            <span class="drawer-field__label">Grupo (aulas)</span>
            <select name="group_id" class="drawer-field__input" id="noteGroup">
              <option value="">— sem vínculo —</option>
              ${(groups || []).map((g) => `<option value="${escapeAttr(g.id)}" ${existing?.group_id === g.id ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('')}
            </select>
          </label>
          <label class="drawer-field" style="flex:1; min-width:200px;">
            <span class="drawer-field__label">Aula (data)</span>
            <select name="meeting_id" class="drawer-field__input" id="noteMeeting">
              <option value="">— escolha um grupo primeiro —</option>
            </select>
          </label>
        </div>
        <label class="drawer-field">
          <span class="drawer-field__label">Equipe responsável (pesquisa)</span>
          <select name="research_group_id" class="drawer-field__input">
            <option value="">— nenhuma —</option>
            ${(researchTeams || []).map((t) => `<option value="${escapeAttr(t.id)}" ${existing?.research_group_id === t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
          </select>
          <p class="drawer-field__hint">Quem dentro da Pesquisa está cuidando deste fichamento.</p>
        </label>
        <label class="drawer-field">
          <div class="drawer-field__head" style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
            <span class="drawer-field__label">Conteúdo</span>
            <div style="display:flex; gap:6px;">
              <button type="button" class="btn btn--ghost btn--small" data-action="insert-template">
                ${icon('page', { size: 12 })}<span style="margin-left:6px;">Inserir modelo</span>
              </button>
              <button type="button" class="btn btn--ghost btn--small" data-action="toggle-guide">
                ${icon('spark', { size: 12 })}<span style="margin-left:6px;">Como fichar</span>
              </button>
            </div>
          </div>
          <div id="fichGuide" class="fich-guide" hidden>
            ${FICHAMENTO_GUIDE.map((g, i) => `
              <details ${i === 0 ? 'open' : ''}>
                <summary>${escapeHtml(g.title)}</summary>
                <p>${escapeHtml(g.body).replace(/\n/g, '<br/>')}</p>
              </details>
            `).join('')}
          </div>
          <textarea name="body" class="drawer-field__input drawer-field__input--tall" rows="14" placeholder="Resumo do estudo, citações, observações, perguntas… ou clique em &quot;Inserir modelo&quot;.">${escapeHtml(existing?.body || '')}</textarea>
          <p class="drawer-field__hint">Texto livre. Aceita quebras de linha e markdown leve (** negrito **, * itálico *, &gt; citação).</p>
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

  const form = overlay.querySelector('#noteForm');
  form.addEventListener('submit', (e) => e.preventDefault());

  const groupSel = overlay.querySelector('#noteGroup');
  const meetingSel = overlay.querySelector('#noteMeeting');

  async function loadMeetings(groupId) {
    if (!groupId) {
      meetingSel.innerHTML = '<option value="">— escolha um grupo primeiro —</option>';
      return;
    }
    const { data: meetings } = await attData.listMeetings(groupId, {});
    const options = ['<option value="">— sem aula específica —</option>'];
    for (const m of (meetings || [])) {
      const d = new Date(m.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      options.push(`<option value="${m.id}" ${existing?.meeting_id === m.id ? 'selected' : ''}>${d} (${m.status})</option>`);
    }
    meetingSel.innerHTML = options.join('');
  }
  groupSel.addEventListener('change', () => loadMeetings(groupSel.value));
  if (existing?.group_id) loadMeetings(existing.group_id);

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
    if (action === 'insert-template') {
      openTemplatePicker(overlay);
      return;
    }
    if (action === 'toggle-guide') {
      const g = overlay.querySelector('#fichGuide');
      g.hidden = !g.hidden;
      return;
    }
    if (action === 'delete' && existing) {
      if (!confirm(`Excluir o fichamento "${existing.title}"?`)) return;
      const { error } = await data.deleteNote(existing.id);
      if (error) { toastError(error.message); return; }
      toastSuccess('Fichamento excluído.');
      close();
      await loadNotes();
      return;
    }
    if (action === 'save') {
      const fd = new FormData(form);
      const fields = {
        title: String(fd.get('title') || '').trim(),
        body: String(fd.get('body') || ''),
        group_id: fd.get('group_id') || null,
        meeting_id: fd.get('meeting_id') || null,
        research_group_id: fd.get('research_group_id') || null,
      };
      if (!fields.title) { toastError('Título é obrigatório.'); return; }
      const { error } = isEdit ? await data.updateNote(existing.id, fields) : await data.createNote(fields);
      if (error) { toastError(error.message); return; }
      toastSuccess(isEdit ? 'Fichamento atualizado.' : 'Fichamento criado.');
      close();
      await loadNotes();
    }
  });
}

function openTemplatePicker(parentOverlay) {
  // mini-modal por cima do drawer de fichamento
  const picker = document.createElement('div');
  picker.className = 'fich-picker-overlay';
  picker.innerHTML = `
    <div class="fich-picker">
      <header class="fich-picker__head">
        <div>
          <p class="block-drawer__crumb">Escolha um modelo</p>
          <h2 style="margin:0; font-family:'Cormorant Garamond',serif; font-style:italic; font-size:22px; color:var(--cream);">Modelos ABNT</h2>
        </div>
        <button class="icon-btn" data-action="close-picker" aria-label="Fechar">${icon('x', { size: 16 })}</button>
      </header>
      <div class="fich-picker__list">
        ${FICHAMENTO_TEMPLATES.map((t) => `
          <button class="fich-picker__option" data-template-id="${escapeAttr(t.id)}">
            <header class="fich-picker__option-head">
              <strong>${escapeHtml(t.label)}</strong>
              <span class="pill pill--gold">${escapeHtml(t.abnt)}</span>
            </header>
            <p>${escapeHtml(t.description)}</p>
          </button>
        `).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(picker);
  requestAnimationFrame(() => picker.classList.add('is-open'));

  function close() {
    picker.classList.remove('is-open');
    setTimeout(() => picker.remove(), 200);
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);

  picker.addEventListener('click', (ev) => {
    if (ev.target === picker) return close();
    if (ev.target.closest('[data-action="close-picker"]')) return close();
    const opt = ev.target.closest('[data-template-id]');
    if (!opt) return;
    const tmpl = templateById(opt.dataset.templateId);
    if (!tmpl) return;
    const ta = parentOverlay.querySelector('textarea[name="body"]');
    if (ta.value.trim() && !confirm('Isso vai substituir o conteúdo atual pelo modelo. Continuar?')) return;
    ta.value = tmpl.body;
    ta.focus();
    ta.setSelectionRange(0, 0);
    close();
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
