import sys, math, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pal import *
from PIL import Image
G = os.environ.get('ERA4_GEN', '/tmp/claude-0/-home-user-WhatExatlyDoesThisMachineDo/0b9fa637-9555-52ff-9a39-17f862f1fdae/scratchpad/era4/gen/')
O = os.environ.get('ERA4_OUT', os.path.abspath(os.path.dirname(os.path.abspath(__file__)) + '/../../../public/assets/machine/era4') + '/')
os.makedirs(O, exist_ok=True)

def blank(w, h): return np.zeros((h, w, 4), np.uint8)
def hline(a, x0, x1, y, k):
    for x in range(min(x0, x1), max(x0, x1) + 1): put(a, x, y, k)
def vline(a, x, y0, y1, k):
    for y in range(min(y0, y1), max(y0, y1) + 1): put(a, x, y, k)
def bres(a, x0, y0, x1, y1, k):
    dx, dy = abs(x1 - x0), -abs(y1 - y0); sx = 1 if x0 < x1 else -1; sy = 1 if y0 < y1 else -1; e = dx + dy
    while True:
        put(a, x0, y0, k)
        if x0 == x1 and y0 == y1: break
        e2 = 2 * e
        if e2 >= dy: e += dy; x0 += sx
        if e2 <= dx: e += dx; y0 += sy
def disc(a, cx, cy, r, k):
    for y in range(a.shape[0]):
        for x in range(a.shape[1]):
            if (x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 <= r * r: put(a, x, y, k)
def ring(a, cx, cy, r0, r1, k):
    for y in range(a.shape[0]):
        for x in range(a.shape[1]):
            d = math.hypot(x + .5 - cx, y + .5 - cy)
            if r0 <= d <= r1: put(a, x, y, k)
def iron_col(x, x0, x1):
    n = x1 - x0; t = (x - x0) / max(n, 1)
    if x == x0 or x == x1: return 'ink'
    if t < .14: return 'i4'
    if t < .30: return 'i3'
    if t < .70: return 'i2'
    if t < .86: return 'i1'
    return 'i0'
def brass_col(x, x0, x1):
    n = x1 - x0; t = (x - x0) / max(n, 1)
    if x == x0 or x == x1: return 'ink'
    if t < .2: return 'r5'
    if t < .55: return 'r4'
    if t < .82: return 'r3'
    return 'r2'
def mirror_x(a):
    return a[:, ::-1].copy()
def sheet(frames):
    h, w = frames[0].shape[:2]; s = blank(w * len(frames), h)
    for i, f in enumerate(frames): s[:, i * w:(i + 1) * w] = f
    return s
