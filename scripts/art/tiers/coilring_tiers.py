# Part evolution tiers, method A: harmonicCoil (5 tiers, sparse swap on the staged rings; PART_TIERS 2.3).
# MK I coilRing1, MK III coilRing2 (minLevel 8), MK IV coilRing3 (16), MK V coilRing4 (25) stay staged components.
# One 4-frame sheet swap fills MK II (248x8 = 4 frames of 62x8, centre origin, the resonance driver picks the frame):
#   coil-ring-1-t2.png (MK II PATCHED on coilRing1): the copper re-wound: the verdigris patina (#3f5e52 / #7fae96 at
#     rows 4-6) comes off and the winding's own turn pattern runs unbroken (rows 4-5 'cbc' turns, row 6 the shadow
#     run); where each patina patch was, one 2 px glint of the ring's pale verdigris light (#cfe8d6 over #7fae96, the
#     ART_ERA4 'cyan' the resonance shimmer already uses) sits on the turn crest (rows 3-4). The travelling shimmer
#     (rows 2-3, one position per frame) is kept and wins where it passes a glint.
# Alpha 0/255; every MK I opaque pixel stays opaque; palette = Rust Wasteland + the verdigris the shipped ring uses.
#   python scripts/art/tiers/coilring_tiers.py [outRoot]
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import tierlib as T  # noqa: E402

FW, NF = 62, 4
base = T.load_grid(os.path.join(T.MACHINE, 'era4', 'coil-ring-1.png'))
SHIMMER = set('HI')     # the travelling resonance shimmer (rows 2-3)


def turn(x, y):
    """The clean winding at (frame x, row y): the shipped turn pattern, period 3 (rows 4-5), shadow run (row 6)."""
    if y == 6:
        return 'b'
    if y == 4:
        return 'b' if x % 3 == 2 else 'c'
    if y == 5:
        return 'b' if x % 3 == 1 else 'c'
    raise ValueError(y)


# sanity: the clean pattern reproduces every non-patina cell of rows 4-6 (x4-59; the ring's ends are hand-shaded)
for f in range(NF):
    for y in (4, 5, 6):
        for x in range(4, 60):
            c = base[y][f * FW + x]
            if c not in 'GH':
                assert c == turn(x, y), (f, x, y, c)

t2 = T.copy_grid(base)
glints = []
for f in range(NF):
    ox = f * FW
    patch_cols = []
    for y in (4, 5, 6):
        for x in range(1, FW - 1):
            if base[y][ox + x] in 'GH':
                t2[y][ox + x] = turn(x, y)
                patch_cols.append(x)
    # one glint per patch: patches are runs of columns; take each run's middle column
    cols = sorted(set(patch_cols))
    runs, run = [], [cols[0]]
    for x in cols[1:]:
        if x - run[-1] <= 1:
            run.append(x)
        else:
            runs.append(run)
            run = [x]
    runs.append(run)
    if f == 0:
        glints = [r[len(r) // 2] for r in runs]
    for x in glints:
        if base[3][ox + x] not in SHIMMER:   # the shimmer passing over a glint wins
            t2[3][ox + x] = 'I'
        t2[4][ox + x] = 'H'


def main():
    out_root = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else T.TIERS
    dst = os.path.join(out_root, 'coil-ring-1-t2.png')
    print('wrote %s %d B (glints at x %s)' % (T.rel(dst), T.save_grid(t2, dst), glints))


if __name__ == '__main__':
    main()
