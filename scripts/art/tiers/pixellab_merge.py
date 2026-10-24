# Part evolution tiers, method B (PART_TIERS 5.1): bring a PixelLab edit_image result back under the house rules.
# A generation is NEVER shipped raw. Steps per frame:
#   1. snap: alpha cut at 128 -> {0, 255}, every opaque px -> nearest colour of the host's locked palette (Rust Wasteland
#      + the extension colours its MK I already uses)
#   2. silhouette lock: the alpha mask of the hand-blocked tier (method A) wins everywhere (G2 identity, G3 reserved zones)
#   3. merge: snapped generated colours are taken ONLY inside the accept rectangles (the new geometry of that tier, the
#      Art Director's call after looking); everywhere else the hand-blocked pixels stay
#   4. ink lock: ink (#14110f) px of the block-in stay ink, and the merge never creates new ink inside a rectangle
#      (outlines are hand-drawn)
#   python scripts/art/tiers/pixellab_merge.py report <blockin.png> <gen.png> <base_mk1.png> <out_prefix>
#       writes <out_prefix>-cmp.png (block-in | raw | snapped | changed px) and prints drift stats
#   python scripts/art/tiers/pixellab_merge.py merge <blockin.png> <gen.png> <base_mk1.png> <out.png> x0,y0,x1,y1 [...]
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import tierlib as T  # noqa: E402

INK = T.hex_rgb('#14110f')


def allowed_for(base_path):
    b = T.load_rgba(base_path)
    cols = {tuple(int(v) for v in c) for c in b[b[:, :, 3] == 255][:, :3].reshape(-1, 3)}
    return T.RW_RGB | cols


def snap(gen, allowed):
    return T.snap_to_palette(gen, allowed)


def stats(blk, gen, allowed):
    op = gen[:, :, 3] >= 128
    raw_off = int(sum(1 for c in gen[op][:, :3] if tuple(int(v) for v in c) not in allowed))
    s, changed = snap(gen, allowed)
    alpha_diff = int(((s[:, :, 3] == 255) != (blk[:, :, 3] == 255)).sum())
    both = (s[:, :, 3] == 255) & (blk[:, :, 3] == 255)
    col_diff = int(((s[:, :, :3] != blk[:, :, :3]).any(axis=2) & both).sum())
    d = np.abs(gen[:, :, :3].astype(int) - s[:, :, :3].astype(int)).max(axis=2)[op]
    return dict(opaque=int(op.sum()), raw_off_palette=raw_off, snapped_px=changed, alpha_diff_vs_blockin=alpha_diff,
                colour_diff_vs_blockin=col_diff, snap_dist_median=float(np.median(d)) if d.size else 0.0,
                snap_dist_p90=float(np.percentile(d, 90)) if d.size else 0.0), s


def merge(blk, s, rects):
    out = blk.copy()
    for (x0, y0, x1, y1) in rects:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if blk[y, x, 3] != 255 or s[y, x, 3] != 255:
                    continue                                  # silhouette lock: block-in alpha wins
                if tuple(blk[y, x, :3]) == INK or tuple(s[y, x, :3]) == INK:
                    continue                                  # ink lock
                out[y, x, :3] = s[y, x, :3]
    return out


def sheet(panels, out, k=5):
    h, w = panels[0].shape[:2]
    img = Image.new('RGBA', (len(panels) * (w * k + 8) + 8, h * k + 16), (60, 54, 48, 255))
    for i, a in enumerate(panels):
        bg = Image.new('RGBA', (w, h), (210, 191, 156, 255))
        bg.alpha_composite(Image.fromarray(a))
        img.alpha_composite(bg.resize((w * k, h * k), Image.NEAREST), (8 + i * (w * k + 8), 8))
    img.save(out)


def main():
    mode, blk_p, gen_p, base_p = sys.argv[1:5]
    blk, gen = T.load_rgba(blk_p), T.load_rgba(gen_p)
    if gen.shape != blk.shape:
        raise SystemExit('size %s != block-in %s' % (gen.shape, blk.shape))
    allowed = allowed_for(base_p)
    st, s = stats(blk, gen, allowed)
    print(' '.join('%s=%s' % kv for kv in st.items()))
    if mode == 'report':
        diff = blk.copy()
        m = ((s[:, :, :3] != blk[:, :, :3]).any(axis=2) & (s[:, :, 3] == 255)) | ((s[:, :, 3] == 255) != (blk[:, :, 3] == 255))
        diff[m] = (255, 0, 255, 255)
        sheet([blk, gen, s, diff], sys.argv[5] + '-cmp.png')
    elif mode == 'merge':
        rects = [tuple(int(v) for v in r.split(',')) for r in sys.argv[6:]]
        out = merge(blk, s, rects)
        n = int(((out != blk).any(axis=2)).sum())
        print('merged px taken from the snapped generation: %d' % n)
        T.png_bytes_best(out, sys.argv[5])


if __name__ == '__main__':
    main()
