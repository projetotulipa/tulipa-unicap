import { SCOPES } from '../../js/config.js';

const ROLE_OPTIONS = [
  { value: 'pending', label: 'Pendente (sem acesso)' },
  { value: 'admin',   label: 'Admin (acesso total)' },
  ...Object.entries(SCOPES)
    .filter(([scope, cfg]) => !cfg.adminOnly && cfg.role)
    .map(([scope, cfg]) => ({ value: cfg.role, label: cfg.label })),
];

export async function renderMembers(ctx) {
  const { root, api, state } = ctx;

  root.innerHTML = `
    <div class="view">
      <h1>Membros da equipe</h1>
      <p class="view__lede">Aprova novos cadastros (status “pendente”) e atribui cargos. Só você (admin) vê esta tela.</p>
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
        <p class="muted">Se a função <code>get_users_admin</code> não existir, peça pro dev rodar o SQL de membros.</p>
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
          <th>Criado em</th>
          <th></th>
        </tr>
      </thead>
      <tbody id="membersTbody">
        ${rows.map(rowHtml).join('')}
      </tbody>
    </table>
  `;

  bindRows(api);
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
          style="background:var(--bg);border:1px solid var(--border);color:var(--text);padding:6px 10px;border-radius:6px;font:inherit;width:100%;max-width:180px;"
        />
      </td>
      <td>
        <select data-field="role">
          ${ROLE_OPTIONS.map((opt) => `
            <option value="${escapeHtml(opt.value)}" ${opt.value === row.role ? 'selected' : ''}>${escapeHtml(opt.label)}</option>
          `).join('')}
        </select>
      </td>
      <td class="muted">${formatDate(row.created_at)}</td>
      <td>
        <button class="btn btn--ghost btn--small" data-action="save">Salvar</button>
        <span class="muted" data-action="status" style="font-size:12px;margin-left:6px;"></span>
      </td>
    </tr>
  `;
}

function bindRows(api) {
  const tbody = document.getElementById('membersTbody');
  tbody.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button[data-action="save"]');
    if (!btn) return;
    const tr = btn.closest('tr');
    const userId = tr.dataset.userId;
    const role = tr.querySelector('[data-field=role]').value;
    const display = tr.querySelector('[data-field=display_name]').value.trim();
    const status = tr.querySelector('[data-action=status]');

    btn.disabled = true;
    status.textContent = 'salvando…';
    status.style.color = 'var(--text-dim)';

    try {
      const { error } = await api.supabase.rpc('update_user_role', {
        target_user: userId,
        new_role: role,
        new_display_name: display || null,
      });
      if (error) throw error;
      status.textContent = 'salvo ✓';
      status.style.color = 'var(--success)';
      setTimeout(() => { status.textContent = ''; }, 2000);
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
