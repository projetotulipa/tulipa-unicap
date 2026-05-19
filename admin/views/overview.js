import { PAGES } from '../pages-meta.js';
import { describeProfile } from '../sectors.js';

export function renderOverview(ctx) {
  const { root, state, api } = ctx;

  const html = `
    <div class="view">
      <h1>Bem-vinde, ${escapeHtml(state.displayName || state.user.email)}</h1>
      <p class="view__lede">
        Você é <strong>${escapeHtml(describeProfile({
          role: state.role, sector: state.sector, team: state.team,
        }))}</strong>.
        Use a barra lateral para escolher o que editar.
      </p>

      <h2>Atalhos</h2>
      <div class="card-list">
        <a class="card-item" href="#/navbar">
          <span class="card-item__badge">global</span>
          <span class="card-item__title">Navbar &amp; rodapé</span>
          <span class="card-item__meta">Links do topo + colunas do footer</span>
        </a>
        <a class="card-item" href="#/paginas">
          <span class="card-item__badge">por LP</span>
          <span class="card-item__title">Páginas</span>
          <span class="card-item__meta">${PAGES.length} páginas editáveis</span>
        </a>
        ${state.role === 'admin' ? `
          <a class="card-item" href="#/membros">
            <span class="card-item__badge">admin</span>
            <span class="card-item__title">Membros</span>
            <span class="card-item__meta">Aprovar e atribuir cargos</span>
          </a>
        ` : ''}
      </div>

      <h2>Últimas publicações</h2>
      <div id="recentPublishes" class="empty-state">carregando…</div>
    </div>
  `;
  root.innerHTML = html;

  loadRecentPublishes(ctx);
}

async function loadRecentPublishes(ctx) {
  const { api } = ctx;
  const box = document.getElementById('recentPublishes');
  try {
    const { data, error } = await api.supabase
      .from('site_content')
      .select('scope, version, note, published_at')
      .order('published_at', { ascending: false })
      .limit(10);
    if (error) throw error;
    if (!data?.length) {
      box.innerHTML = '<span>Nenhuma publicação ainda.</span>';
      return;
    }
    box.className = '';
    box.innerHTML = `
      <table class="table">
        <thead><tr><th>Escopo</th><th>Quando</th><th>Nota</th></tr></thead>
        <tbody>
          ${data.map((row) => `
            <tr>
              <td><code>${escapeHtml(row.scope)}</code></td>
              <td>${formatDate(row.published_at)}</td>
              <td class="muted">${escapeHtml(row.note || '—')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    box.innerHTML = `<span class="muted">Não foi possível carregar (${escapeHtml(e.message)})</span>`;
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
