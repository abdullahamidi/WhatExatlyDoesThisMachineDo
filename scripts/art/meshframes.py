# usage: python3 meshframes.py cx cy scale frames...
import sys, numpy as np
from PIL import Image
R='/home/user/WhatExatlyDoesThisMachineDo/public/assets/machine/rot/'
cx,cy,sc=float(sys.argv[1]),float(sys.argv[2]),int(sys.argv[3])
def sheet(name,w,n,cols):
    a=np.array(Image.open(R+name).convert('RGBA')).astype(int)
    return [a[(k//cols)*w:(k//cols+1)*w,(k%cols)*w:(k%cols+1)*w] for k in range(n)]
L=sheet('gear-large-rot.png',64,140,12); P=sheet('gear-small-rot.png',40,80,9)
def ident(img,frames,w,ccx,ccy,rmin):
    best=None
    yy,xx=np.mgrid[0:w,0:w]; rr=np.hypot(xx+0.5-w/2,yy+0.5-w/2); ring=rr>rmin
    for dx in range(-2,3):
      for dy in range(-2,3):
        xs=(ccx+(np.arange(w)-w/2)*sc+sc/2+dx).astype(int); ys=(ccy+(np.arange(w)-w/2)*sc+sc/2+dy).astype(int)
        sub=img[np.ix_(ys,xs)][:,:,:3]
        for k,f in enumerate(frames):
            m=(f[:,:,3]>0)&ring
            score=(np.abs(sub-f[:,:,:3]).sum(2)<10)[m].sum()/m.sum()
            if best is None or score>best[0]: best=(score,k,dx,dy)
    return best
for fn in sys.argv[4:]:
    img=np.array(Image.open(fn).convert('RGB')).astype(int)
    bp=ident(img,P,40,cx,cy,12)
    bl=ident(img,L,64,cx-44*sc,cy,24)
    exp=(5-bl[1])%80
    print(fn.split('/')[-1],'large k=%d(%.2f) pinion k=%d(%.2f) expected %d %s'%(bl[1],bl[0],bp[1],bp[0],exp,'OK' if exp==bp[1] else 'MISMATCH d=%d'%(((bp[1]-exp+40)%80)-40)))
