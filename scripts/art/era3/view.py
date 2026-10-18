# view.py out.png K file1 [file2 ...]  side by side on sky bg
import sys
from PIL import Image
out,K=sys.argv[1],int(sys.argv[2]); ims=[Image.open(f).convert('RGBA') for f in sys.argv[3:]]
W=sum(i.width*K+8 for i in ims); H=max(i.height*K for i in ims)
sh=Image.new('RGBA',(W,H),(156,145,130,255)); x=0
for i in ims: sh.alpha_composite(i.resize((i.width*K,i.height*K),Image.NEAREST),(x,H-i.height*K)); x+=i.width*K+8
sh.save(out)
