// CRUD de semestres. Apenas admin.

import { icon } from '../icons.js';
import * as data from '../attendance/data.js';
import { renderSubNav } from './attendance-nav.js';
import { toastSuccess, toastError } from '../toast.js';

export async function renderAttendanceSemesters(ctx) {
  const { root, state } = ctx;

  if (state.role !== 'admin') {
    location.hash = '#/presenca';
    return;
  }

  root.innerHTML = `
    <div class="view">
      ${renderSubNav('semestres', { isAdmin: true })}
      <header class="view__header" style="display:flex; align-items:flex-end; justify-content:space-between; gap:14px;">
        <div>
          <h1>Semestres</h1>
          <p class="view__lede">Defina os períodos acadêmicos. O semestre marcado como atual é usado por padrão nos cálculos de presença.</p>
        </div>
        <button id="newSemesterBtn" class="btn btn--primary">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Novo semestre</span></button>
      </header>

      <div id="semestersList" class="empty-state">
        <div class="skel skel--title"></div>
        <div class="skel skel--block"></div>
      </div>
    </div>
  `;

  document.getElementById('newSemesterBtn').addEventListener('click', () => openSemesterForm(null, () => loadSemesters()));
  await loadSemesters();
}

async function loadSemesters() {
  const box = document.getElementById('semestersList');
  const { data: rows, error } = await data.listSemesters();
  if (error) { box.innerHTML = `<p class="muted">${error.message}</p>`; return; }
  if (!rows?.length) {
    box.innerHTML = `
      <div class="att-empty">
        <div class="att-empty__art">${icon('calendar', { size: 60 })}</div>
        <h3>Nenhum semestre criado ainda</h3>
        <p>Defina o período letivo (ex.: "2026.1" de 01/03 a 15/07) pra organizar os encontros.</p>
        <button class="btn btn--primary" id="emptyNewSemesterBtn">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Criar primeiro</span></button>
      </div>
    `;
    document.getElementById('emptyNewSemesterBtn').addEventListener('click', () => openSemesterForm(null, () => loadSemesters()));
    return;
  }

  box.className = '';
  box.innerHTML = `
    <div class="att-sem-list">
      ${rows.map(semesterCard).join('')}
    </div>
  `;

  for (const card of document.querySelectorAll('.att-sem-card')) {
    const id = card.dataset.semesterId;
    card.querySelector('[data-action="edit"]')?.addEventListener('click', async () => {
      const { data: row } = await data.getSemester(id);
      if (row) openSemesterForm(row, () => loadSemesters());
    });
    card.querySelector('[data-action="set-current"]')?.addEventListener('click', async () => {
      const { error } = await data.setCurrentSemester(id);
      if (error) toastError(error.message);
      else toastSuccess('Marcado como semestre atual.');
      await loadSemesters();
    });
  }
}

function semesterCard(s) {
  const start = new Date(s.start_date + 'T00:00:00');
  const end   = new Date(s.end_date + 'T00:00:00');
  const fmt = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `
    <article class="att-sem-card ${s.is_current ? 'is-current' : ''}" data-semester-id="${escapeAttr(s.id)}">
      <div class="att-sem-card__icon">${icon('calendar', { size: 22 })}</div>
      <div class="att-sem-card__main">
        <strong>${escapeHtml(s.name)}</strong>
        <span class="muted">${escapeHtml(fmt(start))} → ${escapeHtml(fmt(end))}</span>
        ${s.is_current ? '<span class="pill pill--gold" style="margin-top:6px;">semestre atual</span>' : ''}
      </div>
      <div class="att-sem-card__actions">
        ${!s.is_current ? `<button class="btn btn--ghost btn--small" data-action="set-current">Marcar como atual</button>` : ''}
        <button class="icon-btn" data-action="edit" title="Editar">${icon('edit', { size: 14 })}</button>
      </div>
    </article>
  `;
}

function openSemesterForm(existing, onDone) {
  document.querySelectorAll('.block-drawer-overlay').forEach((el) => el.remove());

  const isEdit = !!existing;
  const overlay = document.createElement('div');
  overlay.className = 'block-drawer-overlay';
  overlay.innerHTML = `
    <div class="block-drawer">
      <header class="block-drawer__head">
        <div>
          <p class="block-drawer__crumb">${isEdit ? 'Editando semestre' : 'Novo semestre'}</p>
          <h2><span class="block-drawer__icon">${icon('calendar', { size: 26 })}</span> ${isEdit ? escapeHtml(existing.name) : 'Período letivo'}</h2>
        </div>
        <button class="icon-btn" data-action="close" aria-label="Fechar">${icon('x', { size: 16 })}</button>
      </header>
      <form class="block-drawer__body" id="semesterForm">
        <label class="drawer-field">
          <span class="drawer-field__label">Nome</span>
          <input type="text" name="name" class="drawer-field__input" required value="${escapeAttr(existing?.name || '')}" placeholder="ex.: 2026.1" />
        </label>
        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <label class="drawer-field" style="flex:1; min-width:140px;">
            <span class="drawer-field__label">Início</span>
            <input type="date" name="start_date" class="drawer-field__input" required value="${escapeAttr(existing?.start_date || '')}" />
          </label>
          <label class="drawer-field" style="flex:1; min-width:140px;">
            <span class="drawer-field__label">Fim</span>
            <input type="date" name="end_date" class="drawer-field__input" required value="${escapeAttr(existing?.end_date || '')}" />
          </label>
        </div>
        <label class="drawer-field">
          <span class="drawer-field__label">Estado</span>
          <select name="is_current" class="drawer-field__input">
            <option value="false" ${!existing?.is_current ? 'selected' : ''}>Comum</option>
            <option value="true"  ${existing?.is_current ? 'selected' : ''}>Marcar como atual</option>
          </select>
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

    if (action === 'delete') {
      if (!confirm(`Excluir o semestre "${existing.name}"? Grupos vinculados ficarão sem semestre.`)) return;
      const { error } = await data.deleteSemester(existing.id);
      if (error) { toastError(error.message); return; }
      toastSuccess('Semestre excluído.');
      close();
      onDone?.();
      return;
    }

    if (action === 'save') {
      const form = overlay.querySelector('#semesterForm');
      const fd = new FormData(form);
      const fields = {
        name: String(fd.get('name') || '').trim(),
        start_date: String(fd.get('start_date') || ''),
        end_date: String(fd.get('end_date') || ''),
      };
      const wantCurrent = fd.get('is_current') === 'true';
      if (!fields.name || !fields.start_date || !fields.end_date) {
        toastError('Preencha nome, início e fim.'); return;
      }
      if (fields.end_date <= fields.start_date) {
        toastError('Data de fim precisa ser depois da data de início.'); return;
      }

      try {
        if (isEdit) {
          const { error } = await data.updateSemester(existing.id, fields);
          if (error) throw error;
          if (wantCurrent && !existing.is_current) {
            const { error: e2 } = await data.setCurrentSemester(existing.id);
            if (e2) throw e2;
          }
        } else {
          const { data: created, error } = await data.createSemester(fields);
          if (error) throw error;
          if (wantCurrent) {
            const { error: e2 } = await data.setCurrentSemester(created.id);
            if (e2) throw e2;
          }
        }
        toastSuccess(isEdit ? 'Semestre atualizado.' : 'Semestre criado.');
        close();
        onDone?.();
      } catch (e) {
        toastError(e.message || String(e));
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
