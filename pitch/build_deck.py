#!/usr/bin/env python3
import base64, io, os
from PIL import Image

ROOT  = "/Users/maksimpozdnysev/Downloads/mixMaster"
FONTS = f"{ROOT}/web/src/assets/fonts"
BEST  = f"{ROOT}/web/public/best"
SHOTS = f"{ROOT}/pitch/shots"
SC    = "/private/tmp/claude-501/-Users-maksimpozdnysev-Desktop-HookahMania/be2fa613-c8cc-4fa0-a491-3c2217001165/scratchpad"
TPL   = f"{ROOT}/pitch/deck.template.html"
OUT   = f"{ROOT}/pitch/deck.html"

DEMO_URL   = "https://aiquickcoder.github.io/dymnaya-gavan/"
DEMO_SHORT = "aiquickcoder.github.io/dymnaya-gavan"

def b64(path):
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()

def font_face(family, cyr_file, lat_file):
    cyr = b64(f"{FONTS}/{cyr_file}"); lat = b64(f"{FONTS}/{lat_file}")
    return (
        f"@font-face{{font-family:'{family}';font-style:normal;font-weight:300 900;"
        f"font-display:swap;src:url(data:font/woff2;base64,{lat}) format('woff2');}}\n"
        f"@font-face{{font-family:'{family}';font-style:normal;font-weight:300 900;"
        f"font-display:swap;src:url(data:font/woff2;base64,{cyr}) format('woff2');"
        f"unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116;}}\n"
    )

def mono_face():
    lat = b64(f"{FONTS}/SpaceMono-latin-391873.woff2")
    return (f"@font-face{{font-family:'Space Mono';font-style:normal;font-weight:400 700;"
            f"font-display:swap;src:url(data:font/woff2;base64,{lat}) format('woff2');}}\n")

def img_uri(path, max_w, quality):
    im = Image.open(path).convert("RGB")
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=quality, optimize=True, progressive=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode(), len(buf.getvalue())

fonts_css = (
    font_face("Rubik", "Rubik-cyrillic-7b79f0.woff2", "Rubik-latin-365e33.woff2")
    + font_face("Manrope", "Manrope-cyrillic-c9a5f1.woff2", "Manrope-latin-814019.woff2")
)

# CSS custom props: real product screenshots (defined once, reused via var())
assets = {
    "--sh-home":   (f"{SHOTS}/guest_home.png",     560, 80),
    "--sh-menu":   (f"{SHOTS}/guest_menu.png",     560, 80),
    "--sh-menu2":  (f"{SHOTS}/guest_menu2.png",    560, 80),
    "--sh-mix":    (f"{SHOTS}/guest_mix.png",      560, 80),
    "--sh-clients":(f"{SHOTS}/admin_clients.png", 1180, 78),
    "--sh-staff":  (f"{SHOTS}/admin_staff.png",   1180, 78),
    "--sh-tables": (f"{SHOTS}/admin_tables.png",  1180, 78),
    "--sh-book":   (f"{SHOTS}/guest_book.png",     560, 80),
    "--sh-reserv": (f"{SHOTS}/admin_reservations.png", 1180, 78),
    "--qr3d":      (f"{SHOTS}/qr3d.png",           900, 84),
}
lines, total = [], 0
for var, (path, mw, q) in assets.items():
    uri, sz = img_uri(path, mw, q); total += sz
    lines.append(f"{var}:url('{uri}')")
    print(f"  {var:12} {sz//1024:>4}KB")
img_vars = ":root{" + ";".join(lines) + "}\n"

qr_uri = "data:image/png;base64," + b64(f"{SC}/qr_demo.png")
qr_admin_uri = "data:image/png;base64," + b64(f"{SC}/qr_admin.png")

with open(TPL, encoding="utf-8") as f:
    html = f.read()
html = html.replace("/*FONTS*/", fonts_css + img_vars)
html = (html.replace("{{QR_ADMIN}}", qr_admin_uri).replace("{{QR}}", qr_uri)
            .replace("{{DEMO_URL}}", DEMO_URL).replace("{{DEMO_SHORT}}", DEMO_SHORT))

for tok in ("{{QR}}", "{{QR_ADMIN}}", "{{DEMO_URL}}", "{{DEMO_SHORT}}", "/*FONTS*/"):
    if tok in html: print("WARN leftover", tok)

with open(OUT, "w", encoding="utf-8") as f:
    f.write(html)
print(f"assets total ~{total//1024}KB · deck.html {os.path.getsize(OUT)//1024}KB")
