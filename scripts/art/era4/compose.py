# Art-res mock compositor: era I machine (from src/data/machineComponents.ts numbers) + era II parts.
# usage: python3 compose.py out.png [era2=1] [K=2]
import sys, math, json
import numpy as np
from PIL import Image
R='/home/user/WhatExatlyDoesThisMachineDo/public/assets/'
M=R+'machine/'
OX, OY = 240, 250          # canvas position of machine origin (0,0)
W, H = 760, 290
def hexc(h): h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))+(255,)
items=[]   # (depth, order, fn)
def sprite(path, x, y, ox, oy, depth, frame=None):
    im=Image.open(path).convert('RGBA')
    if frame is not None:
        fw,fh,k,cols=frame; im=im.crop(((k%cols)*fw,(k//cols)*fh,(k%cols)*fw+fw,(k//cols)*fh+fh))
    px=round(OX+x-ox*im.width); py=round(OY+y-oy*im.height)
    items.append((depth,len(items),('img',im,px,py)))
def P(c,x,y,col):
    if 0<=x<W and 0<=y<H: c[y,x]=col
def raster_belt(c,a,ra,b,rb,outer,inner):
    # open belt, centreline r+1, 2px: outer ring r+1.5, inner r+0.5 style approximation by sampling
    (ax,ay),(bx,by)=a,b; Ra,Rb=ra+1,rb+1
    dx,dy=bx-ax,by-ay; C=math.hypot(dx,dy); phi=math.atan2(dy,dx)
    al=math.acos((Ra-Rb)/C)   # touch angle from phi
    pts=[]
    # tangent touch points
    for s in (1,-1):
        t=phi+s*al
        pa=(ax+Ra*math.cos(t),ay+Ra*math.sin(t)); pb=(bx+Rb*math.cos(t),by+Rb*math.sin(t))
        n=int(C*3)
        for i in range(n+1):
            u=i/n; pts.append((pa[0]+(pb[0]-pa[0])*u, pa[1]+(pb[1]-pa[1])*u, t))
    # wrap arcs: on a, angles from phi+al to phi+2pi-al (side away from b); on b from phi-al to phi+al
    def arc(cx,cy,r,t0,t1):
        n=int(abs(t1-t0)*r*3)+2
        for i in range(n+1):
            t=t0+(t1-t0)*i/n; pts.append((cx+r*math.cos(t),cy+r*math.sin(t),t))
    arc(ax,ay,Ra,phi+al,phi+2*math.pi-al); arc(bx,by,Rb,phi-al,phi+al)
    lay=[]
    for (x,y,t) in pts:
        nx,ny=math.cos(t),math.sin(t)
        lay.append((x+nx*0.5,y+ny*0.5,outer)); lay.append((x-nx*0.5,y-ny*0.5,inner))
    items.append((25,len(items),('pix',[(round(OX+x-0.5),round(OY+y-0.5),col) for x,y,col in lay])))
def cable(pa,pb,sag,col=hexc('#14110f'),depth=26):
    (x0,y0),(x1,y1)=pa,pb; n=int(abs(x1-x0)+abs(y1-y0))*2+2; px=[]
    for i in range(n+1):
        u=i/n; x=x0+(x1-x0)*u; y=y0+(y1-y0)*u+4*sag*u*(1-u); px.append((math.floor(OX+x),math.floor(OY+y),col))
    items.append((depth,len(items),('pix',px)))
def line(pa,pb,col,depth):
    (x0,y0),(x1,y1)=pa,pb; n=int(max(abs(x1-x0),abs(y1-y0)))*2+2
    items.append((depth,len(items),('pix',[(math.floor(OX+x0+(x1-x0)*i/n),math.floor(OY+y0+(y1-y0)*i/n),col) for i in range(n+1)])))
def cap(x,y):
    px=[]
    for j in range(4):
        for i in range(4):
            col=hexc('#7d8286')
            if i in(0,3) or j in(0,3): col=hexc('#1f2225')
            px.append((OX+x-2+i,OY+y-2+j,col))
    px.append((OX+x-1,OY+y-1,hexc('#a3a6a4')))
    items.append((32,len(items),('pix',px)))
def render(out,K=2,bg=True):
    c=np.zeros((H,W,4),np.uint8)
    if bg:
        sky=Image.open(R+'bg/sky.png').convert('RGBA').crop((0,0,W,H)) if True else None
        c[:]=np.array(sky.resize((W,H),Image.NEAREST)) if sky.size!=(W,H) else np.array(sky)
        c[OY:,:]=hexc('#8a7a64'); c[OY,:]=hexc('#5f5244')
    im=Image.fromarray(c)
    for d,o,it in sorted(items,key=lambda t:(t[0],t[1])):
        if it[0]=='img': im.alpha_composite(it[1],(it[2],it[3]))
        else:
            a=np.array(im)
            for x,y,col in it[1]:
                if 0<=x<W and 0<=y<H: a[y,x]=col
            im=Image.fromarray(a)
    im.save(out)
    if K>1: im.resize((W*K,H*K),Image.NEAREST).save(out.replace('.png',f'-{K}x.png'))
    return im

def era1():
    sprite(M+'support-frame.png',0,0,.5,1,10)
    sprite(M+'bearing-plate.png',-44,-56,.5,.5,11); sprite(M+'bearing-plate.png',0,-56,.5,.5,11)
    sprite(M+'gear-large.png',-44,-56,.5,.5,20); sprite(M+'pulley-main.png',-44,-56,.5,.5,22)
    sprite(M+'gear-small.png',0,-56,.5,.5,21, frame=(40,40,4,9)) if False else None
    im=Image.open(M+'rot/gear-small-rot.png'); sprite(M+'rot/gear-small-rot.png',0,-56,.5,.5,21,frame=(40,40,4,9))
    sprite(M+'pulley-crank.png',0,-56,.5,.5,22); sprite(M+'hand-crank.png',0,-56,.5,.5,30); sprite(M+'crank-brace.png',0,-56,.5,.5,31)
    sprite(M+'flywheel-pedestal.png',150,0,.5,1,21); sprite(M+'flywheel.png',150,-56,.5,.5,20); sprite(M+'pulley-flywheel.png',150,-56,.5,.5,23)
    sprite(M+'motor-plinth.png',-140,0,.5,1,20); sprite(M+'worn-motor.png',-140,-27,.5,.5,21); sprite(M+'pulley-motor.png',-114,-31,.5,.5,22)
    # yoke at rod position theta=0: y=-56-(5+69)=-130
    sprite(M+'piston-yoke.png',-44,-130,.5,.75,0); sprite(M+'piston-block.png',-44,-110,.5,1,1)
    raster_belt(None,(-114,-31),5,(-44,-56),10,hexc('#2e1a12'),hexc('#6e3a22'))
    raster_belt(None,(0,-56),8,(150,-56),12,hexc('#2e1a12'),hexc('#6e3a22'))
    for x in (-45,-44,-43): line((x,-56+(-5 if False else 0)),(x,-130),hexc('#7d8286') if x==-44 else hexc('#3e4246'),31)
    for (x,y) in ((-44,-56),(0,-56),(150,-56),(-114,-31)): cap(x,y)
