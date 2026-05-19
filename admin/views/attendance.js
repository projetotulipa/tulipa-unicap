// Dashboard de presença — atalhos + alertas do mês corrente.

import { icon } from '../icons.js';
import * as data from '../attendance/data.js';
import { calcMonthlyStatus, STATUS_COLORS, severityOf, currentMonthRange, monthLabel } from '../attendance/status.js';

export async function renderAttendanceDashboard(ctx) {
  const { root } = ctx;
  const { year, month, from, to } = currentMonthRange();

  root.innerHTML = `
    <div class="view">
      <header class="view__header">
        <h1>Presença · ${escapeHtml(monthLabel(year, month))}</h1>
        <p class="view__lede">Acompanhe quem está em dia e quem precisa de atenção. Para registrar uma presença, abra um grupo e escolha o encontro.</p>
      </header>

      <div class="att-shortcuts">
        <a class="att-shortcut" href="#/presenca/grupos">
          <span class="att-shortcut__icon">${icon('group', { size: 22 })}</span>
          <div>
            <strong>Grupos</strong>
            <span id="dashGroupCount" class="muted">carregando…</span>
          </div>
        </a>
        <a class="att-shortcut" href="#/presenca/pessoas">
          <span class="att-shortcut__icon">${icon('users', { size: 22 })}</span>
          <div>
            <strong>Pessoas</strong>
            <span id="dashPeopleCount" class="muted">carregando…</span>
          </div>
        </a>
        <a class="att-shortcut" href="#/presenca/grupos">
          <span class="att-shortcut__icon">${icon('attendance', { size: 22 })}</span>
          <div>
            <strong>Marcar presença</strong>
            <span class="muted">abre um grupo</span>
          </div>
        </a>
      </div>

      <h2 style="margin-top:32px;">Alertas do mês</h2>
      <p class="view__lede">Pessoas em laranja ou vermelho — atenção prioritária aos vínculos primários.</p>

      <div id="alertsList" class="empty-state">analisando o mês…</div>
    </div>
  `;

  // counts
  Promise.all([data.listGroups(), data.listPeople()]).then(([g, p]) => {
    document.getElementById('dashGroupCount').textContent =
      g.data ? `${g.data.length} ativo${g.data.length === 1 ? '' : 's'}` : '—';
    document.getElementById('dashPeopleCount').textContent =
      p.data ? `${p.data.length} cadastrada${p.data.length === 1 ? '' : 's'}` : '—';
  });

  await loadAlerts({ from, to });
}

async function loadAlerts({ from, to }) {
  const box = document.getElementById('alertsList');

  const { data: groups, error: gErr } = await data.listGroups();
  if (gErr) {
    box.innerHTML = `<p class="muted">Não foi possível carregar (${escapeHtml(gErr.message)}).</p>`;
    return;
  }

  if (!groups?.length) {
    box.innerHTML = `<p class="muted">Nenhum grupo cadastrado ainda. <a href="#/presenca/grupos">Crie o primeiro</a>.</p>`;
    return;
  }

  // Pra cada grupo, busca meetings+attendance e calcula status por pessoa
  const alerts = []; // { person, group, isPrimary, status }

  await Promise.all(groups.map(async (g) => {
    const [meetingsRes, membersRes] = await Promise.all([
      data.listAttendanceByGroupInRange(g.id, from, to),
      data.listMembershipsOfGroup(g.id),
    ]);
    const meetings = meetingsRes.data || [];
    const members = membersRes.data || [];

    for (const m of members) {
      const status = calcMonthlyStatus(meetings, m.person_id, {
        isWeekly: g.schedule_kind === 'weekly',
      });
      if (status.color === 'orange' || status.color === 'red') {
        alerts.push({
          person: m.person,
          group: g,
          isPrimary: m.is_primary,
          status,
        });
      }
    }
  }));

  alerts.sort((a, b) => {
    // prioridade primária + severidade
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return severityOf(b.status.color) - severityOf(a.status.color);
  });

  if (alerts.length === 0) {
    box.className = '';
    box.innerHTML = `
      <div class="att-empty-state att-empty-state--ok">
        <span class="att-empty-state__icon">${icon('check-circle', { size: 32 })}</span>
        <p>Tudo em ordem este mês. Ninguém em laranja ou vermelho.</p>
      </div>
    `;
    return;
  }

  box.className = '';
  box.innerHTML = `
    <ul class="att-alerts">
      ${alerts.map(alertRow).join('')}
    </ul>
  `;
}

function alertRow(a) {
  const { person, group, isPrimary, status } = a;
  const colorMeta = STATUS_COLORS[status.color];
  const detail = `${status.absences} falta${status.absences === 1 ? '' : 's'}` +
    (status.maxConsecutive > 1 ? ` · ${status.maxConsecutive} consecutivas` : '');
  return `
    <li class="att-alert att-alert--${status.color}">
      <span class="att-dot att-dot--${status.color}" title="${escapeHtml(colorMeta.label)}"></span>
      <div class="att-alert__main">
        <strong>${escapeHtml(person?.full_name || '—')}</strong>
        <span class="muted">${escapeHtml(group.name)}${isPrimary ? ' · prioritário' : ''}</span>
      </div>
      <span class="att-alert__detail">${escapeHtml(detail)}</span>
      <a class="btn btn--ghost btn--small" href="#/presenca/grupos/${escapeAttr(group.id)}">abrir grupo</a>
    </li>
  `;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
