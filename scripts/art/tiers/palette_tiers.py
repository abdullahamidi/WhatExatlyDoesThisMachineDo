# Part evolution tiers, method C (PART_TIERS 5.1): exact per-pixel palette maps on rotating hosts.
# Clone of scripts/art/a17/restored.py: the map is applied to the static PNG AND to its shipped RotSprite sheet; the
# sheet is never re-rotated, so frame count, layout and the 80/140 and 180/180 ratio locks stay exactly as shipped.
#   python scripts/art/tiers/palette_tiers.py [outRoot]
# Default outRoot: public/assets/machine/tiers. Writes <stem>-t<n>.png and rot/<stem>-t<n>-rot.png.
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import tierlib as T  # noqa: E402

# Per-host maps by tier. DERUST-LIGHT / DERUST-FULL / POLISH are the PART_TIERS 2.3 maps (tierlib).
# pulley-main has no bright scale (#ad6236 #8c4a2a #c98552) for DERUST-LIGHT to knock off, which would make its MK II
# pixel-identical to MK I; it gets the PART_TIERS 2.1 MK II set instead (#6e3a22 flaking rust -> value-matched iron,
# dark #4e2a1a stains stay), so the step is real (G1).
PULLEY_MAIN_T2 = dict(T.DERUST_LIGHT, **{'#6e3a22': '#3e4246'})

HOSTS = [
    # [subdir/]stem, rotation frames, {tier: map}
    ('gear-large', 140, {2: T.DERUST_LIGHT, 3: T.POLISH}),
    ('gear-small', 80, {2: T.DERUST_LIGHT, 3: T.POLISH}),
    ('pulley-main', 140, {2: PULLEY_MAIN_T2, 3: T.POLISH}),
    ('flywheel', 180, {3: T.POLISH}),
    ('pulley-flywheel', 180, {3: T.POLISH}),
    ('pulley-crank', 80, {3: T.POLISH}),
    # AD3b, crankServo: the servo arm (era IV, rot 80); MK II REINFORCED = DERUST-FULL, MK III AS BUILT = POLISH.
    ('era4/servo-arm', 80, {2: T.DERUST_FULL, 3: T.POLISH}),
]


def main():
    out_root = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else T.TIERS
    for path, _frames, tiers in HOSTS:
        sub, stem = os.path.split(path)          # 'era4/servo-arm' -> era4/servo-arm.png + era4/rot/servo-arm-rot.png
        src = os.path.join(T.MACHINE, sub, stem + '.png')
        src_rot = os.path.join(T.MACHINE, sub, 'rot', stem + '-rot.png')
        base, base_rot = T.load_rgba(src), T.load_rgba(src_rot)
        for n, mapping in sorted(tiers.items()):
            dst = os.path.join(out_root, '%s-t%d.png' % (stem, n))
            dst_rot = os.path.join(out_root, 'rot', '%s-t%d-rot.png' % (stem, n))
            b1 = T.png_bytes_best(T.apply_map(base, mapping), dst)
            b2 = T.png_bytes_best(T.apply_map(base_rot, mapping), dst_rot)
            print('wrote %s %d B, %s %d B' % (T.rel(dst), b1, T.rel(dst_rot), b2))


if __name__ == '__main__':
    main()
