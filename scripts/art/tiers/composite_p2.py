# Part evolution tiers: G5 check for the P2 hosts (backfeed terminal, steam lance) in a REAL in-game screenshot at
# 1 screen px per art px (zoom 0.5 framing; Era V shot, e.g. a 3840x2160 store shot reduced by exactly 3). Both hosts
# hang under the null gallery deck and are unique, so each is located globally by exact pixel matching. A tier variant
# pixel is painted where the MK I pixel is visible on screen (the lance's steam puffs in front keep covering it), plus
# the variant's new opaque px. The lance crop also marks the steam emitter start (src/data/steamFx.ts lance `at`,
# texture (16, 29)) in a strip under the crops, so the puff-start zone can be checked.
# Writes <outDir>/<host>-g5.png: the tier crops at zoom 0.5 (1 px / art px, left) and zoom 1 (2 px / art px, right),
# each shown 3x nearest for review.
#   python scripts/art/tiers/composite_p2.py <shot.png> <outDir> [tiersDir]
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import composite_p1 as CP  # noqa: E402
import composite_shot as CS  # noqa: E402
import tierlib as T  # noqa: E402

M = T.MACHINE
L3 = [('MK I', 1), ('MK II', 2), ('MK III', 3), ('MK III low', '3b')]
# host: (base file, crop pad (l, t, r, b), puff start in texture px or None)
HOSTS = {
    'backfeed-terminal': ('legacy/backfeed-terminal.png', (22, 10, 26, 14), None),
    'steam-lance': ('legacy/steam-lance.png', (22, 10, 26, 10), (16, 29)),
}


def main():
    shot, out_dir = sys.argv[1], os.path.abspath(sys.argv[2])
    tdir = os.path.abspath(sys.argv[3]) if len(sys.argv) > 3 else T.TIERS
    os.makedirs(out_dir, exist_ok=True)
    screen = np.array(Image.open(shot).convert('RGBA'))
    for stem, (base_f, pad, puff) in HOSTS.items():
        base = T.load_rgba(os.path.join(M, base_f))
        hx, hy = CS.locate_global(screen, base, 1)
        sc = CS.score(screen, base, 1, hx, hy)
        tot = int((base[:, :, 3] == 255).sum())
        print('%-17s at (%d,%d) visible match %.1f %%' % (stem, hx, hy, 100.0 * sc / tot))
        if sc < 0.5 * tot:
            print('%-17s not built in this shot: skipped' % stem)
            continue
        h, w = base.shape[:2]
        x0, y0, x1, y1 = hx - pad[0], hy - pad[1], hx + w + pad[2], hy + h + pad[3]
        crops = []
        for lab, key in L3:
            out = screen.copy()
            if key != 1:
                var = T.load_rgba(os.path.join(tdir, '%s-t%s.png' % (stem, key)))
                CS.paint(out, screen, base, var, 1, hx, hy, new_too=True)
            crops.append((lab, out[y0:y1, x0:x1]))
        if puff:
            mark = screen.copy()
            px, py = hx + puff[0], hy + puff[1]
            mark[py, max(x0, px - 2):px + 3, :3] = (255, 0, 255)
            mark[max(y0, py - 2):py + 3, px, :3] = (255, 0, 255)
            crops.append(('MK I + puff start', mark[y0:y1, x0:x1]))
        CP.sheet_out(os.path.join(out_dir, stem + '-g5.png'), '%s at (%d,%d)' % (stem, hx, hy), crops)


if __name__ == '__main__':
    main()
