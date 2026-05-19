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
