# Part evolution tiers (WP22, PART_TIERS.md): shared helpers for the tier art scripts.
# Locked palette (Rust Wasteland + era extensions), exact char-grid I/O, exact palette maps, palette snapping and a
# size-aware PNG writer. Pure PIL + numpy; no resampling anywhere. Run every script from the repo root.
import os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
ASSETS = os.path.join(ROOT, 'public', 'assets')
MACHINE = os.path.join(ASSETS, 'machine')
TIERS = os.path.join(MACHINE, 'tiers')

# One char per colour (the proof's char-grid alphabet; '.' = transparent).
RUST_WASTELAND = {
    'K': '#14110f',                                                                      # ink
    '0': '#1f2225', '1': '#2b2e31', '2': '#3e4246', '3': '#5a5f63', '4': '#7d8286', '5': '#a3a6a4',   # iron
    'a': '#2e1a12', 'b': '#4e2a1a', 'c': '#6e3a22', 'd': '#8c4a2a', 'e': '#ad6236', 'f': '#c98552',   # rust / copper
    's': '#5f5244', 't': '#8a7a64', 'u': '#a8957a', 'v': '#c9b28a', 'w': '#ddc9a3',                   # sand
    'p': '#7a7468', 'q': '#9c9182', 'r': '#b8a98f', 'x': '#d2bf9c',                                   # sky
    'A': '#d9822b', 'B': '#f0a848', 'C': '#ffd27a',                                                   # accent
}
# Era extensions (ART_ERA2: cyan ramp for glass insulators, jar glass, lit lamps). A host may use an extension colour
# only when its shipped MK I art already does (PART_TIERS G3).
ERA_EXT = {'m': '#2f5a62', 'n': '#5fa8b4', 'o': '#bff0ec'}
# ART_ERA3 ember + steam (fire glow, hot bends, steam highlight) and ART_ERA4 verdigris (coil rings, spire): P1 hosts.
ERA3_EXT = {'g': '#6a2418', 'h': '#b8402a', 'S': '#e8e0cc'}
ERA4_EXT = {'G': '#3f5e52', 'H': '#7fae96', 'I': '#cfe8d6'}
# ART_ERA5 violet accent ramp (the backfeed terminal's lead-in bushing): P2 hosts.
ERA5_EXT = {'W': '#24162f', 'X': '#54367a', 'Y': '#9a6ad0', 'Z': '#e0c8ff'}
PAL = dict(RUST_WASTELAND, **ERA_EXT, **ERA3_EXT, **ERA4_EXT, **ERA5_EXT)


def hex_rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


RGB = {k: hex_rgb(h) for k, h in PAL.items()}
INV = {v: k for k, v in RGB.items()}
RW_RGB = {hex_rgb(h) for h in RUST_WASTELAND.values()}
RUST_HEX = ['#2e1a12', '#4e2a1a', '#6e3a22', '#8c4a2a', '#ad6236', '#c98552']
RUST_RGB = {hex_rgb(h) for h in RUST_HEX}

# PART_TIERS 2.3 palette maps (source colour -> target colour, one lookup per pixel, never chained).
DERUST_LIGHT = {'#ad6236': '#7d8286', '#c98552': '#a3a6a4', '#8c4a2a': '#5a5f63'}
DERUST_FULL = dict(DERUST_LIGHT, **{'#6e3a22': '#3e4246', '#4e2a1a': '#3e4246', '#2e1a12': '#2b2e31'})
# POLISH = DERUST-FULL, then the lift #3e4246 -> #5a5f63 on the result ("the whole sheet" on a rotating part).
# Composed into one exact map, so the stains DERUST-FULL turned into #3e4246 are lifted with the rest (clean casting).
POLISH = {k: ('#5a5f63' if v == '#3e4246' else v) for k, v in DERUST_FULL.items()}
POLISH['#3e4246'] = '#5a5f63'
MAPS = {'DERUST-LIGHT': DERUST_LIGHT, 'DERUST-FULL': DERUST_FULL, 'POLISH': POLISH}


def load_rgba(path):
    return np.array(Image.open(path).convert('RGBA'))


def png_bytes_best(arr, path):
    """Write arr (H x W x 4 uint8, alpha 0/255) to path as the smaller of RGBA and indexed PNG (both lossless, exact
    colours; transparent pixels are written as (0,0,0,0)). Returns the byte size."""
    a = arr.copy()
    a[a[:, :, 3] == 0] = 0
    os.makedirs(os.path.dirname(path), exist_ok=True)
    rgba = Image.fromarray(a, 'RGBA')
    tmp_a, tmp_p = path + '.a.tmp', path + '.p.tmp'
    rgba.save(tmp_a, format='PNG', optimize=True)
    best = tmp_a
    cols = np.unique(a[a[:, :, 3] == 255][:, :3].reshape(-1, 3), axis=0)
    if len(cols) <= 255:
        lut = {tuple(c): i + 1 for i, c in enumerate(cols)}
        idx = np.zeros(a.shape[:2], np.uint8)
        op = a[:, :, 3] == 255
        flat = a[:, :, :3][op]
        idx[op] = [lut[tuple(c)] for c in flat]
        pal = [0, 0, 0] + [int(v) for c in cols for v in c]
        im = Image.fromarray(idx, 'P')
        im.putpalette(pal + [0] * (768 - len(pal)))
        im.save(tmp_p, format='PNG', optimize=True, transparency=0)
        back = np.array(Image.open(tmp_p).convert('RGBA'))
        if not np.array_equal(back, a):
            raise RuntimeError('indexed round trip mismatch: ' + path)
        if os.path.getsize(tmp_p) < os.path.getsize(tmp_a):
            best = tmp_p
    for t in (tmp_a, tmp_p):
        if t != best and os.path.exists(t):
            os.remove(t)
    if os.path.exists(path):
        os.remove(path)
    os.replace(best, path)
    back = load_rgba(path)
    if not np.array_equal(back, a):
        raise RuntimeError('round trip mismatch: ' + path)
    return os.path.getsize(path)


def apply_map(arr, mapping):
    """Exact per-pixel colour map on opaque pixels (one lookup of the SOURCE colour; never chained)."""
    out = arr.copy()
    for k, v in mapping.items():
        kr, vr = hex_rgb(k), hex_rgb(v)
        m = (arr[:, :, 0] == kr[0]) & (arr[:, :, 1] == kr[1]) & (arr[:, :, 2] == kr[2]) & (arr[:, :, 3] == 255)
        out[m, :3] = vr
    return out


def to_grid(arr):
    """RGBA array -> list of row lists of palette chars ('.' = transparent). Raises on an off-palette colour."""
    H, W = arr.shape[:2]
    g = []
    for y in range(H):
        row = []
        for x in range(W):
            px = arr[y, x]
            if px[3] == 0:
                row.append('.')
            else:
                c = tuple(int(v) for v in px[:3])
                if c not in INV:
                    raise ValueError('off-palette colour %s at %d,%d' % (c, x, y))
                row.append(INV[c])
        g.append(row)
    return g


def load_grid(path):
    return to_grid(load_rgba(path))


def from_grid(g):
    H, W = len(g), len(g[0])
    a = np.zeros((H, W, 4), np.uint8)
    for y in range(H):
        for x in range(W):
            ch = g[y][x]
            if ch != '.':
                a[y, x, :3] = RGB[ch]
                a[y, x, 3] = 255
    return a


def save_grid(g, path):
    return png_bytes_best(from_grid(g), path)


def copy_grid(g):
    return [r[:] for r in g]


def put(g, x, y, s):
    """Stamp a string of palette chars at (x, y); spaces are skipped."""
    for i, ch in enumerate(s):
        if ch != ' ':
            g[y][x + i] = ch


def paint(g, x, y, ch):
    """Recolour (x, y) only when it is opaque and not ink (keeps outlines and silhouette)."""
    if g[y][x] not in 'K.':
        g[y][x] = ch


def remap(g, m, region=lambda x, y: True):
    for y in range(len(g)):
        for x in range(len(g[0])):
            c = g[y][x]
            if c in m and region(x, y):
                g[y][x] = m[c]


def snap_to_palette(arr, allowed_rgb, alpha_cut=128):
    """Exact snap for generated art (method B): alpha -> 0/255 at alpha_cut, every opaque pixel -> nearest allowed
    colour by RGB distance. Returns (snapped array, number of changed opaque pixels)."""
    out = arr.copy()
    op = arr[:, :, 3] >= alpha_cut
    out[:, :, 3] = np.where(op, 255, 0)
    pal = np.array(sorted(allowed_rgb), np.int32)
    px = arr[:, :, :3][op].astype(np.int32)
    d = ((px[:, None, :] - pal[None, :, :]) ** 2).sum(axis=2)
    snapped = pal[d.argmin(axis=1)].astype(np.uint8)
    changed = int((snapped != arr[:, :, :3][op]).any(axis=1).sum())
    out[:, :, :3][op] = snapped
    out[~op] = 0
    return out, changed


def frames_of(arr, fw, fh, n):
    """Row-major frames of a sheet (the rot sheet layout: columns = sheet width // frame width)."""
    cols = arr.shape[1] // fw
    return [arr[(i // cols) * fh:(i // cols + 1) * fh, (i % cols) * fw:(i % cols + 1) * fw] for i in range(n)]


def rel(path):
    return os.path.relpath(path, ROOT).replace('\\', '/')
