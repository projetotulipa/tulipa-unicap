// Categorias de gasto fixas.

import { icon } from '../icons.js';

export const EXPENSE_CATEGORIES = [
  { id: 'alimentacao',  label: 'Alimentação',  iconName: 'spark',       requiresDescription: false },
  { id: 'materiais',    label: 'Materiais',    iconName: 'page',        requiresDescription: false },
  { id: 'excepcionais', label: 'Excepcionais', iconName: 'star',        requiresDescription: true,
    hint: 'Palestras, pagamento de professores, etc — descreva no campo abaixo.' },
  { id: 'investimentos',label: 'Investimentos',iconName: 'check-circle',requiresDescription: false },
];

export function categoryById(id) {
  return EXPENSE_CATEGORIES.find((c) => c.id === id);
}

export function categoryLabel(id) {
  return categoryById(id)?.label || id;
}

export function categoryIconHtml(id, size = 16) {
  const cat = categoryById(id);
  return icon(cat?.iconName || 'page', { size });
}
