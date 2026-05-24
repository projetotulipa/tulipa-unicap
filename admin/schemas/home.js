// Schema da página Home. Define os blocos visíveis no editor, com labels humanos.
// Cada field aponta pra um data-edit-id real no HTML.
//
// types:
//   'text'        — uma linha, sem formatação
//   'rich'        — multi-linha, aceita markdown leve (**negrito**, *itálico*)
//   'link-label'  — texto puro do link (preserva atributos como href)
//
// Containers (opcionais por bloco): listam grupos de "items" do bloco — cards,
// pills, links — que o admin pode editar individualmente, ocultar, reordenar,
// adicionar ou remover. Cada container aponta pra um `data-edit-container` real
// no HTML, e descreve os sub-campos editáveis de cada item.

export const HOME_SCHEMA = {
  scope: 'global',
  label: 'Página inicial',
  iconName: 'brand',
  blocks: [
    {
      id: 'hero',
      sectionId: 'section.hero',
      iconName: 'hero',
      label: 'Capa',
      description: 'O topo da home: logo, título TULIPA, manifesto curto e botões.',
      summaryFields: ['hero.title-line', 'hero.lede'],
      fields: [
        { id: 'hero.eyebrow',       label: 'Eyebrow (linha pequena acima do título)', type: 'text' },
        { id: 'hero.title-line',    label: 'Frase antes do nome TULIPA',              type: 'text' },
        { id: 'hero.sub',           label: 'Subtítulo (em itálico, abaixo do nome)',  type: 'rich' },
        { id: 'hero.lede',          label: 'Parágrafo de boas-vindas',                type: 'rich' },
        { id: 'hero.cta-primary',   label: 'Botão principal — texto',                 type: 'link-label' },
        { id: 'hero.cta-instagram', label: 'Botão Instagram — texto',                 type: 'link-label' },
        { id: 'hero.scroll-word',   label: 'Frase decorativa de scroll (rodapé da capa)', type: 'text' },
      ],
    },
    {
      id: 'marquee',
      sectionId: 'section.marquee',
      iconName: 'marquee',
      label: 'Carrossel de conceitos junguianos',
      description: 'A faixa rolante com palavras-chave (Self, Sombra, Anima…). Por enquanto só permite ocultar / reordenar.',
      summaryFields: [],
      fields: [],
    },
    {
      id: 'manifesto',
      sectionId: 'section.manifesto',
      iconName: 'manifesto',
      label: 'Manifesto',
      description: 'Citação central em pergaminho, com folhas decorativas.',
      summaryFields: ['manifesto.body'],
      fields: [
        { id: 'manifesto.body',        label: 'Citação principal',     type: 'rich' },
        { id: 'manifesto.attribution', label: 'Atribuição (linha de baixo)', type: 'text' },
      ],
    },
    {
      id: 'sobre',
      sectionId: 'section.sobre',
      iconName: 'sobre',
      label: 'Quem somos',
      description: 'Apresentação do projeto — texto editorial.',
      summaryFields: ['sobre.title', 'sobre.p1'],
      fields: [
        { id: 'sobre.eyebrow', label: 'Eyebrow',           type: 'text' },
        { id: 'sobre.title',   label: 'Título da seção',   type: 'rich' },
        { id: 'sobre.p1',      label: 'Parágrafo 1',       type: 'rich' },
        { id: 'sobre.p2',      label: 'Parágrafo 2',       type: 'rich' },
        { id: 'sobre.p3',      label: 'Parágrafo 3',       type: 'rich' },
      ],
    },
    {
      id: 'missao',
      sectionId: 'section.missao',
      iconName: 'missao',
      label: 'Nossa missão',
      description: 'Citação grande seguida de pilares: Propagar · Aprofundar · Acolher.',
      summaryFields: ['missao.title'],
      fields: [
        { id: 'missao.eyebrow', label: 'Eyebrow',                type: 'text' },
        { id: 'missao.title',   label: 'Citação grande (centro)', type: 'rich' },
      ],
      containers: [
        {
          key: 'missao.pillars',
          label: 'Pilares',
          itemNoun: 'pilar',
          itemNounPlural: 'pilares',
          defaultBasedOn: 'missao.pillar.propagar',
          itemFieldSuffixes: [
            { suffix: '.title', label: 'Título',    type: 'text' },
            { suffix: '.body',  label: 'Descrição', type: 'rich' },
          ],
        },
      ],
    },
    {
      id: 'nome',
      sectionId: 'section.nome',
      iconName: 'nome',
      label: 'O nome (T·U·LI·P·A)',
      description: 'Acrônimo + frase simbólica explicando o nome do projeto.',
      summaryFields: ['nome.title'],
      fields: [
        { id: 'nome.eyebrow',   label: 'Eyebrow',                  type: 'text' },
        { id: 'nome.title',     label: 'Pergunta principal',       type: 'rich' },
        { id: 'nome.acronym.T', label: 'T —',                      type: 'text' },
        { id: 'nome.acronym.U', label: 'U —',                      type: 'text' },
        { id: 'nome.acronym.LI', label: 'LI —',                    type: 'text' },
        { id: 'nome.acronym.P', label: 'P —',                      type: 'text' },
        { id: 'nome.acronym.A', label: 'A —',                      type: 'text' },
        { id: 'nome.full',      label: 'Nome completo (linha)',    type: 'text' },
        { id: 'nome.quote',     label: 'Citação simbólica abaixo', type: 'rich' },
      ],
    },
    {
      id: 'atividades',
      sectionId: 'section.atividades',
      iconName: 'atividades',
      label: 'Atividades',
      description: 'Cabeçalho da seção + cards de atividades. Cada card é editável individualmente.',
      summaryFields: ['atividades.title'],
      fields: [
        { id: 'atividades.eyebrow', label: 'Eyebrow',         type: 'text' },
        { id: 'atividades.title',   label: 'Título da seção', type: 'rich' },
      ],
      containers: [
        {
          key: 'atividades.cards',
          label: 'Cards de atividade',
          itemNoun: 'card',
          itemNounPlural: 'cards',
          supportsHref: true,
          defaultBasedOn: 'atividades.card.grupos',
          itemFieldSuffixes: [
            { suffix: '.title', label: 'Título',    type: 'rich' },
            { suffix: '.body',  label: 'Descrição', type: 'rich' },
          ],
        },
      ],
    },
    {
      id: 'departamentos',
      sectionId: 'section.departamentos',
      iconName: 'departamentos',
      label: 'Departamentos',
      description: 'Cabeçalho + hierarquia em árvore: cargos no topo e departamentos abaixo.',
      summaryFields: ['depts.title', 'depts.intro'],
      fields: [
        { id: 'depts.eyebrow', label: 'Eyebrow',            type: 'text' },
        { id: 'depts.title',   label: 'Título da seção',    type: 'rich' },
        { id: 'depts.intro',   label: 'Texto introdutório', type: 'rich' },
      ],
      containers: [
        {
          key: 'depts.leadership',
          label: 'Cargos do topo',
          itemNoun: 'cargo',
          itemNounPlural: 'cargos',
          supportsHref: true,
          defaultBasedOn: 'depts.lead.prof-orientador',
          itemFieldSuffixes: [
            { suffix: '.label', label: 'Rótulo (texto do botão)', type: 'link-label' },
          ],
        },
        {
          key: 'depts.depts',
          label: 'Departamentos',
          itemNoun: 'departamento',
          itemNounPlural: 'departamentos',
          supportsHref: true,
          defaultBasedOn: 'depts.dept.midia',
          itemFieldSuffixes: [
            { suffix: '.label', label: 'Rótulo (texto do botão)', type: 'link-label' },
          ],
        },
      ],
    },
    {
      id: 'pullquote',
      sectionId: 'section.pullquote',
      iconName: 'pullquote',
      label: 'Citação intermediária',
      description: 'Frase inspirada em Jung entre as seções de departamentos e contato.',
      summaryFields: ['pullquote.body'],
      fields: [
        { id: 'pullquote.body',   label: 'Citação',     type: 'rich' },
        { id: 'pullquote.author', label: 'Atribuição',  type: 'text' },
      ],
    },
    {
      id: 'contato',
      sectionId: 'section.contato',
      iconName: 'contato',
      label: 'Contato',
      description: 'Vias de contato (Instagram, endereço, e-mail) + selo com citação.',
      summaryFields: ['contato.title', 'contato.body'],
      fields: [
        { id: 'contato.eyebrow', label: 'Eyebrow',          type: 'text' },
        { id: 'contato.title',   label: 'Título da seção',  type: 'rich' },
        { id: 'contato.body',    label: 'Parágrafo introdutório', type: 'rich' },
        { id: 'contato.card.quote', label: 'Citação no selo',    type: 'rich' },
      ],
      containers: [
        {
          key: 'contato.links',
          label: 'Vias de contato',
          itemNoun: 'via',
          itemNounPlural: 'vias',
          supportsHref: true,
          defaultBasedOn: 'contato.link.instagram',
          itemFieldSuffixes: [
            { suffix: '.title', label: 'Título',    type: 'text' },
            { suffix: '.sub',   label: 'Descrição', type: 'text' },
          ],
        },
      ],
    },
  ],
};

export function blockById(blockId) {
  return HOME_SCHEMA.blocks.find((b) => b.id === blockId);
}
