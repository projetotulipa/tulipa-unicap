// CRUD de equipes de Pesquisa + vincular pessoas.

import { icon } from '../icons.js';
import * as data from '../research/data.js';
import * as attData from '../attendance/data.js';
import { renderResearchNav } from './research-nav.js';
import { avatarHtml } from '../avatar.js';
import { toastSuccess, toastError } from '../toast.js';

export async function renderResearchTeams(ctx) {
  const { root } = ctx;

  root.innerHTML = `
    <div class="view">
      ${renderResearchNav('equipes')}

      <header class="view__header" style="display:flex; align-items:flex-end; justify-content:space-between; gap:14px;">
        <div>
          <h1>Equipes de Pesquisa</h1>
          <p class="view__lede">Divida o setor em sub-equipes (estudo, comunicação científica, etc.). Vincule as pessoas a cada uma.</p>
        </div>
        <button class="btn btn--primary" id="newTeamBtn">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Nova equipe</span></button>
      </header>

      <div id="teamsList" class="empty-state"><div class="skel skel--block"></div></div>
    </div>
  `;

  document.getElementById('newTeamBtn').addEventListener('click', () => openTeamForm(null));
  await loadTeams();
}

async function loadTeams() {
  const box = document.getElementById('teamsList');
  const { data: teams, error } = await data.listGroups({ includeArchived: true });
  if (error) { box.innerHTML = `<p class="muted">${error.message}</p>`; return; }
  if (!teams?.length) {
    box.innerHTML = `
      <div class="att-empty">
        <div class="att-empty__art">${icon('group', { size: 56 })}</div>
        <h3>Nenhuma equipe</h3>
        <p>Crie equipes pra organizar quem estuda o quê dentro da Pesquisa.</p>
        <button class="btn btn--primary" id="emptyNew">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Criar primeira</span></button>
      </div>
    `;
    document.getElementById('emptyNew').addEventListener('click', () => openTeamForm(null));
    return;
  }

  const memberCounts = await Promise.all(teams.map((t) => data.listGroupMembers(t.id)));
  box.className = '';
  box.innerHTML = `<div class="att-group-list">${teams.map((t, i) => teamCard(t, memberCounts[i].data || [])).join('')}</div>`;

  for (const card of box.querySelectorAll('.att-group-card')) {
    const id = card.dataset.teamId;
    card.querySelector('[data-action="open"]').addEventListener('click', async () => {
      const { data: team } = await data.getGroup(id);
      if (team) openTeamForm(team);
    });
  }
}

function teamCard(t, members) {
  return `
    <article class="att-group-card ${t.is_archived ? 'is-archived' : ''}" data-team-id="${escapeAttr(t.id)}">
      <button class="att-group-card__main" data-action="open" style="background:transparent; border:none; cursor:pointer; font:inherit; color:inherit; text-align:left; width:100%;">
        <span class="att-group-card__icon">${icon('group', { size: 22 })}</span>
        <div class="att-group-card__body">
          <strong>${escapeHtml(t.name)}</strong>
          ${t.description ? `<span class="att-group-card__desc">${escapeHtml(t.description)}</span>` : ''}
          <div class="att-group-card__stats">
            <span class="pill">${icon('users', { size: 11 })}<span style="margin-left:4px;">${members.length} ${members.length === 1 ? 'pessoa' : 'pessoas'}</span></span>
            ${t.is_archived ? '<span class="att-group-card__badge">arquivada</span>' : ''}
          </div>
          ${members.length ? `<div style="display:flex; gap:-4px; margin-top: 8px;">${members.slice(0, 5).map((m) => avatarHtml(m.person?.full_name, { size: 'sm' })).join('')}${members.length > 5 ? `<span class="muted" style="margin-left:8px; font-size:12px;">+${members.length - 5}</span>` : ''}</div>` : ''}
        </div>
      </button>
    </article>
  `;
}

async function openTeamForm(existing) {
  document.querySelectorAll('.block-drawer-overlay').forEach((el) => el.remove());

  const isEdit = !!existing;
  const [{ data: allPeople }, currentMembersRes] = await Promise.all([
    attData.listPeople(),
    isEdit ? data.listGroupMembers(existing.id) : Promise.resolve({ data: [] }),
  ]);
  const currentMembers = currentMembersRes.data || [];
  const currentMemberIds = new Set(currentMembers.map((m) => m.person_id));

  const overlay = document.createElement('div');
  overlay.className = 'block-drawer-overlay';
  overlay.innerHTML = `
    <div class="block-drawer">
      <header class="block-drawer__head">
        <div>
          <p class="block-drawer__crumb">${isEdit ? 'Editando equipe' : 'Nova equipe'}</p>
          <h2><span class="block-drawer__icon">${icon('group', { size: 26 })}</span> ${isEdit ? escapeHtml(existing.name) : 'Equipe'}</h2>
        </div>
        <button class="icon-btn" data-action="close">${icon('x', { size: 16 })}</button>
      </header>
      <form class="block-drawer__body" id="teamForm">
        <label class="drawer-field">
          <span class="drawer-field__label">Nome</span>
          <input type="text" name="name" class="drawer-field__input" required value="${escapeAttr(existing?.name || '')}" placeholder="Ex.: Estudo Jung, Comunicação científica" />
        </label>
        <label class="drawer-field">
          <span class="drawer-field__label">Descrição (opcional)</span>
          <textarea name="description" class="drawer-field__input" rows="2">${escapeHtml(existing?.description || '')}</textarea>
        </label>
        ${isEdit ? `
          <label class="drawer-field">
            <span class="drawer-field__label">Estado</span>
            <select name="is_archived" class="drawer-field__input">
              <option value="false" ${!existing.is_archived ? 'selected' : ''}>Ativa</option>
              <option value="true"  ${existing.is_archived ? 'selected' : ''}>Arquivada</option>
            </select>
          </label>
          <hr style="margin: 18px 0; border:none; border-top:1px solid var(--border);">
          <h3 style="font-family:'Cormorant Garamond',serif; font-style:italic; font-size:18px; color:var(--cream); margin:0 0 10px;">Membros</h3>
          <div class="res-team-members">
            ${(allPeople || []).map((p) => `
              <label class="res-member-row">
                <input type="checkbox" data-person-id="${escapeAttr(p.id)}" ${currentMemberIds.has(p.id) ? 'checked' : ''} />
                ${avatarHtml(p.full_name, { size: 'sm' })}
                <span>${escapeHtml(p.full_name)}</span>
              </label>
            `).join('')}
          </div>
        ` : '<p class="muted" style="font-size:13px;">Crie a equipe primeiro pra depois vincular pessoas.</p>'}
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

  const form = overlay.querySelector('#teamForm');
  form.addEventListener('submit', (e) => e.preventDefault());

  if (isEdit) {
    overlay.querySelectorAll('[data-person-id]').forEach((cb) => {
      cb.addEventListener('change', async () => {
        const personId = cb.dataset.personId;
        if (cb.checked) {
          const { error } = await data.addGroupMember(existing.id, personId);
          if (error) { toastError(error.message); cb.checked = false; return; }
        } else {
          const { error } = await data.removeGroupMember(existing.id, personId);
          if (error) { toastError(error.message); cb.checked = true; return; }
        }
      });
    });
  }

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
    if (action === 'delete' && existing) {
      if (!confirm(`Excluir a equipe "${existing.name}"? Fichamentos e posts vinculados perdem o vínculo.`)) return;
      const { error } = await data.deleteGroup(existing.id);
      if (error) { toastError(error.message); return; }
      toastSuccess('Equipe excluída.');
      close();
      await loadTeams();
      return;
    }
    if (action === 'save') {
      const fd = new FormData(form);
      const fields = {
        name: String(fd.get('name') || '').trim(),
        description: String(fd.get('description') || '').trim() || null,
      };
      if (isEdit) fields.is_archived = fd.get('is_archived') === 'true';
      if (!fields.name) { toastError('Nome é obrigatório.'); return; }
      const { error } = isEdit ? await data.updateGroup(existing.id, fields) : await data.createGroup(fields);
      if (error) { toastError(error.message); return; }
      toastSuccess(isEdit ? 'Equipe atualizada.' : 'Equipe criada.');
      close();
      await loadTeams();
    }
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
