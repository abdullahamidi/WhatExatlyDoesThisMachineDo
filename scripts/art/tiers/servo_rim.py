# Crank Servo arm (machine.servoArm, 48x48, rot 80), WP26 AD1b: lit rim on the arm's edge pixels, recolour only.
# Why (ART_AUDIT WP25 N1): the arm is iron #5a5f63 inside an ink outline, and the frame X-brace behind it is iron #3e4246 inside
# the same ink. At 1:1 in eras II and IV the two outlines merge and the arm is lost; only the base, lamp and rod read. ART_BRIEF
# lights from the upper left with a selective outline (ink on the shadow side, lighter on the lit side), so the arm's lit-side
# edge becomes iron lit #7d8286 (Director Q5). That gives the arm a light edge line against the dark brace, and the shadow-side
# ink stays.
# Method: the rule is applied per frame: the static PNG is one 48x48 frame, and each rot sheet holds 80 48x48 frames, 9 to a row.
#   - Edge pixel: an opaque pixel with a transparent 4-neighbour in the same frame. Anything outside the frame counts as
#     transparent.
#   - Lit: the edge pixel's smoothed outward normal faces the upper-left light (see LIGHT below). The light is world-fixed, so each
#     rotated frame gets its own upper-left rim, and the hub disc keeps a fixed highlight arc while it turns (PART_TIERS
#     rotating-part rule).
#   - Rim width: 1 art px. Every lit edge pixel becomes #7d8286, whatever its colour was (ink, or iron where RotSprite left a gap
#     in the outline).
# Alpha is never touched. RotSprite / make_rot.py are never re-run: the shipped frames are edited in place.
# Idempotent: the mask depends only on alpha and the colour is fixed, so a second run writes the same pixels.
# Coherent with palette_tiers.py: DERUST-FULL and POLISH map neither #7d8286 nor ink, so rerunning palette_tiers.py on the rimmed
# MK I gives these same MK II / MK III files. main() asserts this.
#   python scripts/art/tiers/servo_rim.py [--out <dir>]
# Default: rewrites the six servo arm PNGs under public/assets/machine in place. --out writes them under <dir>, keeping the
# machine-relative paths (previews).
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import tierlib as T  # noqa: E402

RIM = T.hex_rgb('#7d8286')   # ART_BRIEF iron, lit side
FW = FH = 48                 # servo arm frame (manifest machine.servoArm)
# Lit test: outward normal = Gaussian-weighted sum of the transparent offsets around the pixel (radius 3, sigma 1.25 art px), so a
# RotSprite staircase gets the normal of its whole side, not of each step (a per-step test gives a dotted rim). LIGHT = unit
# vector towards the light, upper left (screen y down). In the terminator band |facing| <= 0.2 (about +-12 deg; the arm lies
# along the light near frames 30 and 70) the up-facing side wins, so one long side keeps a whole rim.
NORMAL_R = 3                 # art px
NORMAL_SIGMA = 1.25          # art px
LIGHT = (-0.7071, -0.7071)   # ART_BRIEF: light from the upper left
TERMINATOR = 0.2             # cos of the angle to the light: |facing| <= 0.2 is the terminator band
ROT_FRAMES = 80              # manifest rotation.frames
# MK I, MK II, MK III: static PNG and rot sheet, machine-relative; the palette_tiers.py map that derives each mark from MK I.
MARKS = [
    ('era4/servo-arm.png', 'era4/rot/servo-arm-rot.png', None),
    ('tiers/servo-arm-t2.png', 'tiers/rot/servo-arm-t2-rot.png', T.DERUST_FULL),
    ('tiers/servo-arm-t3.png', 'tiers/rot/servo-arm-t3-rot.png', T.POLISH),
]


def lit_edge(op):
    """Lit edge mask of one frame (op: H x W bool, opaque)."""
    H, W = op.shape
    p = np.pad(op, NORMAL_R, constant_values=False)
    edge = np.zeros_like(op)
    nx = np.zeros((H, W))
    ny = np.zeros((H, W))
    for dy in range(-NORMAL_R, NORMAL_R + 1):
        for dx in range(-NORMAL_R, NORMAL_R + 1):
            if dx == 0 and dy == 0:
                continue
            clear = ~p[NORMAL_R + dy:NORMAL_R + dy + H, NORMAL_R + dx:NORMAL_R + dx + W]
            if abs(dx) + abs(dy) == 1:
                edge |= clear
            w = np.exp(-(dx * dx + dy * dy) / (2 * NORMAL_SIGMA ** 2))
            nx += w * dx * clear
            ny += w * dy * clear
    n = np.hypot(nx, ny)
    n[n == 0] = 1
    nx, ny = nx / n, ny / n
    facing = nx * LIGHT[0] + ny * LIGHT[1]
    return op & edge & ((facing > TERMINATOR) | ((facing >= -TERMINATOR) & (ny < 0)))


def frame_slots(shape, n):
    cols = shape[1] // FW
    return [(slice((i // cols) * FH, (i // cols + 1) * FH), slice((i % cols) * FW, (i % cols + 1) * FW)) for i in range(n)]


def rim(arr, n):
    """Returns a copy of arr (RGBA, alpha 0/255) with the lit rim on every one of its n frames."""
    out = arr.copy()
    op = arr[:, :, 3] == 255
    for sy, sx in frame_slots(arr.shape, n):
        out[sy, sx][lit_edge(op[sy, sx]), :3] = RIM
    return out


def checked(src, out, path):
    if out.shape != src.shape or not np.array_equal(out[:, :, 3], src[:, :, 3]):
        raise RuntimeError('alpha or canvas changed: ' + path)
    cols = {tuple(int(v) for v in c) for c in np.unique(out[out[:, :, 3] == 255][:, :3].reshape(-1, 3), axis=0)}
    src_cols = {tuple(int(v) for v in c) for c in np.unique(src[src[:, :, 3] == 255][:, :3].reshape(-1, 3), axis=0)}
    if cols - (T.RW_RGB | src_cols):
        raise RuntimeError('off-palette colour: ' + path)
    return out


def main():
    args = sys.argv[1:]
    out_root = os.path.abspath(args[args.index('--out') + 1]) if '--out' in args else T.MACHINE
    done = []
    for static, sheet, _m in MARKS:
        for rel, n in ((static, 1), (sheet, ROT_FRAMES)):
            src = T.load_rgba(os.path.join(T.MACHINE, rel))
            src[src[:, :, 3] == 0] = 0
            out = checked(src, rim(src, n), rel)
            done.append((rel, src, out))
    # palette_tiers.py coherence: MK n == its map applied to the rimmed MK I, frame for frame
    mk1 = {rel: out for rel, _s, out in done[:2]}
    for i, (static, sheet, m) in enumerate(MARKS[1:], start=1):
        for k, rel in enumerate((static, sheet)):
            base = mk1[MARKS[0][k]]
            if not np.array_equal(T.apply_map(base, m), done[2 * i + k][2]):
                raise RuntimeError('MK %d is not palette_tiers.py of the rimmed MK I: %s' % (i + 1, rel))
    for rel, src, out in done:
        dst = os.path.join(out_root, rel)
        b = T.png_bytes_best(out, dst)
        print('%s: %d rim px, %d B' % (rel, int((src != out).any(axis=2).sum()), b))


if __name__ == '__main__':
    main()
