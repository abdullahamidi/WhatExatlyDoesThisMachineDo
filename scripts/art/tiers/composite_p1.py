# Part evolution tiers: G5 check for the P1 batch A hosts in a REAL in-game screenshot (Art Director).
# The shot must be a shipped-build frame at 1 screen px per art px (zoom 0.5 framing; a 3840x2160 store shot reduced by
# exactly 3 qualifies when its 3x3 blocks are uniform). The boiler is located globally by exact pixel matching; every
# other host is searched near its machine-local offset (src/data/machineComponents.ts), over all frames of its sheet.
# A tier variant pixel is painted where the MK I pixel is visible on screen, plus the variant's new opaque px; sheet
# hosts use the frame found on screen. Fire glows are re-rendered over the boiler door (glow 1 is hidden under the
# open-door glows 2 / 3 once those stages are built). Writes per host <outDir>/<host>-g5.png: the tier crops at
# zoom 0.5 (1 px / art px, left) and zoom 1 (2 px / art px, right), each shown 3x nearest for review.
#   python scripts/art/tiers/composite_p1.py <shot.png> <outDir> [tiersDir]
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import composite_shot as CS  # noqa: E402
import tierlib as T  # noqa: E402

M = T.MACHINE
# host: (machine-local top-left, base file, frame width, frames, tiers [(label, tier key)], crop pad (l, t, r, b))
L5 = [('MK I', 1), ('MK II', 2), ('MK III', 3), ('MK IV', 4), ('MK V', 5), ('MK V low', '5b')]
L3 = [('MK I', 1), ('MK II', 2), ('MK III', 3), ('MK III low', '3b')]
HOSTS = {
    'induction-heater': ((-228, -76), 'era3/induction-heater.png', 56, 1, L5, (14, 10, 14, 14)),
    'condenser': ((-442, -24), 'era3/condenser.png', 80, 1, L5, (8, 20, 8, 6)),
    'bellows': ((-272, -28), 'legacy/bellows.png', 60, 4, L3, (8, 18, 16, 4)),
    'exciter-feed': ((72, -138), 'legacy/exciter-feed.png', 16, 1, L3, (24, 14, 24, 6)),
    'coil-ring-1': ((33, -161), 'era4/coil-ring-1.png', 62, 4, [('MK I', 1), ('MK II', 2)], (8, 16, 8, 16)),
}
BOILER_TL = (-304, -96)
GLOW_TL = (-208, -44)


def sheet_frames(path, fw, n):
    a = T.load_rgba(path)
    return [a[:, i * fw:(i + 1) * fw] for i in range(n)]


def tier_sheet(tdir, stem, base_path, key):
    if key == 1:
        return T.load_rgba(base_path)
    return T.load_rgba(os.path.join(tdir, '%s-t%s.png' % (stem, key)))


def font():
    try:
        return ImageFont.load_default(size=13)
    except Exception:
        return ImageFont.load_default()


def sheet_out(path, title, crops):
    """crops: [(label, HxWx4 array)] -> one review image: zoom 0.5 crop (1x) and zoom 1 crop (2x), both shown 3x."""
    f = font()
    ch, cw = crops[0][1].shape[:2]
    k = 3
    rowh = ch * 2 * k + 22
    W = 8 + cw * k + 12 + cw * 2 * k + 8
    im = Image.new('RGBA', (W, 28 + len(crops) * rowh), (40, 36, 32, 255))
    d = ImageDraw.Draw(im)
    d.text((8, 6), title + ' | left: zoom 0.5 (1 px / art px), right: zoom 1 (2 px / art px); both 3x nearest', font=f,
           fill=(230, 220, 200, 255))
    for i, (lab, a) in enumerate(crops):
        y = 28 + i * rowh
        d.text((8, y), lab, font=f, fill=(230, 220, 200, 255))
        p = Image.fromarray(a)
        im.alpha_composite(p.resize((cw * k, ch * k), Image.NEAREST), (8, y + 16))
        im.alpha_composite(p.resize((cw * 2 * k, ch * 2 * k), Image.NEAREST), (8 + cw * k + 12, y + 16))
    im.save(path)
    print('wrote', path)


def main():
    shot, out_dir = sys.argv[1], os.path.abspath(sys.argv[2])
    tdir = os.path.abspath(sys.argv[3]) if len(sys.argv) > 3 else T.TIERS
    os.makedirs(out_dir, exist_ok=True)
    screen = np.array(Image.open(shot).convert('RGBA'))
    boiler = T.load_rgba(os.path.join(M, 'era3', 'boiler.png'))
    bx, by = CS.locate_global(screen, boiler, 1)
    bsc = CS.score(screen, boiler, 1, bx, by)
    print('boiler at (%d,%d) visible match %.1f %%' % (bx, by, 100.0 * bsc / int((boiler[:, :, 3] == 255).sum())))
    ox0, oy0 = bx - BOILER_TL[0], by - BOILER_TL[1]
    for stem, ((lx, ly), base_f, fw, nf, tiers, pad) in HOSTS.items():
        base_path = os.path.join(M, base_f)
        frs = sheet_frames(base_path, fw, nf)
        sc, fi, hx, hy = CS.locate_near(screen, frs, 1, ox0 + lx, oy0 + ly, 3)
        tot = int((frs[fi][:, :, 3] == 255).sum())
        print('%-17s frame %d at (%d,%d) visible match %.1f %%' % (stem, fi, hx, hy, 100.0 * sc / tot))
        if sc < 0.5 * tot:
            print('%-17s not built in this shot: skipped' % stem)
            continue
        h, w = frs[0].shape[:2]
        x0, y0 = hx - pad[0], hy - pad[1]
        x1, y1 = hx + w + pad[2], hy + h + pad[3]
        crops = []
        for lab, key in tiers:
            out = screen.copy()
            if key != 1:
                var = sheet_frames_arr(tier_sheet(tdir, stem, base_path, key), fw, nf)[fi]
                CS.paint(out, screen, frs[fi], var, 1, hx, hy, new_too=True)
            crops.append((lab, out[y0:y1, x0:x1]))
        sheet_out(os.path.join(out_dir, stem + '-g5.png'), '%s (frame %d on screen)' % (stem, fi), crops)
    # fire glows: re-render the door (boiler pixels, then the glow frame) for every frame, MK I / II on glow 1 and
    # MK IV / V on glow 3
    gx, gy = ox0 + GLOW_TL[0], oy0 + GLOW_TL[1]
    door = boiler[GLOW_TL[1] - BOILER_TL[1]:GLOW_TL[1] - BOILER_TL[1] + 24, GLOW_TL[0] - BOILER_TL[0]:GLOW_TL[0] - BOILER_TL[0] + 24]
    for stem, keys, labels in (('firebox-1', [1, 2], ['MK I (glow 1)', 'MK II (glow 1 t2)']),
                               ('firebox-3', [1, 5], ['MK IV (glow 3)', 'MK V (glow 3 t5)'])):
        base_path = os.path.join(M, 'era3', stem + '.png')
        crops = []
        for key, lab in zip(keys, labels):
            sheet = tier_sheet(tdir, stem, base_path, key)
            for fi in range(4):
                out = screen.copy()
                win = out[gy:gy + 24, gx:gx + 24]
                m = door[:, :, 3] == 255
                win[m] = door[m]
                fr = sheet[:, fi * 24:(fi + 1) * 24]
                m2 = fr[:, :, 3] == 255
                win[m2] = fr[m2]
                crops.append(('%s f%d' % (lab, fi), out[gy - 10:gy + 34, gx - 14:gx + 38]))
        sheet_out(os.path.join(out_dir, stem + '-g5.png'), '%s re-rendered on the boiler door' % stem, crops)


def sheet_frames_arr(a, fw, n):
    return [a[:, i * fw:(i + 1) * fw] for i in range(n)]


if __name__ == '__main__':
    main()
