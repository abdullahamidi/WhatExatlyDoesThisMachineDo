# Part evolution tiers, method A: bellowsDrive (3 tiers), bellows (machine.bellows, 240x28 = 4 frames of 60x28 (open,
# half, closed, half), bottom origin, automation-driven frames). Per frame: a hinged top board (sand, 2 rows: lit 'v'
# over 't', ink outline above) that swings about the snout, the leather (rust-ramp hide) between the boards, a static
# bottom board (rows 19-20), 2 iron legs (x9-13, x33-37, rows 21-27), the static iron snout (x44-51, rows 13-21) and
# the nozzle (x51-59, rows 15-18).
#   MK II REINFORCED: iron cross straps on both boards (x12-13, x21-22, x30-31: 2 px bands across the board's 2 rows,
#     bright bolt head on the lit row; the shipped 1 px strap marks at x12 / x30 become full straps) and the leather
#     patched with sand-ramp hide patches (#a8957a lit corner, #8a7a64, #5f5244 stitched edge) at 2 fixed columns,
#     centred in the leather's height in each frame (the closed frame shows no leather, so no patch).
#   MK III AS BUILT: the hide is renewed (patches off), the straps stay; brass nozzle (x52-57; the iron hose clamp at
#     x58-59 and the reserved tip x59 rows 16-17 stay), brass hinge plates where the boards meet the snout (rows 16-17 and
#     19-20, x42-45); a pilot lamp on a bracket at the right leg's outer face (core x38-40,
#     rows 22-24, ink ring; same pixels in all 4 frames); heartbeat low frame t3b = the lamp one ramp step dimmer.
# Reserved: the nozzle tip (59, rows 16..17) of every frame (the hose to the boiler tuyere starts there). Alpha 0/255;
# every MK I opaque pixel stays opaque; palette = Rust Wasteland.
#   python scripts/art/tiers/bellows_tiers.py [outRoot]
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import tierlib as T  # noqa: E402

FW, NF = 60, 4
base = T.load_grid(os.path.join(T.MACHINE, 'legacy', 'bellows.png'))
H = len(base)
STRAPS = (12, 21, 30)          # left column of each 2 px cross strap
PATCH_COLS = (15, 24)          # left column of each 4 px hide patch
LEATHER = set('abc')
BOARD_LIT, BOARD_SH = set('v4'), set('t2')


def top_board(g, ox, x):
    """Rows of the top board's (lit, shadow) cells in frame column x: the first lit cell under the first ink cell."""
    for y in range(H - 1):
        if g[y][ox + x] == 'K':
            for yy in range(y + 1, H - 1):
                if g[yy][ox + x] in BOARD_LIT and g[yy + 1][ox + x] in BOARD_SH:
                    return yy, yy + 1
                if g[yy][ox + x] != 'K':
                    break
            return None
    return None


def leather_span(g, ox, x):
    ys = [y for y in range(H) if g[y][ox + x] in LEATHER and y < 18]
    return (min(ys), max(ys)) if ys else None


t2 = T.copy_grid(base)
for f in range(NF):
    ox = f * FW
    for x0 in STRAPS:
        for x, (lit, sh) in ((x0, ('5', '2')), (x0 + 1, ('3', '1'))):
            tb = top_board(base, ox, x)
            assert tb, (f, x)
            t2[tb[0]][ox + x] = lit
            t2[tb[1]][ox + x] = sh
            t2[19][ox + x] = lit                 # bottom board (static rows 19-20)
            t2[20][ox + x] = sh
    for x0 in PATCH_COLS:
        spans = [leather_span(base, ox, x) for x in range(x0, x0 + 4)]
        if any(s is None or s[1] - s[0] < 3 for s in spans):
            continue                             # leather too thin here (closed frame): no patch
        top = max(s[0] for s in spans)
        bot = min(s[1] for s in spans)
        y0 = (top + bot) // 2
        T.put(t2, ox + x0, y0, 'uutt')
        T.put(t2, ox + x0, y0 + 1, 'ttts')

t3 = T.copy_grid(t2)
for f in range(NF):
    ox = f * FW
    # hide renewed: patches off (back to the shipped leather)
    for y in range(H):
        for x in range(FW):
            if t2[y][ox + x] in 'uts' and base[y][ox + x] in LEATHER:
                t3[y][ox + x] = base[y][ox + x]
    # brass nozzle body (rows 16-17), glint at its root; the clamp x58-59 stays iron
    T.put(t3, ox + 52, 16, 'CCffff')
    T.put(t3, ox + 52, 17, 'dddddd')
    # brass hinge plates at the snout, top board and bottom board joints (2 px glints, no lone pixels)
    T.put(t3, ox + 42, 16, 'CCff')
    T.put(t3, ox + 42, 17, 'dddd')
    T.put(t3, ox + 42, 19, 'CCff')
    T.put(t3, ox + 42, 20, 'dddd')
    # pilot lamp on a bracket at the right leg's outer face (ink ring: the board's ink row 21 above, the leg outline x37).
    # On this small part the ladder lamp's #d9822b corners are 4 lone pixels per frame (workbench singletons); the
    # lamp is an #f0a848 ring around the #ffd27a core (the motor retrofit kit's lamp), which reads the same at zoom 0.5.
    T.put(t3, ox + 37, 22, 'KBBBK')
    T.put(t3, ox + 37, 23, 'KBCBK')
    T.put(t3, ox + 37, 24, 'KBBBK')
    T.put(t3, ox + 38, 25, 'KKK')

t3b = T.copy_grid(t3)
for f in range(NF):
    for y in (22, 23, 24):
        for x in (38, 39, 40):
            t3b[y][f * FW + x] = {'C': 'B', 'B': 'A', 'A': 'd'}[t3b[y][f * FW + x]]


def main():
    out_root = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else T.TIERS
    for name, g in [('bellows-t2.png', t2), ('bellows-t3.png', t3), ('bellows-t3b.png', t3b)]:
        dst = os.path.join(out_root, name)
        print('wrote %s %d B' % (T.rel(dst), T.save_grid(g, dst)))


if __name__ == '__main__':
    main()
