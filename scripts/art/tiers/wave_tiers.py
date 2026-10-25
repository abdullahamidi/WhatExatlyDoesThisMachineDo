# Part evolution tiers, method D (procedural, exact): standingWave (5 tiers), spireWave (machine.spireWave, 8 frames of
# 16x270, bottom origin on the spire rod seat, layer mid over the tower's centre rod column).
# The shipped sheet (MK I) is itself a generator output: it matches, on 2139 of 2144 rod rows (the 5 others are exact
# .5 rounding ties), a standing wave of harmonic mode 3 drawn as
#   rod  : 2 px 'IH' (#cfe8d6 lit left, #7fae96) displaced d = -A_seg * sin(3 pi (y + 0.5) / 270) * sin(2 pi f / 8)
#   dots : envelope dots #3f5e52 on even rows at +-round(A_seg * |sin|) when that is >= 2 (static in every frame)
#   nodes: collar 'HHIIHH' (x5-10) on the interior node rows 90 and 180
#   A_seg = 4 on the top segment (the tower is narrowest there), 5 below; ends (rows 0 / 270) are nodes, no collar.
# MK I is therefore mode 3 (3 antinodes, interior nodes at rows 90 / 180). MK II..V are harmonic modes n = 4, 5, 6, 7
# (4 / 5 / 6 / 7 antinodes): every tier shows one node more than the tier before, and MK II already more than MK I.
# (An earlier cut shipped modes 2..5: MK II then had FEWER nodes than MK I and MK III was MK I again at a lower swing,
# which read as a downgrade and broke the physics-true cue "higher mode = more nodes"; PART_TIERS 2.3 names modes 2-5,
# this deviation needs the Director's sign-off.) All tiers are drawn by the same rules:
#   - node rows are exact integers: N_k = floor(k * 270 / n + 0.5) for k <= n / 2, mirrored below the middle
#     (n = 4: 0 / 68 / 135 / 202 / 270; n = 7: 0 / 39 / 77 / 116 / 154 / 193 / 231 / 270), so every collar sits on a
#     whole row and the rod is exactly centred there;
#   - inside segment k the rod follows -(-1)^k * A_n * sin(pi * (y - N_k) / (N_k+1 - N_k)) * sin(2 pi f / 8);
#     the time phase is the shipped sheet's (frames 0 / 4 straight, 2 / 6 at full swing), so the frame index the
#     animator keeps across a texture swap stays on the same point of the cycle;
#   - a 1-row jag (a swing peak landing exactly on a .5 rounding tie) takes its neighbours' value (modes 4-7 hit no
#     tie; the rule stays as a guard);
#   - amplitude scales with 1 / sqrt(n) from the shipped sheet's widest swing (mode 3, A 5): A_n = 5 * sqrt(3 / n)
#     (4: 4.33, 5: 3.87, 6: 3.54, 7: 3.27), so every tier stays inside the shipped horizontal envelope (x2-13);
#   - same palette (#cfe8d6 / #7fae96 / #3f5e52), same canvas, 8 frames, alpha 0/255.
# G2 exception (by design, PART_TIERS 2.3 "procedural"): the waveform and the collars move with the mode, so MK I rod
# pixels do not all stay opaque. Canvas, frame count, palette, alpha and the rod column hold: every frame of every tier
# stays strictly inside the spire tower's legs (checked against spire-tower.png at the real offsets) and inside the
# shipped x2-13 envelope.
#   python scripts/art/tiers/wave_tiers.py [outRoot]
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import tierlib as T  # noqa: E402

L, FW, FRAMES = 270, 16, 8
A_MAX = 5.0                 # the shipped sheet's widest swing (rows 90-270): rod x2-3 / x12-13, dots x2 / x13
ENVELOPE = (2, 13)          # shipped opaque x range of the sheet
TOWER_DX, TOWER_DY = 32, 18  # spire-wave px (x, y) sits over spire-tower px (x + 32, y + 18) (both bottom-centred)


def rnd(v):
    """Round half away from zero (symmetric for +-v, so frames f and f + 4 mirror exactly)."""
    return int(math.floor(abs(v) + 0.5)) * (1 if v >= 0 else -1)


def node_rows(n):
    half = [int(math.floor(k * L / n + 0.5)) for k in range(n // 2 + 1)]
    rows = {k: half[k] for k in range(n // 2 + 1)}
    for k in range(n // 2 + 1, n + 1):
        rows[k] = L - rows[n - k]
    return [rows[k] for k in range(n + 1)]


def amplitude(n):
    return A_MAX * math.sqrt(3.0 / n)


def despike(ds):
    """A 1-row jag (a row that differs from both neighbours while they agree) becomes its neighbours' value: the peak
    of a swing that lands exactly on a .5 tie (mode 3 at A 5: 5 * sin 30 deg = 2.5) would otherwise poke out by 1 px."""
    out = ds[:]
    for y in range(1, len(ds) - 1):
        if ds[y - 1] == ds[y + 1] != ds[y]:
            out[y] = ds[y - 1]
    return out


def mode_sheet(n):
    nodes = node_rows(n)
    a = amplitude(n)
    g = [['.'] * (FW * FRAMES) for _ in range(L)]
    seg = []                       # (y, sign, u) per row
    for k in range(n):
        y0, y1 = nodes[k], nodes[k + 1]
        for y in range(y0, y1):
            seg.append((y, -1 if k % 2 == 0 else 1, math.sin(math.pi * (y - y0) / (y1 - y0))))
    for f in range(FRAMES):
        s = math.sin(2 * math.pi * f / FRAMES)
        ox = f * FW
        for y, _sign, u in seg:
            e = rnd(a * abs(u))
            if y % 2 == 0 and e >= 2:
                g[y][ox + 7 - e] = 'G'
                g[y][ox + 8 + e] = 'G'
        ds = despike([rnd(sign * a * u * s) for _y, sign, u in seg])
        for (y, _sign, _u), d in zip(seg, ds):
            g[y][ox + 7 + d] = 'I'
            g[y][ox + 8 + d] = 'H'
        for y in nodes[1:-1]:
            T.put(g, ox + 5, y, 'HHIIHH')
    return g, nodes


def tower_bounds():
    """Per wave row: the inner x range (wave coords) between the spire tower's leg outlines."""
    tower = T.load_grid(os.path.join(T.MACHINE, 'era4', 'spire-tower.png'))
    out = []
    for y in range(L):
        row = tower[y + TOWER_DY]
        cx = 7 + TOWER_DX
        lo = next(x for x in range(cx, -1, -1) if row[x] == 'K')
        hi = next(x for x in range(cx + 1, len(row)) if row[x] == 'K')
        out.append((lo - TOWER_DX + 1, hi - TOWER_DX - 1))
    return out


def check(g, n, bounds):
    for f in range(FRAMES):
        rows = [''.join(g[y][f * FW:(f + 1) * FW]) for y in range(L)]
        xs = [-1 if 'HHIIHH' in r else r.find('IH') for r in rows]     # collar rows are skipped
        for y in range(1, L - 1):
            if xs[y - 1] == xs[y + 1] != xs[y] and min(xs[y - 1:y + 2]) >= 0:
                raise RuntimeError('mode %d frame %d row %d: 1-row jag in the rod' % (n, f, y))
    for y in range(L):
        for f in range(FRAMES):
            xs = [x for x in range(FW) if g[y][f * FW + x] != '.']
            if not xs:
                raise RuntimeError('mode %d frame %d row %d empty' % (n, f, y))
            if min(xs) < max(ENVELOPE[0], bounds[y][0]) or max(xs) > min(ENVELOPE[1], bounds[y][1]):
                raise RuntimeError('mode %d frame %d row %d leaves the rod column: %s vs %s' % (n, f, y, xs, bounds[y]))


SHEETS = {}
for _n in (4, 5, 6, 7):
    SHEETS[_n] = mode_sheet(_n)


def main():
    out_root = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else T.TIERS
    bounds = tower_bounds()
    for tier, n in ((2, 4), (3, 5), (4, 6), (5, 7)):
        g, nodes = SHEETS[n]
        check(g, n, bounds)
        dst = os.path.join(out_root, 'spire-wave-t%d.png' % tier)
        print('wrote %s %d B (mode %d, A %.2f, nodes %s)' % (T.rel(dst), T.save_grid(g, dst), n, amplitude(n), nodes))


if __name__ == '__main__':
    main()
