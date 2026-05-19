import { SECTORS, ROLES, describeProfile } from '../sectors.js';
import { icon } from '../icons.js';

export async function renderMembers(ctx) {
  const { root, api } = ctx;

  root.innerHTML = `
    <div class="view">
      <h1>Membros da equipe</h1>
      <p class="view__lede">
        Aprova novos cadastros (status “pendente”) e atribui cargos.
        <br/>Hierarquia: <strong>Admin</strong> &middot; <strong>Coordenador</strong> (1 por setor) &middot; <strong>Membro</strong> (em um setor, opcionalmente numa equipe).
      </p>
      <div id="membersBox" class="empty-state">carregando…</div>
    </div>
  `;

  const box = document.getElementById('membersBox');

  let rows;
  try {
    const { data, error } = await api.supabase.rpc('get_users_admin');
    if (error) throw error;
    rows = data || [];
  } catch (e) {
    box.innerHTML = `
      <div class="empty-state">
        <p>Não foi possível carregar (${escapeHtml(e.message)}).</p>
        <p class="muted">Se a função <code>get_users_admin</code> não existir, peça pro dev rodar o SQL <code>003-roles-hierarchy.sql</code>.</p>
      </div>
    `;
    return;
  }

  if (!rows.length) {
    box.innerHTML = `<div class="empty-state">Nenhum usuário cadastrado.</div>`;
    return;
  }

  box.className = '';
  box.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Email</th>
          <th>Nome</th>
          <th>Cargo</th>
          <th>Setor</th>
          <th>Equipe</th>
          <th>Criado</th>
          <th></th>
        </tr>
      </thead>
      <tbody id="membersTbody">
        ${rows.map(rowHtml).join('')}
      </tbody>
    </table>
  `;

  bindRows(api);
  // aplica visibilidade inicial dos campos por role
  for (const tr of document.querySelectorAll('#membersTbody tr')) syncFieldVisibility(tr);
}

function rowHtml(row) {
  return `
    <tr data-user-id="${escapeHtml(row.user_id)}">
      <td>${escapeHtml(row.email || '—')}</td>
      <td>
        <input
          type="text"
          data-field="display_name"
          value="${escapeHtml(row.display_name || '')}"
          placeholder="—"
          class="member-input"
          style="max-width:160px;"
        />
      </td>
      <td>
        <select data-field="role">
          ${ROLES.map((r) => `
            <option value="${escapeHtml(r.value)}" ${r.value === row.role ? 'selected' : ''}>
              ${escapeHtml(r.label)}
            </option>
          `).join('')}
        </select>
      </td>
      <td>
        <select data-field="sector" data-needs-sector>
          <option value="">—</option>
          ${SECTORS.map((s) => `
            <option value="${escapeHtml(s.value)}" ${s.value === row.sector ? 'selected' : ''}>
              ${escapeHtml(s.label)}
            </option>
          `).join('')}
        </select>
      </td>
      <td>
        <input
          type="text"
          data-field="team"
          data-needs-team
          value="${escapeHtml(row.team || '')}"
          placeholder="—"
          class="member-input"
          style="max-width:140px;"
        />
      </td>
      <td class="muted">${formatDate(row.created_at)}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn--ghost btn--small" data-action="save">Salvar</button>
        <span class="muted" data-action="status" style="font-size:12px;margin-left:6px;"></span>
      </td>
    </tr>
  `;
}

function syncFieldVisibility(tr) {
  const role = tr.querySelector('[data-field="role"]').value;
  const sectorField = tr.querySelector('[data-needs-sector]');
  const teamField = tr.querySelector('[data-needs-team]');

  const needsSector = role === 'coordinator' || role === 'member';
  const needsTeam = role === 'member';

  sectorField.disabled = !needsSector;
  sectorField.parentElement.style.opacity = needsSector ? '1' : '0.4';
  teamField.disabled = !needsTeam;
  teamField.parentElement.style.opacity = needsTeam ? '1' : '0.4';

  if (!needsSector) sectorField.value = '';
  if (!needsTeam) teamField.value = '';
}

function bindRows(api) {
  const tbody = document.getElementById('membersTbody');

  // muda role → aplica visibility dos outros campos
  tbody.addEventListener('change', (ev) => {
    if (ev.target.matches('[data-field="role"]')) {
      const tr = ev.target.closest('tr');
      syncFieldVisibility(tr);
    }
  });

  // clica salvar
  tbody.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button[data-action="save"]');
    if (!btn) return;
    const tr = btn.closest('tr');
    const userId = tr.dataset.userId;
    const role = tr.querySelector('[data-field=role]').value;
    const sector = tr.querySelector('[data-field=sector]').value || null;
    const team = tr.querySelector('[data-field=team]').value.trim() || null;
    const display = tr.querySelector('[data-field=display_name]').value.trim();
    const status = tr.querySelector('[data-action=status]');

    // validação client-side
    if ((role === 'coordinator' || role === 'member') && !sector) {
      status.textContent = 'setor é obrigatório';
      status.style.color = 'var(--danger)';
      return;
    }

    btn.disabled = true;
    status.textContent = 'salvando…';
    status.style.color = 'var(--text-dim)';

    try {
      const { error } = await api.supabase.rpc('update_user_role', {
        target_user: userId,
        new_role: role,
        new_display_name: display || null,
        new_sector: sector,
        new_team: team,
      });
      if (error) throw error;
      status.innerHTML = `${icon('check', { size: 12 })} salvo`;
      status.style.color = 'var(--success)';
      setTimeout(() => { status.textContent = ''; }, 2500);
    } catch (e) {
      status.textContent = e.message;
      status.style.color = 'var(--danger)';
    } finally {
      btn.disabled = false;
    }
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}
