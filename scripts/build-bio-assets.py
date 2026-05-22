"""Gera assets estáticos da /bio: og-image.png + qr.png.
Rodar: python scripts/build-bio-assets.py
Requisitos: pip install pillow qrcode[pil]
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import qrcode

ROOT = Path(__file__).resolve().parent.parent
BIO_DIR = ROOT / "bio"
LOGO_PATH = BIO_DIR / "logo-centered.png"
OG_OUT = BIO_DIR / "og-image.png"
QR_OUT = BIO_DIR / "qr.png"

BIO_URL = "https://projetotulipa.github.io/tulipa-unicap/bio/"

# Cores da identidade TULIPA (dark + cream + rose)
BG_DEEP = (27, 8, 16)
BG_MID = (47, 24, 32)
CREAM = (244, 229, 194)
GOLD = (193, 158, 90)
ROSE = (159, 90, 107)


def try_font(*candidates, size=48):
    """Tenta carregar a primeira fonte que existir."""
    for name in candidates:
        try:
            return ImageFont.truetype(name, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def build_og_image():
    W, H = 1200, 630
    # Fundo radial: deep no centro, mid nas bordas
    img = Image.new("RGB", (W, H), BG_DEEP)
    overlay = Image.new("RGB", (W, H), BG_MID)
    mask = Image.new("L", (W, H), 0)
    md = ImageDraw.Draw(mask)
    # gradiente radial fake via círculos concêntricos
    for r in range(900, 0, -20):
        a = int(180 * (1 - r / 900))
        md.ellipse((W // 2 - r, H // 2 - r, W // 2 + r, H // 2 + r), fill=255 - a)
    img = Image.composite(img, overlay, mask)

    draw = ImageDraw.Draw(img)

    # Logo centralizada à esquerda
    if LOGO_PATH.exists():
        logo = Image.open(LOGO_PATH).convert("RGBA")
        target = 320
        logo.thumbnail((target, target), Image.LANCZOS)
        lx = 100
        ly = (H - logo.height) // 2
        img.paste(logo, (lx, ly), logo)

    # Texto à direita
    title_font = try_font(
        "C:/Windows/Fonts/georgiai.ttf",
        "C:/Windows/Fonts/georgia.ttf",
        "C:/Windows/Fonts/calibrii.ttf",
        size=110,
    )
    tagline_font = try_font(
        "C:/Windows/Fonts/lora.ttf",
        "C:/Windows/Fonts/georgia.ttf",
        "C:/Windows/Fonts/calibri.ttf",
        size=36,
    )
    url_font = try_font(
        "C:/Windows/Fonts/consola.ttf",
        "C:/Windows/Fonts/calibri.ttf",
        size=26,
    )

    text_x = 480
    # Title
    draw.text((text_x, 200), "TULIPA", font=title_font, fill=CREAM)
    # Underline gold
    draw.line(
        [(text_x, 320), (text_x + 280, 320)],
        fill=GOLD,
        width=3,
    )
    # Tagline (manual wrap)
    tagline = "Tessitura Universitária de\nLinguagens em Psicologia Analítica"
    draw.multiline_text(
        (text_x, 350),
        tagline,
        font=tagline_font,
        fill=(220, 201, 168),
        spacing=8,
    )
    # URL hint na base
    draw.text(
        (text_x, 510),
        BIO_URL.replace("https://", ""),
        font=url_font,
        fill=GOLD,
    )

    # Borda externa sutil rose
    draw.rectangle((20, 20, W - 20, H - 20), outline=(94, 50, 60), width=2)

    img.save(OG_OUT, "PNG", optimize=True)
    print(f"[og] {OG_OUT}  ({OG_OUT.stat().st_size // 1024} KB)")


def build_qr():
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=14,
        border=2,
    )
    qr.add_data(BIO_URL)
    qr.make(fit=True)
    img = qr.make_image(fill_color=(27, 8, 16), back_color=(244, 229, 194)).convert("RGBA")
    img.save(QR_OUT, "PNG", optimize=True)
    print(f"[qr] {QR_OUT}  ({QR_OUT.stat().st_size // 1024} KB, size {img.size[0]}px)")


if __name__ == "__main__":
    build_og_image()
    build_qr()
