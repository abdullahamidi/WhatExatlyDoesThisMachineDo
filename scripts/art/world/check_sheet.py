# Sheet gate (WP23a, Art Director): checks one built PNG against sheets.SHEETS and, when the asset id is already in
# src/assets/manifest.ts, against the manifest dims. Exit 1 on any error.
#   - PNG is RGBA, 8 bit per channel (IHDR colour type 6, depth 8); size == cell x frames by cell x rows
#   - alpha only 0 or 255; every opaque pixel on the 25-colour palette (VIOLET_LIGHT only in era row V), narrowed by the
#     sheet's `only` codes and widened per frame by `only_frames` (still palette-only); the restored-world colours
#     (pal.RESTORED: PALETTE green0-3 / skyClear0-3) only in the frames a sheet names in `restored_frames` (WP23b AD3c:
#     sprout bloom, puddle whole)
#   - era-row sheets: row I uses only the sepia codes (ink, rust a/b, sand ramp)
#   - per cell: not empty, 1 silhouette component (4-connected; every sheet since WP23b AD3a, unless the sheet sets
#     parts=True, e.g. a strip of separate streaks), full 1 px ink ring when the sheet asks for one,
#     feet on the bottom row for pivot 'feet' (except the sheet's stacked `overlays`, e.g. Sensor 7 heads and glyphs,
#     and its `airborne` frames, e.g. the crow's flight cells: WP23b AD3b)
#   - frames listed in the sheet's `grow` (e.g. hole stages) only ever add pixels: no un-happening (DENIZEN_ART 8.2)
#   - WP28a AD1: per-frame opt-outs `no_ring` (no full ink ring: 1 px members, a glint) and `conn8` (silhouette counted
#     8-connected: diagonal 1 px tubes); both are frame-name tuples in sheets.py
#   - WP28b AD3-OBJ: per-frame `parts_frames` (no one-component rule: drops, wisps, lifted stones float free) and
#     `violet_frames` (VIOLET_LIGHT allowed in that frame of a single-row sheet: the era V rim)
#   - prints per-row colour stats
# usage: python -I scripts/art/world/check_sheet.py <sheet> [--png <file>] [--manifest <manifest.ts>]
import os
import re
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from PIL import Image  # noqa: E402
from pal import ALL, INV, PALETTE_RGB, RESTORED, VIOLET_CODE, rgb  # noqa: E402
from sheets import SHEETS, FRAMES, ERA_ROWS, EXTRA_COLOURS, cell_origin  # noqa: E402
from erarecolor import SEPIA_ROW_CODES  # noqa: E402

REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))


def png_header(path):
    with open(path, 'rb') as fh:
        head = fh.read(33)
    if head[:8] != b'\x89PNG\r\n\x1a\n' or head[12:16] != b'IHDR':
        return None
    w, h, depth, ctype = struct.unpack('>IIBB', head[16:26])
    return w, h, depth, ctype


def manifest_dims(path, asset_id):
    if not os.path.exists(path):
        return None
    with open(path, encoding='utf-8') as fh:
        src = fh.read()
    m = re.search(r"'%s'\s*:\s*\{(.*?)\n\s*\},?\s*\n" % re.escape(asset_id), src, re.S)
    if not m:
        return None
    body = m.group(1)
    out = {}
    for key, pat in (('width', r'\bwidth:\s*(\d+)'), ('height', r'\bheight:\s*(\d+)'),
                     ('frame', r'frame:\s*\{\s*width:\s*(\d+),\s*height:\s*(\d+)(?:,\s*count:\s*(\d+))?'),
                     ('eraRows', r'eraRows:\s*(\d+)'), ('file', r"file:\s*('([^']*)'|null)")):
        mm = re.search(pat, body)
        if mm:
            out[key] = mm.groups() if key == 'frame' else (mm.group(2) if key == 'file' else int(mm.group(1)))
    return out


def components(mask, w, h, conn8=False):
    seen, n = set(), 0
    for y in range(h):
        for x in range(w):
            if mask[y][x] and (x, y) not in seen:
                n += 1
                stack = [(x, y)]
                seen.add((x, y))
                while stack:
                    cx, cy = stack.pop()
                    nbs = [(cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)]
                    if conn8:                                   # WP28a AD1: diagonal 1 px members (sheet `conn8`)
                        nbs += [(cx + 1, cy + 1), (cx - 1, cy - 1), (cx + 1, cy - 1), (cx - 1, cy + 1)]
                    for nx, ny in nbs:
                        if 0 <= nx < w and 0 <= ny < h and mask[ny][nx] and (nx, ny) not in seen:
                            seen.add((nx, ny))
                            stack.append((nx, ny))
    return n


def check(sheet, png=None, manifest=None):
    spec = SHEETS[sheet]
    png = png or os.path.join(REPO, 'public', 'assets', *spec['file'].split('/'))
    manifest = manifest or os.path.join(REPO, 'src', 'assets', 'manifest.ts')
    errors, notes = [], []
    if not os.path.exists(png):
        return ['missing %s' % png], notes
    hdr = png_header(png)
    if hdr is None:
        return ['not a PNG: %s' % png], notes
    w, h, depth, ctype = hdr
    if depth != 8 or ctype != 6:
        errors.append('PNG must be RGBA 8-bit (colour type 6, depth 8); got type %d depth %d' % (ctype, depth))
    if (w, h) != spec['size']:
        errors.append('size %dx%d != spec %dx%d' % (w, h, spec['size'][0], spec['size'][1]))
    md = manifest_dims(manifest, spec['id'])
    if md is None:
        notes.append('manifest: %s not found (not wired yet) -> spec dims only' % spec['id'])
    else:
        if md.get('width') not in (None, w) or md.get('height') not in (None, h):
            errors.append('manifest %s size %sx%s != PNG %dx%d' % (spec['id'], md.get('width'), md.get('height'), w, h))
        fr = md.get('frame')
        if fr and (int(fr[0]), int(fr[1])) != spec['cell']:
            errors.append('manifest frame %sx%s != cell %dx%d' % (fr[0], fr[1], spec['cell'][0], spec['cell'][1]))
        if fr and fr[2] and int(fr[2]) != len(FRAMES[sheet]) * spec['rows']:           # count = every cell
            errors.append('manifest frame count %s != %d frames x %d rows' % (fr[2], len(FRAMES[sheet]), spec['rows']))
        if spec['era_rows'] and md.get('eraRows') not in (None, len(ERA_ROWS)):
            errors.append('manifest eraRows %s != %d' % (md.get('eraRows'), len(ERA_ROWS)))
        notes.append('manifest: %s %s' % (spec['id'], md))
    im = Image.open(png)
    if im.mode != 'RGBA':
        errors.append('mode %s != RGBA' % im.mode)
        im = im.convert('RGBA')
    px = im.load()
    cw, ch = spec['cell']
    only = {rgb(ALL[c]) for c in spec.get('only', ())} or None
    # per-frame override of `only` (WP23b AD3b: the girl window's restored frame is the post-finale warm lamp light)
    only_frames = {fn: {rgb(ALL[c]) for c in codes} for fn, codes in spec.get('only_frames', {}).items()}
    # restored-world colours, per frame (WP23b AD3c): pal.RESTORED codes only, never on a pre-finale frame
    restored_frames = {fn: {rgb(RESTORED[c]) for c in codes} for fn, codes in spec.get('restored_frames', {}).items()}
    alphas = set()
    for r in range(spec['rows']):
        allowed = set(PALETTE_RGB)
        for hx, rows_ok in EXTRA_COLOURS.items():
            if spec['era_rows'] and r in rows_ok:
                allowed.add(rgb(hx))
        if only:
            allowed &= only
        row_counts = {}
        masks = {}
        base_allowed = allowed
        for c, fn in enumerate(FRAMES[sheet]):
            allowed = (base_allowed | only_frames[fn]) & set(PALETTE_RGB) if fn in only_frames else base_allowed
            if fn in spec.get('violet_frames', ()):          # WP28b AD3-OBJ: the era V rim on a single-row sheet
                allowed = allowed | {rgb(ALL[VIOLET_CODE])}
            if fn in restored_frames:
                allowed = allowed | restored_frames[fn]
            ox, oy = cell_origin(spec, c, r)
            mask = [[False] * cw for _ in range(ch)]
            masks[fn] = mask
            edge_bad = 0
            for y in range(ch):
                for x in range(cw):
                    p = px[ox + x, oy + y]
                    alphas.add(p[3])
                    if p[3] == 0:
                        continue
                    mask[y][x] = True
                    col = p[:3]
                    row_counts[col] = row_counts.get(col, 0) + 1
                    if col not in allowed:
                        errors.append('row %s %s (%d,%d): off-palette #%02x%02x%02x' % (
                            ERA_ROWS[r] if spec['era_rows'] else 0, fn, x, y, *col))
                    if spec['era_rows'] and r == 0 and INV.get(col) not in SEPIA_ROW_CODES:
                        errors.append('row I %s (%d,%d): non-sepia colour #%02x%02x%02x' % (fn, x, y, *col))
            for y in range(ch):
                for x in range(cw):
                    if not mask[y][x]:
                        continue
                    edge = any(not (0 <= nx < cw and 0 <= ny < ch) or not mask[ny][nx]
                               for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
                    if edge and px[ox + x, oy + y][:3] != rgb(ALL['K']):
                        edge_bad += 1
            n = components(mask, cw, ch, fn in spec.get('conn8', ()))
            if n == 0:
                errors.append('%s %s: empty cell' % (ERA_ROWS[r] if spec['era_rows'] else '-', fn))
                continue
            # every cell, props too (WP23b); opt out: parts=True, or per frame `parts_frames` (WP28b: pieces float free)
            if n != 1 and not spec.get('parts') and fn not in spec.get('parts_frames', ()):
                errors.append('%s %s: %d silhouette components (want 1)' % (ERA_ROWS[r] if spec['era_rows'] else '-', fn, n))
            # WP28a AD1: per-frame ring opt-out (`no_ring`: 1 px members such as bicycle tubes, or a glint sparkle)
            if spec['ring'] and edge_bad and fn not in spec.get('no_ring', ()):
                errors.append('%s %s: %d edge px not ink (full ink ring)' % (ERA_ROWS[r] if spec['era_rows'] else '-', fn, edge_bad))
            if (spec['pivot'] == 'feet' and fn not in spec.get('overlays', ()) and fn not in spec.get('airborne', ())
                    and not any(mask[ch - 1])):
                errors.append('%s %s: feet not on the bottom row' % (ERA_ROWS[r] if spec['era_rows'] else '-', fn))
        grow = spec.get('grow', ())
        for a, b in zip(grow, grow[1:]):
            lost = sum(1 for y in range(ch) for x in range(cw) if masks[a][y][x] and not masks[b][y][x])
            if lost:
                errors.append('%s -> %s: %d px disappear (frames in `grow` may only add pixels)' % (a, b, lost))
        stats = ' '.join('%s:%d' % (INV.get(k, '#%02x%02x%02x' % k), v)
                         for k, v in sorted(row_counts.items(), key=lambda kv: -kv[1]))
        notes.append('row %-5s colours %2d  %s' % (ERA_ROWS[r] if spec['era_rows'] else '-', len(row_counts), stats))
    if alphas - {0, 255}:
        errors.append('alpha values other than 0/255: %s' % sorted(alphas - {0, 255})[:8])
    return errors, notes


if __name__ == '__main__':
    args = sys.argv[1:]
    if not args or args[0] not in SHEETS:
        print('usage: python -I check_sheet.py <%s> [--png <file>] [--manifest <file>]' % '|'.join(SHEETS))
        sys.exit(2)
    sheet = args[0]
    png = args[args.index('--png') + 1] if '--png' in args else None
    man = args[args.index('--manifest') + 1] if '--manifest' in args else None
    errs, notes = check(sheet, png, man)
    for n in notes:
        print('  ' + n)
    for e in errs[:60]:
        print('ERROR ' + e)
    if len(errs) > 60:
        print('ERROR ... %d more' % (len(errs) - 60))
    print('%s: %s' % (sheet, 'CLEAN' if not errs else '%d ERRORS' % len(errs)))
    sys.exit(1 if errs else 0)
