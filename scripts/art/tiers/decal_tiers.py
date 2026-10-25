# Part evolution tiers, method E (PART_TIERS 5.1): static decals over rotating hosts.
# A decal does not turn, so its geometry must be rotationally symmetric (rings only: no bolts, spokes or text). Its
# shading is static light from the upper left, which is physically right on a turning wheel (PART_TIERS 2.3).
# Every decal pixel lies where the host is opaque in ALL frames of its shipped rot sheet (the ring never floats over a
# tooth gap or a spoke gap); check_gates.py verifies this per decal.
#   python scripts/art/tiers/decal_tiers.py [outRoot]
# Default outRoot: public/assets/machine/tiers. Writes decals/gear-rim.png, decals/flywheel-rim-2.png, -3.png.
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import tierlib as T  # noqa: E402


def ring_canvas(size, paint):
    """paint(d, lit) -> palette char or '.', where d = distance of the pixel centre from the canvas centre and
    lit = cosine between the radial direction and the upper-left light (+1 upper left, -1 lower right)."""
    c = (size - 1) / 2
    g = [['.'] * size for _ in range(size)]
    for y in range(size):
        for x in range(size):
            dx, dy = x - c, y - c
            d = math.hypot(dx, dy)
            lit = (-dx - dy) / (d * math.sqrt(2)) if d else 0.0
            g[y][x] = paint(d, lit)
    return g


# gearLarge (64x64, rot 140). Measured on the shipped rot sheet: rim casting d 17.5-22.0 (ink inner edge at 17.5, root
# outline at 22.5, teeth beyond). The brass hoop takes the outer half of the rim, d 20.0-22.0, so the root outline
# and the tooth gaps stay the gear's own pixels. Bevelled band: on the upper-left arc the outer ring catches the light
# and the inner ring is in shade; on the lower-right arc the reverse. #ffd27a glint arc at the upper left.
def gear_rim(d, lit):
    if 20.0 <= d < 21.0:
        return 'd' if lit > 0.0 else 'f'
    if 21.0 <= d < 22.0:
        if lit > 0.88:
            return 'C'
        return 'f' if lit > 0.0 else 'd'
    return '.'


# flywheel (96x96, rot 180). Measured: the rim is opaque in every frame for d 40.3-47.0 (inner lip 40-42.5 with ink,
# machined line ~43, tyre face 43.5-46.5 with caked dust, ink outline 46.5-47.5). The re-tyred rim covers d 40.3-47.0:
# dark inner lip, machined line, clean iron tyre face, a lit outer bevel (#a3a6a4) on the upper left and a shadow
# bevel (#1f2225) on the lower right, and the ink outline.
def flywheel_rim2(d, lit):
    if 40.3 <= d < 41.5:
        return '0' if lit > -0.3 else '1'           # inner lip: in shade except where it faces the light (lower right)
    if 41.5 <= d < 42.5:
        return '1' if lit > -0.3 else '2'
    if 42.5 <= d < 43.5:
        return '4' if lit > -0.5 else '3'           # machined line
    if 43.5 <= d < 45.5:
        return '3' if lit > 0.5 else '2'            # tyre face, lifted on the lit arc
    if 45.5 <= d < 46.5:
        if lit > 0.35:
            return '5'                               # lit arc
        if lit < -0.35:
            return '0'                               # shadow arc
        return '3' if lit >= 0 else '2'
    if 46.5 <= d < 47.0:
        return 'K'
    return '.'


# MK III: rim 2 plus a 1 px brass inlay in the machined line (the top tier's brass glint ring on a rotating part).
def flywheel_rim3(d, lit):
    if 42.5 <= d < 43.5:
        if lit > 0.9:
            return 'C'
        return 'f' if lit > -0.5 else 'd'
    return flywheel_rim2(d, lit)


DECALS = [
    ('gear-rim.png', 64, gear_rim),
    ('flywheel-rim-2.png', 96, flywheel_rim2),
    ('flywheel-rim-3.png', 96, flywheel_rim3),
]


def main():
    out_root = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else T.TIERS
    for name, size, paint in DECALS:
        dst = os.path.join(out_root, 'decals', name)
        b = T.save_grid(ring_canvas(size, paint), dst)
        print('wrote %s %d B' % (T.rel(dst), b))


if __name__ == '__main__':
    main()
