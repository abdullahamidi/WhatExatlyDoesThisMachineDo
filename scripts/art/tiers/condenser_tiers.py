# Part evolution tiers, method A: condenser (machine.condenser, 80x24, bottom origin, static; 5 tiers).
# A horizontal shell (rows 7-18) with dished heads (x0-8 / x71-78), ring flanges at x8-9 / x70-71 (standing proud to
# row 20), 2 girth seams (x28-29, x52-53), a top header drum (rows 2-6), a top rail (rows 0-1) under the turbine, 3
# saddles (rows 19-23) and the hotwell nozzle on the right head (x77-79, rows 8-12; the condensate pipe leaves it at
# texture (80, 11) to the right).
#   MK II PATCHED: the 4 rust patches knocked off to the local shell iron; dim rivets bright (shadow-side row 8 and
#     row 1 marks, saddle bolts).
#   MK III REINFORCED: 2 extra support saddles under the heads (x2-8 and x71-77, rows 19-23: new silhouette at both
#     bottom corners) and the 2 girth seams rebuilt as raised tube-sheet bands (2 px one value step brighter, a shadow
#     groove each side, 2 bolts each).
#   MK IV TUNED: a level sight glass on the right shell section (x63-66, rows 8-16; cyan glass, water line), a brass
#     drain cock under the shell (x46-51, rows 20-22) and a safety-orange band on the header drum (x60-61, rows 3-5).
#   MK V AS BUILT: pilot lamp in the right head (core x73-75, rows 14-16, ink ring) and a warm seam along the shell's
#     longitudinal joint (row 14) between the tube-sheet bands; heartbeat low frame t5b = lamp and seam one step dimmer.
# Reserved: the nozzle x76-79 rows 7-13 and everything at x >= 80 (pipe W1). Alpha 0/255; every MK I opaque pixel
# stays opaque. Palette: Rust Wasteland + the Era II/III cyan ramp for the sight glass (spec; the Era III heater
# insulator already carries it).
#   python scripts/art/tiers/condenser_tiers.py [outRoot]
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import tierlib as T  # noqa: E402

put = T.put
base = T.load_grid(os.path.join(T.MACHINE, 'era3', 'condenser.png'))
H, W = len(base), len(base[0])
# rust patches (MK I) -> the local shell iron of the row
PATCHES = {(33, 3): '2', (34, 3): '2', (45, 11): '2', (46, 11): '2', (46, 12): '2', (18, 15): '1', (19, 15): '1',
           (19, 16): '1', (20, 16): '1', (62, 16): '1', (63, 16): '1', (63, 17): '0'}
UP = {'0': '1', '1': '2', '2': '3', '3': '4', '4': '5', '5': '5'}

# ---------- MK II PATCHED ----------
t2 = T.copy_grid(base)
for (x, y), c in PATCHES.items():
    assert base[y][x] in 'cde', (x, y, base[y][x])
    t2[y][x] = c
for x in range(42, 70, 4):                   # shadow-side rivets on the rivet row
    if t2[8][x] == '4':
        t2[8][x] = '5'
for x in range(44, 70, 6):                   # rail marks on the shadow side
    if t2[1][x] == '3':
        t2[1][x] = '5'
for y in (22,):
    for x in range(W):
        if t2[y][x] == '4':
            t2[y][x] = '5'                   # saddle bolts
for y in range(H):
    for x in range(W):
        assert t2[y][x] not in 'cde', (x, y)

# ---------- MK III REINFORCED ----------
t3 = T.copy_grid(t2)
# extra saddles under the heads (same build as the shipped saddles: lit band row 20, bolts row 22)
put(t3, 2, 19, 'K22222K')
put(t3, 2, 20, 'K33333K')
put(t3, 2, 21, 'K22222K')
put(t3, 2, 22, 'K52225K')
put(t3, 2, 23, 'KKKKKKK')
put(t3, 71, 19, 'K11111K')
put(t3, 71, 20, 'K33333K')
put(t3, 71, 21, 'K11111K')
put(t3, 71, 22, 'K51115K')
put(t3, 71, 23, 'KKKKKKK')
# tube-sheet bands at the girth seams: groove, 2 px band one value step brighter than the shell row, groove
SHELL = {7: '4', 8: '3', 9: '3', 10: '2', 11: '2', 12: '2', 13: '2', 14: '1', 15: '1', 16: '1', 17: '0', 18: '0'}
for x0 in (27, 51):
    for y in range(7, 19):
        sh = SHELL[y]
        t3[y][x0] = '1' if sh != '0' else '0'
        t3[y][x0 + 1] = UP[sh]
        t3[y][x0 + 2] = UP[sh]
        t3[y][x0 + 3] = '1' if sh != '0' else '0'
    for y in (10, 15):
        t3[y][x0 + 1] = '5'
        t3[y][x0 + 2] = '3'

# ---------- MK IV TUNED ----------
t4 = T.copy_grid(t3)
# level sight glass on the right shell section: bright fittings, ink frame, empty glass above the water line
put(t4, 64, 8, '55')
for y in range(9, 16):
    put(t4, 63, y, 'K' + ('on' if y <= 11 else 'nm') + 'K')
put(t4, 64, 16, '55')
# brass drain cock hung under the shell bottom line: lever arm (glint at the lit end), body, spout
put(t4, 46, 20, 'KCffdK')
put(t4, 46, 21, 'KfdK')
put(t4, 47, 22, 'KdK')
# safety-orange band on the header drum
for y in (3, 4):
    put(t4, 60, y, 'AA')
put(t4, 60, 5, 'Ad')

# ---------- MK V AS BUILT ----------
t5 = T.copy_grid(t4)
put(t5, 73, 13, 'KKK')
put(t5, 72, 14, 'KABAK')
put(t5, 72, 15, 'KBCBK')
put(t5, 72, 16, 'KABAK')
put(t5, 73, 17, 'KKK')
for x in range(31, 51):
    t5[14][x] = 'A'
for x in range(37, 45):
    t5[14][x] = 'B'

# heartbeat low frame: lamp and seam one ramp step dimmer
t5b = T.copy_grid(t5)
for y in range(H):
    for x in range(W):
        if (73 <= x <= 75 and 14 <= y <= 16) or (y == 14 and 31 <= x <= 50):
            t5b[y][x] = {'C': 'B', 'B': 'A', 'A': 'd'}[t5b[y][x]]


def main():
    out_root = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else T.TIERS
    for name, g in [('condenser-t2.png', t2), ('condenser-t3.png', t3), ('condenser-t4.png', t4),
                    ('condenser-t5.png', t5), ('condenser-t5b.png', t5b)]:
        dst = os.path.join(out_root, name)
        print('wrote %s %d B' % (T.rel(dst), T.save_grid(g, dst)))


if __name__ == '__main__':
    main()
