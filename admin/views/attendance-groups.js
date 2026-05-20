// CRUD de grupos de presença. Apenas admin pode criar/editar/excluir.

import { icon } from '../icons.js';
import * as data from '../attendance/data.js';
import { calcMonthlyStatus, currentMonthRange, STATUS_COLORS } from '../attendance/status.js';
import { renderSubNav } from './attendance-nav.js';
import { toastSuccess, toastError } from '../toast.js';

const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const SCHEDULE_LABELS = { weekly: 'Toda semana', biweekly: 'Quinzenal', monthly: 'Mensal', manual: 'Sob demanda' };

let cachedCtx = null;

export async function renderAttendanceGroups(ctx) {
  const { root, state } = ctx;
  cachedCtx = ctx;
  const isAdmin = state.role === 'admin';

  root.innerHTML = `
    <div class="view">
      ${renderSubNav('grupos')}

      <header class="view__header" style="display:flex; align-items:flex-end; justify-content:space-between; gap:14px;">
        <div>
          <h1>Grupos de presença</h1>
          <p class="view__lede">${isAdmin
            ? 'Crie e organize os grupos. Cada um tem agenda e membros vinculados.'
            : 'Você pode ver os grupos e gerenciar seus membros. Criação/edição é responsabilidade do administrador.'
          }</p>
        </div>
        ${isAdmin ? `
          <button id="newGroupBtn" class="btn btn--primary">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Novo grupo</span></button>
        ` : ''}
      </header>

      <div class="search-bar">
        <span class="search-bar__icon">${icon('search', { size: 16 })}</span>
        <input type="text" id="groupSearch" placeholder="Buscar grupo por nome…" />
      </div>

      <div id="groupsList" class="empty-state">
        <div class="skel skel--title"></div>
        <div class="skel skel--block"></div>
      </div>
    </div>
  `;

  if (isAdmin) {
    document.getElementById('newGroupBtn').addEventListener('click', () => openGroupForm(ctx));
  }
  document.getElementById('groupSearch').addEventListener('input', filterGroups);

  await loadGroups(ctx);
}

let allCards = []; // [{ el, name }]

function filterGroups(ev) {
  const q = ev.target.value.toLowerCase().trim();
  for (const { el, name } of allCards) {
    el.hidden = q && !name.toLowerCase().includes(q);
  }
}

async function loadGroups(ctx) {
  const box = document.getElementById('groupsList');
  const { year, month, from, to } = currentMonthRange();

  const { data: groups, error } = await data.listGroups({ includeArchived: true });
  if (error) { box.innerHTML = `<p class="muted">${error.message}</p>`; return; }
  if (!groups?.length) {
    box.innerHTML = `
      <div class="att-empty">
        <div class="att-empty__art">${icon('group', { size: 60 })}</div>
        <h3>Nenhum grupo criado ainda</h3>
        <p>Cada grupo tem agenda fixa e pessoas vinculadas. Crie o primeiro para começar.</p>
        ${ctx.state.role === 'admin' ? `<button class="btn btn--primary" id="emptyNewGroupBtn">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Criar primeiro grupo</span></button>` : ''}
      </div>
    `;
    if (ctx.state.role === 'admin') {
      document.getElementById('emptyNewGroupBtn').addEventListener('click', () => openGroupForm(ctx));
    }
    return;
  }

  // pra cada grupo, busca members + meetings em paralelo (pra computar stats)
  const perGroup = await Promise.all(groups.map(async (g) => {
    const [memRes, meetRes] = await Promise.all([
      data.listMembershipsOfGroup(g.id),
      data.listAttendanceByGroupInRange(g.id, from, to),
    ]);
    const members = memRes.data || [];
    const meetings = meetRes.data || [];
    // estatuses
    const happenedCount = meetings.filter((m) => m.status === 'happened').length;
    const upcoming = meetings.filter((m) => m.status === 'scheduled' && m.date >= isoDate(new Date())).sort((a,b) => a.date.localeCompare(b.date))[0];
    let alertsCount = 0;
    for (const mem of members) {
      const st = calcMonthlyStatus(meetings, mem.person_id, { isWeekly: g.schedule_kind === 'weekly' });
      if (st.color === 'orange' || st.color === 'red') alertsCount++;
    }
    let totalSlots = 0;
    let totalPresent = 0;
    for (const m of meetings) {
      if (m.status === 'happened') {
        totalSlots += members.length;
        totalPresent += (m.attendance || []).filter((a) => a.is_present).length;
      }
    }
    const pct = totalSlots > 0 ? Math.round(totalPresent / totalSlots * 100) : null;
    return { group: g, memberCount: members.length, happenedCount, upcoming, alertsCount, pct };
  }));

  box.className = '';
  box.innerHTML = `<div class="att-group-list">${perGroup.map(groupCard).join('')}</div>`;

  allCards = Array.from(box.querySelectorAll('.att-group-card')).map((el) => ({
    el,
    name: el.dataset.name || '',
  }));
}

function groupCard(d) {
  const { group: g, memberCount, happenedCount, upcoming, alertsCount, pct } = d;
  const schedule = SCHEDULE_LABELS[g.schedule_kind] || g.schedule_kind;
  const weekday = g.weekday !== null && g.weekday !== undefined ? WEEKDAY_LABELS[g.weekday] : null;
  const time = g.start_time ? g.start_time.slice(0, 5) : null;
  const subtitle = [schedule, weekday, time].filter(Boolean).join(' · ');

  const nextWhen = upcoming ? humanRelative(upcoming.date) : null;
  const pctBadge = pct === null ? null
    : pct >= 80 ? `<span class="pill pill--success">${pct}% presença</span>`
    : pct >= 60 ? `<span class="pill pill--gold">${pct}% presença</span>`
    :             `<span class="pill" style="color:var(--warning); border-color: rgba(199,127,61,0.4);">${pct}% presença</span>`;

  return `
    <article class="att-group-card ${g.is_archived ? 'is-archived' : ''}" data-name="${escapeAttr(g.name)}">
      <a class="att-group-card__main" href="#/presenca/grupos/${escapeAttr(g.id)}">
        <span class="att-group-card__icon">${icon('group', { size: 22 })}</span>
        <div class="att-group-card__body">
          <strong>${escapeHtml(g.name)}</strong>
          <span class="muted">${escapeHtml(subtitle)}</span>
          ${g.description ? `<span class="att-group-card__desc">${escapeHtml(g.description)}</span>` : ''}
          <div class="att-group-card__stats">
            <span class="pill">${icon('users', { size: 11 })}<span style="margin-left:4px;">${memberCount} ${memberCount === 1 ? 'membro' : 'membros'}</span></span>
            ${happenedCount > 0 ? `<span class="pill">${icon('calendar', { size: 11 })}<span style="margin-left:4px;">${happenedCount} encontro${happenedCount === 1 ? '' : 's'} no mês</span></span>` : ''}
            ${pctBadge || ''}
            ${alertsCount > 0 ? `<span class="pill" style="color: var(--warning); border-color: rgba(199, 127, 61, 0.4);">${icon('alert', { size: 11 })}<span style="margin-left:4px;">${alertsCount} alerta${alertsCount === 1 ? '' : 's'}</span></span>` : ''}
          </div>
          ${nextWhen ? `<span class="att-group-card__next">${icon('clock', { size: 11 })}<span style="margin-left:4px;">próximo encontro: ${escapeHtml(nextWhen)}</span></span>` : ''}
          ${g.is_archived ? '<span class="att-group-card__badge">arquivado</span>' : ''}
        </div>
      </a>
    </article>
  `;
}

function humanRelative(dateStr) {
  const today = isoDate(new Date());
  if (dateStr === today) return 'hoje';
  const d = new Date(dateStr + 'T00:00:00');
  const todayD = new Date(today + 'T00:00:00');
  const diff = Math.round((d - todayD) / 86400000);
  if (diff === 1) return 'amanhã';
  if (diff < 7) return `em ${diff} dias`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function isoDate(d) { return d.toISOString().slice(0, 10); }

// ---------- form: criar/editar grupo (só admin) ----------
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
            <option value="manual"   ${existing?.schedule_kind === 'manual'   ? 'selected' : ''}>Sob demanda</option>
          </select>
        </label>
        <label class="drawer-field" id="weekdayField">
          <span class="drawer-field__label">Dia da semana</span>
          <select name="weekday" class="drawer-field__input">
            <option value="">—</option>
            ${WEEKDAY_LABELS.map((lab, idx) => `<option value="${idx}" ${existing?.weekday === idx ? 'selected' : ''}>${lab}</option>`).join('')}
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
      if (!confirm(`Excluir o grupo "${existing.name}"? Isso apaga encontros e marcações associadas.`)) return;
      const { error } = await data.deleteGroup(existing.id);
      if (error) { toastError(error.message); return; }
      toastSuccess('Grupo excluído.');
      close();
      await loadGroups(ctx);
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
      if (isEdit) fields.is_archived = fd.get('is_archived') === 'true';
      if (!fields.name) { toastError('O nome é obrigatório.'); return; }
      if ((fields.schedule_kind === 'weekly' || fields.schedule_kind === 'biweekly') && fields.weekday === null) {
        toastError('Escolha o dia da semana.'); return;
      }
      const { error } = isEdit ? await data.updateGroup(existing.id, fields) : await data.createGroup(fields);
      if (error) { toastError(error.message); return; }
      toastSuccess(isEdit ? 'Grupo atualizado.' : 'Grupo criado.');
      close();
      await loadGroups(ctx);
    }
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
