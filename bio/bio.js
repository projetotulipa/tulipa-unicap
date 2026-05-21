// TULIPA · /bio — renderiza identidade + cards a partir do site_content scope `bio:default`.
// Fallback pros 2 cards padrão quando não há snapshot publicado.

import { supabase } from '../js/supabase.js';

const BIO_SCOPE = 'bio:default';

// ===== SVGs inline pros cards padrão e fallbacks =====
const SVG_BRAND = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="bp" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#F4D7DC" />
      <stop offset="100%" stop-color="#C49AA8" />
    </radialGradient>
  </defs>
  <path d="M50 18 C 32 28, 24 50, 30 68 C 36 82, 50 84, 50 84 C 50 84, 64 82, 70 68 C 76 50, 68 28, 50 18 Z" fill="url(#bp)" />
  <path d="M50 18 C 32 28, 24 50, 30 68 C 36 82, 50 84, 50 84 C 50 84, 64 82, 70 68 C 76 50, 68 28, 50 18 Z" fill="none" stroke="#EDDFC2" stroke-width="0.6" opacity="0.5"/>
  <path d="M50 84 L50 96" stroke="#4A5C36" stroke-width="2.5" fill="none" stroke-linecap="round" />
  <path d="M48 36 C 48 48, 49 60, 50 72" stroke="#5C2230" stroke-width="0.8" fill="none" opacity="0.4" />
</svg>
`;

const SVG_HEART = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="hg" cx="40%" cy="35%" r="70%">
      <stop offset="0%" stop-color="#F4D7DC" />
      <stop offset="100%" stop-color="#9F5A6B" />
    </radialGradient>
  </defs>
  <path d="M50 86 C 28 66, 14 52, 14 36 C 14 26, 22 18, 32 18 C 40 18, 46 24, 50 30 C 54 24, 60 18, 68 18 C 78 18, 86 26, 86 36 C 86 52, 72 66, 50 86 Z"
        fill="url(#hg)" stroke="#EDDFC2" stroke-width="0.6" opacity="0.95" />
  <path d="M50 50 C 48 48, 46 46, 46 42 M50 50 C 52 48, 54 46, 54 42" stroke="#5C2230" stroke-width="0.8" fill="none" opacity="0.4" stroke-linecap="round" />
</svg>
`;

const SVG_GENERIC = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="50" cy="50" r="36" fill="#EDDFC2" opacity="0.92" />
  <path d="M50 28 L55 46 L74 46 L59 56 L65 74 L50 64 L35 74 L41 56 L26 46 L45 46 Z" fill="#5C2230" opacity="0.85" />
</svg>
`;

const SVG_BY_ICON = {
  brand: SVG_BRAND,
  heart: SVG_HEART,
  generic: SVG_GENERIC,
};

// ===== DEFAULTS (sincronizados com admin/bio/data.js) =====
const DEFAULTS = {
  identity: {
    avatar: null,
    name: 'TULIPA',
    tagline: 'Tessitura Universitária de Linguagens em Psicologia Analítica',
    bio: 'Projeto de extensão em Psicologia Analítica Junguiana da UNICAP. Recife, Pernambuco.',
  },
  links: [
    {
      id: 'default-site',
      label: 'Conheça o projeto',
      href: 'https://projetotulipa.github.io/tulipa-unicap/',
      description: 'O site completo da TULIPA — manifesto, atividades, departamentos e grupos de estudo.',
      image: null,
      icon: 'brand',
      hidden: false,
    },
    {
      id: 'default-allos',
      label: 'Saiba mais',
      href: 'https://allos.org.br/terapiasocial',
      description: 'Terapia social pela Allos — psicoterapia acessível conduzida por profissionais em formação supervisionada.',
      image: null,
      icon: 'heart',
      hidden: false,
    },
  ],
};

// ===== Carrega conteúdo =====
async function loadContent() {
  try {
    const { data, error } = await supabase
      .from('site_content')
      .select('data')
      .eq('scope', BIO_SCOPE)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data?.data) {
      return normalize(data.data);
    }
  } catch (e) {
    console.warn('[bio] erro carregando snapshot:', e?.message);
  }
  return normalize(DEFAULTS);
}

function normalize(raw) {
  return {
    identity: {
      avatar: raw?.identity?.avatar || null,
      name: String(raw?.identity?.name || DEFAULTS.identity.name),
      tagline: String(raw?.identity?.tagline || ''),
      bio: String(raw?.identity?.bio || ''),
    },
    links: Array.isArray(raw?.links) ? raw.links.filter((l) => l && !l.hidden) : [],
  };
}

// ===== Render =====
function initials(name) {
  if (!name) return 'T';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0][0].toUpperCase();
}

function renderIdentity(identity) {
  const head = document.querySelector('.bio__head');
  if (!head) return;

  const avatarHtml = identity.avatar
    ? `<img src="${escapeAttr(identity.avatar)}" alt="${escapeAttr(identity.name)}" />`
    : `<span class="bio__avatar--fallback">${escapeHtml(initials(identity.name))}</span>`;

  head.innerHTML = `
    <div class="bio__avatar">${avatarHtml}</div>
    <h1 class="bio__name">${escapeHtml(identity.name)}</h1>
    ${identity.tagline ? `<p class="bio__tagline">${escapeHtml(identity.tagline)}</p>` : ''}
    ${identity.bio ? `<p class="bio__bio">${renderBioMd(identity.bio)}</p>` : ''}
  `;
}

// markdown bem leve só pra **bold** e *italic* na bio
function renderBioMd(s) {
  let v = escapeHtml(s);
  v = v.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
  v = v.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
  return v;
}

function renderCards(links) {
  const box = document.getElementById('bioCards');
  if (!box) return;
  if (!links.length) {
    box.innerHTML = `<p style="text-align:center; color: var(--text-dim); font-style: italic; padding: 30px 0;">Sem links ainda.</p>`;
    return;
  }

  // alternância: rich cards ímpares ficam normais, pares com --alt
  let richIndex = 0;
  box.innerHTML = links.map((link) => {
    const hasImage = !!(link.image || link.icon);
    if (hasImage) {
      const isAlt = richIndex % 2 === 1;
      richIndex++;
      return richCardHtml(link, isAlt);
    }
    return simpleCardHtml(link);
  }).join('');
}

function simpleCardHtml(link) {
  return `
    <a class="bio-card bio-card--simple" href="${escapeAttr(link.href)}" target="_blank" rel="noopener" data-accent="rose">
      <h3 class="bio-card__title">${escapeHtml(link.label)}</h3>
      ${link.description ? `<p class="bio-card__desc">${escapeHtml(link.description)}</p>` : ''}
      <span class="bio-card__cta">
        <span>visitar</span>
        ${SVG_ARROW}
      </span>
    </a>
  `;
}

function richCardHtml(link, isAlt) {
  // accent semantic: site = rose, allos = sage, demais ficam gold rotativo
  const accent = link.id === 'default-allos' ? 'sage'
              : link.id === 'default-site'  ? 'rose'
              : (isAlt ? 'gold' : 'rose');

  const mediaHtml = link.image
    ? `<img src="${escapeAttr(link.image)}" alt="" />`
    : (SVG_BY_ICON[link.icon] || SVG_GENERIC);

  return `
    <a class="bio-card bio-card--rich ${isAlt ? 'bio-card--alt' : ''}" href="${escapeAttr(link.href)}" target="_blank" rel="noopener" data-accent="${accent}">
      <div class="bio-card__media">
        ${mediaHtml}
        <span class="bio-card__media-fade" aria-hidden="true"></span>
      </div>
      <div class="bio-card__body">
        <h3 class="bio-card__title">${escapeHtml(link.label)}</h3>
        ${link.description ? `<p class="bio-card__desc">${escapeHtml(link.description)}</p>` : ''}
        <span class="bio-card__cta">
          <span>saiba mais</span>
          ${SVG_ARROW}
        </span>
      </div>
    </a>
  `;
}

const SVG_ARROW = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12 L19 12 M13 6 L19 12 L13 18"/></svg>`;

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

// ===== Boot =====
(async function () {
  try {
    const content = await loadContent();
    renderIdentity(content.identity);
    renderCards(content.links);

    // atualiza title da página com nome
    if (content.identity.name) {
      document.title = `${content.identity.name} — links`;
    }
  } catch (e) {
    console.error('[bio] erro fatal:', e);
    const root = document.getElementById('bioRoot');
    if (root) {
      root.innerHTML = `<p style="text-align:center; color: var(--text-dim); padding: 60px 20px;">Não foi possível carregar a página agora.</p>`;
    }
  }
})();
