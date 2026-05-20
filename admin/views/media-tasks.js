// Tarefas de Mídia — colunas todo/in_progress/done estilo kanban simples.

import { icon } from '../icons.js';
import * as data from '../media/data.js';
import * as researchData from '../research/data.js';
import * as attData from '../attendance/data.js';
import { renderMediaNav } from './media-nav.js';
import { avatarHtml } from '../avatar.js';
import { toastSuccess, toastError } from '../toast.js';

const STATUS_COLUMNS = [
  { id: 'todo',         label: 'A fazer' },
  { id: 'in_progress',  label: 'Em andamento' },
  { id: 'done',         label: 'Concluído' },
];

let cachedTasks = [];

export async function renderMediaTasks(ctx) {
  const { root } = ctx;

  root.innerHTML = `
    <div class="view">
      ${renderMediaNav('tasks')}

      <header class="view__header" style="display:flex; align-items:flex-end; justify-content:space-between; gap:14px;">
        <div>
          <h1>Tarefas</h1>
          <p class="view__lede">Acompanhe o que cada equipe precisa entregar. Mude o status arrastando o select.</p>
        </div>
        <button class="btn btn--primary" id="newTaskBtn">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Nova tarefa</span></button>
      </header>

      <div id="kanban" class="media-kanban">
        ${STATUS_COLUMNS.map((c) => `
          <section class="media-col" data-status="${c.id}">
            <header class="media-col__head"><h3>${c.label}</h3><span class="muted" data-count>0</span></header>
            <div class="media-col__body" data-target="${c.id}"><div class="skel skel--block"></div></div>
          </section>
        `).join('')}
      </div>
    </div>
  `;

  document.getElementById('newTaskBtn').addEventListener('click', () => openTaskForm(null));
  await loadTasks();
}

async function loadTasks() {
  const { data: tasks, error } = await data.listTasks();
  if (error) { toastError(error.message); return; }
  cachedTasks = tasks || [];

  for (const col of STATUS_COLUMNS) {
    const body = document.querySelector(`[data-target="${col.id}"]`);
    const count = document.querySelector(`.media-col[data-status="${col.id}"] [data-count]`);
    const tasksOfCol = cachedTasks.filter((t) => t.status === col.id);
    count.textContent = tasksOfCol.length;
    if (!tasksOfCol.length) {
      body.innerHTML = `<p class="muted" style="padding: 12px 4px; font-size:13px;">vazio</p>`;
    } else {
      body.innerHTML = tasksOfCol.map(taskCard).join('');
    }
  }

  for (const card of document.querySelectorAll('.media-task-card')) {
    card.addEventListener('click', async (ev) => {
      if (ev.target.closest('select, button')) return;
      const t = cachedTasks.find((x) => x.id === card.dataset.id);
      if (t) openTaskForm(t);
    });
    const statusSel = card.querySelector('[data-action="status"]');
    statusSel?.addEventListener('change', async () => {
      const { error } = await data.updateTask(card.dataset.id, { status: statusSel.value });
      if (error) { toastError(error.message); return; }
      toastSuccess('Status atualizado.');
      await loadTasks();
    });
  }
}

function taskCard(t) {
  const dueStr = t.due_date ? new Date(t.due_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : null;
  const today = new Date().toISOString().slice(0, 10);
  const isLate = t.due_date && t.due_date < today && t.status !== 'done';
  return `
    <article class="media-task-card ${isLate ? 'is-late' : ''}" data-id="${escapeAttr(t.id)}">
      <header class="media-task-card__head">
        <strong>${escapeHtml(t.title)}</strong>
        ${dueStr ? `<span class="pill ${isLate ? '' : 'pill--gold'}" ${isLate ? 'style="background:rgba(194,74,74,0.14); border-color:rgba(194,74,74,0.4); color:var(--danger-soft);"' : ''}>${icon('clock', { size: 11 })}<span style="margin-left:4px;">${escapeHtml(dueStr)}</span></span>` : ''}
      </header>
      ${t.description ? `<p class="media-task-card__desc">${escapeHtml(t.description.slice(0, 100))}${t.description.length > 100 ? '…' : ''}</p>` : ''}
      <div class="media-task-card__meta">
        ${t.team ? `<span class="pill">${icon('group', { size: 11 })}<span style="margin-left:4px;">${escapeHtml(t.team.name)}</span></span>` : ''}
        ${t.assignee ? avatarHtml(t.assignee.full_name, { size: 'sm' }) : ''}
        ${t.post ? `<span class="pill" style="margin-left:auto;">${icon('spark', { size: 11 })}<span style="margin-left:4px;">post</span></span>` : ''}
      </div>
      <footer class="media-task-card__foot">
        <select data-action="status">
          ${STATUS_COLUMNS.map((c) => `<option value="${c.id}" ${t.status === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}
        </select>
      </footer>
    </article>
  `;
}

export async function openTaskForm(existing, opts = {}) {
  document.querySelectorAll('.block-drawer-overlay').forEach((el) => el.remove());

  const isEdit = !!existing;
  const prefilledPost = opts.prefilledPost || null;
  const post = prefilledPost || existing?.post || null;

  const [{ data: teams }, { data: allPeople }, { data: incomingPosts }] = await Promise.all([
    data.listTeams(),
    attData.listPeople(),
    researchData.listPosts(),
  ]);

  const overlay = document.createElement('div');
  overlay.className = 'block-drawer-overlay';
  overlay.innerHTML = `
    <div class="block-drawer block-drawer--wide">
      <header class="block-drawer__head">
        <div>
          <p class="block-drawer__crumb">${isEdit ? 'Editando tarefa' : 'Nova tarefa'}</p>
          <h2><span class="block-drawer__icon">${icon('check-circle', { size: 26 })}</span> ${isEdit ? escapeHtml(existing.title) : 'Tarefa'}</h2>
        </div>
        <button class="icon-btn" data-action="close">${icon('x', { size: 16 })}</button>
      </header>
      <form class="block-drawer__body" id="taskForm">
        <label class="drawer-field">
          <span class="drawer-field__label">Título</span>
          <input type="text" name="title" class="drawer-field__input" required value="${escapeAttr(existing?.title || (post ? `Arte: ${post.title}` : ''))}" placeholder="O que precisa ser feito?" />
        </label>
        <label class="drawer-field">
          <span class="drawer-field__label">Descrição (opcional)</span>
          <textarea name="description" class="drawer-field__input" rows="3" placeholder="Detalhe pra equipe">${escapeHtml(existing?.description || '')}</textarea>
        </label>
        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <label class="drawer-field" style="flex:1; min-width:160px;">
            <span class="drawer-field__label">Equipe</span>
            <select name="team_id" class="drawer-field__input" id="taskTeam">
              <option value="">— sem equipe —</option>
              ${(teams || []).map((tm) => `<option value="${escapeAttr(tm.id)}" ${existing?.team_id === tm.id ? 'selected' : ''}>${escapeHtml(tm.name)}</option>`).join('')}
            </select>
          </label>
          <label class="drawer-field" style="flex:1; min-width:160px;">
            <span class="drawer-field__label">Pessoa (opcional)</span>
            <select name="assigned_to_person_id" class="drawer-field__input" id="taskPerson">
              <option value="">— escolha uma equipe primeiro —</option>
            </select>
          </label>
        </div>
        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <label class="drawer-field" style="flex:1; min-width:160px;">
            <span class="drawer-field__label">Data limite</span>
            <input type="date" name="due_date" class="drawer-field__input" value="${escapeAttr(existing?.due_date || '')}" />
          </label>
          <label class="drawer-field" style="flex:1; min-width:160px;">
            <span class="drawer-field__label">Status</span>
            <select name="status" class="drawer-field__input">
              ${STATUS_COLUMNS.map((c) => `<option value="${c.id}" ${(existing?.status || 'todo') === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}
            </select>
          </label>
        </div>
        <label class="drawer-field">
          <span class="drawer-field__label">Post associado</span>
          <select name="post_id" class="drawer-field__input">
            <option value="">— sem post —</option>
            ${(incomingPosts || []).map((p) => `<option value="${escapeAttr(p.id)}" ${(existing?.post_id || post?.id) === p.id ? 'selected' : ''}>${escapeHtml(p.title)} (${p.status})</option>`).join('')}
          </select>
        </label>

        ${post ? `
          <hr style="margin: 18px 0; border:none; border-top:1px solid var(--border);">
          <h3 style="font-family:'Cormorant Garamond',serif; font-style:italic; font-size:18px; color:var(--cream); margin:0 0 8px;">Anexo: post</h3>
          <div class="res-text-block">${escapeHtml(post.body || '').replace(/\n/g, '<br/>')}</div>
          ${post.research_note ? `
            <details style="margin-top:14px;">
              <summary class="muted" style="cursor:pointer; font-size:13px;">ver fichamento que originou o post</summary>
              <h4 style="margin:12px 0 6px; color:var(--cream);">${escapeHtml(post.research_note.title)}</h4>
              <div class="res-text-block">${escapeHtml(post.research_note.body || '').replace(/\n/g, '<br/>')}</div>
            </details>
          ` : ''}
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

  const form = overlay.querySelector('#taskForm');
  form.addEventListener('submit', (e) => e.preventDefault());

  const teamSel = overlay.querySelector('#taskTeam');
  const personSel = overlay.querySelector('#taskPerson');

  async function loadTeamMembers(teamId) {
    if (!teamId) {
      personSel.innerHTML = '<option value="">— sem equipe selecionada —</option>';
      return;
    }
    const { data: members } = await data.listTeamMembers(teamId);
    const options = ['<option value="">— qualquer um da equipe —</option>'];
    for (const m of (members || [])) {
      options.push(`<option value="${escapeAttr(m.person_id)}" ${existing?.assigned_to_person_id === m.person_id ? 'selected' : ''}>${escapeHtml(m.person?.full_name || '—')}</option>`);
    }
    personSel.innerHTML = options.join('');
  }
  teamSel.addEventListener('change', () => loadTeamMembers(teamSel.value));
  if (existing?.team_id) loadTeamMembers(existing.team_id);

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
      if (!confirm(`Excluir a tarefa "${existing.title}"?`)) return;
      const { error } = await data.deleteTask(existing.id);
      if (error) { toastError(error.message); return; }
      toastSuccess('Tarefa excluída.');
      close();
      opts.onSaved?.();
      await loadTasks().catch(() => {});
      return;
    }
    if (action === 'save') {
      const fd = new FormData(form);
      const fields = {
        title: String(fd.get('title') || '').trim(),
        description: String(fd.get('description') || '').trim() || null,
        team_id: fd.get('team_id') || null,
        assigned_to_person_id: fd.get('assigned_to_person_id') || null,
        due_date: fd.get('due_date') || null,
        status: String(fd.get('status') || 'todo'),
        post_id: fd.get('post_id') || null,
      };
      if (!fields.title) { toastError('Título é obrigatório.'); return; }
      const { error } = isEdit ? await data.updateTask(existing.id, fields) : await data.createTask(fields);
      if (error) { toastError(error.message); return; }
      toastSuccess(isEdit ? 'Tarefa atualizada.' : 'Tarefa criada.');
      close();
      opts.onSaved?.();
      await loadTasks().catch(() => {});
    }
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
