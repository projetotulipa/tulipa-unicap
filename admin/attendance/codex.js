// SVGs do codex (livro/ata aberta) — símbolo do módulo Presença.
// Reusado em hero, watermarks, loading, monogramas de grupo.

// versão "selo" (24px): livro aberto compacto, linhas finas representando texto
export function codexSeal({ size = 28 } = {}) {
  return `
    <svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 6.5 C 6 5.5, 9 5.5, 12 7 C 15 5.5, 18 5.5, 21 6.5 L21 18.5 C 18 17.5, 15 17.5, 12 19 C 9 17.5, 6 17.5, 3 18.5 Z"/>
      <path d="M12 7 L12 19" opacity="0.5"/>
      <path d="M5.5 10 L9.5 10.5 M5.5 12.5 L9.5 13 M5.5 15 L9 15.5" opacity="0.55" stroke-width="1"/>
      <path d="M14.5 10.5 L18.5 10 M14.5 13 L18.5 12.5 M15 15.5 L18.5 15" opacity="0.55" stroke-width="1"/>
      <path d="M16 6.6 L16 8.5" opacity="0.6" stroke-width="1"/>
    </svg>
  `.trim();
}

// versão "page" (watermark grande): mesma estrutura, mais detalhe + fita pendente
export function codexPage({ size = 220 } = {}) {
  return `
    <svg viewBox="0 0 100 100" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M10 24 C 28 19, 42 21, 50 30 C 58 21, 72 19, 90 24 L90 76 C 72 71, 58 73, 50 82 C 42 73, 28 71, 10 76 Z"/>
      <path d="M50 30 L50 82" opacity="0.55"/>
      <path d="M17 34 L42 34 M17 41 L42 41 M17 48 L42 48 M17 55 L42 55 M17 62 L42 62 M17 69 L38 69" opacity="0.6" stroke-width="0.9"/>
      <path d="M58 34 L83 34 M58 41 L83 41 M58 48 L83 48 M58 55 L83 55 M58 62 L83 62 M62 69 L83 69" opacity="0.6" stroke-width="0.9"/>
      <path d="M68 24 L68 32 L66 30 L64 32 L64 24" opacity="0.85" stroke-width="1.1"/>
    </svg>
  `.trim();
}

// símbolo "registro" usado em empty states / loading wrap pequeno
export function codexEmblem({ size = 56 } = {}) {
  return codexSeal({ size });
}
