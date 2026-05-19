// CRUD de pessoas + visualização rápida dos grupos em que está vinculada.

import { icon } from '../icons.js';
import * as data from '../attendance/data.js';

export async function renderAttendancePeople(ctx) {
  const { root } = ctx;

  root.innerHTML = `
    <div class="view">
      <p class="view__crumbs"><a href="#/presenca">${icon('arrow-left', { size: 14 })}<span style="margin-left:6px;">Presença</span></a></p>
      <header class="view__header" style="display:flex; align-items:flex-end; justify-content:space-between; gap:14px;">
        <div>
          <h1>Pessoas</h1>
          <p class="view__lede">Quem participa dos grupos. Use o vínculo primário (estrela) para definir o grupo em que a pessoa é cobrada.</p>
        </div>
        <button id="newPersonBtn" class="btn btn--primary">${icon('user-plus', { size: 14 })}<span style="margin-left:6px;">Nova pessoa</span></button>
      </header>

      <div id="peopleList" class="empty-state">carregando…</div>
    </div>
  `;

  document.getElementById('newPersonBtn').addEventListener('click', () => openPersonForm());
  await loadPeople();
}

async function loadPeople() {
  const box = document.getElementById('peopleList');
  const [{ data: people, error }, { data: groups }] = await Promise.all([
    data.listPeople({ includeInactive: true }),
    data.listGroups({ includeArchived: false }),
  ]);

  if (error) {
    box.innerHTML = `<p class="muted">${error.message}</p>`;
    return;
  }
  if (!people?.length) {
    box.innerHTML = `<p class="muted">Ninguém cadastrado ainda. Clique em "Nova pessoa".</p>`;
    return;
  }

  // pra cada pessoa, busca memberships (poderia ser join, mas mais simples 1 query por pessoa pra começar)
  const memberships = await Promise.all(people.map((p) => data.listMembershipsOfPerson(p.id)));

  box.className = '';
  box.innerHTML = `
    <table class="table att-people-table">
      <thead>
        <tr><th>Nome</th><th>E-mail</th><th>Grupo prioritário</th><th>Outros grupos</th><th></th></tr>
      </thead>
      <tbody>
        ${people.map((p, idx) => personRow(p, memberships[idx]?.data || [])).join('')}
      </tbody>
    </table>
  `;

  // bind row clicks (abrir editor)
  box.querySelectorAll('tr[data-person-id]').forEach((tr) => {
    tr.querySelector('[data-action="edit"]')?.addEventListener('click', async () => {
      const id = tr.dataset.personId;
      const { data: row } = await data.getPerson(id);
      if (row) openPersonForm(row);
    });
  });
}

function personRow(p, memberships) {
  const primary = memberships.find((m) => m.is_primary);
  const others  = memberships.filter((m) => !m.is_primary);
  return `
    <tr data-person-id="${escapeAttr(p.id)}" class="${p.is_active ? '' : 'is-inactive'}">
      <td><strong>${escapeHtml(p.full_name)}</strong>${!p.is_active ? ' <span class="muted">(inativa)</span>' : ''}</td>
      <td class="muted">${escapeHtml(p.email || '—')}</td>
      <td>
        ${primary
          ? `<span class="att-pill att-pill--primary">${icon('star', { size: 11 })}<span style="margin-left:4px;">${escapeHtml(primary.group?.name || '—')}</span></span>`
          : '<span class="muted">—</span>'
        }
      </td>
      <td>
        ${others.length
          ? others.map((m) => `<span class="att-pill">${escapeHtml(m.group?.name || '—')}</span>`).join(' ')
          : '<span class="muted">—</span>'
        }
      </td>
      <td><button class="btn btn--ghost btn--small" data-action="edit">${icon('edit', { size: 12 })}<span style="margin-left:6px;">Editar</span></button></td>
    </tr>
  `;
}

function openPersonForm(existing = null) {
  document.querySelectorAll('.block-drawer-overlay').forEach((el) => el.remove());

  const isEdit = !!existing;
  const overlay = document.createElement('div');
  overlay.className = 'block-drawer-overlay';
  overlay.innerHTML = `
    <div class="block-drawer">
      <header class="block-drawer__head">
        <div>
          <p class="block-drawer__crumb">${isEdit ? 'Editando pessoa' : 'Nova pessoa'}</p>
          <h2><span class="block-drawer__icon">${icon('user-plus', { size: 26 })}</span> ${isEdit ? escapeHtml(existing.full_name) : 'Cadastro'}</h2>
        </div>
        <button class="icon-btn" data-action="close" aria-label="Fechar">${icon('x', { size: 16 })}</button>
      </header>
      <form class="block-drawer__body" id="personForm">
        <label class="drawer-field">
          <span class="drawer-field__label">Nome completo</span>
          <input type="text" name="full_name" class="drawer-field__input" required value="${escapeAttr(existing?.full_name || '')}" placeholder="Como aparecerá na lista de presença" />
        </label>
        <label class="drawer-field">
          <span class="drawer-field__label">E-mail (opcional)</span>
          <input type="email" name="email" class="drawer-field__input" value="${escapeAttr(existing?.email || '')}" placeholder="para contato" />
        </label>
        <label class="drawer-field">
          <span class="drawer-field__label">Notas</span>
          <textarea name="notes" class="drawer-field__input" rows="2" placeholder="Lembretes sobre essa pessoa (opcional)">${escapeHtml(existing?.notes || '')}</textarea>
        </label>
        ${isEdit ? `
          <label class="drawer-field">
            <span class="drawer-field__label">Estado</span>
            <select name="is_active" class="drawer-field__input">
              <option value="true"  ${existing.is_active ? 'selected' : ''}>Ativa</option>
              <option value="false" ${!existing.is_active ? 'selected' : ''}>Inativa (saiu)</option>
            </select>
          </label>
        ` : ''}
        <p id="personFormError" class="muted" style="color:var(--danger); display:none;"></p>
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
    if (ev.target === overlay) { close(); return; }
    const action = ev.target.closest('[data-action]')?.dataset?.action;
    if (action === 'close') return close();

    if (action === 'delete') {
      if (!confirm(`Excluir "${existing.full_name}" definitivamente? Histórico de presença também será removido. Para preservar histórico, use "Inativa" em vez de excluir.`)) return;
      const { error } = await data.deletePerson(existing.id);
      if (error) { showErr(error.message); return; }
      close();
      await loadPeople();
      return;
    }

    if (action === 'save') {
      const form = overlay.querySelector('#personForm');
      const fd = new FormData(form);
      const fields = {
        full_name: String(fd.get('full_name') || '').trim(),
        email: String(fd.get('email') || '').trim() || null,
        notes: String(fd.get('notes') || '').trim() || null,
      };
      if (isEdit) fields.is_active = fd.get('is_active') === 'true';
      if (!fields.full_name) { showErr('Nome é obrigatório.'); return; }
      const promise = isEdit
        ? data.updatePerson(existing.id, fields)
        : data.createPerson(fields);
      const { error } = await promise;
      if (error) { showErr(error.message); return; }
      close();
      await loadPeople();
    }
  });

  function showErr(msg) {
    const el = overlay.querySelector('#personFormError');
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
