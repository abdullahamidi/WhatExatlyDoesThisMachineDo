# A17 postgame accent (D3): "restored" palette-swap variants of the Era V energy sprites.
# Pure per-pixel colour map (no redraw, no resampling): the violet null energy becomes light once the machine has
# restored the sky. Light sources (core, glint, beads, lens light) turn warm (lamp lit); energy lines (rings, arcs,
# siphon fluid, anchor glows, inversion ghost) turn pale steam-white so they still read against the restored blue sky.
#   python scripts/art/a17/restored.py [outRoot] [--inplace]
# Default: writes machine/era5/restored/<same name>.png (+ restored/rot/*-rot.png) under outRoot (default public/assets).
# --inplace overwrites the originals under outRoot (prototype screenshots only; never in the repo).
import os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
OUT = os.path.abspath(args[0]) if args else os.path.join(ROOT, 'public', 'assets')
INPLACE = '--inplace' in sys.argv

def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))

INK, X0, X1, X2, X3 = rgb('#14110f'), rgb('#24162f'), rgb('#54367a'), rgb('#9a6ad0'), rgb('#e0c8ff')
A0, A1, A2, W0, S4, S3, E0 = rgb('#d9822b'), rgb('#f0a848'), rgb('#ffd27a'), rgb('#e8e0cc'), rgb('#ddc9a3'), rgb('#c9b28a'), rgb('#6a2418')

# Light sources: the void inverts into a lit core (dark centre -> hottest), warm ramp.
CORE = {INK: W0, X0: A2, X1: A1, X2: A0}
LAMP = {X0: E0, X1: A0, X2: A1, X3: A2}
# Energy lines: pale steam ramp by value.
LINE = {X0: S3, X1: S3, X2: S4, X3: W0}

GROUPS = [
    (CORE, ['null-core.png', 'rot/null-core-rot.png']),
    (LAMP, ['null-core-glint.png', 'ring-bead.png', 'lens-light.png']),
    (LINE, ['ring1-back.png', 'ring1-front.png', 'ring2-back.png', 'ring2-front.png', 'ring3-back.png', 'ring3-front.png',
            'ring4-back.png', 'ring4-front.png', 'siphon-arcs-1.png', 'siphon-arcs-2.png', 'siphon-arcs-3.png',
            'siphon-tube.png', 'anchor-glow-1.png', 'anchor-glow-2.png', 'anchor-glow-3.png',
            'inversion-ghost.png', 'rot/inversion-ghost-rot.png', 'aperture.png', 'null-chamber.png']),
]


def swap(src, dst, mapping):
    a = np.array(Image.open(src).convert('RGBA'))
    out = a.copy()
    for k, v in mapping.items():
        m = (a[:, :, 0] == k[0]) & (a[:, :, 1] == k[1]) & (a[:, :, 2] == k[2]) & (a[:, :, 3] == 255)
        out[m, :3] = v
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    Image.fromarray(out, 'RGBA').save(dst)
    print('wrote', os.path.relpath(dst, OUT), a.shape[1], 'x', a.shape[0])


if __name__ == '__main__':
    src_root = os.path.join(ROOT, 'public', 'assets', 'machine', 'era5')
    for mapping, names in GROUPS:
        for n in names:
            src = os.path.join(src_root, n)
            dst = os.path.join(OUT, 'machine', 'era5', n if INPLACE else os.path.join('restored', n))
            swap(src, dst, mapping)
