// Metadados de cada "slug" de section — usados pra rotular blocos detectados
// dinamicamente no DOM (sem precisar criar schema por LP).

export const SECTION_META = {
  // ---- globais ----
  hero:         { iconName: 'hero',          label: 'Capa',                          description: 'O topo da página: logo, título e introdução.' },
  marquee:      { iconName: 'marquee',       label: 'Carrossel de conceitos',        description: 'Faixa rolante de palavras-chave junguianas.' },
  manifesto:    { iconName: 'manifesto',     label: 'Manifesto',                     description: 'Citação central em pergaminho.' },
  pullquote:    { iconName: 'pullquote',     label: 'Citação intermediária',         description: 'Frase de transição entre seções.' },
  contato:      { iconName: 'contato',       label: 'Contato',                       description: 'Bloco de contato — Instagram, e-mail, endereço.' },
  nome:         { iconName: 'nome',          label: 'O nome (T·U·LI·P·A)',           description: 'Acrônimo e citação simbólica.' },
  departamentos:{ iconName: 'departamentos', label: 'Departamentos',                 description: 'Árvore de departamentos e cargos.' },

  // ---- comuns nas LPs ----
  sobre:        { iconName: 'sobre',         label: 'Quem somos / O que faz',        description: 'Apresentação editorial do setor.' },
  missao:       { iconName: 'missao',        label: 'Missão / Propósito',            description: 'Objetivo do setor ou da atividade.' },
  detalhes:     { iconName: 'atividades',    label: 'Atribuições / Detalhes',        description: 'O que o setor faz no dia a dia (lista).' },
  atividades:   { iconName: 'atividades',    label: 'Atividades',                    description: 'Cards das atividades.' },
  outras:       { iconName: 'departamentos', label: 'Outras páginas',                description: 'Cards apontando para páginas relacionadas.' },

  // ---- LPs grandes (pesquisa, secretaria, tesouraria) ----
  tldr:         { iconName: 'page',          label: 'Resumo (TL;DR)',                description: 'Resumo rápido no topo.' },
  vagas:        { iconName: 'page',          label: 'Vagas em aberto',               description: 'Vagas e processo seletivo.' },
  finalidade:   { iconName: 'sobre',         label: 'Finalidade',                    description: 'Para que serve este setor.' },
  funcoes:      { iconName: 'atividades',    label: 'Funções',                       description: 'O que cabe à pessoa que assume o cargo.' },
  atribuicoes:  { iconName: 'atividades',    label: 'Atribuições',                   description: 'Tarefas detalhadas do cargo.' },
  setores:      { iconName: 'departamentos', label: 'Setores internos',              description: 'Subdivisões dentro do setor.' },
  fichamento:   { iconName: 'page',          label: 'Fichamento',                    description: 'Metodologia de fichamento de leituras.' },
  revisao:      { iconName: 'page',          label: 'Revisão por pares',             description: 'Como acontece a revisão entre membros.' },
  periodicos:   { iconName: 'page',          label: 'Periódicos',                    description: 'Revistas e canais editoriais.' },
  drive:        { iconName: 'page',          label: 'Drive / Documentos',            description: 'Onde ficam materiais compartilhados.' },
  prazos:       { iconName: 'page',          label: 'Prazos',                        description: 'Calendário e datas importantes.' },
  direcao:      { iconName: 'sobre',         label: 'Direção atual',                 description: 'Quem está à frente.' },
  faltas:       { iconName: 'page',          label: 'Critérios de ausência',         description: 'Política de presença e faltas.' },
  metricas:     { iconName: 'page',          label: 'Métricas',                      description: 'Indicadores e gravações de reunião.' },
  materiais:    { iconName: 'page',          label: 'Materiais',                     description: 'Inventário de materiais físicos.' },
  eventos:      { iconName: 'page',          label: 'Eventos',                       description: 'Eventos previstos e orçamento.' },
  grupos:       { iconName: 'page',          label: 'Grupos e oficinas',             description: 'Despesas relacionadas a grupos.' },
};

// fallback genérico — pode ser usado se um slug novo aparecer
export function sectionMeta(slug) {
  if (SECTION_META[slug]) return SECTION_META[slug];

  // se for um slug sufixado tipo "sobre-2", usa o base com indicação
  const m = slug.match(/^(.+)-(\d+)$/);
  if (m && SECTION_META[m[1]]) {
    const base = SECTION_META[m[1]];
    return {
      iconName: base.iconName,
      label: `${base.label} — bloco ${m[2]}`,
      description: base.description,
    };
  }

  return {
    iconName: 'page',
    label: capitalize(slug.replace(/-/g, ' ')),
    description: 'Seção interna desta página.',
  };
}

function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
