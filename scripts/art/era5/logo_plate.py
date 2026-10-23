# Title logo plate (WP16b F6, Art Director): riveted iron builder's plate, rust streaks from the top bolts,
# raised cast letters with a 1 px cast shadow. 230x50, locked palette (pal.py). Generator of the shipped
# public/assets/ui/logo.png (ui.py logo() is the legacy flat plate).
# Usage: python -I scripts/art/era5/logo_plate.py <out.png> [--force]   (writing public/assets/ui/logo.png needs --force)
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import numpy as np
from pal import INV, put, get, blank, check, save
from fonts import F5, text_mask

USAGE = 'usage: python -I scripts/art/era5/logo_plate.py <out.png> [--force]'
SHIPPED = os.path.normcase(os.path.abspath(os.path.join(HERE, '..', '..', '..', 'public', 'assets', 'ui', 'logo.png')))
W, H = 230, 50


def is_shipped(path: str) -> bool:
    return os.path.normcase(os.path.abspath(path)) == SHIPPED


def outline(a, k='ink'):
    m = a[:, :, 3] > 0; o = a.copy(); H, W = m.shape
    for y in range(H):
        for x in range(W):
            if m[y, x]: continue
            if any(0 <= y + dy < H and 0 <= x + dx < W and m[y + dy, x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                put(o, x, y, k)
    return o


def cast_text(s, scale=2):
    """same raised cast letters as ui.py logo(): fill a1, lit top-left edge a2, shadow bottom-right r4, ink outline."""
    m = text_mask(s, F5); h, w = len(m) * scale, len(m[0]) * scale
    a = blank(w + 4, h + 4); M = np.zeros((h + 4, w + 4), bool)
    for j in range(len(m)):
        for i in range(len(m[0])):
            if m[j][i]: M[2 + j * scale:2 + (j + 1) * scale, 2 + i * scale:2 + (i + 1) * scale] = True
    for y in range(h + 4):
        for x in range(w + 4):
            if M[y, x]:
                up = not M[y - 1, x] or not M[y, x - 1]; dn = not M[y + 1, x] or not M[y, x + 1]
                put(a, x, y, 'a2' if up and not dn else 'r4' if dn and not up else 'a1')
    return outline(a, 'ink')


def build() -> np.ndarray:
    a = blank(W, H)
    for y in range(H):
        for x in range(W): put(a, x, y, 'i3')
    # builder's plate: ink rim, raised border bead (lit top/left faces i4, shaded lower/right faces i2/i1), flat field i3
    for x in range(W):
        put(a, x, 0, 'ink'); put(a, x, H - 1, 'ink')
        put(a, x, 1, 'i4'); put(a, x, 2, 'i2'); put(a, x, H - 3, 'i4'); put(a, x, H - 2, 'i1')
    for y in range(H):
        put(a, 0, y, 'ink'); put(a, W - 1, y, 'ink')
    for y in range(1, H - 1):
        put(a, 1, y, 'i4'); put(a, 2, y, 'i2') if 2 < y < H - 3 else None
        put(a, W - 3, y, 'i4') if 2 < y < H - 3 else None; put(a, W - 2, y, 'i1')
    put(a, 1, 1, 'i5'); put(a, 2, 1, 'i5'); put(a, 1, 2, 'i5')         # corner glint (light upper-left)
    put(a, W - 2, 1, 'i3'); put(a, 1, H - 2, 'i3'); put(a, 2, 2, 'i3'); put(a, W - 3, H - 3, 'i3')

    def bolt(x, y):
        """5x5 domed bolt head: ink ring, lit upper-left (i5/i4), shaded lower-right (i2/i1); 1 px shadow on the field."""
        rows = ['.kkk.', 'k54' + '3k', 'k442k', 'k321k', '.kkk.']
        key = {'k': 'ink', '5': 'i5', '4': 'i4', '3': 'i3', '2': 'i2', '1': 'i1'}
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch in key: put(a, x + i, y + j, key[ch])
        for (dx, dy) in ((5, 1), (5, 2), (5, 3), (4, 4), (1, 5), (2, 5), (3, 5), (4, 5)):
            if get(a, x + dx, y + dy) == 'i3': put(a, x + dx, y + dy, 'i2')

    def streak(x, y, ks):
        for i, k in enumerate(ks):
            if get(a, x, y + i) in ('i2', 'i3'): put(a, x, y + i, k)

    def cluster(x, y, shape, on=('i3', 'i4', 'i2', 'i1')):
        for (dx, dy, k) in shape:
            if get(a, x + dx, y + dy) in on: put(a, x + dx, y + dy, k)

    BOLTS = [(4, 4), (W - 9, 4), (4, H - 10), (W - 9, H - 10)]   # mirrored: 4 px from the bead on both sides
    for (bx, by) in BOLTS:
        bolt(bx, by)
    # rust bleeding down from the top bolts: fresh r3 at the head, r2 run, dried r1 tail
    streak(6, 9, ['r3', 'r2', 'r2', 'r2', 'r1', 'r1'])
    streak(7, 10, ['r2', 'r1'])
    streak(W - 7, 9, ['r3', 'r2', 'r1', 'r2', 'r1'])
    # rust collar under the bottom bolts
    for (bx, by) in BOLTS[2:]:
        for dx, k in ((1, 'r2'), (2, 'r3'), (3, 'r2')):
            if get(a, bx + dx, by + 6) in ('i3', 'i2', 'i4'): put(a, bx + dx, by + 6, k)
    # letters: same placement as the original logo, plus a 1 px cast shadow down-right on the plate face
    l1, l2 = cast_text('WHAT EXACTLY DOES'), cast_text('THIS MACHINE DO?')
    for (img, y0) in ((l1, 4), (l2, 4 + l1.shape[0] + 4)):
        x0 = (W - img.shape[1]) // 2
        for yy in range(img.shape[0]):
            for xx in range(img.shape[1]):
                if img[yy, xx, 3] and get(a, x0 + xx + 1, y0 + yy + 1) == 'i3':
                    put(a, x0 + xx + 1, y0 + yy + 1, 'i1')
        for yy in range(img.shape[0]):
            for xx in range(img.shape[1]):
                if img[yy, xx, 3]: a[y0 + yy, x0 + xx] = img[yy, xx]
    # weathering: irregular rust blooms on the lower bead (water line), one creeping into the field; two specks on the top bead
    BLOOM_L = [(1, -1, 'r2'), (2, -1, 'r1'), (0, 0, 'r2'), (1, 0, 'r3'), (2, 0, 'r3'), (3, 0, 'r2'), (4, 0, 'r1'), (1, 1, 'r1'), (3, 1, 'r1')]
    BLOOM_S = [(0, 0, 'r2'), (1, 0, 'r3'), (1, 1, 'r1')]
    BLOOM_M = [(0, 0, 'r1'), (1, 0, 'r2'), (2, 0, 'r3'), (2, 1, 'r2'), (3, 1, 'r1')]
    cluster(31, H - 3, BLOOM_L)
    cluster(102, H - 3, BLOOM_S)
    cluster(146, H - 3, BLOOM_M)
    cluster(193, H - 3, BLOOM_S)
    cluster(77, 1, [(0, 0, 'r2'), (1, 0, 'r3'), (1, 1, 'r1')])
    cluster(165, 1, [(0, 0, 'r1'), (1, 0, 'r2')])
    return a


def main(argv: list) -> int:
    force = '--force' in argv
    args = [x for x in argv if x != '--force']
    if len(args) != 1:
        print(USAGE, file=sys.stderr)
        return 2
    out = args[0]
    if is_shipped(out) and os.path.exists(out) and not force:
        print('refusing to overwrite the shipped logo without --force', file=sys.stderr)
        return 2
    a = build()
    check(a, 'logo2')
    save(a, out)
    print('colours', sorted({INV.get(tuple(p[:3]), '?') for p in a.reshape(-1, 4) if p[3]}))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
