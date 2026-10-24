# Part evolution tiers, method A: copperWinding (5 tiers, sparse swaps; PART_TIERS 2.3).
# MK I coilStage1 (shipped), MK III coilStage2 (shipped, minLevel 10), MK IV coilStage3 (shipped, minLevel 20) stay
# staged components. Two swaps fill the gaps:
#   coils-1-t2.png (MK II PATCHED on coilStage1): windings re-laid tight (even turns, rounded right edge), sand-ramp
#     tape (#c9b28a / #8a7a64) on both end turns, 1 glint per coil.
#   coils-3-t5.png (MK V AS BUILT on coilStage3): #ffd27a varnish line along the top turn of each coil, and the warm
#     seam (#d9822b with an #f0a848 core) along the yoke soffit between the 2 coils (coil rows 3, x30-41 = generator
#     rows 15, x46-57: drawn over the opaque generator yoke, so it never floats in the arch window). No heartbeat: the
#     generatorGlow gauge already lives here (its stripes cover coil rows 13-23 only, so the varnish line and the seam
#     stay visible at full glow).
# Canvas 64x40, centre origin, same as the shipped stage art; alpha 0/255; no resampling.
#   python scripts/art/tiers/coil_tiers.py [outRoot]
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import tierlib as T  # noqa: E402

put = T.put
ERA2 = os.path.join(T.MACHINE, 'era2')
BLOCKS1 = (14, 47)   # coils-1 coil blocks: x0 of each 10 px block, rows 12-24
BLOCKS3 = (12, 45)   # coils-3 coil blocks: x0 of each 14 px block (ink sides included), rows 12-24

c1 = T.load_grid(os.path.join(ERA2, 'coils-1.png'))
c3 = T.load_grid(os.path.join(ERA2, 'coils-3.png'))

# ---------- coils-1 MK II ----------
t2 = T.copy_grid(c1)
for x0 in BLOCKS1:
    put(t2, x0, 12, 'vvvvvvvvtt')            # tape, top end turn
    for y in (14, 16, 18, 20, 22):
        put(t2, x0, y, 'deeeeeeeec')         # turns re-laid tight: one even lit run between a lit-edge column (d)
    for y in (13, 15, 17, 19, 21, 23):       # and a shadow column (c) that run the full height (no lone pixels)
        put(t2, x0, y, 'dccccccccc')
    put(t2, x0, 24, 'vvvvvvvvtt')            # tape, bottom end turn
    put(t2, x0 + 2, 18, 'B')                 # 1 glint per coil

# ---------- coils-3 MK V ----------
t5 = T.copy_grid(c3)
for x0 in BLOCKS3:
    put(t5, x0 + 3, 12, 'CCCCCCf')           # varnish line on the top turn (x+3..x+8 were the lit 'f' run)
# warm seam along the yoke soffit between the coils
put(t5, 30, 3, 'AAABBBBBBAAA')


def main():
    out_root = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else T.TIERS
    for name, g in [('coils-1-t2.png', t2), ('coils-3-t5.png', t5)]:
        dst = os.path.join(out_root, name)
        print('wrote %s %d B' % (T.rel(dst), T.save_grid(g, dst)))


if __name__ == '__main__':
    main()
