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

A Tesouraria administra os **recursos financeiros e materiais** do projeto. Embora a iniciativa seja voluntária, sua execução depende de organização para encontros, eventos e ações acadêmicas. Junto com a Secretaria, é o departamento estrutural.

## Funções centrais

- **Contribuição mensal** — cobrança voluntária de R$ 5,00 no início de cada mês, com mensagem padrão + chave PIX no grupo geral. Não é obrigatória; o extensionista comunica se não puder.
- **Cobrança de inadimplentes** — primeiro no grupo geral (marca quem não pagou); ~1 mês depois, no privado, tom respeitoso. A contribuição é voluntária — manter acolhimento.
- **Gestão de caixa** — planilha de entradas/saídas/saldo sempre atualizada; notas fiscais e comprovantes arquivados no Drive. Toda movimentação registrada.
- **Fundo de reserva** — valor mínimo sugerido R$ 50/mês investido em aplicação segura (poupança/CDB). Decisão conjunta com a Presidência.

## Tesouros materiais

A Tesouraria cuida da logística dos encontros presenciais:
- **Lanches** — bolos, biscoitos, café e chá conforme o encontro.
- **Descartáveis** — copos, pratinhos, guardanapos, talheres.
- **Banner & porta-banner** — podem ficar com a Presidência ou membros com carro.
- **Materiais de apoio** — itens específicos pedidos pelos facilitadores.

*Grupos online não têm demanda material.*

## Eventos, jornadas & simpósios

Processo logístico em 5 etapas:

1. **Levantar fornecedores** — pesquisar opções, comparar qualidade e custo.
2. **Solicitar orçamentos** — por escrito, manter histórico.
3. **Coordenar compras aprovadas** — após validação da Presidência.
4. **Armazenar notas e comprovantes** — toda movimentação documentada.
5. **Entregar materiais** — no local, no horário, em quantidade certa.

## Responsáveis por grupo

Cada grupo presencial deve ter **um responsável da Tesouraria** dedicado: organiza o lanche, verifica materiais, coordena o banner quando necessário, comunica demandas extras ao diretor.

## Direção

**Fabrício** coordena o fluxo financeiro: revisão de planilhas, envio mensal de cobranças, acompanhamento de inadimplência, fundo de reserva (com Presidência), coordenação de compras, supervisão logística dos encontros, finanças de eventos, organização do Drive, recrutamento de novos membros.`,
  },

  pesquisa: {
    title: 'Como funciona o Dep. de Pesquisa',
    body:
`## O que a Pesquisa sustenta

O Departamento de Pesquisa é o **núcleo intelectual, teórico e metodológico** da TULIPA. Cuida da produção de conhecimento, do rigor conceitual e da sustentação científica do projeto — pelos fichamentos, pelas revisões, pelo mapeamento de periódicos e por futuras publicações.

## Estrutura interna (5 setores)

- **Fichamentos** — elabora os fichamentos teóricos (um por encontro de cada grupo).
- **Revisão Teórica** — revisa textos enviados pela Mídia antes da publicação.
- **Artigos & Projetos** — organiza ideias, construção de manuscritos e núcleos de escrita.
- **Sondagem de Periódicos** — mapeia revistas, editais e oportunidades de publicação.
- **Mini-Secretaria da Pesquisa** — organiza o Drive próprio e o acesso às gravações.

## Fichamento teórico (demanda central)

Documento acadêmico que aprofunda, registra e fundamenta o que foi discutido em cada encontro.

- **Conteúdo**: texto desenvolvido, 1-3 páginas (mais se necessário), referências bibliográficas obrigatórias, análise teórica, formatação ABNT ou APA.
- **Distribuição**: cada grupo tem 2-3 membros responsáveis, podem se alternar semanalmente. Salvar no Drive (Pesquisa → Fichamentos → grupo). Pode usar gravação quando o membro não pôde estar presente.
- **Prazo**: até **7 dias após o encontro** (norma — salvo raras exceções definidas pela diretoria).

## Revisão teórica × Mídia

**Nenhum post do Instagram sai sem checagem da Pesquisa.** Fluxo correto:

1. Mídia sugere o post e envia o texto à Pesquisa.
2. Pesquisa revisa teórica/conceitualmente (pode discutir no grupo geral).
3. Pesquisa devolve o texto validado.
4. Mídia produz a arte e publica.

Norma de prazo: **revisão em até 48h (ideal 24h)**. Mídia só publica após o retorno.

## Produção de conteúdo próprio

A Pesquisa também sugere conteúdos: **1-2 ideias de post por mês** baseadas em fichamentos. Textos curtos ou carrosséis, com referências. Reduz a dependência de conteúdo genérico e valoriza a produção interna.

## Sondagem de periódicos & editais

Setor fundamental para o futuro da Liga Acadêmica. Para cada revista mapeada, verificar: Qualis, temáticas aceitas, periodicidade, regras de submissão, prazos, tipos de artigos. Avisar a Presidência quando edital relevante estiver aberto. Propor núcleos de escrita.

## Drive da Pesquisa

Pastas: fichamentos por grupo · revisões teóricas · artigos & projetos futuros · periódicos & editais · apontamento para gravações (Secretaria).

## Direção

**Nilo Fam** (Diretor) e **Pedro Emmanuel** (Coordenador Geral) mantêm a Pesquisa viva, organizada e produtiva: distribuição de fichamentos, cumprimento de prazos, comunicação com Mídia/Secretaria/Presidência, organização do Drive, núcleos de escrita, mobilização da equipe, feedback de qualidade teórica, ativação para editais.`,
  },

  midia: {
    title: 'Como funciona o Dep. de Mídia',
    body:
`## O que o Dep. de Mídia sustenta

**Artes & Mídias** é o setor criativo da TULIPA — onde a psicologia analítica encontra o estético-visual. Cuida do rosto, da voz e da presença pública do projeto. Cada peça é pequeno gesto curatorial: não vendemos a TULIPA, apresentamos.

## Atribuições contínuas

- **Instagram @tulipa.unicap** — posts, stories, reels, divulgação de eventos e atividades.
- **Identidade visual** — manutenção da coerência estética (paleta, tipografia, motivos botânicos, tons junguianos).
- **Cartazes & materiais de evento** — processos seletivos, oficinas, palestras, mesas redondas.
- **Curadoria de imagens & citações** — selecionar o que sai como voz pública da TULIPA.
- **Site & presença web** — manutenção desta página e demais canais digitais.

## Fluxo com a Pesquisa

Nenhum post sai sem revisão teórica:

1. Mídia sugere o post e envia o texto à Pesquisa.
2. Pesquisa revisa (24-48h).
3. Pesquisa devolve validado.
4. Mídia produz a arte e publica.

A Pesquisa também sugere conteúdos próprios (1-2 ideias/mês) baseados em fichamentos.

## Estrutura interna (no admin)

- **Tarefas** — kanban por status (a fazer / em produção / concluído) com prazo, equipe e pessoa responsáveis.
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
