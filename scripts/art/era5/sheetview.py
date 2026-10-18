import sys
from PIL import Image
# usage: sheetview.py out.png K file1 file2 ...   (dusk background)
out, K = sys.argv[1], int(sys.argv[2]); fs = sys.argv[3:]
ims = [Image.open(f).convert('RGBA') for f in fs]
W = sum(i.width for i in ims) + 6 * len(ims); H = max(i.height for i in ims)
c = Image.new('RGBA', (W, H), (62, 48, 73, 255)); x = 0
for i in ims: c.alpha_composite(i, (x, 0)); x += i.width + 6
c.resize((W * K, H * K), Image.NEAREST).save(out)
