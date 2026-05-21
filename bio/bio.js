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

const SVG_FORM = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="fg" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#F4E5C2" />
      <stop offset="100%" stop-color="#C19E5A" />
    </radialGradient>
  </defs>
  <path d="M24 18 L70 18 L82 30 L82 86 C 82 88 80 90 78 90 L24 90 C 22 90 20 88 20 86 L20 22 C 20 20 22 18 24 18 Z" fill="url(#fg)" stroke="#EDDFC2" stroke-width="0.6" opacity="0.96"/>
  <path d="M70 18 L82 30 L70 30 Z" fill="#A88248" opacity="0.55"/>
  <rect x="28" y="36" width="6" height="6" rx="1" fill="none" stroke="#5C2230" stroke-width="1" opacity="0.7"/>
  <line x1="38" y1="39" x2="68" y2="39" stroke="#5C2230" stroke-width="1.2" opacity="0.5" stroke-linecap="round"/>
  <rect x="28" y="50" width="6" height="6" rx="1" fill="#5C2230" opacity="0.85"/>
  <path d="M29.5 53 L31.3 54.8 L33.5 51.4" stroke="#F4E5C2" stroke-width="0.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="38" y1="53" x2="64" y2="53" stroke="#5C2230" stroke-width="1.2" opacity="0.5" stroke-linecap="round"/>
  <rect x="28" y="64" width="6" height="6" rx="1" fill="none" stroke="#5C2230" stroke-width="1" opacity="0.7"/>
  <line x1="38" y1="67" x2="60" y2="67" stroke="#5C2230" stroke-width="1.2" opacity="0.5" stroke-linecap="round"/>
  <circle cx="72" cy="80" r="3.5" fill="#5C2230" opacity="0.75"/>
  <path d="M70.4 80 L71.6 81.2 L73.6 78.9" stroke="#F4E5C2" stroke-width="0.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

const SVG_BY_ICON = {
  brand: SVG_BRAND,
  heart: SVG_HEART,
  generic: SVG_GENERIC,
  form: SVG_FORM,
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
    {
      id: 'default-form',
      label: 'Formulário',
      href: 'https://forms.gle/SUA-URL-AQUI',
      description: 'Pesquisa, inscrição ou outro formulário do projeto. Edite o link no admin antes de exibir.',
      image: null,
      icon: 'form',
      hidden: true,
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

  // Fallback: logo TULIPA da home (em vez da inicial "T")
  const avatarHtml = identity.avatar
    ? `<img src="${escapeAttr(identity.avatar)}" alt="${escapeAttr(identity.name)}" />`
    : `<img class="bio__avatar--logo" src="./logo-centered.png" alt="${escapeAttr(identity.name)}" onerror="this.onerror=null; this.src='../assets/logo.png';" />`;

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

// cycling de accents — cores alternam pra parecer um arco-íris junguiano
// cream entra cedo pra quebrar a monotonia escura com luz papel
const ACCENT_CYCLE = ['rose', 'cream', 'sage', 'gold', 'terracotta', 'violet', 'indigo'];
function accentFor(link, idx) {
  if (link.id === 'default-site')  return 'rose';
  if (link.id === 'default-allos') return 'sage';
  if (link.id === 'default-form')  return 'gold';
  return ACCENT_CYCLE[idx % ACCENT_CYCLE.length];
}

function renderCards(links) {
  const box = document.getElementById('bioCards');
  if (!box) return;
  if (!links.length) {
    box.innerHTML = `<p style="text-align:center; color: var(--text-dim); font-style: italic; padding: 30px 0;">Sem links ainda.</p>`;
    return;
  }

  let richIndex = 0;
  box.innerHTML = links.map((link, idx) => {
    const accent = accentFor(link, idx);
    const hasImage = !!(link.image || link.icon);
    if (hasImage) {
      const isAlt = richIndex % 2 === 1;
      richIndex++;
      return richCardHtml(link, isAlt, accent);
    }
    return simpleCardHtml(link, accent);
  }).join('');
}

function simpleCardHtml(link, accent) {
  return `
    <a class="bio-card bio-card--simple" href="${escapeAttr(link.href)}" target="_blank" rel="noopener" data-accent="${accent}">
      <h3 class="bio-card__title">${escapeHtml(link.label)}</h3>
      ${link.description ? `<p class="bio-card__desc">${escapeHtml(link.description)}</p>` : ''}
      <span class="bio-card__cta">
        <span>visitar</span>
        ${SVG_ARROW}
      </span>
    </a>
  `;
}

function richCardHtml(link, isAlt, accent) {
  const mediaHtml = link.image
    ? `<img src="${escapeAttr(link.image)}" alt="" />`
    : (SVG_BY_ICON[link.icon] || SVG_GENERIC);

  return `
    <a class="bio-card bio-card--rich ${isAlt ? 'bio-card--alt' : ''}" href="${escapeAttr(link.href)}" target="_blank" rel="noopener" data-accent="${accent}">
      <div class="bio-card__media">
        ${mediaHtml}
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
