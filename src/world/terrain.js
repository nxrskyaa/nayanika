import * as THREE from 'three'
import { PLANET } from '../core/config.js'
import { GROUND, NATURE } from '../core/palette.js'
import { makeNoise3, fbm } from '../core/rng.js'
import { dirFromDeg, tangentBasis, moveAlongSphere } from '../core/sphere.js'
import { ZONES, zoneWeight } from './zones.js'

/**
 * The planet's heightfield.
 *
 * Height is a pure function of direction, which means props, NPCs, roads and
 * the player all agree on where the ground is without any raycasting. The mesh
 * is just a visualisation of that function.
 */

const OCEAN = {
  dir: dirFromDeg(-40, 66),
  radius: 0.52,
  falloff: 0.34,
  depth: 11,
}

/** Extra sculpting on top of the noise — peaks, bowls, cliffs. */
const FEATURES = [
  { dir: dirFromDeg(48, 188), radius: 0.2, amount: 15, power: 2.1 }, // temple peak
  { dir: dirFromDeg(28, 96), radius: 0.09, amount: 9, power: 1.6 }, // falls headland
  { dir: dirFromDeg(17, 88), radius: 0.075, amount: -9.5, power: 1.4 }, // falls plunge pool
  { dir: dirFromDeg(-8, 297), radius: 0.085, amount: 8, power: 1.8 }, // red cliff
  { dir: dirFromDeg(-13, 300), radius: 0.05, amount: -11, power: 1.2 }, // cliff drop
  { dir: dirFromDeg(2, 140), radius: 0.06, amount: 5.5, power: 1.7 }, // cave hill
  { dir: dirFromDeg(27, 156), radius: 0.14, amount: 7, power: 1.9 }, // terrace ridge
  { dir: dirFromDeg(62, 20), radius: 0.26, amount: 12, power: 2.0 }, // north massif
  { dir: dirFromDeg(-64, 170), radius: 0.28, amount: 10, power: 2.0 }, // south massif
]

/**
 * The six cube faces the terrain mesh is built from: [normal, up, right].
 * Shared so renderHeightAt() can reproduce exactly the surface buildGeometry()
 * draws — they must never drift apart.
 */
const CUBE_FACES = [
  [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1)],
  [new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)],
  [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)],
  [new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0)],
  [new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0)],
  [new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0)],
]

const _d = new THREE.Vector3()
const _e = new THREE.Vector3()
const _n = new THREE.Vector3()
const _p0 = new THREE.Vector3()
const _p1 = new THREE.Vector3()
const _p2 = new THREE.Vector3()
const _t1 = new THREE.Vector3()
const _t2 = new THREE.Vector3()
const _c0 = new THREE.Vector3()
const _cA = new THREE.Color()
const _cB = new THREE.Color()

function smoothFalloff(ang, radius, falloff) {
  if (ang <= radius) return 1
  const t = (ang - radius) / falloff
  if (t >= 1) return 0
  const s = 1 - t
  return s * s * (3 - 2 * s)
}

export class Terrain {
  constructor(seed = 20260727) {
    this.radius = PLANET.radius
    this.n1 = makeNoise3(seed)
    this.n2 = makeNoise3(seed + 991)
    this.n3 = makeNoise3(seed + 4127)
    this.seaLevel = 0
    /** Cache of the last few queries — the player hammers this every frame. */
    this._cacheKey = null
    this._cacheVal = 0
  }

  /** Raw terrain before districts flatten it. */
  _wildHeight(x, y, z) {
    const continent = fbm(this.n1, x * 1.05, y * 1.05, z * 1.05, 4, 2.1, 0.52)
    const ridged = 1 - Math.abs(fbm(this.n2, x * 2.4, y * 2.4, z * 2.4, 4, 2.05, 0.5))
    const detail = fbm(this.n3, x * 6.5, y * 6.5, z * 6.5, 3, 2.2, 0.45)
    return 9.5 + continent * 8.2 + (ridged - 0.55) * 6.4 + detail * 1.15
  }

  /**
   * Altitude above sea level for a unit direction. Negative means underwater.
   */
  heightAt(dir) {
    const x = dir.x
    const y = dir.y
    const z = dir.z
    let h = this._wildHeight(x, y, z)

    /**
     * Ocean basin.
     *
     * The rim is pushed in and out by low-frequency noise, and a second band of
     * finer noise ripples the last stretch before the shore. A plain circular
     * falloff put the coastline on a perfect circle, which is why the sea read
     * as a round pond stamped into the island rather than a coast — the shape
     * of the shoreline is almost all of what makes water look like sea.
     */
    const oceanAng = Math.acos(THREE.MathUtils.clamp(x * OCEAN.dir.x + y * OCEAN.dir.y + z * OCEAN.dir.z, -1, 1))
    const coastWobble =
      fbm(this.n2, x * 1.6, y * 1.6, z * 1.6, 3, 2.1, 0.5) * 0.085 +
      fbm(this.n3, x * 4.1, y * 4.1, z * 4.1, 2, 2.2, 0.5) * 0.028
    const ow = smoothFalloff(oceanAng, OCEAN.radius + coastWobble, OCEAN.falloff)
    // Bays and headlands: shallow water gets an extra ripple so the waterline
    // meanders instead of following one contour.
    const shore = ow > 0.02 && ow < 0.55 ? fbm(this.n1, x * 7.5, y * 7.5, z * 7.5, 2, 2.1, 0.5) * 1.5 : 0
    h -= ow * OCEAN.depth + shore

    // Hand-placed peaks and bowls.
    for (let i = 0; i < FEATURES.length; i++) {
      const f = FEATURES[i]
      const a = Math.acos(THREE.MathUtils.clamp(x * f.dir.x + y * f.dir.y + z * f.dir.z, -1, 1))
      if (a > f.radius * 2.4) continue
      const t = Math.max(0, 1 - a / (f.radius * 2.0))
      h += f.amount * Math.pow(t, f.power)
    }

    // Districts flatten whatever is under them.
    let wSum = 0
    let hSum = 0
    let flat = 0
    for (let i = 0; i < ZONES.length; i++) {
      const zn = ZONES[i]
      const w = zoneWeight(zn, dir)
      if (w <= 0) continue
      wSum += w
      hSum += w * zn.height
      flat = Math.max(flat, w * zn.flatness)
    }
    if (wSum > 0) {
      const target = hSum / wSum
      h = h * (1 - flat) + target * flat
      // A whisper of texture so plazas are not perfectly dead flat.
      h += flat * fbm(this.n3, x * 13, y * 13, z * 13, 2, 2.1, 0.5) * 0.16
    }

    return h
  }

  /** Cached variant for the per-frame hot path. */
  heightAtCached(dir) {
    const key = `${dir.x.toFixed(5)},${dir.y.toFixed(5)},${dir.z.toFixed(5)}`
    if (key === this._cacheKey) return this._cacheVal
    this._cacheKey = key
    this._cacheVal = this.heightAt(dir)
    return this._cacheVal
  }

  /**
   * Height of the terrain *as it is actually drawn*.
   *
   * The mesh is a quad-sphere: its vertices sit exactly on heightAt(), but the
   * triangles spanning between them are flat, so across a cell the drawn
   * surface stands up to 0.4m above the analytic height. Anything positioned
   * from heightAt() alone is therefore placed underneath ground the player can
   * see — roads showed wedges of grass through the tarmac, and props sank into
   * the hillside. Taking the higher of the two puts everything on the surface
   * that is really on screen.
   */
  renderHeightAt(dir) {
    const x = dir.x
    const y = dir.y
    const z = dir.z
    const analytic = this.heightAt(dir)

    // Which cube face, and where on it.
    let face = 0
    let best = -2
    for (let f = 0; f < 6; f++) {
      const n = CUBE_FACES[f][0]
      const v = x * n.x + y * n.y + z * n.z
      if (v > best) {
        best = v
        face = f
      }
    }
    if (best <= 1e-6) return analytic

    const [normal, up, right] = CUBE_FACES[face]
    const a = (x * right.x + y * right.y + z * right.z) / best
    const b = (x * up.x + y * up.y + z * up.z) / best

    const seg = PLANET.faceSegments
    const fi = ((a + 1) * 0.5) * seg
    const fj = ((b + 1) * 0.5) * seg
    const i = Math.min(seg - 1, Math.max(0, Math.floor(fi)))
    const j = Math.min(seg - 1, Math.max(0, Math.floor(fj)))
    const s = fi - i
    const tt = fj - j

    const corner = (ii, jj) => {
      const ca = (ii / seg) * 2 - 1
      const cb = (jj / seg) * 2 - 1
      _c0.copy(normal).addScaledVector(right, ca).addScaledVector(up, cb).normalize()
      return this.heightAt(_c0)
    }

    // buildGeometry splits each quad along the (i,j)–(i+1,j+1) diagonal.
    let mesh
    if (s + tt <= 1) {
      const h00 = corner(i, j)
      mesh = h00 + (corner(i + 1, j) - h00) * s + (corner(i, j + 1) - h00) * tt
    } else {
      const h11 = corner(i + 1, j + 1)
      mesh = h11 + (corner(i, j + 1) - h11) * (1 - s) + (corner(i + 1, j) - h11) * (1 - tt)
    }
    return mesh > analytic ? mesh : analytic
  }

  /** World-space point on the ground for a direction. */
  surfacePoint(dir, offset = 0, out = new THREE.Vector3()) {
    const h = Math.max(this.renderHeightAt(dir), this.seaLevel)
    return out.copy(dir).normalize().multiplyScalar(this.radius + h + offset)
  }

  /** Ground normal from finite differences of the heightfield. */
  normalAt(dir, out = new THREE.Vector3()) {
    const eps = 0.0022
    tangentBasis(dir, _t1, _t2)
    const h0 = this.heightAt(dir)
    _p0.copy(dir).multiplyScalar(this.radius + h0)

    moveAlongSphere(dir, _t1, eps, _d)
    _p1.copy(_d).multiplyScalar(this.radius + this.heightAt(_d))
    moveAlongSphere(dir, _t2, eps, _e)
    _p2.copy(_e).multiplyScalar(this.radius + this.heightAt(_e))

    _p1.sub(_p0)
    _p2.sub(_p0)
    // east x north points away from the core, so this is already the outward
    // normal. Negating it — as this did — pointed every normal on the planet
    // into the ground: the terrain was permanently lit from underneath and so
    // never showed a light/shade terminator, and slopeAt() came back at ~2.8
    // radians everywhere, which told the scatter pass the whole world was a
    // cliff and left the wilderness completely bare.
    return out.crossVectors(_p1, _p2).normalize()
  }

  /** Steepness in radians, 0 = flat ground. */
  slopeAt(dir, normal = null) {
    const n = normal || this.normalAt(dir, _n)
    return Math.acos(THREE.MathUtils.clamp(n.dot(_d.copy(dir).normalize()), -1, 1))
  }

  /**
   * Ground colour. Height bands give the broad strokes, the dominant district
   * biome tints on top, and a little noise keeps it from looking like plastic.
   * Pass the surface normal in if you already have it — it is the expensive
   * part of the slope test.
   */
  colorAt(dir, height, out = new THREE.Color(), normal = null) {
    const h = height
    let base

    // Bands read bottom to top: shore sand, wet green paddy country, drier
    // upland, paras stone, then bare volcanic ash near the summit. No snow —
    // this is a tropical island that happens to have a mountain on it.
    if (h < 0.6) base = _cA.setHex(GROUND.sand)
    else if (h < 2.2) base = _cA.setHex(GROUND.sand).lerp(_cB.setHex(GROUND.grass), (h - 0.6) / 1.6)
    else if (h < 12) base = _cA.setHex(GROUND.grass)
    else if (h < 17) base = _cA.setHex(GROUND.grass).lerp(_cB.setHex(GROUND.grassDry), (h - 12) / 5)
    else if (h < 22) base = _cA.setHex(GROUND.grassDry).lerp(_cB.setHex(GROUND.rock), (h - 17) / 5)
    else if (h < 28) base = _cA.setHex(GROUND.rock).lerp(_cB.setHex(GROUND.rockDark), (h - 22) / 6)
    else base = _cA.setHex(GROUND.rockDark).lerp(_cB.setHex(GROUND.snow), Math.min(1, (h - 28) / 6))

    out.copy(base)

    // Biome tint from whichever district is strongest here.
    let bestW = 0
    let bestZone = null
    for (let i = 0; i < ZONES.length; i++) {
      const w = zoneWeight(ZONES[i], dir)
      if (w > bestW) {
        bestW = w
        bestZone = ZONES[i]
      }
    }
    if (bestZone && bestW > 0.02) {
      const tint = BIOME_TINT[bestZone.biome]
      if (tint) out.lerp(_cB.setHex(tint), bestW * (BIOME_STRENGTH[bestZone.biome] ?? 0.7))
    }

    // Slope shows bare rock.
    const slope = this.slopeAt(dir, normal)
    if (slope > 0.5) {
      out.lerp(_cB.setHex(GROUND.rockDark), Math.min(1, (slope - 0.5) / 0.55) * 0.8)
    }

    // Mottling.
    const v = fbm(this.n2, dir.x * 22, dir.y * 22, dir.z * 22, 2, 2.2, 0.5)
    const k = 1 + v * 0.055
    out.r = THREE.MathUtils.clamp(out.r * k, 0, 1)
    out.g = THREE.MathUtils.clamp(out.g * k, 0, 1)
    out.b = THREE.MathUtils.clamp(out.b * k, 0, 1)
    return out
  }

  /**
   * Build the visual mesh as a quad-sphere. Normals come from the heightfield
   * rather than the triangles so the six faces meet without a visible seam.
   */
  buildGeometry(segments = PLANET.faceSegments) {
    const faces = CUBE_FACES

    const per = (segments + 1) * (segments + 1)
    const total = per * 6
    const positions = new Float32Array(total * 3)
    const normals = new Float32Array(total * 3)
    const colors = new Float32Array(total * 3)
    const indices = []

    const dir = new THREE.Vector3()
    const nrm = new THREE.Vector3()
    const col = new THREE.Color()

    let v = 0
    for (let f = 0; f < 6; f++) {
      const [normal, up, right] = faces[f]
      const base = f * per
      for (let j = 0; j <= segments; j++) {
        const b = (j / segments) * 2 - 1
        for (let i = 0; i <= segments; i++) {
          const a = (i / segments) * 2 - 1
          dir
            .copy(normal)
            .addScaledVector(right, a)
            .addScaledVector(up, b)
            .normalize()

          const h = Math.max(this.heightAt(dir), this.seaLevel - 1.2)
          const r = this.radius + h
          positions[v * 3] = dir.x * r
          positions[v * 3 + 1] = dir.y * r
          positions[v * 3 + 2] = dir.z * r

          this.normalAt(dir, nrm)
          normals[v * 3] = nrm.x
          normals[v * 3 + 1] = nrm.y
          normals[v * 3 + 2] = nrm.z

          this.colorAt(dir, h, col, nrm)
          colors[v * 3] = col.r
          colors[v * 3 + 1] = col.g
          colors[v * 3 + 2] = col.b
          v++
        }
      }

      // The six cube faces are not all authored with the same handedness: on
      // three of them `right x up` points along the face normal and on three it
      // points the other way. Emitting one fixed index order therefore wound
      // four of the six faces inside out, and backface culling made two thirds
      // of the planet's ground invisible — you could see straight through the
      // island. Pick the order per face instead.
      const outward = _t1.crossVectors(right, up).dot(normal) > 0
      for (let j = 0; j < segments; j++) {
        for (let i = 0; i < segments; i++) {
          const a = base + j * (segments + 1) + i
          const b = a + 1
          const c = a + segments + 1
          const d = c + 1
          if (outward) indices.push(a, b, d, a, d, c)
          else indices.push(a, d, b, a, c, d)
        }
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.setIndex(indices)
    geo.computeBoundingSphere()
    return geo
  }
}

const BIOME_TINT = {
  town: GROUND.grassDry,
  beach: GROUND.sand,
  forest: NATURE.leafDark,
  falls: NATURE.bush,
  temple: GROUND.rock,
  industry: GROUND.rockDark,
  /** Uluwatu is pale limestone, not red rock. */
  cliff: 0xcabf9f,
  graveyard: 0x93a486,
  rice: GROUND.paddy,
}

const BIOME_STRENGTH = {
  town: 0.45,
  beach: 0.85,
  forest: 0.5,
  falls: 0.5,
  temple: 0.6,
  industry: 0.55,
  cliff: 0.62,
  graveyard: 0.55,
  rice: 0.6,
}
