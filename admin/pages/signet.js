// SVGs do signet — símbolo do módulo Páginas.
// Reusado em hero, watermarks, loading, monogramas, mural.
//
// stamp:  pequeno (folha + fita de seda pendente)
// page:   watermark grande (folha cheia + fita longa + estrelinhas)
// emblem: alias para empty states

export function stampSeal({ size = 28 } = {}) {
  return `
    <svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M5 4 L19 4 L19 21 L5 21 Z"/>
      <path d="M8 9 L16 9 M8 12 L14 12 M8 15 L16 15 M8 18 L13 18" opacity="0.55" stroke-width="1"/>
      <path d="M13 4 L13 9 L14.5 7.5 L16 9 L16 4" fill="currentColor" fill-opacity="0.32" stroke-width="1"/>
    </svg>
  `.trim();
}

export function stampPage({ size = 220 } = {}) {
  return `
    <svg viewBox="0 0 100 100" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M18 14 L82 14 L82 88 L18 88 Z" opacity="0.75"/>
      <path d="M28 30 L72 30 M28 38 L72 38 M28 46 L72 46 M28 54 L72 54 M28 62 L60 62 M28 70 L72 70 M28 78 L66 78" opacity="0.5" stroke-width="0.8"/>
      <path d="M62 14 L62 36 L68 30 L74 36 L74 14" fill="currentColor" fill-opacity="0.32" stroke-width="1.2"/>
      <path d="M26 22 L27 24 L29 24.5 L27.5 26 L28 28 L26 27 L24 28 L24.5 26 L23 24.5 L25 24 Z" opacity="0.55"/>
      <path d="M50 84 L51 86 L53 86.5 L51.5 88 L52 90 L50 89 L48 90 L48.5 88 L47 86.5 L49 86 Z" opacity="0.45"/>
    </svg>
  `.trim();
}

export function stampEmblem({ size = 56 } = {}) {
  return stampSeal({ size });
}
