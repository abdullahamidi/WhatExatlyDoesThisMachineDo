# In-game-size compositor (WP23a, Art Director): pastes living-world cells onto a real 1080p store shot at the exact
# camera pose, so a sheet can be judged at its shipped size before it is wired. Ported from the WP22-23 denizen proof
# (tools/build.py composite / bubble / tail). Evidence only: never writes into public/.
#
# Poses (DENIZEN_ART 3; WP23a-assignments EM decision 9): focus world px + zoom; VIEW 1280x720 game px.
#   e1 = s0-s7 era I, zoom 1 (store shot 02-era1-full)   s8 = era II generator, zoom 1   s9 = era II full, zoom .75
#   (store shot 03-era2-generator is the s9 pose). s11 / s15 = zoom .5 (eras III-V; WP23b). Device scale = shot height / 720.
# Ground rows: world y = GROUND_Y 1680 (back row) or + 24..48 (front row). Far window plane: sf 0.3, skyline art x2,
# tile instance origin strip (768, 428) (EM decision 8).
#
# usage: python -I composite.py <shot.png> <out.png> --pose e1|s8|s9 --sheet <key> --frame <name> --row <I..whole>
#                [--x <world x>] [--dy <world px below GROUND_Y>] [--flip] [--alpha .85] [--shadow 14] [--shadow-scale .5]
#                [--bubble "<text>"] [--ui 100] [--windows lit|breathe] [--windows-alpha .85] [--window-set placed|proposed]
import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from PIL import Image, ImageDraw, ImageFont  # noqa: E402
from pal import RGB, render  # noqa: E402
from sheets import SHEETS, FRAMES, ERA_ROWS  # noqa: E402
from build_sheet import load_master, cell_rows  # noqa: E402

VIEW = (1280, 720)
GROUND_Y = 1680
PIXEL_SCALE = 2
POSES = {'e1': ((1920, 1520), 1.0), 's8': ((2064, 1464), 1.0), 's9': ((2192, 1504), 0.75),
         # WP23b AD3a: zoom .5 framings (DENIZEN_ART 3: view x 642-3202 / 640-3200), matched to the store shots by the
         # ground line and the anchors: 04-era3-boiler = s11 (GROUND_Y at game y 560), 07-era5-ruined and
         # 09-postgame-portrait = s15 (era V camera: GROUND_Y at game y 660)
         's11': ((1922, 1280), 0.5), 's15': ((1920, 1080), 0.5)}
SKYLINE = dict(sf=0.3, origin=(768, 428), scale=2)
# skyline art (x, y, crop w, h) of the six lit panes: DENIZEN_ART 5.1 placements, and the AD-a proposal that keeps all six
# on the dark face of the tower that carries the girl's window (the three low panes sit at the skyline ground line and
# are hidden behind the machine at s9; unlit windows are invisible at that distance, so a lit pane may sit on any wall)
LIT_WINDOWS = ((158, 208, 3, 6), (167, 207, 4, 6), (306, 120, 4, 6), (306, 132, 4, 6), (318, 146, 4, 6), (404, 216, 2, 4))
PROPOSED_WINDOWS = ((306, 120, 4, 6), (306, 132, 4, 6), (318, 146, 4, 6), (306, 146, 4, 6), (312, 120, 4, 6), (312, 132, 4, 6))
FONT = 'C:/Windows/Fonts/consola.ttf'
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))


def to_game(wx, wy, pose, sf=1.0):
    """World (or parallax-strip) px -> game px for a camera centred on the pose focus (Phaser centerOn + zoom)."""
    (fx, fy), z = POSES[pose]
    sx, sy = fx - VIEW[0] / 2, fy - VIEW[1] / 2
    return ((wx - sf * sx - VIEW[0] / 2) * z + VIEW[0] / 2, (wy - sf * sy - VIEW[1] / 2) * z + VIEW[1] / 2)


def nn(im, s):
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.NEAREST)


def with_alpha(im, a):
    if a >= 1:
        return im
    r, g, b, al = im.split()
    al = al.point(lambda v: round(v * a))
    return Image.merge('RGBA', (r, g, b, al))


def shadow(width, alpha):
    im = Image.new('RGBA', (width, 3), (0, 0, 0, 0))
    ImageDraw.Draw(im).ellipse((0, 0, width - 1, 2), fill=RGB['K'] + (round(255 * alpha),))
    return im


def cell(sheet, frame, row):
    frames = load_master(sheet)
    return render(cell_rows(sheet, frames, frame, ERA_ROWS.index(row) if SHEETS[sheet]['era_rows'] else 0))


def paste_ground(base, im, wx, pose, dy=0, flip=False, alpha=1.0, shadow_w=0, shadow_a=0.28):
    """Feet-pivot (0.5, 1) sprite at world (wx, GROUND_Y + dy). Returns the device rect and the head-top device point."""
    d = base.height / VIEW[1]
    z = POSES[pose][1]
    art = PIXEL_SCALE * z * d                                  # device px per art px
    gx, gy = to_game(wx, GROUND_Y + dy, pose)
    if flip:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    if shadow_w and shadow_a > 0:
        sh = nn(shadow(shadow_w, shadow_a), art)
        base.alpha_composite(sh, (round(gx * d - sh.width / 2), round(gy * d - 2 * art)))
    sp = nn(with_alpha(im, alpha), art)
    x0, y0 = round(gx * d - sp.width / 2), round(gy * d - sp.height)
    base.alpha_composite(sp, (x0, y0))
    bbox = im.getbbox() or (0, 0, im.width, im.height)
    head = (round(x0 + (bbox[0] + bbox[2]) / 2 * art), round(y0 + bbox[1] * art))
    return (x0, y0, x0 + sp.width, y0 + sp.height), head


def _pane_xy(ax, ay, pose, d):
    sx, sy = SKYLINE['origin'][0] + SKYLINE['scale'] * ax, SKYLINE['origin'][1] + SKYLINE['scale'] * ay
    gx, gy = to_game(sx, sy, pose, SKYLINE['sf'])
    return round(gx * d), round(gy * d)


def paste_windows(base, frame_im, pose, alpha=0.85, windows=LIT_WINDOWS, tol=18):
    """The six bg.windowLit placements (crop per pane) on the far window plane. A flat shot has no depth, so each
    device pixel is painted only where the shot still shows the far-plane colour expected from the skyline art under
    it (pane core #6e3a22 or dark wall #2b2e31, each sampled from the unoccluded tower at this pose): machine parts in
    front keep covering the far plane, as in game. Returns the device rects with the visible share."""
    d = base.height / VIEW[1]
    z = POSES[pose][1]
    art = SKYLINE['scale'] * z * d
    sky = Image.open(os.path.join(REPO, 'public', 'assets', 'bg', 'skyline.png')).convert('RGBA')

    def shot_at(ax, ay):
        x0, y0 = _pane_xy(ax, ay, pose, d)
        return base.getpixel((x0 + round(art / 2), y0 + round(art / 2)))[:3]
    refs = {(0x6e, 0x3a, 0x22): shot_at(307, 122), (0x2b, 0x2e, 0x31): shot_at(314, 116)}
    out = []
    for ax, ay, w, h in windows:
        x0, y0 = _pane_xy(ax, ay, pose, d)
        sp = nn(with_alpha(frame_im.crop((0, 0, w, h)), alpha), art)
        keep = Image.new('L', sp.size, 0)
        painted = 0
        for yy in range(sp.height):
            for xx in range(sp.width):
                X, Y = x0 + xx, y0 + yy
                if not (0 <= X < base.width and 0 <= Y < base.height):
                    continue
                exp = refs.get(sky.getpixel((ax + min(w - 1, int(xx / art)), ay + min(h - 1, int(yy / art))))[:3])
                p = base.getpixel((X, Y))
                if exp is not None and all(abs(p[i] - exp[i]) <= tol for i in range(3)):
                    keep.putpixel((xx, yy), 255)
                    painted += 1
        layer = Image.new('RGBA', sp.size, (0, 0, 0, 0))
        layer.paste(sp, (0, 0), keep)
        base.alpha_composite(layer, (x0, y0))
        out.append((x0, y0, sp.width, sp.height, '%d%% visible' % round(100 * painted / (sp.width * sp.height))))
    return out


# ---------- speech bubble mock (DOM spec DENIZEN_ART 4.1, drawn at device scale z = shotH/720 * ui/100) ----------
def bubble(text, z, max_css=200):
    css = lambda v: round(v * z)  # noqa: E731
    f = ImageFont.truetype(FONT, css(14))
    pad_x, pad_y, bw, lh = css(8), css(5), css(2), css(18)
    maxw = css(max_css) - 2 * (pad_x + bw)
    lines, cur = [], ''
    for w_ in text.split(' '):
        t = (cur + ' ' + w_).strip()
        if f.getlength(t) <= maxw:
            cur = t
        else:
            lines.append(cur)
            cur = w_
    lines.append(cur)
    tw = max(f.getlength(ln) for ln in lines)
    bwid = round(tw) + 2 * (pad_x + bw)
    bh = len(lines) * lh + 2 * (pad_y + bw)
    im = Image.new('RGBA', (bwid, bh + css(8)), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    ink, paper = RGB['K'] + (255,), RGB['w'] + (255,)
    dr.rectangle((bw, 0, bwid - 1 - bw, bh - 1), fill=ink)
    dr.rectangle((0, bw, bwid - 1, bh - 1 - bw), fill=ink)
    dr.rectangle((bw, bw, bwid - 1 - bw, bh - 1 - bw), fill=paper)
    asc = f.getbbox('Hg')[1]
    for i, ln in enumerate(lines):
        dr.text((bw + pad_x, bw + pad_y + i * lh + (lh - css(14)) // 2 - asc // 2), ln, font=f, fill=ink)
    return im, bh, lines


def tail(im, bh, tx, z):
    css = lambda v: round(v * z)  # noqa: E731
    dr = ImageDraw.Draw(im)
    ink, paper = RGB['K'] + (255,), RGB['w'] + (255,)
    sh = css(8) / 3
    for i, wcss in enumerate((12, 8, 4)):
        w_ = css(wcss)
        dr.rectangle((tx - w_ // 2, bh - 1 + round(i * sh), tx - w_ // 2 + w_ - 1, bh - 1 + round((i + 1) * sh)), fill=ink)
    for i, wcss in enumerate((8, 4)):
        w_ = css(wcss)
        dr.rectangle((tx - w_ // 2, bh - css(2) + round(i * sh), tx - w_ // 2 + w_ - 1,
                      bh - css(2) + round((i + 1) * sh) - 1), fill=paper)


def place_bubble(base, text, head, ui=100):
    z = base.height / VIEW[1] * ui / 100
    css = lambda v: round(v * z)  # noqa: E731
    im, bh, lines = bubble(text, z)
    x0 = max(css(8), min(base.width - css(8) - im.width, round(head[0] - im.width / 2)))
    y0 = head[1] - css(6) - im.height
    tail(im, bh, max(css(10), min(im.width - css(10), head[0] - x0)), z)
    base.alpha_composite(im, (x0, y0))
    return (x0, y0, x0 + im.width, y0 + im.height), lines


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument('shot')
    ap.add_argument('out')
    ap.add_argument('--pose', choices=sorted(POSES), required=True)
    ap.add_argument('--sheet')
    ap.add_argument('--frame')
    ap.add_argument('--row', default='I', choices=ERA_ROWS)
    ap.add_argument('--x', type=float, default=1472)
    ap.add_argument('--dy', type=float, default=0)
    ap.add_argument('--flip', action='store_true')
    ap.add_argument('--alpha', type=float, default=1.0)
    ap.add_argument('--shadow', type=int, default=0)
    ap.add_argument('--shadow-scale', type=float, default=1.0)
    ap.add_argument('--bubble')
    ap.add_argument('--ui', type=int, default=100)
    ap.add_argument('--windows', choices=FRAMES['windowLit'])
    ap.add_argument('--windows-alpha', type=float, default=0.85)
    ap.add_argument('--window-set', choices=('placed', 'proposed'), default='placed')
    a = ap.parse_args(argv)
    base = Image.open(a.shot).convert('RGBA')
    if a.windows:
        rects = paste_windows(base, cell('windowLit', a.windows, 'I'), a.pose, a.windows_alpha,
                              PROPOSED_WINDOWS if a.window_set == 'proposed' else LIT_WINDOWS)
        print('windows', rects)
    if a.sheet:
        rect, head = paste_ground(base, cell(a.sheet, a.frame, a.row), a.x, a.pose, a.dy, a.flip, a.alpha,
                                  a.shadow, 0.28 * a.shadow_scale)
        print('sprite', rect, 'head', head)
        if a.bubble:
            print('bubble', *place_bubble(base, a.bubble, head, a.ui))
    base.convert('RGB').save(a.out)
    print('ok', a.out)


if __name__ == '__main__':
    main(sys.argv[1:])
