// TULIPA · admin · entry point
import { supabase } from '../js/supabase.js';
import { SCOPES } from '../js/config.js';
import { SECTORS, ROLES, sectorByValue, describeProfile } from './sectors.js';
import {
  getData, getScope, patchEdit, setOrder,
  bootstrap, publish, onChange,
} from '../js/site-data.js';

import { renderOverview }   from './views/overview.js';
import { renderNavbar }     from './views/navbar.js';
import { renderPages }      from './views/pages.js';
import { renderPageEditor } from './views/page-editor.js';
import { renderMembers }    from './views/members.js';

// ---------- estado ----------
const state = {
  user: null,
  role: null,
  sector: null,
  team: null,
  displayName: null,
  // tracking de edits pendentes por scope (dirty flag)
  dirty: new Set(),
};

// ---------- helpers de UI ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function setBodyState(s) {
  document.body.dataset.state = s;
}

function showError(target, msg) {
  if (!target) return;
  target.textContent = msg;
  target.hidden = false;
}

function clearError(target) {
  if (!target) return;
  target.textContent = '';
  target.hidden = true;
}

// ---------- auth ----------
async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role, display_name, sector, team')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function boot() {
  // 1. bootstrap dos dados do site (não bloqueia o login)
  bootstrap();

  // 2. checar sessão
  const { data: sess } = await supabase.auth.getSession();
  if (!sess?.session) {
    setBodyState('login');
    return;
  }
  await loadUser(sess.session.user);
}

async function loadUser(user) {
  state.user = user;
  try {
    const profile = await fetchProfile(user.id);
    if (!profile) {
      throw new Error('Seu usuário ainda não tem perfil. Peça pro admin.');
    }
    if (profile.role === 'pending') {
      throw new Error('Seu acesso ainda está pendente. Aguarde aprovação do admin.');
    }
    state.role = profile.role;
    state.sector = profile.sector || null;
    state.team = profile.team || null;
    state.displayName = profile.display_name || user.email;
  } catch (e) {
    await supabase.auth.signOut();
    setBodyState('login');
    showError($('#loginError'), e.message || String(e));
    return;
  }
  enterApp();
}

function enterApp() {
  // popula sidebar
  $('#currentUserEmail').textContent = state.user.email;
  $('#currentUserRole').textContent = describeProfile({
    role: state.role, sector: state.sector, team: state.team,
  });

  // mostra "Membros" só pra admin
  for (const el of $$('[data-admin-only]')) {
    el.hidden = state.role !== 'admin';
  }

  setBodyState('app');
  if (!location.hash) location.hash = '#/visao-geral';
  route();
}

// ---------- routing ----------
function route() {
  const hash = location.hash.replace(/^#/, '') || '/visao-geral';
  const parts = hash.split('/').filter(Boolean);

  // marca link ativo na sidebar
  for (const a of $$('#sidebarNav a')) {
    const target = a.getAttribute('href').replace(/^#/, '').split('/').filter(Boolean);
    a.classList.toggle('is-active', target[0] === parts[0]);
  }

  const main = $('#adminMain');
  main.innerHTML = '';

  const ctx = {
    root: main,
    state,
    api: {
      supabase, getData, getScope, patchEdit, setOrder, publish, onChange,
      SCOPES,
      navigate: (h) => { location.hash = h; },
      markDirty: (scope) => { state.dirty.add(scope); },
      clearDirty: (scope) => { state.dirty.delete(scope); },
      canEditScope,
    },
  };

  try {
    switch (parts[0]) {
      case 'visao-geral': return renderOverview(ctx);
      case 'navbar':      return renderNavbar(ctx);
      case 'paginas':
        if (parts[1]) return renderPageEditor(ctx, parts[1]);
        return renderPages(ctx);
      case 'membros':
        if (state.role !== 'admin') {
          location.hash = '#/visao-geral'; return;
        }
        return renderMembers(ctx);
      default:
        location.hash = '#/visao-geral';
    }
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="empty-state">Erro ao carregar: ${escapeHtml(e?.message || String(e))}</div>`;
  }
}

function canEditScope(scope) {
  if (state.role === 'admin') return true;
  // só coordenador edita LPs por enquanto (member acessa features próprias, sem CMS)
  if (state.role !== 'coordinator' || !state.sector) return false;
  const sector = sectorByValue(state.sector);
  if (!sector) return false;
  return sector.lpScopes.includes(scope);
}

// ---------- login ----------
function setupLogin() {
  const form = $('#loginForm');
  const errBox = $('#loginError');
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    clearError(errBox);
    const fd = new FormData(form);
    const email = String(fd.get('email') || '').trim();
    const password = String(fd.get('password') || '');
    if (!email || !password) return;

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Entrando…';

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await loadUser(data.user);
    } catch (e) {
      showError(errBox, e?.message || 'Falha no login');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
}

function setupLogout() {
  $('#logoutBtn').addEventListener('click', async () => {
    if (state.dirty.size && !confirm('Você tem alterações não publicadas. Sair mesmo assim?')) return;
    await supabase.auth.signOut();
    location.hash = '';
    location.reload();
  });
}

function setupRouter() {
  window.addEventListener('hashchange', route);
}

// ---------- utils ----------
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ---------- start ----------
setupLogin();
setupLogout();
setupRouter();
boot();
