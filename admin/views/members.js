import { SECTORS, ROLES, describeProfile } from '../sectors.js';
import { icon } from '../icons.js';
import { toastSuccess, toastError } from '../toast.js';
import { supabase } from '../../js/supabase.js';

export async function renderMembers(ctx) {
  const { root, api } = ctx;

  root.innerHTML = `
    <div class="view">
      <header class="view__header" style="display:flex; align-items:flex-end; justify-content:space-between; gap:14px;">
        <div>
          <h1>Membros da equipe</h1>
          <p class="view__lede">
            Cria contas, aprova pendentes e atribui cargos.
            <br/>Hierarquia: <strong>Admin</strong> &middot; <strong>Coordenador</strong> (1 por setor) &middot; <strong>Membro</strong> (em um setor, opcionalmente numa equipe).
          </p>
        </div>
        <button id="newUserBtn" class="btn btn--primary">${icon('user-plus', { size: 14 })}<span style="margin-left:6px;">Criar usuário</span></button>
      </header>
      <div id="membersBox" class="empty-state">carregando…</div>
    </div>
  `;

  document.getElementById('newUserBtn').addEventListener('click', () => openCreateUserForm(ctx));

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

// ====== drawer: criar usuário (chama Edge Function admin-create-user) ======
function openCreateUserForm(ctx) {
  document.querySelectorAll('.block-drawer-overlay').forEach((el) => el.remove());

  const overlay = document.createElement('div');
  overlay.className = 'block-drawer-overlay';
  overlay.innerHTML = `
    <div class="block-drawer">
      <header class="block-drawer__head">
        <div>
          <p class="block-drawer__crumb">Novo usuário</p>
          <h2><span class="block-drawer__icon">${icon('user-plus', { size: 26 })}</span> Criar conta</h2>
          <p class="block-drawer__desc">Cria conta direto no Supabase Auth com email já confirmado. O usuário pode logar imediatamente.</p>
        </div>
        <button class="icon-btn" data-action="close">${icon('x', { size: 16 })}</button>
      </header>
      <form class="block-drawer__body" id="createUserForm">
        <label class="drawer-field">
          <span class="drawer-field__label">Nome (exibido no painel)</span>
          <input type="text" name="display_name" class="drawer-field__input" placeholder="Ex.: Maria Silva" />
        </label>
        <label class="drawer-field">
          <span class="drawer-field__label">E-mail</span>
          <input type="email" name="email" class="drawer-field__input" required placeholder="usuario@exemplo.com" autocomplete="off" />
        </label>
        <label class="drawer-field">
          <span class="drawer-field__label">Senha provisória</span>
          <input type="text" name="password" class="drawer-field__input" required minlength="8" placeholder="mínimo 8 caracteres" autocomplete="new-password" />
          <p class="drawer-field__hint">Combine algo simples e peça pra pessoa trocar depois. A senha aparece em texto pra você poder comunicar.</p>
        </label>

        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <label class="drawer-field" style="flex:1; min-width:180px;">
            <span class="drawer-field__label">Cargo</span>
            <select name="role" class="drawer-field__input" id="newUserRole">
              ${[
                { v: 'pending', l: 'Pendente (sem acesso)' },
                { v: 'admin',   l: 'Admin (Presidência)' },
                { v: 'coordinator', l: 'Coordenador / Diretor' },
                { v: 'member', l: 'Membro' },
              ].map((r) => `<option value="${r.v}" ${r.v === 'member' ? 'selected' : ''}>${r.l}</option>`).join('')}
            </select>
          </label>
          <label class="drawer-field" style="flex:1; min-width:180px;" id="newUserSectorWrap">
            <span class="drawer-field__label">Setor</span>
            <select name="sector" class="drawer-field__input" id="newUserSector">
              <option value="">— escolha —</option>
              ${[
                { v: 'presidencia', l: 'Presidência' },
                { v: 'professor-orientador', l: 'Professor Orientador' },
                { v: 'professor-colaborador', l: 'Professor Colaborador' },
                { v: 'midia', l: 'Mídia' },
                { v: 'pesquisa', l: 'Pesquisa' },
                { v: 'tesouraria', l: 'Tesouraria' },
                { v: 'secretaria', l: 'Secretaria' },
                { v: 'atividades', l: 'Atividades' },
              ].map((s) => `<option value="${s.v}">${s.l}</option>`).join('')}
            </select>
          </label>
        </div>
        <label class="drawer-field" id="newUserTeamWrap">
          <span class="drawer-field__label">Equipe (opcional)</span>
          <input type="text" name="team" class="drawer-field__input" placeholder="Ex.: Design, Redes Sociais" />
          <p class="drawer-field__hint">Use só se quiser distinguir sub-equipes dentro do setor.</p>
        </label>

        <p id="createUserErr" class="muted" style="color:var(--danger); display:none;"></p>
      </form>
      <footer class="block-drawer__foot">
        <span class="spacer"></span>
        <button class="btn btn--ghost" data-action="close">Cancelar</button>
        <button class="btn btn--primary" data-action="save">${icon('user-plus', { size: 14 })}<span style="margin-left:6px;">Criar conta</span></button>
      </footer>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('is-open'));

  const form = overlay.querySelector('#createUserForm');
  form.addEventListener('submit', (e) => e.preventDefault());

  // visibility condicional dos campos
  const roleSel   = overlay.querySelector('#newUserRole');
  const sectorWrap = overlay.querySelector('#newUserSectorWrap');
  const teamWrap   = overlay.querySelector('#newUserTeamWrap');
  function syncFields() {
    const r = roleSel.value;
    const needSector = r === 'coordinator' || r === 'member';
    const needTeam   = r === 'member';
    sectorWrap.style.display = needSector ? '' : 'none';
    teamWrap.style.display   = needTeam ? '' : 'none';
  }
  roleSel.addEventListener('change', syncFields);
  syncFields();

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
      const fd = new FormData(form);
      const payload = {
        email: String(fd.get('email') || '').trim(),
        password: String(fd.get('password') || ''),
        display_name: String(fd.get('display_name') || '').trim() || null,
        role: String(fd.get('role') || 'member'),
        sector: String(fd.get('sector') || '') || null,
        team: String(fd.get('team') || '').trim() || null,
      };
      const errBox = overlay.querySelector('#createUserErr');
      errBox.style.display = 'none';

      if (!payload.email) { showErr(errBox, 'E-mail obrigatório.'); return; }
      if (payload.password.length < 8) { showErr(errBox, 'Senha precisa ter no mínimo 8 caracteres.'); return; }
      if ((payload.role === 'coordinator' || payload.role === 'member') && !payload.sector) {
        showErr(errBox, 'Escolha o setor.'); return;
      }

      const saveBtn = overlay.querySelector('[data-action="save"]');
      saveBtn.disabled = true;
      saveBtn.innerHTML = 'criando…';

      try {
        const { data, error } = await supabase.functions.invoke('admin-create-user', {
          body: payload,
        });
        if (error) {
          // tenta extrair message do response
          let msg = error.message || 'falha ao chamar a função';
          try {
            const body = await error.context?.json?.();
            if (body?.error) msg = body.error;
          } catch {}
          showErr(errBox, msg);
          return;
        }
        if (data?.error) { showErr(errBox, data.error); return; }
        if (data?.warning) toastError(data.warning);
        toastSuccess(`Conta criada: ${payload.email}`);
        close();
        // recarrega a view de membros
        renderMembers(ctx);
      } catch (e) {
        showErr(errBox, e.message || String(e));
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = icon('user-plus', { size: 14 }) + '<span style="margin-left:6px;">Criar conta</span>';
      }
    }
  });
}

function showErr(el, msg) { el.textContent = msg; el.style.display = ''; }
