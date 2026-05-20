// Modelo de fichamento + guia de normas (mistura ABNT NBR 6023/10520 + boas práticas
// pra estudo em grupo). Acessível pelo drawer de fichamento.

export const FICHAMENTO_TEMPLATE = `# Identificação

**Autor:**
**Obra:**
**Editora · Cidade · Ano:**
**Tradução (se houver):**
**Páginas / capítulo fichado:**

# Sobre a obra

Contexto histórico, proposta do autor, lugar do texto na obra dele e na tradição (junguiana, pós-junguiana, etc.).

# Conceitos-chave

- conceito 1 — definição em uma frase
- conceito 2 —
- conceito 3 —

# Citações marcantes

> "trecho literal entre aspas." (p. XX)

> "outro trecho." (p. XX)

# Resumo das ideias

Síntese seção a seção, com as suas próprias palavras (evita plágio).

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
`;

export const FICHAMENTO_GUIDE = [
  {
    title: 'O que é um fichamento',
    body: 'Um registro estruturado da leitura. Ajuda você (e o grupo) a voltar ao texto sem precisar relê-lo inteiro. Também é a fonte do referencial teórico em artigos futuros.',
  },
  {
    title: 'Três tipos clássicos',
    body: 'Bibliográfico — só dados da obra + síntese rápida.\nDe citação — transcrição literal entre aspas, sempre com página.\nDe resumo — ideias do texto reescritas com suas próprias palavras.\n\nO modelo aqui é misto: usa um pouco de cada, porque é mais útil no estudo em grupo.',
  },
  {
    title: 'Referência (NBR 6023:2018)',
    body: 'Formato:\n\nSOBRENOME, Nome. Título da obra. Cidade: Editora, ano.\n\nExemplo:\n\nJUNG, C. G. O eu e o inconsciente. Petrópolis: Vozes, 2008.\n\nPara capítulo de coletânea:\n\nSOBRENOME, N. Título do capítulo. In: ORG., N. Título do livro. Cidade: Editora, ano. p. xx–yy.',
  },
  {
    title: 'Citações (NBR 10520:2023)',
    body: 'Citação curta (até 3 linhas): entre aspas no corpo do texto, seguida de (AUTOR, ano, p. página).\n\nCitação longa (4+ linhas): recuada 4 cm da margem esquerda, fonte menor, sem aspas, espaçamento simples.\n\nParáfrase (você reescreve a ideia): basta autor + ano, sem aspas.\n\nSempre indique a página da citação direta.',
  },
  {
    title: 'Como evitar plágio',
    body: 'Toda transcrição literal precisa de aspas + página. Ideias parafraseadas precisam, no mínimo, de autor + ano. Quando reescrever, faça de verdade — não troque só algumas palavras. Se há dúvida, prefira citar literalmente.',
  },
  {
    title: 'Para a TULIPA',
    body: 'Use as seções "Análise crítica", "Conexões" e "Perguntas em aberto" como espaço de pensamento livre. Elas são o que diferencia um fichamento útil pro grupo de um resumo morto. Anotem onde o texto bate com casos clínicos, símbolos do mês ou outros autores lidos.',
  },
];
