// Categorias de justificativa.
export const JUSTIFICATION_CATEGORIES = [
  { value: 'saude',     label: 'Saúde',     description: 'Atestado médico, mal-estar, consulta' },
  { value: 'trabalho',  label: 'Trabalho',  description: 'Compromisso profissional inadiável' },
  { value: 'familia',   label: 'Família',   description: 'Emergência ou compromisso familiar' },
  { value: 'academico', label: 'Acadêmico', description: 'Prova, aula ou atividade obrigatória' },
  { value: 'outro',     label: 'Outro',     description: 'Detalhe no campo de motivo' },
];

export function categoryLabel(value) {
  return JUSTIFICATION_CATEGORIES.find((c) => c.value === value)?.label || value || '—';
}

// SVG por categoria — todos 24x24 line-style, stroke currentColor.
// Usado no drawer (cards grandes) e na chip do card de pessoa.
const CATEGORY_ICONS = {
  saude: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 21 C 6 17, 3 13, 3 9 C 3 6.2, 5.2 4, 8 4 C 9.7 4, 11.2 5, 12 6.3 C 12.8 5, 14.3 4, 16 4 C 18.8 4, 21 6.2, 21 9 C 21 13, 18 17, 12 21 Z"/>
    <path d="M9.5 11 L14.5 11 M12 8.5 L12 13.5" stroke-width="1.6"/>
  </svg>`,
  trabalho: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="3" y="7" width="18" height="13" rx="2"/>
    <path d="M9 7 L9 5 C 9 4.4, 9.4 4, 10 4 L14 4 C 14.6 4, 15 4.4, 15 5 L15 7"/>
    <path d="M3 13 L21 13"/>
    <path d="M11 12 L13 12 L13 14 L11 14 Z" fill="currentColor" stroke="none" opacity="0.6"/>
  </svg>`,
  familia: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 11 L12 4 L21 11"/>
    <path d="M5 10 L5 20 L19 20 L19 10"/>
    <path d="M10 20 L10 14 L14 14 L14 20"/>
    <circle cx="12" cy="9" r="0.8" fill="currentColor" stroke="none"/>
  </svg>`,
  academico: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M2 8 L12 4 L22 8 L12 12 Z"/>
    <path d="M6 10 L6 16 C 6 17, 9 19, 12 19 C 15 19, 18 17, 18 16 L18 10"/>
    <path d="M22 8 L22 14" stroke-width="1.2"/>
  </svg>`,
  outro: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="6" cy="12" r="1.2" fill="currentColor" stroke="none"/>
    <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>
    <circle cx="18" cy="12" r="1.2" fill="currentColor" stroke="none"/>
  </svg>`,
};

export function categoryIcon(value, { size = 20 } = {}) {
  const raw = CATEGORY_ICONS[value] || CATEGORY_ICONS.outro;
  if (size === 20) return raw;
  return raw.replace('width="20" height="20"', `width="${size}" height="${size}"`);
}
