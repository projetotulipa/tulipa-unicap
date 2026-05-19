"""
Aplica marcação interna nas 10 LPs em /atividades, preservando o HTML original.
Usa regex pra adicionar `data-edit-id` SEM reformatar.

Idempotente — pula elementos que já têm data-edit-id.

Uso:
    python scripts/mark-lp-content.py
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
ATIVIDADES = ROOT / "atividades"

# ---------- helpers ----------
def add_attr(opening_tag, edit_id, edit_type):
    """Adiciona data-edit-id/type antes do > se ainda não tem."""
    if 'data-edit-id=' in opening_tag:
        return opening_tag
    # tag termina com ">" (talvez " />")
    if opening_tag.endswith('/>'):
        return opening_tag[:-2] + f' data-edit-id="{edit_id}" data-edit-type="{edit_type}" />'
    return opening_tag[:-1] + f' data-edit-id="{edit_id}" data-edit-type="{edit_type}">'

def replace_first_opening(text, pattern, edit_id, edit_type, skip=None):
    """Procura PRIMEIRA tag que matcha pattern e injeta data-edit-id."""
    pat = re.compile(pattern)
    for m in pat.finditer(text):
        opening = m.group(0)
        if 'data-edit-id=' in opening: continue
        if skip and skip(opening): continue
        new_opening = add_attr(opening, edit_id, edit_type)
        return text[:m.start()] + new_opening + text[m.end():]
    return text

def section_slug_from_opening(opening_tag):
    # 1. id="X" tem prioridade
    m = re.search(r'\bid="([^"]+)"', opening_tag)
    if m:
        return m.group(1)
    # 2. class section--X (ignorando lp, tight)
    classes_match = re.search(r'\bclass="([^"]+)"', opening_tag)
    if classes_match:
        for cl in classes_match.group(1).split():
            if cl.startswith('section--') and cl not in ('section--tight', 'section--lp'):
                return cl.replace('section--', '')
    return 'section'

# ---------- hero ----------
HERO_RE = re.compile(r'(<header\s+class="hero[^"]*"[^>]*?>)(.*?)(</header>)', re.DOTALL)

def process_hero(text):
    def fix(m):
        opening, body, closing = m.group(1), m.group(2), m.group(3)
        opening = add_attr(opening, "section.hero", "section")
        body = replace_first_opening(
            body,
            r'<p\s+class="hero__eyebrow"[^>]*>',
            'hero.eyebrow', 'text'
        )
        body = replace_first_opening(
            body,
            r'<span\s+class="hero__title-line"[^>]*>',
            'hero.title-line', 'text'
        )
        body = replace_first_opening(
            body,
            r'<span\s+class="hero__title-display"[^>]*>',
            'hero.title-display', 'text'
        )
        body = replace_first_opening(
            body,
            r'<p\s+class="hero__sub"[^>]*>',
            'hero.sub', 'text'
        )
        body = replace_first_opening(
            body,
            r'<p\s+class="hero__lede"[^>]*>',
            'hero.lede', 'text'
        )
        return opening + body + closing
    return HERO_RE.sub(fix, text, count=1)

# ---------- sections ----------
# regex bem específica: <section class="section section--XXX..." [id="YYY"]> ... </section>
SECTION_RE = re.compile(
    r'(<section\s+class="section[^"]*?"[^>]*?>)(.*?)(</section>)',
    re.DOTALL
)

def process_sections(text):
    def fix(m):
        opening, body, closing = m.group(1), m.group(2), m.group(3)
        slug = section_slug_from_opening(opening)
        opening = add_attr(opening, f"section.{slug}", "section")
        body = process_section_body(body, slug)
        return opening + body + closing
    return SECTION_RE.sub(fix, text)

def process_section_body(body, slug):
    # eyebrow
    body = replace_first_opening(
        body,
        r'<p\s+class="eyebrow[^"]*"[^>]*>',
        f'{slug}.eyebrow', 'text'
    )
    # h2
    body = replace_first_opening(
        body,
        r'<h2(?:\s[^>]*)?>',
        f'{slug}.title', 'text'
    )

    # parágrafos top-level — pega os primeiros 6 <p>s que NÃO estão dentro de
    # <ul>, <div class="outras-grid">, <div class="lp-list">, <article>, etc.
    body = mark_top_level_paragraphs(body, slug)

    # lp-list items
    body = mark_lp_list(body, slug)

    # outras-grid cards
    body = mark_outras_grid(body, slug)

    # contato CTA
    if slug == 'contato':
        body = replace_first_opening(
            body,
            r'<a\s+href="[^"]*"\s+target="_blank"[^>]*?class="btn[^"]*"[^>]*>',
            'contato.cta', 'link'
        )
        # fallback: <a class="btn ... " href="...">
        body = replace_first_opening(
            body,
            r'<a\s+class="btn[^"]*"[^>]*>',
            'contato.cta', 'link'
        )
    return body

def mark_top_level_paragraphs(body, slug):
    """
    Marca os primeiros N parágrafos que NÃO estão dentro de listas/cards.
    Heurística: subdivide o texto removendo as áreas dentro de ul/article/outras-grid
    e marca <p>s no restante.
    """
    # Encontra todos os ranges "off-limits"
    off_ranges = []
    for tag, cls_filter in [
        ('ul', 'lp-list'),
        ('div', 'outras-grid'),
        ('div', 'pillars'),
        ('div', 'atividades__grid'),
        ('article', None),
    ]:
        if cls_filter:
            pat = re.compile(
                r'<' + tag + r'(?=\s)[^>]*class="[^"]*\b' + re.escape(cls_filter) + r'\b[^"]*"[^>]*>.*?</' + tag + r'>',
                re.DOTALL
            )
        else:
            pat = re.compile(r'<' + tag + r'(?=[\s>])[^>]*>.*?</' + tag + r'>', re.DOTALL)
        for m in pat.finditer(body):
            off_ranges.append((m.start(), m.end()))

    def is_off(pos):
        return any(a <= pos < b for a, b in off_ranges)

    p_pat = re.compile(r'<p(?:\s[^>]*)?>')
    matches = list(p_pat.finditer(body))
    count = 0
    # Vamos construir um novo body inserindo de trás pra frente
    result = body
    inserts = []  # (pos, edit_id)
    for m in matches:
        opening = m.group(0)
        if 'data-edit-id=' in opening: continue
        if 'eyebrow' in opening: continue
        if 'hero__' in opening: continue
        if is_off(m.start()): continue
        count += 1
        inserts.append((m.start(), m.end(), opening, f'{slug}.p{count}'))
        if count >= 6: break

    # aplica de trás pra frente pra não invalidar índices
    for start, end, opening, edit_id in reversed(inserts):
        new_opening = add_attr(opening, edit_id, 'text')
        result = result[:start] + new_opening + result[end:]
    return result

# ---------- lp-list ----------
def mark_lp_list(body, slug):
    """
    Para cada <ul class="lp-list"> dentro do body, marca os <li>s.
    Cada item: data-edit-id="<slug>.item.N", strong → ".title", span → ".body".
    """
    ul_pat = re.compile(r'(<ul\s+class="lp-list"[^>]*>)(.*?)(</ul>)', re.DOTALL)
    def fix_ul(m):
        ul_open, ul_body, ul_close = m.group(1), m.group(2), m.group(3)
        # cada <li>...</li>
        li_pat = re.compile(r'(<li(?:\s[^>]*)?>)(.*?)(</li>)', re.DOTALL)
        items = list(li_pat.finditer(ul_body))
        # processar reverso pra preservar índices
        new_ul_body = ul_body
        for i, lm in enumerate(reversed(items), 0):
            # Indice do item: 1-based, na ordem original
            idx = len(items) - i
            li_open, li_body, li_close = lm.group(1), lm.group(2), lm.group(3)
            new_li_open = add_attr(li_open, f'{slug}.item.{idx}', 'section')
            # strong → title
            new_li_body = replace_first_opening(
                li_body,
                r'<strong(?:\s[^>]*)?>',
                f'{slug}.item.{idx}.title', 'text'
            )
            # span não-bullet → body
            span_pat = re.compile(r'<span(?:\s+class="(?!lp-list__bullet)[^"]*")?(?:\s[^>]*)?>')
            for sm in span_pat.finditer(new_li_body):
                opening = sm.group(0)
                if 'data-edit-id=' in opening: continue
                if 'lp-list__bullet' in opening: continue
                new_opening = add_attr(opening, f'{slug}.item.{idx}.body', 'text')
                new_li_body = new_li_body[:sm.start()] + new_opening + new_li_body[sm.end():]
                break
            new_ul_body = new_ul_body[:lm.start()] + new_li_open + new_li_body + li_close + new_ul_body[lm.end():]
        return ul_open + new_ul_body + ul_close
    return ul_pat.sub(fix_ul, body)

# ---------- outras-grid ----------
def mark_outras_grid(body, slug):
    """Cada <a class="outras-grid__card"> marca card + h3 + p."""
    grid_pat = re.compile(r'(<div\s+class="outras-grid"[^>]*>)(.*?)(</div>)', re.DOTALL)
    def fix_grid(m):
        open_, body_, close_ = m.group(1), m.group(2), m.group(3)
        card_pat = re.compile(r'(<a\s+[^>]*class="outras-grid__card[^"]*"[^>]*>)(.*?)(</a>)', re.DOTALL)
        cards = list(card_pat.finditer(body_))
        new_body = body_
        for i, cm in enumerate(reversed(cards), 0):
            idx = len(cards) - i
            c_open, c_body, c_close = cm.group(1), cm.group(2), cm.group(3)
            new_open = add_attr(c_open, f'{slug}.card.{idx}', 'section')
            new_body_inner = replace_first_opening(
                c_body, r'<h3(?:\s[^>]*)?>', f'{slug}.card.{idx}.title', 'text'
            )
            new_body_inner = replace_first_opening(
                new_body_inner, r'<p(?:\s[^>]*)?>', f'{slug}.card.{idx}.body', 'text',
                skip=lambda o: 'eyebrow' in o or 'arrow' in o
            )
            new_body = new_body[:cm.start()] + new_open + new_body_inner + c_close + new_body[cm.end():]
        return open_ + new_body + close_
    return grid_pat.sub(fix_grid, body)

# ---------- process file ----------
def process_file(path):
    original = path.read_text(encoding="utf-8")
    text = original
    text = process_hero(text)
    text = process_sections(text)
    if text == original:
        print(f"  {path.name}: sem mudanças")
        return False
    added = text.count('data-edit-id') - original.count('data-edit-id')
    path.write_text(text, encoding="utf-8")
    print(f"  {path.name}: +{added} marcações")
    return True

def main():
    print(f"raiz: {ATIVIDADES}")
    files = sorted(ATIVIDADES.glob("*.html"))
    total = 0
    for f in files:
        if process_file(f):
            total += 1
    print(f"\n{total} arquivo(s) modificado(s).")

if __name__ == "__main__":
    main()
