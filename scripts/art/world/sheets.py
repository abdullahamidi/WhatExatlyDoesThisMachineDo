# Living world sheet table (WP23a, Art Director): one entry per PNG under public/assets/ that the art toolchain
# builds. Column order = the final frame tables (WP23a D7; src/data/livingWorld.ts WORLD_FRAMES carries the same
# names in the same order). Era-row sheets have 6 rows in ERA_ROWS order. Cell sizes are art px (DENIZEN_ART 5.1).
# Pure data: imported by build_sheet.py, check_sheet.py and erarecolor.py.

ERA_ROWS = ('I', 'II', 'III', 'IV', 'V', 'whole')

# WP24 D8 (AD1a): the living world v2 columns are APPENDED to the cast sheets (inspector lookUp, crouch, umbrellaHalf;
# dog scratch0, scratch1, lookUp; crow frozenTip, ruffle; girl lanternUp, tilt; girlMini palm), so every older column
# keeps its index (supersedes WP23 D7 "layouts final"). WP27 D5 appends the crow's folded-wing perched frames the same
# way: perchTurn (head turned back), perchHead and perchTalk (the era I-II bubble frames), columns 12-14. WP28b AD3-CELLS
# appends the machine-event reaction cells the same way: inspector startle, point (22-23); dog bark0, bark1 (23-24).
FRAMES = {
    'inspector': ('idleA', 'idleB', 'walk0', 'walk1', 'walk2', 'walk3', 'write0', 'write1', 'glance', 'front', 'talk',
                  'shield', 'pat0', 'pat1', 'wave', 'watch', 'umbrellaOpen', 'frontUmbrella', 'talkUmbrella',
                  'lookUp', 'crouch', 'umbrellaHalf', 'startle', 'point'),
    'dog': ('sit0', 'sit1', 'sniff0', 'sniff1', 'walk0', 'walk1', 'walk2', 'walk3', 'dig0', 'dig1', 'shake0', 'shake1',
            'head', 'talk', 'flat', 'lie', 'sleep', 'chase0', 'chase1', 'wag', 'scratch0', 'scratch1', 'lookUp',
            'bark0', 'bark1'),
    'crow': ('frozen', 'perch0', 'perch1', 'head', 'talk', 'peck0', 'peck1', 'fly0', 'fly1', 'fly2', 'frozenTip',
             'ruffle', 'perchTurn', 'perchHead', 'perchTalk'),
    'girl': ('stand0', 'stand1', 'palm', 'talk', 'shield', 'run0', 'run1', 'run2', 'run3', 'lanternDrop', 'lanternUp',
             'tilt'),
    'payphone': ('dark', 'lit', 'ring0', 'ring1', 'fog', 'restored'),
    'receiver': ('hang', 'swing0', 'swing1', 'swing2', 'level', 'onHook'),
    'sensor7': ('tripod', 'headL', 'headC', 'headR', 'headUp', 'fog', 'glyphDash', 'glyphOne'),
    'girlWindow': ('flickerA', 'flickerB', 'dark', 'restored'),
    'girlMini': ('warm', 'cold', 'palm'),
    'lamp': ('dead', 'lit', 'warm', 'restored'),
    'lampGlow': ('cold', 'warm'),
    'clock': ('ruin', 'restored'),
    'stakeChain': ('chained', 'fallen'),
    'hole': ('stage1', 'stage2', 'stage3', 'stage4'),
    'scraps': ('scrap0', 'scrap1', 'scrap2'),
    'mote': ('ash', 'moth'),
    'windowLit': ('lit', 'breathe'),
    'lantern': ('lit', 'fallen'),
    'redBall': ('ball',),
    'clipboardPages': ('thin', 'medium', 'thick'),
    # WP23b AD3c (R7 frame names; WORLD_PUDDLE index = (size - 1) * 3 + look, whole 9; WORLD_SPROUT bloomFrame 4)
    'puddle': ('size1Grey', 'size1Ring', 'size1Black', 'size2Grey', 'size2Ring', 'size2Black', 'size3Grey', 'size3Ring',
               'size3Black', 'whole'),
    'sprout': ('stage1', 'stage2', 'stage3', 'stage4', 'bloom'),
    'page': ('flat', 'tilt'),
    'virga': ('fall', 'frozen'),
    # WP28a AD1: the era I-II Splice objects in ONE uniform-cell sheet (cell 32x24, objects bottom-centered) and the Finds
    # sheet (8x8 cells: items 0-6, relic note 7, glint 8-10). Frame names are the hand-off names (cell index = column).
    'splicesA': ('bicycleDead', 'bicycleSpin0', 'bicycleSpin1', 'bicycleSpin2', 'bicycleWhole',
                 'organDead', 'organCrank0', 'organCrank1', 'organCrank2', 'organCrank3', 'organWhole',
                 'radioDark', 'radioLitA', 'radioLitB', 'radioWhole',
                 'signDark', 'signHalfA', 'signHalfB', 'signWhole', 'clockLit'),
    'finds': ('bolt', 'tag', 'gear', 'tin', 'key', 'photo', 'token', 'note', 'glint0', 'glint1', 'glint2'),
    # WP28b AD3-OBJ: the era III-V Splice objects in TWO uniform-cell sheets (one cell would waste 114 KiB decoded): the tall
    # objects in splicesB (18x56), the small ones and the overlays in splicesC (24x18). Cell index = column.
    'splicesB': ('pumpDead', 'pumpUp', 'pumpDown', 'pumpCough', 'pumpWhole',
                 'whistleDead', 'whistleBlow', 'whistleWhole',
                 'bellStill', 'bellSwingL', 'bellSwingR', 'bellWhole',
                 'kiteTangled', 'kiteFlutter0', 'kiteFlutter1', 'kiteWhole',
                 'cairnStack', 'cairnLift1', 'cairnLift2', 'cairnLift3', 'cairnLift4', 'cairnWhole'),
    'splicesC': ('hydrantDead', 'hydrantRattle', 'hydrantMistA', 'hydrantMistB', 'hydrantWhole',
                 'gramophoneStill', 'gramophoneSpin0', 'gramophoneSpin1', 'gramophoneSpin2', 'gramophoneSkip',
                 'gramophoneWhole',
                 'chimesStill', 'chimesSway0', 'chimesSway1', 'chimesWhole',
                 'vaneDir0', 'vaneDir1', 'vaneDir2', 'vaneDown', 'vaneWhole',
                 'coinClosed', 'coinRattle0', 'coinRattle1', 'coinWhole'),
}

# key -> asset id, file under public/assets/, cell (w, h) art px, era rows?, pivot, per-sheet recolour pins,
# extra colours allowed beyond the 25 (hex -> era row indices), master folder under masters/ (None = not drawn yet).
# pins: {palette code: first era row index where the code keeps its own colour}; before that row it takes the
# sepia map and skips the row II faded return (DENIZEN_ART App. A "per-denizen material maps").
_V = 4  # era row index of V
SHEETS = {
    'inspector': dict(id='world.inspector', file='world/inspector.png', cell=(20, 40), era_rows=True, pivot='feet',
                      ring=True, pins={}, master='inspector'),
    'dog': dict(id='world.dog', file='world/dog.png', cell=(28, 20), era_rows=True, pivot='feet', ring=True,
                pins={}, master='dog'),
    'crow': dict(id='world.crow', file='world/crow.png', cell=(24, 18), era_rows=True, pivot='feet', ring=True,
                 pins={}, master='crow',
                 # WP23b AD3b: flight cells (legs tucked) are drawn relative to the perch by the finale script, not
                 # stood on a surface: exempt from the feet-on-the-bottom-row check
                 airborne=('fly0', 'fly1', 'fly2')),
    'girl': dict(id='world.girl', file='world/girl.png', cell=(16, 28), era_rows=True, pivot='feet', ring=True,
                 pins={'A': 2, 'B': 2, 'C': 2}, master='girl'),  # raincoat yellow + warm lantern dot return only in row III
    # (she is the colour thread); before that the C dot takes the sepia map: #ddc9a3 = the cold white lantern of era II
    'payphone': dict(id='world.payphone', file='world/payphone.png', cell=(28, 52), era_rows=True, pivot='feet',
                     ring=True, pins={}, master='payphone'),
    'receiver': dict(id='world.receiver', file='world/receiver.png', cell=(8, 12), era_rows=True, pivot='hook',
                     ring=True, pins={}, master='receiver'),
    'sensor7': dict(id='world.sensor7', file='world/sensor7.png', cell=(20, 40), era_rows=True, pivot='feet',
                    ring=True, pins={}, master='sensor7',
                    # stacked overlays (same pivot as tripod): head-only and readout-only cells, exempt from the feet check
                    overlays=('headL', 'headC', 'headR', 'headUp', 'fog', 'glyphDash', 'glyphOne')),   # fog: AD3c, on headR
    'girlWindow': dict(id='world.girlWindow', file='world/girl-window.png', cell=(4, 6), era_rows=False, pivot='plane',
                       ring=False, pins={}, master='girlWindow', only=('c', 'd', 'e', 'f'),    # rust only, no outline
                       # WP23b AD3b: the restored frame (LAST LOOK, postgame) is lit warm like the restored skyline's
                       # windows (#f0a848 / #ffd27a): the accent ramp is allowed in that frame only
                       only_frames={'restored': ('c', 'd', 'e', 'f', 'A', 'B', 'C')}),
    'girlMini': dict(id='world.girlMini', file='world/girl-mini.png', cell=(8, 12), era_rows=False, pivot='feet',
                     ring=True, pins={}, master='girlMini'),
    'lamp': dict(id='world.lamp', file='world/street-lamp.png', cell=(12, 60), era_rows=False, pivot='feet',
                 ring=True, pins={}, master='lamp'),
    'lampGlow': dict(id='world.lampGlow', file='world/lamp-glow.png', cell=(32, 16), era_rows=False, pivot='centre',
                     ring=False, pins={}, master='lampGlow', only=('e', 'f'),    # two-tone rust-amber; alpha at runtime
                     only_frames={'warm': ('e', 'f', 'A', 'B')}),   # AD3c warm: + #d9822b / #f0a848, never #ffd27a
    'clock': dict(id='world.clock', file='world/street-clock.png', cell=(16, 44), era_rows=False, pivot='feet',
                  ring=True, pins={}, master='clock'),
    'stakeChain': dict(id='world.stakeChain', file='world/stake-chain.png', cell=(10, 6), era_rows=False, pivot='feet',
                       ring=False, pins={}, master='stakeChain'),
    'hole': dict(id='world.hole', file='world/hole.png', cell=(16, 6), era_rows=False, pivot='feet', ring=False,
                 pins={}, master='hole', grow=('stage1', 'stage2', 'stage3', 'stage4')),   # never refills
    'scraps': dict(id='world.scraps', file='world/scraps.png', cell=(8, 4), era_rows=False, pivot='feet', ring=False,
                   pins={}, master='scraps'),
    'mote': dict(id='world.mote', file='world/mote.png', cell=(2, 2), era_rows=False, pivot='centre', ring=False,
                 pins={}, master='mote'),
    'windowLit': dict(id='bg.windowLit', file='bg/window-lit.png', cell=(4, 6), era_rows=False, pivot='plane',
                      ring=False, pins={}, master='windowLit', only=('e', 'f')),   # rust-amber only: #ad6236 / #c98552
    # WP23b AD3a props (single row, selective outline): the dropped lantern, the cycle 2+ red ball, the clipboard pages
    'lantern': dict(id='world.lantern', file='world/lantern.png', cell=(6, 4), era_rows=False, pivot='feet', ring=False,
                    pins={}, master='lantern'),
    'redBall': dict(id='world.redBall', file='world/red-ball.png', cell=(3, 3), era_rows=False, pivot='feet', ring=False,
                    pins={}, master='redBall'),
    'clipboardPages': dict(id='world.clipboardPages', file='world/clipboard-pages.png', cell=(6, 3), era_rows=False,
                           pivot='feet', ring=False, pins={}, master='clipboardPages'),
    # WP23b AD3c props and the virga strip (single row). The two restored cells (puddle whole, sprout bloom) may use the
    # restored-world colours (pal.RESTORED) through `restored_frames`; every other cell is palette-only, no green or blue.
    'puddle': dict(id='world.puddle', file='world/puddles.png', cell=(32, 5), era_rows=False, pivot='feet', ring=False,
                   pins={}, master='puddle', grow=('size1Grey', 'size2Grey', 'size3Grey'),    # puddles never dry
                   restored_frames={'whole': ('g', 'h', 'i', 'j', 'k', 'm', 'n', 'o')}),
    'sprout': dict(id='world.sprout', file='world/sprout.png', cell=(8, 24), era_rows=False, pivot='feet', ring=False,
                   pins={}, master='sprout', grow=('stage1', 'stage2', 'stage3', 'stage4'),     # never shrinks
                   restored_frames={'bloom': ('g', 'h', 'i', 'j', 'k', 'm', 'n', 'o')}),
    'page': dict(id='world.page', file='world/page.png', cell=(3, 4), era_rows=False, pivot='centre', ring=False,
                 pins={}, master='page'),
    # a tile strip of separate rain streaks (`parts`: no one-component rule), sky ramp only, no outline (far layer)
    'virga': dict(id='bg.virga', file='bg/virga.png', cell=(512, 64), era_rows=False, pivot='plane', ring=False,
                  pins={}, master='virga', parts=True, only=('p', 'q', 'r', 'x'),
                  vertical=True),    # frames stacked top to bottom: 512x128 = 2 frames of 512x64 (manifest frame grid)
    # WP28a AD1 (single row, street furniture like the lamp and clock). splicesA: full ink ring except the bicycle cells
    # (`no_ring`: 1 px tubes, spokes and stand), whose silhouette counts 8-connected (`conn8`: diagonal 1 px tubes);
    # clockLit is a stacked overlay on world.clock (bottom-centered anyway). finds: the glint cells are a one-color
    # sparkle centered in the cell (no outline, not on the ground): `no_ring` + `overlays`.
    'splicesA': dict(id='world.splicesA', file='world/splices-a.png', cell=(32, 24), era_rows=False, pivot='feet',
                     ring=True, pins={}, master='splicesA', overlays=('clockLit',),
                     no_ring=('bicycleDead', 'bicycleSpin0', 'bicycleSpin1', 'bicycleSpin2', 'bicycleWhole'),
                     conn8=('bicycleDead', 'bicycleSpin0', 'bicycleSpin1', 'bicycleSpin2', 'bicycleWhole')),
    'finds': dict(id='world.finds', file='world/finds.png', cell=(8, 8), era_rows=False, pivot='feet', ring=True,
                  pins={}, master='finds', overlays=('glint0', 'glint1', 'glint2'),
                  no_ring=('glint0', 'glint1', 'glint2')),
    # WP28b AD3-OBJ (single row, objects bottom-centred, pivot (0.5, 1)). Per-frame gate options: `no_ring` for the soft
    # steam and mist (no ink edge) and the kite's 1 px string, tail and bows; `parts_frames` where pieces float free by
    # design (the coughed drops, the plume wisps, the mist specks, the lifted cairn stones); `violet_frames` for the era V
    # violetLight rim on the lifted stones (single-row sheets allow it nowhere else). The kite and the chimes hang on the
    # lamp, the vane stands on the booth apex, the coin flap sits on the booth's phone unit: stacked `overlays` (the kite's
    # string ends at the finial, above its cell bottom, so it is exempt from the feet check).
    'splicesB': dict(id='world.splicesB', file='world/splices-b.png', cell=(18, 56), era_rows=False, pivot='feet',
                     ring=True, pins={}, master='splicesB',
                     overlays=('kiteTangled', 'kiteFlutter0', 'kiteFlutter1', 'kiteWhole'),
                     no_ring=('whistleBlow', 'kiteTangled', 'kiteFlutter0', 'kiteFlutter1', 'kiteWhole'),
                     parts_frames=('pumpCough', 'whistleBlow', 'cairnLift1', 'cairnLift2', 'cairnLift3', 'cairnLift4'),
                     violet_frames=('cairnLift1', 'cairnLift2', 'cairnLift3', 'cairnLift4')),
    'splicesC': dict(id='world.splicesC', file='world/splices-c.png', cell=(24, 18), era_rows=False, pivot='feet',
                     ring=True, pins={}, master='splicesC',
                     overlays=('chimesStill', 'chimesSway0', 'chimesSway1', 'chimesWhole', 'vaneDir0', 'vaneDir1',
                               'vaneDir2', 'vaneDown', 'vaneWhole', 'coinClosed', 'coinRattle0', 'coinRattle1',
                               'coinWhole'),
                     no_ring=('hydrantMistA', 'hydrantMistB'),
                     parts_frames=('hydrantMistA', 'hydrantMistB')),
}

# Era-row sheets may use VIOLET_LIGHT in row V (the rim). Nothing else off the 25 is allowed anywhere.
EXTRA_COLOURS = {'#9a6ad0': (_V,)}

for _k, _s in SHEETS.items():
    _s['frames'] = FRAMES[_k]
    _s['rows'] = len(ERA_ROWS) if _s['era_rows'] else 1
    _s['size'] = ((_s['cell'][0], _s['cell'][1] * len(FRAMES[_k])) if _s.get('vertical')     # AD3c: one column of frames
                  else (_s['cell'][0] * len(FRAMES[_k]), _s['cell'][1] * _s['rows']))


def cell_origin(spec, col, row):
    """Top-left px of a cell in the sheet: frames are columns (era rows are rows), or one column when `vertical`."""
    if spec.get('vertical'):
        return 0, col * spec['cell'][1]
    return col * spec['cell'][0], row * spec['cell'][1]
