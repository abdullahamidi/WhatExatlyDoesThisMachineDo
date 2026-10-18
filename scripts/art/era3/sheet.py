# sheet.py prefix count K out  -> contact sheet with index labels
import sys
from PIL import Image, ImageDraw
G='/tmp/claude-0/-home-user-WhatExatlyDoesThisMachineDo/0b9fa637-9555-52ff-9a39-17f862f1fdae/scratchpad/era3/gen/'
p,n,K,out=sys.argv[1],int(sys.argv[2]),int(sys.argv[3]),sys.argv[4]
ims=[Image.open(f'{G}{p}-{i}.png').convert('RGBA') for i in range(n)]
w,h=ims[0].size; cols=min(n,int(sys.argv[5]) if len(sys.argv)>5 else 4); rows=(n+cols-1)//cols
sh=Image.new('RGBA',(cols*(w*K+6),rows*(h*K+16)),(190,178,150,255)); d=ImageDraw.Draw(sh)
for i,im in enumerate(ims):
    x=(i%cols)*(w*K+6); y=(i//cols)*(h*K+16)
    sh.alpha_composite(im.resize((w*K,h*K),Image.NEAREST),(x,y+14)); d.text((x+2,y+1),str(i),fill=(0,0,0,255))
sh.save(out)
