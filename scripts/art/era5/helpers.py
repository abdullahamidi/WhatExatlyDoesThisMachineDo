import sys, os, math, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pal import *
ROOT = os.path.abspath(os.path.dirname(os.path.abspath(__file__)) + '/../../..') + '/'
A = ROOT + 'public/assets/'
O = os.environ.get('ERA5_OUT', A + 'machine/era5/')
SCR = os.environ.get('ERA5_SCRATCH', '/tmp/claude-0/-home-user-WhatExatlyDoesThisMachineDo/0b9fa637-9555-52ff-9a39-17f862f1fdae/scratchpad/era5/')
os.makedirs(O, exist_ok=True); os.makedirs(SCR, exist_ok=True)
def hline(a,x0,x1,y,k):
    for x in range(min(x0,x1),max(x0,x1)+1): put(a,x,y,k)
def vline(a,x,y0,y1,k):
    for y in range(min(y0,y1),max(y0,y1)+1): put(a,x,y,k)
def bres(a,x0,y0,x1,y1,k):
    dx,dy=abs(x1-x0),-abs(y1-y0); sx=1 if x0<x1 else -1; sy=1 if y0<y1 else -1; e=dx+dy
    while True:
        put(a,x0,y0,k)
        if x0==x1 and y0==y1: break
        e2=2*e
        if e2>=dy: e+=dy; x0+=sx
        if e2<=dx: e+=dx; y0+=sy
def disc(a,cx,cy,r,k):
    for y in range(a.shape[0]):
        for x in range(a.shape[1]):
            if (x+.5-cx)**2+(y+.5-cy)**2<=r*r: put(a,x,y,k)
def ringf(a,cx,cy,r0,r1,k):
    for y in range(a.shape[0]):
        for x in range(a.shape[1]):
            d=math.hypot(x+.5-cx,y+.5-cy)
            if r0<=d<=r1: put(a,x,y,k)
def iron_col(x,x0,x1):
    t=(x-x0)/max(x1-x0,1)
    if x in (x0,x1): return 'ink'
    return 'i4' if t<.14 else 'i3' if t<.30 else 'i2' if t<.70 else 'i1' if t<.86 else 'i0'
def brass_col(x,x0,x1):
    t=(x-x0)/max(x1-x0,1)
    if x in (x0,x1): return 'ink'
    return 'r5' if t<.2 else 'r4' if t<.55 else 'r3' if t<.82 else 'r2'
def sheet(frames):
    h,w=frames[0].shape[:2]; s=blank(w*len(frames),h)
    for i,f in enumerate(frames): s[:,i*w:(i+1)*w]=f
    return s
def ascii_draw(a, rows, keymap, ox=0, oy=0):
    """rows: list of strings; keymap: char -> palette key ('.'/' ' = skip)."""
    for j,row in enumerate(rows):
        for i,ch in enumerate(row):
            if ch in keymap: put(a, ox+i, oy+j, keymap[ch])
def outline(a, k='ink', where=None):
    """1-px outline around opaque pixels (4-neighbour), outside only."""
    m=a[:,:,3]>0; o=a.copy(); H,W=m.shape
    for y in range(H):
        for x in range(W):
            if m[y,x]: continue
            if any(0<=y+dy<H and 0<=x+dx<W and m[y+dy,x+dx] for dx,dy in ((1,0),(-1,0),(0,1),(0,-1))):
                if where is None or where(x,y): put(o,x,y,k)
    return o
def scale(path, k, out=None):
    im=Image.open(path); im=im.resize((im.width*k, im.height*k), Image.NEAREST); im.save(out or path.replace('.png', f'-{k}x.png')); return im
