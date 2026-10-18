import numpy as np
from PIL import Image
PAL = {
 'ink':'#14110f','i0':'#1f2225','i1':'#2b2e31','i2':'#3e4246','i3':'#5a5f63','i4':'#7d8286','i5':'#a3a6a4',
 'r0':'#2e1a12','r1':'#4e2a1a','r2':'#6e3a22','r3':'#8c4a2a','r4':'#ad6236','r5':'#c98552',
 's0':'#5f5244','s1':'#8a7a64','s2':'#a8957a','s3':'#c9b28a','s4':'#ddc9a3',
 'k0':'#7a7468','k1':'#9c9182','k2':'#b8a98f','k3':'#d2bf9c',
 'a0':'#d9822b','a1':'#f0a848','a2':'#ffd27a',
 'c0':'#2f5a62','c1':'#5fa8b4','c2':'#bff0ec','e0':'#6a2418','e1':'#b8402a','w0':'#e8e0cc',
 'v0':'#3f5e52','v1':'#7fae96','v2':'#cfe8d6'}
def rgb(h): h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))
C = {k:rgb(v)+(255,) for k,v in PAL.items()}
INV = {rgb(v):k for k,v in PAL.items()}
def load(p):
    a=np.array(Image.open(p).convert('RGBA')).copy(); a[a[:,:,3]<128]=0; a[a[:,:,3]>=128,3]=255; return a
def check(a, name=''):
    bad=set()
    for px in a.reshape(-1,4):
        if px[3]==0: continue
        if px[3]!=255 or tuple(px[:3]) not in INV: bad.add(tuple(px))
    if bad: print('OFF-PALETTE', name, list(bad)[:8], len(bad))
    return not bad
def snap(a):
    keys=list(INV.keys()); P=np.array(keys)
    out=a.copy()
    m=a[:,:,3]>0
    px=a[m][:,:3].astype(int)
    d=((px[:,None,:]-P[None,:,:])**2).sum(-1); out[m,:3]=P[d.argmin(1)]
    return out
def put(a,x,y,k):
    if 0<=y<a.shape[0] and 0<=x<a.shape[1]: a[y,x]=C[k] if k else (0,0,0,0)
def rect(a,x0,y0,x1,y1,k):  # inclusive
    for y in range(y0,y1+1):
        for x in range(x0,x1+1): put(a,x,y,k)
def name(a,x,y):
    p=a[y,x]; return None if p[3]==0 else INV.get(tuple(p[:3]),'?')
def save(a,p): Image.fromarray(a).save(p)
def recolor(a,mp,region=None):
    out=a.copy(); y0,y1,x0,x1=(0,a.shape[0],0,a.shape[1]) if region is None else region
    for y in range(y0,y1):
        for x in range(x0,x1):
            n=name(a,x,y)
            if n in mp: put(out,x,y,mp[n])
    return out
