// Metadados das 14 páginas do site (mostradas no admin de Páginas).
// Mantém a relação scope ↔ path do HTML e label legível.

export const PAGES = [
  {
    scope: 'global',
    label: 'Página inicial (Home)',
    path: '../index.html',
    description: 'Hero, marquee, manifesto, sobre, missão, nome, atividades, departamentos, contato.',
    isHome: true,
  },
  {
    scope: 'lp:presidencia',
    label: 'Presidência',
    path: '../atividades/presidencia.html',
  },
  {
    scope: 'lp:professor-orientador',
    label: 'Prof. Orientador',
    path: '../atividades/professor-orientador.html',
  },
  {
    scope: 'lp:professor-colaborador',
    label: 'Prof. Colaborador',
    path: '../atividades/professor-colaborador.html',
  },
  {
    scope: 'lp:midia',
    label: 'Departamento de Mídia',
    path: '../atividades/midia.html',
  },
  {
    scope: 'lp:pesquisa',
    label: 'Departamento de Pesquisa',
    path: '../atividades/pesquisa.html',
  },
  {
    scope: 'lp:tesouraria',
    label: 'Tesouraria',
    path: '../atividades/tesouraria.html',
  },
  {
    scope: 'lp:secretaria',
    label: 'Secretaria',
    path: '../atividades/secretaria.html',
  },
  {
    scope: 'lp:grupos-de-estudo',
    label: 'Grupos de Estudo',
    path: '../atividades/grupos-de-estudo.html',
  },
  {
    scope: 'lp:leitura-conjunta',
    label: 'Leitura Conjunta',
    path: '../atividades/leitura-conjunta.html',
  },
  {
    scope: 'lp:arteterapia',
    label: 'Arteterapia',
    path: '../atividades/arteterapia.html',
  },
];

// Pega config por scope
export function pageByScope(scope) {
  return PAGES.find((p) => p.scope === scope);
}

// Slug pra hash routing — 'global' vira 'home', 'lp:midia' vira 'midia'
export function scopeToSlug(scope) {
  if (scope === 'global') return 'home';
  return scope.replace(/^lp:/, '');
}
export function slugToScope(slug) {
  if (slug === 'home') return 'global';
  return `lp:${slug}`;
}
