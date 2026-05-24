// TULIPA · injeta wave dividers SVG automaticamente entre seções com cores diferentes.
// Funciona em qualquer LP — basta incluir <script type="module" src="js/wave-dividers-auto.js">.
//
// Algoritmo:
// 1. Pega todas as section/hero/etc na ordem do DOM
// 2. Pra cada par adjacente, compara backgroundColor computado
// 3. Se cores diferem AND ainda não tem wave entre elas, insere SVG no topo
//    da próxima section com fill da cor DELA — atravessa a borda visualmente
// 4. Alterna entre 3 paths Bezier pra orgânico

const SECTION_SELECTOR = [
  '.section',
  '.hero',
  '.pullquote',
  '.manifesto',
  '.marquee',
  '.grupo-allos-cta',
  '.section--grupos-vivos',
  '.section--grupos-arquivo',
  '.grupo-timeline-section',
  '.grupo-resources-section',
  '.grupo-coord-section',
].join(', ');

const PATHS = [
  'M0,40 C 200,80 400,0 600,40 C 800,80 1000,0 1200,40 L1200,0 L0,0 Z',
  'M0,30 C 150,70 350,10 550,40 C 750,70 950,20 1200,50 L1200,0 L0,0 Z',
  'M0,50 C 250,10 450,80 700,30 C 900,0 1100,50 1200,40 L1200,0 L0,0 Z',
  'M0,45 C 300,5 500,75 800,35 C 1000,15 1100,55 1200,45 L1200,0 L0,0 Z',
];

function bgOf(el) {
  let cur = el;
  while (cur && cur !== document.documentElement) {
    const c = getComputedStyle(cur).backgroundColor;
    if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
    cur = cur.parentElement;
  }
  return getComputedStyle(document.body).backgroundColor;
}

function alreadyHasWave(section) {
  // se a section já tem wave no topo (manual ou auto), pula
  const first = section.firstElementChild;
  if (!first) return false;
  if (first.classList?.contains('auto-wave')) return true;
  if (first.classList?.contains('grupo-wave')) return true;
  if (first.tagName === 'SVG' && first.classList?.contains('wave')) return true;
  // wave-divider clássico fica como IRMÃO antes (não dentro)
  const prevSib = section.previousElementSibling;
  if (prevSib?.classList?.contains('wave-divider')) return true;
  return false;
}

function inject() {
  const all = Array.from(document.querySelectorAll(SECTION_SELECTOR));
  // filtra: pula sections aninhadas (ex.: section dentro de section)
  const sections = all.filter((s) => !all.some((p) => p !== s && p.contains(s)));

  let waveIdx = 0;
  for (let i = 1; i < sections.length; i++) {
    const prev = sections[i - 1];
    const cur = sections[i];
    if (alreadyHasWave(cur)) continue;

    const prevColor = bgOf(prev);
    const curColor = bgOf(cur);
    if (!prevColor || !curColor || prevColor === curColor) continue;

    // garante position: relative pra wave absoluta funcionar
    if (getComputedStyle(cur).position === 'static') cur.style.position = 'relative';
    if (getComputedStyle(cur).overflow === 'hidden') {
      // se overflow:hidden, o wave não consegue vazar pra fora — força visible no top
      // (mantém overflow original mas só pra borda top via clip)
      cur.style.overflow = 'visible';
    }

    const path = PATHS[waveIdx % PATHS.length];
    waveIdx++;

    const wrapper = document.createElement('div');
    wrapper.className = 'auto-wave';
    wrapper.innerHTML = `<svg viewBox="0 0 1200 80" preserveAspectRatio="none" aria-hidden="true">
      <path d="${path}" fill="${curColor}"></path>
    </svg>`;
    cur.insertBefore(wrapper, cur.firstChild);
  }
}

// roda após CSS estar 100% carregado e cores computadas
if (document.readyState === 'complete') {
  inject();
} else {
  window.addEventListener('load', inject);
}

// re-injeta se houver mudança grande no DOM (cards dinâmicos, etc) — debounced
let timer = null;
window.addEventListener('message', (e) => {
  if (e.data?.kind !== 'tulipa:re-render') return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(inject, 60);
});
