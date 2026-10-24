# Part evolution tiers, production batch 1 (WP22 AD1): rebuild every batch-1 tier PNG, then run the gates.
#   python scripts/art/tiers/batch1.py [--report <gates.md>] [--g4 <g4.json>]
# Writes into public/assets/machine/tiers/ (91 PNGs: motorTuning, gearRatio, flywheel, copperWinding, motorRetrofit,
# improvedPistons, transformer; P1 batch A: firebox, inductionHeater, condenser, harmonicCoil, bellowsDrive, gridExciter;
# P1 batch B: pressureResonator, crankServo, standingWave; P2: mainsBackfeed, steamLance).
# Deterministic: a rebuild of unchanged scripts gives byte-identical files.
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
STEPS = ['motor_tiers.py', 'palette_tiers.py', 'decal_tiers.py', 'pedestal_tiers.py', 'coil_tiers.py', 'retrofit_tiers.py',
         # AD2w, P0 PixelLab hosts (method A block-in + the saved, palette-snapped PixelLab refinement in pixellab/)
         'piston_tiers.py', 'transformer_tiers.py',
         # AD3a, P1 batch A (method A): fire glows, induction heater, condenser, coil ring 1, bellows, exciter feed
         'fire_tiers.py', 'heater_tiers.py', 'condenser_tiers.py', 'coilring_tiers.py', 'bellows_tiers.py',
         'exciter_tiers.py',
         # AD3b, P1 batch B: calliope (method A block-in + PixelLab method B merge), servo base (method A; the servo arm
         # rides palette_tiers.py, method C), spire wave modes 2-5 (method D, procedural)
         'calliope_tiers.py', 'servo_tiers.py', 'wave_tiers.py',
         # AD4a, P2 legacy feeds of Era V (method A): backfeed terminal, steam lance
         'backfeed_tiers.py', 'lance_tiers.py']


def main():
    for step in STEPS:
        subprocess.run([sys.executable, '-I', os.path.join(HERE, step)], check=True)
    r = subprocess.run([sys.executable, '-I', os.path.join(HERE, 'check_gates.py')] + sys.argv[1:])
    sys.exit(r.returncode)


if __name__ == '__main__':
    main()
