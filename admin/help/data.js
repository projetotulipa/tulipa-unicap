// Help system — textos de "como funciona este módulo" exibidos discretamente
// no topo de cada painel admin (Presença, Financeiro, Pesquisa, Mídia).
// Editáveis via /admin/#/paginas pelo admin.
//
// Armazenamento: tabela site_content com scope `help:<slot>` (reusa infra
// existente). data jsonb: { title, body } onde body é markdown leve.

import { supabase } from '../../js/supabase.js';

// ===== Conteúdo padrão (fallback se não houver edição salva) =====
// markdown leve compatível com mdToHtml: **negrito**, *itálico*, ## headings, linhas em branco, listas com -

const DEFAULTS = {
  presenca: {
    title: 'Como funciona a Secretaria',
    body:
`## O que a Secretaria sustenta

A Secretaria garante que o projeto funcione com **clareza, previsibilidade e formalidade** — características que sustentam a transição da TULIPA em Liga Acadêmica. Junto com a Tesouraria, é o departamento estrutural.

## Atribuições contínuas

- **Controle de presença** — manter listas atualizadas por grupo, padronizar o modelo de chamada, salvar tudo no Drive institucional.
- **Lembrete dos encontros** — mensagem interna algumas horas antes, horário e grupo corretos.
- **Identificação de faltosos** — cruzar presenças com limites, emitir alerta interno ao Diretor e à Presidência.
- **Resumo do encontro** — grupo + data + facilitador + tema + 2-3 linhas. Não é fichamento (esse é da Pesquisa).
- **Distribuição por grupo** — cada membro vinculado a 1-N grupos, acompanha demandas e supervisão.

## Critério de ausência

- **1ª falta**: sem ação, apenas registrar.
- **2ª falta consecutiva**: alertar o Diretor e em seguida a Presidência.
- *Quem contata o faltoso é a Presidência, não a Secretaria.*

## Métricas de avaliação

Resumos no prazo · precisão das presenças · regularidade quinzenal · organização do Drive · clareza da comunicação · vistoria das gravações · estabilidade dos processos.

## Direção

**Pedro Bacelar** mantém visão geral e decisão final. Pode delegar funções estratégicas: supervisão geral, distribuição de tarefas, controle de prazos, comunicação com a Presidência, qualidade dos resumos, consolidação quinzenal.`,
  },

  financeiro: {
    title: 'Como funciona a Tesouraria',
    body:
`## O que a Tesouraria sustenta

A Tesouraria é o cuidado material do projeto. Cada moeda contada, cada balanço selado. Junto com a Secretaria, mantém a saúde estrutural da TULIPA.

## Atribuições contínuas

- **Mensalidades** — acompanhar quem pagou no mês, registrar valor padrão e individual quando aplicável.
- **Gastos** — registrar cada gasto com categoria (alimentação, materiais, excepcionais, investimentos), data e valor. Excepcionais exigem descrição.
- **Planejamento** — anotar destinos previstos e marcar como concluído quando virar gasto real.
- **Relatórios** — síntese mensal e fechamento de balanço.

## Direção

Mantém visão geral das contas, controle do fluxo (entradas vs despesas), comunicação com a Presidência quando houver pendência ou sobra excepcional.`,
  },

  pesquisa: {
    title: 'Como funciona o Dep. de Pesquisa',
    body:
`## O que a Pesquisa sustenta

O Departamento de Pesquisa é o lugar da produção científica da TULIPA. Cuida da escrita, dos fichamentos teóricos, das publicações no Instagram e da articulação com os grupos de estudo.

## Atribuições contínuas

- **Fichamentos** — registros teóricos (bibliográfico, citação, resumo, analítico) das aulas e encontros.
- **Posts no Instagram** — converter fichamentos em conteúdo digerível, enviar à Mídia para arte, agendar publicação.
- **Equipes de pesquisa** — sub-equipes com foco e ritmo próprios.
- **Pipeline editorial** — rascunho → enviado à Mídia → agendado → publicado.

## Direção

Mantém o ritmo dos fichamentos, qualidade da escrita, conexão com a Mídia (para arte) e com a Presidência (alinhamento institucional).`,
  },

  midia: {
    title: 'Como funciona o Dep. de Mídia',
    body:
`## O que o Dep. de Mídia sustenta

Artes & Mídias é o setor criativo da TULIPA. Recebe os posts da Pesquisa, transforma em arte visual e publica no Instagram. Cuida da identidade visual e da presença pública do projeto.

## Atribuições contínuas

- **Tarefas** — kanban por status (a fazer, em produção, concluído), com prazo, equipe e pessoa responsáveis.
- **Posts recebidos** — conteúdos enviados pela Pesquisa que precisam de arte.
- **Equipes de mídia** — sub-equipes com cargas distribuídas.
- **Calendário** — programação visual dos próximos lançamentos.

## Direção

Coordena o fluxo de produção, distribui tarefas conforme carga das equipes, garante padrão visual e prazo de entrega.`,
  },
};

export const HELP_SLOTS = [
  { slot: 'presenca',   adminHash: '#/presenca',   label: 'Presença'        },
  { slot: 'financeiro', adminHash: '#/financeiro', label: 'Tesouraria'      },
  { slot: 'pesquisa',   adminHash: '#/pesquisa',   label: 'Pesquisa'        },
  { slot: 'midia',      adminHash: '#/midia',      label: 'Artes & Mídias'  },
];

export function helpSlotByKey(slot) {
  return HELP_SLOTS.find((s) => s.slot === slot);
}

export function helpDefault(slot) {
  return DEFAULTS[slot] || { title: 'Como funciona', body: '' };
}

const LS_HELP_CACHE = 'tulipa:help-cache';
let cache = readCache();

function readCache() {
  try {
    const raw = localStorage.getItem(LS_HELP_CACHE);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function writeCache() {
  try { localStorage.setItem(LS_HELP_CACHE, JSON.stringify(cache)); } catch {}
}

// Retorna { title, body, isDefault, version? } com fallback pro DEFAULTS.
export async function getHelpContent(slot) {
  const fallback = helpDefault(slot);
  const scope = `help:${slot}`;

  try {
    const { data, error } = await supabase
      .from('site_content')
      .select('data, version')
      .eq('scope', scope)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data?.data) {
      const content = {
        title: (data.data.title && String(data.data.title).trim()) || fallback.title,
        body: data.data.body != null ? String(data.data.body) : fallback.body,
        isDefault: false,
        version: data.version,
      };
      cache[slot] = content;
      writeCache();
      return content;
    }
  } catch {}

  // sem dado salvo: tenta cache, senão default
  if (cache[slot]?.title) return cache[slot];
  return { ...fallback, isDefault: true };
}

// Salva conteúdo do help (insere nova versão em site_content).
export async function setHelpContent(slot, { title, body }) {
  const scope = `help:${slot}`;
  try {
    const { data: userResp } = await supabase.auth.getUser();
    if (!userResp?.user) throw new Error('não autenticado');
    const version = Date.now();
    const payload = {
      title: String(title || '').trim() || helpDefault(slot).title,
      body: String(body || ''),
    };
    const { error } = await supabase
      .from('site_content')
      .insert({
        scope,
        version,
        data: payload,
        note: `help:${slot} editado`,
        published_by: userResp.user.id,
      });
    if (error) throw error;
    cache[slot] = { ...payload, isDefault: false, version };
    writeCache();
    return { data: { version }, error: null };
  } catch (e) {
    return { data: null, error: e };
  }
}

// Restaura ao padrão (apenas limpa cache; a próxima leitura sem snapshot novo cai no DEFAULTS).
// Para "esquecer" o último snapshot, inserimos um marcador com defaultContent.
export async function resetHelpContent(slot) {
  const def = helpDefault(slot);
  return setHelpContent(slot, def);
}

// Carrega todos pra UI de edição em /paginas.
export async function listAllHelpContent() {
  const result = {};
  await Promise.all(HELP_SLOTS.map(async (s) => {
    result[s.slot] = await getHelpContent(s.slot);
  }));
  return result;
}
