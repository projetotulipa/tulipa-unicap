// Lista de grupos — Sprint 2 (cartas editoriais + toolbar + toggle grid/lista).
// Apenas admin pode criar/editar/excluir.

import { icon } from '../icons.js';
import * as data from '../attendance/data.js';
import { calcMonthlyStatus, currentMonthRange } from '../attendance/status.js';
import { renderSubNav } from './attendance-nav.js';
import { codexSeal, codexPage } from '../attendance/codex.js';
import { toastSuccess, toastError } from '../toast.js';

const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const SCHEDULE_LABELS = { weekly: 'Toda semana', biweekly: 'Quinzenal', monthly: 'Mensal', manual: 'Sob demanda' };
const SCHEDULE_SHORT = { weekly: 'semanal', biweekly: 'quinzenal', monthly: 'mensal', manual: 'sob demanda' };

// estado per-view (kind do roadmap consolidado)
const viewState = {
  search: '',
  scheduleFilter: 'all', // all | weekly | biweekly | monthly | manual
  showArchived: false,
  sort: 'name', // name | members | pct_high | pct_low | next
  layout: 'grid', // grid | list
};

let cached = null; // { groups, perGroup }

export async function renderAttendanceGroups(ctx) {
  const { root, state } = ctx;
  const isAdmin = state.role === 'admin';

  root.innerHTML = `
    <div class="view">
      ${renderSubNav('grupos', { isAdmin })}

      <header class="att-hero-v2">
        <div class="att-hero-v2__seal-wrap">
          <span class="att-codex-seal">${codexSeal({ size: 32 })}</span>
        </div>
        <div class="att-hero-v2__inner">
          <p class="att-hero-v2__eyebrow">grupos · livros abertos</p>
          <h1>Grupos de presença</h1>
          <p class="att-hero-v2__lede">
            ${isAdmin
              ? 'Cada grupo tem sua agenda fixa e pessoas vinculadas. Crie, organize, arquive.'
              : 'Os grupos que você acompanha. Criação e arquivamento ficam com o administrador.'}
          </p>
        </div>
        ${isAdmin ? `
          <div class="att-hero-v2__cta">
            <button id="newGroupBtn" class="btn btn--primary">
              ${icon('plus', { size: 14 })}<span style="margin-left:6px;">Novo grupo</span>
            </button>
          </div>
        ` : ''}
        <div class="att-hero-v2__page">${codexPage({ size: 200 })}</div>
      </header>

      <div id="groupsToolbar"></div>

      <div id="groupsList">
        <div class="att-loading-wrap">
          <span class="att-bloom"><span class="att-codex-seal">${codexSeal({ size: 24 })}</span></span>
          <p>Abrindo livros…</p>
        </div>
      </div>
    </div>
  `;

  if (isAdmin) {
    document.getElementById('newGroupBtn').addEventListener('click', () => openGroupForm(ctx));
  }

  await loadAll(ctx);
}

async function loadAll(ctx) {
  const { from, to } = currentMonthRange();

  const { data: groups, error } = await data.listGroups({ includeArchived: true });
  if (error) {
    document.getElementById('groupsList').innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`;
    return;
  }
  if (!groups?.length) {
    document.getElementById('groupsToolbar').innerHTML = '';
    document.getElementById('groupsList').innerHTML = `
      <div class="att-empty-v2 att-empty-v2--rose">
        <div class="att-empty-v2__art">${codexSeal({ size: 56 })}</div>
        <h3>Nenhum grupo criado ainda</h3>
        <p>Cada grupo é um livro de presenças: agenda fixa, pessoas vinculadas, histórico próprio. Crie o primeiro para começar.</p>
        ${ctx.state.role === 'admin' ? `<button class="btn btn--primary" id="emptyNewGroupBtn">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Criar primeiro grupo</span></button>` : ''}
      </div>
    `;
    if (ctx.state.role === 'admin') {
      document.getElementById('emptyNewGroupBtn').addEventListener('click', () => openGroupForm(ctx));
    }
    return;
  }

  const perGroup = await Promise.all(groups.map(async (g) => {
    const [memRes, meetRes] = await Promise.all([
      data.listMembershipsOfGroup(g.id),
      data.listAttendanceByGroupInRange(g.id, from, to),
    ]);
    const members = memRes.data || [];
    const meetings = meetRes.data || [];
    const happenedCount = meetings.filter((m) => m.status === 'happened').length;
    const todayStr = isoDate(new Date());
    const upcoming = meetings.filter((m) => m.status === 'scheduled' && m.date >= todayStr).sort((a,b) => a.date.localeCompare(b.date))[0];
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

  cached = { perGroup, ctx };
  renderToolbar(ctx);
  renderList(ctx);
}

function renderToolbar(ctx) {
  const all = cached.perGroup;
  const counts = countsBySchedule(all);
  const archivedCount = all.filter((d) => d.group.is_archived).length;

  document.getElementById('groupsToolbar').innerHTML = `
    <div class="att-toolbar">
      <div class="att-toolbar__group">
        <input type="text" id="groupSearch" placeholder="Buscar grupo por nome…" value="${escapeAttr(viewState.search)}" />
      </div>
      <div class="att-toolbar__group">
        ${chip('all', `todos`, counts.all)}
        ${chip('weekly', `toda semana`, counts.weekly)}
        ${chip('biweekly', `quinzenal`, counts.biweekly)}
        ${chip('monthly', `mensal`, counts.monthly)}
        ${chip('manual', `sob demanda`, counts.manual)}
      </div>
      <span class="att-toolbar__sep"></span>
      <div class="att-toolbar__group">
        <label class="att-chip ${viewState.showArchived ? 'is-active' : ''}" data-toggle="archived" style="cursor:pointer;">
          ${icon('eye', { size: 12 })}<span style="margin-left:4px;">arquivados</span>
          <span class="att-chip__count">${archivedCount}</span>
        </label>
      </div>
      <span class="att-toolbar__spacer"></span>
      <div class="att-toolbar__group">
        <span class="att-toolbar__label">ordenar</span>
        <select id="groupSort">
          <option value="name" ${viewState.sort === 'name' ? 'selected' : ''}>nome</option>
          <option value="members" ${viewState.sort === 'members' ? 'selected' : ''}>mais membros</option>
          <option value="pct_high" ${viewState.sort === 'pct_high' ? 'selected' : ''}>maior presença</option>
          <option value="pct_low" ${viewState.sort === 'pct_low' ? 'selected' : ''}>menor presença</option>
          <option value="next" ${viewState.sort === 'next' ? 'selected' : ''}>próximo encontro</option>
        </select>
      </div>
      <div class="att-view-toggle">
        <button data-layout="grid" class="${viewState.layout === 'grid' ? 'is-active' : ''}" aria-label="Visão em cartas">
          ${icon('group', { size: 14 })}<span style="margin-left:4px;">cartas</span>
        </button>
        <button data-layout="list" class="${viewState.layout === 'list' ? 'is-active' : ''}" aria-label="Visão em lista">
          ${icon('drag', { size: 14 })}<span style="margin-left:4px;">lista</span>
        </button>
      </div>
    </div>
  `;

  document.getElementById('groupSearch').addEventListener('input', (e) => {
    viewState.search = e.target.value;
    renderList(ctx);
  });
  document.getElementById('groupSort').addEventListener('change', (e) => {
    viewState.sort = e.target.value;
    renderList(ctx);
  });

  document.querySelectorAll('.att-toolbar [data-chip]').forEach((el) => {
    el.addEventListener('click', () => {
      viewState.scheduleFilter = el.dataset.chip;
      renderToolbar(ctx);
      renderList(ctx);
    });
  });
  document.querySelector('.att-toolbar [data-toggle="archived"]').addEventListener('click', (e) => {
    e.preventDefault();
    viewState.showArchived = !viewState.showArchived;
    renderToolbar(ctx);
    renderList(ctx);
  });
  document.querySelectorAll('.att-view-toggle button').forEach((btn) => {
    btn.addEventListener('click', () => {
      viewState.layout = btn.dataset.layout;
      renderToolbar(ctx);
      renderList(ctx);
    });
  });
}

function chip(key, label, count) {
  const active = viewState.scheduleFilter === key ? ' is-active' : '';
  const disabled = count === 0 ? ' disabled' : '';
  return `<button class="att-chip${active}" data-chip="${key}"${disabled}>
    <span>${escapeHtml(label)}</span>
    <span class="att-chip__count">${count}</span>
  </button>`;
}

function countsBySchedule(all) {
  const visible = all.filter((d) => viewState.showArchived || !d.group.is_archived);
  const c = { all: visible.length, weekly: 0, biweekly: 0, monthly: 0, manual: 0 };
  for (const d of visible) c[d.group.schedule_kind] = (c[d.group.schedule_kind] || 0) + 1;
  return c;
}

function renderList(ctx) {
  const all = cached.perGroup;
  const isAdmin = ctx.state.role === 'admin';

  let filtered = all.filter((d) => viewState.showArchived || !d.group.is_archived);
  if (viewState.scheduleFilter !== 'all') {
    filtered = filtered.filter((d) => d.group.schedule_kind === viewState.scheduleFilter);
  }
  const q = viewState.search.toLowerCase().trim();
  if (q) {
    filtered = filtered.filter((d) => d.group.name.toLowerCase().includes(q));
  }
  filtered.sort(sorter(viewState.sort));

  const box = document.getElementById('groupsList');
  if (filtered.length === 0) {
    box.innerHTML = `<div class="att-no-results">
      <span>Nada por aqui</span>
      <p>nenhum grupo corresponde aos filtros atuais.</p>
    </div>`;
    return;
  }

  if (viewState.layout === 'grid') {
    box.innerHTML = `<div class="att-group-letter-grid">${filtered.map((d) => groupLetterCard(d, isAdmin)).join('')}</div>`;
  } else {
    box.innerHTML = `<div class="att-group-dense-list">${filtered.map((d) => groupDenseRow(d, isAdmin)).join('')}</div>`;
  }

  if (isAdmin) wireActions(ctx, box);
}

function wireActions(ctx, box) {
  for (const card of box.querySelectorAll('[data-group-id]')) {
    const gid = card.dataset.groupId;
    card.querySelector('[data-action="edit-group"]')?.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const { data: row } = await data.getGroup(gid);
      if (row) openGroupForm(ctx, row);
    });
    card.querySelector('[data-action="delete-group"]')?.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const name = card.dataset.name;
      if (!confirm(`Excluir o grupo "${name}"? Isso apaga encontros e marcações associadas. Não desfaz.`)) return;
      const { error } = await data.deleteGroup(gid);
      if (error) { toastError(error.message); return; }
      toastSuccess('Grupo excluído.');
      await loadAll(ctx);
    });
  }
}

function sorter(key) {
  switch (key) {
    case 'members': return (a, b) => b.memberCount - a.memberCount || a.group.name.localeCompare(b.group.name);
    case 'pct_high': return (a, b) => (b.pct ?? -1) - (a.pct ?? -1) || a.group.name.localeCompare(b.group.name);
    case 'pct_low': return (a, b) => {
      // null vai por último em pct_low (sem encontros ainda)
      if (a.pct === null && b.pct === null) return a.group.name.localeCompare(b.group.name);
      if (a.pct === null) return 1;
      if (b.pct === null) return -1;
      return a.pct - b.pct;
    };
    case 'next': return (a, b) => {
      const aDate = a.upcoming?.date || '9999-99-99';
      const bDate = b.upcoming?.date || '9999-99-99';
      return aDate.localeCompare(bDate);
    };
    case 'name':
    default: return (a, b) => a.group.name.localeCompare(b.group.name, 'pt-BR');
  }
}

function groupLetterCard(d, isAdmin) {
  const { group: g, memberCount, happenedCount, upcoming, alertsCount, pct } = d;
  const schedule = SCHEDULE_LABELS[g.schedule_kind] || g.schedule_kind;
  const weekday = g.weekday !== null && g.weekday !== undefined ? WEEKDAY_LABELS[g.weekday] : null;
  const time = g.start_time ? g.start_time.slice(0, 5) : null;
  const eyebrow = [schedule, weekday, time].filter(Boolean).join(' · ');

  const nextWhen = upcoming ? humanRelative(upcoming.date) : null;
  const monogram = monogramOf(g.name);

  const loadFill = pct === null ? '' :
    pct >= 70 ? '' :
    pct >= 50 ? ' att-group-letter__load-fill--low' :
    ' att-group-letter__load-fill--critical';
  const loadLabel = pct === null ? 'sem dados' : `${pct}% presença`;
  const loadWidth = pct === null ? 0 : Math.max(4, pct);

  const pctClass = pct === null ? 'muted' :
    pct >= 70 ? 'sage' :
    pct >= 50 ? 'gold' : 'warning';

  return `
    <a class="att-group-letter ${g.is_archived ? 'is-archived' : ''}"
       href="#/presenca/grupos/${escapeAttr(g.id)}"
       data-group-id="${escapeAttr(g.id)}"
       data-name="${escapeAttr(g.name)}">
      <div class="att-group-letter__watermark">${codexPage({ size: 150 })}</div>

      <div class="att-group-letter__head">
        <span class="att-group-letter__monogram" aria-hidden="true">${escapeHtml(monogram)}</span>
        <div class="att-group-letter__title">
          <p class="att-group-letter__eyebrow">${escapeHtml(eyebrow || '—')}</p>
          <h3>${escapeHtml(g.name)}</h3>
        </div>
      </div>

      ${g.description ? `<p class="att-group-letter__desc">${escapeHtml(g.description)}</p>` : ''}

      <div class="att-group-letter__stats">
        <div class="att-group-letter__stat">
          <strong>${memberCount}</strong>
          <span>${memberCount === 1 ? 'membro' : 'membros'}</span>
        </div>
        <div class="att-group-letter__stat att-group-letter__stat--gold">
          <strong>${happenedCount}</strong>
          <span>encontros</span>
        </div>
        <div class="att-group-letter__stat att-group-letter__stat--${pctClass}">
          <strong>${pct === null ? '—' : pct + '%'}</strong>
          <span>presença</span>
        </div>
      </div>

      <div class="att-group-letter__load" title="${escapeAttr(loadLabel)}">
        <div class="att-group-letter__load-track">
          <div class="att-group-letter__load-fill${loadFill}" style="width: ${loadWidth}%;"></div>
        </div>
        <span class="att-group-letter__load-label">${escapeHtml(loadLabel)}</span>
      </div>

      <div class="att-group-letter__foot">
        ${alertsCount > 0 ? `<span class="att-pill-v2 att-pill-v2--warning">${icon('alert', { size: 11 })}<span style="margin-left:4px;">${alertsCount} alerta${alertsCount === 1 ? '' : 's'}</span></span>` : ''}
        ${nextWhen ? `<span class="att-group-letter__next">${icon('clock', { size: 11 })}<span style="margin-left:4px;">próximo: ${escapeHtml(nextWhen)}</span></span>` : ''}
        ${g.is_archived ? '<span class="att-group-letter__archived-badge">arquivado</span>' : ''}
      </div>

      ${isAdmin ? `
        <div class="att-group-letter__menu">
          <button class="icon-btn icon-btn--xs" data-action="edit-group" title="Editar grupo" aria-label="Editar grupo">${icon('edit', { size: 12 })}</button>
          <button class="icon-btn icon-btn--xs" data-action="delete-group" title="Excluir grupo" aria-label="Excluir grupo">${icon('trash', { size: 12 })}</button>
        </div>
      ` : ''}
    </a>
  `;
}

function groupDenseRow(d, isAdmin) {
  const { group: g, memberCount, pct } = d;
  const schedule = SCHEDULE_LABELS[g.schedule_kind] || g.schedule_kind;
  const weekday = g.weekday !== null && g.weekday !== undefined ? WEEKDAY_LABELS[g.weekday] : null;
  const time = g.start_time ? g.start_time.slice(0, 5) : null;
  const subtitle = [SCHEDULE_SHORT[g.schedule_kind] || schedule, weekday, time].filter(Boolean).join(' · ');

  const monogram = monogramOf(g.name);
  const pctClass = pct === null ? 'empty' :
    pct >= 70 ? 'ok' :
    pct >= 50 ? 'mid' : 'low';

  return `
    <a class="att-group-dense-row ${g.is_archived ? 'is-archived' : ''}"
       href="#/presenca/grupos/${escapeAttr(g.id)}"
       data-group-id="${escapeAttr(g.id)}"
       data-name="${escapeAttr(g.name)}">
      <span class="att-group-dense-row__mono" aria-hidden="true">${escapeHtml(monogram)}</span>
      <div class="att-group-dense-row__title">
        <strong>${escapeHtml(g.name)}</strong>
        <span>${escapeHtml(subtitle)}</span>
      </div>
      <div class="att-group-dense-row__schedule">${g.description ? escapeHtml(g.description) : '—'}</div>
      <div class="att-group-dense-row__pct att-group-dense-row__pct--${pctClass}">
        ${pct === null ? '—' : pct + '%'}
      </div>
      <div class="att-group-dense-row__members">${memberCount} ${memberCount === 1 ? 'pessoa' : 'pessoas'}</div>
      <span class="att-group-dense-row__chevron">${icon('chevron', { size: 14 })}</span>
    </a>
  `;
}

// monograma: primeira letra do nome (até 2 letras se "ABC..." começa com letra única)
function monogramOf(name) {
  if (!name) return '·';
  const cleaned = String(name).trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] || '') + (parts[parts.length - 1][0] || '');
  }
  return (cleaned[0] || '·').toUpperCase();
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
  function onKey(e) {
    if (e.key === 'Escape') close();
    if ((e.key === 's' || e.key === 'S') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      doSave();
    }
  }
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

  async function doSave() {
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
    await loadAll(ctx);
  }

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
      await loadAll(ctx);
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
