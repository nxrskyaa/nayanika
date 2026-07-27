import * as THREE from 'three'
import { dirFromDeg } from '../core/sphere.js'

/**
 * The planet is a ring of hand-placed districts. Everything else — terrain
 * height, ground colour, ambience, camera framing — is derived from whichever
 * zone you happen to be standing in.
 *
 * `radius` / `falloff` are angular, in radians. At the default planet radius
 * of 92 units, 0.10 rad ≈ 9 units of ground.
 */

export const ZONES = [
  {
    id: 'main-square',
    name: 'MAIN\nSQUARE',
    label: 'Main Square',
    center: [6, 0],
    radius: 0.115,
    falloff: 0.085,
    height: 7.0,
    flatness: 0.96,
    biome: 'town',
    ambience: 'city',
    camera: { distance: 8.6, height: 2.9 },
  },
  {
    id: 'back-streets',
    name: 'BACK\nSTREETS',
    label: 'Back Streets',
    center: [-2, 25],
    radius: 0.1,
    falloff: 0.075,
    height: 6.2,
    flatness: 0.92,
    biome: 'town',
    ambience: 'city',
    camera: { distance: 6.2, height: 2.2 },
  },
  {
    id: 'seaside',
    name: 'QUIET\nSEASIDE',
    label: 'Quiet Seaside',
    center: [-19, 52],
    radius: 0.115,
    falloff: 0.095,
    height: 1.1,
    flatness: 0.9,
    biome: 'beach',
    ambience: 'beach',
    camera: { distance: 9.4, height: 3.2 },
  },
  {
    id: 'smelly-falls',
    name: 'SMELLY\nFALLS',
    label: 'Smelly Falls',
    center: [22, 92],
    radius: 0.105,
    falloff: 0.085,
    height: 13.5,
    flatness: 0.72,
    biome: 'falls',
    ambience: 'waterfalls',
    camera: { distance: 8.2, height: 3.0 },
  },
  {
    id: 'whisper-woods',
    name: 'WHISPER\nWOODS',
    label: 'Whisper Woods',
    center: [4, 132],
    radius: 0.125,
    falloff: 0.1,
    height: 9.0,
    flatness: 0.6,
    biome: 'forest',
    ambience: 'forest',
    camera: { distance: 7.4, height: 2.6 },
  },
  {
    id: 'mountain-temple',
    name: 'MOUNTAIN\nTEMPLE',
    label: 'Mountain Temple',
    center: [44, 186],
    radius: 0.115,
    falloff: 0.12,
    height: 21.5,
    flatness: 0.55,
    biome: 'temple',
    ambience: 'temple',
    camera: { distance: 8.8, height: 3.4 },
  },
  {
    id: 'capital-corp',
    name: 'CAPITAL\nCORP.',
    label: 'Capital Corp.',
    center: [-24, 236],
    radius: 0.11,
    falloff: 0.08,
    height: 8.4,
    flatness: 0.95,
    biome: 'industry',
    ambience: 'factory',
    camera: { distance: 8.6, height: 3.0 },
  },
  {
    id: 'red-cliff',
    name: 'RED CLIFF\nHOUSE',
    label: 'Red Cliff House',
    center: [-10, 296],
    radius: 0.075,
    falloff: 0.075,
    height: 16.5,
    flatness: 0.68,
    biome: 'cliff',
    ambience: 'base',
    camera: { distance: 7.6, height: 2.8 },
  },
  {
    id: 'lucero-graveyard',
    name: 'LUCERO\nGRAVEYARD',
    label: 'Lucero Graveyard',
    center: [26, 322],
    radius: 0.08,
    falloff: 0.075,
    height: 11.0,
    flatness: 0.85,
    biome: 'graveyard',
    ambience: 'base',
    camera: { distance: 7.8, height: 2.8 },
  },
]

/** Resolved at module load so nothing has to convert degrees at runtime. */
for (const z of ZONES) {
  z.dir = dirFromDeg(z.center[0], z.center[1])
}

const _tmp = new THREE.Vector3()

/**
 * Influence of a zone at a direction: 1 inside the core, easing to 0 across
 * the falloff band. Zones overlap freely; callers blend by weight.
 */
export function zoneWeight(zone, dir) {
  const d = _tmp.copy(dir).normalize().dot(zone.dir)
  const ang = Math.acos(THREE.MathUtils.clamp(d, -1, 1))
  if (ang <= zone.radius) return 1
  const t = (ang - zone.radius) / zone.falloff
  if (t >= 1) return 0
  const s = 1 - t
  return s * s * (3 - 2 * s)
}

/** The zone the player is considered to be "in", or null out in the wild. */
export function zoneAt(dir, threshold = 0.4) {
  let best = null
  let bestW = threshold
  for (const z of ZONES) {
    const w = zoneWeight(z, dir)
    if (w > bestW) {
      bestW = w
      best = z
    }
  }
  return best
}

export function zoneById(id) {
  return ZONES.find((z) => z.id === id) || null
}

/**
 * Roads connect districts in a loop around the planet, plus a couple of
 * shortcuts. Each entry is a list of zone ids the road passes through.
 */
export const ROAD_LOOP = [
  'main-square',
  'back-streets',
  'seaside',
  'smelly-falls',
  'whisper-woods',
  'mountain-temple',
  'capital-corp',
  'red-cliff',
  'lucero-graveyard',
  'main-square',
]
