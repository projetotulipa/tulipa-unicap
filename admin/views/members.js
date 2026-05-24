import { SECTORS, ROLES, describeProfile } from '../sectors.js';
import { icon } from '../icons.js';
import { toastSuccess, toastError } from '../toast.js';
import { supabase } from '../../js/supabase.js';
import { updateUserProfileBio, uploadDirectorAvatar } from '../../js/directors.js';
import { resizeImageToSquare, validateImageSize } from '../../js/image-resize.js';

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
  membersRowsCache = rows;

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
        <button class="btn btn--ghost btn--small" data-action="open-bio" title="Editar foto, bio e redes">${icon('edit', { size: 12 })}<span style="margin-left:4px;">Bio</span></button>
        <span class="muted" data-action="status" style="font-size:12px;margin-left:6px;"></span>
      </td>
    </tr>
  `;
}

// estado dos dados carregados pra reabrir bio
let membersRowsCache = [];

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

  // clica em "Bio" pra abrir drawer de perfil rico
  tbody.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-action="open-bio"]');
    if (!btn) return;
    const tr = btn.closest('tr');
    const userId = tr.dataset.userId;
    const row = membersRowsCache.find((r) => r.user_id === userId);
    if (row) openProfileBioDrawer(row);
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

// ====== drawer: perfil completo (foto + bio + IG + LinkedIn + ...) ======
function openProfileBioDrawer(row) {
  document.querySelectorAll('.container-prompt').forEach((el) => el.remove());

  let pendingAvatarFile = null;
  let currentAvatarUrl = row.avatar_url || '';
  const userId = row.user_id;

  const modal = document.createElement('div');
  modal.className = 'container-prompt';
  modal.innerHTML = `
    <div class="container-prompt__box" style="width: min(640px, 100%);">
      <header class="container-prompt__head">
        <div>
          <p class="container-prompt__crumb">perfil completo</p>
          <h3>${escapeHtml(row.display_name || row.email)}</h3>
          <p class="container-prompt__desc">Foto, bio rica e redes sociais. Quando "visível como diretor" estiver ligado, aparece na LP do setor (${escapeHtml(row.sector || '—')}).</p>
        </div>
        <button class="icon-btn" data-action="cancel" aria-label="Fechar">${icon('x', { size: 16 })}</button>
      </header>
      <div class="container-prompt__body">
        <div class="coord-form__avatar">
          <div class="coord-form__avatar-preview" id="bioAvatarPreview">
            ${currentAvatarUrl
              ? `<img src="${escapeHtml(currentAvatarUrl)}" alt="" />`
              : `<span class="coord-form__avatar-empty">${icon('users', { size: 32 })}<span>sem foto</span></span>`}
          </div>
          <div class="coord-form__avatar-actions">
            <label class="btn btn--ghost btn--small" style="cursor: pointer;">
              ${icon('plus', { size: 12 })}<span style="margin-left:5px;">${currentAvatarUrl ? 'Trocar' : 'Adicionar foto'}</span>
              <input type="file" id="bioAvatarInput" accept="image/*" hidden />
            </label>
            ${currentAvatarUrl ? `<button class="btn btn--ghost btn--small" data-action="remove-avatar">${icon('trash', { size: 11 })}<span style="margin-left:5px;">Remover</span></button>` : ''}
            <small style="color: var(--text-dim); font-size: 11px; font-style: italic; display: block; margin-top: 4px;">
              JPG/PNG/WEBP. Redimensiona pra 400×400 quadrado automaticamente.
            </small>
          </div>
        </div>

        <label class="container-prompt__field">
          <span>Bio (markdown rico)</span>
          <textarea id="bioMd" rows="5" placeholder="Psicóloga clínica, mestre em psicologia analítica pela UNICAP. **Pesquisa** sobre arquétipos…">${escapeHtml(row.bio_md || '')}</textarea>
        </label>

        <label class="container-prompt__field">
          <span>Instagram (sem @)</span>
          <input type="text" id="bioIG" value="${escapeHtml((row.instagram || '').replace(/^@/, ''))}" placeholder="mariadasilva" />
        </label>

        <div class="container-prompt__field">
          <span>Outros links (label + URL)</span>
          <div id="bioSocialLinks">
            ${(row.social_links || []).map((s, i) => bioSocialRow(s, i)).join('')}
          </div>
          <button type="button" class="btn btn--ghost btn--small" id="bioAddSocial" style="margin-top: 6px;">
            ${icon('plus', { size: 11 })}<span style="margin-left:5px;">Adicionar link</span>
          </button>
        </div>

        <div class="study-toggle-row" style="border-top: 1px dashed rgba(143, 160, 132, 0.20); padding-top: 14px;">
          <div>
            <strong>Visível como diretor</strong>
            <p>Quando ligado, aparece com foto + bio na LP do setor <strong>${escapeHtml(row.sector || '—')}</strong>. Útil pra coordenadores setoriais.</p>
          </div>
          <label class="study-switch">
            <input type="checkbox" id="bioVisible" ${row.is_director_visible ? 'checked' : ''} />
            <span></span>
          </label>
        </div>
      </div>
      <footer class="container-prompt__foot">
        <button class="btn btn--ghost btn--small" data-action="cancel">Cancelar</button>
        <button class="btn btn--primary" data-action="save">Salvar perfil</button>
      </footer>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('#bioAvatarInput').addEventListener('change', async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      const resized = await resizeImageToSquare(file, 400);
      validateImageSize(resized, 1024 * 1024);
      pendingAvatarFile = resized;
      const previewUrl = URL.createObjectURL(resized);
      modal.querySelector('#bioAvatarPreview').innerHTML = `<img src="${previewUrl}" alt="" />`;
    } catch (e) {
      toastError('Erro ao processar foto: ' + e.message);
    }
  });

  modal.querySelector('#bioAddSocial').addEventListener('click', () => {
    const wrap = modal.querySelector('#bioSocialLinks');
    const i = wrap.children.length;
    wrap.insertAdjacentHTML('beforeend', bioSocialRow({ label: '', url: '' }, i));
  });

  modal.addEventListener('click', async (ev) => {
    const action = ev.target.closest('[data-action]')?.dataset?.action;
    if (action === 'cancel' || ev.target === modal) { modal.remove(); return; }
    if (action === 'remove-avatar') {
      pendingAvatarFile = null;
      currentAvatarUrl = '';
      modal.querySelector('#bioAvatarPreview').innerHTML = `<span class="coord-form__avatar-empty">${icon('users', { size: 32 })}<span>sem foto</span></span>`;
      ev.target.closest('[data-action="remove-avatar"]')?.remove();
      return;
    }
    if (action === 'remove-social') {
      ev.target.closest('.coord-social-row')?.remove();
      return;
    }
    if (action === 'save') {
      const saveBtn = modal.querySelector('[data-action="save"]');
      saveBtn.disabled = true;
      saveBtn.textContent = 'salvando…';

      let avatarUrl = currentAvatarUrl;
      if (pendingAvatarFile) {
        const { url, error } = await uploadDirectorAvatar(userId, pendingAvatarFile);
        if (error) {
          toastError('Erro ao enviar foto: ' + error.message);
          saveBtn.disabled = false;
          saveBtn.textContent = 'Salvar perfil';
          return;
        }
        avatarUrl = url;
      }

      const socialLinks = Array.from(modal.querySelectorAll('.coord-social-row')).map((row) => ({
        label: row.querySelector('[data-social-label]').value.trim(),
        url:   row.querySelector('[data-social-url]').value.trim(),
      })).filter((s) => s.label && s.url);

      const patch = {
        avatar_url: avatarUrl,
        bio_md: modal.querySelector('#bioMd').value,
        instagram: modal.querySelector('#bioIG').value.trim().replace(/^@/, ''),
        social_links: socialLinks,
        is_director_visible: modal.querySelector('#bioVisible').checked,
      };

      const { error } = await updateUserProfileBio(userId, patch);
      if (error) {
        toastError('Erro: ' + error.message);
        saveBtn.disabled = false;
        saveBtn.textContent = 'Salvar perfil';
        return;
      }
      // atualiza cache local
      Object.assign(row, patch);
      modal.remove();
      toastSuccess('Perfil atualizado.');
    }
  });
}

function bioSocialRow(s, i) {
  return `
    <div class="coord-social-row" data-social-i="${i}">
      <input type="text" data-social-label placeholder="Ex.: site pessoal" value="${escapeHtml(s.label || '')}" />
      <input type="url" data-social-url placeholder="https://..." value="${escapeHtml(s.url || '')}" />
      <button type="button" class="icon-btn icon-btn--danger" data-action="remove-social" aria-label="Remover">${icon('x', { size: 12 })}</button>
    </div>
  `;
}
