// Marcar presença de um encontro — visual refeito.

import { icon } from '../icons.js';
import * as data from '../attendance/data.js';
import { JUSTIFICATION_CATEGORIES, categoryLabel } from '../attendance/categories.js';
import { avatarHtml } from '../avatar.js';
import { toastSuccess, toastError } from '../toast.js';

let currentMeetingId = null;

export async function renderAttendanceMeeting(ctx, meetingId) {
  const { root } = ctx;
  currentMeetingId = meetingId;

  root.innerHTML = `<div class="view"><div class="skel skel--title"></div><div class="skel skel--block"></div></div>`;

  const { data: meeting, error } = await data.getMeeting(meetingId);
  if (error || !meeting) {
    root.innerHTML = `
      <div class="view">
        <p class="view__crumbs"><a href="#/presenca">${icon('arrow-left', { size: 14 })}<span style="margin-left:6px;">Presença</span></a></p>
        <div class="att-empty"><h3>Encontro não encontrado</h3></div>
      </div>
    `;
    return;
  }

  await data.initMeetingAttendance(meetingId);

  const [{ data: members }, { data: attendance }] = await Promise.all([
    data.listMembershipsOfGroup(meeting.group_id),
    data.listAttendance(meetingId),
  ]);

  const attByPerson = new Map((attendance || []).map((a) => [a.person_id, a]));
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
  const dayNum = String(dateObj.getDate()).padStart(2, '0');
  const monthLab = dateObj.toLocaleDateString('pt-BR', { month: 'long' });
  const weekdayLab = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' });
  const yearLab = dateObj.getFullYear();

  // contadores iniciais
  const presentCount = people.filter((p) => attByPerson.get(p.id)?.is_present).length;
  const justifiedCount = people.filter((p) => !attByPerson.get(p.id)?.is_present && attByPerson.get(p.id)?.justified).length;

  root.innerHTML = `
    <div class="view view--meeting">
      <p class="view__crumbs"><a href="#/presenca/grupos/${escapeAttr(meeting.group_id)}">${icon('arrow-left', { size: 14 })}<span style="margin-left:6px;">${escapeHtml(meeting.group?.name || 'Grupo')}</span></a></p>

      <header class="att-meeting-head">
        <div class="att-meeting-head__date">
          <strong>${dayNum}</strong>
          <span>${escapeHtml(monthLab)}</span>
          <small>${escapeHtml(weekdayLab)} · ${yearLab}</small>
        </div>
        <div class="att-meeting-head__main">
          <h1>${escapeHtml(meeting.group?.name || 'Encontro')}</h1>
          <p class="view__lede">
            Marque quem veio com o switch verde. Para faltas justificadas (atestado, viagem), use o botão "justificar".
          </p>
          <div class="att-meeting-head__controls">
            <label class="att-status-select">
              <span class="muted">data:</span>
              <input type="date" id="meetingDate" value="${escapeAttr(meeting.date)}" />
            </label>
            <label class="att-status-select">
              <span class="muted">status:</span>
              <select id="meetingStatus">
                <option value="scheduled" ${meeting.status === 'scheduled' ? 'selected' : ''}>agendado</option>
                <option value="happened"  ${meeting.status === 'happened'  ? 'selected' : ''}>aconteceu</option>
                <option value="cancelled" ${meeting.status === 'cancelled' ? 'selected' : ''}>cancelado</option>
              </select>
            </label>
            <button id="deleteMeetingBtn" class="btn btn--danger btn--small" title="Excluir este encontro">
              ${icon('trash', { size: 14 })}<span style="margin-left:6px;">Excluir</span>
            </button>
          </div>
        </div>
      </header>

      ${meeting.status === 'cancelled' ? `
        <div class="att-meeting-banner att-meeting-banner--cancelled">
          ${icon('x-circle', { size: 16 })}
          <span>Este encontro foi cancelado. As ausências não entram no cálculo de status.</span>
        </div>
      ` : ''}

      ${meeting.status === 'scheduled' ? `
        <div class="att-meeting-banner att-meeting-banner--scheduled">
          ${icon('clock', { size: 16 })}
          <span>Encontro ainda não confirmado. Quando acontecer, mude o status para "aconteceu" antes de marcar presenças.</span>
        </div>
      ` : ''}

      <div class="att-counter">
        <div class="att-counter__main">
          <strong id="presentCount">${presentCount}</strong>
          <span>de ${people.length} ${people.length === 1 ? 'pessoa' : 'pessoas'} presentes</span>
        </div>
        ${justifiedCount > 0 ? `
          <div class="att-counter__justified">
            <strong id="justifiedCount">${justifiedCount}</strong>
            <span>justificada${justifiedCount === 1 ? '' : 's'}</span>
          </div>
        ` : '<div class="att-counter__justified" id="justifiedSlot"></div>'}
        <div class="att-counter__progress">
          <div class="att-counter__bar" id="presentBar" style="width: ${people.length > 0 ? (presentCount / people.length * 100) : 0}%"></div>
        </div>
        <div class="att-counter__actions">
          <button class="btn btn--ghost btn--small" id="markAllPresent">Todos presentes</button>
          <button class="btn btn--ghost btn--small" id="markAllAbsent">Limpar</button>
        </div>
      </div>

      <div class="att-roster" id="rosterList">
        ${people.length === 0
          ? '<p class="muted">Nenhuma pessoa vinculada a este grupo. Vincule pessoas pelo detalhe do grupo.</p>'
          : people.map((p) => personRow(p, attByPerson.get(p.id))).join('')
        }
      </div>
    </div>
  `;

  document.getElementById('meetingStatus').addEventListener('change', async (ev) => {
    const newStatus = ev.target.value;
    const { error } = await data.updateMeeting(meetingId, { status: newStatus });
    if (error) { toastError(error.message); return; }
    toastSuccess('Status atualizado.');
    setTimeout(() => location.reload(), 350);
  });

  const dateInput = document.getElementById('meetingDate');
  dateInput.addEventListener('change', async (ev) => {
    const newDate = ev.target.value;
    if (!newDate) { dateInput.value = meeting.date; return; }
    if (newDate === meeting.date) return;
    const { error } = await data.updateMeeting(meetingId, { date: newDate });
    if (error) {
      // provável conflito de unique (group_id, date)
      if (/duplicate|unique/i.test(error.message)) {
        toastError('Já existe um encontro deste grupo nessa data.');
      } else {
        toastError(error.message);
      }
      dateInput.value = meeting.date;
      return;
    }
    toastSuccess('Data atualizada.');
    setTimeout(() => location.reload(), 350);
  });

  document.getElementById('deleteMeetingBtn').addEventListener('click', async () => {
    if (!confirm(`Excluir o encontro de ${new Date(meeting.date + 'T00:00:00').toLocaleDateString('pt-BR')}? Isso apaga as marcações de presença deste dia. Não desfaz.`)) return;
    const { error } = await data.deleteMeeting(meetingId);
    if (error) { toastError(error.message); return; }
    toastSuccess('Encontro excluído.');
    setTimeout(() => { location.hash = `#/presenca/grupos/${meeting.group_id}`; }, 400);
  });

  for (const li of document.querySelectorAll('.att-row')) wireRow(li, people.length);

  document.getElementById('markAllPresent').addEventListener('click', async () => {
    for (const li of document.querySelectorAll('.att-row')) {
      const sw = li.querySelector('[data-action="toggle-present"]');
      if (!sw.checked) {
        sw.checked = true;
        await saveRow(li, { isPresent: true, justified: false, category: null, notes: null });
      }
    }
    refreshCounters(people.length);
  });

  document.getElementById('markAllAbsent').addEventListener('click', async () => {
    for (const li of document.querySelectorAll('.att-row')) {
      const sw = li.querySelector('[data-action="toggle-present"]');
      if (sw.checked || li.classList.contains('is-justified')) {
        sw.checked = false;
        await saveRow(li, { isPresent: false, justified: false, category: null, notes: null });
      }
    }
    refreshCounters(people.length);
  });
}

function personRow(person, att) {
  const isPresent = !!att?.is_present;
  const isJustified = !!att?.justified;
  const category = att?.justification_category || '';
  const notes = att?.notes || '';
  const showJustChip = !isPresent;

  return `
    <article class="att-row ${isPresent ? 'is-present' : ''} ${isJustified ? 'is-justified' : ''}"
             data-person-id="${escapeAttr(person.id)}"
             data-category="${escapeAttr(category)}"
             data-notes="${escapeAttr(notes)}">
      <div class="att-row__person">
        ${avatarHtml(person.full_name, { size: 'md' })}
        <div class="att-row__person-info">
          <strong>${escapeHtml(person.full_name)}</strong>
          <span class="muted">${person.email ? escapeHtml(person.email) : (person.is_primary ? 'vínculo prioritário' : '')}</span>
        </div>
        ${person.is_primary ? `<span class="pill pill--gold" style="margin-left: 4px;">${icon('star', { size: 11 })}<span style="margin-left:4px;">primário</span></span>` : ''}
      </div>

      <div class="att-row__actions">
        <label class="att-switch" title="${isPresent ? 'Presente' : 'Ausente'}">
          <input type="checkbox" data-action="toggle-present" ${isPresent ? 'checked' : ''} />
          <span class="att-switch__track">
            <span class="att-switch__thumb">
              <span class="att-switch__icon-check">${icon('check', { size: 12 })}</span>
            </span>
          </span>
          <span class="att-switch__label">${isPresent ? 'presente' : 'ausente'}</span>
        </label>

        <div class="att-row__just-area" ${isPresent ? 'hidden' : ''}>
          ${isJustified
            ? `<button class="att-just-chip att-just-chip--filled" data-action="open-just-drawer">
                ${icon('check-circle', { size: 12 })}
                <span style="margin-left:6px;">justificada${category ? ' · ' + escapeHtml(categoryLabel(category)) : ''}</span>
              </button>`
            : `<button class="att-just-chip" data-action="open-just-drawer">
                ${icon('plus', { size: 12 })}
                <span style="margin-left:6px;">justificar falta</span>
              </button>`
          }
        </div>
      </div>
    </article>
  `;
}

function wireRow(row, totalPeople) {
  const personId = row.dataset.personId;
  const presentSw = row.querySelector('[data-action="toggle-present"]');
  const justArea  = row.querySelector('.att-row__just-area');
  const justBtn   = row.querySelector('[data-action="open-just-drawer"]');

  presentSw.addEventListener('change', async () => {
    if (presentSw.checked) {
      row.classList.add('is-marking');
      setTimeout(() => row.classList.remove('is-marking'), 450);
      if (justArea) justArea.hidden = true;
      await saveRow(row, { isPresent: true, justified: false, category: null, notes: null });
    } else {
      if (justArea) justArea.hidden = false;
      await saveRow(row, { isPresent: false, justified: false, category: null, notes: null });
    }
    refreshCounters(totalPeople);
  });

  justBtn?.addEventListener('click', () => openJustificationDrawer(row, totalPeople));
}

function openJustificationDrawer(row, totalPeople) {
  document.querySelectorAll('.block-drawer-overlay').forEach((el) => el.remove());

  const personName = row.querySelector('.att-row__person strong')?.textContent || '';
  const currentCategory = row.dataset.category || '';
  const currentNotes = row.dataset.notes || '';
  const isJustified = row.classList.contains('is-justified');

  const overlay = document.createElement('div');
  overlay.className = 'block-drawer-overlay';
  overlay.innerHTML = `
    <div class="block-drawer">
      <header class="block-drawer__head">
        <div>
          <p class="block-drawer__crumb">Justificar falta</p>
          <h2>${avatarHtml(personName, { size: 'sm' })}<span style="margin-left:10px;">${escapeHtml(personName)}</span></h2>
          <p class="block-drawer__desc">Use uma categoria pra organizar. Motivo é opcional mas ajuda no histórico.</p>
        </div>
        <button class="icon-btn" data-action="close" aria-label="Fechar">${icon('x', { size: 16 })}</button>
      </header>
      <form class="block-drawer__body" id="justForm">
        <label class="drawer-field">
          <span class="drawer-field__label">Categoria</span>
          <select name="category" class="drawer-field__input" required>
            <option value="">— escolha —</option>
            ${JUSTIFICATION_CATEGORIES.map((c) => `<option value="${escapeAttr(c.value)}" ${currentCategory === c.value ? 'selected' : ''}>${escapeHtml(c.label)} — ${escapeHtml(c.description)}</option>`).join('')}
          </select>
        </label>
        <label class="drawer-field">
          <span class="drawer-field__label">Motivo (opcional)</span>
          <textarea name="notes" class="drawer-field__input" rows="3" placeholder="Ex.: atestado médico de 3 dias, viagem de trabalho…">${escapeHtml(currentNotes)}</textarea>
        </label>
      </form>
      <footer class="block-drawer__foot">
        ${isJustified ? `<button class="btn btn--danger btn--small" data-action="remove-just">${icon('trash', { size: 14 })}<span style="margin-left:6px;">Remover justificativa</span></button>` : '<span class="spacer"></span>'}
        <span class="spacer"></span>
        <button class="btn btn--ghost" data-action="close">Cancelar</button>
        <button class="btn btn--primary" data-action="save-just">Confirmar</button>
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
    if (action === 'remove-just') {
      await saveRow(row, { isPresent: false, justified: false, category: null, notes: null });
      row.querySelector('[data-action="toggle-present"]').checked = false;
      refreshCounters(totalPeople);
      reflowRowJustChip(row);
      toastSuccess('Justificativa removida.');
      close();
      return;
    }
    if (action === 'save-just') {
      const form = overlay.querySelector('#justForm');
      const fd = new FormData(form);
      const category = String(fd.get('category') || '');
      const notes = String(fd.get('notes') || '').trim() || null;
      if (!category) { toastError('Escolha uma categoria.'); return; }
      await saveRow(row, { isPresent: false, justified: true, category, notes });
      row.querySelector('[data-action="toggle-present"]').checked = false;
      row.dataset.category = category;
      row.dataset.notes = notes || '';
      refreshCounters(totalPeople);
      reflowRowJustChip(row);
      toastSuccess('Justificativa registrada.');
      close();
    }
  });
}

function reflowRowJustChip(row) {
  const justArea = row.querySelector('.att-row__just-area');
  if (!justArea) return;
  const isJustified = row.classList.contains('is-justified');
  const category = row.dataset.category || '';
  justArea.innerHTML = isJustified
    ? `<button class="att-just-chip att-just-chip--filled" data-action="open-just-drawer">
        ${icon('check-circle', { size: 12 })}
        <span style="margin-left:6px;">justificada${category ? ' · ' + escapeHtml(categoryLabel(category)) : ''}</span>
      </button>`
    : `<button class="att-just-chip" data-action="open-just-drawer">
        ${icon('plus', { size: 12 })}
        <span style="margin-left:6px;">justificar falta</span>
      </button>`;
  justArea.hidden = false;
  // rebind
  justArea.querySelector('[data-action="open-just-drawer"]')?.addEventListener('click', () =>
    openJustificationDrawer(row, document.querySelectorAll('.att-row').length)
  );
}

async function saveRow(row, st) {
  const personId = row.dataset.personId;
  const lab = row.querySelector('.att-switch__label');

  row.classList.toggle('is-present', st.isPresent);
  row.classList.toggle('is-justified', st.justified);
  if (lab) lab.textContent = st.isPresent ? 'presente' : 'ausente';

  const { error } = await data.markPresent(currentMeetingId, personId, st.isPresent, {
    justified: st.justified, notes: st.notes, justification_category: st.category,
  });
  if (error) {
    toastError(`erro: ${error.message}`);
    // reverter visual
    row.classList.toggle('is-present', !st.isPresent);
  }
}

function refreshCounters(total) {
  const present = document.querySelectorAll('.att-row.is-present').length;
  const justified = document.querySelectorAll('.att-row.is-justified').length;
  const pc = document.getElementById('presentCount');
  const jc = document.getElementById('justifiedCount');
  const slot = document.getElementById('justifiedSlot');
  const bar = document.getElementById('presentBar');
  if (pc) pc.textContent = present;
  if (jc) jc.textContent = justified;
  if (slot && justified > 0) {
    slot.outerHTML = `<div class="att-counter__justified"><strong id="justifiedCount">${justified}</strong><span>justificada${justified === 1 ? '' : 's'}</span></div>`;
  }
  if (bar) bar.style.width = total > 0 ? `${(present / total) * 100}%` : '0%';
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
