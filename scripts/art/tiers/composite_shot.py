# Part evolution tiers: put tier variants into a REAL in-game screenshot (Art Director G5 / brass-read check).
# The screenshot must be a 1280x720 shot of the shipped build (MK I art everywhere) at an integer art scale:
# zoom 1 = 2 screen px per art px (Era I framing), zoom 0.5 = 1 px (Era III-V framing).
# Each host is located by exact pixel matching (the motor globally, the others near their machine-local offsets; rot hosts
# also search all rot frames for the one on screen). A variant pixel is painted only where the MK I pixel is visible on
# screen, so belts, pulleys and other parts in front keep covering it (depth-correct for decals at host + 0.5).
#   python scripts/art/tiers/composite_shot.py <shot.png> <scale> <outPrefix> [tiersDir] [--era2]
# Writes <outPrefix>-rows.png (MK I..V rows of the machine crop at 1:1) and <outPrefix>-zoom.png (2x of the Era I-II
# hosts per row), and prints the located positions.
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import tierlib as T  # noqa: E402

M = T.MACHINE

# host: (local origin x, y of the sprite's TOP-LEFT in machine-local art px, base static, rot (sheet, frames) or None)
HOSTS = {
    'wornMotor': ((-172, -51), 'worn-motor.png', None),
    'motorPlinth': ((-164, -10), 'motor-plinth.png', None),
    'gearLarge': ((-76, -88), 'gear-large.png', ('rot/gear-large-rot.png', 140)),
    'mainShaft': ((-56, -68), 'pulley-main.png', ('rot/pulley-main-rot.png', 140)),
    'gearSmall': ((-20, -76), 'gear-small.png', ('rot/gear-small-rot.png', 80)),
    'crankPulley': ((-16, -72), 'pulley-crank.png', ('rot/pulley-crank-rot.png', 80)),
    'flywheel': ((102, -104), 'flywheel.png', ('rot/flywheel-rot.png', 180)),
    'flywheelPulley': ((136, -70), 'pulley-flywheel.png', ('rot/pulley-flywheel-rot.png', 180)),
    'flywheelPedestal': ((126, -64), 'flywheel-pedestal.png', None),
    'motorRetrofitKit': ((-156, -59), 'era2/motor-retrofit.png', None),
    'coilStage3': ((232, -62), 'era2/coils-3.png', None),
}
STEM = {'wornMotor': 'worn-motor', 'motorPlinth': 'motor-plinth', 'gearLarge': 'gear-large', 'mainShaft': 'pulley-main',
        'gearSmall': 'gear-small', 'crankPulley': 'pulley-crank', 'flywheel': 'flywheel',
        'flywheelPulley': 'pulley-flywheel', 'flywheelPedestal': 'flywheel-pedestal',
        'motorRetrofitKit': 'motor-retrofit', 'coilStage3': 'coils-3'}
DECAL_HOST = {'gear-rim.png': 'gearLarge', 'flywheel-rim-2.png': 'flywheel', 'flywheel-rim-3.png': 'flywheel'}


def frames(name):
    _o, static, rot = HOSTS[name]
    st = T.load_rgba(os.path.join(M, static))
    if not rot:
        return [st]
    sheet = T.load_rgba(os.path.join(M, rot[0]))
    return T.frames_of(sheet, st.shape[1], st.shape[0], rot[1])


def up(a, s):
    return a.repeat(s, axis=0).repeat(s, axis=1)


def score(screen, fr, s, ox, oy):
    big = up(fr, s)
    h, w = big.shape[:2]
    if ox < 0 or oy < 0 or oy + h > screen.shape[0] or ox + w > screen.shape[1]:
        return -1
    op = big[:, :, 3] == 255
    return int(((screen[oy:oy + h, ox:ox + w, :3] == big[:, :, :3]).all(axis=2) & op).sum())


def locate_global(screen, fr, s, n_anchor=90):
    op = np.argwhere(fr[:, :, 3] == 255)
    rng = np.random.default_rng(3)
    pick = op[rng.choice(len(op), min(n_anchor, len(op)), replace=False)]
    H, W = screen.shape[:2]
    V = np.zeros((H, W), np.int32)
    for y, x in pick:
        c = fr[y, x, :3]
        eq = (screen[:, :, :3] == c).all(axis=2)
        dy, dx = y * s, x * s
        V[:H - dy, :W - dx] += eq[dy:, dx:]
    oy, ox = np.unravel_index(V.argmax(), V.shape)
    return int(ox), int(oy)


def locate_near(screen, frs, s, px, py, r):
    best = (-1, 0, px, py)
    for fi, fr in enumerate(frs):
        for oy in range(py - r, py + r + 1):
            for ox in range(px - r, px + r + 1):
                sc = score(screen, fr, s, ox, oy)
                if sc > best[0]:
                    best = (sc, fi, ox, oy)
    return best


def paint(out, screen, base_fr, var_fr, s, ox, oy, new_too=True):
    """Paint var_fr where base_fr is visible on the screen (and, optionally, var's new opaque px)."""
    bb, vb = up(base_fr, s), up(var_fr, s)
    h, w = bb.shape[:2]
    win = screen[oy:oy + h, ox:ox + w, :3]
    vis = (bb[:, :, 3] == 255) & (win == bb[:, :, :3]).all(axis=2)
    m = vis & (vb[:, :, 3] == 255)
    if new_too:
        m |= (bb[:, :, 3] == 0) & (vb[:, :, 3] == 255)
    o = out[oy:oy + h, ox:ox + w]
    o[m, :3] = vb[m, :3]


def main():
    shot, s, prefix = sys.argv[1], int(sys.argv[2]), sys.argv[3]
    tdir = os.path.abspath(sys.argv[4]) if len(sys.argv) > 4 and not sys.argv[4].startswith('--') else T.TIERS
    era2 = '--era2' in sys.argv
    screen = np.array(Image.open(shot).convert('RGBA'))
    names = [n for n in HOSTS if era2 or n not in ('motorRetrofitKit', 'coilStage3')]
    found = {}
    mfr = frames('wornMotor')[0]
    mx, my = locate_global(screen, mfr, s)
    found['wornMotor'] = (score(screen, mfr, s, mx, my), 0, mx, my)
    (lx, ly), _st, _r = HOSTS['wornMotor']
    for n in names:
        if n == 'wornMotor':
            continue
        (hx, hy), _st, _r = HOSTS[n]
        px, py = mx + (hx - lx) * s, my + (hy - ly) * s
        found[n] = locate_near(screen, frames(n), s, px, py, 2 * s + 1)
    for n in names:
        sc, fi, ox, oy = found[n]
        tot = int((frames(n)[fi][:, :, 3] == 255).sum()) * s * s
        print('%-17s frame %3d at (%4d,%4d) visible match %5.1f %%' % (n, fi, ox, oy, 100.0 * sc / max(tot, 1)))

    def var_frame(n, tier):
        """The host's frame at a tier (MK I = shipped). Rot hosts use their tier rot sheet, same frame index."""
        sc, fi, ox, oy = found[n]
        stem = STEM[n]
        _o, static, rot = HOSTS[n]
        if tier == 1:
            return frames(n)[fi]
        if rot:
            sheet = T.load_rgba(os.path.join(tdir, 'rot', '%s-t%s-rot.png' % (stem, tier)))
            st = T.load_rgba(os.path.join(M, static))
            return T.frames_of(sheet, st.shape[1], st.shape[0], rot[1])[fi]
        return T.load_rgba(os.path.join(tdir, '%s-t%s.png' % (stem, tier)))

    # rows: label, {host: tier}, decals
    rows = [('MK I shipped', {}, []),
            ('MK II (motor, gears, pedestal, kit) + flywheel rim 2',
             {'wornMotor': 2, 'motorPlinth': 2, 'gearLarge': 2, 'mainShaft': 2, 'gearSmall': 2, 'flywheelPedestal': 2,
              'motorRetrofitKit': 2}, ['flywheel-rim-2.png']),
            ('MK III (gear + flywheel sets AS BUILT, motor REINFORCED, kit)',
             {'wornMotor': 3, 'motorPlinth': 3, 'gearLarge': 3, 'mainShaft': 3, 'gearSmall': 3, 'crankPulley': 3,
              'flywheel': 3, 'flywheelPulley': 3, 'flywheelPedestal': 3, 'motorRetrofitKit': 3},
             ['gear-rim.png', 'flywheel-rim-3.png']),
            ('MK IV motor + kit (brass hoops / studs), MK III gear + flywheel',
             {'wornMotor': 4, 'motorPlinth': 4, 'gearLarge': 3, 'mainShaft': 3, 'gearSmall': 3, 'crankPulley': 3,
              'flywheel': 3, 'flywheelPulley': 3, 'flywheelPedestal': 3, 'motorRetrofitKit': 4},
             ['gear-rim.png', 'flywheel-rim-3.png']),
            ('MK V motor + kit + coils, MK III gear + flywheel',
             {'wornMotor': 5, 'motorPlinth': 5, 'gearLarge': 3, 'mainShaft': 3, 'gearSmall': 3, 'crankPulley': 3,
              'flywheel': 3, 'flywheelPulley': 3, 'flywheelPedestal': 3, 'motorRetrofitKit': 5, 'coilStage3': 5},
             ['gear-rim.png', 'flywheel-rim-3.png']),
            ('MK V heartbeat low frames (motor t5b, pedestal t3b, kit t5b)',
             {'wornMotor': '5b', 'motorPlinth': 5, 'gearLarge': 3, 'mainShaft': 3, 'gearSmall': 3, 'crankPulley': 3,
              'flywheel': 3, 'flywheelPulley': 3, 'flywheelPedestal': '3b', 'motorRetrofitKit': '5b', 'coilStage3': 5},
             ['gear-rim.png', 'flywheel-rim-3.png'])]
    # crop: from the motor to the flywheel (+ generator in Era II+ shots)
    x0 = found['wornMotor'][2] - 6 * s
    x1 = (found['coilStage3'][2] + 70 * s) if era2 else (found['flywheel'][2] + 100 * s)
    y0 = found['flywheel'][3] - 12 * s
    y1 = found['motorPlinth'][3] + 14 * s
    crops, zooms = [], []
    for label, tiers, decals in rows:
        out = screen.copy()
        for n, t in tiers.items():
            if n not in found:
                continue
            sc, fi, ox, oy = found[n]
            base_fr = frames(n)[fi]
            paint(out, screen, base_fr, var_frame(n, t), s, ox, oy, new_too=not HOSTS[n][2])
        for d in decals:
            n = DECAL_HOST[d]
            sc, fi, ox, oy = found[n]
            base_fr = frames(n)[fi]
            dec = T.load_rgba(os.path.join(tdir, 'decals', d))
            paint(out, screen, base_fr, dec, s, ox, oy, new_too=False)
        crops.append((label, Image.fromarray(out[y0:y1, x0:x1])))
        zx1 = found['gearSmall'][2] + 44 * s
        zooms.append((label, Image.fromarray(out[y0:y1, x0:zx1])))
    try:
        f = ImageFont.load_default(size=13)
    except Exception:
        f = ImageFont.load_default()
    for suffix, items, k in (('rows', crops, 1), ('zoom', zooms, 2)):
        w, h = items[0][1].size
        sheet = Image.new('RGBA', (w * k + 16, len(items) * (h * k + 22) + 8), (40, 36, 32, 255))
        d = ImageDraw.Draw(sheet)
        for i, (label, im) in enumerate(items):
            y = 8 + i * (h * k + 22)
            d.text((8, y), label, font=f, fill=(230, 220, 200, 255))
            sheet.alpha_composite(im.resize((w * k, h * k), Image.NEAREST), (8, y + 16))
        sheet.save('%s-%s.png' % (prefix, suffix))
        print('wrote %s-%s.png' % (prefix, suffix))


if __name__ == '__main__':
    main()
