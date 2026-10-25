# Part evolution tiers: machine-checkable gates (PART_TIERS 2.2) for every shipped tier PNG.
#   python scripts/art/tiers/check_gates.py [--report <out.md>] [--g4 <g4.json>] [--tiers <dir>] [--notes <notes.md>]
# --notes appends a markdown file (G4 method, G5 composite verdicts) to the report.
# Per variant:
#   G3 contract: canvas = MK I canvas; rot sheets: same size AND identical alpha (frame count / layout untouched);
#      alpha in {0, 255}; palette = Rust Wasteland + the extension colours the MK I base already uses (decals: Rust
#      Wasteland only); reserved zones gain no new opaque pixel; optional 'backed_by' (new pixels must lie over an
#      opaque pixel of the sprite behind).
#   G2 identity: every opaque MK I pixel is still opaque.
#   G1 step: at least 4 px differ from the previous tier; rust kept from MK I (same colour, same place, outside identity
#      marks) drops >= 30 % at MK II where the rule applies, and is 0 where the host spec says rust 0.
#   Pulse frames (t5b / t3b): same alpha as their tier, only warm accent pixels change, each one ramp step dimmer.
#   Decals: alpha mask symmetric under 90 deg rotations and mirrors; every pixel over an opaque host pixel in ALL frames
#      of the host rot sheet and in its static PNG.
#   G4 craft (pixelart_workbench lint/score) cannot run here; --g4 merges the recorded results into the report.
# Exit code 1 when any gate fails.
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import tierlib as T  # noqa: E402

M = T.MACHINE


def rect(x0, y0, x1, y1):
    return (x0, y0, x1, y1)


# host: base file (MK I), tiers {n: file}, pulse {n: file}, rot (base rot sheet, frames, frame size) for rot tiers,
# rust: 'drop' (MK II >= 30 % below MK I), rust0: tiers that must keep 0 MK I rust, identity: rects excluded from rust,
# reserved: rects that may gain no new opaque pixel, backed_by: (sprite, dx, dy), frames: (frame width, count) of a
# frame sheet (rects are frame-relative and apply to every frame; every frame must carry the tier change; a pulse frame
# must dim the same frame-relative px in every frame), keep: rects whose px must equal MK I in every tier (links attach
# there), extra: hex colours the host may add on top of Rust Wasteland + its MK I colours (era extension named by the
# spec), g2_waived: the procedural spire wave redraws its waveform per mode (PART_TIERS 2.3, method D): lost MK I px are
# reported, not failed; its reserved columns keep every frame inside the shipped rod column.
HOSTS = [
    dict(name='worn-motor', base='worn-motor.png', tiers={2: 'worn-motor-t2.png', 3: 'worn-motor-t3.png',
         4: 'worn-motor-t4.png', 5: 'worn-motor-t5.png'}, pulse={5: 'worn-motor-t5b.png'}, rust='drop', rust0=[3],
         identity=[rect(24, 18, 37, 25)], reserved=[rect(23, 0, 43, 7), rect(52, 0, 63, 47), rect(0, 41, 63, 47)]),
    dict(name='motor-plinth', base='motor-plinth.png', tiers={2: 'motor-plinth-t2.png', 3: 'motor-plinth-t3.png',
         4: 'motor-plinth-t4.png', 5: 'motor-plinth-t5.png'}, rust='drop', rust0=[3, 4, 5]),
    dict(name='gear-large', base='gear-large.png', tiers={2: 'gear-large-t2.png', 3: 'gear-large-t3.png'},
         rot=('rot/gear-large-rot.png', 140, 64), rust='drop', rust0=[3]),
    dict(name='gear-small', base='gear-small.png', tiers={2: 'gear-small-t2.png', 3: 'gear-small-t3.png'},
         rot=('rot/gear-small-rot.png', 80, 40), rust='drop', rust0=[3]),
    dict(name='pulley-main', base='pulley-main.png', tiers={2: 'pulley-main-t2.png', 3: 'pulley-main-t3.png'},
         rot=('rot/pulley-main-rot.png', 140, 24), rust='drop', rust0=[3]),
    dict(name='flywheel', base='flywheel.png', tiers={3: 'flywheel-t3.png'}, rot=('rot/flywheel-rot.png', 180, 96),
         rust0=[3]),
    dict(name='pulley-flywheel', base='pulley-flywheel.png', tiers={3: 'pulley-flywheel-t3.png'},
         rot=('rot/pulley-flywheel-rot.png', 180, 28), rust0=[3]),
    dict(name='pulley-crank', base='pulley-crank.png', tiers={3: 'pulley-crank-t3.png'},
         rot=('rot/pulley-crank-rot.png', 80, 32), rust0=[3]),
    dict(name='flywheel-pedestal', base='flywheel-pedestal.png', tiers={2: 'flywheel-pedestal-t2.png',
         3: 'flywheel-pedestal-t3.png'}, pulse={3: 'flywheel-pedestal-t3b.png'}, rust='drop', rust0=[2, 3],
         reserved=[rect(0, 0, 47, 38)]),
    dict(name='coils-1', base='era2/coils-1.png', tiers={2: 'coils-1-t2.png'}),
    dict(name='coils-3', base='era2/coils-3.png', tiers={5: 'coils-3-t5.png'},
         backed_by=('era2/generator.png', 16, 12)),
    dict(name='motor-retrofit', base='era2/motor-retrofit.png', tiers={2: 'motor-retrofit-t2.png',
         3: 'motor-retrofit-t3.png', 4: 'motor-retrofit-t4.png', 5: 'motor-retrofit-t5.png'},
         pulse={5: 'motor-retrofit-t5b.png'}, rust='drop', rust0=[2, 3, 4, 5], identity=[rect(22, 13, 27, 15)],
         reserved=[rect(0, 0, 12, 4)]),
    # P0 PixelLab hosts (AD2w): the yoke's plunger rods run behind the block at x18-21 / 46-49 / 74-77 down to row 45;
    # the transformer's cables leave the left bushing tip down-left and the right tip up-right; its bushings (copper
    # terminals + porcelain sheds shaded with #4e2a1a) are identity marks, not rust.
    dict(name='piston-block', base='piston-block.png', tiers={2: 'piston-block-t2.png', 3: 'piston-block-t3.png',
         4: 'piston-block-t4.png', 5: 'piston-block-t5.png'}, pulse={5: 'piston-block-t5b.png'}, rust='drop',
         rust0=[3, 4, 5], reserved=[rect(18, 36, 21, 45), rect(46, 36, 49, 45), rect(74, 36, 77, 45)]),
    dict(name='transformer', base='era2/transformer.png', tiers={2: 'transformer-t2.png', 3: 'transformer-t3.png',
         4: 'transformer-t4.png', 5: 'transformer-t5.png'}, pulse={5: 'transformer-t5b.png'}, rust='drop',
         rust0=[3, 4, 5], identity=[rect(17, 3, 22, 18), rect(31, 3, 36, 18), rect(45, 3, 50, 18)],
         reserved=[rect(0, 0, 15, 20), rect(49, 0, 63, 4)]),
    # P1 batch A (AD3a). Fire glows: 4-frame sheets over the boiler's fire door (MK II on glow 1, MK V on glow 3; the
    # steam-white core is ART_ERA3's steam colour). Heater: copper bars = identity, the tie insulator (x50-55, rows 0-5)
    # stays, new px (straps / header / bus bar / valve) lie over the boiler. Condenser: the hotwell nozzle stays.
    # Coil ring: copper = identity, 4 frames. Bellows: 4 frames, the hide is rust-ramp identity, the nozzle tip stays.
    # Exciter feed: the cable lug rows stay, the copper strap is identity.
    dict(name='firebox-1', base='era3/firebox-1.png', tiers={2: 'firebox-1-t2.png'}, frames=(24, 4)),
    dict(name='firebox-3', base='era3/firebox-3.png', tiers={5: 'firebox-3-t5.png'}, frames=(24, 4),
         extra=['#e8e0cc']),
    dict(name='induction-heater', base='era3/induction-heater.png', tiers={2: 'induction-heater-t2.png',
         3: 'induction-heater-t3.png', 4: 'induction-heater-t4.png', 5: 'induction-heater-t5.png'},
         pulse={5: 'induction-heater-t5b.png'}, keep=[rect(50, 0, 55, 5)], reserved=[rect(48, 0, 55, 5)],
         backed_by=('era3/boiler.png', 76, 20)),
    dict(name='condenser', base='era3/condenser.png', tiers={2: 'condenser-t2.png', 3: 'condenser-t3.png',
         4: 'condenser-t4.png', 5: 'condenser-t5.png'}, pulse={5: 'condenser-t5b.png'}, rust='drop',
         rust0=[2, 3, 4, 5], keep=[rect(76, 7, 79, 13)], reserved=[rect(76, 0, 79, 13)],
         extra=['#2f5a62', '#5fa8b4', '#bff0ec']),
    dict(name='coil-ring-1', base='era4/coil-ring-1.png', tiers={2: 'coil-ring-1-t2.png'}, frames=(62, 4)),
    dict(name='bellows', base='legacy/bellows.png', tiers={2: 'bellows-t2.png', 3: 'bellows-t3.png'},
         pulse={3: 'bellows-t3b.png'}, frames=(60, 4), keep=[rect(59, 15, 59, 18)],
         backed_by=('era3/boiler.png', 32, 68)),
    dict(name='exciter-feed', base='legacy/exciter-feed.png', tiers={2: 'exciter-feed-t2.png',
         3: 'exciter-feed-t3.png'}, pulse={3: 'exciter-feed-t3b.png'}, rust='drop', rust0=[2, 3],
         identity=[rect(0, 21, 5, 24)], keep=[rect(0, 0, 15, 1)], reserved=[rect(0, 0, 15, 1)]),
    # P1 batch B (AD3b). Calliope: the copper whistles are identity (W1 / W2 / W3 rects); the three existing ports
    # (valve bottoms + stems on the manifold's branch stubs) gain no pixel. Servo base: plain static host. Servo arm:
    # rot host (palette maps only, so the coupling-rod pin boss keeps its pixels). Spire wave: 8 frames, procedural.
    dict(name='calliope', base='era4/calliope.png', tiers={2: 'calliope-t2.png', 3: 'calliope-t3.png',
         4: 'calliope-t4.png', 5: 'calliope-t5.png'}, pulse={5: 'calliope-t5b.png'}, rust='drop', rust0=[2, 3, 4, 5],
         identity=[rect(2, 11, 14, 32), rect(29, 6, 41, 32), rect(57, 1, 70, 32)],
         reserved=[rect(0, 37, 14, 39), rect(28, 37, 41, 39), rect(58, 37, 71, 39)]),
    # servo base: the MK III brass inspection cover (x4-7, rows 5-14) is rust-ramp brass, not rust (PART_TIERS 2.2)
    dict(name='servo-base', base='era4/servo-base.png', tiers={2: 'servo-base-t2.png', 3: 'servo-base-t3.png'},
         pulse={3: 'servo-base-t3b.png'}, rust='drop', rust0=[2, 3], identity=[rect(4, 5, 7, 14)],
         keep=[rect(17, 0, 20, 2)]),
    dict(name='servo-arm', base='era4/servo-arm.png', tiers={2: 'servo-arm-t2.png', 3: 'servo-arm-t3.png'},
         rot=('era4/rot/servo-arm-rot.png', 80, 48), rust='drop', rust0=[2, 3], reserved=[rect(20, 0, 27, 8)]),
    dict(name='spire-wave', base='era4/spire-wave.png', tiers={2: 'spire-wave-t2.png', 3: 'spire-wave-t3.png',
         4: 'spire-wave-t4.png', 5: 'spire-wave-t5.png'}, frames=(16, 8), g2_waived=True,
         reserved=[rect(0, 0, 1, 269), rect(14, 0, 15, 269)]),
    # P2 (AD4a), legacy feeds of Era V. Backfeed terminal: the copper jumper is identity (rust ramp = copper); the
    # violet lead-in bushing and the cable lug cap stay; rows 24-27 (lug + the cable leaving it down-right) gain no px.
    # Steam lance: the inlet pipe (link at texture (8, 32)) stays; the lance puff start (steamFx at texture (16, 29),
    # frame 0 covers x12-19 rows 25-32) gains no px.
    dict(name='backfeed-terminal', base='legacy/backfeed-terminal.png', tiers={2: 'backfeed-terminal-t2.png',
         3: 'backfeed-terminal-t3.png'}, pulse={3: 'backfeed-terminal-t3b.png'}, rust='drop', rust0=[2, 3],
         identity=[rect(11, 3, 15, 23)], keep=[rect(12, 1, 12, 1), rect(6, 25, 9, 27)],
         reserved=[rect(0, 24, 15, 27)]),
    dict(name='steam-lance', base='legacy/steam-lance.png', tiers={2: 'steam-lance-t2.png', 3: 'steam-lance-t3.png'},
         pulse={3: 'steam-lance-t3b.png'}, rust='drop', rust0=[2, 3], keep=[rect(4, 27, 11, 31)],
         reserved=[rect(12, 24, 15, 31)]),
]
DECALS = [
    dict(file='decals/gear-rim.png', size=64, hosts=[('rot/gear-large-rot.png', 140, 'gear-large.png')], track='gearRatio',
         tier=3),
    dict(file='decals/flywheel-rim-2.png', size=96, hosts=[('rot/flywheel-rot.png', 180, 'flywheel.png')],
         track='flywheel', tier=2),
    dict(file='decals/flywheel-rim-3.png', size=96, hosts=[('rot/flywheel-rot.png', 180, 'flywheel.png')],
         track='flywheel', tier=3),
]
# G1 step is a property of the track's tier (PART_TIERS 2.2): px changed on the static art of all its hosts plus the
# decal px it adds must reach 4 (secondary hosts such as the plinth may change less on their own).
TRACK_OF = {'worn-motor': 'motorTuning', 'motor-plinth': 'motorTuning', 'gear-large': 'gearRatio',
            'gear-small': 'gearRatio', 'pulley-main': 'gearRatio', 'flywheel': 'flywheel', 'pulley-flywheel': 'flywheel',
            'pulley-crank': 'flywheel', 'flywheel-pedestal': 'flywheel', 'coils-1': 'copperWinding',
            'coils-3': 'copperWinding', 'motor-retrofit': 'motorRetrofit', 'piston-block': 'improvedPistons',
            'transformer': 'transformer', 'firebox-1': 'firebox', 'firebox-3': 'firebox',
            'induction-heater': 'inductionHeater', 'condenser': 'condenser', 'coil-ring-1': 'harmonicCoil',
            'bellows': 'bellowsDrive', 'exciter-feed': 'gridExciter', 'calliope': 'pressureResonator',
            'servo-base': 'crankServo', 'servo-arm': 'crankServo', 'spire-wave': 'standingWave',
            'backfeed-terminal': 'mainsBackfeed', 'steam-lance': 'steamLance'}
WARM_DIM = {T.hex_rgb('#ffd27a'): T.hex_rgb('#f0a848'), T.hex_rgb('#f0a848'): T.hex_rgb('#d9822b'),
            T.hex_rgb('#d9822b'): T.hex_rgb('#8c4a2a')}


def load(path):
    """RGBA array with transparent pixels normalised to (0, 0, 0, 0), so only visible pixels are compared."""
    a = T.load_rgba(path)
    a[a[:, :, 3] == 0] = 0
    return a


def colours(a):
    return {tuple(int(v) for v in c) for c in np.unique(a[a[:, :, 3] == 255][:, :3].reshape(-1, 3), axis=0)}


def in_rects(rects, shape, frames=None):
    """Mask of rects; with frames=(fw, n) the rects are frame-relative and repeated in every frame."""
    m = np.zeros(shape[:2], bool)
    offs = [i * frames[0] for i in range(frames[1])] if frames else [0]
    for ox in offs:
        for (x0, y0, x1, y1) in rects or []:
            m[y0:y1 + 1, ox + x0:ox + x1 + 1] = True
    return m


def frame_slices(h, shape):
    fr = h.get('frames')
    if not fr:
        return [slice(0, shape[1])]
    return [slice(i * fr[0], (i + 1) * fr[0]) for i in range(fr[1])]


def rust_mask(a):
    m = np.zeros(a.shape[:2], bool)
    for c in T.RUST_RGB:
        m |= (a[:, :, 0] == c[0]) & (a[:, :, 1] == c[1]) & (a[:, :, 2] == c[2]) & (a[:, :, 3] == 255)
    return m


def kept_rust(base, var, ident):
    same = (base == var).all(axis=2)
    return int((rust_mask(base) & same & ~ident).sum())


def check_variant(h, base, var, allowed, n, prev, rot_alpha_ref=None):
    """Returns (row dict, list of failures)."""
    fails = []
    row = {'tier': n}
    if var.shape != base.shape:
        fails.append('G3 canvas %s != %s' % (var.shape[:2], base.shape[:2]))
        return row, fails
    al = set(np.unique(var[:, :, 3]).tolist())
    if not al <= {0, 255}:
        fails.append('G3 alpha %s' % sorted(al))
    off = colours(var) - allowed
    if off:
        fails.append('G3 off-palette %d colours' % len(off))
    row['colours'] = len(colours(var))
    if rot_alpha_ref is not None and not np.array_equal(var[:, :, 3], rot_alpha_ref):
        fails.append('G3 rot sheet alpha differs from the shipped sheet (layout)')
    lost = int(((base[:, :, 3] == 255) & (var[:, :, 3] == 0)).sum())
    row['lost'] = lost
    if lost and not h.get('g2_waived'):
        fails.append('G2 %d MK I px lost' % lost)
    new = (base[:, :, 3] == 0) & (var[:, :, 3] == 255)
    row['new_px'] = int(new.sum())
    res = in_rects(h.get('reserved'), var.shape, h.get('frames'))
    if (new & res).any():
        fails.append('G3 %d new px in reserved zones' % int((new & res).sum()))
    keep = in_rects(h.get('keep'), var.shape, h.get('frames'))
    moved = int((keep & (base != var).any(axis=2)).sum())
    if moved:
        fails.append('G3 %d px changed in keep zones (link attach points)' % moved)
    if h.get('backed_by'):
        spr, dx, dy = h['backed_by']
        back = load(os.path.join(M, spr))
        ys, xs = np.nonzero(new)
        if h.get('frames'):
            xs = xs % h['frames'][0]             # frame-relative: every frame sits at the same place
        bad = sum(1 for y, x in zip(ys, xs) if not (0 <= y + dy < back.shape[0] and 0 <= x + dx < back.shape[1]
                                                    and back[y + dy, x + dx, 3] == 255))
        row['unbacked'] = bad
        if bad:
            fails.append('G3 %d new px float (not over %s)' % (bad, spr))
    diff = (prev != var).any(axis=2)
    changed = int(diff.sum())
    row['changed_vs_prev'] = changed
    if h.get('frames'):
        per = [int(diff[:, sl].sum()) for sl in frame_slices(h, var.shape)]
        row['per_frame'] = '/'.join(str(v) for v in per)
        if min(per) < 1:
            fails.append('G1 a frame carries no change (%s)' % row['per_frame'])
    ident = in_rects(h.get('identity'), var.shape, h.get('frames'))
    r1 = int((rust_mask(base) & ~ident).sum())
    rk = kept_rust(base, var, ident)
    row['rust_mk1'] = r1
    row['rust_kept'] = rk
    warm = 0
    for c in ('#ffd27a', '#f0a848', '#d9822b'):
        rgb = T.hex_rgb(c)
        is_v = (var[:, :, :3] == rgb).all(axis=2) & (var[:, :, 3] == 255)
        was_b = (base[:, :, :3] == rgb).all(axis=2) & (base[:, :, 3] == 255)
        warm += int((is_v & ~was_b).sum())
    row['new_warm'] = warm
    if h.get('rust') == 'drop' and n == min(h['tiers']) and r1:
        drop = 1 - rk / r1
        row['rust_drop'] = round(drop * 100, 1)
        if drop < 0.30:
            fails.append('G1 rust drop %.1f %% < 30 %%' % (drop * 100))
    if n in h.get('rust0', []) and rk:
        fails.append('G1 %d MK I rust px kept (spec: 0)' % rk)
    return row, fails


def check_pulse(top, pulse, h=None):
    fails = []
    if pulse.shape != top.shape or not np.array_equal(pulse[:, :, 3], top[:, :, 3]):
        return ['pulse alpha / canvas differs from its tier']
    diff = (pulse != top).any(axis=2)
    if h is not None and h.get('frames'):
        masks = [diff[:, sl] for sl in frame_slices(h, top.shape)]
        if not all(np.array_equal(masks[0], m) for m in masks[1:]):
            fails.append('pulse px differ between frames (the lamp must sit at the same place in every frame)')
    for y, x in zip(*np.nonzero(diff)):
        a, b = tuple(int(v) for v in top[y, x, :3]), tuple(int(v) for v in pulse[y, x, :3])
        if WARM_DIM.get(a) != b:
            fails.append('pulse px (%d,%d) %s -> %s is not one ramp step dimmer' % (x, y, a, b))
            break
    if not diff.any():
        fails.append('pulse frame identical to its tier')
    return fails


def symmetric(alpha):
    return all(np.array_equal(alpha, t) for t in (np.rot90(alpha, 1), np.rot90(alpha, 2), np.rot90(alpha, 3),
                                                   alpha[:, ::-1], alpha[::-1, :]))


def main():
    args = sys.argv[1:]
    opt = {k: args[i + 1] for i, k in enumerate(args) if k.startswith('--') and i + 1 < len(args)}
    tiers_dir = os.path.abspath(opt.get('--tiers', T.TIERS))
    g4 = json.load(open(opt['--g4'])) if '--g4' in opt and os.path.exists(opt['--g4']) else {}
    rows, all_fails, files = [], [], []
    step = {}
    for h in HOSTS:
        base = load(os.path.join(M, h['base']))
        allowed = T.RW_RGB | colours(base) | {T.hex_rgb(c) for c in h.get('extra', [])}
        prev = base
        for n in sorted(h['tiers']):
            f = h['tiers'][n]
            path = os.path.join(tiers_dir, f)
            if not os.path.exists(path):
                all_fails.append('%s: missing' % f)
                continue
            var = load(path)
            files.append(path)
            row, fails = check_variant(h, base, var, allowed, n, prev)
            row['file'] = f
            key = (TRACK_OF[h['name']], n)
            step[key] = step.get(key, 0) + row.get('changed_vs_prev', 0)
            rows.append((row, fails))
            all_fails += ['%s: %s' % (f, x) for x in fails]
            if 'rot' in h:
                rsrc, frames, fw = h['rot']
                rbase = load(os.path.join(M, rsrc))
                rf = 'rot/%s-t%d-rot.png' % (h['name'], n)
                rpath = os.path.join(tiers_dir, rf)
                if not os.path.exists(rpath):
                    all_fails.append('%s: missing' % rf)
                else:
                    rvar = load(rpath)
                    files.append(rpath)
                    rprev = rbase if n == min(h['tiers']) else load(
                        os.path.join(tiers_dir, 'rot/%s-t%d-rot.png' % (h['name'], max(k for k in h['tiers'] if k < n))))
                    rrow, rfails = check_variant(dict(h, reserved=None), rbase, rvar, T.RW_RGB | colours(rbase), n,
                                                 rprev, rot_alpha_ref=rbase[:, :, 3])
                    rrow['file'] = rf
                    rrow['frames'] = '%d x %dpx, %dx%d' % (frames, fw, rvar.shape[1], rvar.shape[0])
                    rows.append((rrow, rfails))
                    all_fails += ['%s: %s' % (rf, x) for x in rfails]
            prev = var
        for n, pf in sorted(h.get('pulse', {}).items()):
            path = os.path.join(tiers_dir, pf)
            if not os.path.exists(path):
                all_fails.append('%s: missing' % pf)
                continue
            files.append(path)
            top = load(os.path.join(tiers_dir, h['tiers'][n]))
            pv = load(path)
            pfails = check_pulse(top, pv, h)
            prow, vfails = check_variant(h, base, pv, allowed, n, top)
            prow['file'] = pf
            vfails = [x for x in vfails if not x.startswith('G1')]   # a pulse frame is a lamp step of its tier (checked above)
            rows.append((prow, pfails + vfails))
            all_fails += ['%s: %s' % (pf, x) for x in pfails + vfails]
    for d in DECALS:
        path = os.path.join(tiers_dir, d['file'])
        if not os.path.exists(path):
            all_fails.append('%s: missing' % d['file'])
            continue
        files.append(path)
        a = load(path)
        fails = []
        if a.shape[:2] != (d['size'], d['size']):
            fails.append('G3 canvas %s' % (a.shape[:2],))
        if not set(np.unique(a[:, :, 3]).tolist()) <= {0, 255}:
            fails.append('G3 alpha')
        if colours(a) - T.RW_RGB:
            fails.append('G3 off-palette')
        if not symmetric(a[:, :, 3] == 255):
            fails.append('decal alpha mask not rotationally symmetric')
        op = a[:, :, 3] == 255
        for rsrc, frames, static in d['hosts']:
            fr = T.frames_of(load(os.path.join(M, rsrc)), d['size'], d['size'], frames)
            allop = np.all([f[:, :, 3] == 255 for f in fr], axis=0) & (load(os.path.join(M, static))[:, :, 3] == 255)
            out = int((op & ~allop).sum())
            if out:
                fails.append('%d decal px outside the host in some frame of %s' % (out, rsrc))
        row = {'file': d['file'], 'tier': 'decal t%d' % d['tier'], 'colours': len(colours(a)), 'new_px': int(op.sum())}
        rows.append((row, fails))
        all_fails += ['%s: %s' % (d['file'], x) for x in fails]
        key = (d['track'], d['tier'])
        step[key] = step.get(key, 0) + int(op.sum())
    step_lines = []
    for (track, n), px in sorted(step.items()):
        ok = px >= 4
        step_lines.append('| %s | MK %s | %d | %s |' % (track, ['I', 'II', 'III', 'IV', 'V'][n - 1], px, 'PASS' if ok else 'FAIL'))
        if not ok:
            all_fails.append('%s MK %d: G1 track step only %d px' % (track, n, px))

    total = sum(os.path.getsize(f) for f in files)
    lines = ['# Tier gates (check_gates.py)', '',
             'Gates G1-G3 + pulse + decal rules are machine-checked; G4 comes from pixelart_workbench (lint / score), '
             'G5 from the in-game composites.', '',
             '| file | tier | bytes | colours | changed vs prev (per frame) | new px | lost (G2) | rust MK I | rust kept | drop % | new warm | G4 lint / score (MK I) | result |',
             '|---|---|---|---|---|---|---|---|---|---|---|---|---|']
    for row, fails in rows:
        f = row['file']
        b = os.path.getsize(os.path.join(tiers_dir, f))
        g = g4.get(f)
        gs = ('%s / %s (%s)' % (g.get('lint'), g.get('score'), g.get('base_score', '-'))) if g else '-'
        if g and isinstance(g.get('score'), (int, float)):
            if g.get('lint') not in (0, '0') or (isinstance(g.get('base_score'), (int, float))
                                                 and g['score'] < g['base_score'] - 3):
                fails = fails + ['G4 lint %s / score %s vs MK I %s' % (g.get('lint'), g['score'], g.get('base_score'))]
                all_fails.append('%s: G4' % f)
        lines.append('| %s | %s | %d | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s |' % (
            f, row.get('tier'), b, row.get('colours', '-'),
            '%s%s' % (row.get('changed_vs_prev', '-'), ' (%s)' % row['per_frame'] if 'per_frame' in row else ''),
            row.get('new_px', '-'),
            row.get('lost', '-'), row.get('rust_mk1', '-'), row.get('rust_kept', '-'), row.get('rust_drop', '-'),
            row.get('new_warm', '-'), gs, 'PASS' if not fails else 'FAIL: ' + '; '.join(fails)))
    lines += ['', '## G1 step per track tier (static px changed on all hosts + decal px)', '',
              '| track | tier | px | result |', '|---|---|---|---|'] + step_lines
    lines += ['', 'Files: %d. Total bytes: %d (%.1f KB) of the 1200 KB budget for all tier PNGs.' % (
        len(files), total, total / 1024), '', 'Failures: %d' % len(all_fails)] + ['- ' + x for x in all_fails]
    if '--notes' in opt:
        lines += [''] + open(opt['--notes'], encoding='utf-8').read().rstrip('\r\n').splitlines()
    text = '\n'.join(lines) + '\n'
    if '--report' in opt:
        os.makedirs(os.path.dirname(os.path.abspath(opt['--report'])), exist_ok=True)
        open(opt['--report'], 'w', encoding='utf-8').write(text)
    print('files %d, bytes %d, failures %d' % (len(files), total, len(all_fails)))
    for x in all_fails:
        print('FAIL', x)
    sys.exit(1 if all_fails else 0)


if __name__ == '__main__':
    main()
