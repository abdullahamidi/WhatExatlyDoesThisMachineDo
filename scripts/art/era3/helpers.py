import sys, math, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pal import *
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__)) + '/../'
G = D + 'gen/'; O = D + 'out/'
os.makedirs(O, exist_ok=True)

def blank(w, h): return np.zeros((h, w, 4), np.uint8)
def hline(a, x0, x1, y, k):
    for x in range(x0, x1 + 1): put(a, x, y, k)
def vline(a, x, y0, y1, k):
    for y in range(y0, y1 + 1): put(a, x, y, k)
def disc(a, cx, cy, r, k):            # cx,cy pixel-corner centre
    for y in range(a.shape[0]):
        for x in range(a.shape[1]):
            if (x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 <= r * r: put(a, x, y, k)
def ring(a, cx, cy, r0, r1, k):
    for y in range(a.shape[0]):
        for x in range(a.shape[1]):
            d = math.hypot(x + .5 - cx, y + .5 - cy)
            if r0 <= d <= r1: put(a, x, y, k)
def iron_col(x, x0, x1, lit=True):    # horizontal shading across a vertical cylinder [x0..x1] (left-lit)
    n = x1 - x0; t = (x - x0) / max(n, 1)
    if x == x0 or x == x1: return 'ink'
    if t < .14: return 'i4'
    if t < .30: return 'i3'
    if t < .70: return 'i2'
    if t < .86: return 'i1'
    return 'i0'

