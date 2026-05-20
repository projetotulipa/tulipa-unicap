// Detalhe de um grupo — membros + encontros + status mensal.

import { icon } from '../icons.js';
import * as data from '../attendance/data.js';
import { calcMonthlyStatus, STATUS_COLORS, currentMonthRange, monthLabel, shortRangeLabel } from '../attendance/status.js';
import { categoryLabel } from '../attendance/categories.js';
import { avatarHtml } from '../avatar.js';
import { renderSubNav } from './attendance-nav.js';
import { toastSuccess, toastError } from '../toast.js';

const WEEKDAY_LABELS = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const SCHEDULE_LABELS = { weekly: 'Toda semana', biweekly: 'Quinzenal', monthly: 'Mensal', manual: 'Sob demanda' };

export async function renderAttendanceGroupDetail(ctx, groupId) {
  const { root, state } = ctx;
  const isAdmin = state.role === 'admin';

  root.innerHTML = `<div class="view"><div class="skel skel--title"></div><div class="skel skel--block"></div></div>`;

  // determina range: semestre atual OU mês corrente como fallback
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
        <div class="empty-state">Grupo não encontrado.</div>
      </div>
    `;
    return;
  }

  const scheduleLabel = SCHEDULE_LABELS[group.schedule_kind] || group.schedule_kind;
  const weekdayLabel = group.weekday !== null && group.weekday !== undefined ? WEEKDAY_LABELS[group.weekday] : null;
  const timeLabel = group.start_time ? group.start_time.slice(0, 5) : null;
  const subtitle = [scheduleLabel, weekdayLabel, timeLabel].filter(Boolean).join(' · ');

  root.innerHTML = `
    <div class="view">
      ${renderSubNav('grupos', { isAdmin })}
      <p class="view__crumbs"><a href="#/presenca/grupos">${icon('arrow-left', { size: 14 })}<span style="margin-left:6px;">Grupos</span></a></p>
      <header class="view__header" style="display:flex; align-items:flex-end; justify-content:space-between; gap:14px;">
        <div>
          <h1>${escapeHtml(group.name)}</h1>
          <p class="view__lede">${escapeHtml(subtitle)}${group.description ? ' · ' + escapeHtml(group.description) : ''}</p>
        </div>
        ${isAdmin ? `<div style="display:flex; gap:8px;">
          <button id="editGroupBtn" class="btn btn--ghost btn--small">${icon('edit', { size: 14 })}<span style="margin-left:6px;">Editar grupo</span></button>
        </div>` : ''}
      </header>

      <section class="att-section">
        <header class="att-section__head">
          <h2>Encontros · ${escapeHtml(range.semester ? `${range.semester.name} (${shortRangeLabel(range.semester.start_date, range.semester.end_date)})` : monthLabel(year, month))}</h2>
          ${(group.schedule_kind === 'weekly' || group.schedule_kind === 'biweekly') ? `
            <div style="display:flex; gap:6px;">
              ${range.semester ? `<button id="generateSemesterBtn" class="btn btn--ghost btn--small">${icon('calendar', { size: 14 })}<span style="margin-left:6px;">Gerar todo o semestre</span></button>` : ''}
              <button id="generateMeetingsBtn" class="btn btn--ghost btn--small">${icon('calendar', { size: 14 })}<span style="margin-left:6px;">Gerar mês corrente</span></button>
            </div>
          ` : `
            <button id="newMeetingBtn" class="btn btn--ghost btn--small">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Novo encontro</span></button>
          `}
        </header>
        <div id="meetingsList" class="att-meetings">carregando…</div>
      </section>

      <section class="att-section">
        <header class="att-section__head">
          <h2>Membros</h2>
          <button id="addMemberBtn" class="btn btn--ghost btn--small">${icon('user-plus', { size: 14 })}<span style="margin-left:6px;">Vincular pessoa</span></button>
        </header>
        <div id="membersList" class="empty-state">carregando…</div>
      </section>

      <section class="att-section">
        <header class="att-section__head">
          <h2>Faltas justificadas · ${escapeHtml(range.semester ? range.semester.name : monthLabel(year, month))}</h2>
        </header>
        <div id="justificationsList" class="empty-state">carregando…</div>
      </section>
    </div>
  `;

  document.getElementById('editGroupBtn')?.addEventListener('click', () => {
    // navega pra lista de grupos onde o admin pode editar
    location.hash = '#/presenca/grupos';
  });

  document.getElementById('generateMeetingsBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('generateMeetingsBtn');
    btn.disabled = true;
    const original = btn.innerHTML;
    btn.textContent = 'gerando…';
    const { data: count, error } = await data.generateMonthlyMeetings(groupId, year, month);
    if (error) toastError(error.message);
    else { toastSuccess(`${count} encontro(s) gerado(s).`); await loadMeetings(groupId, group, from, to); }
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
    else { toastSuccess(`${count} encontro(s) gerado(s) no semestre.`); await loadMeetings(groupId, group, from, to); }
    btn.disabled = false;
    btn.innerHTML = original;
  });

  document.getElementById('newMeetingBtn')?.addEventListener('click', () => openMeetingForm(groupId, group, null, () => loadMeetings(groupId, group, from, to)));

  document.getElementById('addMemberBtn').addEventListener('click', () => openAddMemberForm(groupId, () => loadMembers(groupId, group, from, to)));

  await Promise.all([
    loadMeetings(groupId, group, from, to),
    loadMembers(groupId, group, from, to),
    loadJustifications(groupId, from, to),
  ]);
}

async function loadJustifications(groupId, from, to) {
  const box = document.getElementById('justificationsList');
  if (!box) return;
  const { data: rows, error } = await data.listJustifications(groupId, from, to);
  if (error) { box.innerHTML = `<p class="muted">${error.message}</p>`; return; }
  if (!rows?.length) {
    box.innerHTML = `<p class="muted">Nenhuma falta justificada este mês.</p>`;
    return;
  }
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
              <td><span class="att-pill">${escapeHtml(categoryLabel(r.justification_category))}</span></td>
              <td class="muted">${escapeHtml(r.notes || '—')}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

async function loadMeetings(groupId, group, from, to) {
  const box = document.getElementById('meetingsList');
  const { data: rows, error } = await data.listMeetings(groupId, { from, to });
  if (error) { box.innerHTML = `<p class="muted">${error.message}</p>`; return; }
  if (!rows?.length) {
    box.innerHTML = `<p class="muted">Nenhum encontro neste mês. ${(group.schedule_kind === 'weekly' || group.schedule_kind === 'biweekly') ? 'Use "Gerar encontros do mês" pra criar de uma vez.' : 'Use "Novo encontro" pra criar.'}</p>`;
    return;
  }
  box.innerHTML = rows.map(meetingChip).join('');
  wireMeetingChips(box, groupId, group, from, to);
}

function wireMeetingChips(box, groupId, group, from, to) {
  box.querySelectorAll('.att-meeting-chip').forEach((chip) => {
    const meetingId = chip.dataset.meetingId;
    const meetingDate = chip.dataset.meetingDate;

    chip.querySelector('[data-action="edit-date"]')?.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      openEditDateDrawer({ id: meetingId, date: meetingDate }, () => loadMeetings(groupId, group, from, to));
    });

    chip.querySelector('[data-action="delete-meeting"]')?.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const ptDate = new Date(meetingDate + 'T00:00:00').toLocaleDateString('pt-BR');
      if (!confirm(`Excluir o encontro de ${ptDate}? Isso apaga as marcações deste dia.`)) return;
      const { error } = await data.deleteMeeting(meetingId);
      if (error) { toastError(error.message); return; }
      toastSuccess('Encontro excluído.');
      await loadMeetings(groupId, group, from, to);
    });
  });
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
      const form = overlay.querySelector('#editDateForm');
      const newDate = String(new FormData(form).get('date') || '');
      if (!newDate || newDate === meeting.date) { close(); return; }
      const { error } = await data.updateMeeting(meeting.id, { date: newDate });
      if (error) {
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
  });
}

function meetingChip(m) {
  const date = new Date(m.date + 'T00:00:00');
  const formatted = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', weekday: 'short' });
  const statusLabel = { scheduled: 'agendado', happened: 'aconteceu', cancelled: 'cancelado' }[m.status];
  return `
    <div class="att-meeting-chip att-meeting-chip--${m.status}" data-meeting-id="${escapeAttr(m.id)}" data-meeting-date="${escapeAttr(m.date)}">
      <a class="att-meeting-chip__link" href="#/presenca/encontros/${escapeAttr(m.id)}">
        <strong>${escapeHtml(formatted)}</strong>
        <span class="muted">${escapeHtml(statusLabel)}</span>
      </a>
      <div class="att-meeting-chip__menu">
        <button class="icon-btn icon-btn--xs" data-action="edit-date" title="Editar data">${icon('edit', { size: 12 })}</button>
        <button class="icon-btn icon-btn--xs" data-action="delete-meeting" title="Excluir">${icon('trash', { size: 12 })}</button>
      </div>
    </div>
  `;
}

async function loadMembers(groupId, group, from, to) {
  const box = document.getElementById('membersList');
  const [{ data: members, error: mErr }, { data: meetings }] = await Promise.all([
    data.listMembershipsOfGroup(groupId),
    data.listAttendanceByGroupInRange(groupId, from, to),
  ]);

  if (mErr) { box.innerHTML = `<p class="muted">${mErr.message}</p>`; return; }
  if (!members?.length) {
    box.innerHTML = `<p class="muted">Nenhuma pessoa vinculada. Use "Vincular pessoa" pra adicionar.</p>`;
    return;
  }

  box.className = '';
  box.innerHTML = `
    <table class="table att-members-table">
      <thead>
        <tr><th>Pessoa</th><th>Vínculo</th><th>Faltas no mês</th><th>Status</th><th></th></tr>
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

  // wire actions
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
          ? `<span class="pill pill--gold" title="Vínculo primário">${icon('star', { size: 11 })}<span style="margin-left:4px;">primário</span></span>`
          : '<span class="muted">secundário</span>'
        }
      </td>
      <td class="muted">${escapeHtml(detail)}</td>
      <td><span class="att-dot att-dot--${status.color}" title="${escapeHtml(sc.label)}"></span><span style="margin-left:8px;">${escapeHtml(sc.label)}</span></td>
      <td>
        <button class="icon-btn" data-action="toggle-primary" title="${m.is_primary ? 'Tornar secundário' : 'Marcar como primário'}">${icon('star', { size: 14 })}</button>
        <button class="icon-btn" data-action="remove" title="Remover do grupo">${icon('trash', { size: 14 })}</button>
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

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
