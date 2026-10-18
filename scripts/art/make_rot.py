# Pre-render RotSprite rotation sheets. Frame k = source rotated clockwise by k*360/N deg about the canvas centre corner.
import sys, json, math
import numpy as np
from PIL import Image
sys.path.insert(0, sys.path[0])
from rotsprite import scale2x

SRC = '/home/user/WhatExatlyDoesThisMachineDo/public/assets/machine/'
OUT = sys.argv[1]
PARTS = {  # file: frames over 360 deg
    'flywheel': 180, 'gear-large': 140, 'gear-small': 80, 'hand-crank': 80, 'crank-brace': 80,
    'pulley-main': 140, 'pulley-crank': 80, 'pulley-flywheel': 180, 'pulley-motor': 24,
}
UP = 3; K = 2 ** UP
meta = {}
for name, n in PARTS.items():
    src = Image.open(SRC + name + '.png').convert('RGBA')
    a = np.array(src); a[a[:, :, 3] < 128] = 0; a[a[:, :, 3] >= 128, 3] = 255
    big = a.copy()
    for _ in range(UP): big = scale2x(big)
    bigim = Image.fromarray(big)
    W, H = src.size
    cols = math.ceil(math.sqrt(n * H / W)); cols = min(cols, n)
    rows = math.ceil(n / cols)
    sheet = Image.new('RGBA', (cols * W, rows * H), (0, 0, 0, 0))
    for k in range(n):
        deg = k * 360.0 / n
        if k == 0:
            fr = Image.fromarray(a)
        else:
            r = np.array(bigim.rotate(-deg, resample=Image.NEAREST, center=(bigim.width / 2, bigim.height / 2)))
            fr = Image.fromarray(r[K // 2::K, K // 2::K].copy())
        sheet.paste(fr, ((k % cols) * W, (k // cols) * H))
    sheet.save(f'{OUT}/{name}-rot.png')
    meta[name] = {'frames': n, 'cols': cols, 'rows': rows, 'frameWidth': W, 'frameHeight': H, 'stepDeg': 360.0 / n, 'sheet': list(sheet.size)}
print(json.dumps(meta, indent=1))
