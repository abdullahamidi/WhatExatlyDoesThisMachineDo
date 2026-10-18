import numpy as np
from PIL import Image

def scale2x(a):
    # a: HxWx4 uint8 ; EPX/Scale2x
    H, W = a.shape[:2]
    p = np.pad(a, ((1,1),(1,1),(0,0)), mode='edge')
    E = p[1:-1,1:-1]; B = p[:-2,1:-1]; D = p[1:-1,:-2]; F = p[1:-1,2:]; H_ = p[2:,1:-1]
    eq = lambda x, y: np.all(x == y, axis=2)
    c = (~eq(B, H_)) & (~eq(D, F))
    E0 = np.where((c & eq(D, B))[..., None], D, E)
    E1 = np.where((c & eq(B, F))[..., None], F, E)
    E2 = np.where((c & eq(D, H_))[..., None], D, E)
    E3 = np.where((c & eq(H_, F))[..., None], F, E)
    out = np.zeros((H*2, W*2, 4), np.uint8)
    out[0::2,0::2] = E0; out[0::2,1::2] = E1; out[1::2,0::2] = E2; out[1::2,1::2] = E3
    return out

def rotsprite(img, deg, up=3):
    a = np.array(img.convert('RGBA'))
    a[a[:,:,3] < 128] = 0
    for _ in range(up): a = scale2x(a)
    k = 2 ** up
    big = Image.fromarray(a)
    # rotate about exact centre, NN, same size
    r = big.rotate(-deg, resample=Image.NEAREST, center=(big.width/2, big.height/2))
    r = np.array(r)
    # downsample: sample centre pixel of each kxk block
    off = k // 2
    small = r[off::k, off::k]
    return Image.fromarray(small)

def nn(img, deg):
    return img.convert('RGBA').rotate(-deg, resample=Image.NEAREST, center=(img.width/2, img.height/2))
