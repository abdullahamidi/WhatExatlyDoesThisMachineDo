# Part evolution tiers: G5 check for ONE static host in a REAL in-game screenshot (Art Director).
# Locates the shipped MK I sprite in the shot by exact pixel matching at an integer art scale (zoom 1 = 2 screen px per
# art px, zoom 0.5 = 1), then paints each tier variant where the MK I pixel is visible on screen plus the variant's new
# opaque px, and writes the crop around the host per tier: <outPrefix>-rows.png at 1:1 and <outPrefix>-zoom.png at 3x.
#   python scripts/art/tiers/composite_host.py <shot.png> <scale> <outPrefix> <base.png> <tier.png> [<tier.png> ...]
#       [--pad N] [--labels a,b,c]
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import composite_shot as CS  # noqa: E402
import tierlib as T  # noqa: E402


def main():
    args = [a for a in sys.argv[1:]]
    opt = {}
    for k in ('--pad', '--labels'):
        if k in args:
            i = args.index(k)
            opt[k] = args[i + 1]
            del args[i:i + 2]
    shot, s, prefix, base_p = args[0], int(args[1]), args[2], args[3]
    tiers = args[4:]
    pad = int(opt.get('--pad', 24))
    screen = np.array(Image.open(shot).convert('RGBA'))
    base = T.load_rgba(base_p)
    ox, oy = CS.locate_global(screen, base, s)
    best = (CS.score(screen, base, s, ox, oy), ox, oy)
    for dy in range(-2 * s, 2 * s + 1):
        for dx in range(-2 * s, 2 * s + 1):
            sc = CS.score(screen, base, s, ox + dx, oy + dy)
            if sc > best[0]:
                best = (sc, ox + dx, oy + dy)
    sc, ox, oy = best
    tot = int((base[:, :, 3] == 255).sum()) * s * s
    print('located %s at (%d,%d), visible match %.1f %%' % (os.path.basename(base_p), ox, oy, 100.0 * sc / tot))
    h, w = base.shape[0] * s, base.shape[1] * s
    x0, y0 = max(0, ox - pad * s), max(0, oy - pad * s)
    x1, y1 = min(screen.shape[1], ox + w + pad * s), min(screen.shape[0], oy + h + pad * s // 2)
    labels = opt['--labels'].split(',') if '--labels' in opt else ['MK I'] + [os.path.basename(t) for t in tiers]
    crops = [(labels[0], screen[y0:y1, x0:x1])]
    for lab, tp in zip(labels[1:], tiers):
        out = screen.copy()
        CS.paint(out, screen, base, T.load_rgba(tp), s, ox, oy, new_too=True)
        crops.append((lab, out[y0:y1, x0:x1]))
    try:
        f = ImageFont.load_default(size=13)
    except Exception:
        f = ImageFont.load_default()
    for suffix, k in (('rows', 1), ('zoom', 3)):
        ch, cw = crops[0][1].shape[:2]
        cols = 3 if k == 1 else 2
        rows = (len(crops) + cols - 1) // cols
        sheet = Image.new('RGBA', (cols * (cw * k + 8) + 8, rows * (ch * k + 22) + 8), (40, 36, 32, 255))
        d = ImageDraw.Draw(sheet)
        for i, (lab, a) in enumerate(crops):
            x, y = 8 + (i % cols) * (cw * k + 8), 8 + (i // cols) * (ch * k + 22)
            d.text((x, y), lab, font=f, fill=(230, 220, 200, 255))
            sheet.alpha_composite(Image.fromarray(a).resize((cw * k, ch * k), Image.NEAREST), (x, y + 16))
        sheet.save('%s-%s.png' % (prefix, suffix))
        print('wrote %s-%s.png' % (prefix, suffix))


if __name__ == '__main__':
    main()
