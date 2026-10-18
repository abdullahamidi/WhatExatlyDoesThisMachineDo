# Finale key frames (ART_ERA5 §7 storyboard) -> scratch era5/finale_k*.png. Runs mock5.py with scene env per shot.
# UI overlays here are layout mocks only (the game renders text in HTML/CSS with the shipped ui/*.png frames).
import os, sys, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from helpers import *
from fonts import F5, text_mask
from PIL import Image
K = SCR
E4G = '/tmp/claude-0/-home-user-WhatExatlyDoesThisMachineDo/0b9fa637-9555-52ff-9a39-17f862f1fdae/scratchpad/era4/gen/'
HERE = os.path.dirname(os.path.abspath(__file__))
def run(out, **env):
    e = dict(os.environ, ERA4_GEN=E4G, SCENE='1', MOY='1300', MH='1350', **{k: str(v) for k, v in env.items()})
    subprocess.run([sys.executable, HERE + '/mock5.py', out], env=e, check=True)
    return Image.open(out).convert('RGBA')
def text_img(s, k='a1', scale=2, shadow='ink'):
    m = text_mask(s, F5); h, w = len(m) * scale, len(m[0]) * scale
    a = blank(w + 1, h + 1)
    for j in range(len(m)):
        for i in range(len(m[0])):
            if m[j][i]:
                rect(a, i * scale + 1, j * scale + 1, i * scale + scale, j * scale + scale, shadow)
    for j in range(len(m)):
        for i in range(len(m[0])):
            if m[j][i]: rect(a, i * scale, j * scale, i * scale + scale - 1, j * scale + scale - 1, k)
    return Image.fromarray(a)
def nine(path, w, h, frame=None, fw=24):
    src = Image.open(path).convert('RGBA')
    if frame is not None: src = src.crop((frame * fw, 0, frame * fw + fw, fw))
    s = 8; out = Image.new('RGBA', (w, h))
    c = lambda x0, y0, x1, y1: src.crop((x0, y0, x1, y1))
    mid = c(s, s, fw - s, fw - s)
    for y in range(s, h - s, fw - 2 * s):
        for x in range(s, w - s, fw - 2 * s): out.paste(mid, (x, y))
    for x in range(s, w - s, fw - 2 * s): out.paste(c(s, 0, fw - s, s), (x, 0)); out.paste(c(s, fw - s, fw - s, fw), (x, h - s))
    for y in range(s, h - s, fw - 2 * s): out.paste(c(0, s, s, fw - s), (0, y)); out.paste(c(fw - s, s, fw, fw - s), (w - s, y))
    out.paste(c(0, 0, s, s), (0, 0)); out.paste(c(fw - s, 0, fw, s), (w - s, 0)); out.paste(c(0, fw - s, s, fw), (0, h - s)); out.paste(c(fw - s, fw - s, fw, fw), (w - s, h - s))
    return out
def overlay_terminal(lines, buttons=False, plate=True):
    ov = Image.new('RGBA', (1280, 720), (0, 0, 0, 0))
    if plate:
        npl = Image.open(A + 'ui/nameplate.png').convert('RGBA'); npl = npl.resize((npl.width * 3, npl.height * 3), Image.NEAREST)
        ov.alpha_composite(npl, ((1280 - npl.width) // 2, 40))
    pw, ph = 640, 28 + 22 * len(lines) + (70 if buttons else 0)
    pn = nine(A + 'ui/panel.png', pw, ph); ov.alpha_composite(pn, ((1280 - pw) // 2, 470 - (60 if buttons else 0)))
    y = 470 - (60 if buttons else 0) + 16
    for i, ln in enumerate(lines):
        t = text_img(ln, 'a0' if i == 0 else 'a1'); ov.alpha_composite(t, ((1280 - pw) // 2 + 20, y)); y += 22
    if buttons:
        for j, lab in enumerate(['KEEP IT RUNNING', 'BEGIN A NEW CYCLE']):
            bw = 280; bx = (1280 - pw) // 2 + 20 + j * (bw + 40); by = y + 10
            b = nine(A + 'ui/button.png', bw, 40, frame=1 if j == 0 else 0); ov.alpha_composite(b, (bx, by))
            ic = Image.open(A + 'ui/icons16.png').convert('RGBA').crop(((2 if j == 0 else 1) * 16, 0, (2 if j == 0 else 1) * 16 + 16, 16))
            ov.alpha_composite(ic, (bx + 10, by + 12))
            t = text_img(lab, 'a2' if j == 0 else 'k3'); ov.alpha_composite(t, (bx + 34, by + 13))
    return ov
if __name__ == '__main__':
    shots = []
    # K1 — Era V complete (pre-finale): totality, horizon field, violet beam
    k1 = run(K + 'finale_k1_era5_complete.png', WORLD='violet', U5=9, ECL=5, HORIZON=.55, AP=5); shots.append(k1)
    # K2 — S2 crown close-up at zoom 1.0 (2 screen px per art px): diamond ring + white beam rising
    t = run(K + '_k2src.png', WORLD='violet', U5=9, ECL=4, AP=5, BEAMFILE='beam-white', CAMDY=230, SH=1000, TRANSPARENT=1)
    sky = Image.open(A + 'finale/sky-violet.png').convert('RGBA')
    hg = Image.open(A + 'finale/horizon-glow.png').convert('RGBA'); hg.putalpha(hg.getchannel('A').point(lambda v: int(v * .75))); sky.alpha_composite(hg)
    sky.alpha_composite(Image.open(A + 'finale/eclipse.png').convert('RGBA').crop((4 * 48, 0, 5 * 48, 48)), (372 - 24, 290 - 24))
    k2 = sky.crop((320, 180, 960, 540)).resize((1280, 720), Image.NEAREST)        # screen-fixed sky at zoom 1 = centre half x2
    cx, cy = 640 + 64, 660 + 230 - 520
    k2.alpha_composite(t.crop((cx - 320, cy - 180, cx + 320, cy + 180)).resize((1280, 720), Image.NEAREST))
    k2.save(K + 'finale_k2_crown_zoom1.png'); shots.append(k2)
    # K3 — S2 end: one soft white fade at peak (alpha 0.85)
    k3 = run(K + 'finale_k3_white_peak.png', WORLD='violet', U5=9, ECL=4, AP=5, BEAMFILE='beam-white', WHITE=.85); shots.append(k3)
    # K4 — S3 restoration mid-way: sky/skyline crossfade 50 %, green ground wipe +-420 px, regrowth stage 2, seeds falling
    k4 = run(K + 'finale_k4_restoring.png', WORLD='mid', MIX=.5, WIPE=420, REGROW=2, SEEDS=1, U5=9, AP=5, BEAMFILE='beam-white', PLATE=5); shots.append(k4)
    # K5 — S4 terminal reveal over the restored world
    ov = overlay_terminal(['PRIMARY FUNCTION: RESTORE', 'RESTORATION TARGET: WORLD STATE. PRIOR.', 'OBSERVER COUNT: 1.', 'OPERATOR IDENTITY: YOU.'])
    ov.save(K + '_ov4.png')
    k5 = run(K + 'finale_k5_reveal.png', WORLD='restored', REGROW=3, BIRDS=1, U5=9, AP=5, BEAMFILE='beam-white', PLATE=5, UI=K + '_ov4.png,0,0'); shots.append(k5)
    # K6 — S5 choice
    ov = overlay_terminal(['RESTORATION HOLDS WHILE THE MACHINE RUNS.'], buttons=True, plate=True); ov.save(K + '_ov5.png')
    k6 = run(K + 'finale_k6_choice.png', WORLD='restored', REGROW=3, BIRDS=1, SEEDS=1, U5=9, AP=5, BEAMFILE='beam-white', PLATE=5, UI=K + '_ov5.png,0,0'); shots.append(k6)
    # contact sheet (half size)
    cs = Image.new('RGBA', (1280, 720 * 3 // 1), (0, 0, 0, 255))
    for i, s in enumerate(shots): cs.paste(s.resize((640, 360), Image.NEAREST), ((i % 2) * 640, (i // 2) * 360))
    cs.save(K + 'finale_storyboard.png'); print('ok')
