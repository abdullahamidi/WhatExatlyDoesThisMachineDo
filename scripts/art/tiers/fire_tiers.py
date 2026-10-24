# Part evolution tiers, method A: firebox track (5 tiers, sparse swaps on the staged glows; PART_TIERS 2.3).
# MK I fireboxGlow1, MK III fireboxGlow2 (minLevel 10), MK IV fireboxGlow3 (minLevel 20) stay staged components. Two
# 4-frame sheet swaps fill the gaps (96x24 = 4 frames of 24x24, centre origin, the thermal driver picks the frame):
#   firebox-1-t2.png (MK II PATCHED on fireboxGlow1, the closed fire door): the flame shows 1 px taller in 2 of the 3
#     vent slots (frame rows 9; the 2 hotter slots of each frame, so the flicker keeps its rhythm), the slot fire one
#     ember-ramp step brighter (row 11: #b8402a -> #d9822b, #d9822b -> #f0a848), and the ember row under the door
#     brighter (row 16: the #6a2418 ember -> #b8402a plus a second #6a2418 ember 2 px away).
#   firebox-3-t5.png (MK V AS BUILT on fireboxGlow3, the open door): a steam-white (#e8e0cc, ART_ERA3 steam) core in
#     every frame: the #ffd27a cells of row 15 at x10-14, row 14 at x12 and the centre coal (row 16, x12).
# No heartbeat: the glow is animated by the thermal driver. Alpha 0/255; every MK I opaque pixel stays opaque; nothing
# outside the door window (frame x6-18, rows 8-21) changes.
#   python scripts/art/tiers/fire_tiers.py [outRoot]
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import tierlib as T  # noqa: E402

ERA3 = os.path.join(T.MACHINE, 'era3')
FW, NF = 24, 4
SLOTS = (10, 12, 14)          # vent slot columns of the closed fire door (frame coords), rows 10-11
BRIGHTER = {'h': 'A', 'A': 'B'}

g1 = T.load_grid(os.path.join(ERA3, 'firebox-1.png'))
g3 = T.load_grid(os.path.join(ERA3, 'firebox-3.png'))

# ---------- firebox-1 MK II ----------
t2 = T.copy_grid(g1)
for f in range(NF):
    ox = f * FW
    hot = [x for x in SLOTS if g1[11][ox + x] == 'A']          # the 2 hotter slots of this frame
    assert len(hot) == 2, (f, hot)
    for x in hot:
        assert t2[9][ox + x] == '.'
        t2[9][ox + x] = 'h'                                     # flame +1 px in the slot (2 px per frame)
    for x in SLOTS:
        t2[11][ox + x] = BRIGHTER[g1[11][ox + x]]               # slot fire one ramp step brighter
    ember = [x for x in range(FW) if g1[16][ox + x] == 'g']
    assert len(ember) == 1, (f, ember)
    ex = ember[0]
    t2[16][ox + ex] = 'h'                                       # the ember brighter
    nx = ex + 2 if ex + 2 <= 16 else ex - 2                     # a second ember on the door's bottom edge (x8-16)
    assert t2[16][ox + nx] == '.'
    t2[16][ox + nx] = 'g'

# ---------- firebox-3 MK V ----------
t5 = T.copy_grid(g3)
for f in range(NF):
    ox = f * FW
    cells = [(x, 15) for x in range(10, 15)] + [(12, 14), (12, 16)]
    n = 0
    for (x, y) in cells:
        if g3[y][ox + x] == 'C':
            t5[y][ox + x] = 'S'
            n += 1
    assert n >= 4, (f, n)


def main():
    out_root = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else T.TIERS
    for name, g in [('firebox-1-t2.png', t2), ('firebox-3-t5.png', t5)]:
        dst = os.path.join(out_root, name)
        print('wrote %s %d B' % (T.rel(dst), T.save_grid(g, dst)))


if __name__ == '__main__':
    main()
