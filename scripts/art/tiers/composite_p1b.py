# Part evolution tiers: G5 check for the P1 batch B hosts (calliope, servo base + arm, spire wave) in a REAL in-game
# screenshot at 1 screen px per art px (zoom 0.5 framing; Era IV shot). The boiler is located globally by exact pixel
# matching (composite_p1.py); every other host is searched near its machine-local offset over all frames of its sheet.
#   calliope   : static; the variant is painted where the MK I px is visible, plus its new px
#   servo      : base first (new px too), then the arm's located rot frame from the tier rot sheet on top (front layer)
#   spire wave : the located frame of the shipped sheet is lifted off (tower px under it, else the sky beside the
#                tower on that row), then the tier frame is drawn (the on-screen frame and the full-swing frame two
#                steps later); px covered by parts in front (coil rings) are kept
# Writes <outDir>/<host>-g5.png: tier crops at zoom 0.5 (left) and zoom 1 (right), both 3x nearest for review.
#   python scripts/art/tiers/composite_p1b.py <shot.png> <outDir> [tiersDir]
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import composite_p1 as CP  # noqa: E402
import composite_shot as CS  # noqa: E402
import tierlib as T  # noqa: E402

M = T.MACHINE
CALLIOPE_TL = (-80, -218)
SERVO_BASE_TL = (-14, -34)
SERVO_ARM_TL = (-24, -48)
WAVE_TL = (56, -412)
TOWER_TL = (24, -430)


def tier_img(tdir, stem, base_path, key):
    if key == 1:
        return T.load_rgba(base_path)
    return T.load_rgba(os.path.join(tdir, '%s-t%s.png' % (stem, key)))


def crop(a, x0, y0, x1, y1):
    return a[y0:y1, x0:x1].copy()


def main():
    shot, out_dir = sys.argv[1], os.path.abspath(sys.argv[2])
    tdir = os.path.abspath(sys.argv[3]) if len(sys.argv) > 3 else T.TIERS
    os.makedirs(out_dir, exist_ok=True)
    screen = np.array(Image.open(shot).convert('RGBA'))
    boiler = T.load_rgba(os.path.join(M, 'era3', 'boiler.png'))
    bx, by = CS.locate_global(screen, boiler, 1)
    ox0, oy0 = bx - CP.BOILER_TL[0], by - CP.BOILER_TL[1]
    print('boiler at (%d,%d): machine origin on screen (%d,%d)' % (bx, by, ox0, oy0))

    # ---- calliope ----
    cal_p = os.path.join(M, 'era4', 'calliope.png')
    cal = T.load_rgba(cal_p)
    sc, _fi, cx, cy = CS.locate_near(screen, [cal], 1, ox0 + CALLIOPE_TL[0], oy0 + CALLIOPE_TL[1], 3)
    print('calliope at (%d,%d) visible match %.1f %%' % (cx, cy, 100.0 * sc / int((cal[:, :, 3] == 255).sum())))
    crops = []
    for lab, key in CP.L5:
        out = screen.copy()
        if key != 1:
            CS.paint(out, screen, cal, tier_img(tdir, 'calliope', cal_p, key), 1, cx, cy, new_too=True)
        crops.append((lab, crop(out, cx - 16, cy - 10, cx + 72 + 16, cy + 40 + 12)))
    CP.sheet_out(os.path.join(out_dir, 'calliope-g5.png'), 'calliope', crops)

    # ---- servo base + arm ----
    sb_p = os.path.join(M, 'era4', 'servo-base.png')
    sb = T.load_rgba(sb_p)
    sc, _fi, sx, sy = CS.locate_near(screen, [sb], 1, ox0 + SERVO_BASE_TL[0], oy0 + SERVO_BASE_TL[1], 3)
    print('servo base at (%d,%d) visible match %.1f %%' % (sx, sy, 100.0 * sc / int((sb[:, :, 3] == 255).sum())))
    arm_rot = T.frames_of(T.load_rgba(os.path.join(M, 'era4', 'rot', 'servo-arm-rot.png')), 48, 48, 80)
    sc, afi, ax, ay = CS.locate_near(screen, arm_rot, 1, ox0 + SERVO_ARM_TL[0], oy0 + SERVO_ARM_TL[1], 2)
    print('servo arm frame %d at (%d,%d) visible match %.1f %%' % (
        afi, ax, ay, 100.0 * sc / int((arm_rot[afi][:, :, 3] == 255).sum())))
    crops = []
    for lab, key in CP.L3:
        out = screen.copy()
        if key != 1:
            CS.paint(out, screen, sb, tier_img(tdir, 'servo-base', sb_p, key), 1, sx, sy, new_too=True)
            n = str(key).rstrip('b')
            var_rot = T.frames_of(T.load_rgba(os.path.join(tdir, 'rot', 'servo-arm-t%s-rot.png' % n)), 48, 48, 80)
            CS.paint(out, screen, arm_rot[afi], var_rot[afi], 1, ax, ay, new_too=False)
        crops.append((lab, crop(out, sx - 16, sy - 30, sx + 28 + 16, sy + 20 + 8)))
    CP.sheet_out(os.path.join(out_dir, 'servo-g5.png'), 'servo base + arm (arm frame %d on screen)' % afi, crops)

    # ---- spire wave ----
    wv = T.load_rgba(os.path.join(M, 'era4', 'spire-wave.png'))
    wfr = [wv[:, i * 16:(i + 1) * 16] for i in range(8)]
    sc, wfi, wx, wy = CS.locate_near(screen, wfr, 1, ox0 + WAVE_TL[0], oy0 + WAVE_TL[1], 2)
    print('spire wave frame %d at (%d,%d) visible match %.1f %%' % (
        wfi, wx, wy, 100.0 * sc / int((wfr[wfi][:, :, 3] == 255).sum())))
    tower = T.load_rgba(os.path.join(M, 'era4', 'spire-tower.png'))
    tdx, tdy = WAVE_TL[0] - TOWER_TL[0], WAVE_TL[1] - TOWER_TL[1]
    win = screen[wy:wy + 270, wx:wx + 16]
    under = np.zeros_like(win)
    for y in range(270):
        sky = None
        for x in list(range(-1, -12, -1)) + list(range(16, 28)):      # nearest px beside the column off the tower
            tx, ty = x + tdx, y + tdy
            if 0 <= tx < tower.shape[1] and tower[ty, tx, 3] == 0:
                sky = screen[wy + y, wx + x]
                break
        for x in range(16):
            t = tower[y + tdy, x + tdx]
            under[y, x] = t if t[3] == 255 else (sky if sky is not None else win[y, x])
    base_f = wfr[wfi]
    free = ((base_f[:, :, 3] == 255) & (win[:, :, :3] == base_f[:, :, :3]).all(axis=2)) | \
           ((base_f[:, :, 3] == 0) & (win[:, :, :3] == under[:, :, :3]).all(axis=2))
    labels = [('MK I', 1), ('MK II', 2), ('MK III', 3), ('MK IV', 4), ('MK V', 5)]
    panels = []
    for show in (wfi, (wfi + 2) % 8):        # the frame on screen and the full-swing frame two steps later
        for lab, key in labels:
            out = screen.copy()
            var = (wv if key == 1 else tier_img(tdir, 'spire-wave', '', key))[:, show * 16:(show + 1) * 16]
            o = out[wy:wy + 270, wx:wx + 16]
            vm = var[:, :, 3] == 255
            o[free & vm, :3] = var[free & vm, :3]
            o[free & ~vm, :3] = under[free & ~vm, :3]
            panels.append(('%s f%d' % (lab, show), crop(out, wx - 24, wy - 24, wx + 16 + 24, wy + 270 + 16)))
    # one review image: tiers left to right (on-screen frame row, then full-swing row), zoom 0.5 shown 2x
    ph, pw = panels[0][1].shape[:2]
    k = 2
    sheet = Image.new('RGBA', (len(labels) * (pw * k + 8) + 8, 2 * (ph * k + 20) + 8), (40, 36, 32, 255))
    from PIL import ImageDraw
    d = ImageDraw.Draw(sheet)
    for i, (lab, a) in enumerate(panels):
        r, c = divmod(i, len(labels))
        x, y = 8 + c * (pw * k + 8), 8 + r * (ph * k + 20)
        d.text((x, y), lab, font=CP.font(), fill=(230, 220, 200, 255))
        sheet.alpha_composite(Image.fromarray(a).resize((pw * k, ph * k), Image.NEAREST), (x, y + 14))
    path = os.path.join(out_dir, 'spire-wave-g5.png')
    sheet.save(path)
    print('wrote', path)


if __name__ == '__main__':
    main()
