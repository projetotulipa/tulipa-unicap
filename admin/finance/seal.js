// SVGs do selo lacrado — símbolo do módulo Tesouraria.
// Reusado em hero, watermarks, loading, monogramas, mural.
//
// stamp: pequeno (selo de cera ondulado + T central)
// page:  watermark grande (selo + duas estrelinhas decorativas)
// emblem: alias para empty states

export function stampSeal({ size = 28 } = {}) {
  return `
    <svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 3 C 14 3 14 5 16 5 C 18 5 18 7 20 8 C 20 10 21 11 21 12 C 21 13 20 14 20 16 C 18 17 18 19 16 19 C 14 19 14 21 12 21 C 10 21 10 19 8 19 C 6 19 6 17 4 16 C 4 14 3 13 3 12 C 3 11 4 10 4 8 C 6 7 6 5 8 5 C 10 5 10 3 12 3 Z"/>
      <circle cx="12" cy="12" r="5" opacity="0.5"/>
      <path d="M9.2 10 L14.8 10 M12 10 L12 15" stroke-width="1.6"/>
    </svg>
  `.trim();
}

export function stampPage({ size = 220 } = {}) {
  return `
    <svg viewBox="0 0 100 100" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M50 12 C 58 12 58 20 66 20 C 75 20 75 28 84 32 C 84 40 88 46 88 50 C 88 54 84 60 84 68 C 75 72 75 80 66 80 C 58 80 58 88 50 88 C 42 88 42 80 34 80 C 25 80 25 72 16 68 C 16 60 12 54 12 50 C 12 46 16 40 16 32 C 25 28 25 20 34 20 C 42 20 42 12 50 12 Z" opacity="0.7"/>
      <circle cx="50" cy="50" r="22" opacity="0.5"/>
      <circle cx="50" cy="50" r="14" opacity="0.35"/>
      <path d="M40 42 L60 42 M50 42 L50 62" stroke-width="2.2"/>
      <path d="M26 30 L27 32 L29 32.5 L27.5 34 L28 36 L26 35 L24 36 L24.5 34 L23 32.5 L25 32 Z" opacity="0.55"/>
      <path d="M74 65 L75 67 L77 67.5 L75.5 69 L76 71 L74 70 L72 71 L72.5 69 L71 67.5 L73 67 Z" opacity="0.55"/>
    </svg>
  `.trim();
}

export function stampEmblem({ size = 56 } = {}) {
  return stampSeal({ size });
}
