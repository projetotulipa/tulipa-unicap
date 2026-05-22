// TULIPA · admin · Formulários — caixa de respostas (lista + resumo/gráficos).
import * as Forms from '../forms/data.js';
import { isStaticField, fieldCaps } from '../forms/field-types.js';
import { icon } from '../icons.js';
import { toastSuccess, toastError } from '../toast.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const ST = { new: 'Nova', reviewed: 'Vista', archived: 'Arquivada', spam: 'Spam' };
const CHOICE = new Set(['radio', 'select', 'yesno', 'checkboxes']);
const NUMERIC = new Set(['rating', 'scale', 'slider', 'number']);

export async function renderFormsResponses(ctx, formId) {
  const { root, api } = ctx;
  root.innerHTML = `<div class="empty-state">Carregando respostas…</div>`;

  const { data: form, error } = await Forms.getForm(formId);
  if (error || !form) { root.innerHTML = `<div class="empty-state">Formulário não encontrado.</div>`; return; }

  const dataFields = [];
  for (const p of (form.schema?.pages || [])) for (const f of (p.fields || [])) {
    if (!isStaticField(f.type) && f.type !== 'hidden') dataFields.push(f);
  }

  let filter = null;
  let mode = 'list';
  let responses = [];
  let searchQuery = '';

  root.innerHTML = `
    <div class="admin-head">
      <div>
        <button class="admin-link-btn" id="rBack">${icon('arrow-left', { size: 14 })} Formulários</button>
        <h1>Respostas · ${esc(form.title)}</h1>
        <p class="admin-sub" id="rStats">—</p>
      </div>
      <button class="btn btn--ghost btn--small" id="rExport">${icon('external', { size: 12 })} Exportar CSV</button>
    </div>
    <div class="r-modes">
      <button class="r-mode is-on" data-m="list">Lista</button>
      <button class="r-mode" data-m="summary">Resumo</button>
    </div>
    <div class="r-filters" id="rFilters">
      ${['', 'new', 'reviewed', 'archived', 'spam'].map((s) => `
        <button class="r-filter ${s === '' ? 'is-on' : ''}" data-f="${s}">${s === '' ? 'Todas' : ST[s]}</button>`).join('')}
      <div class="r-search">
        <input id="rSearch" type="search" class="adm-input" placeholder="buscar nome, e-mail ou conteúdo…" autocomplete="off" />
        <span class="r-search__count" id="rSearchCount" hidden></span>
      </div>
    </div>
    <div id="rBody"><div class="empty-state">Carregando…</div></div>
    <div class="r-drawer" id="rDrawer" hidden></div>
  `;

  root.querySelector('#rBack').onclick = () => api.navigate('#/forms');
  root.querySelector('#rExport').onclick = () => exportCsv();
  root.querySelectorAll('.r-filter').forEach((b) => {
    b.onclick = () => {
      root.querySelectorAll('.r-filter').forEach((x) => x.classList.remove('is-on'));
      b.classList.add('is-on');
      filter = b.dataset.f || null;
      load();
    };
  });
  root.querySelectorAll('.r-mode').forEach((b) => {
    b.onclick = () => {
      root.querySelectorAll('.r-mode').forEach((x) => x.classList.remove('is-on'));
      b.classList.add('is-on');
      mode = b.dataset.m;
      root.querySelector('#rFilters').hidden = mode === 'summary';
      load();
    };
  });

  // busca textual (debounced)
  const searchInput = root.querySelector('#rSearch');
  let searchTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = searchInput.value.trim();
      renderList();
    }, 180);
  });

  await refreshStats();
  await load();

  async function refreshStats() {
    const s = await Forms.responseStats(formId);
    root.querySelector('#rStats').textContent =
      `${s.total} no total · ${s.new} nova(s) · ${s.reviewed} vista(s) · ${s.archived} arquivada(s)`;
  }

  async function load() {
    const box = root.querySelector('#rBody');
    if (mode === 'summary') {
      const { data, error: e } = await Forms.listResponses(formId, {});
      if (e) { box.innerHTML = `<div class="empty-state">Erro: ${esc(e.message)}</div>`; return; }
      renderSummary(box, data || []);
      return;
    }
    const { data, error: e } = await Forms.listResponses(formId, { status: filter });
    if (e) { box.innerHTML = `<div class="empty-state">Erro: ${esc(e.message)}</div>`; return; }
    responses = data || [];
    renderList();
  }

  function normalize(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function matchesSearch(r, q) {
    if (!q) return true;
    const nq = normalize(q);
    if (normalize(r.respondent_name).includes(nq)) return true;
    if (normalize(r.respondent_email).includes(nq)) return true;
    if (normalize(r.admin_notes).includes(nq)) return true;
    for (const f of dataFields) {
      const v = (r.data || {})[f.key];
      if (v == null) continue;
      const s = Array.isArray(v) ? v.join(' ') : (typeof v === 'object' ? JSON.stringify(v) : String(v));
      if (normalize(s).includes(nq)) return true;
    }
    return false;
  }

  function renderList() {
    const box = root.querySelector('#rBody');
    const count = root.querySelector('#rSearchCount');
    box.className = 'r-list';
    let view = responses;
    if (searchQuery) {
      view = responses.filter((r) => matchesSearch(r, searchQuery));
      if (count) { count.hidden = false; count.textContent = `${view.length} de ${responses.length}`; }
    } else if (count) {
      count.hidden = true;
      count.textContent = '';
    }
    if (!responses.length) {
      box.innerHTML = `<div class="empty-state">Nenhuma resposta ${filter ? 'nesse filtro' : 'ainda'}.</div>`;
      return;
    }
    if (!view.length) {
      box.innerHTML = `<div class="empty-state">Nada combinou com "${esc(searchQuery)}".</div>`;
      return;
    }
    box.innerHTML = view.map(rowHtml).join('');
    box.querySelectorAll('.r-row').forEach((r) => { r.onclick = () => openDrawer(r.dataset.id); });
  }

  // ---------------- RESUMO / GRÁFICOS ----------------
  function renderSummary(box, all) {
    box.className = 'r-summary';
    const total = all.length;
    if (!total) { box.innerHTML = `<div class="empty-state">Sem respostas para resumir ainda.</div>`; return; }
    let html = `<p class="sum-total">${total} resposta(s) no total.</p>`;
    for (const f of dataFields) {
      const vals = all.map((r) => (r.data || {})[f.key]).filter((v) => v != null && v !== '' && !(Array.isArray(v) && !v.length));
      html += `<div class="sum-card"><h4 class="sum-card__title">${esc(f.label)}</h4>`;
      if (CHOICE.has(f.type)) {
        const tally = {};
        for (const v of vals) (Array.isArray(v) ? v : [v]).forEach((x) => { tally[x] = (tally[x] || 0) + 1; });
        const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]);
        const max = Math.max(1, ...entries.map((e) => e[1]));
        html += entries.map(([k, n]) => barRow(k, n, max, total)).join('') || emptyMini();
      } else if (NUMERIC.has(f.type)) {
        const nums = vals.map(Number).filter((n) => !isNaN(n));
        const avg = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
        const tally = {};
        for (const n of nums) tally[n] = (tally[n] || 0) + 1;
        const keys = Object.keys(tally).map(Number).sort((a, b) => a - b);
        const max = Math.max(1, ...keys.map((k) => tally[k]));
        html += `<p class="sum-avg">média <strong>${avg.toFixed(1)}</strong> · ${nums.length} resposta(s)</p>`;
        html += keys.map((k) => barRow(String(k), tally[k], max, nums.length)).join('');
      } else {
        html += `<p class="sum-mini">${vals.length} resposta(s) preenchida(s) de ${total}.</p>`;
      }
      html += `</div>`;
    }
    box.innerHTML = html;
  }
  function barRow(label, n, max, total) {
    const pct = total ? Math.round((n / total) * 100) : 0;
    const w = Math.round((n / max) * 100);
    return `<div class="sum-bar">
      <span class="sum-bar__lbl" title="${esc(label)}">${esc(label === '__other__' ? 'Outro' : label)}</span>
      <span class="sum-bar__track"><span class="sum-bar__fill" style="width:${w}%"></span></span>
      <span class="sum-bar__n">${n} · ${pct}%</span></div>`;
  }
  function emptyMini() { return `<p class="sum-mini">sem dados</p>`; }

  // ---------------- LISTA ----------------
  function summary(r) {
    const d = r.data || {};
    const parts = [];
    for (const f of dataFields) {
      const val = d[f.key];
      if (val == null || val === '' || (Array.isArray(val) && !val.length)) continue;
      parts.push(`<strong>${esc(f.label)}:</strong> ${esc(Array.isArray(val) ? val.join(', ') : val)}`);
      if (parts.length >= 2) break;
    }
    return parts.join(' · ') || '<em>(sem dados)</em>';
  }
  function rowHtml(r) {
    return `<button class="r-row" data-id="${r.id}" data-status="${r.status}">
      <span class="r-row__badge st-${r.status}">${ST[r.status] || r.status}</span>
      <span class="r-row__sum">${summary(r)}</span>
      <span class="r-row__date">${new Date(r.created_at).toLocaleString('pt-BR')}</span>
    </button>`;
  }

  async function openDrawer(id) {
    const r = responses.find((x) => x.id === id);
    if (!r) return;
    const drawer = root.querySelector('#rDrawer');
    drawer.hidden = false;
    drawer.innerHTML = `<div class="empty-state small">Carregando…</div>`;

    const { data: files } = await Forms.listResponseFiles(id);
    const d = r.data || {};
    const rowsHtml = dataFields.map((f) => {
      let val = d[f.key];
      if (f.type === 'signature' && typeof val === 'string' && val.startsWith('data:image')) {
        return `<div class="rd-field"><span class="rd-field__label">${esc(f.label)}</span><img class="rd-sign" src="${val}" alt="assinatura"></div>`;
      }
      if (val == null || val === '') val = '<em>—</em>';
      else if (Array.isArray(val)) val = esc(val.join(', '));
      else if (typeof val === 'object') val = esc(Object.values(val).filter(Boolean).join(', '));
      else val = esc(val);
      return `<div class="rd-field"><span class="rd-field__label">${esc(f.label)}</span><span class="rd-field__val">${val}</span></div>`;
    }).join('');

    const filesHtml = (files && files.length) ? `
      <h4 class="rd-sub">Anexos</h4>
      <div class="rd-files">${files.map((fl) => `
        <button class="rd-file" data-path="${esc(fl.storage_path)}">${icon('external', { size: 12 })} ${esc(fl.file_name)} <small>(${(fl.file_size / 1024 / 1024).toFixed(2)} MB)</small></button>`).join('')}
      </div>` : '';

    drawer.innerHTML = `
      <div class="rd">
        <header class="rd__head">
          <strong>Resposta · ${new Date(r.created_at).toLocaleString('pt-BR')}</strong>
          <button class="admin-link-btn" id="rdClose">${icon('x', { size: 14 })}</button>
        </header>
        <div class="rd__meta">
          ${r.respondent_name ? `<span>${esc(r.respondent_name)}</span>` : ''}
          ${r.respondent_email ? `<span>${esc(r.respondent_email)}</span>` : ''}
          <span class="r-row__badge st-${r.status}">${ST[r.status] || r.status}</span>
        </div>
        <div class="rd__body">${rowsHtml}${filesHtml}</div>
        <div class="rd__notes">
          <label class="fb-row__label">Notas internas</label>
          <textarea class="adm-input" id="rdNotes" rows="2">${esc(r.admin_notes || '')}</textarea>
        </div>
        <footer class="rd__foot">
          <button class="btn btn--ghost btn--small" data-st="reviewed">Marcar vista</button>
          <button class="btn btn--ghost btn--small" data-st="archived">Arquivar</button>
          <button class="btn btn--ghost btn--small" data-st="spam">Spam</button>
          <button class="admin-link-btn danger" id="rdDel">${icon('trash', { size: 12 })} Excluir</button>
        </footer>
      </div>`;

    drawer.querySelector('#rdClose').onclick = () => { drawer.hidden = true; };
    drawer.querySelectorAll('.rd-file').forEach((b) => {
      b.onclick = async () => {
        const { url, error: e } = await Forms.signedFileUrl(b.dataset.path);
        if (e || !url) return toastError('Não consegui gerar o link do anexo.');
        window.open(url, '_blank');
      };
    });
    drawer.querySelectorAll('[data-st]').forEach((b) => {
      b.onclick = async () => {
        const notes = drawer.querySelector('#rdNotes').value;
        const { error: e } = await Forms.updateResponse(id, { status: b.dataset.st, admin_notes: notes });
        if (e) return toastError(e.message);
        toastSuccess('Atualizado.');
        drawer.hidden = true; await refreshStats(); load();
      };
    });
    drawer.querySelector('#rdNotes').addEventListener('change', async (e) => {
      await Forms.updateResponse(id, { admin_notes: e.target.value });
    });
    drawer.querySelector('#rdDel').onclick = async () => {
      if (!confirm('Excluir esta resposta?')) return;
      const { error: e } = await Forms.deleteResponse(id);
      if (e) return toastError(e.message);
      toastSuccess('Excluída.'); drawer.hidden = true; await refreshStats(); load();
    };

    if (r.status === 'new') {
      await Forms.updateResponse(id, { status: 'reviewed' });
      r.status = 'reviewed'; refreshStats();
    }
  }

  function exportCsv() {
    const csv = Forms.responsesToCsv(form, responses.length ? responses : []);
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${form.slug}-respostas.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
