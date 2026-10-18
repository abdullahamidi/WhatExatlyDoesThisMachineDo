export const PALETTE = {
  sand: 0xc9b28a, dirtyBeige: 0xa8957a, rust: 0x8c4a2a, rustDark: 0x4e2a1a, industrialGray: 0x5a5f63,
  grayDark: 0x2b2e31, mutedOrange: 0xd9822b, skyTop: 0x7a7468, skyHaze: 0xd2bf9c, ink: 0x14110f,
  cyanDark: 0x2f5a62, cyan: 0x5fa8b4, cyanLight: 0xbff0ec,
  emberDark: 0x6a2418, ember: 0xb8402a, steam: 0xe8e0cc,
  verdigrisDark: 0x3f5e52, verdigris: 0x7fae96, verdigrisLight: 0xcfe8d6,
  // Era V: violet sky, eclipse dusk tones
  violetDark: 0x24162f, violet: 0x54367a, violetLight: 0x9a6ad0, violetPale: 0xe0c8ff,
  dusk0: 0x2b2236, dusk1: 0x3e3049, dusk2: 0x5b4a5f, dusk3: 0x7d6a72,
  // WP13 finale: restored clear sky (dark to pale), regrowth greens (dark to light)
  skyClear0: 0x3f6690, skyClear1: 0x6f9fc8, skyClear2: 0xa8d0e8, skyClear3: 0xd6ecf0,
  green0: 0x2e4a36, green1: 0x5f8a4a, green2: 0x8fb46a, green3: 0xc2d68a,
} as const;
export type PaletteKey = keyof typeof PALETTE;

const css = (n: number): string => '#' + n.toString(16).padStart(6, '0');

export const PALETTE_CSS: Record<PaletteKey, string> = {
  sand: css(PALETTE.sand),
  dirtyBeige: css(PALETTE.dirtyBeige),
  rust: css(PALETTE.rust),
  rustDark: css(PALETTE.rustDark),
  industrialGray: css(PALETTE.industrialGray),
  grayDark: css(PALETTE.grayDark),
  mutedOrange: css(PALETTE.mutedOrange),
  skyTop: css(PALETTE.skyTop),
  skyHaze: css(PALETTE.skyHaze),
  ink: css(PALETTE.ink),
  cyanDark: css(PALETTE.cyanDark),
  cyan: css(PALETTE.cyan),
  cyanLight: css(PALETTE.cyanLight),
  emberDark: css(PALETTE.emberDark),
  ember: css(PALETTE.ember),
  steam: css(PALETTE.steam),
  verdigrisDark: css(PALETTE.verdigrisDark),
  verdigris: css(PALETTE.verdigris),
  verdigrisLight: css(PALETTE.verdigrisLight),
  violetDark: css(PALETTE.violetDark),
  violet: css(PALETTE.violet),
  violetLight: css(PALETTE.violetLight),
  violetPale: css(PALETTE.violetPale),
  dusk0: css(PALETTE.dusk0),
  dusk1: css(PALETTE.dusk1),
  dusk2: css(PALETTE.dusk2),
  dusk3: css(PALETTE.dusk3),
  skyClear0: css(PALETTE.skyClear0),
  skyClear1: css(PALETTE.skyClear1),
  skyClear2: css(PALETTE.skyClear2),
  skyClear3: css(PALETTE.skyClear3),
  green0: css(PALETTE.green0),
  green1: css(PALETTE.green1),
  green2: css(PALETTE.green2),
  green3: css(PALETTE.green3),
};
