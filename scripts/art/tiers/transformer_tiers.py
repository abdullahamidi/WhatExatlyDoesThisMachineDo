# Part evolution tiers, method A block-in (+ method B refinement, see pixellab_merge.py): transformer
# (machine.transformer, 64x64, origin bottom-centre, vibrates with EE flow, era II). 5 tiers (PART_TIERS 2.3):
#   MK II  rust cleaned off the tank base rows, sight glass cleared (#bff0ec), new bright lid bolts
#   MK III radiator panel bank on the right flank (real ONAN stage): vertical fins 5 px proud of the tank wall, rows
#          25-50 (under the lid flange down to the drain box), top and bottom headers; rust 0 outside the bushing
#          terminals, sand grime off, machined lid edge
#   MK IV  cooling fan face-on on the radiator (real ONAF stage), brass bushing terminal caps, orange danger plate
#   MK V   warm lamp on the lid (right end), warm seam at the lid joint
#   t5b    heartbeat low frame: lamp and seam one ramp step dimmer
# Reserved: the primary cable leaves the left bushing tip (20,4) down-left to the rack (x <= 15, rows <= 20); the
# bushing cable leaves the right tip (48,4) up-right to the mast (rows <= 4, x >= 49); the cable mast stands at x >= 64.
# Palette: Rust Wasteland + the cyan ramp the shipped sight glass already uses.
#   python scripts/art/tiers/transformer_tiers.py [outRoot]
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import pixellab_merge as PM  # noqa: E402
import tierlib as T  # noqa: E402

copy, put, remap = T.copy_grid, T.put, T.remap

base = T.load_grid(os.path.join(T.MACHINE, 'era2', 'transformer.png'))
H, W = len(base), len(base[0])
BUSHINGS = (0, 14, 28)     # x offset of the 3 bushings (bushing 1: tip x19-20, cap rows 3-8, sheds x16-23)


def terminal(x, y):
    """Bushing terminal caps (copper / bronze identity marks, brass from MK IV)."""
    return 3 <= y <= 8 and any(17 + o <= x <= 22 + o for o in BUSHINGS)


# ---------- MK II PATCHED ----------
t2 = copy(base)
remap(t2, {'c': '1', 'b': '0', 'd': '2', 'e': '3'}, lambda x, y: y >= 51 and not terminal(x, y))
for y in range(62, 63):                          # dark stains stay, low down (the bottom row)
    for x in range(W):
        if base[y][x] == 'b':
            t2[y][x] = 'b'
# sight glass cleared: clear cyan above the oil line, mid cyan below
for y, ch in zip(range(30, 35), 'ooonn'):
    t2[y][10] = ch
# new lid bolts on the lid flange front (2 px heads, bright left)
for x in (13, 26, 40, 53):
    put(t2, x, 23, '53')

# ---------- MK III REINFORCED ----------
t3 = copy(t2)
remap(t3, {'a': '0', 'b': '0', 'c': '1', 'd': '2', 'e': '3', 'f': '4', 's': '2', 't': '3'},
      lambda x, y: not terminal(x, y) and y >= 19)
# machined lid edge: the lit top row of the lid flange polished on its left two thirds
for x in range(11, 40):
    if t3[22][x] == '3':
        t3[22][x] = '4'
# radiator panel bank on the right flank: outer ink x60, fins x57 / x59 (lit edges) over dark gaps, headers top and bottom
RAD_TOP, RAD_BOT = 25, 50
for y in range(RAD_TOP, RAD_BOT + 1):
    if y in (RAD_TOP, RAD_BOT):
        put(t3, 56, y, 'KKKKK')
    elif y in (RAD_TOP + 1, RAD_BOT - 2):
        put(t3, 56, y, '3444K')                  # header pipe, lit top
    elif y in (RAD_TOP + 2, RAD_BOT - 1):
        put(t3, 56, y, '1222K')                  # header pipe, shadow side
    else:
        put(t3, 56, y, '0414K')                  # gap, fin, gap, fin, outer ink
# fin tips catch the light under the top header, shade toward the bottom
for y in range(RAD_TOP + 3, RAD_BOT - 2):
    if y > 40:
        t3[y][57] = '3'
        t3[y][59] = '3'
# the headers pierce the tank wall (oil flows tank -> top header -> fins -> bottom header -> tank)
for y, ch in ((RAD_TOP + 1, '3'), (RAD_TOP + 2, '1'), (RAD_BOT - 2, '3'), (RAD_BOT - 1, '1')):
    t3[y][55] = ch

# method B: PixelLab edit_image (job a598ca12, seed 2210, 10 gens; the 4 hand-blocked tiers as frames) drew crisper
# fin edges; its MK III frame, snapped to the iron ramp + ink (pixellab/transformer-t3-gen-iron.png), is merged ONLY on
# the radiator fins and headers, silhouette and ink locked. Its fan and tank shading were rejected (smudged blades,
# sand-coloured snap on the tubes); a targeted retry (job 665b2439, seed 2212, 10 gens) dropped the fan and was rejected.
GEN = T.load_rgba(os.path.join(HERE, 'pixellab', 'transformer-t3-gen-iron.png'))
t3 = T.to_grid(PM.merge(T.from_grid(t3), GEN, [(56, RAD_TOP + 1, 59, RAD_BOT - 1)]))

# ---------- MK IV TUNED ----------
t4 = copy(t3)
# cooling fan, face-on on the lower radiator (9x9: guard ring, 4 twisted blades over the dark duct, bright hub)
FAN_C, FAN_R = (58, 42), 4
for dy in range(-FAN_R, FAN_R + 1):
    for dx in range(-FAN_R, FAN_R + 1):
        r = math.hypot(dx, dy)
        if r > FAN_R + 0.5:
            continue
        x, y = FAN_C[0] + dx, FAN_C[1] + dy
        if r >= FAN_R - 0.5:
            t4[y][x] = 'K'
        elif r < 0.75:
            t4[y][x] = '5'
        else:
            a = (math.degrees(math.atan2(dy, dx)) + 360 - 28 * r) % 90
            t4[y][x] = '4' if a < 28 else ('3' if a < 46 else '1')
for o in BUSHINGS:
    # brass terminal caps: stud with a glint, brass nut
    t4[4][19 + o] = 'C'
    t4[5][19 + o] = 'e'
    t4[7][19 + o] = 'f'
    t4[7][20 + o] = 'd'
# orange danger plate on the left tank face (energised part, ANSI orange)
put(t4, 13, 40, 'KKKKKK')
put(t4, 13, 41, 'KAAAAK')
put(t4, 13, 42, 'KAKKAK')
put(t4, 13, 43, 'KAAAAK')
put(t4, 13, 44, 'KKKKKK')

# ---------- MK V AS BUILT ----------
t5 = copy(t4)
LAMP = (53, 16)            # 5x5 pilot lamp standing on the lid's right end
put(t5, LAMP[0], LAMP[1] + 0, ' KKK ')
put(t5, LAMP[0], LAMP[1] + 1, 'KABAK')
put(t5, LAMP[0], LAMP[1] + 2, 'KBCBK')
put(t5, LAMP[0], LAMP[1] + 3, 'KABAK')
put(t5, LAMP[0], LAMP[1] + 4, 'KKKK ')       # lamp foot meets the bushing flange (no pinhole)
SEAM = (13, 54)            # warm seam in the lid-to-tank joint, #f0a848 core in the middle
for x in range(SEAM[0], SEAM[1] + 1):
    t5[24][x] = 'B' if 27 <= x <= 40 else 'A'

t5b = copy(t5)
for y in range(H):
    for x in range(W):
        lamp = LAMP[0] <= x <= LAMP[0] + 4 and LAMP[1] <= y <= LAMP[1] + 4
        seam = y == 24 and SEAM[0] <= x <= SEAM[1]
        if lamp or seam:
            t5b[y][x] = {'C': 'B', 'B': 'A', 'A': 'd'}.get(t5b[y][x], t5b[y][x])

TIERS = [('transformer-t2.png', t2), ('transformer-t3.png', t3), ('transformer-t4.png', t4),
         ('transformer-t5.png', t5), ('transformer-t5b.png', t5b)]


def main():
    out_root = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else T.TIERS
    for name, g in TIERS:
        dst = os.path.join(out_root, name)
        print('wrote %s %d B' % (T.rel(dst), T.save_grid(g, dst)))


if __name__ == '__main__':
    main()
