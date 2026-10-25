# Sheet builder (WP23a, Art Director): master frames -> one sprite sheet PNG in the exact column order of
# sheets.FRAMES, with 6 era rows (I, II, III, IV, V, whole) baked by erarecolor for era-row sheets.
#
# Master = scripts/art/world/masters/<sheet>/<sheet>.txt (ASCII, codes from pal.py; '.' transparent), optionally
# overridden per frame by masters/<sheet>/<frame>.png (cell sized, palette colours, alpha 0/255).
#   @frame <name>                  then cell-height rows of cell-width chars: the colour master of that frame
#   @copy <name> <src>             the cell is a copy of <src> (base + layers): PLACEHOLDER CELLS for later waves
#   @layer <name> <tag> <rows...>  then cell-height rows; painted over frame <name> only in the listed era rows
#                                  (I II III IV V whole); '.' keeps, '_' erases, any other code paints
#   # ...                          comment
#
# usage (from anywhere; python 3.12 + Pillow):
#   python -I scripts/art/world/build_sheet.py <sheet> [--out <png>] [--frames <dir>]
#   default --out = <repo>/public/assets/<sheets.SHEETS[sheet].file>; --frames also writes one PNG per cell.
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from PIL import Image  # noqa: E402
from pal import ALL, render, grid  # noqa: E402
from sheets import SHEETS, FRAMES, ERA_ROWS, cell_origin  # noqa: E402
from erarecolor import recolor_rows  # noqa: E402

REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
CODES = set(ALL) | {'.'}


def master_dir(sheet):
    return os.path.join(HERE, 'masters', SHEETS[sheet]['master'] or sheet)


def _block(lines, i, w, h, where, layer=False):
    rows = [ln.rstrip('\r\n') for ln in lines[i:i + h]]
    if len(rows) != h:
        raise SystemExit('%s: expected %d rows, got %d' % (where, h, len(rows)))
    ok = CODES | ({'_'} if layer else set())
    for y, r in enumerate(rows):
        if len(r) != w:
            raise SystemExit('%s row %d: width %d != %d: %r' % (where, y, len(r), w, r))
        bad = set(r) - ok
        if bad:
            raise SystemExit('%s row %d: unknown codes %s' % (where, y, sorted(bad)))
    return rows


def load_master(sheet):
    """-> {frame: {'base': rows, 'layers': [(tag, set(row idx), rows)], 'copy_of': src | None}}"""
    spec = SHEETS[sheet]
    w, h = spec['cell']
    d = master_dir(sheet)
    frames, copies = {}, {}
    txt = os.path.join(d, sheet + '.txt')
    if os.path.exists(txt):
        with open(txt, encoding='utf-8') as fh:
            lines = fh.read().splitlines()
        i = 0
        while i < len(lines):
            ln = lines[i].strip()
            if not ln or ln.startswith('#'):
                i += 1
                continue
            parts = ln.split()
            where = '%s:%d' % (os.path.basename(txt), i + 1)
            if parts[0] == '@frame':
                frames[parts[1]] = {'base': _block(lines, i + 1, w, h, where), 'layers': [], 'copy_of': None}
                i += 1 + h
            elif parts[0] == '@copy':
                copies[parts[1]] = parts[2]
                i += 1
            elif parts[0] == '@layer':
                name, tag, rnames = parts[1], parts[2], parts[3:]
                bad = [r for r in rnames if r not in ERA_ROWS]
                if bad or not rnames:
                    raise SystemExit('%s: bad era rows %s' % (where, bad or '(none)'))
                rows = _block(lines, i + 1, w, h, where, layer=True)
                frames.setdefault(name, {'base': None, 'layers': [], 'copy_of': None})
                frames[name]['layers'].append((tag, {ERA_ROWS.index(r) for r in rnames}, rows))
                i += 1 + h
            else:
                raise SystemExit('%s: unknown directive %r' % (where, parts[0]))
    for fn in FRAMES[sheet]:                                           # PNG overrides
        p = os.path.join(d, fn + '.png')
        if os.path.exists(p):
            im = Image.open(p).convert('RGBA')
            if im.size != (w, h):
                raise SystemExit('%s: size %s != cell %s' % (p, im.size, (w, h)))
            frames.setdefault(fn, {'base': None, 'layers': [], 'copy_of': None})['base'] = grid(im)
    for dst, src in copies.items():
        if src not in frames or frames[src]['base'] is None:
            raise SystemExit('@copy %s %s: source frame missing' % (dst, src))
        frames[dst] = {'base': frames[src]['base'], 'layers': list(frames[src]['layers']), 'copy_of': src}
    missing = [f for f in FRAMES[sheet] if f not in frames or frames[f]['base'] is None]
    extra = [f for f in frames if f not in FRAMES[sheet]]
    if missing or extra:
        raise SystemExit('%s master: missing frames %s, unknown frames %s' % (sheet, missing, extra))
    return frames


def apply_layers(base, layers, row):
    g = [list(r) for r in base]
    for _tag, rows_on, lrows in layers:
        if row not in rows_on:
            continue
        for y, r in enumerate(lrows):
            for x, ch in enumerate(r):
                if ch == '_':
                    g[y][x] = '.'
                elif ch != '.':
                    g[y][x] = ch
    return [''.join(r) for r in g]


def cell_rows(sheet, frames, frame, row):
    """Final ASCII rows of one cell (row = era row index, or 0 for single-row sheets)."""
    spec = SHEETS[sheet]
    f = frames[frame]
    rows = apply_layers(f['base'], f['layers'], row)
    if spec['era_rows']:
        rows = recolor_rows(rows, row, spec['pins'])
    return rows


def build(sheet, frames_dir=None):
    spec = SHEETS[sheet]
    w, h = spec['cell']
    frames = load_master(sheet)
    out = Image.new('RGBA', spec['size'], (0, 0, 0, 0))
    for r in range(spec['rows']):
        for c, fn in enumerate(FRAMES[sheet]):
            im = render(cell_rows(sheet, frames, fn, r), w)
            out.paste(im, cell_origin(spec, c, r))
            if frames_dir:
                tag = ERA_ROWS[r] if spec['era_rows'] else 'cell'
                im.save(os.path.join(frames_dir, '%s-%s-%02d-%s.png' % (sheet, tag, c, fn)))
    return out, frames


def placeholders(frames):
    return [(f, v['copy_of']) for f, v in frames.items() if v['copy_of']]


if __name__ == '__main__':
    args = sys.argv[1:]
    if not args or args[0] not in SHEETS:
        print('usage: python -I build_sheet.py <%s> [--out <png>] [--frames <dir>]' % '|'.join(SHEETS))
        sys.exit(2)
    sheet = args[0]
    out_path = os.path.join(REPO, 'public', 'assets', *SHEETS[sheet]['file'].split('/'))
    frames_dir = None
    if '--out' in args:
        out_path = args[args.index('--out') + 1]
    if '--frames' in args:
        frames_dir = args[args.index('--frames') + 1]
        os.makedirs(frames_dir, exist_ok=True)
    img, frames = build(sheet, frames_dir)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    img.save(out_path, optimize=True)
    print('%s -> %s %dx%d (%d frames x %d rows)' % (sheet, out_path, img.width, img.height, len(FRAMES[sheet]),
                                                     SHEETS[sheet]['rows']))
    for dst, src in placeholders(frames):
        print('  PLACEHOLDER %s = copy of %s' % (dst, src))
