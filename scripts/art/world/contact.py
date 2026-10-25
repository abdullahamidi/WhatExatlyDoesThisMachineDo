# Contact sheet (WP23a, Art Director): one review board per living-world sheet, ported from the WP22-23 denizen proof
# (tools/contact.py). Sections: 1 every frame x every era row at 4x (PLACEHOLDER CELLS boxed), 2 era ladder of the
# first frame at 6x with runtime alpha and shadow, 3 readability at 1x / 1.5x / 2x / 3x (nearest) on the light sky
# and on the dark skyline, 4 optional 1:1 crops of in-game-size composites (composite.py output). Evidence only.
#
# usage: python -I contact.py <sheet> <out.png> [--frames a,b,c] [--crop <png>:x0,y0,x1,y1 ...] [--shadow 14]
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from PIL import Image, ImageDraw, ImageFont  # noqa: E402
from pal import render  # noqa: E402
from sheets import SHEETS, FRAMES, ERA_ROWS  # noqa: E402
from build_sheet import load_master, cell_rows, placeholders  # noqa: E402
from composite import nn, with_alpha, shadow  # noqa: E402

SAND = (184, 169, 143, 255)
SKY = (210, 191, 156, 255)
DARK = (62, 66, 70, 255)
GROUND = (138, 122, 100, 255)
INK = (20, 17, 15, 255)
RED = (190, 60, 40, 255)
ERA_ALPHA = {0: 0.75, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1}          # row I before wornMotor (.85 after)
SHADOW_SCALE = {0: 0.5, 1: 1, 2: 1, 3: 1, 4: 0, 5: 1}         # no shadow from horizonField >= 5 (row V)


def font(s):
    return ImageFont.truetype('C:/Windows/Fonts/consola.ttf', s)


def panel(im, s, bg=SKY, pad=6, sh=None):
    w, h = im.width * s + 2 * pad, im.height * s + 2 * pad + 3 * s
    p = Image.new('RGBA', (w, h), bg)
    d = ImageDraw.Draw(p)
    gy = pad + im.height * s
    d.rectangle((0, gy, w, h), fill=GROUND)
    d.rectangle((0, gy, w, gy + max(1, s // 2)), fill=(110, 58, 34, 255))
    if sh is not None:
        p.alpha_composite(nn(sh, s), ((w - sh.width * s) // 2, gy - 2 * s))
    p.alpha_composite(nn(im, s), ((w - im.width * s) // 2, pad))
    return p


def main(argv):
    sheet, out = argv[0], argv[1]
    spec = SHEETS[sheet]
    frames = load_master(sheet)
    sel = FRAMES[sheet]
    crops = []
    shadow_w = 14
    i = 2
    while i < len(argv):
        if argv[i] == '--frames':
            sel = tuple(argv[i + 1].split(','))
            i += 2
        elif argv[i] == '--crop':
            path, box = argv[i + 1].rsplit(':', 1)
            crops.append((path, tuple(int(v) for v in box.split(','))))
            i += 2
        elif argv[i] == '--shadow':
            shadow_w = int(argv[i + 1])
            i += 2
        else:
            raise SystemExit('unknown arg %s' % argv[i])
    rows = range(spec['rows'])
    cw, ch = spec['cell']
    ph = {f for f, _ in placeholders(frames)}

    def cell(fn, r):
        return render(cell_rows(sheet, frames, fn, r), cw)

    SW = max(1920, 24 + 70 + len(FRAMES[sheet]) * (cw * 4 + 10) + 24)   # wide sheets (dog: 20 cols) fit section 1
    board = Image.new('RGBA', (SW, 6000), SAND)
    d = ImageDraw.Draw(board)
    y = 16
    d.text((24, y), 'LIVING WORLD  |  %s  (%s, %s)  |  cell %dx%d art px, %d frames x %d rows, sheet %dx%d' % (
        sheet.upper(), spec['id'], spec['file'], cw, ch, len(FRAMES[sheet]), spec['rows'], *spec['size']), font=font(22), fill=INK)
    y += 34
    d.text((24, y), 'Hand-pixelled colour master + eraRecolor rows (DENIZEN_ART App. A). Palette-only, alpha 0/255. '
           'Red box = PLACEHOLDER CELL (copy of %s, redrawn in WP23b).' % (sorted({s for _, s in placeholders(frames)}) or ['-'])[0],
           font=font(15), fill=INK)
    y += 34
    # 1. every frame x every row at 4x
    s = 4
    d.text((24, y), '1. FRAMES x ERA ROWS (4x)', font=font(18), fill=INK)
    y += 26
    colw = cw * s + 10
    label_w = 70
    for c, fn in enumerate(FRAMES[sheet]):
        d.text((24 + label_w + c * colw, y), fn[:10], font=font(11), fill=RED if fn in ph else INK)
    y += 16
    for r in rows:
        d.text((24, y + ch * s // 2), ERA_ROWS[r] if spec['era_rows'] else '-', font=font(16), fill=INK)
        for c, fn in enumerate(FRAMES[sheet]):
            x = 24 + label_w + c * colw
            sw = Image.new('RGBA', (cw * s, ch * s), SKY)
            sw.alpha_composite(nn(cell(fn, r), s))
            board.alpha_composite(sw, (x, y))
            if fn in ph:
                d.rectangle((x - 2, y - 2, x + cw * s + 1, y + ch * s + 1), outline=RED, width=2)
        y += ch * s + 8
    y += 12
    # 2. era ladder
    if spec['era_rows']:
        d.text((24, y), '2. ERA LADDER  (%s, 6x, runtime alpha: I .75 before wornMotor / .85 after; shadow %dx3 at .28, '
               'x.5 in I, none in V)' % (sel[0], shadow_w), font=font(18), fill=INK)
        y += 26
        x = 24
        for r in rows:
            sh = shadow(shadow_w, 0.28 * SHADOW_SCALE[r]) if SHADOW_SCALE[r] else None
            p = panel(with_alpha(cell(sel[0], r), ERA_ALPHA[r]), 6, sh=sh)
            board.alpha_composite(p, (x, y + 20))
            d.text((x, y), ERA_ROWS[r], font=font(16), fill=INK)
            x += p.width + 16
        y += 20 + p.height + 16
    # 3. readability
    d.text((24, y), '3. READABILITY (nearest): 1 screen px per art px = zoom .5 @720p | 1.5 = zoom .5 @1080p | 2 = zoom 1 '
           '@720p | 3 = zoom 1 @1080p. Row II (demo) on light sky and on dark skyline.', font=font(15), fill=INK)
    y += 24
    r_demo = 1 if spec['era_rows'] else 0
    show = [fn for fn in sel if fn not in ph][:6]
    for bg in (SKY, DARK):
        x = 24
        hmax = 0
        for sc in (1, 1.5, 2, 3):
            for fn in show:
                im = nn(cell(fn, r_demo), sc)
                sw = Image.new('RGBA', (im.width + 6, im.height + 6), bg)
                sw.alpha_composite(im, (3, 3))
                board.alpha_composite(sw, (x, y))
                x += sw.width + 3
                hmax = max(hmax, sw.height)
            d.text((x - 20, y + hmax + 2), '%sx' % sc, font=font(13), fill=INK)
            x += 26
        y += hmax + 22
    # 4. composites
    if crops:
        d.text((24, y), '4. IN GAME SIZE, 1:1 crops of composites over the 1080p store shots (composite.py)', font=font(18), fill=INK)
        y += 26
        x, hmax = 24, 0
        for path, box in crops:
            c = Image.open(path).convert('RGBA').crop(box)
            if x + c.width > SW - 10:
                x, y, hmax = 24, y + hmax + 26, 0
            board.alpha_composite(c, (x, y))
            d.rectangle((x - 1, y - 1, x + c.width, y + c.height), outline=INK)
            d.text((x, y + c.height + 3), os.path.basename(path), font=font(12), fill=INK)
            x += c.width + 14
            hmax = max(hmax, c.height)
        y += hmax + 26
    board = board.crop((0, 0, SW, y + 10))
    board.convert('RGB').save(out)
    print('contact', out, board.size)


if __name__ == '__main__':
    if len(sys.argv) < 3 or sys.argv[1] not in SHEETS:
        print('usage: python -I contact.py <sheet> <out.png> [--frames a,b] [--crop <png>:x0,y0,x1,y1] [--shadow 14]')
        sys.exit(2)
    main(sys.argv[1:])
