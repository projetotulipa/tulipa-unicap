// CRUD de grupos de presença.

import { icon } from '../icons.js';
import * as data from '../attendance/data.js';

const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const SCHEDULE_LABELS = { weekly: 'Toda semana', biweekly: 'Quinzenal', monthly: 'Mensal', manual: 'Sob demanda' };

export async function renderAttendanceGroups(ctx) {
  const { root } = ctx;

  root.innerHTML = `
    <div class="view">
      <p class="view__crumbs"><a href="#/presenca">${icon('arrow-left', { size: 14 })}<span style="margin-left:6px;">Presença</span></a></p>
      <header class="view__header" style="display:flex; align-items:flex-end; justify-content:space-between; gap:14px;">
        <div>
          <h1>Grupos de presença</h1>
          <p class="view__lede">Cada grupo tem sua agenda e os membros vinculados. Crie quantos forem necessários.</p>
        </div>
        <button id="newGroupBtn" class="btn btn--primary">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Novo grupo</span></button>
      </header>

      <div id="groupsList" class="empty-state">carregando…</div>
    </div>
  `;

  document.getElementById('newGroupBtn').addEventListener('click', () => openGroupForm(ctx));
  await loadGroups();
}

async function loadGroups() {
  const box = document.getElementById('groupsList');
  const { data: rows, error } = await data.listGroups({ includeArchived: true });
  if (error) {
    box.innerHTML = `<p class="muted">${error.message}</p>`;
    return;
  }
  if (!rows?.length) {
    box.innerHTML = `<p class="muted">Nenhum grupo criado ainda. Clique em "Novo grupo".</p>`;
    return;
  }
  box.className = '';
  box.innerHTML = `
    <div class="att-group-list">
      ${rows.map(groupCard).join('')}
    </div>
  `;
}

function groupCard(g) {
  const schedule = SCHEDULE_LABELS[g.schedule_kind] || g.schedule_kind;
  const weekday = g.weekday !== null && g.weekday !== undefined ? WEEKDAY_LABELS[g.weekday] : null;
  const time = g.start_time ? g.start_time.slice(0, 5) : null;
  const subtitle = [schedule, weekday, time].filter(Boolean).join(' · ');

  return `
    <article class="att-group-card ${g.is_archived ? 'is-archived' : ''}">
      <a class="att-group-card__main" href="#/presenca/grupos/${escapeAttr(g.id)}">
        <span class="att-group-card__icon">${icon('group', { size: 22 })}</span>
        <div>
          <strong>${escapeHtml(g.name)}</strong>
          <span class="muted">${escapeHtml(subtitle)}</span>
          ${g.description ? `<span class="att-group-card__desc">${escapeHtml(g.description)}</span>` : ''}
          ${g.is_archived ? '<span class="att-group-card__badge">arquivado</span>' : ''}
        </div>
      </a>
    </article>
  `;
}

// ---------- form: criar/editar grupo ----------
function openGroupForm(ctx, existing = null) {
  document.querySelectorAll('.block-drawer-overlay').forEach((el) => el.remove());

  const isEdit = !!existing;
  const overlay = document.createElement('div');
  overlay.className = 'block-drawer-overlay';
  overlay.innerHTML = `
    <div class="block-drawer">
      <header class="block-drawer__head">
        <div>
          <p class="block-drawer__crumb">${isEdit ? 'Editando grupo' : 'Novo grupo'}</p>
          <h2><span class="block-drawer__icon">${icon('group', { size: 26 })}</span> ${isEdit ? escapeHtml(existing.name) : 'Grupo novo'}</h2>
        </div>
        <button class="icon-btn" data-action="close" aria-label="Fechar">${icon('x', { size: 16 })}</button>
      </header>
      <form class="block-drawer__body" id="groupForm">
        <label class="drawer-field">
          <span class="drawer-field__label">Nome</span>
          <input type="text" name="name" class="drawer-field__input" required value="${escapeAttr(existing?.name || '')}" placeholder="Ex.: Grupo de estudo Jung — terça" />
        </label>
        <label class="drawer-field">
          <span class="drawer-field__label">Descrição (opcional)</span>
          <textarea name="description" class="drawer-field__input" rows="2" placeholder="Qual o foco do grupo?">${escapeHtml(existing?.description || '')}</textarea>
        </label>
        <label class="drawer-field">
          <span class="drawer-field__label">Frequência</span>
          <select name="schedule_kind" class="drawer-field__input">
            <option value="weekly"   ${existing?.schedule_kind === 'weekly'   ? 'selected' : ''}>Toda semana</option>
            <option value="biweekly" ${existing?.schedule_kind === 'biweekly' ? 'selected' : ''}>Quinzenal</option>
            <option value="monthly"  ${existing?.schedule_kind === 'monthly'  ? 'selected' : ''}>Mensal</option>
            <option value="manual"   ${existing?.schedule_kind === 'manual'   ? 'selected' : ''}>Sob demanda (sem agenda fixa)</option>
          </select>
        </label>
        <label class="drawer-field" id="weekdayField">
          <span class="drawer-field__label">Dia da semana</span>
          <select name="weekday" class="drawer-field__input">
            <option value="">—</option>
            ${WEEKDAY_LABELS.map((lab, idx) => `
              <option value="${idx}" ${existing?.weekday === idx ? 'selected' : ''}>${lab}</option>
            `).join('')}
          </select>
        </label>
        <label class="drawer-field">
          <span class="drawer-field__label">Horário (opcional)</span>
          <input type="time" name="start_time" class="drawer-field__input" value="${escapeAttr(existing?.start_time?.slice(0,5) || '')}" />
        </label>
        ${isEdit ? `
          <label class="drawer-field">
            <span class="drawer-field__label">Estado</span>
            <select name="is_archived" class="drawer-field__input">
              <option value="false" ${!existing.is_archived ? 'selected' : ''}>Ativo</option>
              <option value="true"  ${existing.is_archived ? 'selected' : ''}>Arquivado</option>
            </select>
          </label>
        ` : ''}
        <p id="groupFormError" class="muted" style="color:var(--danger); display:none;"></p>
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

  // controla visibilidade do weekday baseado em schedule
  const form = overlay.querySelector('#groupForm');
  const scheduleSel = form.querySelector('[name="schedule_kind"]');
  const weekdayField = overlay.querySelector('#weekdayField');
  function syncWeekday() {
    const kind = scheduleSel.value;
    weekdayField.style.display = (kind === 'weekly' || kind === 'biweekly') ? '' : 'none';
  }
  scheduleSel.addEventListener('change', syncWeekday);
  syncWeekday();

  overlay.addEventListener('click', async (ev) => {
    if (ev.target === overlay) { close(); return; }
    const action = ev.target.closest('[data-action]')?.dataset?.action;
    if (action === 'close') return close();

    if (action === 'delete') {
      if (!confirm(`Excluir o grupo "${existing.name}"? Isso apaga encontros e marcações de presença associadas.`)) return;
      const { error } = await data.deleteGroup(existing.id);
      if (error) { showFormError(error.message); return; }
      close();
      await loadGroups();
      return;
    }

    if (action === 'save') {
      const fd = new FormData(form);
      const fields = {
        name: String(fd.get('name') || '').trim(),
        description: String(fd.get('description') || '').trim() || null,
        schedule_kind: String(fd.get('schedule_kind') || 'weekly'),
        weekday: fd.get('weekday') ? Number(fd.get('weekday')) : null,
        start_time: String(fd.get('start_time') || '') || null,
      };
      if (isEdit) {
        fields.is_archived = fd.get('is_archived') === 'true';
      }
      if (!fields.name) { showFormError('O nome é obrigatório.'); return; }
      if ((fields.schedule_kind === 'weekly' || fields.schedule_kind === 'biweekly') && fields.weekday === null) {
        showFormError('Escolha o dia da semana.'); return;
      }

      const promise = isEdit
        ? data.updateGroup(existing.id, fields)
        : data.createGroup(fields);
      const { error } = await promise;
      if (error) { showFormError(error.message); return; }
      close();
      await loadGroups();
    }
  });

  function showFormError(msg) {
    const el = overlay.querySelector('#groupFormError');
    el.textContent = msg;
    el.style.display = '';
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
