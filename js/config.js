// Supabase project: tulipa-unicap
export const SUPABASE_URL = 'https://lqarbyzehqrxlkavzgpo.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxYXJieXplaHFyeGxrYXZ6Z3BvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMTU5NDksImV4cCI6MjA5NDc5MTk0OX0.p_mi-cUsdrjbYUV5cbnq-di_FNMEum4leZemsd44UaU';

// Escopos editáveis. Cada um vira um snapshot independente em site_content.
// 'global' = navbar + home + configs gerais (só admin)
// 'lp:<slug>' = LP individual (admin + dept correspondente se houver)
export const SCOPES = {
  global: { label: 'Geral (navbar + home)', adminOnly: true },
  'lp:presidencia':           { label: 'LP Presidência',           role: 'dept:presidencia' },
  'lp:professor-orientador':  { label: 'LP Prof. Orientador',      role: 'dept:prof-orientador' },
  'lp:professor-colaborador': { label: 'LP Prof. Colaborador',     role: 'dept:prof-colaborador' },
  'lp:midia':                 { label: 'LP Mídia',                 role: 'dept:midia' },
  'lp:pesquisa':              { label: 'LP Pesquisa',              role: 'dept:pesquisa' },
  'lp:tesouraria':            { label: 'LP Tesouraria',            role: 'dept:tesouraria' },
  'lp:secretaria':            { label: 'LP Secretaria',            role: 'dept:secretaria' },
  'lp:grupos-de-estudo':      { label: 'LP Grupos de Estudo',      adminOnly: true },
  'lp:leitura-conjunta':      { label: 'LP Leitura Conjunta',      adminOnly: true },
  'lp:arteterapia':           { label: 'LP Arteterapia',           adminOnly: true },
};

export const LS_PREFIX = 'tulipa:';
export const LS_SNAPSHOT_VERSION = LS_PREFIX + 'snapshot-version';
export const LS_DATA = LS_PREFIX + 'data';
