# TULIPA — Site

> Tessitura Universitária de Linguagens em Psicologia Analítica
> Projeto de extensão · UNICAP · `@tulipa.unicap`

Site estático multi-página, sem dependências de build. HTML/CSS/JS puros, pronto para publicar via GitHub Pages.

## Estrutura

```
tulipa-site/
├── index.html              # home
├── sitemap.html            # mapa do site
├── 404.html                # página não encontrada
├── style.css               # estilo global
├── script.js               # microinterações (vanilla JS)
├── assets/
│   └── logo.png            # logo oficial TULIPA-UNICAP (transparente)
├── atividades/             # 10 LPs internas
│   ├── grupos-de-estudo.html
│   ├── leitura-conjunta.html
│   ├── arteterapia.html
│   ├── presidencia.html
│   ├── professor-orientador.html
│   ├── professor-colaborador.html
│   ├── midia.html
│   ├── pesquisa.html
│   ├── tesouraria.html
│   └── secretaria.html
├── .gitignore
└── README.md
```

Total: **14 arquivos HTML** + 1 CSS + 1 JS + 1 PNG.

## Páginas

### Home (`index.html`)
Single-scroll com:
1. **Hero** vinho sólido com logo central, "Apresentamos a TULIPA" em Italiana + flores secas animadas nas laterais
2. **Marquee** de conceitos junguianos (Self · Sombra · Anima · Individuação...)
3. **Manifesto** ("toda sombra pede luz")
4. **Quem somos** (cream)
5. **Nossa missão** (musgo escuro) com 3 pilares (Propagar · Aprofundar · Acolher)
6. **Afinal porque "TULIPA"?** com acrônimo T·U·LI·P·A horizontal + sigla completa
7. **Atividades** (vinho escuro, cards rosa claro)
8. **Departamentos** — hierarquia em árvore: Prof. Orientador ↔ Presidência ↔ Prof. Colaborador, com 4 departamentos abaixo
9. **Contato** (papel envelhecido)
10. **Footer** com mini-sitemap em 3 colunas

### LPs de atividades (3)
- `grupos-de-estudo.html` — Jung, von Franz, Hillman, Nise da Silveira
- `leitura-conjunta.html` — mitos, contos, arte, literatura junguiana
- `arteterapia.html` — pintura, colagem, modelagem, mandala

### LPs de cargos e departamentos (7)
- `presidencia.html` — coordenação geral
- `professor-orientador.html` — orientação acadêmica
- `professor-colaborador.html` — colaboração docente
- `midia.html` — comunicação visual, Instagram
- `pesquisa.html` — bibliografia, ciclos temáticos, produção
- `tesouraria.html` — finanças, prestação de contas
- **`secretaria.html` — documento institucional completo** (atribuições com badges de status, calendário, critérios de ausência, gravações, métricas — sob direção de Pedro Bacelar)

### Páginas utilitárias
- `sitemap.html` — mapa do site em 3 colunas (Projeto · Atividades · Departamentos)
- `404.html` — página não encontrada com flores decorativas e CTA pra home

## Visual & Identidade

### Paleta (sóbria — vinho, musgo, pergaminho)

| Token | Cor | Uso |
|---|---|---|
| `--rose-deep` | `#3D1820` | títulos e acentos vinhos |
| `--rose` | `#5C2230` | base brand wine |
| `--rose-soft` | `#9F5A6B` | acentos suaves |
| `--rose-bg` | `#C49AA8` | rosa muito claro |
| `--sage-deep` | `#2F3D22` | musgo profundo |
| `--sage` | `#4A5C36` | musgo médio |
| `--cream` | `#EDDFC2` | pergaminho quente |
| `--paper` | `#E0CFA8` | papel envelhecido |
| `--ink` | `#2A2218` | tipografia |
| `--gold` | `#C19E5A` | numerais romanos (eyebrows) |

Cores de seção: hero vinho `#5C2A38` · missão musgo `#2D3614` · atividades vinho médio `#8B4555→#6B2A38` (com cards rosa claro `#F4D7DC`) · nome rosa `#F2D8DE` · departamentos musgo escuro.

### Tipografia
- **Italiana** — display ultrafina italic ("TULIPA" gigante, títulos display)
- **Cormorant Garamond** — italic serif (headings)
- **Cormorant SC** — small caps (eyebrows)
- **Fraunces** — variable italic (capitulares, numerais romanos)
- **Lora** — serif elegante (corpo de texto, navegação, botões — substituiu Inter)

Todas via Google Fonts com `display=swap`.

## Microinterações (script.js)
- Loading screen com tulipa desabrochando (~650ms)
- Magnetic buttons (CTAs se aproximam do cursor)
- 3D tilt em cards (rotateX/Y seguindo o mouse)
- Parallax 3D no selo do hero (cursor + scroll)
- Beija-flor com flight-path animado
- Reveal on scroll (IntersectionObserver)
- Loader, navbar elevation, back-to-top, year token

## Acessibilidade

- **Skip-link**: pular para o conteúdo (`Tab` no início revela)
- **`:focus-visible`** — outline visível em toda navegação por teclado
- **Semântica HTML5** — `<nav>`, `<header>`, `<footer>`, `<main>`, `<aside>`, `<section>`
- **ARIA labels** — em botões burger, links externos, navegação footer
- **`prefers-reduced-motion`** — desliga blobs, pétalas, sway, reveal
- **`alt` descritivos** nos logos
- **Contraste WCAG AA** verificado nas combinações principais (cream em wine = 6.8:1, cream em moss = 5.4:1)
- **Touch targets** ≥ 44px em mobile (botões, ícones do back-to-top)

## Responsividade

Breakpoints:
- **≤ 980px (tablet)** — nav mobile com burger, two-col → single, cards sem rotação
- **≤ 540px (mobile)** — acrônimo em grid 3×2, hero compacto, padding reduzido
- **≤ 380px (smartphones pequenos)** — refinamento adicional, constellation/dept-tree em 1 coluna
- **Landscape em phones** (height ≤ 540px) — hero encolhe

Flores secas decoram as laterais em todas as larguras (subtis em mobile).

## Desenvolvimento local

```powershell
# Servir em http://localhost:8000
cd C:\Users\Dell_Not\tulipa-site
python -m http.server 8000
```

Ou simplesmente clique duplo em `index.html`.

## Publicar no GitHub Pages

```powershell
cd C:\Users\Dell_Not\tulipa-site
git init
git add .
git commit -m "TULIPA - site inicial"
git branch -M main
git remote add origin https://github.com/<seu-usuario>/tulipa-unicap.git
git push -u origin main
```

Depois: **Settings → Pages → Branch: `main` / `(root)` → Save**.
Em ~1 minuto fica em `https://<seu-usuario>.github.io/tulipa-unicap/`.

GitHub Pages serve automaticamente o `404.html` quando uma rota não existe.

## O que ainda dá pra fazer

- **Conteúdo dos outros 6 departamentos** — Mídia, Pesquisa, Tesouraria, Presidência, Profs estão com texto placeholder. Receber documentos institucionais como o da Secretaria e aplicar o mesmo modelo
- **Fotos e nomes reais** dos membros — atualmente sem nomes
- **Formulário de inscrição** — atualmente o CTA é o Instagram
- **Otimização de fontes** — carrega ~5 famílias do Google Fonts (pode reduzir se quiser)
- **CMS para a Mídia editar sem mexer no código** — Decap CMS, TinaCMS, ou similar

---

🌷 *"Toda sombra pede luz."*
