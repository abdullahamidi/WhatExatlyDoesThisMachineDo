# Part evolution tiers: review sheets (Art Director). Assembles each host with its in-game neighbours at the real
# machine-local offsets and depths (src/data/machineComponents.ts), tiers left to right:
#   <group>-contact-4x.png  4x nearest, labelled
#   <group>-ingame.png      in-game sizes on the sky tone: zoom 1 (2 screen px per art px, Era I framing) and
#                           zoom 0.5 (1 px per art px, Era III-V framing)
#   python scripts/art/tiers/contact_tiers.py <outDir> [tiersDir]
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import tierlib as T  # noqa: E402

M = T.MACHINE
SKY = (210, 191, 156, 255)
SAND = (184, 169, 143, 255)
INK = (20, 17, 15, 255)
NAMES5 = ['MK I SALVAGED', 'MK II PATCHED', 'MK III REINFORCED', 'MK IV TUNED', 'MK V AS BUILT']
NAMES3 = ['MK I SALVAGED', 'MK II REINFORCED', 'MK III AS BUILT']


def font(sz):
    try:
        return ImageFont.load_default(size=sz)
    except Exception:
        return ImageFont.load_default()


def img(path):
    return Image.open(path).convert('RGBA')


class Scene:
    """Machine-local placements: (image, x, y, originX, originY, depth); rendered over a bbox."""

    def __init__(self):
        self.items = []

    def add(self, im, x, y, ox=0.5, oy=0.5, depth=20.0, frame=None):
        if frame is not None:
            fw, fi = frame
            im = im.crop((fi * fw, 0, (fi + 1) * fw, im.height))
        self.items.append((im, x - round(ox * im.width), y - round(oy * im.height), depth))
        return self

    def render(self, box, bg=None):
        x0, y0, x1, y1 = box
        c = Image.new('RGBA', (x1 - x0, y1 - y0), bg or (0, 0, 0, 0))
        for im, x, y, _d in sorted(self.items, key=lambda t: t[3]):
            c.alpha_composite(im, (x - x0, y - y0))
        return c


def tier_file(tdir, stem, n, sub=''):
    """MK I is the shipped base; later tiers come from the tier dir."""
    if n == 1:
        return os.path.join(M, sub, stem + '.png')
    return os.path.join(tdir, '%s-t%s.png' % (stem, n))


def groups(tdir):
    tf = lambda stem, n, sub='': tier_file(tdir, stem, n, sub)  # noqa: E731
    dec = lambda name: img(os.path.join(tdir, 'decals', name))  # noqa: E731
    out = []

    # motorTuning: plinth + motor + motor pulley (Era I, no kit), 5 tiers + heartbeat low frame
    def motor(n):
        s = Scene()
        pn = 5 if n == '5b' else n
        s.add(img(tf('motor-plinth', pn)), -140, 0, 0.5, 1, 20)
        s.add(img(tf('worn-motor', n)), -140, -27, 0.5, 0.5, 21)
        s.add(img(os.path.join(M, 'pulley-motor.png')), -114, -31, 0.5, 0.5, 22)
        return s
    out.append(('motorTuning', 'machine.motor + motorPlinth (+ shipped motor pulley)', [1, 2, 3, 4, 5, '5b'],
                NAMES5 + ['MK V heartbeat low'], motor, (-176, -60, -100, 2)))

    # motorRetrofit: kit tiers on the MK I motor and on the MK V motor
    def kit_on(mn):
        def f(n):
            s = Scene()
            s.add(img(tf('motor-plinth', mn)), -140, 0, 0.5, 1, 20)
            s.add(img(tf('worn-motor', mn)), -140, -27, 0.5, 0.5, 21)
            s.add(img(os.path.join(M, 'pulley-motor.png')), -114, -31, 0.5, 0.5, 22)
            s.add(img(tf('motor-retrofit', n, 'era2')), -140, -51, 0.5, 0.5, 23)
            return s
        return f
    for mn in (1, 5):
        out.append(('motorRetrofit-on-motor-mk%d' % mn, 'machine.motorRetrofit on the MK %s motor' % ['I', '', '', '', 'V'][mn - 1],
                    [1, 2, 3, 4, 5, '5b'], NAMES5 + ['MK V heartbeat low'], kit_on(mn), (-176, -64, -100, 2)))

    # gearRatio: gear-large (+ rim decal at MK III), main pulley, pinion; crank pulley + hand crank shipped (context)
    def gears(n):
        s = Scene()
        s.add(img(os.path.join(M, 'bearing-plate.png')), -44, -56, 0.5, 0.5, 11)
        s.add(img(tf('gear-large', n)), -44, -56, 0.5, 0.5, 20)
        if n == 3:
            s.add(dec('gear-rim.png'), -44, -56, 0.5, 0.5, 20.5)
        s.add(img(tf('pulley-main', n)), -44, -56, 0.5, 0.5, 22)
        s.add(img(tf('gear-small', n)), 0, -56, 0.5, 0.5, 21)
        s.add(img(os.path.join(M, 'pulley-crank.png')), 0, -56, 0.5, 0.5, 22)
        s.add(img(os.path.join(M, 'hand-crank.png')), 0, -56, 0.5, 0.5, 30)
        return s
    out.append(('gearRatio', 'machine.gearLarge (+ gearRim decal) + pulleyMain + gearSmall', [1, 2, 3], NAMES3, gears,
                (-80, -92, 28, -20)))

    # flywheel: wheel (+ rim decals), pedestal, hub pulley; MK III heartbeat low frame
    def fly(n):
        s = Scene()
        fn = 3 if n == '3b' else n
        s.add(img(tf('flywheel', 3 if fn == 3 else 1)), 150, -56, 0.5, 0.5, 20)
        if fn == 2:
            s.add(dec('flywheel-rim-2.png'), 150, -56, 0.5, 0.5, 20.5)
        if fn == 3:
            s.add(dec('flywheel-rim-3.png'), 150, -56, 0.5, 0.5, 20.5)
        s.add(img(tf('flywheel-pedestal', n)), 150, 0, 0.5, 1, 21)
        s.add(img(tf('pulley-flywheel', 3 if fn == 3 else 1)), 150, -56, 0.5, 0.5, 23)
        return s
    out.append(('flywheel', 'machine.flywheel (+ rim decals) + pedestal + pulleyFlywheel', [1, 2, 3, '3b'],
                NAMES3 + ['MK III heartbeat low'], fly, (100, -106, 200, 2)))

    # copperWinding: generator + plinth + the stage art per tier (MK III / IV are the shipped stages 2 / 3)
    def coils(glow):
        def f(n):
            s = Scene()
            s.add(img(os.path.join(M, 'era2', 'generator-plinth.png')), 264, 0, 0.5, 1, 20)
            s.add(img(os.path.join(M, 'era2', 'generator.png')), 264, -42, 0.5, 0.5, 21)
            path = {1: os.path.join(M, 'era2', 'coils-1.png'), 2: os.path.join(tdir, 'coils-1-t2.png'),
                    3: os.path.join(M, 'era2', 'coils-2.png'), 4: os.path.join(M, 'era2', 'coils-3.png'),
                    5: os.path.join(tdir, 'coils-3-t5.png')}[n]
            s.add(img(path), 264, -42, 0.5, 0.5, 23)
            if glow:
                s.add(img(os.path.join(M, 'legacy', 'generator-glow.png')), 264, -42, 0.5, 0.5, 24, frame=(96, 3))
            s.add(img(os.path.join(M, 'era2', 'pulley-generator.png')), 268, -25, 0.5, 0.5, 25)
            return s
        return f
    for glow in (False, True):
        out.append(('copperWinding' + ('-glow' if glow else ''), 'machine.coils1..3 on the generator%s' % (
            ' + generatorGlow at full output (frame 3)' if glow else ''), [1, 2, 3, 4, 5], [
            'MK I coils-1', 'MK II coils-1-t2', 'MK III coils-2', 'MK IV coils-3', 'MK V coils-3-t5'], coils(glow),
            (214, -76, 316, 2)))

    # improvedPistons: shipped yoke (behind, mid-stroke) + the block tiers; MK V heartbeat low frame
    def pistons(n):
        s = Scene()
        s.add(img(os.path.join(M, 'piston-yoke.png')), -44, -125, 0.5, 0.75, 10)
        s.add(img(tf('piston-block', n)), -44, -110, 0.5, 1, 11)
        return s
    out.append(('improvedPistons', 'machine.pistonBlock over the shipped pistonYoke (mid-stroke)', [1, 2, 3, 4, 5, '5b'],
                NAMES5 + ['MK V heartbeat low'], pistons, (-100, -174, 12, -104)))

    # transformer: shipped capacitor rack and cable mast for context (cables are drawn by code, not shown)
    def transformer(n):
        s = Scene()
        s.add(img(os.path.join(M, 'era2', 'cable-mast.png')), 436, 0, 0.5, 1, 10)
        s.add(img(os.path.join(M, 'era2', 'capacitor-rack.png')), 340, 0, 0.5, 1, 20)
        s.add(img(tf('transformer', n, 'era2')), 396, 0, 0.5, 1, 20)
        return s
    out.append(('transformer', 'machine.transformer between the shipped capacitor rack and cable mast',
                [1, 2, 3, 4, 5, '5b'], NAMES5 + ['MK V heartbeat low'], transformer, (354, -118, 448, 2)))
    return out


def main():
    out_dir = os.path.abspath(sys.argv[1])
    tdir = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else T.TIERS
    os.makedirs(out_dir, exist_ok=True)
    f16, f12 = font(16), font(12)
    for key, title, tiers, labels, make, box in groups(tdir):
        cells = [make(n).render(box) for n in tiers]
        w, h = cells[0].size
        S, gap, x0 = 4, 16, 16
        sheet = Image.new('RGBA', (x0 * 2 + len(cells) * (w * S + gap), h * S + 70), SAND)
        d = ImageDraw.Draw(sheet)
        d.text((x0, 8), title, font=f16, fill=INK)
        for i, (c, lab) in enumerate(zip(cells, labels)):
            x = x0 + i * (w * S + gap)
            d.text((x, 32), lab, font=f12, fill=INK)
            bg = Image.new('RGBA', c.size, SKY)
            bg.alpha_composite(c)
            sheet.alpha_composite(bg.resize((w * S, h * S), Image.NEAREST), (x, 52))
        sheet.save(os.path.join(out_dir, key + '-contact-4x.png'))
        # in-game sizes: zoom 1 = 2 px per art px, zoom 0.5 = 1 px per art px
        strip = Image.new('RGBA', (x0 * 2 + len(cells) * (w * 2 + gap), h * 3 + 60), SKY)
        d = ImageDraw.Draw(strip)
        d.text((x0, 4), title + ' | top: zoom 1 (2 px / art px), bottom: zoom 0.5 (1 px / art px)', font=f12, fill=INK)
        for i, c in enumerate(cells):
            strip.alpha_composite(c.resize((w * 2, h * 2), Image.NEAREST), (x0 + i * (w * 2 + gap), 24))
            strip.alpha_composite(c, (x0 + i * (w * 2 + gap), 24 + h * 2 + 12))
        strip.save(os.path.join(out_dir, key + '-ingame.png'))
        print('wrote', key)


if __name__ == '__main__':
    main()
