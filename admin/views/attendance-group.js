// Detalhe de um grupo — Sprint 2 (hero editorial + section v2 + meeting chip v2).
// Mantém formulários e tabelas existentes (membros, justificativas).

import { icon } from '../icons.js';
import * as data from '../attendance/data.js';
import { calcMonthlyStatus, STATUS_COLORS, currentMonthRange, monthLabel, shortRangeLabel } from '../attendance/status.js';
import { categoryLabel } from '../attendance/categories.js';
import { avatarHtml } from '../avatar.js';
import { renderSubNav } from './attendance-nav.js';
import { codexSeal, codexPage } from '../attendance/codex.js';
import { toastSuccess, toastError } from '../toast.js';

const WEEKDAY_LABELS = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const SCHEDULE_LABELS = { weekly: 'Toda semana', biweekly: 'Quinzenal', monthly: 'Mensal', manual: 'Sob demanda' };

export async function renderAttendanceGroupDetail(ctx, groupId) {
  const { root, state } = ctx;
  const isAdmin = state.role === 'admin';

  root.innerHTML = `
    <div class="view">
      <div class="att-loading-wrap">
        <span class="att-bloom"><span class="att-codex-seal">${codexSeal({ size: 24 })}</span></span>
        <p>Abrindo o livro…</p>
      </div>
    </div>
  `;

  const { data: currentSem } = await data.getCurrentSemester();
  const monthRange = currentMonthRange();
  const range = currentSem
    ? { from: currentSem.start_date, to: currentSem.end_date, semester: currentSem }
    : { from: monthRange.from, to: monthRange.to, year: monthRange.year, month: monthRange.month };

  const { year, month, from, to } = { ...monthRange, ...range };

  const [{ data: group, error: gErr }] = await Promise.all([data.getGroup(groupId)]);
  if (gErr || !group) {
    root.innerHTML = `
      <div class="view">
        <p class="view__crumbs"><a href="#/presenca/grupos">${icon('arrow-left', { size: 14 })}<span style="margin-left:6px;">Grupos</span></a></p>
        <div class="att-empty-v2">
          <div class="att-empty-v2__art">${codexSeal({ size: 52 })}</div>
          <h3>Grupo não encontrado</h3>
          <p>Talvez ele tenha sido removido ou o endereço esteja errado.</p>
          <a class="btn btn--ghost" href="#/presenca/grupos">${icon('arrow-left', { size: 14 })}<span style="margin-left:6px;">Voltar à lista</span></a>
        </div>
      </div>
    `;
    return;
  }

  // pré-carrega membros/encontros pra preencher stats no hero
  const [memRes, meetRes] = await Promise.all([
    data.listMembershipsOfGroup(groupId),
    data.listAttendanceByGroupInRange(groupId, from, to),
  ]);
  const allMembers = memRes.data || [];
  const allMeetings = meetRes.data || [];
  const happenedCount = allMeetings.filter((m) => m.status === 'happened').length;
  let totalSlots = 0, totalPresent = 0;
  let alertsCount = 0;
  for (const m of allMeetings) {
    if (m.status === 'happened') {
      totalSlots += allMembers.length;
      totalPresent += (m.attendance || []).filter((a) => a.is_present).length;
    }
  }
  for (const mem of allMembers) {
    const st = calcMonthlyStatus(allMeetings, mem.person_id, { isWeekly: group.schedule_kind === 'weekly' });
    if (st.color === 'orange' || st.color === 'red') alertsCount++;
  }
  const pct = totalSlots > 0 ? Math.round(totalPresent / totalSlots * 100) : null;

  const scheduleLabel = SCHEDULE_LABELS[group.schedule_kind] || group.schedule_kind;
  const weekdayLabel = group.weekday !== null && group.weekday !== undefined ? WEEKDAY_LABELS[group.weekday] : null;
  const timeLabel = group.start_time ? group.start_time.slice(0, 5) : null;
  const eyebrow = [scheduleLabel, weekdayLabel, timeLabel].filter(Boolean).join(' · ');

  const periodLabel = range.semester
    ? `${range.semester.name} · ${shortRangeLabel(range.semester.start_date, range.semester.end_date)}`
    : monthLabel(year, month);

  const monogram = monogramOf(group.name);
  const pctTone = pct === null ? 'muted'
    : pct >= 70 ? 'success'
    : pct >= 50 ? 'gold'
    : 'warning';

  root.innerHTML = `
    <div class="view">
      ${renderSubNav('grupos', { isAdmin })}
      <p class="view__crumbs"><a href="#/presenca/grupos">${icon('arrow-left', { size: 14 })}<span style="margin-left:6px;">Grupos</span></a></p>

      <header class="att-group-hero">
        <span class="att-group-hero__mono" aria-hidden="true">${escapeHtml(monogram)}</span>
        <div class="att-group-hero__inner">
          <p class="att-group-hero__eyebrow">${escapeHtml(eyebrow || '—')}</p>
          <h1>${escapeHtml(group.name)}</h1>
          ${group.description ? `<p class="att-group-hero__lede">${escapeHtml(group.description)}</p>` : `<p class="att-group-hero__lede">livro de presenças — ${escapeHtml(periodLabel)}</p>`}
        </div>
        ${isAdmin ? `
          <div class="att-group-hero__actions">
            <button id="editGroupBtn" class="btn btn--ghost btn--small">${icon('edit', { size: 14 })}<span style="margin-left:6px;">Editar grupo</span></button>
            <button id="deleteGroupBtn" class="btn btn--danger btn--small">${icon('trash', { size: 14 })}<span style="margin-left:6px;">Excluir</span></button>
          </div>
        ` : ''}
        <div class="att-group-hero__page">${codexPage({ size: 200 })}</div>
      </header>

      <div class="att-group-stats">
        <div class="att-group-stats__cell att-group-stats__cell--rose">
          <strong>${allMembers.length}</strong>
          <span>${allMembers.length === 1 ? 'membro' : 'membros'}</span>
        </div>
        <div class="att-group-stats__cell att-group-stats__cell--gold">
          <strong>${happenedCount}</strong>
          <span>${range.semester ? 'no semestre' : 'no mês'}</span>
        </div>
        <div class="att-group-stats__cell att-group-stats__cell--${pctTone === 'muted' ? '' : pctTone}">
          <strong>${pct === null ? '—' : pct + '%'}</strong>
          <span>presença média</span>
        </div>
        <div class="att-group-stats__cell att-group-stats__cell--${alertsCount > 0 ? 'warning' : ''}">
          <strong>${alertsCount}</strong>
          <span>${alertsCount === 1 ? 'pessoa em alerta' : 'pessoas em alerta'}</span>
        </div>
      </div>

      <section class="att-section-v2">
        <header class="att-section-v2__head">
          <h2>Encontros <span class="att-section-v2__count">${happenedCount} / ${allMeetings.length}</span></h2>
          <div class="att-section-v2__head-right">
            ${(group.schedule_kind === 'weekly' || group.schedule_kind === 'biweekly') ? `
              ${range.semester ? `<button id="generateSemesterBtn" class="btn btn--ghost btn--small">${icon('calendar', { size: 14 })}<span style="margin-left:6px;">Gerar todo o semestre</span></button>` : ''}
              <button id="generateMeetingsBtn" class="btn btn--ghost btn--small">${icon('calendar', { size: 14 })}<span style="margin-left:6px;">Gerar mês corrente</span></button>
            ` : `
              <button id="newMeetingBtn" class="btn btn--ghost btn--small">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Novo encontro</span></button>
            `}
          </div>
        </header>
        <p class="muted" style="margin: -8px 0 12px; font-size: 12.5px;">${escapeHtml(periodLabel)}</p>
        <div id="meetingsList" class="att-meetings"></div>
      </section>

      <section class="att-section-v2">
        <header class="att-section-v2__head">
          <h2>Membros <span class="att-section-v2__count">${allMembers.length}</span></h2>
          <div class="att-section-v2__head-right">
            <button id="addMemberBtn" class="btn btn--ghost btn--small">${icon('user-plus', { size: 14 })}<span style="margin-left:6px;">Vincular pessoa</span></button>
          </div>
        </header>
        <div id="membersList" class="empty-state"></div>
      </section>

      <section class="att-section-v2">
        <header class="att-section-v2__head">
          <h2>Faltas justificadas <span class="att-section-v2__count" id="justCount">…</span></h2>
        </header>
        <div id="justificationsList" class="empty-state"></div>
      </section>
    </div>
  `;

  document.getElementById('editGroupBtn')?.addEventListener('click', () => {
    location.hash = '#/presenca/grupos';
  });

  document.getElementById('deleteGroupBtn')?.addEventListener('click', async () => {
    if (!confirm(`Excluir o grupo "${group.name}"? Isso apaga todos os encontros, presenças e justificativas associadas. Não desfaz.`)) return;
    const { error } = await data.deleteGroup(groupId);
    if (error) { toastError(error.message); return; }
    toastSuccess('Grupo excluído.');
    setTimeout(() => { location.hash = '#/presenca/grupos'; }, 350);
  });

  document.getElementById('generateMeetingsBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('generateMeetingsBtn');
    btn.disabled = true;
    const original = btn.innerHTML;
    btn.textContent = 'gerando…';
    const { data: count, error } = await data.generateMonthlyMeetings(groupId, year, month);
    if (error) toastError(error.message);
    else { toastSuccess(`${count} encontro(s) gerado(s).`); await loadMeetings(groupId, group, from, to, isAdmin); }
    btn.disabled = false;
    btn.innerHTML = original;
  });

  document.getElementById('generateSemesterBtn')?.addEventListener('click', async () => {
    if (!range.semester) return;
    const btn = document.getElementById('generateSemesterBtn');
    btn.disabled = true;
    const original = btn.innerHTML;
    btn.textContent = 'gerando…';
    const { data: count, error } = await data.generateMeetingsInRange(
      groupId,
      range.semester.start_date,
      range.semester.end_date
    );
    if (error) toastError(error.message);
    else { toastSuccess(`${count} encontro(s) gerado(s) no semestre.`); await loadMeetings(groupId, group, from, to, isAdmin); }
    btn.disabled = false;
    btn.innerHTML = original;
  });

  document.getElementById('newMeetingBtn')?.addEventListener('click', () => openMeetingForm(groupId, group, null, () => loadMeetings(groupId, group, from, to, isAdmin)));

  document.getElementById('addMemberBtn').addEventListener('click', () => openAddMemberForm(groupId, () => loadMembers(groupId, group, from, to)));

  await Promise.all([
    loadMeetings(groupId, group, from, to, isAdmin),
    loadMembers(groupId, group, from, to),
    loadJustifications(groupId, from, to),
  ]);
}

async function loadJustifications(groupId, from, to) {
  const box = document.getElementById('justificationsList');
  const countEl = document.getElementById('justCount');
  if (!box) return;
  const { data: rows, error } = await data.listJustifications(groupId, from, to);
  if (error) {
    if (countEl) countEl.textContent = '—';
    box.innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`;
    return;
  }
  if (!rows?.length) {
    if (countEl) countEl.textContent = '0';
    box.innerHTML = `<p class="muted" style="padding: 8px 0;">Nenhuma falta justificada no período.</p>`;
    return;
  }
  if (countEl) countEl.textContent = String(rows.length);
  box.className = '';
  box.innerHTML = `
    <table class="table att-just-table">
      <thead><tr><th>Data</th><th>Pessoa</th><th>Categoria</th><th>Motivo</th></tr></thead>
      <tbody>
        ${rows.map((r) => {
          const d = r.meeting?.date ? new Date(r.meeting.date + 'T00:00:00') : null;
          const dStr = d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—';
          return `
            <tr>
              <td>${escapeHtml(dStr)}</td>
              <td><strong>${escapeHtml(r.person?.full_name || '—')}</strong></td>
              <td><span class="att-pill-v2 att-pill-v2--gold-soft">${escapeHtml(categoryLabel(r.justification_category))}</span></td>
              <td class="muted">${escapeHtml(r.notes || '—')}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

async function loadMeetings(groupId, group, from, to, isAdmin) {
  const box = document.getElementById('meetingsList');
  const { data: rows, error } = await data.listMeetings(groupId, { from, to });
  if (error) { box.innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`; return; }
  if (!rows?.length) {
    box.innerHTML = `<p class="muted" style="padding: 8px 0;">Nenhum encontro neste período. ${(group.schedule_kind === 'weekly' || group.schedule_kind === 'biweekly') ? 'Use "Gerar mês corrente" pra criar de uma vez.' : 'Use "Novo encontro" pra criar.'}</p>`;
    return;
  }
  box.innerHTML = rows.map((m) => meetingChipV2(m, { isAdmin })).join('');
  if (isAdmin) wireMeetingChips(box, groupId, group, from, to, isAdmin);
}

function wireMeetingChips(box, groupId, group, from, to, isAdmin) {
  box.querySelectorAll('.att-meeting-chip-v2').forEach((chip) => {
    const meetingId = chip.dataset.meetingId;
    const meetingDate = chip.dataset.meetingDate;

    chip.querySelector('[data-action="edit-date"]')?.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      openEditDateDrawer({ id: meetingId, date: meetingDate }, () => loadMeetings(groupId, group, from, to, isAdmin));
    });

    chip.querySelector('[data-action="delete-meeting"]')?.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const ptDate = new Date(meetingDate + 'T00:00:00').toLocaleDateString('pt-BR');
      if (!confirm(`Excluir o encontro de ${ptDate}? Isso apaga as marcações deste dia.`)) return;
      const { error } = await data.deleteMeeting(meetingId);
      if (error) { toastError(error.message); return; }
      toastSuccess('Encontro excluído.');
      await loadMeetings(groupId, group, from, to, isAdmin);
    });
  });
}

function meetingChipV2(m, opts = {}) {
  const { isAdmin = false } = opts;
  const date = new Date(m.date + 'T00:00:00');
  const day = String(date.getDate()).padStart(2, '0');
  const monthShort = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][date.getMonth()];
  const weekday = WEEKDAY_LABELS[date.getDay()].slice(0, 3).toLowerCase();
  const statusLabel = { scheduled: 'agendado', happened: 'aconteceu', cancelled: 'cancelado' }[m.status] || m.status;
  return `
    <div class="att-meeting-chip-v2 att-meeting-chip-v2--${m.status}" data-meeting-id="${escapeAttr(m.id)}" data-meeting-date="${escapeAttr(m.date)}">
      <a class="att-meeting-chip-v2__link" href="#/presenca/encontros/${escapeAttr(m.id)}">
        <span class="att-meeting-chip-v2__date">${day}</span>
        <span class="att-meeting-chip-v2__weekday">${escapeHtml(monthShort)} · ${escapeHtml(weekday)}</span>
        <span class="att-meeting-chip-v2__status">${escapeHtml(statusLabel)}</span>
      </a>
      ${isAdmin ? `
        <div class="att-meeting-chip-v2__menu">
          <button class="icon-btn icon-btn--xs" data-action="edit-date" title="Editar data" aria-label="Editar data">${icon('edit', { size: 12 })}</button>
          <button class="icon-btn icon-btn--xs" data-action="delete-meeting" title="Excluir" aria-label="Excluir">${icon('trash', { size: 12 })}</button>
        </div>
      ` : ''}
    </div>
  `;
}

function openEditDateDrawer(meeting, onDone) {
  document.querySelectorAll('.block-drawer-overlay').forEach((el) => el.remove());

  const overlay = document.createElement('div');
  overlay.className = 'block-drawer-overlay';
  overlay.innerHTML = `
    <div class="block-drawer block-drawer--small">
      <header class="block-drawer__head">
        <div>
          <p class="block-drawer__crumb">Encontro</p>
          <h2><span class="block-drawer__icon">${icon('calendar', { size: 24 })}</span> Mudar a data</h2>
          <p class="block-drawer__desc">Atalho rápido pra corrigir a data sem perder os registros associados.</p>
        </div>
        <button class="icon-btn" data-action="close" aria-label="Fechar">${icon('x', { size: 16 })}</button>
      </header>
      <form class="block-drawer__body" id="editDateForm">
        <label class="drawer-field">
          <span class="drawer-field__label">Nova data</span>
          <input type="date" name="date" class="drawer-field__input" value="${escapeAttr(meeting.date)}" required />
        </label>
        <p class="muted" style="font-size: 12px; margin: 0;">Se já houver outro encontro deste grupo na nova data, o salvamento será bloqueado.</p>
      </form>
      <footer class="block-drawer__foot">
        <span class="spacer"></span>
        <button class="btn btn--ghost" data-action="close">Cancelar</button>
        <button class="btn btn--primary" data-action="save">Salvar</button>
      </footer>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('is-open'));

  overlay.querySelector('#editDateForm').addEventListener('submit', (e) => e.preventDefault());

  function close() {
    overlay.classList.remove('is-open');
    setTimeout(() => overlay.remove(), 220);
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);

  async function doSave() {
    const form = overlay.querySelector('#editDateForm');
    const newDate = String(new FormData(form).get('date') || '');
    if (!newDate) { toastError('Escolha uma data.'); return; }
    if (newDate === meeting.date) { close(); return; }
    const saveBtn = overlay.querySelector('[data-action="save"]');
    saveBtn.disabled = true;
    saveBtn.textContent = 'salvando…';
    const { error } = await data.updateMeeting(meeting.id, { date: newDate });
    if (error) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Salvar';
      if (/duplicate|unique/i.test(error.message)) {
        toastError('Já existe um encontro deste grupo nessa data.');
      } else {
        toastError(error.message);
      }
      return;
    }
    toastSuccess('Data atualizada.');
    close();
    onDone?.();
  }

  overlay.addEventListener('click', async (ev) => {
    if (ev.target === overlay) return close();
    const action = ev.target.closest('[data-action]')?.dataset?.action;
    if (action === 'close') return close();
    if (action === 'save') await doSave();
  });
}

async function loadMembers(groupId, group, from, to) {
  const box = document.getElementById('membersList');
  const [{ data: members, error: mErr }, { data: meetings }] = await Promise.all([
    data.listMembershipsOfGroup(groupId),
    data.listAttendanceByGroupInRange(groupId, from, to),
  ]);

  if (mErr) { box.innerHTML = `<p class="muted">${escapeHtml(mErr.message)}</p>`; return; }
  if (!members?.length) {
    box.innerHTML = `<p class="muted" style="padding: 8px 0;">Nenhuma pessoa vinculada. Use "Vincular pessoa" pra adicionar.</p>`;
    return;
  }

  box.className = '';
  box.innerHTML = `
    <table class="table att-members-table">
      <thead>
        <tr><th>Pessoa</th><th>Vínculo</th><th>Faltas no período</th><th>Status</th><th></th></tr>
      </thead>
      <tbody>
        ${members.map((m) => {
          const status = calcMonthlyStatus(meetings || [], m.person_id, {
            isWeekly: group.schedule_kind === 'weekly',
          });
          return memberRow(groupId, m, status);
        }).join('')}
      </tbody>
    </table>
  `;

  box.querySelectorAll('tr[data-person-id]').forEach((tr) => {
    const personId = tr.dataset.personId;
    tr.querySelector('[data-action="toggle-primary"]')?.addEventListener('click', async () => {
      const isPrimary = tr.classList.contains('is-primary');
      const { error } = isPrimary
        ? await data.setMembership({ group_id: groupId, person_id: personId, is_primary: false })
        : await data.setPrimaryGroup(personId, groupId);
      if (error) toastError(error.message);
      else toastSuccess(isPrimary ? 'Vínculo agora secundário.' : 'Vínculo agora primário.');
      await loadMembers(groupId, group, from, to);
    });
    tr.querySelector('[data-action="remove"]')?.addEventListener('click', async () => {
      if (!confirm('Remover esta pessoa do grupo? Histórico de presença é mantido.')) return;
      const { error } = await data.removeMembership(groupId, personId);
      if (error) toastError(error.message);
      else toastSuccess('Pessoa removida do grupo.');
      await loadMembers(groupId, group, from, to);
    });
  });
}

function memberRow(groupId, m, status) {
  const sc = STATUS_COLORS[status.color];
  const detail = `${status.absences} falta${status.absences === 1 ? '' : 's'}` +
    (status.maxConsecutive > 1 ? ` · ${status.maxConsecutive} seguidas` : '') +
    (status.justifiedAbsences ? ` · ${status.justifiedAbsences} justificada${status.justifiedAbsences === 1 ? '' : 's'}` : '');
  return `
    <tr data-person-id="${escapeAttr(m.person_id)}" class="${m.is_primary ? 'is-primary' : ''}">
      <td>
        <div style="display:flex; align-items:center; gap:12px;">
          ${avatarHtml(m.person?.full_name, { size: 'sm' })}
          <div>
            <strong>${escapeHtml(m.person?.full_name || '—')}</strong>
            ${m.person?.email ? `<span class="muted" style="display:block;font-size:12px;">${escapeHtml(m.person.email)}</span>` : ''}
          </div>
        </div>
      </td>
      <td>
        ${m.is_primary
          ? `<span class="att-pill-v2 att-pill-v2--gold" title="Vínculo primário">${icon('star', { size: 11 })}<span style="margin-left:4px;">primário</span></span>`
          : '<span class="muted">secundário</span>'
        }
      </td>
      <td class="muted">${escapeHtml(detail)}</td>
      <td><span class="att-dot att-dot--${status.color}" title="${escapeHtml(sc.label)}" aria-label="${escapeHtml(sc.label)}"></span><span style="margin-left:8px;">${escapeHtml(sc.label)}</span></td>
      <td>
        <button class="icon-btn" data-action="toggle-primary" title="${m.is_primary ? 'Tornar secundário' : 'Marcar como primário'}" aria-label="${m.is_primary ? 'Tornar secundário' : 'Marcar como primário'}">${icon('star', { size: 14 })}</button>
        <button class="icon-btn" data-action="remove" title="Remover do grupo" aria-label="Remover do grupo">${icon('trash', { size: 14 })}</button>
      </td>
    </tr>
  `;
}

// ---------- form: vincular pessoa ao grupo ----------
async function openAddMemberForm(groupId, onDone) {
  document.querySelectorAll('.block-drawer-overlay').forEach((el) => el.remove());

  const { data: people } = await data.listPeople({ includeInactive: false });

  const overlay = document.createElement('div');
  overlay.className = 'block-drawer-overlay';
  overlay.innerHTML = `
    <div class="block-drawer">
      <header class="block-drawer__head">
        <div>
          <p class="block-drawer__crumb">Vincular pessoa ao grupo</p>
          <h2><span class="block-drawer__icon">${icon('user-plus', { size: 26 })}</span> Adicionar membro</h2>
        </div>
        <button class="icon-btn" data-action="close">${icon('x', { size: 16 })}</button>
      </header>
      <form class="block-drawer__body" id="addMemberForm">
        <label class="drawer-field">
          <span class="drawer-field__label">Pessoa</span>
          <select name="person_id" class="drawer-field__input" required>
            <option value="">— escolha —</option>
            ${(people || []).map((p) => `<option value="${escapeAttr(p.id)}">${escapeHtml(p.full_name)}</option>`).join('')}
          </select>
        </label>
        <label class="drawer-field">
          <span class="drawer-field__label">Vínculo</span>
          <select name="is_primary" class="drawer-field__input">
            <option value="false">Secundário (esta pessoa também participa)</option>
            <option value="true">Primário (este é o grupo principal dela)</option>
          </select>
        </label>
        <p id="addMemberErr" class="muted" style="color:var(--danger); display:none;"></p>
      </form>
      <footer class="block-drawer__foot">
        <span class="spacer"></span>
        <button class="btn btn--ghost" data-action="close">Cancelar</button>
        <button class="btn btn--primary" data-action="save">Vincular</button>
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
    if (action === 'save') {
      const form = overlay.querySelector('#addMemberForm');
      const fd = new FormData(form);
      const person_id = String(fd.get('person_id') || '');
      const is_primary = fd.get('is_primary') === 'true';
      if (!person_id) {
        showErr('Escolha uma pessoa.'); return;
      }
      const promise = is_primary
        ? data.setPrimaryGroup(person_id, groupId)
        : data.setMembership({ group_id: groupId, person_id, is_primary: false });
      const { error } = await promise;
      if (error) { showErr(error.message); return; }
      close();
      onDone?.();
    }
  });

  function showErr(msg) {
    const el = overlay.querySelector('#addMemberErr');
    el.textContent = msg;
    el.style.display = '';
  }
}

// ---------- form: novo encontro manual ----------
function openMeetingForm(groupId, group, existing, onDone) {
  document.querySelectorAll('.block-drawer-overlay').forEach((el) => el.remove());

  const overlay = document.createElement('div');
  overlay.className = 'block-drawer-overlay';
  overlay.innerHTML = `
    <div class="block-drawer">
      <header class="block-drawer__head">
        <div>
          <p class="block-drawer__crumb">Novo encontro</p>
          <h2><span class="block-drawer__icon">${icon('calendar', { size: 26 })}</span> ${escapeHtml(group.name)}</h2>
        </div>
        <button class="icon-btn" data-action="close">${icon('x', { size: 16 })}</button>
      </header>
      <form class="block-drawer__body" id="meetingForm">
        <label class="drawer-field">
          <span class="drawer-field__label">Data</span>
          <input type="date" name="date" class="drawer-field__input" required />
        </label>
        <label class="drawer-field">
          <span class="drawer-field__label">Notas (opcional)</span>
          <textarea name="notes" class="drawer-field__input" rows="2"></textarea>
        </label>
        <p id="meetingErr" class="muted" style="color:var(--danger); display:none;"></p>
      </form>
      <footer class="block-drawer__foot">
        <span class="spacer"></span>
        <button class="btn btn--ghost" data-action="close">Cancelar</button>
        <button class="btn btn--primary" data-action="save">Criar</button>
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
    if (action === 'save') {
      const form = overlay.querySelector('#meetingForm');
      const fd = new FormData(form);
      const date = String(fd.get('date') || '');
      const notes = String(fd.get('notes') || '').trim() || null;
      if (!date) { showErr('Escolha uma data.'); return; }
      const { error } = await data.createMeeting({ group_id: groupId, date, notes });
      if (error) { showErr(error.message); return; }
      close();
      onDone?.();
    }
  });

  function showErr(msg) {
    const el = overlay.querySelector('#meetingErr');
    el.textContent = msg;
    el.style.display = '';
  }
}

function monogramOf(name) {
  if (!name) return '·';
  const cleaned = String(name).trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    return ((parts[0][0] || '') + (parts[parts.length - 1][0] || '')).toUpperCase();
  }
  return (cleaned[0] || '·').toUpperCase();
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
