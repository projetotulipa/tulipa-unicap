// Marcar presença de um encontro — switches por pessoa.

import { icon } from '../icons.js';
import * as data from '../attendance/data.js';

export async function renderAttendanceMeeting(ctx, meetingId) {
  const { root } = ctx;

  root.innerHTML = `<div class="view"><p class="empty-state">carregando encontro…</p></div>`;

  const { data: meeting, error: mErr } = await data.getMeeting(meetingId);
  if (mErr || !meeting) {
    root.innerHTML = `
      <div class="view">
        <p class="view__crumbs"><a href="#/presenca">${icon('arrow-left', { size: 14 })}<span style="margin-left:6px;">Presença</span></a></p>
        <div class="empty-state">Encontro não encontrado.</div>
      </div>
    `;
    return;
  }

  // garante que cada membro tenha registro de attendance (default ausente)
  await data.initMeetingAttendance(meetingId);

  const [{ data: members }, { data: attendance }] = await Promise.all([
    data.listMembershipsOfGroup(meeting.group_id),
    data.listAttendance(meetingId),
  ]);

  const attByPerson = new Map((attendance || []).map((a) => [a.person_id, a]));
  // membros do grupo + qualquer attendance que existe (caso pessoa tenha sido removida)
  const peopleMap = new Map((members || []).map((m) => [m.person_id, { ...m.person, is_primary: m.is_primary }]));
  for (const a of (attendance || [])) {
    if (!peopleMap.has(a.person_id) && a.person) {
      peopleMap.set(a.person_id, { ...a.person, is_primary: false });
    }
  }
  const people = Array.from(peopleMap.values()).sort((a, b) =>
    (a.full_name || '').localeCompare(b.full_name || '', 'pt-BR')
  );

  const dateObj = new Date(meeting.date + 'T00:00:00');
  const dateLabel = dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  root.innerHTML = `
    <div class="view">
      <p class="view__crumbs"><a href="#/presenca/grupos/${escapeAttr(meeting.group_id)}">${icon('arrow-left', { size: 14 })}<span style="margin-left:6px;">${escapeHtml(meeting.group?.name || 'Grupo')}</span></a></p>
      <header class="view__header" style="display:flex; align-items:flex-end; justify-content:space-between; gap:14px;">
        <div>
          <h1>${escapeHtml(meeting.group?.name || 'Encontro')}</h1>
          <p class="view__lede">${escapeHtml(dateLabel)}</p>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <label class="drawer-field" style="margin:0;">
            <span class="drawer-field__label" style="margin:0;">Status do encontro</span>
            <select id="meetingStatus" class="drawer-field__input" style="min-width:160px;">
              <option value="scheduled" ${meeting.status === 'scheduled' ? 'selected' : ''}>Agendado</option>
              <option value="happened"  ${meeting.status === 'happened'  ? 'selected' : ''}>Aconteceu</option>
              <option value="cancelled" ${meeting.status === 'cancelled' ? 'selected' : ''}>Cancelado</option>
            </select>
          </label>
        </div>
      </header>

      <p class="att-hint">
        ${meeting.status === 'happened'
          ? 'Marque quem veio. Por padrão, todo mundo começa como ausente.'
          : meeting.status === 'cancelled'
            ? 'Este encontro foi cancelado — ausências não contam.'
            : 'Quando o encontro acontecer, mude o status para "Aconteceu" e marque as presenças.'
        }
      </p>

      <div class="att-roster">
        ${people.length === 0
          ? '<p class="muted">Nenhuma pessoa vinculada ao grupo.</p>'
          : people.map((p) => personRow(p, attByPerson.get(p.id))).join('')
        }
      </div>

      <div class="publish-bar publish-bar--editor" style="position:sticky; bottom: 20px;">
        <span id="saveStatus" class="publish-bar__status">salvo automaticamente</span>
        <button id="markAllPresent" class="btn btn--ghost btn--small">Marcar todos presentes</button>
        <button id="markAllAbsent"  class="btn btn--ghost btn--small">Desmarcar todos</button>
      </div>
    </div>
  `;

  // status do encontro
  document.getElementById('meetingStatus').addEventListener('change', async (ev) => {
    const { error } = await data.updateMeeting(meetingId, { status: ev.target.value });
    if (error) alert(error.message);
    location.reload();
  });

  // switches
  for (const li of document.querySelectorAll('.att-roster-row')) {
    const personId = li.dataset.personId;
    const presentSw = li.querySelector('[data-action="toggle-present"]');
    const justifySw = li.querySelector('[data-action="toggle-justified"]');

    presentSw.addEventListener('change', async () => {
      await save(personId, presentSw.checked, justifySw?.checked || false, li);
    });
    justifySw.addEventListener('change', async () => {
      // marcar justified implica falta (não presente)
      if (justifySw.checked) presentSw.checked = false;
      await save(personId, presentSw.checked, justifySw.checked, li);
    });
  }

  document.getElementById('markAllPresent').addEventListener('click', async () => {
    const rows = Array.from(document.querySelectorAll('.att-roster-row'));
    for (const li of rows) {
      const sw = li.querySelector('[data-action="toggle-present"]');
      if (!sw.checked) {
        sw.checked = true;
        const jsw = li.querySelector('[data-action="toggle-justified"]');
        if (jsw) jsw.checked = false;
        await save(li.dataset.personId, true, false, li);
      }
    }
  });
  document.getElementById('markAllAbsent').addEventListener('click', async () => {
    const rows = Array.from(document.querySelectorAll('.att-roster-row'));
    for (const li of rows) {
      const sw = li.querySelector('[data-action="toggle-present"]');
      if (sw.checked) {
        sw.checked = false;
        await save(li.dataset.personId, false, false, li);
      }
    }
  });
}

function personRow(person, att) {
  const isPresent = !!att?.is_present;
  const isJustified = !!att?.justified;
  return `
    <div class="att-roster-row ${isPresent ? 'is-present' : ''} ${isJustified ? 'is-justified' : ''}" data-person-id="${escapeAttr(person.id)}">
      <div class="att-roster-row__main">
        <strong>${escapeHtml(person.full_name)}</strong>
        ${person.is_primary ? `<span class="att-pill att-pill--primary">${icon('star', { size: 11 })}<span style="margin-left:4px;">prioritário</span></span>` : ''}
        ${person.email ? `<span class="muted" style="font-size:12px;">${escapeHtml(person.email)}</span>` : ''}
      </div>
      <div class="att-roster-row__actions">
        <label class="att-switch" title="${isPresent ? 'Presente' : 'Ausente'}">
          <input type="checkbox" data-action="toggle-present" ${isPresent ? 'checked' : ''} />
          <span class="att-switch__track">
            <span class="att-switch__thumb"></span>
          </span>
          <span class="att-switch__label">${isPresent ? 'presente' : 'ausente'}</span>
        </label>
        <label class="att-checkbox" title="Falta justificada (atestado, viagem, etc)">
          <input type="checkbox" data-action="toggle-justified" ${isJustified ? 'checked' : ''} />
          <span class="att-checkbox__mark">${icon('check', { size: 12 })}</span>
          <span class="att-checkbox__label">justificada</span>
        </label>
      </div>
    </div>
  `;
}

async function save(personId, isPresent, justified, row) {
  const sw = row.querySelector('[data-action="toggle-present"]');
  const lab = row.querySelector('.att-switch__label');
  const status = document.getElementById('saveStatus');

  row.classList.toggle('is-present', isPresent);
  row.classList.toggle('is-justified', justified);
  if (lab) lab.textContent = isPresent ? 'presente' : 'ausente';

  status.textContent = 'salvando…';
  status.className = 'publish-bar__status is-dirty';
  const meetingId = location.hash.split('/')[3];
  const { error } = await data.markPresent(meetingId, personId, isPresent, { justified });
  if (error) {
    status.textContent = `erro: ${error.message}`;
    status.className = 'publish-bar__status is-error';
    sw.checked = !isPresent;
  } else {
    status.textContent = 'salvo';
    status.className = 'publish-bar__status is-success';
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
