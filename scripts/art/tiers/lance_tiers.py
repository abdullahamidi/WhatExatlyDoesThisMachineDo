# Part evolution tiers, method A: steamLance (3 tiers), steamLance (machine.steamLance, 16x32, origin top-centre,
# static): a globe valve hung under the null gallery deck: mount plate (rows 0-2), upper neck (rows 3-5), the globe body
# (rows 6-18, lobes at x0-3 / x12-15) with a rust handwheel in front (rim x4-11 rows 8-15, 4 spokes, hub x7-8 rows
# 11-12), the lower stem (rows 19-23), the flange collar (rows 24-26) and the flanged inlet pipe down to the manifold
# link (rows 27-31, texture (8, 32)). The lance steam emitter (src/data/steamFx.ts, at (28, -385) = texture (16, 29))
# vents the puffs from the right end of the collar; frame 0 of fx.steamPuff covers texture x12-19, rows 25-32.
#   MK II REINFORCED: a new bright valve wheel (polished steel: rim lit upper-left in the steam-white highlight the
#     host already uses, spokes and hub bright iron, the spaces between the spokes dark so the wheel reads on the
#     dark body); an iron collar on the upper neck (x4-11, rows 4-5, 1 px proud each side, seated on the body; the
#     neck's shading columns run through it, so no 1 px colour islands).
#   MK III AS BUILT: brass vent collar (the flange band where the steam leaves, row 25, glint at the lit left end) and
#     a warm pilot lamp in the globe's left lobe (2x2 core x1-2, rows 11-12, lit top row), on the side the puffs
#     never cover;
#     heartbeat low frame t3b = the lamp one ramp step dimmer.
# Reserved: the inlet pipe (rows 27-31) never changes, and the puff start (x12-15, rows 24-31) gains no pixel; the
# wheel stays fully drawn (nothing over it). Alpha 0/255; every MK I opaque pixel stays opaque; palette = Rust
# Wasteland + the steam white the shipped lance uses.
#   python scripts/art/tiers/lance_tiers.py [outRoot]
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import tierlib as T  # noqa: E402

put = T.put
base = T.load_grid(os.path.join(T.MACHINE, 'legacy', 'steam-lance.png'))

# handwheel cells (texture px): rim ring, spokes, spaces between the spokes, hub
RIM = [(6, 8), (7, 8), (8, 8), (9, 8), (5, 9), (10, 9), (4, 10), (11, 10), (4, 11), (11, 11), (4, 12), (11, 12),
       (4, 13), (11, 13), (5, 14), (10, 14), (6, 15), (7, 15), (8, 15), (9, 15)]
SPOKE = [(7, 9), (8, 9), (7, 10), (8, 10), (7, 13), (8, 13), (7, 14), (8, 14), (5, 11), (6, 11), (5, 12), (6, 12),
         (9, 11), (10, 11), (9, 12), (10, 12)]
GAP = [(6, 9), (9, 9), (5, 10), (6, 10), (9, 10), (10, 10), (5, 13), (6, 13), (9, 13), (10, 13), (6, 14), (9, 14)]
HUB = {(7, 11): '5', (8, 11): '5', (7, 12): '5', (8, 12): '4'}


def lit(x, y):
    """Upper-left half of the wheel (centre 7.5, 11.5): the side the scene light comes from."""
    return x + y <= 18


# ---------- MK II REINFORCED ----------
t2 = T.copy_grid(base)
for (x, y) in RIM:
    assert base[y][x] in 'acdef', (x, y)
    t2[y][x] = 'S' if lit(x, y) else '5'
for (x, y) in SPOKE:
    t2[y][x] = '5' if lit(x, y) else '4'
for (x, y) in GAP:
    t2[y][x] = '0'
for (x, y), c in HUB.items():
    t2[y][x] = c
assert ''.join(base[4][5:11]) == 'K4320K' and ''.join(base[5][5:11]) == 'K4320K'
put(t2, 4, 4, 'K543200K')        # iron collar on the upper neck: the neck's shading columns run on through it,
put(t2, 4, 5, 'K543200K')        # 1 px proud each side, lit left edge; seated on the body's top edge (row 6)

# ---------- MK III AS BUILT ----------
t3 = T.copy_grid(t2)
assert ''.join(base[25][4:12]) == 'K543320K'
put(t3, 5, 25, 'ffeedd')         # brass vent collar, lit left: the steam leaves at its right end
put(t3, 1, 11, 'CC')             # pilot lamp in the left lobe (x0 / x3 are the lobe's ink), lit top row
put(t3, 1, 12, 'BB')

t3b = T.copy_grid(t3)
for y in (11, 12):
    for x in (1, 2):
        t3b[y][x] = {'C': 'B', 'B': 'A', 'A': 'd'}[t3b[y][x]]


def main():
    out_root = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else T.TIERS
    for name, g in [('steam-lance-t2.png', t2), ('steam-lance-t3.png', t3), ('steam-lance-t3b.png', t3b)]:
        dst = os.path.join(out_root, name)
        print('wrote %s %d B' % (T.rel(dst), T.save_grid(g, dst)))


if __name__ == '__main__':
    main()
