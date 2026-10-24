# Part evolution tiers, method A block-in (+ method B refinement, see pixellab_merge.py): improvedPistons, pistonArray
# (machine.pistonBlock, 96x58, origin bottom-centre, layer back, static). 5 tiers (PART_TIERS 2.3):
#   MK II  left upright and base derusted, bright gland nuts on the 3 heads, riveted patch clamp on the manifold pipe
#   MK III 2 iron hoops per cylinder barrel, diagonal tie-rod knee braces in the see-through gap under the cylinders
#          (the biggest silhouette change of the part), rust 0, dust cleaned, machined highlights
#   MK IV  brass gland caps with a glint, piston rods polished (1 px #a3a6a4), brass oiler cups on the manifold,
#          orange bands on the base-beam ends, patch gone (re-cast pipe), base top edge polished
#   MK V   pressure lamp on the centre cylinder at the manifold line (heartbeat), warm seam along the base-beam top
#   t5b    heartbeat low frame: lamp and seam one ramp step dimmer
# Geometry: the yoke (machine.pistonYoke, back layer, drawn BEHIND the block) sweeps block rows 26-51; its plunger rods
# are at block x18-21 / 46-49 / 74-77 and its bar spans x8-87. The braces are front-plane stays the yoke slides behind;
# they stay clear of the plunger rods (rows <= 45) and of the centre conrod (x44-51). Cylinders repeat every 28 px.
#   python scripts/art/tiers/piston_tiers.py [outRoot]
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import pixellab_merge as PM  # noqa: E402
import tierlib as T  # noqa: E402

copy, put, remap = T.copy_grid, T.put, T.remap

base = T.load_grid(os.path.join(T.MACHINE, 'piston-block.png'))
H, W = len(base), len(base[0])
CYL = (0, 28, 56)          # x offset of cylinders 1-3 (cylinder 1: head x9-29, barrel x11-27, rod stub x16-22)


def left_upright(x, y):
    return x <= 6 and y <= 52


def base_beam(x, y):
    return y >= 53


# ---------- MK II PATCHED ----------
t2 = copy(base)
remap(t2, {'c': '2', 'e': '3', 't': '3'}, lambda x, y: left_upright(x, y) or base_beam(x, y))
for o in CYL:
    # bright gland nut on each head (central boss x16-22, rows 0-2): lit top face, faceted front
    put(t2, 17 + o, 1, '45554')
    put(t2, 17 + o, 2, '34332')
# riveted patch clamp over the pipe between cylinders 2 and 3 (x61-65), 1 px proud above and below the pipe
put(t2, 61, 15, 'KKKKK')
put(t2, 61, 16, '44443')
put(t2, 61, 17, '45352')
put(t2, 61, 18, '43332')
put(t2, 61, 19, '43332')
put(t2, 61, 20, '45352')
put(t2, 61, 21, '32221')
put(t2, 61, 22, 'KKKKK')
# MK II riveted patch plates on the barrels (AD round 4: at the Era I default camera, zoom 1, the gland nuts and the pipe
# clamp alone did not read; MK I has almost no rust to knock off). One 5x5 plate per barrel at a different height (field
# repairs over cracks), lit top / left edge, 4 rivets, 1 px drop shadow. Written to piston-block-t2.png only: MK III is
# built from t2 WITHOUT them (the iron hoops replace the plates, and the method-B barrel merge rewrites those rectangles
# anyway), so MK III-V stay byte-identical.
PLATE = ['55554', '55453', '54443', '55453', '43332']
PLATES_AT = [(21, 9), (40, 16), (69, 11)]     # (x, y) top-left: cylinder 1 upper right, 2 lower left, 3 upper left
t2_out = copy(t2)
for px, py in PLATES_AT:
    for k, row in enumerate(PLATE):
        put(t2_out, px, py + k, row)
    for i in range(1, len(PLATE[0]) + 1):
        if t2_out[py + len(PLATE)][px + i] not in 'K.':
            t2_out[py + len(PLATE)][px + i] = '1'

# ---------- MK III REINFORCED ----------
HILITE = {(17 + o) for o in CYL} | {2, 90}      # barrel highlight columns and the uprights' lit columns


def clean_pass(g):
    """Rust 0 everywhere, sand dust off, the dusty sky-grey film becomes clean iron (machined highlight columns)."""
    remap(g, {'c': '2', 'e': '3', 't': '3', 'b': '2', 'a': '1', 'd': '3'})
    for y in range(H):
        for x in range(W):
            if g[y][x] == 'p':
                g[y][x] = '4' if (x in HILITE and 4 <= y <= 52) else '3'


t3 = copy(t2)
clean_pass(t3)
CLEAN = copy(base)
clean_pass(CLEAN)
# two iron hoops per barrel (rows 9-11 and 22-24): bright band row, mid row, ink shadow line under the band; the band
# stands 1 px proud of the barrel on each side (x10 / x28 for cylinder 1)
HOOP = ['K3' + '345554444433332' + '2K', 'K1' + '122333333222211' + '1K', '.' + 'K' * 17 + '.']
for o in CYL:
    for hy in (9, 22):
        for k, row in enumerate(HOOP):
            put(t3, 10 + o, hy + k, row.replace('.', ' '))
# diagonal tie-rod knee braces at 45 degrees, from the upright inner face (row 38) down to the base-beam top (row 52):
# 2 px core inside ink ('\' on the left, '/' on the right, mirrored about x = 47.5); the lit px is the left one
for i in range(15):
    put(t3, 6 + i, 38 + i, 'K42K')
    put(t3, 86 - i, 38 + i, 'K42K')
# gusset plates where the braces meet the uprights
put(t3, 7, 35, 'KK')
put(t3, 7, 36, '45K')
put(t3, 7, 37, '432K')
put(t3, 87, 35, 'KK')
put(t3, 86, 36, 'K54')
put(t3, 85, 37, 'K234')
# foot plates bolted to the base-beam top (rows 50-52), the brace ends sit on them
put(t3, 17, 50, ' KKKKKKK')
put(t3, 17, 51, 'K4554442K')
put(t3, 17, 52, 'K3222221K')
put(t3, 71, 50, 'KKKKKKK')
put(t3, 70, 51, 'K2445544K')
put(t3, 70, 52, 'K1222223K')
# turnbuckles at mid-length: the rod thickens by 1 px each side for 2 rows
put(t3, 11, 43, 'K542K')
put(t3, 12, 44, 'K432K')
put(t3, 80, 43, 'K452K')
put(t3, 79, 44, 'K432K')

# method B: PixelLab edit_image (job 03612802, seed 2211, 10 gens; the 4 hand-blocked tiers as frames) refined the
# barrels and the braces; its MK III frame, snapped to the iron ramp + ink (pixellab/piston-block-t3-gen-iron.png), is
# merged ONLY inside these rectangles, silhouette and ink locked (pixellab_merge.merge). MK IV / V build on it, so the
# refined barrels and braces stay identical up the ladder.
GEN = T.load_rgba(os.path.join(HERE, 'pixellab', 'piston-block-t3-gen-iron.png'))
ACCEPT = [(12 + o, 7, 26 + o, 25) for o in CYL] + [(6, 35, 26, 52), (69, 35, 89, 52)]
t3 = T.to_grid(PM.merge(T.from_grid(t3), GEN, ACCEPT))

# ---------- MK IV TUNED ----------
t4 = copy(t3)
# patch clamp off: the pipe between cylinders 2 and 3 is re-cast (restored from a clean pass of the MK I pipe)
for y in range(15, 23):
    for x in range(61, 66):
        t4[y][x] = CLEAN[y][x]
for o in CYL:
    # brass gland caps with a glint
    put(t4, 17 + o, 1, 'Cffed')
    put(t4, 17 + o, 2, 'feddc')
    # polished piston rod: 1 px #a3a6a4 column in each rod stub
    for y in range(31, 35):
        t4[y][19 + o] = '5'
        t4[y][20 + o] = '4'
# brass oiler cups on top of the two manifold sections between the cylinders (centred on x33 and x61)
for cx in (33, 61):
    put(t4, cx - 2, 12, ' KKK ')
    put(t4, cx - 2, 13, 'KCffK')
    put(t4, cx - 2, 14, 'KfedK')
    put(t4, cx - 2, 15, ' KdK ')
# orange bands on the base-beam ends
for y in (54, 55):
    put(t4, 1, y, 'AAA')
    put(t4, 92, y, 'AAA')
put(t4, 1, 56, 'ddd')
put(t4, 92, 56, 'ddd')
# base top edge polished
for x in range(4, 92):
    if t4[54][x] == '3':
        t4[54][x] = '4'

# ---------- MK V AS BUILT ----------
t5 = copy(t4)
LAMP = (45, 16)            # 5x5 lamp (ink ring) on the centre cylinder at the manifold line
put(t5, LAMP[0], LAMP[1] + 0, ' KKK ')
put(t5, LAMP[0], LAMP[1] + 1, 'KABAK')
put(t5, LAMP[0], LAMP[1] + 2, 'KBCBK')
put(t5, LAMP[0], LAMP[1] + 3, 'KABAK')
put(t5, LAMP[0], LAMP[1] + 4, ' KKK ')
SEAM = (26, 69)            # warm seam along the base-beam top between the brace feet, #f0a848 core in the middle
for x in range(SEAM[0], SEAM[1] + 1):
    t5[54][x] = 'B' if 40 <= x <= 55 else 'A'

t5b = copy(t5)
for y in range(H):
    for x in range(W):
        lamp = LAMP[0] <= x <= LAMP[0] + 4 and LAMP[1] <= y <= LAMP[1] + 4
        seam = y == 54 and SEAM[0] <= x <= SEAM[1]
        if lamp or seam:
            t5b[y][x] = {'C': 'B', 'B': 'A', 'A': 'd'}.get(t5b[y][x], t5b[y][x])

TIERS = [('piston-block-t2.png', t2_out), ('piston-block-t3.png', t3), ('piston-block-t4.png', t4),
         ('piston-block-t5.png', t5), ('piston-block-t5b.png', t5b)]


def main():
    out_root = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else T.TIERS
    for name, g in TIERS:
        dst = os.path.join(out_root, name)
        print('wrote %s %d B' % (T.rel(dst), T.save_grid(g, dst)))


if __name__ == '__main__':
    main()
