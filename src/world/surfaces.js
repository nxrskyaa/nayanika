import * as THREE from 'three'
import { groundDecal, toon } from '../render/materials.js'
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

  const road = stripBetween(
    toSurfacePoints(leftDirs, terrain, 0.06),
    toSurfacePoints(rightDirs, terrain, 0.06),
    ups,
    roadColor,
  )
  if (road) g.add(road)

  if (pavement > 0) {
    for (const sign of [-1, 1]) {
      const inner = sign < 0 ? leftDirs : rightDirs
      const outer = offsetPath(dirs, sign * (half + pavement), radius)
      const top = stripBetween(
        toSurfacePoints(inner, terrain, kerbHeight),
        toSurfacePoints(outer, terrain, kerbHeight),
        ups,
        pavementColor,
      )
      if (top) g.add(top)
      // Vertical kerb face so the edge catches an ink line.
      const face = stripBetween(
        toSurfacePoints(inner, terrain, kerbHeight),
        toSurfacePoints(inner, terrain, 0.03),
        ups.map((u, i) => {
          const t = new THREE.Vector3().subVectors(
            dirs[Math.min(dirs.length - 1, i + 1)],
            dirs[Math.max(0, i - 1)],
          )
          const uu = u.clone()
          t.addScaledVector(uu, -uu.dot(t)).normalize()
          return new THREE.Vector3().crossVectors(uu, t).multiplyScalar(-sign)
        }),
        pavementColor,
      )
      if (face) g.add(face)
    }
  }

  if (dashed) {
    const seg = 2
    for (let i = 0; i + seg <= dirs.length - 1; i += seg * 2) {
      const slice = dirs.slice(i, i + seg + 1)
      const sUps = ups.slice(i, i + seg + 1)
      const l = offsetPath(slice, -0.16, radius)
      const r = offsetPath(slice, 0.16, radius)
      const dash = stripBetween(
        toSurfacePoints(l, terrain, 0.085),
        toSurfacePoints(r, terrain, 0.085),
        sUps,
        lineColor,
      )
      if (dash) g.add(dash)
    }
  }

  if (edgeLines) {
    for (const sign of [-1, 1]) {
      const a = offsetPath(dirs, sign * (half - 0.55), radius)
      const b = offsetPath(dirs, sign * (half - 0.35), radius)
      const line = stripBetween(
        toSurfacePoints(a, terrain, 0.085),
        toSurfacePoints(b, terrain, 0.085),
        ups,
        lineColor,
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

  const positions = [terrain.surfacePoint(up, 0.11, new THREE.Vector3())]
  const normals = [up.clone()]
  const rim = []
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    _tmp.copy(east).multiplyScalar(Math.cos(a)).addScaledVector(north, Math.sin(a))
    const d = moveAlongSphere(up, _tmp, radiusMetres / R, new THREE.Vector3())
    rim.push(d)
    positions.push(terrain.surfacePoint(d, 0.11, new THREE.Vector3()))
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

/** The ocean: a slightly translucent sphere at sea level. */
export function buildOcean(terrain, color, deepColor) {
  const geo = new THREE.SphereGeometry(terrain.radius + 0.02, 96, 64)
  const mat = toon(color, { transparent: true, opacity: 0.86, cache: false })
  mat.depthWrite = true
  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = 'ocean'
  mesh.receiveShadow = false
  return mesh
}
