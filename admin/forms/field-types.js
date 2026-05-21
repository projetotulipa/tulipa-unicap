// TULIPA · forms · registro de tipos de campo + configs possíveis.
// Este arquivo é a "fonte da verdade" do construtor: define todos os tipos
// de campo, suas opções configuráveis e os defaults. O builder lê daqui.

// ---- categorias da paleta do construtor ----
export const FIELD_CATEGORIES = [
  { id: 'text',    label: 'Texto' },
  { id: 'choice',  label: 'Escolha' },
  { id: 'advanced',label: 'Avançado' },
  { id: 'layout',  label: 'Layout' },
];

// Flags de capacidade que cada tipo declara (o painel de config liga/desliga
// seções conforme essas flags).
//   options       → tem lista de opções (radio/select/checkbox/ranking/matrix)
//   placeholder   → aceita placeholder
//   multiline     → textarea
//   numeric       → validação numérica (min/max/step)
//   dateRange     → validação de data (minDate/maxDate)
//   length        → validação de tamanho (minLen/maxLen)
//   choiceLimits  → mín/máx de seleções (checkbox/ranking)
//   allowOther    → permite opção "Outro"
//   attachment    → upload de arquivo (limites de tamanho/tipo/qtd)
//   scale         → escala numérica (min..max + rótulos das pontas)
//   matrix        → linhas × colunas
//   staticBlock   → não coleta dado (título, texto, imagem, divisória)
//   noLabel       → não usa rótulo padrão (divisória, espaçador)

export const FIELD_TYPES = [
  // ---------------- TEXTO ----------------
  { type: 'short_text', label: 'Texto curto',     icon: 'edit',     category: 'text',
    caps: { placeholder: true, length: true } },
  { type: 'long_text',  label: 'Texto longo',     icon: 'pages',    category: 'text',
    caps: { placeholder: true, length: true, multiline: true } },
  { type: 'email',      label: 'E-mail',          icon: 'contato',  category: 'text',
    caps: { placeholder: true }, meta: 'email' },
  { type: 'phone',      label: 'Telefone',        icon: 'phone',    category: 'text',
    caps: { placeholder: true }, mask: 'phone-br' },
  { type: 'number',     label: 'Número',          icon: 'edit',     category: 'text',
    caps: { placeholder: true, numeric: true } },
  { type: 'url',        label: 'Link (URL)',      icon: 'external', category: 'text',
    caps: { placeholder: true } },
  { type: 'cpf',        label: 'CPF',             icon: 'edit',     category: 'text',
    caps: { placeholder: true }, mask: 'cpf' },
  { type: 'date',       label: 'Data',            icon: 'calendar', category: 'text',
    caps: { dateRange: true } },
  { type: 'time',       label: 'Hora',            icon: 'clock',    category: 'text',
    caps: {} },
  { type: 'datetime',   label: 'Data e hora',     icon: 'calendar', category: 'text',
    caps: { dateRange: true } },

  // ---------------- ESCOLHA ----------------
  { type: 'select',     label: 'Lista suspensa',  icon: 'chevron',      category: 'choice',
    caps: { options: true, allowOther: true } },
  { type: 'radio',      label: 'Escolha única',   icon: 'check-circle', category: 'choice',
    caps: { options: true, allowOther: true } },
  { type: 'checkboxes', label: 'Múltipla escolha',icon: 'check',        category: 'choice',
    caps: { options: true, allowOther: true, choiceLimits: true } },
  { type: 'yesno',      label: 'Sim / Não',       icon: 'check-circle', category: 'choice',
    caps: {} },
  { type: 'rating',     label: 'Avaliação (estrelas)', icon: 'star',    category: 'choice',
    caps: { scale: true }, defaults: { max: 5 } },
  { type: 'scale',      label: 'Escala / NPS',    icon: 'spark',        category: 'choice',
    caps: { scale: true }, defaults: { min: 0, max: 10 } },
  { type: 'ranking',    label: 'Ranking (ordenar)',icon: 'drag',        category: 'choice',
    caps: { options: true } },

  // ---------------- AVANÇADO ----------------
  { type: 'file',       label: 'Anexo (arquivo)', icon: 'plus',     category: 'advanced',
    caps: { attachment: true } },
  { type: 'signature',  label: 'Assinatura',      icon: 'edit',     category: 'advanced',
    caps: {} },
  { type: 'address',    label: 'Endereço',        icon: 'pages',    category: 'advanced',
    caps: {} },
  { type: 'matrix',     label: 'Matriz / grade',  icon: 'group',    category: 'advanced',
    caps: { matrix: true } },
  { type: 'slider',     label: 'Controle deslizante', icon: 'filter', category: 'advanced',
    caps: { numeric: true }, defaults: { min: 0, max: 100, step: 1 } },
  { type: 'color',      label: 'Cor',             icon: 'spark',    category: 'advanced',
    caps: {} },

  // ---------------- LAYOUT (não coletam dado) ----------------
  { type: 'heading',    label: 'Título de seção', icon: 'nome',     category: 'layout',
    caps: { staticBlock: true } },
  { type: 'paragraph',  label: 'Texto / instrução',icon: 'manifesto',category: 'layout',
    caps: { staticBlock: true, multiline: true } },
  { type: 'image',      label: 'Imagem',          icon: 'sobre',    category: 'layout',
    caps: { staticBlock: true } },
  { type: 'divider',    label: 'Divisória',       icon: 'marquee',  category: 'layout',
    caps: { staticBlock: true, noLabel: true } },
  { type: 'consent',    label: 'Consentimento (LGPD)', icon: 'check', category: 'layout',
    caps: {} },
  { type: 'hidden',     label: 'Campo oculto',    icon: 'eye-off',  category: 'layout',
    caps: { staticBlock: false } },
];

export const FIELD_TYPE_MAP = Object.fromEntries(FIELD_TYPES.map((t) => [t.type, t]));

export function isStaticField(type) {
  return !!FIELD_TYPE_MAP[type]?.caps?.staticBlock;
}
export function fieldCaps(type) {
  return FIELD_TYPE_MAP[type]?.caps || {};
}

// gera uma chave curta única para a resposta (usada como key no response_data)
let _keySeed = 0;
export function newFieldKey(type) {
  _keySeed += 1;
  return `${type}_${Date.now().toString(36)}${(_keySeed).toString(36)}`;
}

// Cria um campo com TODOS os atributos configuráveis (defaults).
// Cada atributo aqui é uma "configuração possível" do campo.
export function makeField(type) {
  const def = FIELD_TYPE_MAP[type] || FIELD_TYPE_MAP.short_text;
  const caps = def.caps || {};
  const d = def.defaults || {};
  const field = {
    id: newFieldKey(type),
    key: newFieldKey(type),      // chave estável na resposta
    type,
    label: def.label,
    description: '',             // texto de ajuda
    placeholder: '',
    defaultValue: '',
    required: false,
    readonly: false,
    hiddenByDefault: false,      // visível só via lógica condicional
    width: 'full',               // full | half
    prefillParam: '',            // pré-preencher via ?param= da URL

    // validação
    validation: {
      minLen: null, maxLen: null,
      min: null, max: null, step: d.step ?? 1,
      minDate: null, maxDate: null,
      pattern: '',               // regex
      errorMessage: '',          // mensagem custom
    },

    // opções (escolha / ranking / matriz colunas)
    options: caps.options ? ['Opção 1', 'Opção 2'] : [],
    allowOther: false,
    minSelections: null,
    maxSelections: null,

    // escala / avaliação
    scaleMin: d.min ?? 0,
    scaleMax: d.max ?? 5,
    scaleMinLabel: '',
    scaleMaxLabel: '',

    // matriz
    matrixRows: caps.matrix ? ['Linha 1', 'Linha 2'] : [],
    matrixCols: caps.matrix ? ['Coluna 1', 'Coluna 2'] : [],
    matrixMultiple: false,

    // anexo
    fileMaxMb: 10,
    fileMaxCount: 1,
    fileAccept: '',              // ex.: ".pdf,image/*"

    // estático (heading/paragraph/image/divider)
    content: caps.staticBlock ? (type === 'heading' ? 'Título' : type === 'paragraph' ? 'Texto explicativo…' : '') : '',
    imageUrl: '',

    // lógica condicional: mostrar este campo SE (regras)
    logic: { action: 'show', match: 'all', rules: [] }, // rules: [{ field, op, value }]

    icon: def.icon || 'edit',
  };
  return field;
}

// ---- Defaults das configurações do FORMULÁRIO (settings JSONB) ----
export function defaultFormSettings() {
  return {
    // aparência (dentro da identidade creme+verde)
    theme: { accent: '#4A5C36', surface: '#EDDFC2' },
    coverImage: '',
    showFlora: true,            // flores secas SVG estáticas no fundo
    layoutColumns: 1,           // 1 | 2

    // fluxo
    multiStep: false,           // usar quebras de página como etapas
    showProgress: true,
    introScreen: { enabled: false, title: '', text: '' },
    submitLabel: 'Enviar',

    // pós-envio
    successMessage: 'Recebemos sua resposta. Obrigado!',
    redirectUrl: '',

    // limites / acesso (status e is_listed ficam em colunas próprias)
    onePerPerson: false,
    captureMeta: true,          // guardar ip/user agent

    // anti-spam
    honeypot: true,
    captcha: false,

    // LGPD
    consentText: '',

    // notificações (fase 2 — placeholders)
    notifyEmails: [],
    confirmToRespondent: false,
  };
}

export function emptyFormSchema() {
  return { pages: [{ id: 'p1', title: '', fields: [] }] };
}
