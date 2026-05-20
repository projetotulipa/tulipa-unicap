// CRUD de pessoas + busca + filtros. Admin e secretaria têm acesso completo.

import { icon } from '../icons.js';
import * as data from '../attendance/data.js';
import { renderSubNav } from './attendance-nav.js';
import { avatarHtml } from '../avatar.js';
import { toastSuccess, toastError } from '../toast.js';

let cachedRows = null;
let cachedGroups = null;

export async function renderAttendancePeople(ctx) {
  const { root } = ctx;

  root.innerHTML = `
    <div class="view">
      ${renderSubNav('pessoas', { isAdmin: ctx.state.role === 'admin' })}

      <header class="view__header" style="display:flex; align-items:flex-end; justify-content:space-between; gap:14px;">
        <div>
          <h1>Pessoas</h1>
          <p class="view__lede">Quem participa dos grupos. A estrela marca o grupo prioritário em que a pessoa é cobrada.</p>
        </div>
        <button id="newPersonBtn" class="btn btn--primary">${icon('user-plus', { size: 14 })}<span style="margin-left:6px;">Nova pessoa</span></button>
      </header>

      <div class="att-people-toolbar">
        <div class="search-bar">
          <span class="search-bar__icon">${icon('search', { size: 16 })}</span>
          <input type="text" id="personSearch" placeholder="Buscar pessoa por nome ou e-mail…" />
        </div>
        <label class="att-people-toolbar__filter">
          <span>${icon('filter', { size: 14 })}<span style="margin-left:6px;">Grupo</span></span>
          <select id="groupFilter">
            <option value="">Todos os grupos</option>
          </select>
        </label>
        <label class="att-people-toolbar__filter">
          <span>${icon('users', { size: 14 })}</span>
          <select id="activeFilter">
            <option value="active">Ativas</option>
            <option value="inactive">Inativas</option>
            <option value="all">Todas</option>
          </select>
        </label>
      </div>

      <div id="peopleList" class="empty-state">
        <div class="skel skel--title"></div>
        <div class="skel skel--block"></div>
      </div>
    </div>
  `;

  document.getElementById('newPersonBtn').addEventListener('click', () => openPersonForm(ctx));
  document.getElementById('personSearch').addEventListener('input', applyFilters);
  document.getElementById('groupFilter').addEventListener('change', applyFilters);
  document.getElementById('activeFilter').addEventListener('change', applyFilters);

  await loadPeople(ctx);
}

async function loadPeople(ctx) {
  const box = document.getElementById('peopleList');
  const [{ data: people, error }, { data: groups }] = await Promise.all([
    data.listPeople({ includeInactive: true }),
    data.listGroups(),
  ]);

  if (error) { box.innerHTML = `<p class="muted">${error.message}</p>`; return; }
  if (!people?.length) {
    box.innerHTML = `
      <div class="att-empty">
        <div class="att-empty__art">${icon('user-plus', { size: 60 })}</div>
        <h3>Nenhuma pessoa cadastrada</h3>
        <p>Adicione as pessoas que participam dos grupos para começar a marcar presença.</p>
        <button class="btn btn--primary" id="emptyNewPersonBtn">${icon('user-plus', { size: 14 })}<span style="margin-left:6px;">Cadastrar primeira pessoa</span></button>
      </div>
    `;
    document.getElementById('emptyNewPersonBtn').addEventListener('click', () => openPersonForm(ctx));
    return;
  }

  // popula filtro de grupos
  const groupFilter = document.getElementById('groupFilter');
  for (const g of (groups || [])) {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = g.name;
    groupFilter.appendChild(opt);
  }

  // busca memberships de cada pessoa em paralelo
  const memberships = await Promise.all(people.map((p) => data.listMembershipsOfPerson(p.id)));

  cachedRows = people.map((p, idx) => ({ person: p, memberships: memberships[idx].data || [] }));
  cachedGroups = groups || [];

  box.className = '';
  box.innerHTML = `<div class="att-people-grid">${cachedRows.map(personCard).join('')}</div>`;

  wirePersonCards(ctx);
  applyFilters();
}

function personCard({ person, memberships }) {
  const primary = memberships.find((m) => m.is_primary);
  const others = memberships.filter((m) => !m.is_primary);
  return `
    <article class="att-person-card ${person.is_active ? '' : 'is-inactive'}"
             data-person-id="${escapeAttr(person.id)}"
             data-name="${escapeAttr(person.full_name)}"
             data-email="${escapeAttr(person.email || '')}"
             data-groups="${escapeAttr(memberships.map(m => m.group_id).join('|'))}"
             data-active="${person.is_active ? '1' : '0'}">
      <div class="att-person-card__head">
        ${avatarHtml(person.full_name, { size: 'lg' })}
        <div class="att-person-card__title">
          <strong>${escapeHtml(person.full_name)}</strong>
          ${person.email ? `<span class="muted">${escapeHtml(person.email)}</span>` : '<span class="muted">sem e-mail</span>'}
        </div>
        <button class="icon-btn" data-action="edit" title="Editar">${icon('edit', { size: 14 })}</button>
      </div>
      <div class="att-person-card__groups">
        ${primary ? `<span class="pill pill--gold">${icon('star', { size: 11 })}<span style="margin-left:4px;">${escapeHtml(primary.group?.name || '—')}</span></span>` : ''}
        ${others.map((m) => `<span class="pill">${escapeHtml(m.group?.name || '—')}</span>`).join('')}
        ${memberships.length === 0 ? '<span class="muted" style="font-size:12px;">sem grupos</span>' : ''}
      </div>
      ${!person.is_active ? '<span class="att-person-card__inactive">inativa</span>' : ''}
    </article>
  `;
}

function wirePersonCards(ctx) {
  document.querySelectorAll('.att-person-card').forEach((card) => {
    card.querySelector('[data-action="edit"]')?.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      const id = card.dataset.personId;
      const { data: row } = await data.getPerson(id);
      if (row) openPersonForm(ctx, row);
    });
  });
}

function applyFilters() {
  const q = (document.getElementById('personSearch')?.value || '').toLowerCase().trim();
  const groupId = document.getElementById('groupFilter')?.value || '';
  const active = document.getElementById('activeFilter')?.value || 'active';

  for (const card of document.querySelectorAll('.att-person-card')) {
    const name = (card.dataset.name || '').toLowerCase();
    const email = (card.dataset.email || '').toLowerCase();
    const groups = card.dataset.groups || '';
    const isActive = card.dataset.active === '1';

    let show = true;
    if (q && !name.includes(q) && !email.includes(q)) show = false;
    if (groupId && !groups.split('|').includes(groupId)) show = false;
    if (active === 'active' && !isActive) show = false;
    if (active === 'inactive' && isActive) show = false;

    card.hidden = !show;
  }
}

function openPersonForm(ctx, existing = null) {
  document.querySelectorAll('.block-drawer-overlay').forEach((el) => el.remove());

  const isEdit = !!existing;
  const overlay = document.createElement('div');
  overlay.className = 'block-drawer-overlay';
  overlay.innerHTML = `
    <div class="block-drawer">
      <header class="block-drawer__head">
        <div>
          <p class="block-drawer__crumb">${isEdit ? 'Editando pessoa' : 'Nova pessoa'}</p>
          <h2>
            ${isEdit ? avatarHtml(existing.full_name, { size: 'sm' }) : `<span class="block-drawer__icon">${icon('user-plus', { size: 26 })}</span>`}
            <span style="margin-left:10px;">${isEdit ? escapeHtml(existing.full_name) : 'Cadastro'}</span>
          </h2>
        </div>
        <button class="icon-btn" data-action="close" aria-label="Fechar">${icon('x', { size: 16 })}</button>
      </header>
      <div class="block-drawer__body">
        <form id="personForm">
          <label class="drawer-field">
            <span class="drawer-field__label">Nome completo</span>
            <input type="text" name="full_name" class="drawer-field__input" required value="${escapeAttr(existing?.full_name || '')}" placeholder="Como aparecerá na lista" />
          </label>
          <label class="drawer-field">
            <span class="drawer-field__label">E-mail (opcional)</span>
            <input type="email" name="email" class="drawer-field__input" value="${escapeAttr(existing?.email || '')}" placeholder="para contato" />
          </label>
          ${isEdit ? `
            <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:6px;">
              <label class="drawer-field" style="flex:1; min-width: 160px;">
                <span class="drawer-field__label">Estado</span>
                <select name="is_active" class="drawer-field__input">
                  <option value="true"  ${existing.is_active ? 'selected' : ''}>Ativa</option>
                  <option value="false" ${!existing.is_active ? 'selected' : ''}>Inativa (saiu)</option>
                </select>
              </label>
              <label class="drawer-field" style="flex:1; min-width: 160px;">
                <span class="drawer-field__label">Mensalidade</span>
                <select name="is_exempt" class="drawer-field__input">
                  <option value="false" ${!existing.is_exempt ? 'selected' : ''}>Paga normalmente</option>
                  <option value="true"  ${existing.is_exempt ? 'selected' : ''}>Isenta (não paga)</option>
                </select>
              </label>
            </div>
            <label class="drawer-field">
              <span class="drawer-field__label">Valor mensal individual (opcional)</span>
              <input type="number" step="0.01" min="0" name="custom_dues" class="drawer-field__input"
                     value="${existing.custom_dues != null ? existing.custom_dues : ''}"
                     placeholder="usa o valor padrão do mês se vazio" />
            </label>
          ` : ''}
        </form>

        ${isEdit ? `
          <hr style="margin: 22px 0; border: none; border-top: 1px solid var(--border);">
          <div class="person-notes">
            <h3 class="person-notes__head">
              <span>${icon('attendance', { size: 16 })}<span style="margin-left:8px;">Anotações</span></span>
            </h3>
            <form id="personNoteForm" class="person-notes__form">
              <textarea name="note" class="drawer-field__input" rows="2" placeholder="Adicionar nova anotação… (Ctrl+Enter pra salvar)"></textarea>
              <button class="btn btn--primary btn--small" type="submit">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Adicionar</span></button>
            </form>
            <div id="personNotesList" class="person-notes__list">
              <p class="muted" style="font-size:13px;">carregando…</p>
            </div>
          </div>
        ` : ''}
      </div>
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

  function close() {
    overlay.classList.remove('is-open');
    setTimeout(() => overlay.remove(), 220);
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);

  overlay.addEventListener('click', async (ev) => {
    if (ev.target === overlay) { close(); return; }
    const action = ev.target.closest('[data-action]')?.dataset?.action;
    if (action === 'close') return close();

    if (action === 'delete') {
      if (!confirm(`Excluir "${existing.full_name}" definitivamente? Use "Inativa" pra preservar histórico.`)) return;
      const { error } = await data.deletePerson(existing.id);
      if (error) { toastError(error.message); return; }
      toastSuccess('Pessoa excluída.');
      close();
      await loadPeople(ctx);
      return;
    }

    if (action === 'save') {
      const form = overlay.querySelector('#personForm');
      const fd = new FormData(form);
      const fields = {
        full_name: String(fd.get('full_name') || '').trim(),
        email: String(fd.get('email') || '').trim() || null,
      };
      if (isEdit) {
        fields.is_active = fd.get('is_active') === 'true';
        fields.is_exempt = fd.get('is_exempt') === 'true';
        const cd = String(fd.get('custom_dues') || '').trim();
        fields.custom_dues = cd ? Number(cd) : null;
      }
      if (!fields.full_name) { toastError('Nome é obrigatório.'); return; }
      const { error } = isEdit ? await data.updatePerson(existing.id, fields) : await data.createPerson(fields);
      if (error) { toastError(error.message); return; }
      toastSuccess(isEdit ? 'Pessoa atualizada.' : 'Pessoa cadastrada.');
      close();
      await loadPeople(ctx);
    }
  });

  // ====== anotações (apenas edit) ======
  if (isEdit) {
    loadNotes();
    const noteForm = overlay.querySelector('#personNoteForm');
    noteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ta = noteForm.querySelector('textarea');
      const body = ta.value.trim();
      if (!body) return;
      const { error } = await data.addPersonNote(existing.id, body);
      if (error) { toastError(error.message); return; }
      ta.value = '';
      toastSuccess('Anotação adicionada.');
      loadNotes();
    });
    // Ctrl+Enter atalho
    noteForm.querySelector('textarea').addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        noteForm.requestSubmit();
      }
    });

    async function loadNotes() {
      const box = overlay.querySelector('#personNotesList');
      const { data: notes, error } = await data.listPersonNotes(existing.id);
      if (error) { box.innerHTML = `<p class="muted">${error.message}</p>`; return; }
      if (!notes?.length) {
        box.innerHTML = '<p class="muted" style="font-size:13px;">Nenhuma anotação ainda. Use o campo acima.</p>';
        return;
      }
      box.innerHTML = notes.map(noteCard).join('');
      box.querySelectorAll('[data-action="delete-note"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('Excluir esta anotação?')) return;
          const { error } = await data.deletePersonNote(btn.dataset.noteId);
          if (error) { toastError(error.message); return; }
          toastSuccess('Anotação excluída.');
          loadNotes();
        });
      });
    }
  }
}

function noteCard(n) {
  const d = new Date(n.created_at);
  const when = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
               ' · ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `
    <article class="person-note">
      <div class="person-note__body">${escapeHtml(n.body).replace(/\n/g, '<br/>')}</div>
      <footer class="person-note__foot">
        <span class="muted">${escapeHtml(when)}</span>
        <button class="icon-btn icon-btn--xs" data-action="delete-note" data-note-id="${escapeAttr(n.id)}" title="Excluir">${icon('trash', { size: 11 })}</button>
      </footer>
    </article>
  `;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
