// TULIPA · forms · templates pré-prontos pra criar formulários em segundos.
// Cada template retorna { title, description, schema, settings (parcial) }.
// O createForm aplica em cima dos defaults.

import { makeField, defaultFormSettings, emptyFormSchema } from './field-types.js';

function customize(type, patch = {}) {
  return { ...makeField(type), ...patch };
}

function singlePage(fields, pageTitle = '') {
  return { pages: [{ id: 'p1', title: pageTitle, fields }] };
}

// ---------- catálogo ----------
export const FORM_TEMPLATES = [
  {
    id: 'blank',
    label: 'Em branco',
    icon: 'edit',
    description: 'Comece do zero, sem campos.',
    build: () => ({
      title: 'Novo formulário',
      description: '',
      schema: emptyFormSchema(),
      settingsPatch: {},
    }),
  },

  {
    id: 'presence',
    label: 'Confirmação de presença',
    icon: 'check-circle',
    description: 'Vai vir no encontro? (sim/não + observação)',
    build: () => ({
      title: 'Confirmação de presença',
      description: 'Confirme se vai participar do próximo encontro.',
      schema: singlePage([
        customize('short_text', {
          label: 'Seu nome',
          placeholder: 'Como te chamamos',
          required: true,
        }),
        customize('yesno', {
          label: 'Vai vir ao encontro?',
          required: true,
        }),
        customize('long_text', {
          label: 'Observação (opcional)',
          placeholder: 'Algo que queira nos contar?',
          required: false,
        }),
      ]),
      settingsPatch: {
        submitLabel: 'Confirmar',
        successMessage: 'Confirmação recebida. Até lá!',
      },
    }),
  },

  {
    id: 'event-signup',
    label: 'Inscrição em evento',
    icon: 'calendar',
    description: 'Nome, e-mail, telefone, vínculo, LGPD.',
    build: () => ({
      title: 'Inscrição',
      description: 'Preencha pra garantir sua vaga.',
      schema: singlePage([
        customize('short_text', {
          label: 'Nome completo',
          required: true,
        }),
        customize('email', {
          label: 'E-mail',
          placeholder: 'voce@exemplo.com',
          required: true,
        }),
        customize('phone', {
          label: 'Telefone (WhatsApp)',
          placeholder: '(81) 9 9999-9999',
          required: true,
        }),
        customize('radio', {
          label: 'Seu vínculo',
          options: ['Estudante de Psicologia', 'Profissional', 'Estudante de outra área', 'Outro'],
          allowOther: true,
          required: true,
        }),
        customize('consent', {
          label: 'Aceito o tratamento dos meus dados conforme a LGPD',
          required: true,
        }),
      ]),
      settingsPatch: {
        submitLabel: 'Quero me inscrever',
        successMessage: 'Inscrição recebida! Em breve entramos em contato.',
        consentText: 'Seus dados serão usados apenas para organização deste evento e contato direto da TULIPA. Não compartilhamos com terceiros.',
      },
    }),
  },

  {
    id: 'feedback',
    label: 'Feedback (5 estrelas)',
    icon: 'star',
    description: 'Avaliação rápida + comentário livre.',
    build: () => ({
      title: 'Como foi pra você?',
      description: 'Sua avaliação ajuda a gente a melhorar.',
      schema: singlePage([
        customize('heading', {
          content: 'Sua opinião conta',
        }),
        customize('rating', {
          label: 'Como você avalia esta atividade?',
          scaleMin: 1,
          scaleMax: 5,
          required: true,
        }),
        customize('scale', {
          label: 'Quão provável você é de recomendar pra alguém?',
          scaleMin: 0,
          scaleMax: 10,
          scaleMinLabel: 'Nada provável',
          scaleMaxLabel: 'Muito provável',
          required: true,
        }),
        customize('long_text', {
          label: 'Comentário (opcional)',
          placeholder: 'O que mais marcou? O que dava pra melhorar?',
          required: false,
        }),
      ]),
      settingsPatch: {
        submitLabel: 'Enviar avaliação',
        successMessage: 'Obrigada pelo retorno!',
      },
    }),
  },

  {
    id: 'suggestion',
    label: 'Sugestão anônima',
    icon: 'manifesto',
    description: 'Caixa de sugestões — sem identificação obrigatória.',
    build: () => ({
      title: 'Caixa de sugestões',
      description: 'Compartilhe ideias, críticas ou elogios. Identificar-se é opcional.',
      schema: singlePage([
        customize('long_text', {
          label: 'Sua mensagem',
          placeholder: 'Conte o que você gostaria que a gente soubesse',
          required: true,
          validation: { ...makeField('long_text').validation, minLen: 10 },
        }),
        customize('short_text', {
          label: 'Seu nome (opcional)',
          required: false,
        }),
        customize('email', {
          label: 'E-mail (opcional, só se quiser resposta)',
          required: false,
        }),
      ]),
      settingsPatch: {
        submitLabel: 'Enviar sugestão',
        successMessage: 'Recebemos. Obrigada pelo cuidado.',
        captureMeta: false,
      },
    }),
  },

  {
    id: 'survey',
    label: 'Pesquisa rápida',
    icon: 'spark',
    description: '3 perguntas de escala 1-5 + comentário.',
    build: () => ({
      title: 'Pesquisa',
      description: 'São só 4 perguntas — leva menos de um minuto.',
      schema: singlePage([
        customize('scale', {
          label: 'Pergunta 1',
          scaleMin: 1,
          scaleMax: 5,
          scaleMinLabel: 'Discordo totalmente',
          scaleMaxLabel: 'Concordo totalmente',
          required: true,
        }),
        customize('scale', {
          label: 'Pergunta 2',
          scaleMin: 1,
          scaleMax: 5,
          scaleMinLabel: 'Discordo totalmente',
          scaleMaxLabel: 'Concordo totalmente',
          required: true,
        }),
        customize('scale', {
          label: 'Pergunta 3',
          scaleMin: 1,
          scaleMax: 5,
          scaleMinLabel: 'Discordo totalmente',
          scaleMaxLabel: 'Concordo totalmente',
          required: true,
        }),
        customize('long_text', {
          label: 'Quer comentar algo?',
          required: false,
        }),
      ]),
      settingsPatch: {
        submitLabel: 'Enviar respostas',
        successMessage: 'Obrigada por responder!',
      },
    }),
  },
];

export const TEMPLATE_MAP = Object.fromEntries(FORM_TEMPLATES.map((t) => [t.id, t]));

// Constrói o payload pronto pra createForm a partir de um template id.
export function buildFromTemplate(id) {
  const tpl = TEMPLATE_MAP[id] || TEMPLATE_MAP.blank;
  const built = tpl.build();
  return {
    title: built.title,
    description: built.description || '',
    schema: built.schema,
    settings: { ...defaultFormSettings(), ...(built.settingsPatch || {}) },
  };
}
