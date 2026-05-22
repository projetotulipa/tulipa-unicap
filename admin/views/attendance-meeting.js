// Marcação de presença — Sprint 3 ("fólio aberto").
// Header cerimonial + counter fólio sticky + roster em 3 colunas DnD
// (presentes / justificadas / ausentes) + drawer de justificativa com cards de ícone
// + estampa de "registro fechado" quando happened com presentes.

import { icon } from '../icons.js';
import * as data from '../attendance/data.js';
import { JUSTIFICATION_CATEGORIES, categoryLabel, categoryIcon } from '../attendance/categories.js';
import { avatarHtml } from '../avatar.js';
import { codexSeal, codexPage } from '../attendance/codex.js';
import { toastSuccess, toastError } from '../toast.js';

const WEEKDAY_LABELS = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

let currentMeetingId = null;

export async function renderAttendanceMeeting(ctx, meetingId) {
  const { root, state } = ctx;
  const isAdmin = state.role === 'admin';
  currentMeetingId = meetingId;

  root.innerHTML = `
    <div class="view">
      <div class="att-loading-wrap">
        <span class="att-bloom"><span class="att-codex-seal">${codexSeal({ size: 24 })}</span></span>
        <p>Abrindo o fólio…</p>
      </div>
    </div>
  `;

  const { data: meeting, error } = await data.getMeeting(meetingId);
  if (error || !meeting) {
    root.innerHTML = `
      <div class="view">
        <p class="view__crumbs"><a href="#/presenca">${icon('arrow-left', { size: 14 })}<span style="margin-left:6px;">Secretaria</span></a></p>
        <div class="att-empty-v2">
          <div class="att-empty-v2__art">${codexSeal({ size: 52 })}</div>
          <h3>Encontro não encontrado</h3>
          <p>Talvez tenha sido excluído ou o link esteja errado.</p>
        </div>
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
  const weekdayLab = WEEKDAY_LABELS[dateObj.getDay()];
  const yearLab = dateObj.getFullYear();

  // estado por pessoa
  function bucketOf(personId) {
    const a = attByPerson.get(personId);
    if (!a) return 'absent';
    if (a.is_present) return 'present';
    if (a.justified) return 'justified';
    return 'absent';
  }

  const totalPeople = people.length;
  const showSeal = meeting.status === 'happened' && Array.from(attByPerson.values()).some((a) => a.is_present);

  root.innerHTML = `
    <div class="view view--folio">
      <p class="view__crumbs"><a href="#/presenca/grupos/${escapeAttr(meeting.group_id)}">${icon('arrow-left', { size: 14 })}<span style="margin-left:6px;">${escapeHtml(meeting.group?.name || 'Grupo')}</span></a></p>

      <header class="att-fol-head">
        <div class="att-fol-head__date">
          <span class="att-fol-head__date-seal">${codexSeal({ size: 18 })}</span>
          <span class="att-fol-head__day">${dayNum}</span>
          <span class="att-fol-head__month">${escapeHtml(monthLab)}</span>
          <span class="att-fol-head__weekday">${escapeHtml(weekdayLab)}</span>
          <span class="att-fol-head__year">${yearLab}</span>
        </div>
        <div class="att-fol-head__main">
          <p class="att-fol-head__eyebrow">fólio do encontro · ${escapeHtml(meetingStatusLabel(meeting.status))}</p>
          <h1>${escapeHtml(meeting.group?.name || 'Encontro')}</h1>
          <p class="att-fol-head__lede">
            Arraste cada pessoa para a coluna correta — ou use os ícones no card. Justificativas escolhem a categoria visual.
          </p>
          <div class="att-fol-head__controls">
            ${isAdmin ? `
              <label class="att-status-select">
                <span class="muted">data:</span>
                <input type="date" id="meetingDate" value="${escapeAttr(meeting.date)}" />
              </label>
            ` : ''}
            <label class="att-status-select">
              <span class="muted">status:</span>
              <select id="meetingStatus">
                <option value="scheduled" ${meeting.status === 'scheduled' ? 'selected' : ''}>agendado</option>
                <option value="happened"  ${meeting.status === 'happened'  ? 'selected' : ''}>aconteceu</option>
                <option value="cancelled" ${meeting.status === 'cancelled' ? 'selected' : ''}>cancelado</option>
              </select>
            </label>
            ${isAdmin ? `
              <button id="deleteMeetingBtn" class="btn btn--danger btn--small" title="Excluir este encontro">
                ${icon('trash', { size: 14 })}<span style="margin-left:6px;">Excluir</span>
              </button>
            ` : ''}
          </div>
        </div>
        ${showSeal ? `
          <span class="att-fol-head__seal" id="folioSeal" title="Encontro registrado">
            ${icon('check-circle', { size: 14 })}
            <span>registro fechado</span>
          </span>
        ` : ''}
        <div class="att-fol-head__page">${codexPage({ size: 200 })}</div>
      </header>

      ${meeting.status === 'cancelled' ? `
        <div class="att-fol-banner att-fol-banner--cancelled">
          ${icon('x-circle', { size: 16 })}
          <span>Este encontro foi cancelado. As ausências não entram no cálculo de status.</span>
        </div>
      ` : ''}

      ${meeting.status === 'scheduled' ? `
        <div class="att-fol-banner att-fol-banner--scheduled">
          ${icon('clock', { size: 16 })}
          <span>Encontro ainda não confirmado. Quando acontecer, mude o status para "aconteceu" antes de marcar presenças.</span>
        </div>
      ` : ''}

      <div class="att-fol-counter" id="folioCounter">
        <div class="att-fol-counter__pct">
          <strong id="folPct">${calcPct(attByPerson, totalPeople)}%</strong>
          <span>presença</span>
        </div>
        <div class="att-fol-counter__main">
          <div class="att-fol-counter__line">
            <span class="att-fol-counter__present"><strong id="folPresent">${countBy(attByPerson, 'present')}</strong> ${totalPeople === 1 ? 'presente' : 'presentes'}</span>
            <span class="att-fol-counter__total">de ${totalPeople} ${totalPeople === 1 ? 'pessoa' : 'pessoas'}</span>
            <span class="att-fol-counter__just" id="folJustChip" ${countBy(attByPerson, 'justified') === 0 ? 'hidden' : ''}>
              ${icon('check-circle', { size: 11 })}
              <span><strong id="folJust">${countBy(attByPerson, 'justified')}</strong> justificada<span id="folJustS">${countBy(attByPerson, 'justified') === 1 ? '' : 's'}</span></span>
            </span>
          </div>
          <div class="att-fol-counter__bar"><div class="att-fol-counter__bar-fill" id="folBar" style="width: ${calcPct(attByPerson, totalPeople)}%;"></div></div>
        </div>
        <span class="att-fol-counter__hint">arraste entre colunas</span>
        <div class="att-fol-counter__actions">
          <button class="btn btn--ghost btn--small" id="markAllPresent">Todos presentes</button>
          <button class="btn btn--ghost btn--small" id="markAllAbsent">Limpar</button>
        </div>
      </div>

      ${totalPeople === 0 ? `
        <div class="att-empty-v2 att-empty-v2--rose">
          <div class="att-empty-v2__art">${icon('users', { size: 52 })}</div>
          <h3>Nenhuma pessoa vinculada</h3>
          <p>Vincule pessoas ao grupo antes de marcar presenças.</p>
          <a class="btn btn--ghost" href="#/presenca/grupos/${escapeAttr(meeting.group_id)}">${icon('arrow-left', { size: 14 })}<span style="margin-left:6px;">Abrir grupo</span></a>
        </div>
      ` : `
        <div class="att-fol-board" id="folioBoard">
          ${renderCol('present', 'Presentes', icon('check-circle', { size: 16 }), people, attByPerson)}
          ${renderCol('justified', 'Justificadas', icon('alert', { size: 14 }), people, attByPerson)}
          ${renderCol('absent', 'Ausentes', icon('x-circle', { size: 16 }), people, attByPerson)}
        </div>
      `}
    </div>
  `;

  // Status / data / delete handlers (mantidos)
  document.getElementById('meetingStatus').addEventListener('change', async (ev) => {
    const newStatus = ev.target.value;
    const { error } = await data.updateMeeting(meetingId, { status: newStatus });
    if (error) { toastError(error.message); return; }
    toastSuccess('Status atualizado.');
    setTimeout(() => location.reload(), 350);
  });

  if (isAdmin) {
    const dateInput = document.getElementById('meetingDate');
    dateInput?.addEventListener('change', async (ev) => {
      const newDate = ev.target.value;
      if (!newDate) { dateInput.value = meeting.date; return; }
      if (newDate === meeting.date) return;
      dateInput.disabled = true;
      const { error } = await data.updateMeeting(meetingId, { date: newDate });
      if (error) {
        if (/duplicate|unique/i.test(error.message)) {
          toastError('Já existe um encontro deste grupo nessa data.');
        } else {
          toastError(error.message);
        }
        dateInput.value = meeting.date;
        dateInput.disabled = false;
        return;
      }
      toastSuccess('Data atualizada.');
      setTimeout(() => location.reload(), 350);
    });

    document.getElementById('deleteMeetingBtn')?.addEventListener('click', async () => {
      if (!confirm(`Excluir o encontro de ${new Date(meeting.date + 'T00:00:00').toLocaleDateString('pt-BR')}? Isso apaga as marcações de presença deste dia. Não desfaz.`)) return;
      const { error } = await data.deleteMeeting(meetingId);
      if (error) { toastError(error.message); return; }
      toastSuccess('Encontro excluído.');
      setTimeout(() => { location.hash = `#/presenca/grupos/${meeting.group_id}`; }, 400);
    });
  }

  if (totalPeople > 0) {
    wireBoard(people, attByPerson, totalPeople);

    document.getElementById('markAllPresent').addEventListener('click', async () => {
      const cards = document.querySelectorAll('.att-fol-card');
      for (const card of cards) {
        const pid = card.dataset.personId;
        await moveCard(pid, 'present', { silent: true });
      }
      toastSuccess('Todos marcados como presentes.');
    });

    document.getElementById('markAllAbsent').addEventListener('click', async () => {
      const cards = document.querySelectorAll('.att-fol-card');
      for (const card of cards) {
        const pid = card.dataset.personId;
        await moveCard(pid, 'absent', { silent: true });
      }
      toastSuccess('Marcações limpas.');
    });
  }

  // closure scope: cache pra movimentação eficiente
  window.__folio = { attByPerson, peopleMap: new Map(people.map((p) => [p.id, p])), totalPeople, meeting };
}

function renderCol(bucket, title, iconHtml, people, attByPerson) {
  const labelMap = { present: 'Presentes', justified: 'Justificadas', absent: 'Ausentes' };
  const emptyMap = {
    present: 'arraste pessoas pra cá quando elas chegarem',
    justified: 'arraste e escolha a categoria',
    absent: 'quem ainda não foi marcado fica aqui',
  };
  const filtered = people.filter((p) => bucketByAtt(attByPerson.get(p.id)) === bucket);
  const count = filtered.length;
  return `
    <div class="att-fol-col" data-bucket="${bucket}">
      <header class="att-fol-col__head">
        <h3>${iconHtml}${escapeHtml(labelMap[bucket] || title)}</h3>
        <span class="att-fol-col__count" id="folCount-${bucket}">${count}</span>
      </header>
      <div class="att-fol-col__body" data-bucket="${bucket}">
        ${filtered.length === 0
          ? `<div class="att-fol-col__empty">${escapeHtml(emptyMap[bucket])}</div>`
          : filtered.map((p) => personCard(p, attByPerson.get(p.id), bucket)).join('')}
      </div>
    </div>
  `;
}

function personCard(person, att, bucket) {
  const isJust = bucket === 'justified';
  const cat = att?.justification_category;
  return `
    <article class="att-fol-card"
             data-person-id="${escapeAttr(person.id)}"
             data-bucket="${bucket}"
             draggable="true"
             aria-grabbed="false">
      ${avatarHtml(person.full_name, { size: 'sm' })}
      <div class="att-fol-card__main">
        <div class="att-fol-card__name">
          <strong>${escapeHtml(person.full_name || '—')}</strong>
          ${person.is_primary ? `<span class="att-fol-card__primary" title="Vínculo primário">${icon('star', { size: 11 })}</span>` : ''}
        </div>
        ${isJust && cat ? `
          <div class="att-fol-card__meta att-fol-card__meta--just">
            ${categoryIcon(cat, { size: 12 })}
            <span>${escapeHtml(categoryLabel(cat))}${att?.notes ? ' · ' + escapeHtml(truncate(att.notes, 28)) : ''}</span>
          </div>
        ` : (person.email ? `<div class="att-fol-card__meta">${escapeHtml(person.email)}</div>` : '')}
      </div>
      <div class="att-fol-card__actions">
        ${bucket !== 'present'   ? `<button class="icon-btn icon-btn--xs" data-act="to-present"   title="Marcar presente" aria-label="Marcar presente">${icon('check', { size: 12 })}</button>` : ''}
        ${bucket !== 'justified' ? `<button class="icon-btn icon-btn--xs" data-act="to-justified" title="Justificar"        aria-label="Justificar">${icon('alert', { size: 12 })}</button>` : ''}
        ${bucket !== 'absent'    ? `<button class="icon-btn icon-btn--xs" data-act="to-absent"    title="Marcar ausente"   aria-label="Marcar ausente">${icon('x', { size: 12 })}</button>` : ''}
      </div>
    </article>
  `;
}

function wireBoard(people, attByPerson, totalPeople) {
  const board = document.getElementById('folioBoard');
  if (!board) return;

  // delegate dragstart/dragend/dragover/drop
  let draggingId = null;

  board.addEventListener('dragstart', (ev) => {
    const card = ev.target.closest('.att-fol-card');
    if (!card) return;
    draggingId = card.dataset.personId;
    card.classList.add('is-dragging');
    ev.dataTransfer.effectAllowed = 'move';
    try { ev.dataTransfer.setData('text/plain', draggingId); } catch (e) { /* iOS workaround */ }
  });
  board.addEventListener('dragend', (ev) => {
    const card = ev.target.closest('.att-fol-card');
    if (card) card.classList.remove('is-dragging');
    board.querySelectorAll('.att-fol-col__body.is-drop-target').forEach((el) => el.classList.remove('is-drop-target'));
    board.querySelectorAll('.att-fol-col.is-drop-active').forEach((el) => el.classList.remove('is-drop-active'));
    draggingId = null;
  });

  board.querySelectorAll('.att-fol-col__body').forEach((zone) => {
    zone.addEventListener('dragover', (ev) => {
      if (!draggingId) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'move';
      zone.classList.add('is-drop-target');
      zone.closest('.att-fol-col').classList.add('is-drop-active');
    });
    zone.addEventListener('dragleave', (ev) => {
      if (zone.contains(ev.relatedTarget)) return;
      zone.classList.remove('is-drop-target');
      zone.closest('.att-fol-col').classList.remove('is-drop-active');
    });
    zone.addEventListener('drop', async (ev) => {
      ev.preventDefault();
      const targetBucket = zone.dataset.bucket;
      const pid = draggingId;
      zone.classList.remove('is-drop-target');
      zone.closest('.att-fol-col').classList.remove('is-drop-active');
      if (!pid || !targetBucket) return;
      await moveCard(pid, targetBucket);
    });
  });

  // click handlers nos botões de ação (fallback mobile + atalho desktop)
  board.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('[data-act]');
    if (!btn) return;
    const card = btn.closest('.att-fol-card');
    if (!card) return;
    ev.stopPropagation();
    const action = btn.dataset.act;
    const target = action === 'to-present' ? 'present'
                 : action === 'to-justified' ? 'justified'
                 : 'absent';
    await moveCard(card.dataset.personId, target);
  });
}

async function moveCard(personId, targetBucket, opts = {}) {
  const { silent = false } = opts;
  const board = document.getElementById('folioBoard');
  if (!board) return;
  const card = board.querySelector(`.att-fol-card[data-person-id="${cssEscape(personId)}"]`);
  if (!card) return;
  const currentBucket = card.dataset.bucket;
  if (currentBucket === targetBucket && targetBucket !== 'justified') return;

  // se vai pra justified, abre drawer; se confirmar, persiste; se cancelar, fica.
  if (targetBucket === 'justified') {
    const personName = card.querySelector('.att-fol-card__name strong')?.textContent || '';
    const existing = window.__folio?.attByPerson.get(personId);
    const result = await openJustificationDrawer({
      personName,
      currentCategory: existing?.justification_category || '',
      currentNotes: existing?.notes || '',
      hasExisting: !!existing?.justified,
    });
    if (!result) return; // cancelado
    if (result.action === 'remove') {
      await persistAndMove(personId, card, 'absent', { silent });
      return;
    }
    if (result.action === 'save') {
      await persistAndMove(personId, card, 'justified', {
        category: result.category,
        notes: result.notes,
        silent,
      });
      return;
    }
    return;
  }

  await persistAndMove(personId, card, targetBucket, { silent });
}

async function persistAndMove(personId, card, targetBucket, opts = {}) {
  const { silent = false, category = null, notes = null } = opts;

  const payload = targetBucket === 'present'   ? { is_present: true,  justified: false, category: null,     notes: null }
                : targetBucket === 'justified' ? { is_present: false, justified: true,  category,           notes }
                                               : { is_present: false, justified: false, category: null,     notes: null };

  // otimista: atualiza UI primeiro
  const prevBucket = card.dataset.bucket;
  moveCardDom(card, targetBucket, { category, notes, personId });
  refreshAllCounters();

  const { error } = await data.markPresent(currentMeetingId, personId, payload.is_present, {
    justified: payload.justified, notes: payload.notes, justification_category: payload.category,
  });

  if (error) {
    toastError(`Erro: ${error.message}`);
    // reverter
    moveCardDom(card, prevBucket, { personId });
    refreshAllCounters();
    return;
  }

  // atualizar cache local
  if (window.__folio) {
    window.__folio.attByPerson.set(personId, {
      person_id: personId,
      meeting_id: currentMeetingId,
      is_present: payload.is_present,
      justified: payload.justified,
      justification_category: payload.category,
      notes: payload.notes,
    });
  }

  if (!silent) {
    card.classList.add('is-dropped');
    setTimeout(() => card.classList.remove('is-dropped'), 600);
  }
}

function moveCardDom(card, targetBucket, opts = {}) {
  const { category = null, notes = null, personId } = opts;
  const targetCol = document.querySelector(`.att-fol-col[data-bucket="${targetBucket}"] .att-fol-col__body`);
  if (!targetCol) return;
  // se a coluna está com placeholder empty, remove
  const empty = targetCol.querySelector('.att-fol-col__empty');
  if (empty) empty.remove();

  // reconstruir card com bucket novo (pra metadata e ações corretas)
  const personIdFinal = personId || card.dataset.personId;
  const person = window.__folio?.peopleMap.get(personIdFinal);
  if (!person) return;

  const att = {
    is_present: targetBucket === 'present',
    justified: targetBucket === 'justified',
    justification_category: category,
    notes,
  };

  const newCardHtml = personCard(person, att, targetBucket);
  const tpl = document.createElement('template');
  tpl.innerHTML = newCardHtml.trim();
  const newCard = tpl.content.firstChild;
  targetCol.appendChild(newCard);

  // remove o antigo
  card.remove();

  // se a coluna de origem agora está vazia, recolocar placeholder
  document.querySelectorAll('.att-fol-col').forEach((col) => {
    const body = col.querySelector('.att-fol-col__body');
    const bucket = col.dataset.bucket;
    if (body && !body.children.length) {
      const emptyMap = {
        present: 'arraste pessoas pra cá quando elas chegarem',
        justified: 'arraste e escolha a categoria',
        absent: 'quem ainda não foi marcado fica aqui',
      };
      body.innerHTML = `<div class="att-fol-col__empty">${escapeHtml(emptyMap[bucket])}</div>`;
    }
  });
}

function refreshAllCounters() {
  const total = window.__folio?.totalPeople || 0;
  const cards = document.querySelectorAll('.att-fol-card');
  let p = 0, j = 0, a = 0;
  cards.forEach((c) => {
    const b = c.dataset.bucket;
    if (b === 'present') p++;
    else if (b === 'justified') j++;
    else a++;
  });
  document.getElementById('folCount-present').textContent = p;
  document.getElementById('folCount-justified').textContent = j;
  document.getElementById('folCount-absent').textContent = a;
  document.getElementById('folPresent').textContent = p;
  document.getElementById('folJust').textContent = j;
  document.getElementById('folJustS').textContent = j === 1 ? '' : 's';
  const justChip = document.getElementById('folJustChip');
  if (justChip) justChip.hidden = j === 0;
  const pct = total > 0 ? Math.round(p / total * 100) : 0;
  document.getElementById('folPct').textContent = `${pct}%`;
  const bar = document.getElementById('folBar');
  if (bar) {
    bar.style.width = `${pct}%`;
    bar.classList.toggle('att-fol-counter__bar-fill--low', pct > 0 && pct < 50);
    bar.classList.toggle('att-fol-counter__bar-fill--critical', pct > 0 && pct < 30);
  }
}

function openJustificationDrawer({ personName, currentCategory, currentNotes, hasExisting }) {
  return new Promise((resolve) => {
    document.querySelectorAll('.block-drawer-overlay').forEach((el) => el.remove());

    let selectedCategory = currentCategory || '';

    const overlay = document.createElement('div');
    overlay.className = 'block-drawer-overlay';
    overlay.innerHTML = `
      <div class="block-drawer">
        <header class="block-drawer__head">
          <div>
            <p class="block-drawer__crumb">Justificar falta</p>
            <h2><span class="block-drawer__icon">${icon('alert', { size: 24 })}</span> Categoria & motivo</h2>
            <p class="block-drawer__desc">Toque numa categoria pra registrar. Motivo é opcional mas ajuda no histórico.</p>
          </div>
          <button class="icon-btn" data-action="close" aria-label="Fechar">${icon('x', { size: 16 })}</button>
        </header>
        <form class="block-drawer__body" id="justForm">
          <div class="att-just-target">
            ${avatarHtml(personName, { size: 'sm' })}
            <strong>${escapeHtml(personName)}</strong>
          </div>
          <div class="att-just-cards" role="radiogroup" aria-label="Categoria de justificativa">
            ${JUSTIFICATION_CATEGORIES.map((c) => `
              <label class="att-just-card ${selectedCategory === c.value ? 'is-selected' : ''}" data-cat="${escapeAttr(c.value)}">
                <input type="radio" name="category" value="${escapeAttr(c.value)}" ${selectedCategory === c.value ? 'checked' : ''} />
                <span class="att-just-card__icon">${categoryIcon(c.value, { size: 22 })}</span>
                <span class="att-just-card__label">${escapeHtml(c.label)}</span>
                <span class="att-just-card__desc">${escapeHtml(c.description)}</span>
              </label>
            `).join('')}
          </div>
          <label class="drawer-field" style="margin-top: 14px;">
            <span class="drawer-field__label">Motivo (opcional)</span>
            <textarea name="notes" class="drawer-field__input" rows="3" placeholder="Ex.: atestado médico de 3 dias, viagem de trabalho…">${escapeHtml(currentNotes)}</textarea>
          </label>
        </form>
        <footer class="block-drawer__foot">
          ${hasExisting ? `<button class="btn btn--danger btn--small" data-action="remove-just">${icon('trash', { size: 14 })}<span style="margin-left:6px;">Remover justificativa</span></button>` : '<span class="spacer"></span>'}
          <span class="spacer"></span>
          <button class="btn btn--ghost" data-action="close">Cancelar</button>
          <button class="btn btn--primary" data-action="save-just">Confirmar</button>
        </footer>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-open'));

    let closed = false;
    function close(result = null) {
      if (closed) return;
      closed = true;
      overlay.classList.remove('is-open');
      setTimeout(() => overlay.remove(), 220);
      document.removeEventListener('keydown', onKey);
      resolve(result);
    }
    function onKey(e) {
      if (e.key === 'Escape') close(null);
      if ((e.key === 's' || e.key === 'S') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        doSave();
      }
    }
    document.addEventListener('keydown', onKey);

    // seleção visual de categoria
    overlay.querySelectorAll('.att-just-card').forEach((cardEl) => {
      cardEl.addEventListener('click', (ev) => {
        ev.preventDefault();
        selectedCategory = cardEl.dataset.cat;
        overlay.querySelectorAll('.att-just-card').forEach((c) => c.classList.toggle('is-selected', c.dataset.cat === selectedCategory));
        const radio = cardEl.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
      });
    });

    function doSave() {
      if (!selectedCategory) { toastError('Escolha uma categoria.'); return; }
      const form = overlay.querySelector('#justForm');
      const fd = new FormData(form);
      const notes = String(fd.get('notes') || '').trim() || null;
      close({ action: 'save', category: selectedCategory, notes });
    }

    overlay.addEventListener('click', async (ev) => {
      if (ev.target === overlay) return close(null);
      const action = ev.target.closest('[data-action]')?.dataset?.action;
      if (action === 'close') return close(null);
      if (action === 'remove-just') return close({ action: 'remove' });
      if (action === 'save-just') return doSave();
    });
  });
}

function bucketByAtt(att) {
  if (!att) return 'absent';
  if (att.is_present) return 'present';
  if (att.justified) return 'justified';
  return 'absent';
}

function countBy(attByPerson, bucket) {
  let n = 0;
  for (const a of attByPerson.values()) if (bucketByAtt(a) === bucket) n++;
  return n;
}

function calcPct(attByPerson, total) {
  if (!total) return 0;
  return Math.round(countBy(attByPerson, 'present') / total * 100);
}

function meetingStatusLabel(s) {
  return { scheduled: 'agendado', happened: 'aconteceu', cancelled: 'cancelado' }[s] || s;
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// CSS.escape pra IDs com caracteres não-ASCII (UUID já é safe, mas garantia)
function cssEscape(s) {
  return (window.CSS && window.CSS.escape) ? window.CSS.escape(s) : String(s).replace(/"/g, '\\"');
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
