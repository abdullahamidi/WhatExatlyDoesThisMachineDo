# Living world sheet table (WP23a, Art Director): one entry per PNG under public/assets/ that the art toolchain
# builds. Column order = the final frame tables (WP23a D7; src/data/livingWorld.ts WORLD_FRAMES carries the same
# names in the same order). Era-row sheets have 6 rows in ERA_ROWS order. Cell sizes are art px (DENIZEN_ART 5.1).
# Pure data: imported by build_sheet.py, check_sheet.py and erarecolor.py.

ERA_ROWS = ('I', 'II', 'III', 'IV', 'V', 'whole')

FRAMES = {
    'inspector': ('idleA', 'idleB', 'walk0', 'walk1', 'walk2', 'walk3', 'write0', 'write1', 'glance', 'front', 'talk',
                  'shield', 'pat0', 'pat1', 'wave', 'watch', 'umbrellaOpen', 'frontUmbrella', 'talkUmbrella'),
    'dog': ('sit0', 'sit1', 'sniff0', 'sniff1', 'walk0', 'walk1', 'walk2', 'walk3', 'dig0', 'dig1', 'shake0', 'shake1',
            'head', 'talk', 'flat', 'lie', 'sleep', 'chase0', 'chase1', 'wag'),
    'crow': ('frozen', 'perch0', 'perch1', 'head', 'talk', 'peck0', 'peck1', 'fly0', 'fly1', 'fly2'),
    'girl': ('stand0', 'stand1', 'palm', 'talk', 'shield', 'run0', 'run1', 'run2', 'run3', 'lanternDrop'),
    'payphone': ('dark', 'lit', 'ring0', 'ring1', 'fog', 'restored'),
    'receiver': ('hang', 'swing0', 'swing1', 'swing2', 'level', 'onHook'),
    'sensor7': ('tripod', 'headL', 'headC', 'headR', 'headUp', 'fog', 'glyphDash', 'glyphOne'),
    'girlWindow': ('flickerA', 'flickerB', 'dark', 'restored'),
    'girlMini': ('warm', 'cold'),
    'lamp': ('dead', 'lit', 'warm', 'restored'),
    'lampGlow': ('cold', 'warm'),
    'clock': ('ruin', 'restored'),
    'stakeChain': ('chained', 'fallen'),
    'hole': ('stage1', 'stage2', 'stage3', 'stage4'),
    'scraps': ('scrap0', 'scrap1', 'scrap2'),
    'mote': ('ash', 'moth'),
    'windowLit': ('lit', 'breathe'),
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
                 pins={}, master='crow'),
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
                    overlays=('headL', 'headC', 'headR', 'headUp', 'glyphDash', 'glyphOne')),
    'girlWindow': dict(id='world.girlWindow', file='world/girl-window.png', cell=(4, 6), era_rows=False, pivot='plane',
                       ring=False, pins={}, master='girlWindow', only=('c', 'd', 'e', 'f')),   # rust only, no outline
    'girlMini': dict(id='world.girlMini', file='world/girl-mini.png', cell=(8, 12), era_rows=False, pivot='feet',
                     ring=True, pins={}, master='girlMini'),
    'lamp': dict(id='world.lamp', file='world/street-lamp.png', cell=(12, 60), era_rows=False, pivot='feet',
                 ring=True, pins={}, master='lamp'),
    'lampGlow': dict(id='world.lampGlow', file='world/lamp-glow.png', cell=(32, 16), era_rows=False, pivot='centre',
                     ring=False, pins={}, master='lampGlow', only=('e', 'f')),   # two-tone rust-amber; alpha at runtime
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
}

# Era-row sheets may use VIOLET_LIGHT in row V (the rim). Nothing else off the 25 is allowed anywhere.
EXTRA_COLOURS = {'#9a6ad0': (_V,)}

for _k, _s in SHEETS.items():
    _s['frames'] = FRAMES[_k]
    _s['rows'] = len(ERA_ROWS) if _s['era_rows'] else 1
    _s['size'] = (_s['cell'][0] * len(FRAMES[_k]), _s['cell'][1] * _s['rows'])
