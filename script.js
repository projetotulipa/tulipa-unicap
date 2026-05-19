/* ============================================================
   TULIPA · interações (vanilla JS)
   Carrega como <script defer> — DOM pronto na execução.
   ============================================================ */

(() => {
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = matchMedia('(hover: none)').matches;
  const lerp = (a, b, t) => a + (b - a) * t;

  /* -----------------------------------------------------------
     1 · LOADING SCREEN
     ----------------------------------------------------------- */
  const loader = $('#loader');
  if (loader) {
    window.addEventListener('load', () => {
      setTimeout(() => {
        loader.classList.add('is-done');
        setTimeout(() => loader.remove(), 900);
      }, 650);
    });
  }

  /* -----------------------------------------------------------
     2 · YEAR TOKEN IN FOOTER
     ----------------------------------------------------------- */
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* -----------------------------------------------------------
     3 · NAVBAR ELEVATION + MOBILE MENU
     ----------------------------------------------------------- */
  const nav = $('#nav');
  const burger = $('.nav__burger');
  const menu = $('.nav__menu');

  const onScroll = () => {
    nav.classList.toggle('is-scrolled', window.scrollY > 12);
    if (toTop) toTop.classList.toggle('is-visible', window.scrollY > 600);
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  burger.addEventListener('click', () => {
    const open = menu.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', open);
    burger.classList.toggle('is-open', open);
    document.body.classList.toggle('no-scroll', open);
  });
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    menu.classList.remove('is-open');
    burger.classList.remove('is-open');
    burger.setAttribute('aria-expanded', false);
    document.body.classList.remove('no-scroll');
  }));

  /* -----------------------------------------------------------
     4 · MAGNETIC BUTTONS
     ----------------------------------------------------------- */
  if (!isTouch && !reducedMotion) {
    $$('[data-magnetic]').forEach(el => {
      const strength = parseFloat(el.dataset.magneticStrength) || 0.35;
      let raf = null, tx = 0, ty = 0, cx = 0, cy = 0;

      const update = () => {
        cx = lerp(cx, tx, 0.18);
        cy = lerp(cy, ty, 0.18);
        el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
        if (Math.abs(cx - tx) > 0.1 || Math.abs(cy - ty) > 0.1) {
          raf = requestAnimationFrame(update);
        } else {
          raf = null;
        }
      };

      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        tx = (e.clientX - (r.left + r.width / 2)) * strength;
        ty = (e.clientY - (r.top + r.height / 2)) * strength;
        if (!raf) raf = requestAnimationFrame(update);
      });
      el.addEventListener('mouseleave', () => {
        tx = 0; ty = 0;
        if (!raf) raf = requestAnimationFrame(update);
      });
    });
  }

  /* -----------------------------------------------------------
     6 · 3D TILT CARDS
     ----------------------------------------------------------- */
  if (!isTouch && !reducedMotion) {
    const tiltify = (el, maxDeg = 9, soft = false) => {
      let raf = null;
      let rx = 0, ry = 0, trx = 0, try_ = 0;
      let mx = 0.5, my = 0.5;

      const update = () => {
        rx = lerp(rx, trx, 0.14);
        ry = lerp(ry, try_, 0.14);
        el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`;
        const shine = el.querySelector('.card__shine');
        if (shine) {
          shine.style.background = `radial-gradient(circle at ${mx * 100}% ${my * 100}%, rgba(255,255,255,0.55) 0%, transparent 45%)`;
        }
        if (Math.abs(rx - trx) > 0.05 || Math.abs(ry - try_) > 0.05) {
          raf = requestAnimationFrame(update);
        } else {
          raf = null;
        }
      };

      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        mx = (e.clientX - r.left) / r.width;
        my = (e.clientY - r.top) / r.height;
        try_ = (mx - 0.5) * 2 * maxDeg;
        trx = -(my - 0.5) * 2 * maxDeg;
        if (!raf) raf = requestAnimationFrame(update);
      });
      el.addEventListener('mouseleave', () => {
        trx = 0; try_ = 0;
        if (!raf) raf = requestAnimationFrame(update);
      });
    };

    $$('[data-tilt]').forEach(el => tiltify(el, 10));
    $$('[data-tilt-soft]').forEach(el => tiltify(el, 4, true));
  }

  /* -----------------------------------------------------------
     7 · HERO SEAL — parallax (scroll) + tilt (mouse)
     ----------------------------------------------------------- */
  const seal = $('#heroSeal');
  if (seal && !reducedMotion) {
    let mouseX = 0, mouseY = 0, curX = 0, curY = 0;

    document.addEventListener('mousemove', e => {
      const rx = (e.clientX / window.innerWidth - 0.5);
      const ry = (e.clientY / window.innerHeight - 0.5);
      mouseX = rx * 14;
      mouseY = ry * 14;
    });

    const updateSeal = () => {
      curX = lerp(curX, mouseX, 0.06);
      curY = lerp(curY, mouseY, 0.06);
      const scrollProg = Math.min(window.scrollY / window.innerHeight, 1);
      const rot = scrollProg * 60;
      const sc = 1 - scrollProg * 0.06;
      seal.style.transform = `translate3d(${curX}px, ${curY}px, 0) rotate(${rot}deg) scale(${sc})`;
      requestAnimationFrame(updateSeal);
    };
    updateSeal();
  }

  /* -----------------------------------------------------------
     8 · FALLING PETALS
     ----------------------------------------------------------- */
  const petalsRoot = $('#petals');
  if (petalsRoot && !reducedMotion) {
    const colors = ['#EDDFC2', '#E0CFA8', '#C49AA8', '#9F5A6B', '#D6BFA0'];
    const PETAL_COUNT = window.innerWidth < 720 ? 8 : 16;

    for (let i = 0; i < PETAL_COUNT; i++) {
      const p = document.createElement('span');
      p.className = 'petal-fall';
      p.style.left = `${Math.random() * 100}%`;
      p.style.animationDelay = `${-Math.random() * 18}s`;
      p.style.animationDuration = `${12 + Math.random() * 14}s`;
      p.style.opacity = (0.35 + Math.random() * 0.45).toFixed(2);
      p.style.setProperty('--size', `${10 + Math.random() * 16}px`);
      p.style.setProperty('--color', colors[Math.floor(Math.random() * colors.length)]);
      p.style.setProperty('--sway', `${20 + Math.random() * 60}px`);
      p.style.setProperty('--rot', `${-180 + Math.random() * 360}deg`);
      petalsRoot.appendChild(p);
    }
  }

  /* -----------------------------------------------------------
     9 · REVEAL ON SCROLL
     ----------------------------------------------------------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -60px 0px' });

  $$('.section, .manifesto, .card, .pillar, .detail, .orbit__item, .pullquote, .marquee, .mandala-divider, .acronym__row, .constellation__core').forEach(el => {
    el.classList.add('reveal');
    io.observe(el);
  });

  /* -----------------------------------------------------------
     10 · HUMMINGBIRD FLIGHT PATH
     ----------------------------------------------------------- */
  const hummingbird = $('#hummingbird');
  const atvSection = $('.section--atividades');
  if (hummingbird && atvSection && !reducedMotion) {
    const triggerIO = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          hummingbird.classList.add('is-flying');
          triggerIO.unobserve(e.target);
        }
      });
    }, { threshold: 0.2 });
    triggerIO.observe(atvSection);
  }

  /* -----------------------------------------------------------
     11 · BACK TO TOP
     ----------------------------------------------------------- */
  const toTop = $('#toTop');
  if (toTop) {
    toTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    });
  }

  /* -----------------------------------------------------------
     14 · COLOR-MORPH WHILE SCROLLING (subtil)
     ----------------------------------------------------------- */
  if (!reducedMotion) {
    const sections = $$('section.section[data-bg], .hero, .manifesto');
    // Não estritamente necessário — só pinta a navbar com base na seção atrás dela.
    const headerIO = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting && e.target.classList) {
          if (e.target.classList.contains('section--missao')
           || e.target.classList.contains('section--atividades')
           || e.target.classList.contains('section--departamentos')) {
            nav.classList.add('on-dark');
          } else {
            nav.classList.remove('on-dark');
          }
        }
      });
    }, { threshold: 0.4 });
    $$('.hero, .manifesto, .section').forEach(s => headerIO.observe(s));
  }

})();
