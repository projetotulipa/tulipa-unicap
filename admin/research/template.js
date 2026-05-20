// Modelos de fichamento segundo a tradição ABNT (NBR 6023 + NBR 10520) +
// guia inline. Quatro tipos clássicos selecionáveis no drawer.

const REFERENCE_HEADER = `# Referência (NBR 6023:2018)

SOBRENOME, Nome. **Título da obra**: subtítulo (se houver). Edição. Cidade: Editora, ano. N páginas.

> Exemplo:
> JUNG, C. G. **O eu e o inconsciente**. Tradução de Dora Ferreira da Silva. 22. ed. Petrópolis: Vozes, 2008. 167 p.

# Cabeçalho

**Fichador(a):**
**Data:**
**Grupo / disciplina:**

`;

export const FICHAMENTO_TEMPLATES = [
  {
    id: 'bibliografico',
    label: 'Bibliográfico',
    description: 'Dados da obra + síntese curta. Use pra mapear rapidamente o que cada fonte traz.',
    abnt: 'NBR 6023',
    body: REFERENCE_HEADER + `# Síntese da obra (1–3 parágrafos)

Contexto, proposta e relevância. Diga em poucas linhas o que a obra discute, em que tradição se inscreve e por que vale a leitura.

# Palavras-chave

conceito 1 · conceito 2 · conceito 3 · conceito 4
`,
  },
  {
    id: 'citacao',
    label: 'De citação',
    description: 'Transcrições literais entre aspas, com página. Útil pra alimentar o referencial teórico.',
    abnt: 'NBR 10520',
    body: REFERENCE_HEADER + `# Citações diretas

> "trecho literal entre aspas." (p. XX)

> "outro trecho relevante." (p. XX)

> "outro trecho." (p. XX)

---

**Observações sobre regras de citação (NBR 10520:2023):**
- Até 3 linhas: aspas dentro do parágrafo, indique (AUTOR, ano, p. página).
- 4 linhas ou mais: recuo de 4 cm da margem esquerda, fonte menor, sem aspas.
- Sempre indique a página da citação direta.
- Paráfrase pede só autor + ano.
`,
  },
  {
    id: 'resumo',
    label: 'De resumo',
    description: 'Reescrita das ideias com suas próprias palavras, seção a seção. Ajuda a fixar a leitura.',
    abnt: 'práticas acadêmicas',
    body: REFERENCE_HEADER + `# Resumo

Síntese das ideias do texto, **com suas próprias palavras** — evita plágio e mostra que você de fato leu.

## Introdução / capítulo 1

...

## Capítulo 2

...

## Capítulo 3

...

## Conclusão do autor

...

# Síntese final

Em 1 parágrafo, o que o texto deixa como contribuição principal pro tema.
`,
  },
  {
    id: 'analitico',
    label: 'Analítico (misto)',
    description: 'Combina citações, resumo e crítica. Mais usado em estudo em grupo. Recomendado pra TULIPA.',
    abnt: 'misto / recomendado',
    body: REFERENCE_HEADER + `# Sobre a obra

Contexto histórico, proposta do autor, lugar do texto no pensamento dele e na tradição (junguiana, pós-junguiana, etc.).

# Conceitos-chave

- conceito 1 — definição em uma frase
- conceito 2 —
- conceito 3 —

# Citações marcantes

> "trecho literal entre aspas." (p. XX)

> "outro trecho." (p. XX)

# Resumo das ideias

Síntese seção a seção, com as suas próprias palavras.

## Parte 1

...

## Parte 2

...

# Análise crítica

O que o autor sustenta bem e o que deixa em aberto. Pontos fortes e limites do argumento. Onde você concorda e onde resiste.

# Conexões

- Diálogos com outros autores lidos no grupo
- Aproximação com a prática clínica / extensiva da TULIPA
- Símbolos amplificáveis ou casos comparáveis

# Perguntas em aberto

- ...
- ...
`,
  },
];

export function templateById(id) {
  return FICHAMENTO_TEMPLATES.find((t) => t.id === id);
}

// Guia rápido (acessível pelo botão "Como fichar")
export const FICHAMENTO_GUIDE = [
  {
    title: 'O que é um fichamento',
    body: 'Um registro estruturado da leitura. Ajuda você (e o grupo) a voltar ao texto sem precisar relê-lo inteiro. Também é a fonte do referencial teórico em artigos futuros.',
  },
  {
    title: 'Três tipos clássicos da ABNT',
    body: 'Bibliográfico — dados da obra + síntese curta. Mapeia rapidamente o que cada fonte diz sobre o tema.\n\nDe citação — transcrição literal entre aspas, sempre com página. Tipo mais usado pra alimentar referencial teórico.\n\nDe resumo — ideias do texto reescritas com suas próprias palavras, capítulo a capítulo. Treina compreensão.\n\nNa TULIPA usamos um quarto, misto/analítico, que combina os três + análise crítica.',
  },
  {
    title: 'Referência (NBR 6023:2018)',
    body: 'Formato:\n\nSOBRENOME, Nome. Título da obra: subtítulo. Edição. Cidade: Editora, ano.\n\nExemplo:\n\nJUNG, C. G. O eu e o inconsciente. 22. ed. Petrópolis: Vozes, 2008.\n\nPara capítulo de coletânea:\n\nSOBRENOME, N. Título do capítulo. In: ORG., N. (org.). Título do livro. Cidade: Editora, ano. p. xx–yy.',
  },
  {
    title: 'Citações (NBR 10520:2023)',
    body: 'Citação curta (até 3 linhas): entre aspas no corpo do texto, seguida de (AUTOR, ano, p. página).\n\nCitação longa (4+ linhas): recuada 4 cm da margem esquerda, fonte menor, sem aspas, espaçamento simples.\n\nParáfrase (você reescreve a ideia): basta autor + ano, sem aspas.\n\nSempre indique a página da citação direta.\n\nSupressão de trecho dentro da citação: use [...]. Comentário do fichador: use [comentário].',
  },
  {
    title: 'Como evitar plágio',
    body: 'Toda transcrição literal precisa de aspas + página. Ideias parafraseadas precisam, no mínimo, de autor + ano. Quando reescrever, faça de verdade — não troque só algumas palavras. Se há dúvida, prefira citar literalmente.',
  },
  {
    title: 'Para a TULIPA (boas práticas)',
    body: 'No modelo analítico, as seções "Análise crítica", "Conexões" e "Perguntas em aberto" são o que diferencia um fichamento útil pro grupo de um resumo morto. Use-as como espaço de pensamento livre. Anotem onde o texto bate com casos clínicos, símbolos do mês ou outros autores lidos no semestre.',
  },
];
