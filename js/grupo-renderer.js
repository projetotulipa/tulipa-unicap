// TULIPA · LP filha de UM grupo de estudo
// Lê ?id=<slug> da URL, busca o grupo no Supabase e renderiza tudo dinamicamente.

import {
  getStudyGroupBySlug,
  getStudyGroupMeetings,
  getStudyGroupFichamentos,
  getStudyGroupResources,
  getMeetingPages,
  RESOURCE_KINDS,
  RESOURCE_GROUPS,
  youtubeId,
  driveInfo,
} from './study-groups.js';
import { coverIcon } from './study-group-icons.js';

const APP = document.getElementById('grupoApp');

function getSlug() {
  const params = new URLSearchParams(location.search);
  return params.get('id') || params.get('slug') || '';
}

async function init() {
  const slug = getSlug();
  if (!slug) {
    renderError({ title: 'Grupo não especificado', message: 'Use o link completo com o identificador do grupo.' });
    return;
  }

  const { data: group, error } = await getStudyGroupBySlug(slug);
  if (error) {
    renderError({ title: 'Erro ao carregar', message: error.message });
    return;
  }
  if (!group || !group.is_published) {
    renderError({
      title: 'Folha não encontrada',
      message: 'Esse grupo não está publicado ou o link expirou. Volte para a página geral pra ver os grupos disponíveis.',
    });
    return;
  }

  // Pretty URL: troca /grupo.html?id=<slug> por /<slug> na barra (sem reload)
  prettyUrl(group.slug);

  // SEO meta
  applyMeta(group);

  // busca em paralelo encontros + fichamentos + recursos
  const [meetingsRes, fichRes, resourcesRes] = await Promise.all([
    getStudyGroupMeetings(group.group_id),
    getStudyGroupFichamentos(group.group_id),
    getStudyGroupResources(group.page_id, { onlyVisible: true }),
  ]);

  const meetings = meetingsRes.data || [];
  const fichamentos = fichRes.data || [];
  const resources = resourcesRes.data || [];

  // busca meeting_pages (anon só recebe quem é public AND grupo published)
  const meetingIds = meetings.map((m) => m.id);
  const pagesRes = await getMeetingPages(meetingIds);
  const meetingPages = pagesRes.data || {};

  // filtra meetings sem meeting_page público (RLS já cuida do lado servidor, mas
  // a tabela meeting_pages pode não existir — nesse caso é_public default true).
  // Pra anon, se meeting_page existe mas é_public=false, não retornou no select acima
  // — então usamos a presença como proxy de "público". Mas pra usuário autenticado
  // a chamada retorna tudo. Aqui apenas filtramos os que TÊM page com is_public=false
  // explicitamente. Sem page = assume público (default).
  const hiddenMeetingIds = new Set();
  // só pra anon (em authenticado, vemos tudo): inspeciona is_public dos retornados
  for (const id of meetingIds) {
    const mp = meetingPages[id];
    if (mp && mp.is_public === false) hiddenMeetingIds.add(id);
  }
  const visibleMeetings = meetings.filter((m) => !hiddenMeetingIds.has(m.id));

  render(group, { meetings: visibleMeetings, fichamentos, resources, meetingPages });
}

function prettyUrl(slug) {
  // só faz sentido se atualmente estamos em grupo.html (não se já viemos do redirect)
  if (!/\/grupo\.html$/.test(location.pathname)) return;
  const newPath = location.pathname.replace(/\/grupo\.html$/, `/${encodeURIComponent(slug)}`);
  try {
    history.replaceState({}, '', newPath + location.hash);
  } catch {}
}

function applyMeta(group) {
  const title = `${group.group_name} — Grupos de Estudo · TULIPA`;
  document.title = title;
  document.querySelector('meta[name="description"]')?.setAttribute('content',
    group.lede ? stripHtml(group.lede).slice(0, 160) : `Grupo de estudo da TULIPA: ${group.group_name}`);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content',
    group.lede ? stripHtml(group.lede).slice(0, 200) : `Encontros, fichamentos e material complementar do grupo "${group.group_name}".`);
  // accent na tag theme-color
  const accentMap = {
    wine: '#5C2230', rose: '#9F5A6B', sage: '#8FA084', gold: '#C8A14A',
    moss: '#4A5C36', plum: '#7B5EA7', cream: '#EDDFC2',
  };
  const tc = document.querySelector('meta[name="theme-color"]');
  if (tc && accentMap[group.accent_color]) tc.setAttribute('content', accentMap[group.accent_color]);

  // schema.org
  const ldJson = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOccupationalProgram',
    name: group.group_name,
    description: stripHtml(group.lede || group.about_md || ''),
    provider: {
      '@type': 'EducationalOrganization',
      name: 'TULIPA — UNICAP',
      url: 'https://projetotulipa.github.io/tulipa-unicap/',
    },
    url: location.href,
  };
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(ldJson);
  document.head.appendChild(script);
}

function render(group, { meetings, fichamentos, resources, meetingPages }) {
  const accent = group.accent_color || 'wine';
  document.body.classList.add(`grupo-accent--${accent}`);

  // agrupa fichamentos por meeting
  const fichByMeeting = new Map();
  const fichExtras = [];
  for (const f of fichamentos) {
    if (f.meeting_id) {
      if (!fichByMeeting.has(f.meeting_id)) fichByMeeting.set(f.meeting_id, []);
      fichByMeeting.get(f.meeting_id).push(f);
    } else {
      fichExtras.push(f);
    }
  }

  // agrupa resources POR meeting (pra renderizar dentro do encontro)
  const resByMeeting = new Map();
  // E resources SEM meeting (pool geral, pra seção Material complementar)
  const resPool = [];
  for (const r of resources) {
    if (r.meeting_id) {
      if (!resByMeeting.has(r.meeting_id)) resByMeeting.set(r.meeting_id, []);
      resByMeeting.get(r.meeting_id).push(r);
    } else {
      resPool.push(r);
    }
  }

  // agrupa resources do pool por group (vídeos, leituras, cultura, links, mídia, outros)
  const resByGroup = new Map();
  for (const r of resPool) {
    const kindMeta = RESOURCE_KINDS.find((k) => k.value === r.kind);
    const grp = kindMeta?.group || 'other';
    if (!resByGroup.has(grp)) resByGroup.set(grp, []);
    resByGroup.get(grp).push(r);
  }

  // numera meetings cronologicamente ASC
  const sortedAsc = [...meetings].sort((a, b) => (a.date > b.date ? 1 : -1));
  const indexById = new Map();
  sortedAsc.forEach((m, i) => indexById.set(m.id, i + 1));

  APP.innerHTML = `
    ${heroHtml(group)}
    ${group.about_md ? aboutHtml(group) : ''}
    ${group.method_md ? methodHtml(group) : ''}
    ${meetings.length > 0 || fichExtras.length > 0 ? meetingsHtml(meetings, { fichByMeeting, fichExtras, resByMeeting, meetingPages, indexById }) : ''}
    ${resPool.length > 0 ? resourcesHtml(resByGroup) : ''}
    ${allosCtaHtml()}
    ${outrosCtaHtml()}
  `;

  // bind toggles de fichamento
  APP.querySelectorAll('[data-ficho-toggle]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.fichoToggle;
      const body = APP.querySelector(`[data-ficho-body="${id}"]`);
      if (body) {
        body.toggleAttribute('hidden');
        el.setAttribute('aria-expanded', String(!body.hasAttribute('hidden')));
      }
      el.querySelector('.grupo-fich__chev')?.classList.toggle('is-open');
    });
    el.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); el.click(); }
    });
  });

  // lazy iframes via IntersectionObserver
  initLazyEmbeds();

  // botão "compartilhar" do hero
  bindShareButton();
}

// ---------- sections ----------
function heroHtml(g) {
  const hasCover = !!g.cover_image_url;
  return `
    <header class="hero hero--lp grupo-hero grupo-hero--${g.accent_color || 'wine'} ${hasCover ? 'grupo-hero--has-cover' : ''}" id="topo">
      ${hasCover ? `
        <div class="grupo-hero__cover" aria-hidden="true">
          <img src="${escapeAttr(g.cover_image_url)}" alt="" onerror="this.parentElement.style.display='none'" />
          <div class="grupo-hero__cover-overlay"></div>
        </div>
      ` : `
        <div class="hero__mesh" aria-hidden="true">
          <span class="blob blob--1"></span>
          <span class="blob blob--2"></span>
          <span class="blob blob--3"></span>
          <span class="blob blob--4"></span>
          <span class="blob blob--5"></span>
        </div>
        <svg class="hero__noise" aria-hidden="true">
          <filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/></filter>
          <rect width="100%" height="100%" filter="url(#noise)"/>
        </svg>
        <div class="petals" id="petals" aria-hidden="true"></div>
      `}
      <div class="hero__content">
        <p class="hero__breadcrumb"><a href="../grupos-de-estudo.html">← Grupos de Estudo</a></p>
        ${hasCover ? '' : `<div class="grupo-hero__emoji" aria-hidden="true">${coverIcon(g.cover_emoji || 'book', 56)}</div>`}
        ${g.hero_eyebrow ? `<p class="hero__eyebrow">${escapeHtml(g.hero_eyebrow)}</p>` : ''}
        <h1 class="hero__title hero__title--single">
          <span class="hero__title-display">${escapeHtml(g.group_name || '')}</span>
        </h1>
        ${g.hero_subtitle ? `
          <p class="hero__sub"><span class="rule"></span><em>${escapeHtml(g.hero_subtitle)}</em><span class="rule"></span></p>
        ` : ''}
        ${g.lede ? `<p class="hero__lede">${escapeHtml(g.lede)}</p>` : ''}
        <button class="grupo-share" type="button" data-share aria-label="Copiar link desta folha">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
            <path d="M10 13 L14 11"/>
            <circle cx="6" cy="14" r="3"/>
            <circle cx="18" cy="6" r="3"/>
            <circle cx="18" cy="18" r="3"/>
            <path d="M10 15 L14 17"/>
          </svg>
          <span>compartilhar</span>
        </button>
      </div>
    </header>
  `;
}

function bindShareButton() {
  const btn = APP.querySelector('[data-share]');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const url = location.href;
    const title = document.title;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      btn.classList.add('is-copied');
      const orig = btn.querySelector('span').textContent;
      btn.querySelector('span').textContent = 'copiado!';
      setTimeout(() => {
        btn.classList.remove('is-copied');
        btn.querySelector('span').textContent = orig;
      }, 2000);
    } catch {
      // user cancelou o share — ignora
    }
  });
}

function aboutHtml(g) {
  return `
    <section class="section section--sobre" id="sobre">
      <div class="section__inner section--lp">
        <p class="eyebrow"><span>·</span> Sobre este grupo</p>
        <div class="grupo-prose">${renderMarkdown(g.about_md)}</div>
      </div>
    </section>
  `;
}

function methodHtml(g) {
  return `
    <section class="section section--detalhes" id="metodo">
      <div class="section__inner section--lp">
        <p class="eyebrow"><span>·</span> Como funciona</p>
        <div class="grupo-prose">${renderMarkdown(g.method_md)}</div>
      </div>
    </section>
  `;
}

function meetingsHtml(meetings, { fichByMeeting, fichExtras, resByMeeting, meetingPages, indexById }) {
  return `
    <section class="section section--missao grupo-timeline-section" id="encontros">
      <div class="section__inner section--lp">
        <p class="eyebrow eyebrow--light"><span>·</span> Encontros</p>
        <h2>O que aconteceu nos encontros.</h2>
        <p class="grupo-section__hint">Cada encontro tem seu próprio espaço — resumo, fichamentos e material complementar.</p>

        ${meetings.length > 0 ? `
          <div class="grupo-timeline-v2">
            ${meetings.map((m) => meetingCardHtml(m, {
              fichs: fichByMeeting.get(m.id) || [],
              resources: resByMeeting.get(m.id) || [],
              page: meetingPages[m.id],
              index: indexById.get(m.id),
            })).join('')}
          </div>
        ` : ''}

        ${fichExtras.length > 0 ? `
          <div class="grupo-fichamentos-extras">
            <p class="grupo-fich-extras__title">Fichamentos avulsos</p>
            <p class="grupo-section__hint" style="margin-bottom: 14px;">Sem encontro vinculado — leituras autônomas do grupo.</p>
            <div class="grupo-fichamentos">
              ${fichExtras.map(fichCardHtml).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    </section>
  `;
}

function meetingCardHtml(m, { fichs, resources, page: mp, index }) {
  const date = new Date(m.date + 'T12:00:00');
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
  const year = date.getFullYear();
  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' });

  const statusLabel = { happened: 'realizado', scheduled: 'agendado', cancelled: 'cancelado' }[m.status] || m.status;
  const statusClass = { happened: 'happened', scheduled: 'scheduled', cancelled: 'cancelled' }[m.status] || 'muted';

  const hasContent = (mp?.summary_md?.trim()?.length > 0) || fichs.length > 0 || resources.length > 0;

  // título: primeira linha do summary (com #) ou vazio
  const summaryFirstLine = (mp?.summary_md || '').split('\n').find((l) => l.trim())?.replace(/^#+\s*/, '').trim();

  return `
    <article class="grupo-meeting-v2 grupo-meeting-v2--${statusClass} ${!hasContent ? 'is-empty' : ''}" id="encontro-${index}">
      <div class="grupo-meeting-v2__capsule" aria-hidden="true">
        <span class="grupo-meeting-v2__day">${day}</span>
        <span class="grupo-meeting-v2__month">${escapeHtml(month)}</span>
        <span class="grupo-meeting-v2__year">${year}</span>
        <span class="grupo-meeting-v2__weekday">${escapeHtml(weekday.slice(0, 3))}</span>
      </div>

      <div class="grupo-meeting-v2__main">
        <header class="grupo-meeting-v2__head">
          <p class="grupo-meeting-v2__crumb">
            <span>Encontro #${index}</span>
            <span class="grupo-meeting-v2__sep">·</span>
            <span class="grupo-meeting-v2__status grupo-meeting-v2__status--${statusClass}">${escapeHtml(statusLabel)}</span>
          </p>
          ${summaryFirstLine ? `<h3 class="grupo-meeting-v2__title">${escapeHtml(summaryFirstLine)}</h3>` : ''}
          <a class="grupo-meeting-v2__share" href="#encontro-${index}" aria-label="Link deste encontro">${shareIcon()}</a>
        </header>

        ${!hasContent ? `
          <p class="grupo-meeting-v2__empty"><em>sem registro detalhado deste encontro ainda.</em></p>
        ` : ''}

        ${mp?.summary_md?.trim() ? `
          <div class="grupo-meeting-v2__summary grupo-prose">
            ${renderMarkdown(mp.summary_md)}
          </div>
        ` : ''}

        ${fichs.length > 0 ? `
          <div class="grupo-meeting-v2__section">
            <h4 class="grupo-meeting-v2__section-title">${fichs.length === 1 ? 'Fichamento' : 'Fichamentos'}</h4>
            <div class="grupo-fichamentos">
              ${fichs.map(fichCardHtml).join('')}
            </div>
          </div>
        ` : ''}

        ${resources.length > 0 ? `
          <div class="grupo-meeting-v2__section">
            <h4 class="grupo-meeting-v2__section-title">Material deste encontro</h4>
            <div class="grupo-meeting-v2__resources">
              ${resources.map(resourceCardHtml).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    </article>
  `;
}

function fichCardHtml(f) {
  const created = f.created_at ? new Date(f.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
  return `
    <article class="grupo-fich">
      <button class="grupo-fich__head" data-ficho-toggle="${escapeAttr(f.id)}" aria-expanded="false" type="button">
        <span class="grupo-fich__chev" aria-hidden="true">▸</span>
        <span class="grupo-fich__main">
          <strong>${escapeHtml(f.title || '(sem título)')}</strong>
          <span class="grupo-fich__meta">fichamento · ${escapeHtml(created)}</span>
        </span>
      </button>
      <div class="grupo-fich__body" data-ficho-body="${escapeAttr(f.id)}" hidden>
        <div class="grupo-fich__content grupo-prose">${renderMarkdown(f.body || '')}</div>
      </div>
    </article>
  `;
}

function shareIcon() {
  return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M10 13 L14 11"/>
    <circle cx="6" cy="14" r="2.5"/>
    <circle cx="18" cy="6" r="2.5"/>
    <circle cx="18" cy="18" r="2.5"/>
    <path d="M10 15 L14 17"/>
  </svg>`;
}

function resourcesHtml(resByGroup) {
  // ordem dos grupos seguindo RESOURCE_GROUPS
  const blocks = [];
  for (const g of RESOURCE_GROUPS) {
    const items = resByGroup.get(g.value);
    if (!items || items.length === 0) continue;
    blocks.push(`
      <div class="grupo-resources-block">
        <h3 class="grupo-resources-block__title">${escapeHtml(g.label)}</h3>
        <div class="grupo-resources-grid">
          ${items.map(resourceCardHtml).join('')}
        </div>
      </div>
    `);
  }
  if (blocks.length === 0) return '';
  return `
    <section class="section section--sobre grupo-resources-section" id="material">
      <div class="section__inner section--lp">
        <p class="eyebrow"><span>·</span> Material complementar</p>
        <h2>Para se aprofundar.</h2>
        <p class="grupo-section__hint">
          Curado pelo grupo — vídeos, livros, filmes, podcasts e referências pra continuar o estudo fora dos encontros.
        </p>
        ${blocks.join('')}
      </div>
    </section>
  `;
}

function resourceCardHtml(r) {
  const yt = r.kind === 'youtube' ? youtubeId(r.url) : null;
  const drv = r.kind === 'drive' ? driveInfo(r.url) : null;

  let mediaHtml = '';
  if (yt) {
    mediaHtml = `<div class="grupo-resource__embed grupo-resource__embed--video" data-lazy-embed="https://www.youtube.com/embed/${encodeURIComponent(yt)}"></div>`;
  } else if (drv) {
    const src = drv.kind === 'file'
      ? `https://drive.google.com/file/d/${encodeURIComponent(drv.id)}/preview`
      : `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(drv.id)}`;
    mediaHtml = `<div class="grupo-resource__embed grupo-resource__embed--drive" data-lazy-embed="${escapeAttr(src)}"></div>`;
  }

  const showSimpleCard = !mediaHtml; // pra book/filme/etc, card simples
  const isExternal = r.url && (r.url.startsWith('http://') || r.url.startsWith('https://'));

  const inner = `
    <header class="grupo-resource__head">
      <strong>${escapeHtml(r.title)}</strong>
      ${(r.author || r.year)
        ? `<span class="grupo-resource__meta">${[r.author, r.year].filter(Boolean).map(escapeHtml).join(' · ')}</span>`
        : ''}
    </header>
    ${r.description ? `<p class="grupo-resource__desc">${escapeHtml(r.description)}</p>` : ''}
    ${mediaHtml}
    ${isExternal && !mediaHtml ? `<span class="grupo-resource__cta">${kindCta(r.kind)} ↗</span>` : ''}
  `;

  const kindClass = `grupo-resource--${r.kind}`;
  if (isExternal && showSimpleCard) {
    return `<a class="grupo-resource ${kindClass}" href="${escapeAttr(r.url)}" target="_blank" rel="noopener">${inner}</a>`;
  }
  return `<article class="grupo-resource ${kindClass}">${inner}</article>`;
}

function kindCta(kind) {
  return {
    book: 'ver livro', article: 'ler artigo', movie: 'ver filme', series: 'ver série',
    anime: 'ver anime', podcast: 'ouvir', external_link: 'abrir link', image: 'ver imagem',
    document: 'abrir PDF', other: 'abrir',
  }[kind] || 'abrir';
}

function allosCtaHtml() {
  return `
    <section class="grupo-allos-cta">
      <div class="grupo-allos-cta__inner">
        <p class="eyebrow"><span>·</span> Apoio terapêutico</p>
        <h3>Quer fazer psicoterapia com valor adaptado?</h3>
        <p>
          A Associação <strong>Allos</strong> oferece atendimento psicoterapêutico
          acessível, com valor adaptado à sua realidade. Cuidado profissional pra quem precisa começar.
        </p>
        <a class="btn btn--primary" href="https://allos.org.br/terapiasocial" target="_blank" rel="noopener">
          <span>Agendar pela Allos</span>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6"/>
          </svg>
        </a>
      </div>
    </section>
  `;
}

function outrosCtaHtml() {
  return `
    <section class="section section--outras">
      <div class="section__inner">
        <p class="eyebrow"><span>·</span> Continue explorando</p>
        <h2>Outros grupos e atividades.</h2>
        <div class="outras-grid">
          <a href="../grupos-de-estudo.html" class="outras-grid__card">
            <span class="outras-grid__num">⌂</span>
            <h3>Todos os grupos de estudo</h3>
            <p>Volte pra página geral e veja outros grupos ativos e arquivados.</p>
            <span class="outras-grid__arrow">explorar →</span>
          </a>
          <a href="../leitura-conjunta.html" class="outras-grid__card outras-grid__card--moss">
            <span class="outras-grid__num">II</span>
            <h3>Grupo de Leitura Conjunta</h3>
            <p>Mitos, contos de fadas, arte e literatura sob a ótica junguiana.</p>
            <span class="outras-grid__arrow">explorar →</span>
          </a>
          <a href="../arteterapia.html" class="outras-grid__card">
            <span class="outras-grid__num">III</span>
            <h3>Oficina de Arteterapia</h3>
            <p>Pintura, colagem, modelagem — a arte como linguagem da psique.</p>
            <span class="outras-grid__arrow">explorar →</span>
          </a>
        </div>
      </div>
    </section>
  `;
}

function renderError({ title, message }) {
  document.title = `${title} — TULIPA`;
  APP.innerHTML = `
    <header class="hero hero--lp grupo-hero grupo-hero--wine" id="topo">
      <div class="hero__mesh" aria-hidden="true">
        <span class="blob blob--1"></span>
        <span class="blob blob--2"></span>
        <span class="blob blob--3"></span>
      </div>
      <div class="hero__content">
        <p class="hero__breadcrumb"><a href="../grupos-de-estudo.html">← Grupos de Estudo</a></p>
        <div class="grupo-hero__emoji" aria-hidden="true">${coverIcon('moon', 56)}</div>
        <h1 class="hero__title hero__title--single">
          <span class="hero__title-display">${escapeHtml(title)}</span>
        </h1>
        <p class="hero__lede">${escapeHtml(message)}</p>
        <div class="hero__actions" style="margin-top: 24px;">
          <a class="btn btn--primary" href="../grupos-de-estudo.html">
            <span>Ver todos os grupos</span>
          </a>
        </div>
      </div>
    </header>
  `;
}

// ---------- markdown leve (inline implementation pra evitar dependência circular) ----------
function renderMarkdown(src) {
  if (!src) return '';
  let s = String(src).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = s.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    let m = line.match(/^(#{1,3})\s+(.+)$/);
    if (m) {
      const lvl = m[1].length;
      out.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`);
      i++; continue;
    }
    if (/^-{3,}\s*$/.test(line)) { out.push('<hr/>'); i++; continue; }
    if (/^>\s?/.test(line)) {
      const blk = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { blk.push(lines[i].replace(/^>\s?/, '')); i++; }
      out.push(`<blockquote>${inline(blk.join('<br/>'))}</blockquote>`);
      continue;
    }
    if (/^-\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^-\s+/.test(lines[i])) { items.push(`<li>${inline(lines[i].replace(/^-\s+/, ''))}</li>`); i++; }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) { items.push(`<li>${inline(lines[i].replace(/^\d+\.\s+/, ''))}</li>`); i++; }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    if (line.trim() === '') { i++; continue; }
    const para = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,3}|>|-|\d+\.|---)/.test(lines[i])) {
      para.push(lines[i]); i++;
    }
    out.push(`<p>${inline(para.join('<br/>'))}</p>`);
  }
  return out.join('\n');
}
function inline(text) {
  let s = text;
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^_])_([^_\n]+?)_(?!_)/g, '$1<em>$2</em>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  return s;
}

// ---------- lazy embeds ----------
function initLazyEmbeds() {
  const els = APP.querySelectorAll('[data-lazy-embed]');
  if (!els.length || !('IntersectionObserver' in window)) {
    // fallback: carrega tudo
    els.forEach(loadEmbed);
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        loadEmbed(e.target);
        io.unobserve(e.target);
      }
    }
  }, { rootMargin: '300px' });
  els.forEach((el) => io.observe(el));
}
function loadEmbed(el) {
  const src = el.dataset.lazyEmbed;
  if (!src) return;
  const iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.allowFullscreen = true;
  iframe.loading = 'lazy';
  iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
  el.appendChild(iframe);
  el.removeAttribute('data-lazy-embed');
}

// ---------- utils ----------
function stripHtml(html) {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = String(html);
  return tmp.textContent.replace(/\s+/g, ' ').trim();
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

// start
init();
