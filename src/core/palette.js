/**
 * Nayanika colour system.
 *
 * Everything in the game reads from here so the whole planet can be re-graded
 * from one place. Values are authored as hex ints because that is what
 * three.js wants, and grouped by what they describe rather than by hue.
 */

export const INK = 0x16181a

export const SKY = {
  horizon: 0x63cfc5,
  zenith: 0x3fb4b0,
  cloudNear: 0xc7f0e7,
  cloudFar: 0x93e0d5,
  fog: 0x74d3c9,
}

export const GROUND = {
  grass: 0x7fb083,
  grassDry: 0x9dbe86,
  dirt: 0xb9a882,
  sand: 0xe7dab8,
  rock: 0x9b9d94,
  rockDark: 0x7d8079,
  snow: 0xecf1ea,
  road: 0x93aaa2,
  roadDark: 0x7d958e,
  pavement: 0xc4ccc1,
  pavementWarm: 0xd7d5c4,
  line: 0xf4f6f0,
  lineWarm: 0xf0d98a,
  water: 0x4fb9c4,
  waterDeep: 0x2f8fa2,
  foam: 0xe8f7f3,
}

export const BUILD = {
  cream: 0xe9e3d2,
  bone: 0xf0efe6,
  mint: 0xc6d6c2,
  sage: 0xa8bfa6,
  blush: 0xe7b6ac,
  clay: 0xd08d7c,
  ash: 0xb4b9b1,
  slate: 0x8b938f,
  tan: 0xd9cba6,
  ochre: 0xc9a15c,
  window: 0x23292b,
  windowLit: 0x3b4a4c,
  frame: 0xeef0ea,
  roofBrown: 0x7e6a5e,
  roofSlate: 0x5f6b6b,
  roofRed: 0x9c4b46,
  concrete: 0xb0b4ac,
  concreteDark: 0x8e948d,
  wood: 0xb9975f,
  woodDark: 0x8a6c42,
  metal: 0x9aa3a5,
  metalDark: 0x6c7476,
}

export const ACCENT = {
  red: 0xc6394a,
  deepRed: 0x9d2b39,
  orange: 0xe4622f,
  amber: 0xf2c24b,
  yellow: 0xf5d33f,
  green: 0x4fae63,
  jade: 0x35bfa0,
  teal: 0x2f9c9c,
  blue: 0x3fa7c9,
  navy: 0x2c4a6b,
  purple: 0x7a5c9e,
  pink: 0xe58fa5,
  white: 0xf7f6f0,
  black: 0x1b1d1e,
}

export const NATURE = {
  leaf: 0x5fa663,
  leafDark: 0x3f8250,
  leafLight: 0x8cc275,
  pine: 0x3d7a55,
  trunk: 0x7a6046,
  trunkDark: 0x5d4832,
  bush: 0x6aab6d,
  bamboo: 0x93b96a,
  flowerA: 0xe8697f,
  flowerB: 0xf3c650,
  flowerC: 0xe9f0f2,
}

/** The player's default look. Wardrobe entries override these at runtime. */
export const CHAR = {
  skin: 0xf4cdb0,
  hair: 0x1a1a1c,
  shirt: 0xf3efe2,
  shorts: 0x212223,
  socks: 0xf2f0e8,
  shoes: 0x35bfa0,
  bag: 0xc43a4a,
  strap: 0xd8cbb2,
  eye: 0x1b1d1e,
}

/** Skin tones offered in the wardrobe, warm to cool. */
export const SKIN_TONES = [0xf7d9c0, 0xf4cdb0, 0xe4b189, 0xc98f63, 0x9c6540, 0x6f452b]

export const HAIR_COLORS = [0x1a1a1c, 0x40352c, 0x7a5638, 0xb98d52, 0xd8d2c6, 0x2f4f63, 0x7d3a4a]

export const CLOTH_COLORS = [
  0xf3efe2, 0x212223, 0xc6394a, 0x3fa7c9, 0x4fae63, 0xf2c24b, 0xe58fa5, 0x7a5c9e, 0xe4622f, 0x9aa3a5,
]

export default { INK, SKY, GROUND, BUILD, ACCENT, NATURE, CHAR }
