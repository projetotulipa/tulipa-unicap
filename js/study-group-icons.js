// TULIPA · biblioteca de ícones SVG pros Grupos de Estudo
// Compartilhada entre admin (wizard, editor, dashboard) e site público (LP genérica + filha).
// 15 símbolos pra capa de grupo — viewBox 24x24, stroke="currentColor", sem fills hardcoded.
//
// Uso:
//   coverIcon('book')           → string SVG (size default 48)
//   coverIcon('book', 96)        → mesma string com size custom
//   COVER_ICONS                  → array de { value, label, svg } pra pickers

const ICONS_RAW = {
  book: {
    label: 'Livro aberto',
    svg: `<path d="M3 5.5 C 3 4.7 3.6 4 4.5 4 L11 4 L11 20 L4.5 20 C 3.6 20 3 19.3 3 18.5 Z"/>
          <path d="M21 5.5 C 21 4.7 20.4 4 19.5 4 L13 4 L13 20 L19.5 20 C 20.4 20 21 19.3 21 18.5 Z"/>
          <path d="M11 4 L13 4 M7 9 L9 9 M7 12 L9 12 M15 9 L17 9 M15 12 L17 12"/>`,
  },
  flower: {
    label: 'Tulipa',
    svg: `<path d="M12 4 C 8 7 7 12 9 16 C 10.5 19 12 19.5 12 19.5 C 12 19.5 13.5 19 15 16 C 17 12 16 7 12 4 Z"/>
          <path d="M12 19.5 L12 22"/>
          <path d="M10 9 C 10 11 10.6 13 11.5 14"/>`,
  },
  moon: {
    label: 'Lua',
    svg: `<path d="M20 14 C 19 18 15 21 11 21 C 6 21 2 17 2 12 C 2 7 6 3 11 3 C 9 5 8 8 8 11 C 8 16 14 20 20 14 Z"/>`,
  },
  sun: {
    label: 'Sol',
    svg: `<circle cx="12" cy="12" r="4"/>
          <path d="M12 2 L12 5 M12 19 L12 22 M2 12 L5 12 M19 12 L22 12 M4.9 4.9 L7 7 M17 17 L19.1 19.1 M4.9 19.1 L7 17 M17 7 L19.1 4.9"/>`,
  },
  mandala: {
    label: 'Mandala',
    svg: `<circle cx="12" cy="12" r="9"/>
          <circle cx="12" cy="12" r="5"/>
          <circle cx="12" cy="12" r="1.3" fill="currentColor"/>
          <path d="M12 3 L12 7 M12 17 L12 21 M3 12 L7 12 M17 12 L21 12"/>`,
  },
  star: {
    label: 'Estrela',
    svg: `<path d="M12 3 L14.5 9 L21 9.5 L16 14 L17.5 20.5 L12 17 L6.5 20.5 L8 14 L3 9.5 L9.5 9 Z"/>`,
  },
  mountain: {
    label: 'Montanha',
    svg: `<path d="M3 20 L9 9 L13 15 L17 7 L21 20 Z"/>
          <circle cx="17" cy="5" r="1.5" fill="currentColor"/>`,
  },
  tree: {
    label: 'Árvore',
    svg: `<path d="M12 3 C 9 5 7 8 8 11 L 11 11 L 9 14 L 12 14 L 10 17 L 14 17 L 12 14 L 15 14 L 13 11 L 16 11 C 17 8 15 5 12 3 Z"/>
          <path d="M12 17 L12 21 M10 21 L14 21"/>`,
  },
  eye: {
    label: 'Olho',
    svg: `<path d="M2 12 C 5 6 8 4 12 4 C 16 4 19 6 22 12 C 19 18 16 20 12 20 C 8 20 5 18 2 12 Z"/>
          <circle cx="12" cy="12" r="3.5"/>
          <circle cx="12" cy="12" r="1.2" fill="currentColor"/>`,
  },
  shell: {
    label: 'Concha',
    svg: `<path d="M3 19 C 4 12 7 5 12 5 C 17 5 20 12 21 19 L 3 19 Z"/>
          <path d="M12 5 L12 19 M7 8 L8 19 M17 8 L16 19"/>`,
  },
  flame: {
    label: 'Chama',
    svg: `<path d="M12 3 C 9 6 7 11 9 16 C 10.5 19 12 20 12 20 C 12 20 13.5 19 15 16 C 17 11 15 6 12 3 Z"/>
          <path d="M10 13 C 10 15 11 17 12 18 C 13 17 14 15 14 13 C 14 11 13 9 12 8 C 11 9 10 11 10 13 Z" fill="currentColor" fill-opacity="0.25"/>`,
  },
  heart: {
    label: 'Coração',
    svg: `<path d="M12 20 C 9 18 4 14 3 10 C 2.5 7 4 4 7 4 C 9 4 11 5.5 12 7 C 13 5.5 15 4 17 4 C 20 4 21.5 7 21 10 C 20 14 15 18 12 20 Z"/>`,
  },
  mask: {
    label: 'Máscara',
    svg: `<path d="M4 7 C 4 5 6 4 8 4 L 16 4 C 18 4 20 5 20 7 L 20 12 C 20 17 16 21 12 21 C 8 21 4 17 4 12 Z"/>
          <circle cx="9" cy="11" r="1.3" fill="currentColor"/>
          <circle cx="15" cy="11" r="1.3" fill="currentColor"/>
          <path d="M9 15 C 10 16.5 14 16.5 15 15"/>`,
  },
  scroll: {
    label: 'Pergaminho',
    svg: `<path d="M5 4 C 4 4 3 5 3 6 L 3 18 C 3 19 4 20 5 20 L 17 20 C 18 20 19 19 19 18 L 19 8 L 15 4 L 5 4 Z"/>
          <path d="M15 4 L 15 8 L 19 8"/>
          <path d="M7 9 L 13 9 M7 12 L 13 12 M7 15 L 11 15"/>`,
  },
  spiral: {
    label: 'Espiral',
    svg: `<path d="M12 12 C 12 10 14 8 16 10 C 18 12 16 16 12 16 C 8 16 6 12 8 8 C 10 4 16 4 19 8"/>`,
  },
};

const SIZE_DEFAULT = 48;

export function coverIcon(name, size = SIZE_DEFAULT) {
  const ic = ICONS_RAW[name];
  if (!ic) {
    // fallback: se valor não é um nome conhecido, renderiza como emoji (texto).
    // permite compat com dados antigos que tinham emoji unicode salvo.
    return `<span class="cover-emoji-fallback" style="font-size:${Math.round(size * 0.75)}px;line-height:1;">${escapeHtml(name || '📖')}</span>`;
  }
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ic.svg}</svg>`;
}

export function isKnownCoverIcon(name) {
  return Object.prototype.hasOwnProperty.call(ICONS_RAW, name);
}

export const COVER_ICONS = Object.entries(ICONS_RAW).map(([value, { label }]) => ({ value, label }));

export const DEFAULT_COVER_ICON = 'book';

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
