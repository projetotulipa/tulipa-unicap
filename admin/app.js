// TULIPA · admin · entry point
import { supabase } from '../js/supabase.js';
import { SCOPES } from '../js/config.js';
import { SECTORS, ROLES, sectorByValue, describeProfile } from './sectors.js';
import { icon } from './icons.js';
import {
  getData, getScope, patchEdit, setOrder, setBlockOrder, getBlockOrder,
  bootstrap, publish, onChange,
} from '../js/site-data.js';

import { renderPages }      from './views/pages.js';
import { renderPageEditor } from './views/page-editor.js';
import { renderMembers }    from './views/members.js';
import { renderAttendanceDashboard } from './views/attendance.js';
import { renderAttendanceGroups }    from './views/attendance-groups.js';
import { renderAttendancePeople }    from './views/attendance-people.js';
import { renderAttendanceGroupDetail } from './views/attendance-group.js';
import { renderAttendanceMeeting }   from './views/attendance-meeting.js';
import { renderAttendanceSemesters } from './views/attendance-semesters.js';
import { renderFinanceDashboard }    from './views/finance.js';
import { renderFinancePayments }     from './views/finance-payments.js';
import { renderFinanceExpenses }     from './views/finance-expenses.js';
import { renderFinancePlans }        from './views/finance-plans.js';
import { renderResearchDashboard }   from './views/research.js';
import { renderResearchNotes }       from './views/research-notes.js';
import { renderResearchPosts }       from './views/research-posts.js';
import { renderResearchTeams }       from './views/research-teams.js';
import { renderMediaDashboard }      from './views/media.js';
import { renderMediaPosts }          from './views/media-posts.js';
import { renderMediaTeams }          from './views/media-teams.js';
import { renderMediaTasks }          from './views/media-tasks.js';
import { renderMediaCalendar }       from './views/media-calendar.js';

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
  // mostra "Presença" pra admin OR setor secretaria
  for (const el of $$('[data-secretaria-only]')) {
    el.hidden = !canManageAttendance();
  }
  // mostra "Tesouraria" pra admin OR setor tesouraria
  for (const el of $$('[data-tesouraria-only]')) {
    el.hidden = !canManageFinance();
  }
  // mostra "Pesquisa" pra admin OR setor pesquisa
  for (const el of $$('[data-pesquisa-only]')) {
    el.hidden = !canManageResearch();
  }
  // mostra "Artes & Mídias" pra admin OR setor midia
  for (const el of $$('[data-midia-only]')) {
    el.hidden = !canManageMedia();
  }

  setBodyState('app');
  if (!location.hash || location.hash === '#/' || location.hash === '#/visao-geral' || location.hash === '#/navbar') {
    location.hash = '#/paginas';
  }
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
      supabase, getData, getScope, patchEdit, setOrder,
      setBlockOrder, getBlockOrder,
      publish, onChange,
      SCOPES,
      navigate: (h) => { location.hash = h; },
      markDirty: (scope) => { state.dirty.add(scope); },
      clearDirty: (scope) => { state.dirty.delete(scope); },
      canEditScope,
      canManageAttendance,
      canManageFinance,
      canManageResearch,
      canManageMedia,
    },
  };

  try {
    switch (parts[0]) {
      case 'paginas':
        if (parts[1]) return renderPageEditor(ctx, parts[1]);
        return renderPages(ctx);
      case 'presenca':
        if (!canManageAttendance()) { location.hash = '#/paginas'; return; }
        if (parts[1] === 'grupos' && parts[2]) return renderAttendanceGroupDetail(ctx, parts[2]);
        if (parts[1] === 'grupos')             return renderAttendanceGroups(ctx);
        if (parts[1] === 'pessoas')            return renderAttendancePeople(ctx);
        if (parts[1] === 'semestres')          return renderAttendanceSemesters(ctx);
        if (parts[1] === 'encontros' && parts[2]) return renderAttendanceMeeting(ctx, parts[2]);
        return renderAttendanceDashboard(ctx);
      case 'financeiro':
        if (!canManageFinance()) { location.hash = '#/paginas'; return; }
        if (parts[1] === 'mensalidades') return renderFinancePayments(ctx);
        if (parts[1] === 'gastos')       return renderFinanceExpenses(ctx);
        if (parts[1] === 'planejamento') return renderFinancePlans(ctx);
        return renderFinanceDashboard(ctx);
      case 'pesquisa':
        if (!canManageResearch()) { location.hash = '#/paginas'; return; }
        if (parts[1] === 'fichamentos') return renderResearchNotes(ctx);
        if (parts[1] === 'posts')       return renderResearchPosts(ctx);
        if (parts[1] === 'equipes')     return renderResearchTeams(ctx);
        return renderResearchDashboard(ctx);
      case 'midia':
        if (!canManageMedia()) { location.hash = '#/paginas'; return; }
        if (parts[1] === 'posts')       return renderMediaPosts(ctx);
        if (parts[1] === 'equipes')     return renderMediaTeams(ctx);
        if (parts[1] === 'tarefas')     return renderMediaTasks(ctx);
        if (parts[1] === 'calendario')  return renderMediaCalendar(ctx);
        return renderMediaDashboard(ctx);
      case 'membros':
        if (state.role !== 'admin') {
          location.hash = '#/paginas'; return;
        }
        return renderMembers(ctx);
      default:
        location.hash = '#/paginas';
    }
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="empty-state">Erro ao carregar: ${escapeHtml(e?.message || String(e))}</div>`;
  }
}

function canManageAttendance() {
  if (state.role === 'admin') return true;
  return state.sector === 'secretaria';
}

function canManageFinance() {
  if (state.role === 'admin') return true;
  return state.sector === 'tesouraria';
}

function canManageResearch() {
  if (state.role === 'admin') return true;
  return state.sector === 'pesquisa';
}

function canManageMedia() {
  if (state.role === 'admin') return true;
  return state.sector === 'midia';
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
function paintStaticIcons() {
  const loginBrand = document.getElementById('loginBrand');
  if (loginBrand) loginBrand.innerHTML = icon('brand', { size: 44 });
  const sidebarBrand = document.getElementById('sidebarBrand');
  if (sidebarBrand) sidebarBrand.innerHTML = icon('brand', { size: 32 });
  for (const el of document.querySelectorAll('[data-icon]')) {
    el.innerHTML = icon(el.dataset.icon, { size: 18 });
  }
}

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
paintStaticIcons();
setupLogin();
setupLogout();
setupRouter();
boot();
