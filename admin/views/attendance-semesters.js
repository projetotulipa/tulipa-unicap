// Semestres — Sprint 5 ("anais" editoriais com fita + selo gold animado).
// Apenas admin.

import { icon } from '../icons.js';
import * as data from '../attendance/data.js';
import { renderSubNav } from './attendance-nav.js';
import { codexSeal, codexPage } from '../attendance/codex.js';
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

      <header class="att-hero-v2">
        <div class="att-hero-v2__seal-wrap">
          <span class="att-codex-seal">${codexSeal({ size: 32 })}</span>
        </div>
        <div class="att-hero-v2__inner">
          <p class="att-hero-v2__eyebrow">anais · períodos do livro</p>
          <h1>Semestres</h1>
          <p class="att-hero-v2__lede">
            Cada semestre é um livro aberto. O selo dourado marca o atual — usado por padrão nos cálculos de presença e na geração de encontros.
          </p>
        </div>
        <div class="att-hero-v2__cta">
          <button id="newSemesterBtn" class="btn btn--primary">
            ${icon('plus', { size: 14 })}<span style="margin-left:6px;">Novo semestre</span>
          </button>
        </div>
        <div class="att-hero-v2__page">${codexPage({ size: 200 })}</div>
      </header>

      <div id="semestersList">
        <div class="att-loading-wrap">
          <span class="att-bloom"><span class="att-codex-seal">${codexSeal({ size: 24 })}</span></span>
          <p>Abrindo os anais…</p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('newSemesterBtn').addEventListener('click', () => openSemesterForm(null, () => loadSemesters()));
  await loadSemesters();
}

async function loadSemesters() {
  const box = document.getElementById('semestersList');
  const { data: rows, error } = await data.listSemesters();
  if (error) { box.innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`; return; }
  if (!rows?.length) {
    box.innerHTML = `
      <div class="att-empty-v2">
        <div class="att-empty-v2__art">${icon('calendar', { size: 56 })}</div>
        <h3>Nenhum semestre criado ainda</h3>
        <p>Defina o período letivo (ex.: "2026.1" de 01/03 a 15/07) pra organizar os encontros.</p>
        <button class="btn btn--primary" id="emptyNewSemesterBtn">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Criar primeiro</span></button>
      </div>
    `;
    document.getElementById('emptyNewSemesterBtn').addEventListener('click', () => openSemesterForm(null, () => loadSemesters()));
    return;
  }

  // ordena: atual primeiro, depois por start_date desc
  const sorted = [...rows].sort((a, b) => {
    if (a.is_current !== b.is_current) return a.is_current ? -1 : 1;
    return b.start_date.localeCompare(a.start_date);
  });

  box.innerHTML = `<div class="att-sem-grid">${sorted.map(semesterLetter).join('')}</div>`;

  for (const card of box.querySelectorAll('.att-sem-letter')) {
    const id = card.dataset.semesterId;
    card.querySelector('[data-action="edit"]')?.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      const { data: row } = await data.getSemester(id);
      if (row) openSemesterForm(row, () => loadSemesters());
    });
    card.querySelector('[data-action="set-current"]')?.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      const { error } = await data.setCurrentSemester(id);
      if (error) toastError(error.message);
      else toastSuccess('Marcado como semestre atual.');
      await loadSemesters();
    });
  }
}

function semesterLetter(s) {
  const start = new Date(s.start_date + 'T00:00:00');
  const end   = new Date(s.end_date + 'T00:00:00');
  const fmt = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const isPast = s.end_date < todayStr;
  const isFuture = s.start_date > todayStr;
  const eyebrow = s.is_current ? 'aberto agora' : isPast ? 'encerrado' : isFuture ? 'por vir' : 'em andamento';

  // duração em semanas
  const weeks = Math.max(1, Math.round((end - start) / (7 * 86400000)));

  return `
    <article class="att-sem-letter ${s.is_current ? 'is-current' : ''}" data-semester-id="${escapeAttr(s.id)}">
      <div class="att-sem-letter__page">${codexPage({ size: 150 })}</div>

      <div class="att-sem-letter__head">
        <span class="att-sem-letter__seal">${codexSeal({ size: 22 })}</span>
        <div class="att-sem-letter__title">
          <p class="att-sem-letter__eyebrow">${escapeHtml(eyebrow)}</p>
          <h3 class="att-sem-letter__name">${escapeHtml(s.name)}</h3>
        </div>
      </div>

      <div class="att-sem-letter__range">
        <strong>${escapeHtml(fmt(start))}</strong>
        ${icon('arrow-right', { size: 12 })}
        <strong>${escapeHtml(fmt(end))}</strong>
        <span class="muted">· ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}</span>
      </div>

      ${s.is_current ? `
        <span class="att-sem-letter__current-badge">
          ${icon('star', { size: 11 })}
          <span>semestre atual</span>
        </span>
      ` : ''}

      <div class="att-sem-letter__actions">
        ${!s.is_current ? `
          <button class="btn btn--ghost btn--small" data-action="set-current">
            ${icon('star', { size: 12 })}<span style="margin-left:6px;">tornar atual</span>
          </button>
        ` : ''}
        <span class="spacer"></span>
        <button class="icon-btn" data-action="edit" title="Editar semestre" aria-label="Editar semestre">${icon('edit', { size: 14 })}</button>
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
  function onKey(e) {
    if (e.key === 'Escape') close();
    if ((e.key === 's' || e.key === 'S') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      doSave();
    }
  }
  document.addEventListener('keydown', onKey);

  async function doSave() {
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

    if (action === 'save') await doSave();
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
