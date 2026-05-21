// TULIPA · admin · Formulários — caixa de respostas.
import * as Forms from '../forms/data.js';
import { isStaticField } from '../forms/field-types.js';
import { icon } from '../icons.js';
import { toastSuccess, toastError } from '../toast.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const ST = { new: 'Nova', reviewed: 'Vista', archived: 'Arquivada', spam: 'Spam' };

export async function renderFormsResponses(ctx, formId) {
  const { root, api } = ctx;
  root.innerHTML = `<div class="empty-state">Carregando respostas…</div>`;

  const { data: form, error } = await Forms.getForm(formId);
  if (error || !form) { root.innerHTML = `<div class="empty-state">Formulário não encontrado.</div>`; return; }

  // campos que coletam dado (na ordem do schema)
  const dataFields = [];
  for (const p of (form.schema?.pages || [])) for (const f of (p.fields || [])) {
    if (!isStaticField(f.type) && f.type !== 'hidden') dataFields.push(f);
  }

  let filter = null;
  let responses = [];

  root.innerHTML = `
    <div class="admin-head">
      <div>
        <button class="admin-link-btn" id="rBack">${icon('arrow-left', { size: 14 })} Formulários</button>
        <h1>Respostas · ${esc(form.title)}</h1>
        <p class="admin-sub" id="rStats">—</p>
      </div>
      <button class="btn btn--ghost btn--small" id="rExport">${icon('external', { size: 12 })} Exportar CSV</button>
    </div>
    <div class="r-filters" id="rFilters">
      ${['', 'new', 'reviewed', 'archived', 'spam'].map((s) => `
        <button class="r-filter ${s === '' ? 'is-on' : ''}" data-f="${s}">${s === '' ? 'Todas' : ST[s]}</button>`).join('')}
    </div>
    <div id="rList" class="r-list"><div class="empty-state">Carregando…</div></div>
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

  await refreshStats();
  await load();

  async function refreshStats() {
    const s = await Forms.responseStats(formId);
    root.querySelector('#rStats').textContent =
      `${s.total} no total · ${s.new} nova(s) · ${s.reviewed} vista(s) · ${s.archived} arquivada(s)`;
  }

  async function load() {
    const box = root.querySelector('#rList');
    const { data, error: e } = await Forms.listResponses(formId, { status: filter });
    if (e) { box.innerHTML = `<div class="empty-state">Erro: ${esc(e.message)}</div>`; return; }
    responses = data || [];
    if (!responses.length) { box.innerHTML = `<div class="empty-state">Nenhuma resposta ${filter ? 'nesse filtro' : 'ainda'}.</div>`; return; }
    box.innerHTML = responses.map(rowHtml).join('');
    box.querySelectorAll('.r-row').forEach((r) => { r.onclick = () => openDrawer(r.dataset.id); });
  }

  function summary(r) {
    // mostra os 2 primeiros campos preenchidos como prévia
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
      if (val == null || val === '') val = '<em>—</em>';
      else if (Array.isArray(val)) val = esc(val.join(', '));
      else val = esc(val);
      return `<div class="rd-field"><span class="rd-field__label">${esc(f.label)}</span><span class="rd-field__val">${val}</span></div>`;
    }).join('');

    const filesHtml = (files && files.length) ? `
      <h4 class="rd-sub">Anexos</h4>
      <div class="rd-files">${files.map((fl) => `
        <button class="rd-file" data-path="${esc(fl.storage_path)}">${icon('external', { size: 12 })} ${esc(fl.file_name)} <small>(${(fl.file_size/1024/1024).toFixed(2)} MB)</small></button>`).join('')}
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

    // marca como vista automaticamente se era nova
    if (r.status === 'new') {
      await Forms.updateResponse(id, { status: 'reviewed' });
      r.status = 'reviewed'; refreshStats();
    }
  }

  function exportCsv() {
    const csv = Forms.responsesToCsv(form, responses);
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${form.slug}-respostas.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
