# Part evolution tiers, method A: mainsBackfeed (3 tiers), backfeedTerminal (machine.backfeedTerminal, 16x28, origin
# top-centre, static): a suspension string hung under the null gallery deck: hanger plate (rows 0-2) with the violet
# lead-in bushing (12, 1), a hanger rod (rows 3-5), four cyan glass cap-and-pin discs (rows 6-8 / 10-12 / 14-16 / 18-20,
# pins at rows 9 / 13 / 17 / 21), the conductor clamp (rows 22-24) and the cable lug cap (rows 25-27); the copper jumper
# leaves the bushing (row 3) and runs down x14 into the clamp (row 23).
#   MK II REINFORCED: an extra insulator skirt: a 5th disc on the hanger rod (rows 3-5, same profile as the others, so
#     the string reads as a longer, higher-rated stack, as real strings gain discs with voltage); a bolted cable clamp
#     on the jumper at mid-span (x13-15, rows 12-13, beside a narrow disc row so the jumper keeps its 1 px air gap to
#     the disc rims); 2 new bright bolt heads at the ends of the hanger plate.
#   MK III AS BUILT: brass cap on the top disc (row 3), brass conductor clamp flanks, and a warm live-line indicator lamp
#     in the clamp face (2x2 core x7-8, rows 22-23, ink sides); heartbeat low frame t3b = the lamp one ramp step dimmer.
# Reserved: the cable lug (bottom cap, texture (8, 26)) and the cable that leaves it down-right: rows 24-27 gain no
# new pixel and the lug never changes; the bushing pixel stays. Alpha 0/255; every MK I opaque pixel stays opaque;
# palette = Rust Wasteland + the cyan and violet the shipped terminal uses.
#   python scripts/art/tiers/backfeed_tiers.py [outRoot]
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import tierlib as T  # noqa: E402

put = T.put
base = T.load_grid(os.path.join(T.MACHINE, 'legacy', 'backfeed-terminal.png'))

# ---------- MK II REINFORCED ----------
t2 = T.copy_grid(base)
assert ''.join(base[3][6:10]) == 'K43K' and ''.join(base[5][6:10]) == 'K54K'
put(t2, 4, 3, 'KKoonmKK')        # 5th disc: cap row (x4-11), same profile as the shipped discs
put(t2, 3, 4, 'KoonnnnmmK')      # skirt rim (x3-12), the jumper at x14 keeps its gap
put(t2, 4, 5, 'Kmm00mmK')        # dark underside
assert base[12][14] == 'f' and base[13][14] == 'e'
put(t2, 13, 12, 'K5K')           # bolted cable clamp around the jumper (bright bolt face)
put(t2, 13, 13, 'K5K')
for x in (3, 11):
    assert base[1][x] == '3'
    t2[1][x] = '5'               # new bright bolt heads at both ends of the hanger plate

# ---------- MK III AS BUILT ----------
t3 = T.copy_grid(t2)
put(t3, 6, 3, 'ffee')            # brass cap on the top disc, lit left
put(t3, 5, 22, 'f')              # brass conductor clamp flanks (the right one runs into the copper jumper)
put(t3, 10, 22, 'e')
put(t3, 5, 23, 'f')
put(t3, 10, 23, 'e')
put(t3, 6, 22, 'KCCK')           # live-line indicator lamp, ink sides (row 24 below is the clamp's ink edge),
put(t3, 6, 23, 'KBBK')           # lit top row

t3b = T.copy_grid(t3)
for y in (22, 23):
    for x in (7, 8):
        t3b[y][x] = {'C': 'B', 'B': 'A', 'A': 'd'}[t3b[y][x]]


def main():
    out_root = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else T.TIERS
    for name, g in [('backfeed-terminal-t2.png', t2), ('backfeed-terminal-t3.png', t3),
                    ('backfeed-terminal-t3b.png', t3b)]:
        dst = os.path.join(out_root, name)
        print('wrote %s %d B' % (T.rel(dst), T.save_grid(g, dst)))


if __name__ == '__main__':
    main()
