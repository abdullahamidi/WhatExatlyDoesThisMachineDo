# Era V palette = Rust Wasteland + era accents (II cyan, III ember/steam, IV verdigris) + Era V violet + dusk sky
# + finale ramps (restored sky, regrowth green). Keys are short codes used by every era5 tool.
import numpy as np
from PIL import Image
PAL = {
 'ink':'#14110f','i0':'#1f2225','i1':'#2b2e31','i2':'#3e4246','i3':'#5a5f63','i4':'#7d8286','i5':'#a3a6a4',
 'r0':'#2e1a12','r1':'#4e2a1a','r2':'#6e3a22','r3':'#8c4a2a','r4':'#ad6236','r5':'#c98552',
 's0':'#5f5244','s1':'#8a7a64','s2':'#a8957a','s3':'#c9b28a','s4':'#ddc9a3',
 'k0':'#7a7468','k1':'#9c9182','k2':'#b8a98f','k3':'#d2bf9c',
 'a0':'#d9822b','a1':'#f0a848','a2':'#ffd27a',
 'c0':'#2f5a62','c1':'#5fa8b4','c2':'#bff0ec','e0':'#6a2418','e1':'#b8402a','w0':'#e8e0cc',
 'v0':'#3f5e52','v1':'#7fae96','v2':'#cfe8d6',
 # Era V violet accent (roadmap) - small areas only: core rim, rings, beads, lens light, beam, eclipse corona
 'x0':'#24162f','x1':'#54367a','x2':'#9a6ad0','x3':'#e0c8ff',
 # Era V dusk sky (desaturated violet-grey, large areas: bg.skyViolet bands only)
 'd0':'#2b2236','d1':'#3e3049','d2':'#5b4a5f','d3':'#7d6a72',
 # Finale restored sky
 'b0':'#3f6690','b1':'#6f9fc8','b2':'#a8d0e8','b3':'#d6ecf0',
 # Finale regrowth green (hue-shifted: cool dark, yellow light)
 'g0':'#2e4a36','g1':'#5f8a4a','g2':'#8fb46a','g3':'#c2d68a'}
def rgb(h): h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))
C = {k:rgb(v)+(255,) for k,v in PAL.items()}
INV = {rgb(v):k for k,v in PAL.items()}
def load(p):
    a=np.array(Image.open(p).convert('RGBA')).copy(); a[a[:,:,3]<128]=0; a[a[:,:,3]>=128,3]=255; return a
def check(a, name=''):
    m=a[:,:,3]>0
    bad=set(map(tuple,a[m].reshape(-1,4))) - {C[k] for k in C}
    alpha=set(np.unique(a[:,:,3]))-{0,255}
    if bad or alpha: print('OFF-PALETTE', name, list(bad)[:6], len(bad), 'alpha', alpha)
    return not bad and not alpha
def snap(a, keys=None):
    ks=keys or list(PAL.keys()); P=np.array([rgb(PAL[k]) for k in ks]); out=a.copy(); m=a[:,:,3]>0
    px=a[m][:,:3].astype(int); d=((px[:,None,:]-P[None,:,:])**2).sum(-1); out[m,:3]=P[d.argmin(1)]; out[m,3]=255; return out
def put(a,x,y,k):
    if 0<=y<a.shape[0] and 0<=x<a.shape[1]: a[y,x]=C[k] if k else (0,0,0,0)
def get(a,x,y):
    if not (0<=y<a.shape[0] and 0<=x<a.shape[1]): return None
    p=a[y,x]; return None if p[3]==0 else INV.get(tuple(p[:3]),'?')
def rect(a,x0,y0,x1,y1,k):
    for y in range(y0,y1+1):
        for x in range(x0,x1+1): put(a,x,y,k)
def save(a,p): Image.fromarray(a).save(p)
def blank(w,h): return np.zeros((h,w,4),np.uint8)
