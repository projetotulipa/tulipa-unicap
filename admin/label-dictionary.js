// Mapa edit-id → label humano. Aplicado da regra mais específica pra mais genérica.

const RULES = [
  // ---------- HERO (específicos) ----------
  [/^hero\.eyebrow$/,        'Eyebrow (linha pequena acima do título)'],
  [/^hero\.title-line$/,     'Frase antes do nome principal'],
  [/^hero\.title-display$/,  'Nome principal (grande)'],
  [/^hero\.sub$/,            'Subtítulo (em itálico)'],
  [/^hero\.lede$/,           'Parágrafo de boas-vindas'],
  [/^hero\.scroll-word$/,    'Frase decorativa de scroll'],
  [/^hero\.cta-primary$/,    'Botão principal — texto'],
  [/^hero\.cta-instagram$/,  'Botão Instagram — texto'],
  [/^hero\.breadcrumb.*$/,   'Breadcrumb (voltar à página anterior)'],

  // ---------- pillars (home / missão) ----------
  [/^missao\.pillar\.([^.]+)\.title$/, (m) => `Pilar “${prettifySlug(m[1])}” — título`],
  [/^missao\.pillar\.([^.]+)\.body$/,  (m) => `Pilar “${prettifySlug(m[1])}” — texto`],

  // ---------- acrônimo TULIPA ----------
  [/^nome\.acronym\.([A-Z]+)$/, (m) => `Letra ${m[1]} — palavra`],
  [/^nome\.full$/,              'Nome completo por extenso'],
  [/^nome\.quote$/,              'Citação simbólica do nome'],

  // ---------- atividades cards (home) ----------
  [/^atividades\.card\.grupos\.title$/,  'Card "Grupos" — título'],
  [/^atividades\.card\.grupos\.body$/,   'Card "Grupos" — texto'],
  [/^atividades\.card\.leitura\.title$/, 'Card "Leitura" — título'],
  [/^atividades\.card\.leitura\.body$/,  'Card "Leitura" — texto'],
  [/^atividades\.card\.arte\.title$/,    'Card "Arteterapia" — título'],
  [/^atividades\.card\.arte\.body$/,     'Card "Arteterapia" — texto'],
  [/^atividades\.card\.allos\.title$/,   'Card "Allos" — título'],
  [/^atividades\.card\.allos\.body$/,    'Card "Allos" — texto'],

  // ---------- departamentos (home) ----------
  [/^depts\.lead\.([^.]+)\.label$/, (m) => `Cargo "${prettifySlug(m[1])}" — rótulo`],
  [/^depts\.dept\.([^.]+)\.label$/, (m) => `Departamento "${prettifySlug(m[1])}" — rótulo`],

  // ---------- contato (home) ----------
  [/^contato\.link\.([^.]+)\.title$/, (m) => `Link "${prettifySlug(m[1])}" — título`],
  [/^contato\.link\.([^.]+)\.sub$/,   (m) => `Link "${prettifySlug(m[1])}" — descrição`],
  [/^contato\.card\.quote$/,           'Citação do selo lateral'],

  // ---------- manifesto / pullquote ----------
  [/^manifesto\.body$/,        'Citação principal'],
  [/^manifesto\.attribution$/, 'Atribuição'],
  [/^pullquote\.body$/,        'Citação'],
  [/^pullquote\.author$/,      'Autor / atribuição'],

  // ---------- LPs internas (genéricos) ----------
  [/^([^.]+)\.eyebrow$/,                'Eyebrow (linha pequena acima)'],
  [/^([^.]+)\.title$/,                  'Título da seção'],
  [/^([^.]+)\.intro$/,                  'Texto introdutório'],
  [/^([^.]+)\.p(\d+)$/,                 (m) => `Parágrafo ${m[2]}`],

  [/^([^.]+)\.item\.(\d+)\.title$/,     (m) => `Item ${m[2]} — título`],
  [/^([^.]+)\.item\.(\d+)\.body$/,      (m) => `Item ${m[2]} — descrição`],

  [/^([^.]+)\.card\.(\d+)\.title$/,     (m) => `Card ${m[2]} — título`],
  [/^([^.]+)\.card\.(\d+)\.body$/,      (m) => `Card ${m[2]} — descrição`],

  [/^([^.]+)\.cta$/,                    'Botão de chamada — texto'],
];

export function labelFor(editId) {
  for (const [pattern, label] of RULES) {
    const m = editId.match(pattern);
    if (m) {
      return typeof label === 'function' ? label(m) : label;
    }
  }
  return editId; // fallback (mostra o id se nada matcha — útil pra debug)
}

function prettifySlug(s) {
  return s
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
