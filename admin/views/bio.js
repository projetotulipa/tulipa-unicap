// Bio editor — stub. Implementação completa no commit 3 (Bio 3/4).

import { icon } from '../icons.js';

export async function renderBio(ctx) {
  const { root } = ctx;
  root.innerHTML = `
    <div class="view">
      <header class="view__header">
        <h1>Bio / Linktree</h1>
        <p class="view__lede">Editor da página <code>/bio</code> — em construção.</p>
      </header>
      <div class="empty-state">
        <p>O editor completo virá no próximo commit (Bio 3/4).</p>
        <p class="muted" style="margin-top: 8px;">Por enquanto, a página pública /bio já está disponível com os 2 cards padrão.</p>
        <a href="../bio/" class="btn btn--primary" target="_blank" rel="noopener" style="margin-top: 14px;">
          ${icon('external', { size: 14 })}<span style="margin-left:6px;">Abrir /bio</span>
        </a>
      </div>
    </div>
  `;
}
