import * as THREE from 'three'
import { DECAL_LAYER, groundDecal, toon } from '../render/materials.js'
import { moveAlongSphere } from '../core/sphere.js'

/**
 * Flat surfaces that hug the planet: roads, pavements, kerbs, plazas.
 *
 * Everything is built from quad strips between two polylines, which is enough
 * for every ground feature in the game and keeps the vertex count low.
 */

const _up = new THREE.Vector3()
const _tan = new THREE.Vector3()
const _side = new THREE.Vector3()
const _tmp = new THREE.Vector3()

/**
 * Take a list of unit directions and produce a parallel list offset sideways
 * by `metres`, following the great circle rather than a straight chord.
 */
export function offsetPath(dirs, metres, radius) {
  const out = []
  const n = dirs.length
  for (let i = 0; i < n; i++) {
    const d = dirs[i]
    const prev = dirs[Math.max(0, i - 1)]
    const next = dirs[Math.min(n - 1, i + 1)]
    _up.copy(d).normalize()
    _tan.copy(next).sub(prev)
    _tan.addScaledVector(_up, -_up.dot(_tan))
    if (_tan.lengthSq() < 1e-12) _tan.set(1, 0, 0).cross(_up)
    _tan.normalize()
    _side.crossVectors(_up, _tan).normalize()
    out.push(moveAlongSphere(_up, _side, metres / radius, new THREE.Vector3()))
  }
  return out
}

/** Lift a list of directions to world points at terrain height + offset. */
export function toSurfacePoints(dirs, terrain, lift) {
  return dirs.map((d) => terrain.surfacePoint(d, lift, new THREE.Vector3()))
}

/**
 * A quad strip between two equal-length point lists. `ups` supplies the
 * normals; pass the direction list so lighting matches the ground.
 */
export function stripBetween(left, right, ups, color, opts = {}) {
  const n = Math.min(left.length, right.length)
  if (n < 2) return null
  const positions = new Float32Array(n * 2 * 3)
  const normals = new Float32Array(n * 2 * 3)
  const uvs = new Float32Array(n * 2 * 2)
  const indices = []

  for (let i = 0; i < n; i++) {
    const l = left[i]
    const r = right[i]
    const u = ups[i]
    positions[i * 6 + 0] = l.x
    positions[i * 6 + 1] = l.y
    positions[i * 6 + 2] = l.z
    positions[i * 6 + 3] = r.x
    positions[i * 6 + 4] = r.y
    positions[i * 6 + 5] = r.z
    normals[i * 6 + 0] = u.x
    normals[i * 6 + 1] = u.y
    normals[i * 6 + 2] = u.z
    normals[i * 6 + 3] = u.x
    normals[i * 6 + 4] = u.y
    normals[i * 6 + 5] = u.z
    const v = i * (opts.vScale ?? 0.25)
    uvs[i * 4 + 0] = 0
    uvs[i * 4 + 1] = v
    uvs[i * 4 + 2] = 1
    uvs[i * 4 + 3] = v
    if (i < n - 1) {
      const a = i * 2
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  }

  /**
   * Callers hand the two edges over in whichever order suits them — a kerb is
   * authored top-to-bottom, a pavement inner-to-outer, and which of those is
   * "left" flips with the side of the road. Rather than make every call site
   * reason about winding, check the first triangle against the surface normal
   * and reverse the whole strip if it came out inside out.
   *
   * Getting this wrong is invisible in the geometry and total on screen:
   * backface culling drops a reversed strip completely, which is how the left
   * pavement and every zebra crossing turned into see-through gaps in the road.
   */
  _tmp.set(
    positions[6] - positions[0],
    positions[7] - positions[1],
    positions[8] - positions[2],
  )
  _side.set(
    positions[3] - positions[0],
    positions[4] - positions[1],
    positions[5] - positions[2],
  )
  _up.crossVectors(_tmp, _side)
  if (_up.dot(ups[0]) < 0) {
    for (let i = 0; i < indices.length; i += 3) {
      const swap = indices[i + 1]
      indices[i + 1] = indices[i + 2]
      indices[i + 2] = swap
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeBoundingSphere()
  const mesh = new THREE.Mesh(geo, groundDecal(color, opts.material))
  mesh.receiveShadow = true
  return mesh
}

/**
 * A road: tarmac, kerbs on both sides, and optional dashed centre line.
 * `dirs` are unit directions along the centreline.
 */
export function buildRoad(dirs, terrain, opts = {}) {
  const {
    width = 6,
    pavement = 1.9,
    roadColor,
    pavementColor,
    lineColor,
    kerbHeight = 0.2,
    dashed = true,
    edgeLines = false,
  } = opts

  const radius = terrain.radius
  const g = new THREE.Group()
  const half = width * 0.5

  const ups = dirs.map((d) => d.clone().normalize())
  const leftDirs = offsetPath(dirs, -half, radius)
  const rightDirs = offsetPath(dirs, half, radius)
  const outerL = offsetPath(dirs, -(half + pavement), radius)
  const outerR = offsetPath(dirs, half + pavement, radius)

  /**
   * Deck height per station: the highest ground anywhere across the full
   * width, so the carriageway is level from kerb to kerb.
   *
   * A road is one flat quad across its width, and the ground under it rises by
   * as much as 3.8 metres from one kerb to the other. Following the centreline
   * alone left the surface buried on the uphill side — that is what put wedges
   * of grass in the middle of the tarmac. Sitting on the high point instead
   * turns the road into an embankment, which is what a real one is.
   */
  // Sampled at ~1m across the width. The terrain mesh cell is about 2.1m, so
  // anything coarser lets a ridge slip between two samples and poke through
  // the finished surface.
  const span = half + pavement
  const crossSteps = Math.max(6, Math.ceil((span * 2) / 1.0))
  const crossPaths = []
  for (let k = 0; k <= crossSteps; k++) {
    const off = -span + (k / crossSteps) * span * 2
    crossPaths.push(Math.abs(off) < 1e-6 ? dirs : offsetPath(dirs, off, radius))
  }
  const deck = dirs.map((_, i) => {
    let h = terrain.seaLevel
    for (let k = 0; k < crossPaths.length; k++) {
      const q = terrain.renderHeightAt(crossPaths[k][i])
      if (q > h) h = q
    }
    return h
  })

  /** Lift a direction list onto the deck rather than onto the ground. */
  const onDeck = (path, lift) =>
    path.map((d, i) => d.clone().normalize().multiplyScalar(radius + deck[i] + lift))

  const road = stripBetween(onDeck(leftDirs, 0.1), onDeck(rightDirs, 0.1), ups, roadColor, {
    material: { layer: DECAL_LAYER.road },
  })
  if (road) g.add(road)

  if (pavement > 0) {
    for (const sign of [-1, 1]) {
      const inner = sign < 0 ? leftDirs : rightDirs
      const outer = sign < 0 ? outerL : outerR
      const top = stripBetween(onDeck(inner, kerbHeight), onDeck(outer, kerbHeight), ups, pavementColor)
      if (top) g.add(top)

      const sideNormals = ups.map((u, i) => {
        const tan = new THREE.Vector3().subVectors(
          dirs[Math.min(dirs.length - 1, i + 1)],
          dirs[Math.max(0, i - 1)],
        )
        const uu = u.clone()
        tan.addScaledVector(uu, -uu.dot(tan)).normalize()
        return new THREE.Vector3().crossVectors(uu, tan).multiplyScalar(-sign)
      })

      // Vertical kerb face so the edge catches an ink line.
      const face = stripBetween(onDeck(inner, kerbHeight), onDeck(inner, 0.06), sideNormals, pavementColor)
      if (face) g.add(face)

      // Embankment: ties the raised deck back down into the hillside. Without
      // it the road reads as a ribbon hanging in the air wherever it is cut
      // across a slope.
      const toe = offsetPath(dirs, sign * (half + pavement + 1.7), radius)
      const skirt = stripBetween(
        onDeck(outer, kerbHeight),
        toe.map((d) => terrain.surfacePoint(d, -0.12, new THREE.Vector3())),
        sideNormals,
        pavementColor,
      )
      if (skirt) g.add(skirt)
    }
  }

  // Markings ride the deck too. Left on the ground they sank under the raised
  // carriageway and came back as broken scraps of white.
  if (dashed) {
    // Long dash, long gap. Short ones a couple of stations wide broke up into
    // flickering specks as soon as the road ran away from the camera, which is
    // what made the centreline look shredded on a phone.
    const seg = 4
    for (let i = 0; i + seg <= dirs.length - 1; i += seg * 2) {
      const slice = dirs.slice(i, i + seg + 1)
      const sUps = ups.slice(i, i + seg + 1)
      const sDeck = deck.slice(i, i + seg + 1)
      const lift = (path) =>
        path.map((d, k) => d.clone().normalize().multiplyScalar(radius + sDeck[k] + 0.14))
      const dash = stripBetween(
        lift(offsetPath(slice, -0.22, radius)),
        lift(offsetPath(slice, 0.22, radius)),
        sUps,
        lineColor,
        { material: { layer: DECAL_LAYER.marking } },
      )
      if (dash) g.add(dash)
    }
  }

  if (edgeLines) {
    for (const sign of [-1, 1]) {
      const line = stripBetween(
        onDeck(offsetPath(dirs, sign * (half - 0.6), radius), 0.14),
        onDeck(offsetPath(dirs, sign * (half - 0.34), radius), 0.14),
        ups,
        lineColor,
        { material: { layer: DECAL_LAYER.marking } },
      )
      if (line) g.add(line)
    }
  }

  return g
}

/**
 * Zebra crossing. Stripes run across the road (the way pedestrians walk) and
 * are spaced along the direction of traffic.
 */
export function buildCrossing(centerDir, forwardDir, terrain, width, color) {
  const g = new THREE.Group()
  const radius = terrain.radius
  const up = centerDir.clone().normalize()
  const fwd = forwardDir.clone()
  fwd.addScaledVector(up, -up.dot(fwd))
  if (fwd.lengthSq() < 1e-9) return g
  fwd.normalize()
  const side = new THREE.Vector3().crossVectors(up, fwd).normalize()

  const bars = 5
  const span = 3.2
  const barHalf = 0.26
  const halfWidth = width * 0.5 - 0.15

  for (let i = 0; i < bars; i++) {
    const t = (i / (bars - 1) - 0.5) * span
    const base = moveAlongSphere(up, fwd, t / radius, new THREE.Vector3())
    const near = moveAlongSphere(base, fwd, -barHalf / radius, new THREE.Vector3())
    const far = moveAlongSphere(base, fwd, barHalf / radius, new THREE.Vector3())
    const nL = moveAlongSphere(near, side, -halfWidth / radius, new THREE.Vector3())
    const nR = moveAlongSphere(near, side, halfWidth / radius, new THREE.Vector3())
    const fL = moveAlongSphere(far, side, -halfWidth / radius, new THREE.Vector3())
    const fR = moveAlongSphere(far, side, halfWidth / radius, new THREE.Vector3())
    const strip = stripBetween(
      [terrain.surfacePoint(nL, 0.095, new THREE.Vector3()), terrain.surfacePoint(nR, 0.095, new THREE.Vector3())],
      [terrain.surfacePoint(fL, 0.095, new THREE.Vector3()), terrain.surfacePoint(fR, 0.095, new THREE.Vector3())],
      [up, up],
      color,
      { material: { layer: DECAL_LAYER.marking } },
    )
    if (strip) g.add(strip)
  }
  return g
}

/** A flat disc of paving, for plazas and temple courtyards. */
export function buildPlaza(centerDir, radiusMetres, terrain, color, segments = 40) {
  const R = terrain.radius
  const up = centerDir.clone().normalize()
  const ref = Math.abs(up.y) > 0.99 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0)
  const east = new THREE.Vector3().crossVectors(ref, up).normalize()
  const north = new THREE.Vector3().crossVectors(up, east).normalize()

  // Below the road surface (0.06) on purpose. The plaza used to sit at 0.11 —
  // physically above every street crossing it — and its warm paving punched
  // through the tarmac as ragged sand-coloured shards wherever the depth bias
  // could not make up a five-centimetre real difference.
  const positions = [terrain.surfacePoint(up, 0.04, new THREE.Vector3())]
  const normals = [up.clone()]
  const rim = []
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    _tmp.copy(east).multiplyScalar(Math.cos(a)).addScaledVector(north, Math.sin(a))
    const d = moveAlongSphere(up, _tmp, radiusMetres / R, new THREE.Vector3())
    rim.push(d)
    positions.push(terrain.surfacePoint(d, 0.04, new THREE.Vector3()))
    normals.push(d.clone().normalize())
  }

  const pos = new Float32Array(positions.length * 3)
  const nor = new Float32Array(positions.length * 3)
  const uv = new Float32Array(positions.length * 2)
  positions.forEach((p, i) => {
    pos[i * 3] = p.x
    pos[i * 3 + 1] = p.y
    pos[i * 3 + 2] = p.z
    nor[i * 3] = normals[i].x
    nor[i * 3 + 1] = normals[i].y
    nor[i * 3 + 2] = normals[i].z
    uv[i * 2] = 0.5
    uv[i * 2 + 1] = 0.5
  })
  const idx = []
  for (let i = 1; i < positions.length - 1; i++) idx.push(0, i, i + 1)
  idx.push(0, positions.length - 1, 1)

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geo.setIndex(idx)
  geo.computeBoundingSphere()
  const mesh = new THREE.Mesh(geo, groundDecal(color))
  mesh.receiveShadow = true
  return { mesh, rim }
}

/**
 * The ocean: a translucent sphere at sea level, vertex-coloured by the depth
 * of the seabed underneath. One flat teal from shore to horizon was most of
 * why the coast read as a paint fill — a bright lagoon rim over the shallows,
 * deepening offshore, is what makes it read as water.
 */
export function buildOcean(terrain, color, deepColor) {
  const geo = new THREE.SphereGeometry(terrain.radius + 0.02, 128, 88)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const shallow = new THREE.Color(0x8ce8d8)
  const mid = new THREE.Color(color)
  const deep = new THREE.Color(deepColor)
  const d = new THREE.Vector3()
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    d.fromBufferAttribute(pos, i).normalize()
    const depth = -terrain.heightAt(d)
    if (depth <= 0.7) c.copy(shallow)
    else if (depth < 4.2) c.copy(shallow).lerp(mid, (depth - 0.7) / 3.5)
    else c.copy(mid).lerp(deep, Math.min(1, (depth - 4.2) / 7))
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const mat = toon(0xffffff, { vertexColors: true, transparent: true, opacity: 0.9, cache: false })
  mat.depthWrite = true
  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = 'ocean'
  mesh.receiveShadow = false
  return mesh
}
