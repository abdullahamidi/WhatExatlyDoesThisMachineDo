# Part evolution tiers, method A block-in (+ method B refinement, see pixellab_merge.py): pressureResonator, calliope
# (machine.calliope, 72x40, bottom origin, static, layer back over the steam manifold). Three copper bell whistles
# (W1 x2-14 rows 11-32, W2 x29-41 rows 6-32, W3 x57-70 rows 1-32: finial, cap, bell, dark mouth slot, lip, bowl) on
# iron valve crosses (rows 33-38, blind side flanges) whose stems (row 39) sit on the manifold's three branch stubs
# (manifold row 4, the pipe top, is the row just below this canvas). 5 tiers (PART_TIERS 2.3):
#   MK II  PATCHED   whistles derusted: every verdigris spot (#3f5e52 / #7fae96) on the copper becomes the copper tone
#                    of its column (the crusted mouth lips of W2 / W3 become clean copper lips; drips outside an outline
#                    become ink); valve-cross rust knocked off (DERUST-LIGHT on rows 33-39); bright bolt heads (2 per
#                    blind flange)
#   MK III REINFORCED a 4th, smallest whistle W4 (bell x45-53) between W2 and W3, on its own small valve and a port boss
#                    that sits on the manifold pipe like the others; an iron strap bracket (rows 36-38) from W2's blind
#                    flange to W3's, clamped round W4's riser (bell whistles are never clamped at the bell: it must ring);
#                    valve bonnet tops machined bright
#   MK IV  TUNED     master regulator valve block on the manifold in the W1-W2 gap (x16-26, port boss on the pipe)
#                    with a brass handwheel face-on (pitch follows steam pressure: the regulator is what tunes a
#                    calliope), an orange throttle lever on it (ANSI orange: a moving control), the strap bracket in
#                    brass
#   MK V   AS BUILT  polished round copper on all four whistles (method B merge, below), pilot lamp on the regulator
#                    (the calliope's manifold), warm whistle mouths (#d9822b with a #f0a848 core along the bottom of
#                    each mouth slot)
#   t5b    heartbeat low frame: lamp and mouths one ramp step dimmer
# Reserved: the three existing ports (stems + flange bottoms, rows 37-39 under W1 / W2 / W3) gain no pixel; new ports
# (W4, regulator) only touch the pipe top. Copper whistles = identity (rust ramp in clean bands, not rust).
# Palette: Rust Wasteland + the verdigris the shipped whistles use.
#   python scripts/art/tiers/calliope_tiers.py [outRoot]
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import pixellab_merge as PM  # noqa: E402
import tierlib as T  # noqa: E402

copy, put, remap = T.copy_grid, T.put, T.remap

base = T.load_grid(os.path.join(T.MACHINE, 'era4', 'calliope.png'))
H, W = len(base), len(base[0])

# ---------- MK II PATCHED ----------
VERDIGRIS = {
    # W1
    (7, 11): 'K', (13, 15): 'd', (10, 17): 'f', (6, 21): 'f', (5, 22): 'e', (4, 25): 'd', (4, 27): 'd',
    (12, 29): 'd', (12, 31): 'K',
    # W2 (row 27 = the mouth's lower lip, crusted: becomes a clean copper lip)
    (30, 10): 'f', (37, 11): 'd', (33, 22): 'f', (37, 23): 'f', (38, 23): 'd', (31, 25): 'd', (32, 26): 'K',
    (31, 27): 'd', (32, 27): 'e', (33, 27): 'f', (34, 27): 'f', (35, 27): 'f', (36, 27): 'e', (37, 27): 'd',
    (32, 29): 'd', (39, 29): 'd',
    # W3 (row 26 = the lower lip)
    (67, 6): 'd', (61, 21): 'f', (61, 22): 'f', (61, 26): 'e', (62, 26): 'f', (63, 26): 'f', (64, 26): 'f',
    (65, 26): 'e', (66, 26): 'd', (67, 28): 'd', (58, 29): 'K', (60, 29): 'd', (67, 29): 'd',
}
t2 = copy(base)
for (x, y), ch in VERDIGRIS.items():
    assert base[y][x] in 'GH', (x, y, base[y][x])
    t2[y][x] = ch
assert not any(c in 'GH' for r in t2 for c in r), 'verdigris left'
remap(t2, {'d': '3', 'e': '4', 'f': '5'}, lambda x, y: y >= 33)            # DERUST-LIGHT on the valve crosses
FLANGE_BOLTS = [(3, 34), (3, 36), (13, 34), (13, 36), (31, 34), (31, 36), (40, 34), (40, 36), (59, 34), (59, 36),
                (68, 34), (68, 36)]
for (x, y) in FLANGE_BOLTS:
    assert t2[y][x] in '1234', (x, y, t2[y][x])
    t2[y][x] = '5'

# ---------- MK III REINFORCED ----------
t3 = copy(t2)
W4 = [            # x44-54, rows 18-34: finial, cap, brim, bell, mouth, lip, bowl rim, bowl, valve
    '....KK.....',
    '...KfdK....',
    '.KKKKKKKKK.',
    'KfefffffddK',
    '.KdddddddK.',
    '.KdefffddK.',
    '.KdffffddK.',
    '.KdKKKKKdK.',
    '.KdKKKKKdK.',
    '.KdefffedK.',
    'KddfffffddK',
    '.KKdddddKK.',
    '..KddfddK..',
    '...KKKKK...',
    '...K432K...',
    '..K43321K..',
    '...K321K...',
]
for i, row in enumerate(W4):
    put(t3, 44, 18 + i, row.replace('.', ' '))
# strap bracket: a flat iron bar (rows 36-37: lit top band, shadow band) bolted to W2's blind flange (x41) and W3's
# (x58), ink underside, 2 rivets; it carries W4 by a clamp collar round its riser (x46-52, rows 35-38)
for x in range(42, 58):
    t3[36][x] = '4'
    t3[37][x] = '2'
    t3[38][x] = 'K'
for x in (42, 57):              # bolt heads into the blind flanges
    t3[36][x] = '5'
for x in (44, 55):              # rivets
    t3[37][x] = '3'
put(t3, 46, 35, 'KKKKKKK')     # clamp collar
put(t3, 46, 36, 'K45443K')
put(t3, 46, 37, 'K33322K')
put(t3, 46, 38, 'KKKKKKK')
put(t3, 46, 39, 'K34333K')     # W4 port boss on the manifold pipe (the pipe top is the next row)
for (x, y) in ((7, 33), (34, 33), (62, 33)):   # machined bonnet tops
    t3[y][x] = '4'

# ---------- MK IV TUNED ----------
t4 = copy(t3)
# strap bracket in brass (rust ramp in clean, straight bands, #ffd27a glint at the lit end), the clamp collar too
remap(t4, {'4': 'f', '2': 'd', '5': 'e', '3': 'e'}, lambda x, y: 36 <= y <= 37 and 42 <= x <= 57)
t4[36][43] = 'C'
# regulator in the W1-W2 gap (x15-28): pitch follows steam pressure, so the master regulator is what tunes a calliope.
# Iron valve block on the pipe (x16-26, rows 31-38, port boss row 39), brass handwheel face-on on its front (stem toward
# the viewer; ring, 4 spokes, #ffd27a hub, the block's dark iron in the spoke gaps), orange throttle lever pivoted on
# the block's right shoulder (grip rows 24-26, ANSI orange: a moving control). Clear of W1 (x <= 14) and W2 (x >= 29).
for y in range(31, 39):
    for x in range(16, 27):
        corner = (y in (31, 38)) and x in (16, 26)
        if corner:
            continue
        edge = y in (31, 38) or x in (16, 26)
        t4[y][x] = 'K' if edge else ('4' if (y == 32 or x == 17) else ('2' if (x >= 24 or y >= 36) else '3'))
put(t4, 18, 39, 'K34333K')
WHEEL = ['..KKK..',
         '.KfffK.',
         'Kf1e1dK',
         'KeeCedK',
         'Ke1e1dK',
         '.KdddK.',
         '..KKK..']
for i, row in enumerate(WHEEL):
    for j, ch in enumerate(row):
        if ch != '.':
            t4[31 + i][18 + j] = ch
t4[32][19] = 'C'                 # glint on the lit upper-left of the rim
for y in range(24, 27):          # orange grip
    put(t4, 25, y, 'KAK' if y != 25 else 'KBK')
put(t4, 25, 23, ' K ')
for y in range(27, 32):          # iron arm down to the pivot on the block's right shoulder
    put(t4, 25, y, 'K3K')
t4[32][26] = '5'                 # pivot pin

# ---------- MK V AS BUILT ----------
# method B: PixelLab edit_image (job d842764a, seed 2213, 10 gens; the 4 hand-blocked tiers t2-t5 as frames, "polish
# the copper, crisp highlights, move nothing"). Its MK V frame, snapped to the copper ramp + ink only
# (pixellab/calliope-t5-gen-copper.png: a full-palette snap put its specular highlights on the accent and iron colours),
# is merged ONLY on the four whistles (finial, cap, bell, lip, bowl; rows 0-32), silhouette and ink locked: the round,
# polished AS BUILT copper (dark rim, mid band, lit stripe). Rejected: its handwheel (a waffle at 7 px), its strap and
# valve shading (no better than the block-in) and every raw colour.
GEN = T.load_rgba(os.path.join(HERE, 'pixellab', 'calliope-t5-gen-copper.png'))
WHISTLES = [(2, 0, 14, 32), (29, 0, 41, 32), (44, 0, 54, 31), (57, 0, 70, 32)]   # W4's valve starts at row 32
t5 = T.to_grid(PM.merge(T.from_grid(t4), GEN, WHISTLES))
for (x0, y0, x1, y1) in WHISTLES:          # the merge may only re-shade copper (never valves, ink or new colours)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if t5[y][x] != t4[y][x]:
                assert t4[y][x] in 'cdef' and t5[y][x] in 'cdef', (x, y, t4[y][x], t5[y][x])
LAMP = (16, 26)   # 5x5 pilot lamp standing on the regulator block's left shoulder (ring foot on the block top, row 31)
put(t5, LAMP[0], LAMP[1] + 0, ' KKK ')
put(t5, LAMP[0], LAMP[1] + 1, 'KABAK')
put(t5, LAMP[0], LAMP[1] + 2, 'KBCBK')
put(t5, LAMP[0], LAMP[1] + 3, 'KABAK')
put(t5, LAMP[0], LAMP[1] + 4, ' KKK ')
MOUTHS = [(27, 5, 11), (26, 33, 38), (25, 60, 66), (26, 47, 51)]   # (row, x0, x1): bottom row of each mouth slot
for (y, x0, x1) in MOUTHS:
    for x in range(x0, x1 + 1):
        assert t5[y][x] == 'K', (x, y, t5[y][x])
        t5[y][x] = 'B' if x0 < x < x1 else 'A'

t5b = copy(t5)
for (y, x0, x1) in MOUTHS:
    for x in range(x0, x1 + 1):
        t5b[y][x] = {'B': 'A', 'A': 'd'}[t5b[y][x]]
for y in range(LAMP[1] + 1, LAMP[1] + 4):
    for x in range(LAMP[0] + 1, LAMP[0] + 4):
        t5b[y][x] = {'C': 'B', 'B': 'A', 'A': 'd'}[t5b[y][x]]

TIERS = [('calliope-t2.png', t2), ('calliope-t3.png', t3), ('calliope-t4.png', t4), ('calliope-t5.png', t5),
         ('calliope-t5b.png', t5b)]


def main():
    out_root = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else T.TIERS
    for name, g in TIERS:
        dst = os.path.join(out_root, name)
        print('wrote %s %d B' % (T.rel(dst), T.save_grid(g, dst)))


if __name__ == '__main__':
    main()
