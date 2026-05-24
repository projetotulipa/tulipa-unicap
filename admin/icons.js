// Biblioteca de ícones SVG inline. Todos 24x24, line-style, stroke currentColor.
// Uso: icon('hero')  → string com <svg>...</svg>
//       icon('hero', { size: 28 })

const ICONS = {
  // ---- blocos da Home ----
  hero: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 3.2 C 8.6 6.6, 7.8 11.4, 9.4 15 C 10.7 17.5, 12 18.4, 12 18.4 C 12 18.4, 13.3 17.5, 14.6 15 C 16.2 11.4, 15.4 6.6, 12 3.2 Z"/>
    <path d="M12 18.4 L12 21.5"/>
    <path d="M11 6.5 C 11 8, 11.4 9.5, 12 10.4"/>
  </svg>`,

  marquee: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 8 Q 6 6, 9 8 T 15 8 T 21 8"/>
    <path d="M3 12 Q 6 10, 9 12 T 15 12 T 21 12"/>
    <path d="M3 16 Q 6 14, 9 16 T 15 16 T 21 16"/>
  </svg>`,

  manifesto: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M6 7 C 5 9, 5 11, 7 11 C 8 11, 9 10, 9 9 C 9 8, 8 7, 6 7 Z M6 11 L5 14"/>
    <path d="M14 7 C 13 9, 13 11, 15 11 C 16 11, 17 10, 17 9 C 17 8, 16 7, 14 7 Z M14 11 L13 14"/>
    <line x1="5" y1="18" x2="19" y2="18"/>
  </svg>`,

  sobre: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M6 18 C 6 12, 9 7, 18 6 C 18 13, 14 18, 6 18 Z"/>
    <path d="M6 18 L18 6" stroke-width="1"/>
  </svg>`,

  missao: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9"/>
    <circle cx="12" cy="12" r="5"/>
    <circle cx="12" cy="12" r="1.4" fill="currentColor"/>
  </svg>`,

  nome: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 12 L11 4 L20 4 L20 13 L12 21 Z"/>
    <circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" stroke="none"/>
  </svg>`,

  atividades: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4 6 C 7 5, 10 5, 12 7 L 12 19 C 10 17, 7 17, 4 18 Z"/>
    <path d="M20 6 C 17 5, 14 5, 12 7 L 12 19 C 14 17, 17 17, 20 18 Z"/>
  </svg>`,

  departamentos: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 20 L21 20"/>
    <path d="M4 20 L4 9 L20 9 L20 20"/>
    <path d="M3 9 L12 3 L21 9"/>
    <path d="M9 20 L9 13 L15 13 L15 20"/>
  </svg>`,

  pullquote: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 3 L13.5 10.5 L21 12 L13.5 13.5 L12 21 L10.5 13.5 L3 12 L10.5 10.5 Z"/>
  </svg>`,

  contato: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2"/>
    <path d="M3 7 L12 13 L21 7"/>
  </svg>`,

  // ---- sidebar / general ----
  pages: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="4" y="3" width="13" height="16" rx="1.5"/>
    <path d="M8 4 L8 3 M20 6 L20 21 L9 21 L9 19" stroke-width="1.4"/>
  </svg>`,

  users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="9" cy="8" r="3.5"/>
    <path d="M3 20 C 3 16, 6 14, 9 14 C 12 14, 15 16, 15 20"/>
    <circle cx="17" cy="9" r="2.5"/>
    <path d="M15 14.5 C 17 14.5, 21 15.5, 21 19.5"/>
  </svg>`,

  // ---- ações ----
  'arrow-up': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 19 L12 5 M6 11 L12 5 L18 11"/>
  </svg>`,

  'arrow-left': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M19 12 L5 12 M11 6 L5 12 L11 18"/>
  </svg>`,

  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M5 12 L10 17 L19 7"/>
  </svg>`,

  chevron: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M9 6 L15 12 L9 18"/>
  </svg>`,

  'arrow-down': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 5 L12 19 M6 13 L12 19 L18 13"/>
  </svg>`,

  'arrow-right': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M5 12 L19 12 M13 6 L19 12 L13 18"/>
  </svg>`,

  eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M2 12 C 5 6, 8 4, 12 4 C 16 4, 19 6, 22 12 C 19 18, 16 20, 12 20 C 8 20, 5 18, 2 12 Z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>`,

  'eye-off': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 3 L21 21"/>
    <path d="M10.6 10.6 C 10.2 11, 10 11.5, 10 12 C 10 13.1, 10.9 14, 12 14 C 12.5 14, 13 13.8, 13.4 13.4"/>
    <path d="M6.4 6.4 C 4.5 7.7, 3 9.6, 2 12 C 4.5 17, 8 19.5, 12 19.5 C 13.6 19.5, 15.2 19.1, 16.6 18.3"/>
    <path d="M9.5 4.7 C 10.3 4.6, 11.2 4.5, 12 4.5 C 16 4.5, 19.5 7, 22 12 C 21.3 13.4, 20.4 14.7, 19.4 15.7"/>
  </svg>`,

  edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4 20 L8 19 L19 8 L16 5 L5 16 Z"/>
    <path d="M14 7 L17 10"/>
  </svg>`,

  x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M6 6 L18 18 M18 6 L6 18"/>
  </svg>`,

  refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 12 C 3 7, 7 3, 12 3 C 15 3, 17.5 4.5, 19 6.5 M21 4 L21 8 L17 8"/>
    <path d="M21 12 C 21 17, 17 21, 12 21 C 9 21, 6.5 19.5, 5 17.5 M3 20 L3 16 L7 16"/>
  </svg>`,

  drag: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
    <circle cx="9" cy="6" r="1.2" fill="currentColor" stroke="none"/>
    <circle cx="15" cy="6" r="1.2" fill="currentColor" stroke="none"/>
    <circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none"/>
    <circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none"/>
    <circle cx="9" cy="18" r="1.2" fill="currentColor" stroke="none"/>
    <circle cx="15" cy="18" r="1.2" fill="currentColor" stroke="none"/>
  </svg>`,

  external: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M14 4 L20 4 L20 10"/>
    <path d="M20 4 L11 13"/>
    <path d="M18 14 L18 19 C 18 19.6, 17.6 20, 17 20 L5 20 C 4.4 20, 4 19.6, 4 19 L4 7 C 4 6.4, 4.4 6, 5 6 L10 6"/>
  </svg>`,

  // genérico (página sem ícone específico)
  page: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M6 3 L14 3 L19 8 L19 21 L6 21 Z"/>
    <path d="M14 3 L14 8 L19 8"/>
    <path d="M9 13 L16 13 M9 17 L14 17"/>
  </svg>`,

  // ---- presença ----
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="16" rx="2"/>
    <path d="M3 9 L21 9"/>
    <path d="M8 3 L8 7 M16 3 L16 7"/>
  </svg>`,

  attendance: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="4" y="3" width="16" height="18" rx="2"/>
    <path d="M8 8 L16 8 M8 12 L16 12 M8 16 L13 16"/>
    <path d="M8 8 L8 16" opacity="0.4"/>
  </svg>`,

  group: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="9" cy="9" r="3"/>
    <circle cx="17" cy="11" r="2.5"/>
    <path d="M3 19 C 3 15.5, 6 14, 9 14 C 12 14, 15 15.5, 15 19"/>
    <path d="M14 16 C 16 15, 21 15, 21 19"/>
  </svg>`,

  'user-plus': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="9" cy="8" r="3.5"/>
    <path d="M3 20 C 3 16, 6 14, 9 14 C 11 14, 13 14.7, 14.4 16"/>
    <path d="M18 14 L18 20 M15 17 L21 17"/>
  </svg>`,

  'check-circle': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9"/>
    <path d="M8 12.5 L11 15.5 L16.5 9.5"/>
  </svg>`,

  'x-circle': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9"/>
    <path d="M9 9 L15 15 M15 9 L9 15"/>
  </svg>`,

  alert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 3 L22 20 L2 20 Z"/>
    <path d="M12 10 L12 14"/>
    <circle cx="12" cy="17" r="0.9" fill="currentColor"/>
  </svg>`,

  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4 6 L20 6"/>
    <path d="M9 6 L9 4 L15 4 L15 6"/>
    <path d="M6 6 L7 20 C 7 20.6, 7.4 21, 8 21 L16 21 C 16.6 21, 17 20.6, 17 20 L18 6"/>
    <path d="M10 11 L10 17 M14 11 L14 17"/>
  </svg>`,

  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
    <path d="M12 5 L12 19 M5 12 L19 12"/>
  </svg>`,

  copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2"/>
    <path d="M5 15 H 4 A 2 2 0 0 1 2 13 V 4 A 2 2 0 0 1 4 2 H 13 A 2 2 0 0 1 15 4 V 5"/>
  </svg>`,

  star: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 3 L14.5 9 L21 9.5 L16 14 L17.5 20.5 L12 17 L6.5 20.5 L8 14 L3 9.5 L9.5 9 Z"/>
  </svg>`,

  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7"/>
    <path d="M16 16 L21 21"/>
  </svg>`,

  filter: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 5 L21 5 L14 13 L14 20 L10 18 L10 13 Z"/>
  </svg>`,

  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 7 L12 12 L15.5 14"/>
  </svg>`,

  spark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 4 L13 10 L19 11 L13 12 L12 18 L11 12 L5 11 L11 10 Z"/>
  </svg>`,

  whatsapp: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19.05 4.91A10 10 0 0 0 4.93 19.06l-1.4 5.13 5.26-1.38a10 10 0 0 0 10.26-17.9zM12 21.45a8.4 8.4 0 0 1-4.28-1.17l-.31-.18-3.12.82.83-3.04-.2-.32a8.4 8.4 0 1 1 7.08 3.89zm4.6-6.3c-.25-.13-1.49-.74-1.72-.82-.23-.08-.4-.13-.57.13s-.65.82-.8.99c-.15.17-.3.19-.55.06s-1.06-.39-2.02-1.24c-.74-.66-1.25-1.48-1.4-1.73s-.02-.39.1-.51c.1-.1.25-.27.38-.4s.17-.22.25-.39c.08-.16.04-.3-.02-.43s-.57-1.36-.78-1.87c-.21-.5-.42-.43-.57-.43h-.49c-.17 0-.43.06-.66.3s-.86.84-.86 2.06.88 2.39 1 2.56 1.74 2.65 4.22 3.72c.59.25 1.05.4 1.41.51.59.19 1.13.16 1.55.1.47-.07 1.49-.61 1.7-1.2.21-.59.21-1.09.15-1.2-.06-.1-.23-.16-.48-.29z"/>
  </svg>`,

  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M5 4 L9 4 L11 9 L8.5 10.5 C 10 13 11 14 13.5 15.5 L 15 13 L 20 15 L 20 19 C 20 19.6 19.6 20 19 20 C 11 20 4 13 4 5 C 4 4.4 4.4 4 5 4 Z"/>
  </svg>`,

  // marca brand do TULIPA (uso no login/sidebar)
  brand: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M16 5 C 11.5 9, 10.4 15, 12.5 20 C 14.2 23.4, 16 24.5, 16 24.5 C 16 24.5, 17.8 23.4, 19.5 20 C 21.6 15, 20.5 9, 16 5 Z" fill="currentColor" fill-opacity="0.12"/>
    <path d="M16 5 C 11.5 9, 10.4 15, 12.5 20 C 14.2 23.4, 16 24.5, 16 24.5 C 16 24.5, 17.8 23.4, 19.5 20 C 21.6 15, 20.5 9, 16 5 Z"/>
    <path d="M16 24.5 L16 28.5"/>
    <path d="M14.5 9.5 C 14.5 12, 15 14.5, 16 16"/>
  </svg>`,

  // ---- recursos / mídia (study groups) ----
  book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4 5 C 4 4.4 4.4 4 5 4 L11 4 L11 19 L5 19 C 4.4 19 4 19.4 4 20 L4 5 Z"/>
    <path d="M20 5 C 20 4.4 19.6 4 19 4 L13 4 L13 19 L19 19 C 19.6 19 20 19.4 20 20 L20 5 Z"/>
    <path d="M11 4 L13 4"/>
  </svg>`,

  play: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9"/>
    <path d="M10 8 L16 12 L10 16 Z" fill="currentColor"/>
  </svg>`,

  film: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="1.5"/>
    <path d="M3 8 L21 8 M3 16 L21 16"/>
    <path d="M7 4 L7 8 M7 16 L7 20 M17 4 L17 8 M17 16 L17 20"/>
  </svg>`,

  mic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="9" y="3" width="6" height="11" rx="3"/>
    <path d="M5 11 C 5 15 8 17 12 17 C 16 17 19 15 19 11"/>
    <path d="M12 17 L12 21 M9 21 L15 21"/>
  </svg>`,

  image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="2"/>
    <circle cx="9" cy="10" r="2"/>
    <path d="M3 18 L9 12 L13 16 L17 12 L21 16"/>
  </svg>`,

  document: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M6 3 L14 3 L19 8 L19 21 L6 21 Z"/>
    <path d="M14 3 L14 8 L19 8"/>
    <path d="M9 13 L16 13 M9 17 L14 17 M9 9 L11 9"/>
  </svg>`,

  // ícone próprio do módulo "Grupos de Estudo" — folha aberta com fita marca-página
  study: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 5 C 6 4 9 4 12 5 C 15 4 18 4 21 5 L21 19 C 18 18 15 18 12 19 C 9 18 6 18 3 19 Z"/>
    <path d="M12 5 L12 19"/>
    <path d="M16 5 L16 11 L17.5 10 L19 11 L19 5"/>
  </svg>`,
};

export function icon(name, opts = {}) {
  const svg = ICONS[name] || ICONS.page;
  const size = opts.size || 24;
  const cls = opts.className ? ` class="${opts.className}"` : '';
  return svg.replace('<svg ', `<svg width="${size}" height="${size}"${cls} `);
}

export function hasIcon(name) {
  return Object.prototype.hasOwnProperty.call(ICONS, name);
}
