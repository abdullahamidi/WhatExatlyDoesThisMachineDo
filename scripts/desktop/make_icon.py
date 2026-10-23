# Build the desktop app icon from the game's logo mark.
# Source: public/assets/ui/logo-mark.png. Every frame is an exact NEAREST resize (no smoothing).
# Writes desktop/icon.png (256x256) and desktop/icon.ico (16, 32, 48, 64, 128, 256 frames).
# Usage (from repo root): python -I scripts/desktop/make_icon.py

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'public' / 'assets' / 'ui' / 'logo-mark.png'
OUT_DIR = ROOT / 'desktop'
PNG_OUT = OUT_DIR / 'icon.png'
ICO_OUT = OUT_DIR / 'icon.ico'
SIZES = (16, 32, 48, 64, 128, 256)


def main() -> None:
    source = Image.open(SRC).convert('RGBA')
    frames = [source.resize((s, s), Image.NEAREST) for s in SIZES]
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    big = frames[-1]
    big.save(PNG_OUT, format='PNG')
    print(f'wrote {PNG_OUT} ({big.size[0]}x{big.size[1]})')

    # Pillow uses a provided frame as-is when its size matches exactly, so nothing is resampled here.
    big.save(
        ICO_OUT,
        format='ICO',
        sizes=[(s, s) for s in SIZES],
        append_images=frames[:-1],
    )
    print(f'wrote {ICO_OUT} ({len(SIZES)} frames: {", ".join(str(s) for s in SIZES)})')


if __name__ == '__main__':
    main()
