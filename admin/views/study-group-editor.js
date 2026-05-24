// TULIPA · admin · editor de Grupo de Estudo (4 abas)
// Implementação completa: Sprint 3.

import { icon } from '../icons.js';
import { stampSeal } from '../pages/signet.js';
import { supabase } from '../../js/supabase.js';

export async function renderStudyGroupEditor(ctx, pageId) {
  const { root } = ctx;
  root.innerHTML = `
    <div class="view view--study-editor">
      <header class="pages-editor-hero">
        <div class="pages-editor-hero__seal-wrap">
          <span class="pages-signet pages-signet--wine">${stampSeal({ size: 30 })}</span>
        </div>
        <div class="pages-editor-hero__inner">
          <p class="pages-editor-hero__crumbs">
            <a href="#/grupos-estudo">${icon('arrow-left', { size: 12 })}<span style="margin-left:6px;">Grupos de Estudo</span></a>
          </p>
          <h1 id="editorTitle">Carregando…</h1>
          <p class="pages-editor-hero__lede" id="editorLede"></p>
        </div>
      </header>

      <div class="study-editor-soon">
        <span class="pages-bloom"><span class="pages-signet">${stampSeal({ size: 26 })}</span></span>
        <h3>Editor em desenvolvimento</h3>
        <p>O dashboard e o wizard de criação já funcionam. O editor completo (Conteúdo · Encontros · Materiais · Configurações) virá no Sprint 3 desta feature.</p>
        <p class="muted" style="font-size: 12px; margin-top: 16px;">
          ID da folha: <code>${escapeHtml(pageId)}</code>
        </p>
      </div>
    </div>
  `;

  // busca por id (não por slug) — mas só temos getStudyGroupBySlug.
  // pra esse skeleton, busca direto pelo id pra testar:
  const { data, error } = await supabase
    .from('study_groups_public')
    .select('group_name, lede, slug')
    .eq('page_id', pageId)
    .maybeSingle();
  if (data) {
    document.getElementById('editorTitle').textContent = data.group_name || '(sem nome)';
    document.getElementById('editorLede').textContent = data.lede || `slug: ${data.slug}`;
  } else if (error) {
    document.getElementById('editorTitle').textContent = 'Erro ao carregar';
    document.getElementById('editorLede').textContent = error.message;
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
