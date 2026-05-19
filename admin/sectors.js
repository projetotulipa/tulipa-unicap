// Setores fixos da TULIPA. Cada setor mapeia pra uma ou mais LPs (scopes).

export const SECTORS = [
  { value: 'presidencia',           label: 'Presidência',          lpScopes: ['lp:presidencia'] },
  { value: 'professor-orientador',  label: 'Professor Orientador', lpScopes: ['lp:professor-orientador'] },
  { value: 'professor-colaborador', label: 'Professor Colaborador',lpScopes: ['lp:professor-colaborador'] },
  { value: 'midia',                 label: 'Mídia',                lpScopes: ['lp:midia'] },
  { value: 'pesquisa',              label: 'Pesquisa',             lpScopes: ['lp:pesquisa'] },
  { value: 'tesouraria',            label: 'Tesouraria',           lpScopes: ['lp:tesouraria'] },
  { value: 'secretaria',            label: 'Secretaria',           lpScopes: ['lp:secretaria'] },
  { value: 'atividades',            label: 'Atividades (3 LPs)',   lpScopes: ['lp:grupos-de-estudo', 'lp:leitura-conjunta', 'lp:arteterapia'] },
];

export const ROLES = [
  { value: 'pending',     label: 'Pendente (sem acesso)',  description: 'recém-cadastrado, aguarda aprovação' },
  { value: 'admin',       label: 'Admin (Presidência)',    description: 'acesso total ao painel' },
  { value: 'coordinator', label: 'Coordenador / Diretor',  description: 'gere um setor inteiro' },
  { value: 'member',      label: 'Membro',                 description: 'trabalha em um setor (e opcionalmente uma equipe)' },
];

export function sectorByValue(v) {
  return SECTORS.find((s) => s.value === v);
}

export function roleByValue(v) {
  return ROLES.find((r) => r.value === v);
}

// Retorna labels legíveis pra exibição.
export function describeProfile(profile) {
  if (!profile) return '—';
  const r = roleByValue(profile.role)?.label || profile.role;
  if (profile.role === 'admin' || profile.role === 'pending') return r;
  const s = sectorByValue(profile.sector)?.label || profile.sector || '?';
  if (profile.role === 'coordinator') return `${r} · ${s}`;
  if (profile.role === 'member') return profile.team
    ? `${r} · ${s} / ${profile.team}`
    : `${r} · ${s}`;
  return r;
}
