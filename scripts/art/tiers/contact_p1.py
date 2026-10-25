# Part evolution tiers: review contact sheets for the P1 and P2 hosts (Art Director). Per host one sheet: tiers left
# to right (MK I = the shipped file), every frame of a sheet host in its own row, 4x nearest on the sky tone.
#   python scripts/art/tiers/contact_p1.py <outDir> [tiersDir]
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import contact_tiers as CT  # noqa: E402
import tierlib as T  # noqa: E402

M = T.MACHINE
N5 = CT.NAMES5 + ['MK V heartbeat low']
N3 = CT.NAMES3 + ['MK III heartbeat low']
# stem, base, frame width, frames, [(label, key)]
GROUPS = [
    ('firebox-1', 'era3/firebox-1.png', 24, 4, [('MK I glow 1', 1), ('MK II glow 1 t2', 2)]),
    ('firebox-3', 'era3/firebox-3.png', 24, 4, [('MK IV glow 3', 1), ('MK V glow 3 t5', 5)]),
    ('induction-heater', 'era3/induction-heater.png', 56, 1, list(zip(N5, [1, 2, 3, 4, 5, '5b']))),
    ('condenser', 'era3/condenser.png', 80, 1, list(zip(N5, [1, 2, 3, 4, 5, '5b']))),
    ('coil-ring-1', 'era4/coil-ring-1.png', 62, 4, [('MK I ring 1', 1), ('MK II ring 1 t2', 2)]),
    ('bellows', 'legacy/bellows.png', 60, 4, list(zip(N3, [1, 2, 3, '3b']))),
    ('exciter-feed', 'legacy/exciter-feed.png', 16, 1, list(zip(N3, [1, 2, 3, '3b']))),
    # P1 batch B (AD3b)
    ('calliope', 'era4/calliope.png', 72, 1, list(zip(N5, [1, 2, 3, 4, 5, '5b']))),
    ('servo-base', 'era4/servo-base.png', 28, 1, list(zip(N3, [1, 2, 3, '3b']))),
    ('servo-arm', 'era4/servo-arm.png', 48, 1, list(zip(CT.NAMES3, [1, 2, 3]))),
    # P2 (AD4a), legacy feeds of Era V
    ('backfeed-terminal', 'legacy/backfeed-terminal.png', 16, 1, list(zip(N3, [1, 2, 3, '3b']))),
    ('steam-lance', 'legacy/steam-lance.png', 16, 1, list(zip(N3, [1, 2, 3, '3b']))),
]
WAVE_NAMES = ['MK I (shipped, mode 3)', 'MK II mode 2', 'MK III mode 3', 'MK IV mode 4', 'MK V mode 5']


def wave_sheet(out_dir, tdir, f16, f12):
    """Spire wave: tiers left to right, the 8 frames of each side by side, 2x (the sheet is 270 px tall)."""
    fw, fh, nf, S, gap = 16, 270, 8, 2, 24
    W = 16 + 5 * (nf * fw * S + gap)
    out = Image.new('RGBA', (W, 52 + fh * S + 16), CT.SAND)
    d = ImageDraw.Draw(out)
    d.text((16, 8), 'spire-wave: tiers left to right, frames 0-7 side by side, 2x', font=f16, fill=CT.INK)
    for i, lab in enumerate(WAVE_NAMES):
        sh = CT.img(os.path.join(M, 'era4', 'spire-wave.png') if i == 0 else
                    os.path.join(tdir, 'spire-wave-t%d.png' % (i + 1)))
        x = 16 + i * (nf * fw * S + gap)
        d.text((x, 32), lab, font=f12, fill=CT.INK)
        bg = Image.new('RGBA', sh.size, CT.SKY)
        bg.alpha_composite(sh)
        out.alpha_composite(bg.resize((sh.width * S, sh.height * S), Image.NEAREST), (x, 52))
    path = os.path.join(out_dir, 'spire-wave-contact-2x.png')
    out.save(path)
    print('wrote', path)


def main():
    out_dir = os.path.abspath(sys.argv[1])
    tdir = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else T.TIERS
    os.makedirs(out_dir, exist_ok=True)
    f16, f12 = CT.font(16), CT.font(12)
    for stem, base, fw, nf, tiers in GROUPS:
        sheets = [CT.img(os.path.join(M, base) if key == 1 else os.path.join(tdir, '%s-t%s.png' % (stem, key)))
                  for _lab, key in tiers]
        fh = sheets[0].height
        S, gap, x0 = 4, 16, 16
        W = x0 * 2 + len(tiers) * (fw * S + gap)
        Hh = 52 + nf * (fh * S + 8) + 8
        out = Image.new('RGBA', (max(W, 420), Hh), CT.SAND)
        d = ImageDraw.Draw(out)
        d.text((x0, 8), '%s: tiers left to right, %d frame%s top to bottom, 4x' % (stem, nf, 's' if nf > 1 else ''),
               font=f16, fill=CT.INK)
        for i, ((lab, _k), sh) in enumerate(zip(tiers, sheets)):
            x = x0 + i * (fw * S + gap)
            d.text((x, 32), lab, font=f12, fill=CT.INK)
            for fi in range(nf):
                fr = sh.crop((fi * fw, 0, (fi + 1) * fw, fh))
                bg = Image.new('RGBA', fr.size, CT.SKY)
                bg.alpha_composite(fr)
                out.alpha_composite(bg.resize((fw * S, fh * S), Image.NEAREST), (x, 52 + fi * (fh * S + 8)))
        path = os.path.join(out_dir, stem + '-contact-4x.png')
        out.save(path)
        print('wrote', path)
    wave_sheet(out_dir, tdir, f16, f12)


if __name__ == '__main__':
    main()
