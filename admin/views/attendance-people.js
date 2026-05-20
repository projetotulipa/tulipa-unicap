// Pessoas — Sprint 5 (cartas editoriais + lista densa + drawer rico com skyline individual).

import { icon } from '../icons.js';
import * as data from '../attendance/data.js';
import { renderSubNav } from './attendance-nav.js';
import { codexSeal, codexPage } from '../attendance/codex.js';
import { categoryLabel } from '../attendance/categories.js';
import { toastSuccess, toastError } from '../toast.js';
import { whatsappUrl, formatPhone } from '../phone.js';

const viewState = {
  search: '',
  groupId: '',
  active: 'active', // active | inactive | all
  sort: 'name',     // name | primary | recent
  layout: 'grid',   // grid | list
};

let cached = null; // { rows, groups }

export async function renderAttendancePeople(ctx) {
  const { root, state } = ctx;
  const isAdmin = state.role === 'admin';

  root.innerHTML = `
    <div class="view">
      ${renderSubNav('pessoas', { isAdmin })}

      <header class="att-hero-v2">
        <div class="att-hero-v2__seal-wrap">
          <span class="att-codex-seal">${codexSeal({ size: 32 })}</span>
        </div>
        <div class="att-hero-v2__inner">
          <p class="att-hero-v2__eyebrow">comparências · quem participa</p>
          <h1>Pessoas</h1>
          <p class="att-hero-v2__lede">
            Clique numa pessoa pra ver seu histórico de comparência, grupos e anotações. A estrela marca o vínculo prioritário.
          </p>
        </div>
        <div class="att-hero-v2__cta">
          <button id="newPersonBtn" class="btn btn--primary">
            ${icon('user-plus', { size: 14 })}<span style="margin-left:6px;">Nova pessoa</span>
          </button>
        </div>
        <div class="att-hero-v2__page">${codexPage({ size: 200 })}</div>
      </header>

      <div id="peopleToolbar"></div>

      <div id="peopleList">
        <div class="att-loading-wrap">
          <span class="att-bloom"><span class="att-codex-seal">${codexSeal({ size: 24 })}</span></span>
          <p>Reunindo nomes…</p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('newPersonBtn').addEventListener('click', () => openPersonForm(ctx));

  await loadAll(ctx);
}

async function loadAll(ctx) {
  const [{ data: people, error }, { data: groups }] = await Promise.all([
    data.listPeople({ includeInactive: true }),
    data.listGroups({ includeArchived: true }),
  ]);

  if (error) {
    document.getElementById('peopleList').innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`;
    return;
  }
  if (!people?.length) {
    document.getElementById('peopleToolbar').innerHTML = '';
    document.getElementById('peopleList').innerHTML = `
      <div class="att-empty-v2 att-empty-v2--rose">
        <div class="att-empty-v2__art">${icon('user-plus', { size: 56 })}</div>
        <h3>Nenhuma pessoa cadastrada</h3>
        <p>Adicione quem participa dos grupos pra abrir o livro de comparências.</p>
        <button class="btn btn--primary" id="emptyNewPersonBtn">${icon('user-plus', { size: 14 })}<span style="margin-left:6px;">Cadastrar primeira pessoa</span></button>
      </div>
    `;
    document.getElementById('emptyNewPersonBtn').addEventListener('click', () => openPersonForm(ctx));
    return;
  }

  const memberships = await Promise.all(people.map((p) => data.listMembershipsOfPerson(p.id)));
  const rows = people.map((p, idx) => ({ person: p, memberships: memberships[idx].data || [] }));
  cached = { rows, groups: groups || [], ctx };

  renderToolbar(ctx);
  renderList(ctx);
}

function renderToolbar(ctx) {
  const counts = countsBy(cached.rows);
  const groupOpts = cached.groups.map((g) => `<option value="${escapeAttr(g.id)}" ${viewState.groupId === g.id ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('');

  document.getElementById('peopleToolbar').innerHTML = `
    <div class="att-toolbar">
      <div class="att-toolbar__group">
        <input type="text" id="personSearch" placeholder="Buscar por nome, e-mail ou telefone…" value="${escapeAttr(viewState.search)}" />
      </div>
      <div class="att-toolbar__group">
        ${chip('active', 'ativas', counts.active)}
        ${chip('inactive', 'inativas', counts.inactive)}
        ${chip('all', 'todas', counts.all)}
      </div>
      <span class="att-toolbar__sep"></span>
      <div class="att-toolbar__group">
        <span class="att-toolbar__label">grupo</span>
        <select id="groupFilter">
          <option value="">todos</option>
          ${groupOpts}
        </select>
      </div>
      <span class="att-toolbar__spacer"></span>
      <div class="att-toolbar__group">
        <span class="att-toolbar__label">ordenar</span>
        <select id="personSort">
          <option value="name" ${viewState.sort === 'name' ? 'selected' : ''}>nome</option>
          <option value="primary" ${viewState.sort === 'primary' ? 'selected' : ''}>com primário antes</option>
          <option value="recent" ${viewState.sort === 'recent' ? 'selected' : ''}>cadastro recente</option>
        </select>
      </div>
      <div class="att-view-toggle">
        <button data-layout="grid" class="${viewState.layout === 'grid' ? 'is-active' : ''}" aria-label="Visão em cartas">
          ${icon('users', { size: 14 })}<span style="margin-left:4px;">cartas</span>
        </button>
        <button data-layout="list" class="${viewState.layout === 'list' ? 'is-active' : ''}" aria-label="Visão em lista">
          ${icon('drag', { size: 14 })}<span style="margin-left:4px;">lista</span>
        </button>
      </div>
    </div>
  `;

  document.getElementById('personSearch').addEventListener('input', (e) => {
    viewState.search = e.target.value;
    renderList(ctx);
  });
  document.getElementById('groupFilter').addEventListener('change', (e) => {
    viewState.groupId = e.target.value;
    renderList(ctx);
  });
  document.getElementById('personSort').addEventListener('change', (e) => {
    viewState.sort = e.target.value;
    renderList(ctx);
  });
  document.querySelectorAll('.att-toolbar [data-chip]').forEach((el) => {
    el.addEventListener('click', () => {
      viewState.active = el.dataset.chip;
      renderToolbar(ctx);
      renderList(ctx);
    });
  });
  document.querySelectorAll('.att-view-toggle button').forEach((btn) => {
    btn.addEventListener('click', () => {
      viewState.layout = btn.dataset.layout;
      renderToolbar(ctx);
      renderList(ctx);
    });
  });
}

function chip(key, label, count) {
  const active = viewState.active === key ? ' is-active' : '';
  return `<button class="att-chip${active}" data-chip="${key}">
    <span>${escapeHtml(label)}</span>
    <span class="att-chip__count">${count}</span>
  </button>`;
}

function countsBy(rows) {
  const c = { all: rows.length, active: 0, inactive: 0 };
  for (const r of rows) {
    if (r.person.is_active) c.active++;
    else c.inactive++;
  }
  return c;
}

function renderList(ctx) {
  const all = cached.rows;
  const q = viewState.search.toLowerCase().trim();
  let filtered = all.filter((r) => {
    if (viewState.active === 'active' && !r.person.is_active) return false;
    if (viewState.active === 'inactive' && r.person.is_active) return false;
    if (viewState.groupId) {
      const ids = r.memberships.map((m) => m.group_id);
      if (!ids.includes(viewState.groupId)) return false;
    }
    if (q) {
      const name = (r.person.full_name || '').toLowerCase();
      const email = (r.person.email || '').toLowerCase();
      const phone = (r.person.phone || '').toLowerCase();
      if (!name.includes(q) && !email.includes(q) && !phone.includes(q)) return false;
    }
    return true;
  });

  filtered.sort(sorter(viewState.sort));

  const box = document.getElementById('peopleList');
  if (filtered.length === 0) {
    box.innerHTML = `<div class="att-no-results">
      <span>Nada por aqui</span>
      <p>nenhuma pessoa corresponde aos filtros atuais.</p>
    </div>`;
    return;
  }

  if (viewState.layout === 'grid') {
    box.innerHTML = `<div class="att-person-letter-grid">${filtered.map(personLetter).join('')}</div>`;
  } else {
    box.innerHTML = `<div class="att-person-dense-list">${filtered.map(personDense).join('')}</div>`;
  }

  wireRows(ctx);
}

function sorter(key) {
  switch (key) {
    case 'primary': return (a, b) => {
      const ap = a.memberships.some((m) => m.is_primary) ? 0 : 1;
      const bp = b.memberships.some((m) => m.is_primary) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return (a.person.full_name || '').localeCompare(b.person.full_name || '', 'pt-BR');
    };
    case 'recent': return (a, b) => {
      // sem created_at: cai pra ordem reversa de nome (não ideal mas funcional)
      return (b.person.created_at || '').localeCompare(a.person.created_at || '');
    };
    case 'name':
    default: return (a, b) => (a.person.full_name || '').localeCompare(b.person.full_name || '', 'pt-BR');
  }
}

function personLetter({ person, memberships }) {
  const primary = memberships.find((m) => m.is_primary);
  const others = memberships.filter((m) => !m.is_primary);
  const phoneLink = whatsappUrl(person.phone);
  const phoneText = formatPhone(person.phone);
  const monogram = monogramOf(person.full_name);

  return `
    <article class="att-person-letter ${person.is_active ? '' : 'is-inactive'}"
             data-person-id="${escapeAttr(person.id)}"
             data-name="${escapeAttr(person.full_name || '')}">
      <div class="att-person-letter__head">
        <span class="att-person-letter__mono" aria-hidden="true">${escapeHtml(monogram)}</span>
        <div class="att-person-letter__title">
          <div class="att-person-letter__name">
            <strong>${escapeHtml(person.full_name || '—')}</strong>
            ${primary ? `<span class="att-person-letter__primary-star" title="Vínculo prioritário">${icon('star', { size: 12 })}</span>` : ''}
            ${person.is_exempt ? `<span class="att-pill-v2 att-pill-v2--gold">isenta</span>` : ''}
            ${!person.is_active ? `<span class="att-pill-v2">inativa</span>` : ''}
          </div>
          ${primary ? `<span class="att-person-letter__primary-group">${escapeHtml(primary.group?.name || '—')}</span>` : '<span class="att-person-letter__primary-group" style="color: var(--text-mute);">sem vínculo primário</span>'}
        </div>
      </div>

      <div class="att-person-letter__contacts">
        ${phoneLink ? `
          <a class="att-person-letter__contact att-person-letter__contact--wa" href="${escapeAttr(phoneLink)}" target="_blank" rel="noopener" title="Abrir no WhatsApp" onclick="event.stopPropagation()">
            ${icon('whatsapp', { size: 13 })}<span>${escapeHtml(phoneText)}</span>
          </a>
        ` : '<span class="muted" style="font-size: 12px;">sem telefone</span>'}
        ${person.email ? `
          <a class="att-person-letter__contact" href="mailto:${escapeAttr(person.email)}" title="${escapeAttr(person.email)}" onclick="event.stopPropagation()">
            ${icon('contato', { size: 12 })}<span>${escapeHtml(truncate(person.email, 24))}</span>
          </a>
        ` : ''}
      </div>

      ${others.length > 0 ? `
        <div class="att-person-letter__chips">
          ${others.slice(0, 4).map((m) => `<span class="att-pill-v2 att-pill-v2--sage">${escapeHtml(m.group?.name || '—')}</span>`).join('')}
          ${others.length > 4 ? `<span class="att-pill-v2">+${others.length - 4}</span>` : ''}
        </div>
      ` : ''}

      <div class="att-person-letter__foot">
        ${memberships.length} ${memberships.length === 1 ? 'vínculo' : 'vínculos'}
        ${person.custom_dues != null ? ` · valor próprio R$ ${person.custom_dues}` : ''}
      </div>

      <div class="att-person-letter__menu">
        <button class="icon-btn icon-btn--xs" data-action="edit" title="Editar" aria-label="Editar">${icon('edit', { size: 12 })}</button>
        <button class="icon-btn icon-btn--xs" data-action="delete" title="Excluir/desativar" aria-label="Excluir ou desativar">${icon('trash', { size: 12 })}</button>
      </div>
    </article>
  `;
}

function personDense({ person, memberships }) {
  const primary = memberships.find((m) => m.is_primary);
  const others = memberships.filter((m) => !m.is_primary);
  const phoneLink = whatsappUrl(person.phone);
  const phoneText = formatPhone(person.phone);
  const monogram = monogramOf(person.full_name);

  return `
    <div class="att-person-dense-row ${person.is_active ? '' : 'is-inactive'}"
         data-person-id="${escapeAttr(person.id)}"
         data-name="${escapeAttr(person.full_name || '')}">
      <span class="att-person-dense-row__mono" aria-hidden="true">${escapeHtml(monogram)}</span>
      <div class="att-person-dense-row__main">
        <strong>${escapeHtml(person.full_name || '—')}${person.is_exempt ? ' · isenta' : ''}</strong>
        ${primary ? `<span>${icon('star', { size: 10 })}<span style="margin-left:4px;">${escapeHtml(primary.group?.name || '—')}</span></span>` : '<span class="muted" style="color: var(--text-mute);">sem vínculo primário</span>'}
      </div>
      <div class="att-person-dense-row__contact">
        ${phoneLink ? `<a class="is-wa" href="${escapeAttr(phoneLink)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${icon('whatsapp', { size: 12 })}<span>${escapeHtml(phoneText)}</span></a>` : ''}
        ${person.email ? `<a href="mailto:${escapeAttr(person.email)}" onclick="event.stopPropagation()">${icon('contato', { size: 11 })}<span>${escapeHtml(truncate(person.email, 24))}</span></a>` : ''}
      </div>
      <div class="att-person-dense-row__groups">
        ${others.length > 0
          ? others.slice(0, 3).map((m) => `<span class="att-pill-v2 att-pill-v2--sage">${escapeHtml(truncate(m.group?.name || '—', 16))}</span>`).join('')
            + (others.length > 3 ? `<span class="att-pill-v2">+${others.length - 3}</span>` : '')
          : '<span class="muted" style="font-size: 11px;">só primário</span>'}
      </div>
      <span class="att-person-dense-row__chevron">${icon('chevron', { size: 14 })}</span>
    </div>
  `;
}

function wireRows(ctx) {
  document.querySelectorAll('[data-person-id]').forEach((row) => {
    const id = row.dataset.personId;
    row.querySelector('[data-action="edit"]')?.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      const { data: full } = await data.getPerson(id);
      if (full) openPersonForm(ctx, full);
    });
    row.querySelector('[data-action="delete"]')?.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      const name = row.dataset.name;
      const choice = confirm(`Excluir "${name}" definitivamente?\n\nCancelar = apenas desativar (mantém histórico).\nOK = apagar tudo (sem desfazer).`);
      if (choice) {
        const { error } = await data.deletePerson(id);
        if (error) { toastError(error.message); return; }
        toastSuccess('Pessoa excluída.');
      } else {
        const { error } = await data.deactivatePerson(id);
        if (error) { toastError(error.message); return; }
        toastSuccess('Pessoa marcada como inativa.');
      }
      await loadAll(ctx);
    });
    row.addEventListener('click', async (ev) => {
      if (ev.target.closest('button, a')) return;
      const { data: full } = await data.getPerson(id);
      if (full) openPersonForm(ctx, full);
    });
  });
}

// ============================================================
// Drawer rico de pessoa (bio + grupos + skyline + anotações)
// ============================================================

function openPersonForm(ctx, existing = null) {
  document.querySelectorAll('.block-drawer-overlay').forEach((el) => el.remove());

  const isEdit = !!existing;
  const overlay = document.createElement('div');
  overlay.className = 'block-drawer-overlay';
  overlay.innerHTML = `
    <div class="block-drawer">
      <header class="block-drawer__head">
        <div>
          <p class="block-drawer__crumb">${isEdit ? 'Editando pessoa' : 'Nova pessoa'}</p>
          <h2><span class="block-drawer__icon">${icon('user-plus', { size: 26 })}</span> ${isEdit ? escapeHtml(existing.full_name) : 'Cadastro'}</h2>
        </div>
        <button class="icon-btn" data-action="close" aria-label="Fechar">${icon('x', { size: 16 })}</button>
      </header>
      <div class="block-drawer__body">
        ${isEdit ? `
          <div class="att-person-bio">
            <span class="att-person-bio__mono" aria-hidden="true">${escapeHtml(monogramOf(existing.full_name))}</span>
            <div class="att-person-bio__main">
              <strong>${escapeHtml(existing.full_name)}</strong>
              <span>${existing.is_active ? 'ativa' : 'inativa'}${existing.is_exempt ? ' · isenta de mensalidade' : ''}${existing.custom_dues != null ? ` · valor próprio R$ ${existing.custom_dues}` : ''}</span>
            </div>
          </div>

          <div id="personGroupsBlock"></div>
          <div id="personSparkBlock"></div>
        ` : ''}

        <form id="personForm">
          <label class="drawer-field">
            <span class="drawer-field__label">Nome completo</span>
            <input type="text" name="full_name" class="drawer-field__input" required value="${escapeAttr(existing?.full_name || '')}" placeholder="Como aparecerá na lista" />
          </label>
          <div style="display:flex; gap:12px; flex-wrap:wrap;">
            <label class="drawer-field" style="flex:1; min-width:200px;">
              <span class="drawer-field__label">Telefone (WhatsApp)</span>
              <input type="tel" name="phone" class="drawer-field__input" value="${escapeAttr(existing?.phone || '')}" placeholder="(81) 99999-9999" />
              <p class="drawer-field__hint">Vira link clicável que abre o WhatsApp. Aceita com ou sem DDI.</p>
            </label>
            <label class="drawer-field" style="flex:1; min-width:200px;">
              <span class="drawer-field__label">E-mail (opcional)</span>
              <input type="email" name="email" class="drawer-field__input" value="${escapeAttr(existing?.email || '')}" placeholder="para contato" />
            </label>
          </div>
          ${isEdit ? `
            <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:6px;">
              <label class="drawer-field" style="flex:1; min-width: 160px;">
                <span class="drawer-field__label">Estado</span>
                <select name="is_active" class="drawer-field__input">
                  <option value="true"  ${existing.is_active ? 'selected' : ''}>Ativa</option>
                  <option value="false" ${!existing.is_active ? 'selected' : ''}>Inativa (saiu)</option>
                </select>
              </label>
              <label class="drawer-field" style="flex:1; min-width: 160px;">
                <span class="drawer-field__label">Mensalidade</span>
                <select name="is_exempt" class="drawer-field__input">
                  <option value="false" ${!existing.is_exempt ? 'selected' : ''}>Paga normalmente</option>
                  <option value="true"  ${existing.is_exempt ? 'selected' : ''}>Isenta (não paga)</option>
                </select>
              </label>
            </div>
            <label class="drawer-field">
              <span class="drawer-field__label">Valor mensal individual (opcional)</span>
              <input type="number" step="0.01" min="0" name="custom_dues" class="drawer-field__input"
                     value="${existing.custom_dues != null ? existing.custom_dues : ''}"
                     placeholder="usa o valor padrão do mês se vazio" />
            </label>
          ` : ''}
        </form>

        ${isEdit ? `
          <hr style="margin: 22px 0; border: none; border-top: 1px solid var(--border);">
          <div class="person-notes">
            <h3 class="person-notes__head">
              ${icon('attendance', { size: 16 })}<span style="margin-left:8px;">Anotações</span>
            </h3>
            <form id="personNoteForm" class="person-notes__form">
              <textarea name="note" class="drawer-field__input" rows="2" placeholder="Adicionar nova anotação… (Ctrl+Enter pra salvar)"></textarea>
              <button class="btn btn--primary btn--small" type="submit">${icon('plus', { size: 14 })}<span style="margin-left:6px;">Adicionar</span></button>
            </form>
            <div id="personNotesList" class="person-notes__list">
              <p class="muted" style="font-size:13px;">carregando…</p>
            </div>
          </div>
        ` : ''}
      </div>
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

  const form = overlay.querySelector('#personForm');
  form?.addEventListener('submit', (e) => e.preventDefault());

  function close() {
    overlay.classList.remove('is-open');
    setTimeout(() => overlay.remove(), 220);
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
    if ((e.key === 's' || e.key === 'S') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      doSave();
    }
  }
  document.addEventListener('keydown', onKey);

  async function doSave() {
    const fd = new FormData(form);
    const fields = {
      full_name: String(fd.get('full_name') || '').trim(),
      email: String(fd.get('email') || '').trim() || null,
      phone: String(fd.get('phone') || '').trim() || null,
    };
    if (isEdit) {
      fields.is_active = fd.get('is_active') === 'true';
      fields.is_exempt = fd.get('is_exempt') === 'true';
      const cd = String(fd.get('custom_dues') || '').trim();
      fields.custom_dues = cd ? Number(cd) : null;
    }
    if (!fields.full_name) { toastError('Nome é obrigatório.'); return; }
    const { error } = isEdit ? await data.updatePerson(existing.id, fields) : await data.createPerson(fields);
    if (error) { toastError(error.message); return; }
    toastSuccess(isEdit ? 'Pessoa atualizada.' : 'Pessoa cadastrada.');
    close();
    await loadAll(ctx);
  }

  overlay.addEventListener('click', async (ev) => {
    if (ev.target === overlay) { close(); return; }
    const action = ev.target.closest('[data-action]')?.dataset?.action;
    if (action === 'close') return close();

    if (action === 'delete') {
      const choice = confirm(`Excluir "${existing.full_name}" definitivamente?\n\nCancelar = apenas desativar (mantém histórico).\nOK = apagar tudo (sem desfazer).`);
      if (choice) {
        const { error } = await data.deletePerson(existing.id);
        if (error) { toastError(error.message); return; }
        toastSuccess('Pessoa excluída.');
      } else {
        const { error } = await data.deactivatePerson(existing.id);
        if (error) { toastError(error.message); return; }
        toastSuccess('Pessoa marcada como inativa.');
      }
      close();
      await loadAll(ctx);
      return;
    }

    if (action === 'save') await doSave();
  });

  if (isEdit) {
    loadGroupsBlock(existing);
    loadSparkBlock(existing);
    loadNotes(overlay, existing);
    setupNoteForm(overlay, existing);
  }
}

async function loadGroupsBlock(existing) {
  const slot = document.getElementById('personGroupsBlock');
  if (!slot) return;
  const { data: rows } = await data.listMembershipsOfPerson(existing.id);
  const memberships = rows || [];
  if (memberships.length === 0) {
    slot.innerHTML = `<p class="muted" style="font-size: 13px; margin: 8px 0 18px;">Sem vínculos. Adicione pelo detalhe de cada grupo.</p>`;
    return;
  }
  const primary = memberships.filter((m) => m.is_primary);
  const others = memberships.filter((m) => !m.is_primary);
  slot.innerHTML = `
    <h3 style="margin: 4px 0 8px; font-family: 'Cormorant Garamond', serif; font-style: italic; font-weight: 500; font-size: 16px; color: var(--cream);">
      Vínculos ${memberships.length > 1 ? `<span class="att-section-v2__count">${memberships.length}</span>` : ''}
    </h3>
    <div class="att-person-groups-cards">
      ${[...primary, ...others].map((m) => groupMiniCard(m)).join('')}
    </div>
  `;
}

function groupMiniCard(m) {
  const g = m.group || {};
  const monogram = monogramOf(g.name || '·');
  return `
    <a class="att-person-group-card ${m.is_primary ? 'is-primary' : ''}" href="#/presenca/grupos/${escapeAttr(g.id)}">
      <span class="att-person-group-card__mono" aria-hidden="true">${escapeHtml(monogram)}</span>
      <div class="att-person-group-card__main">
        <strong>${escapeHtml(g.name || '—')}</strong>
        <span>${m.is_primary ? 'primário' : 'secundário'}</span>
      </div>
    </a>
  `;
}

async function loadSparkBlock(existing) {
  const slot = document.getElementById('personSparkBlock');
  if (!slot) return;
  // últimos ~90 dias
  const today = new Date();
  const from = isoDate(daysAgo(today, 90));
  const to = isoDate(today);
  const { data: rows, error } = await data.listAttendanceOfPerson(existing.id, { from, to });
  if (error) {
    slot.innerHTML = '';
    return;
  }
  const records = (rows || []).filter((r) => r.meeting && r.meeting.status !== 'cancelled');
  records.sort((a, b) => a.meeting.date.localeCompare(b.meeting.date));
  const last = records.slice(-24); // até 24 últimas comparências

  let happened = 0, present = 0, justified = 0;
  for (const r of last) {
    if (r.meeting.status !== 'happened') continue;
    happened++;
    if (r.is_present) present++;
    else if (r.justified) justified++;
  }
  const pct = happened > 0 ? Math.round(present / happened * 100) : null;
  const pctClass = pct === null ? 'gone'
    : pct >= 70 ? ''
    : pct >= 50 ? 'low'
    : 'bad';

  if (last.length === 0) {
    slot.innerHTML = `
      <div class="att-person-spark">
        <div class="att-person-spark__head">
          <h4>Comparências recentes</h4>
          <span class="att-person-spark__pct att-person-spark__pct--gone">—</span>
        </div>
        <div class="att-person-spark__empty">sem encontros nos últimos 90 dias</div>
      </div>
    `;
    return;
  }

  const cells = last.map((r) => {
    const d = new Date(r.meeting.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const gname = r.meeting.group?.name || '—';
    let cls = 'att-person-spark__cell--absent';
    let label = 'falta';
    if (r.meeting.status !== 'happened') {
      cls = 'att-person-spark__cell--cancelled';
      label = r.meeting.status;
    } else if (r.is_present) {
      cls = 'att-person-spark__cell--present';
      label = 'presente';
    } else if (r.justified) {
      cls = 'att-person-spark__cell--justified';
      label = 'justificada' + (r.justification_category ? ` (${categoryLabel(r.justification_category)})` : '');
    }
    return `<span class="att-person-spark__cell ${cls}" data-tooltip="${escapeAttr(`${d} · ${gname} · ${label}`)}"></span>`;
  }).join('');

  slot.innerHTML = `
    <div class="att-person-spark">
      <div class="att-person-spark__head">
        <h4>Comparências recentes <span class="muted" style="font-size: 11px; font-style: italic; margin-left: 4px;">últimos 90 dias · ${last.length}</span></h4>
        <span class="att-person-spark__pct att-person-spark__pct--${pctClass}">${pct === null ? '—' : pct + '%'}</span>
      </div>
      <div class="att-person-spark__bars">${cells}</div>
      <p class="muted" style="font-size: 11px; margin: 8px 0 0; font-style: italic;">
        ${present} presente${present === 1 ? '' : 's'} · ${justified} justificada${justified === 1 ? '' : 's'} · ${happened - present - justified} falta${(happened - present - justified) === 1 ? '' : 's'}
      </p>
    </div>
  `;
}

function setupNoteForm(overlay, existing) {
  const noteForm = overlay.querySelector('#personNoteForm');
  if (!noteForm) return;
  noteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ta = noteForm.querySelector('textarea');
    const body = ta.value.trim();
    if (!body) return;
    const { error } = await data.addPersonNote(existing.id, body);
    if (error) { toastError(error.message); return; }
    ta.value = '';
    toastSuccess('Anotação adicionada.');
    loadNotes(overlay, existing);
  });
  noteForm.querySelector('textarea').addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); noteForm.requestSubmit(); }
  });
}

async function loadNotes(overlay, existing) {
  const box = overlay.querySelector('#personNotesList');
  if (!box) return;
  const { data: notes, error } = await data.listPersonNotes(existing.id);
  if (error) { box.innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`; return; }
  if (!notes?.length) {
    box.innerHTML = '<p class="muted" style="font-size:13px;">Nenhuma anotação ainda. Use o campo acima.</p>';
    return;
  }
  box.innerHTML = notes.map(noteCard).join('');
  box.querySelectorAll('[data-action="delete-note"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Excluir esta anotação?')) return;
      const { error } = await data.deletePersonNote(btn.dataset.noteId);
      if (error) { toastError(error.message); return; }
      toastSuccess('Anotação excluída.');
      loadNotes(overlay, existing);
    });
  });
}

function noteCard(n) {
  const d = new Date(n.created_at);
  const when = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
               ' · ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `
    <article class="person-note">
      <div class="person-note__body">${escapeHtml(n.body).replace(/\n/g, '<br/>')}</div>
      <footer class="person-note__foot">
        <span class="muted">${escapeHtml(when)}</span>
        <button class="icon-btn icon-btn--xs" data-action="delete-note" data-note-id="${escapeAttr(n.id)}" title="Excluir" aria-label="Excluir anotação">${icon('trash', { size: 11 })}</button>
      </footer>
    </article>
  `;
}

function monogramOf(name) {
  if (!name) return '·';
  const cleaned = String(name).trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    return ((parts[0][0] || '') + (parts[parts.length - 1][0] || '')).toUpperCase();
  }
  return (cleaned[0] || '·').toUpperCase();
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function isoDate(d) { return d.toISOString().slice(0, 10); }
function daysAgo(base, n) {
  const x = new Date(base);
  x.setDate(x.getDate() - n);
  x.setHours(0, 0, 0, 0);
  return x;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
