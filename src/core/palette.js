/**
 * Nayanika colour system — Bali grade.
 *
 * Everything in the game reads from here so the whole planet can be re-graded
 * from one place. Values are authored as hex ints because that is what
 * three.js wants, and grouped by what they describe rather than by hue.
 *
 * The palette is pulled from a Balinese afternoon: hard tropical sun, paras
 * stone the colour of wet ash, alang-alang thatch, terracotta, and rice in
 * every stage between young green and ready-to-cut gold.
 */

export const INK = 0x1a1714

export const SKY = {
  horizon: 0xa8e2df,
  zenith: 0x46a9d6,
  cloudNear: 0xfffdf4,
  cloudFar: 0xdaf1ec,
  fog: 0xb2e4de,
  /** Fills the shadows. Bounced sky, so cool. */
  ambient: 0xbfe3ec,
  hemiSky: 0xd8f2f0,
  hemiGround: 0x8a9b6a,
}

export const GROUND = {
  /** Young padi. */
  grass: 0x74b45a,
  /** Padi about a week off harvest. */
  grassDry: 0xc9bc63,
  dirt: 0xa9754e,
  /** Sanur-side white sand. */
  sand: 0xeddfba,
  /** Volcanic sand on the west coast. */
  sandDark: 0x877c6d,
  /** Paras — the soft grey stone every temple is carved from. */
  rock: 0x9ba098,
  rockDark: 0x6b6e69,
  /** Bare ash near the summit. There is no snow on this planet. */
  snow: 0xdcd8cc,
  road: 0x8f9a94,
  roadDark: 0x77827d,
  pavement: 0xd6cfbb,
  pavementWarm: 0xe2d5b4,
  line: 0xf6f3e8,
  lineWarm: 0xf0d98a,
  water: 0x37b6c2,
  waterDeep: 0x1c7f9d,
  foam: 0xeaf8f4,
  /** Flooded paddy — sky reflected off mud. */
  paddy: 0x8fc4a8,
  paddyDeep: 0x6ba98d,
}

export const BUILD = {
  cream: 0xf0e7d2,
  bone: 0xf6f1e4,
  mint: 0xc8d8c4,
  sage: 0xa4bb9c,
  blush: 0xe8b5a4,
  clay: 0xcf8468,
  ash: 0xb2b4aa,
  slate: 0x878e88,
  tan: 0xd9c79e,
  ochre: 0xc99a4e,
  window: 0x23292b,
  windowLit: 0x3b4a4c,
  frame: 0xf1efe6,
  roofBrown: 0x7a5f45,
  roofSlate: 0x5d635e,
  /** Genteng — terracotta pantile. */
  roofRed: 0xb35a3d,
  concrete: 0xb0b2a8,
  concreteDark: 0x8b8e85,
  wood: 0xb08344,
  woodDark: 0x7d5a2c,
  metal: 0x9aa3a5,
  metalDark: 0x6c7476,

  /* --- Bali-specific ------------------------------------------------ */
  /** Paras stone: temple gates, shrines, statues. */
  paras: 0xa6a99e,
  parasDark: 0x83877e,
  /** Bata merah — the red brick every compound wall is built from. */
  bata: 0xa85c42,
  bataDark: 0x88452f,
  /** Alang-alang grass thatch. */
  thatch: 0xa8874f,
  thatchDark: 0x7c6136,
  /** Ijuk — black sugar-palm fibre, what meru roofs are actually made of. */
  ijuk: 0x453b32,
  ijukLight: 0x5e5145,
  /** Prada gold leaf on gates and parasols. */
  gold: 0xd8a83f,
  goldDark: 0xa87c25,
  teak: 0xb08344,
  teakDark: 0x7d5a2c,
  bamboo: 0xc4b466,
  bambooDark: 0x9a8c48,
}

export const ACCENT = {
  red: 0xc6394a,
  deepRed: 0xa32f33,
  orange: 0xe4622f,
  amber: 0xf2b93b,
  yellow: 0xf5d33f,
  green: 0x4fae63,
  jade: 0x35bfa0,
  teal: 0x2f9c9c,
  blue: 0x3fa7c9,
  navy: 0x2c4a6b,
  purple: 0x7a5c9e,
  pink: 0xe58fa5,
  white: 0xf9f6ec,
  black: 0x1b1d1e,
  /** Poleng — the black-and-white check wrapped around guardian statues. */
  polengBlack: 0x24211d,
  polengWhite: 0xf4f0e4,
  /** Saffron, the colour of a ceremony. */
  saffron: 0xe8a33a,
}

export const NATURE = {
  leaf: 0x55a24b,
  leafDark: 0x2f6b3d,
  leafLight: 0x8ac462,
  /** Stands in for cemara / casuarina up on the ridges. */
  pine: 0x35754a,
  trunk: 0x8a6a44,
  trunkDark: 0x63492e,
  bush: 0x5fa457,
  bamboo: 0x9dc25c,
  /** Frangipani — jepun. On every temple wall in the island. */
  flowerA: 0xf7f0d6,
  /** Bougainvillea — kertas. */
  flowerB: 0xd2477e,
  /** Hibiscus — pucuk. */
  flowerC: 0xd8483d,
  frangipani: 0xf7f0d6,
  frangipaniHeart: 0xf2cc57,
  bougainvillea: 0xd2477e,
  hibiscus: 0xd8483d,
  palmFrond: 0x5aa054,
  palmFrondDark: 0x3d7a44,
  /** Banana leaf, used for everything from roofs to plates. */
  banana: 0x6fb04e,
}

/** The messenger's default look. Wardrobe entries override these at runtime. */
export const CHAR = {
  skin: 0xd9a878,
  hair: 0x1d1815,
  shirt: 0xf6f1e2,
  shorts: 0x8a4a3c,
  socks: 0xf2f0e8,
  shoes: 0x2f9c9c,
  bag: 0xc6394a,
  strap: 0xd8cbb2,
  eye: 0x1b1d1e,
}

/** Skin tones offered in the wardrobe, warm to cool. */
export const SKIN_TONES = [0xf2d3b4, 0xe4b189, 0xd9a878, 0xc08a57, 0x9c6540, 0x6f452b]

export const HAIR_COLORS = [0x1d1815, 0x2f2620, 0x4a3728, 0x7a5638, 0xb98d52, 0xd8d2c6, 0x5c3a2e]

export const CLOTH_COLORS = [
  0xf6f1e2, 0x24211d, 0xc6394a, 0x3fa7c9, 0x4fae63, 0xf2b93b, 0xe58fa5, 0x7a5c9e, 0xe4622f, 0xd8a83f,
]

export default { INK, SKY, GROUND, BUILD, ACCENT, NATURE, CHAR }
