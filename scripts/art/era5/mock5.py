# Era I-V machine mock + finale key-frame scenes (ART_ERA5). Art-res compositor (1 art px = 1 px).
# usage: python3 mock5.py out.png            machine on a sky crop (SKY=old|violet|restored), 2x/3x copies written
#        SCENE=1 python3 mock5.py out.png    1280x720 screen at zoom 0.5 with parallax layers (see scene())
# env:   U5 era V stage 0..9 (1 nullChamber 2 containmentRing1 3 resonantSiphon1 4 graviticAnchor1 5 inversionCrank
#        6 lensArray 7 horizonField 8 skyAperture 9 all max), K5 anim frame, PH bead phase deg, AP aperture frame 0..5,
#        ECL eclipse frame 0..5, plus mock_base env (UNLOCK, U4, K4, CRANK).
import sys, os, math, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mock_base import *                       # builds eras I-IV into compose.items
import compose as C
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
R5 = os.path.abspath(HERE + '/../../../public/assets') + '/'
E5 = R5 + 'machine/era5/'
SCR = '/tmp/claude-0/-home-user-WhatExatlyDoesThisMachineDo/0b9fa637-9555-52ff-9a39-17f862f1fdae/scratchpad/era5/'
GEO = json.load(open(os.environ.get('ERA5_GEO', SCR + 'era5-geo.json')))
U5 = int(os.environ.get('U5', '9')); K5 = int(os.environ.get('K5', '2')); PH = float(os.environ.get('PH', '40'))
AP = int(os.environ.get('AP', '5' if U5 >= 8 else '0')); PLATE = int(os.environ.get('PLATE', '4'))
h5 = lambda n: U5 >= n
OUT = sys.argv[1]

def guy(p, q, sag):
    cable(p, q, sag, hexc('#3e4246'), FRAME + 5); cable((p[0], p[1] + 1), (q[0], q[1] + 1), sag, hexc('#1f2225'), FRAME + 5)

sprite(E5 + 'name-plate.png', 64, -102, .5, .5, FRAME + 2, frame=(40, 11, PLATE, 6))
if h5(1):
    sprite(E5 + 'null-gallery.png', 64, -396, .5, 1, MID + 3)
    sprite(E5 + 'null-chamber.png', 64, -419, .5, 1, MID + 2)
    import random as _r
    k = int(os.environ.get('CORE', '9')) % 64
    sprite(E5 + 'rot/null-core-rot.png', 64, -490, .5, .5, MID + 2.5, frame=(64, 64, k, 8))
    sprite(E5 + 'null-core-glint.png', 64, -490, .5, .5, MID + 2.6)
    nring = 4 if U5 >= 9 else (1 if h5(2) else 0)
    for i, r in enumerate(GEO['rings'][:nring]):
        sprite(E5 + r['back'], 64, -490, .5, .5, MID + 1)
        sprite(E5 + r['front'], 64, -490, .5, .5, MID + 5)
        ph = math.radians(PH + 97 * i); t = math.radians(r['t'])
        x, y = r['a'] * math.cos(ph), r['b'] * math.sin(ph)
        X, Y = x * math.cos(t) - y * math.sin(t), x * math.sin(t) + y * math.cos(t)
        sprite(E5 + 'ring-bead.png', 64 + X, -490 + Y, .5, .5, MID + 5.5 if math.sin(ph) >= 0 else MID + 1.5)
    npair = 3 if U5 >= 9 else (1 if h5(3) else 0)
    for st in range(npair):
        for x in GEO['siphon']['pairs'][st]: sprite(E5 + 'siphon-tube.png', x, -419, .5, 1, MID + 6)
        sprite(E5 + f'siphon-arcs-{st + 1}.png', 0, -500, 0, 0, MID + 7, frame=(128, 64, (K5 + st) % 4, 4))
    if h5(4):
        gst = 3 if U5 >= 9 else 1
        for sx in (-520, 520):
            sprite(E5 + 'gravitic-anchor.png', sx, 0, .5, 1, MID + 0)
            sprite(E5 + f'anchor-glow-{gst}.png', sx, 0, .5, 1, MID + 0.5, frame=(32, 128, K5 % 4, 4))
        guy((1, -528), (-520, -121), 6); guy((126, -528), (520, -121), 6)
        for (x, w) in ((-536, 32), (504, 32)):
            items.append((-1, len(items), ('pix', [(C.OX + x + i, C.OY + j, hexc('#5f5244')) for i in range(w) for j in (0, 1)])))
    if h5(5):
        sprite(E5 + 'rot/inversion-ghost-rot.png', 0, -56, .5, .5, FRONT - 1, frame=(48, 48, (80 - int(os.environ.get('CRANK', '10'))) % 80, 9))
    if h5(6):
        sprite(E5 + 'lens-light.png', 64, -535, .5, 1, MID + 1, frame=(32, 48, 2 if U5 >= 8 else K5 % 4, 4))
        sprite(E5 + 'lens-column.png', 64, -535, .5, 1, MID + 3)
        sprite(E5 + 'aperture.png', 64, -583, .5, 1, MID + 3, frame=(64, 28, AP, 6))
    if h5(8) and os.environ.get('BEAM', '1') == '1':
        bw = os.environ.get('BEAMFILE', 'beam')
        bim = Image.open(R5 + f'fx/{bw}.png').convert('RGBA').crop(((K5 % 4) * 16, 0, (K5 % 4) * 16 + 16, 32))
        col = Image.new('RGBA', (16, 4096), (0, 0, 0, 0))
        for y in range(0, 4096, 32): col.alpha_composite(bim, (0, y))
        top = -588 - 4096
        items.append((40, len(items), ('img', col, C.OX + 64 - 8, C.OY + top)))
# shadows already in era III list; era V anchors added above.

def machine_layer():
    """machine items rendered on a transparent canvas (for scene composition)."""
    c = Image.new('RGBA', (C.W, C.H), (0, 0, 0, 0))
    for d, o, it in sorted(items, key=lambda t: (t[0], t[1])):
        if it[0] == 'img': c.alpha_composite(it[1], (int(it[2]), int(it[3])))
        else:
            a = np.array(c)
            for x, y, col in it[1]:
                if 0 <= x < C.W and 0 <= y < C.H: a[y, x] = col
            c = Image.fromarray(a)
    return c

def tile_x(im, width, x0):
    out = Image.new('RGBA', (width, im.height), (0, 0, 0, 0)); w = im.width; x = -(x0 % w)
    while x < width: out.alpha_composite(im, (x, 0)) if x >= 0 else out.alpha_composite(im.crop((-x, 0, w, im.height)), (0, 0)); x += w
    return out
def with_alpha(im, a):
    arr = np.array(im).astype(float); arr[..., 3] *= a; return Image.fromarray(arr.astype(np.uint8))
def tint(im, rgb):
    arr = np.array(im).astype(float); arr[..., :3] *= np.array(rgb) / 255.0; return Image.fromarray(arr.astype(np.uint8))

def scene(out):
    """1280x720 screen, zoom 0.5 (1 art px = 1 screen px), camera centred on the machine bounds (x 0, y -300 art)."""
    W, H = 1280, int(os.environ.get('SH', '720')); gy = 360 + 300 + int(os.environ.get('CAMDY', '0'))   # screen row of art y 0
    gx = 640
    mode = os.environ.get('WORLD', 'violet')     # old | violet | mid | restored
    mix = float(os.environ.get('MIX', '0.5'))
    sky_old = Image.open(R5 + 'bg/sky.png').convert('RGBA')
    sky_v = Image.open(R5 + 'finale/sky-violet.png').convert('RGBA')
    sky_r = Image.open(R5 + 'finale/sky-restored.png').convert('RGBA')
    if mode == 'old': sky = sky_old.copy()
    elif mode == 'violet': sky = sky_v.copy()
    elif mode == 'mid': sky = Image.blend(sky_v, sky_r, mix)
    else: sky = sky_r.copy()
    hz = float(os.environ.get('HORIZON', '0.55' if mode in ('violet',) else '0'))
    if hz > 0: sky.alpha_composite(with_alpha(Image.open(R5 + 'finale/horizon-glow.png').convert('RGBA'), hz))
    ecl = int(os.environ.get('ECL', '5' if mode == 'violet' else '0'))
    if mode != 'restored' and not (mode == 'mid' and mix > .5):
        e = Image.open(R5 + 'finale/eclipse.png').convert('RGBA').crop((ecl * 48, 0, ecl * 48 + 48, 48))
        sky.alpha_composite(e, (372 - 24, 290 - 24))
    cv = Image.new('RGBA', (W, H)); cv.paste(sky.crop((0, 719, 1280, 720)).resize((W, H)), (0, 0)); cv.paste(sky, (0, 0))
    d_art = 300 - 80                                  # camera centre above CAMERA.focus (art px)
    def layer(old, new, sf, alpha, ground_row, underfill, tnt=None):
        lift = int(round(d_art * (1 - sf)))           # parallax: layer horizon rises above the machine ground
        y_ground = gy - lift
        imgs = []
        if mode in ('old', 'violet'): imgs = [(old, 1.0)]
        elif mode == 'restored': imgs = [(new, 1.0)]
        else: imgs = [(old, 1 - mix), (new, mix)]
        for path, a in imgs:
            im = Image.open(path).convert('RGBA')
            if tnt: im = tint(im, tnt)
            strip = tile_x(im, W, int(-gx * sf) + 300)
            top = y_ground - ground_row
            cv.alpha_composite(with_alpha(strip, alpha * a), (0, top))
            if underfill:
                uf = Image.new('RGBA', (W, max(0, H - (top + im.height))), underfill + (int(255 * alpha * a),))
                cv.alpha_composite(uf, (0, top + im.height))
    TR = os.environ.get('TRANSPARENT') == '1'
    if TR: cv = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    if not TR: layer(R5 + 'bg/mountains.png', R5 + 'finale/mountains-restored.png', .15, .45, 156, (0x5a, 0x5f, 0x63))
    if not TR: layer(R5 + 'bg/skyline.png', R5 + 'finale/skyline-restored.png', .3, .4, 220, (0x2b, 0x2e, 0x31))
    if not TR: layer(R5 + 'bg/pylons.png', R5 + 'bg/pylons.png', .55, .45, 156, None, (0xb8, 0xa9, 0x8f))
    if not TR: layer(R5 + 'bg/pylons-lit.png', R5 + 'bg/pylons-lit.png', .55, .7, 156, None)
    # ground
    g_old = Image.open(R5 + 'terrain/ground.png').convert('RGBA'); g_new = Image.open(R5 + 'terrain/ground-green.png').convert('RGBA')
    def gstrip(im):
        s = Image.new('RGBA', (W, H - gy), (0, 0, 0, 0))
        for y in range(0, H - gy, im.height):
            s.alpha_composite(tile_x(im, W, -gx), (0, y))
        return s
    gs = gstrip(g_old)
    if mode == 'restored': gs = gstrip(g_new)
    elif mode == 'mid':
        gn = gstrip(g_new); wipe = int(os.environ.get('WIPE', '360'))        # green spreads outward from the machine (screen px)
        m = Image.new('L', gs.size, 0); ma = np.array(m); ma[:, max(0, gx - wipe):gx + wipe] = 255
        gs.paste(gn, (0, 0), Image.fromarray(ma))
    if not TR: cv.alpha_composite(gs, (0, gy))
    hs = Image.new('RGBA', (W, 3), (0x4e, 0x2a, 0x1a, 150)); cv.alpha_composite(hs, (0, gy)) if not TR else None
    # regrowth strips
    st = int(os.environ.get('REGROW', '3' if mode == 'restored' else '0'))
    for s_ in range(1, st + 1):
        rg = Image.open(R5 + f'finale/regrowth-{s_}.png').convert('RGBA'); strip = tile_x(rg, W, -gx + 37 * s_)
        if mode == 'mid':
            wipe = int(os.environ.get('WIPE', '360')); a = np.array(strip); a[:, :max(0, gx - wipe)] = 0; a[:, gx + wipe:] = 0; strip = Image.fromarray(a)
        cv.alpha_composite(strip, (0, gy - 32 + 3))
    # machine
    ml = machine_layer(); cv.alpha_composite(ml, (gx - C.OX, gy - C.OY))
    # fx overlays (white fade / birds / seeds)
    wf = float(os.environ.get('WHITE', '0'))
    if wf > 0: cv.alpha_composite(Image.new('RGBA', (W, H), (0xe8, 0xe0, 0xcc, int(255 * wf))))
    if os.environ.get('BIRDS') == '1':
        b = Image.open(R5 + 'fx/bird.png').convert('RGBA')
        for i, (x, y) in enumerate(((880, 150), (902, 142), (918, 158), (940, 147), (300, 210), (318, 204))):
            cv.alpha_composite(b.crop(((i % 2) * 8, 0, (i % 2) * 8 + 8, 5)), (x, y))
    if os.environ.get('SEEDS') == '1':
        sd = Image.open(R5 + 'fx/seed.png').convert('RGBA')
        for i, (x, y) in enumerate(((420, 520), (760, 470), (980, 560), (210, 600), (1120, 500), (560, 420))):
            cv.alpha_composite(sd.crop(((i % 4) * 8, 0, (i % 4) * 8 + 8, 8)), (x, y))
    ui = os.environ.get('UI')
    if ui:
        for spec in ui.split(';'):
            p, x, y = spec.split(','); im = Image.open(p).convert('RGBA'); cv.alpha_composite(im, (int(x), int(y)))
    cv.save(out)
    if os.environ.get('K2') == '1': cv.resize((W * 2, H * 2), Image.NEAREST).save(out.replace('.png', '-2x.png'))
    return cv

if os.environ.get('SCENE') == '1':
    scene(OUT)
else:
    sky = os.environ.get('SKY', 'violet')
    C.R = R5
    im = render(OUT, int(os.environ.get('KX', '2')))
    if sky != 'old':
        p = {'violet': 'finale/sky-violet.png', 'restored': 'finale/sky-restored.png'}[sky]
        base = Image.open(R5 + p).convert('RGBA').crop((40, 0, 40 + C.W, C.H))
        ga = Image.new('RGBA', (C.W, C.H - C.OY), (0x8a, 0x7a, 0x64, 255) if sky != 'restored' else (0x5f, 0x8a, 0x4a, 255))
        base.alpha_composite(ga, (0, C.OY))
        base.alpha_composite(machine_layer())
        base.save(OUT)
        for kx in (2, 3): base.resize((C.W * kx, C.H * kx), Image.NEAREST).save(OUT.replace('.png', f'-{kx}x.png'))
