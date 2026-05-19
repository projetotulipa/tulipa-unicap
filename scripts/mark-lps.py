"""
Aplica marcação universal (body data-scope, nav, footer, script render.js)
nas 12 LPs restantes do TULIPA. Idempotente — pula arquivos já marcados.

Uso:
    python scripts/mark-lps.py

Marca-só conteúdo "compartilhado" entre todas LPs:
    - <body> → <body data-scope="lp:<slug>">
    - <nav class="nav...> com data-edit-id em cada link
    - <footer> com data-edit-id em todos os elementos
    - <script type="module" src="../js/render.js"> antes do </body>

NÃO marca conteúdo específico (hero, sobre, detalhes) — fazemos manualmente
por LP, já que cada uma tem layout diferente.
"""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent.parent

# Slug → caminho. Pode ser None se for sitemap/404 (que tem scope global).
LPS = {
    "lp:presidencia":           "atividades/presidencia.html",
    "lp:professor-orientador":  "atividades/professor-orientador.html",
    "lp:professor-colaborador": "atividades/professor-colaborador.html",
    "lp:midia":                 "atividades/midia.html",
    "lp:pesquisa":              "atividades/pesquisa.html",
    "lp:tesouraria":            "atividades/tesouraria.html",
    "lp:secretaria":            "atividades/secretaria.html",
    "lp:grupos-de-estudo":      "atividades/grupos-de-estudo.html",
    "lp:leitura-conjunta":      "atividades/leitura-conjunta.html",
    "lp:arteterapia":           "atividades/arteterapia.html",
    "global":                   "sitemap.html",
    "global_404":               "404.html",
}

# Marcação do navbar (igual ao index, mas href absoluto via ../index.html#...)
NAV_OLD = re.compile(
    r'<nav class="nav([^"]*)" id="nav">\s*'
    r'<div class="nav__inner">\s*'
    r'<a href="([^"]+)" class="nav__brand" data-magnetic>\s*'
    r'<img src="([^"]+)" alt="Logo TULIPA" class="nav__mark" />\s*'
    r'<span>TULIPA</span>\s*'
    r'</a>\s*'
    r'<ul class="nav__menu">\s*'
    r'<li><a href="([^"]+#sobre)">Quem somos</a></li>\s*'
    r'<li><a href="([^"]+#missao)">Missão</a></li>\s*'
    r'<li><a href="([^"]+#nome)">O nome</a></li>\s*'
    r'<li><a href="([^"]+#atividades)">Atividades</a></li>\s*'
    r'<li><a href="([^"]+#departamentos)">Departamentos</a></li>\s*'
    r'<li><a href="([^"]+#contato)" class="nav__cta" data-magnetic>Contato</a></li>\s*'
    r'</ul>',
    re.DOTALL,
)

def nav_new(m):
    extra_class = m.group(1) or ""
    brand_href = m.group(2)
    brand_img = m.group(3)
    sobre = m.group(4); missao = m.group(5); nome = m.group(6)
    ativ = m.group(7); depts = m.group(8); contato = m.group(9)
    return f'''<nav class="nav{extra_class}" id="nav" data-edit-id="nav" data-edit-type="section" data-edit-scope="global">
    <div class="nav__inner">
      <a href="{brand_href}" class="nav__brand" data-magnetic data-edit-id="nav.brand" data-edit-type="link" data-edit-scope="global">
        <img src="{brand_img}" alt="Logo TULIPA" class="nav__mark" />
        <span data-edit-id="nav.brand-text" data-edit-type="text" data-edit-scope="global">TULIPA</span>
      </a>
      <ul class="nav__menu" data-edit-container="nav.menu" data-edit-scope="global">
        <li data-edit-id="nav.link.sobre" data-edit-type="section" data-edit-scope="global"><a href="{sobre}" data-edit-id="nav.link.sobre.label" data-edit-type="link" data-edit-scope="global">Quem somos</a></li>
        <li data-edit-id="nav.link.missao" data-edit-type="section" data-edit-scope="global"><a href="{missao}" data-edit-id="nav.link.missao.label" data-edit-type="link" data-edit-scope="global">Missão</a></li>
        <li data-edit-id="nav.link.nome" data-edit-type="section" data-edit-scope="global"><a href="{nome}" data-edit-id="nav.link.nome.label" data-edit-type="link" data-edit-scope="global">O nome</a></li>
        <li data-edit-id="nav.link.atividades" data-edit-type="section" data-edit-scope="global"><a href="{ativ}" data-edit-id="nav.link.atividades.label" data-edit-type="link" data-edit-scope="global">Atividades</a></li>
        <li data-edit-id="nav.link.departamentos" data-edit-type="section" data-edit-scope="global"><a href="{depts}" data-edit-id="nav.link.departamentos.label" data-edit-type="link" data-edit-scope="global">Departamentos</a></li>
        <li data-edit-id="nav.link.contato" data-edit-type="section" data-edit-scope="global"><a href="{contato}" class="nav__cta" data-magnetic data-edit-id="nav.link.contato.label" data-edit-type="link" data-edit-scope="global">Contato</a></li>
      </ul>'''

# Marcação do footer (depende do prefix dos hrefs)
FOOTER_OLD = re.compile(
    r'<footer class="footer">\s*'
    r'<div class="footer__inner footer__inner--expanded">\s*'
    r'<div class="footer__brand-col">\s*'
    r'<div class="footer__brand">\s*'
    r'<img src="([^"]+)" alt="Logo TULIPA — UNICAP" class="nav__mark" />\s*'
    r'<p><strong>TULIPA</strong><br/>Tessitura Universitária de Linguagens em Psicologia Analítica</p>\s*'
    r'</div>\s*'
    r'<p class="footer__about">Projeto de extensão em Psicologia Analítica Junguiana da UNICAP\. Recife, Pernambuco\.</p>',
    re.DOTALL,
)

def footer_brand_new(m):
    img = m.group(1)
    return f'''<footer class="footer" data-edit-id="section.footer" data-edit-type="section" data-edit-scope="global">
    <div class="footer__inner footer__inner--expanded">
      <div class="footer__brand-col">
        <div class="footer__brand">
          <img src="{img}" alt="Logo TULIPA — UNICAP" class="nav__mark" />
          <p data-edit-id="footer.brand-text" data-edit-type="text" data-edit-scope="global"><strong>TULIPA</strong><br/>Tessitura Universitária de Linguagens em Psicologia Analítica</p>
        </div>
        <p class="footer__about" data-edit-id="footer.about" data-edit-type="text" data-edit-scope="global">Projeto de extensão em Psicologia Analítica Junguiana da UNICAP. Recife, Pernambuco.</p>'''

# Pra cada coluna do footer, marca <li>s. Hrefs variam por prefix (../ ou ./)
FOOTER_COL_PROJETO_OLD = re.compile(
    r'<div class="footer__col">\s*'
    r'<h4>O projeto</h4>\s*'
    r'<ul>\s*'
    r'<li><a href="([^"]+#sobre)">Quem somos</a></li>\s*'
    r'<li><a href="([^"]+#missao)">Missão</a></li>\s*'
    r'<li><a href="([^"]+#nome)">O nome</a></li>\s*'
    r'<li><a href="([^"]+#contato)">Contato</a></li>\s*'
    r'<li><a href="([^"]+)">Mapa do site</a></li>\s*'
    r'</ul>\s*'
    r'</div>',
    re.DOTALL,
)

def footer_col_projeto_new(m):
    h = [m.group(i) for i in (1,2,3,4,5)]
    return f'''<div class="footer__col" data-edit-id="footer.col.projeto" data-edit-type="section" data-edit-scope="global">
          <h4 data-edit-id="footer.col.projeto.title" data-edit-type="text" data-edit-scope="global">O projeto</h4>
          <ul>
            <li data-edit-id="footer.col.projeto.li.sobre" data-edit-type="section" data-edit-scope="global"><a href="{h[0]}" data-edit-id="footer.col.projeto.li.sobre.label" data-edit-type="link" data-edit-scope="global">Quem somos</a></li>
            <li data-edit-id="footer.col.projeto.li.missao" data-edit-type="section" data-edit-scope="global"><a href="{h[1]}" data-edit-id="footer.col.projeto.li.missao.label" data-edit-type="link" data-edit-scope="global">Missão</a></li>
            <li data-edit-id="footer.col.projeto.li.nome" data-edit-type="section" data-edit-scope="global"><a href="{h[2]}" data-edit-id="footer.col.projeto.li.nome.label" data-edit-type="link" data-edit-scope="global">O nome</a></li>
            <li data-edit-id="footer.col.projeto.li.contato" data-edit-type="section" data-edit-scope="global"><a href="{h[3]}" data-edit-id="footer.col.projeto.li.contato.label" data-edit-type="link" data-edit-scope="global">Contato</a></li>
            <li data-edit-id="footer.col.projeto.li.sitemap" data-edit-type="section" data-edit-scope="global"><a href="{h[4]}" data-edit-id="footer.col.projeto.li.sitemap.label" data-edit-type="link" data-edit-scope="global">Mapa do site</a></li>
          </ul>
        </div>'''

FOOTER_COL_ATIV_OLD = re.compile(
    r'<div class="footer__col">\s*'
    r'<h4>Atividades</h4>\s*'
    r'<ul>\s*'
    r'<li><a href="([^"]*grupos-de-estudo\.html)">Grupos de Estudo</a></li>\s*'
    r'<li><a href="([^"]*leitura-conjunta\.html)">Leitura Conjunta</a></li>\s*'
    r'<li><a href="([^"]*arteterapia\.html)">Arteterapia</a></li>\s*'
    r'<li><a href="https://allos\.org\.br" target="_blank" rel="noopener">Allos ↗</a></li>\s*'
    r'</ul>\s*'
    r'</div>',
    re.DOTALL,
)

def footer_col_ativ_new(m):
    h = [m.group(i) for i in (1,2,3)]
    return f'''<div class="footer__col" data-edit-id="footer.col.atividades" data-edit-type="section" data-edit-scope="global">
          <h4 data-edit-id="footer.col.atividades.title" data-edit-type="text" data-edit-scope="global">Atividades</h4>
          <ul>
            <li data-edit-id="footer.col.atividades.li.grupos" data-edit-type="section" data-edit-scope="global"><a href="{h[0]}" data-edit-id="footer.col.atividades.li.grupos.label" data-edit-type="link" data-edit-scope="global">Grupos de Estudo</a></li>
            <li data-edit-id="footer.col.atividades.li.leitura" data-edit-type="section" data-edit-scope="global"><a href="{h[1]}" data-edit-id="footer.col.atividades.li.leitura.label" data-edit-type="link" data-edit-scope="global">Leitura Conjunta</a></li>
            <li data-edit-id="footer.col.atividades.li.arte" data-edit-type="section" data-edit-scope="global"><a href="{h[2]}" data-edit-id="footer.col.atividades.li.arte.label" data-edit-type="link" data-edit-scope="global">Arteterapia</a></li>
            <li data-edit-id="footer.col.atividades.li.allos" data-edit-type="section" data-edit-scope="global"><a href="https://allos.org.br" target="_blank" rel="noopener" data-edit-id="footer.col.atividades.li.allos.label" data-edit-type="link" data-edit-scope="global">Allos ↗</a></li>
          </ul>
        </div>'''

FOOTER_COL_DEPTS_OLD = re.compile(
    r'<div class="footer__col">\s*'
    r'<h4>Departamentos</h4>\s*'
    r'<ul>\s*'
    r'<li><a href="([^"]*presidencia\.html)">Presidência</a></li>\s*'
    r'<li><a href="([^"]*professor-orientador\.html)">Prof\. Orientador</a></li>\s*'
    r'<li><a href="([^"]*professor-colaborador\.html)">Prof\. Colaborador</a></li>\s*'
    r'<li><a href="([^"]*midia\.html)">Mídia</a></li>\s*'
    r'<li><a href="([^"]*pesquisa\.html)">Pesquisa</a></li>\s*'
    r'<li><a href="([^"]*tesouraria\.html)">Tesouraria</a></li>\s*'
    r'<li><a href="([^"]*secretaria\.html)">Secretaria</a></li>\s*'
    r'</ul>\s*'
    r'</div>',
    re.DOTALL,
)

def footer_col_depts_new(m):
    h = [m.group(i) for i in (1,2,3,4,5,6,7)]
    return f'''<div class="footer__col" data-edit-id="footer.col.depts" data-edit-type="section" data-edit-scope="global">
          <h4 data-edit-id="footer.col.depts.title" data-edit-type="text" data-edit-scope="global">Departamentos</h4>
          <ul>
            <li data-edit-id="footer.col.depts.li.presidencia" data-edit-type="section" data-edit-scope="global"><a href="{h[0]}" data-edit-id="footer.col.depts.li.presidencia.label" data-edit-type="link" data-edit-scope="global">Presidência</a></li>
            <li data-edit-id="footer.col.depts.li.prof-orientador" data-edit-type="section" data-edit-scope="global"><a href="{h[1]}" data-edit-id="footer.col.depts.li.prof-orientador.label" data-edit-type="link" data-edit-scope="global">Prof. Orientador</a></li>
            <li data-edit-id="footer.col.depts.li.prof-colaborador" data-edit-type="section" data-edit-scope="global"><a href="{h[2]}" data-edit-id="footer.col.depts.li.prof-colaborador.label" data-edit-type="link" data-edit-scope="global">Prof. Colaborador</a></li>
            <li data-edit-id="footer.col.depts.li.midia" data-edit-type="section" data-edit-scope="global"><a href="{h[3]}" data-edit-id="footer.col.depts.li.midia.label" data-edit-type="link" data-edit-scope="global">Mídia</a></li>
            <li data-edit-id="footer.col.depts.li.pesquisa" data-edit-type="section" data-edit-scope="global"><a href="{h[4]}" data-edit-id="footer.col.depts.li.pesquisa.label" data-edit-type="link" data-edit-scope="global">Pesquisa</a></li>
            <li data-edit-id="footer.col.depts.li.tesouraria" data-edit-type="section" data-edit-scope="global"><a href="{h[5]}" data-edit-id="footer.col.depts.li.tesouraria.label" data-edit-type="link" data-edit-scope="global">Tesouraria</a></li>
            <li data-edit-id="footer.col.depts.li.secretaria" data-edit-type="section" data-edit-scope="global"><a href="{h[6]}" data-edit-id="footer.col.depts.li.secretaria.label" data-edit-type="link" data-edit-scope="global">Secretaria</a></li>
          </ul>
        </div>'''

FOOTER_BOTTOM_OLD = re.compile(
    r'<div class="footer__bottom">\s*'
    r'<p>Projeto de extensão · Universidade Católica de Pernambuco · <span id="year"></span></p>\s*'
    r'<p><em>Feito com cuidado para o desabrochar da psique\.</em></p>\s*'
    r'</div>',
    re.DOTALL,
)

FOOTER_BOTTOM_NEW = '''<div class="footer__bottom">
      <p data-edit-id="footer.bottom.copy" data-edit-type="text" data-edit-scope="global">Projeto de extensão · Universidade Católica de Pernambuco · <span id="year"></span></p>
      <p data-edit-id="footer.bottom.tagline" data-edit-type="text" data-edit-scope="global"><em>Feito com cuidado para o desabrochar da psique.</em></p>
    </div>'''


def process_file(path: Path, scope: str, is_root: bool):
    text = path.read_text(encoding="utf-8")
    original = text

    # 1. body — só aplica se ainda não tem data-scope
    if 'data-scope=' not in text[:1000]:
        body_scope = scope if scope != "global_404" else "global"
        text = re.sub(
            r'<body([^>]*)>',
            lambda m: f'<body data-scope="{body_scope}"{m.group(1)}>',
            text,
            count=1,
        )

    # 2. nav
    text, n = NAV_OLD.subn(nav_new, text, count=1)
    if n == 0:
        print(f"  ⚠ {path.name}: nav não casou (estrutura diferente)")

    # 3. footer
    text, n = FOOTER_OLD.subn(footer_brand_new, text, count=1)
    if n == 0:
        print(f"  ⚠ {path.name}: footer__brand não casou")

    text, n = FOOTER_COL_PROJETO_OLD.subn(footer_col_projeto_new, text, count=1)
    if n == 0:
        print(f"  ⚠ {path.name}: footer col projeto não casou")

    text, n = FOOTER_COL_ATIV_OLD.subn(footer_col_ativ_new, text, count=1)
    if n == 0:
        print(f"  ⚠ {path.name}: footer col atividades não casou")

    text, n = FOOTER_COL_DEPTS_OLD.subn(footer_col_depts_new, text, count=1)
    if n == 0:
        print(f"  ⚠ {path.name}: footer col depts não casou")

    text, n = FOOTER_BOTTOM_OLD.subn(FOOTER_BOTTOM_NEW, text, count=1)
    if n == 0:
        print(f"  ⚠ {path.name}: footer bottom não casou")

    # 4. inserir <script type="module" src="X/js/render.js"> antes do </body>
    render_path = "js/render.js" if is_root else "../js/render.js"
    script_tag = f'  <script type="module" src="{render_path}"></script>\n'
    if 'render.js' not in text:
        text = text.replace('</body>', f'{script_tag}</body>', 1)

    if text == original:
        print(f"  · {path.name}: sem mudanças")
        return False

    path.write_text(text, encoding="utf-8")
    print(f"  ✓ {path.name}: marcado")
    return True


def main():
    print(f"raiz: {ROOT}")
    changed = 0
    for scope, rel in LPS.items():
        path = ROOT / rel
        if not path.exists():
            print(f"  ✗ {rel}: não existe")
            continue
        is_root = "/" not in rel and "\\" not in rel
        if process_file(path, scope, is_root):
            changed += 1
    print(f"\nTotal: {changed} arquivo(s) modificado(s).")

if __name__ == "__main__":
    main()
