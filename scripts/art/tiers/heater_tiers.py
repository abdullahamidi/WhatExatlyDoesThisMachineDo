# Part evolution tiers, method A: inductionHeater (machine.inductionHeater, 56x40, bottom origin, static; 5 tiers).
# The heater is 7 copper coil bars (x13+5i .. x15+5i, rows 1-36; lit column 'f' / 'e', mid 'd', shadow 'c') hung on the
# boiler's firebox housing, with a copper strap (rows 6-7) to a riveted insulator box (x50-55, rows 2-16).
#   MK II PATCHED: the bars cleaned: the scattered hot spots (#f0a848 dots) come off and every bar gets the same clean,
#     straight lit band (bars 5-7 'e' -> 'f'); the box's 2 bolt heads bright.
#   MK III REINFORCED: 2 horizontal iron clamp straps across the 7 bars (rows 10-12 and 25-27: lit top '4', face '2',
#     ink shadow line under), ink end caps at x12 / x46, bright bolts over the first and last bar. The straps bridge the
#     gaps between the bars (new px over the firebox housing behind).
#   MK IV TUNED: water-cooling header along the bar feet (rows 33-36, x12-46: real induction coils are water cooled)
#     with a brass valve (handle, stem, body) at its right end, and a brass bus bar along the bar tops (rows 0-1, #ffd27a
#     glint at the lit left end).
#   MK V AS BUILT: the bars' lit band warm (#f0a848, 'heated') between the straps, header and bus bar; a pilot lamp
#     in the insulator box face (3x3 core x52-54, rows 10-12, ink ring); heartbeat low frame t5b = the lamp one ramp
#     step dimmer.
# Reserved: the tie cable leaves the insulator top (texture (53, 2)) to the right: nothing new at x >= 50 rows 0-5.
# Alpha 0/255; every MK I opaque pixel stays opaque; palette = Rust Wasteland + the cyan the shipped heater uses.
#   python scripts/art/tiers/heater_tiers.py [outRoot]
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import tierlib as T  # noqa: E402

put = T.put
base = T.load_grid(os.path.join(T.MACHINE, 'era3', 'induction-heater.png'))
BARS = [13 + 5 * i for i in range(7)]       # lit column of each bar; mid = +1, shadow = +2
STRAPS = (10, 25)                           # top row of each clamp strap (3 rows: lit, face, ink)

# ---------- MK II PATCHED ----------
t2 = T.copy_grid(base)
for x in BARS:
    for y in range(1, 36):
        if t2[y][x] in 'Be':
            t2[y][x] = 'f'
        if t2[y][x + 1] == 'B':
            t2[y][x + 1] = 'd'
        if t2[y][x + 2] == 'B':
            t2[y][x + 2] = 'c'
for y in range(1, 36):
    for x in range(12, 47):
        assert t2[y][x] != 'B', (x, y)
for (x, y) in [(53, 9), (53, 13)]:
    t2[y][x] = '5'

# ---------- MK III REINFORCED ----------
t3 = T.copy_grid(t2)
for y0 in STRAPS:
    put(t3, 12, y0, 'K' + '4' * 33 + 'K')
    put(t3, 12, y0 + 1, 'K' + '2' * 33 + 'K')
    put(t3, 12, y0 + 2, 'K' * 35)
    for x in (14, 44):
        t3[y0][x] = '5'
        t3[y0 + 1][x] = '3'

# ---------- MK IV TUNED ----------
t4 = T.copy_grid(t3)
# brass bus bar along the bar tops (replaces the ink caps; the bar tops sit under it)
# (x11-45: the firebox housing behind rounds off at heater x45 on row 0, so the bar ends flush with bar 7)
put(t4, 11, 0, 'K' + 'CCCC' + 'f' * 29 + 'K')
put(t4, 11, 1, 'K' + 'd' * 33 + 'K')
# water-cooling header along the bar feet: lit top, body, shadow, ink; ink end cap on the left
put(t4, 11, 33, 'K' + '4' * 35)
put(t4, 11, 34, 'K' + '3' * 35)
put(t4, 11, 35, 'K' + '1' * 35)
put(t4, 11, 36, 'K' * 36)
# brass valve at the right end: T-handle, stem, body with a glint, outlet stub capped in ink
put(t4, 46, 30, 'KCfdK')
put(t4, 48, 31, 'K')
put(t4, 47, 32, 'KKK')
put(t4, 46, 33, 'KCfdK')
put(t4, 46, 34, 'KffdK')
put(t4, 46, 35, 'KdddK')
put(t4, 46, 36, 'KKKKK')

# ---------- MK V AS BUILT ----------
t5 = T.copy_grid(t4)
for x in BARS:
    for y in range(2, 33):
        if t5[y][x] == 'f':
            t5[y][x] = 'B'
# pilot lamp in the insulator box face (box interior x51-54, rows 7-15; the box's right outline x55 is the ring side)
put(t5, 52, 9, 'KKK')
put(t5, 51, 10, 'KABA')
put(t5, 51, 11, 'KBCB')
put(t5, 51, 12, 'KABA')
put(t5, 52, 13, 'KKK')

# heartbeat low frame: the lamp one ramp step dimmer
t5b = T.copy_grid(t5)
for y in (10, 11, 12):
    for x in (52, 53, 54):
        t5b[y][x] = {'C': 'B', 'B': 'A', 'A': 'd'}[t5b[y][x]]


def main():
    out_root = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else T.TIERS
    for name, g in [('induction-heater-t2.png', t2), ('induction-heater-t3.png', t3), ('induction-heater-t4.png', t4),
                    ('induction-heater-t5.png', t5), ('induction-heater-t5b.png', t5b)]:
        dst = os.path.join(out_root, name)
        print('wrote %s %d B' % (T.rel(dst), T.save_grid(g, dst)))


if __name__ == '__main__':
    main()
