import { makeRng, rngRange, rngInt, rngChance, rngPick } from '../core/rng.js'

/**
 * Street and lot planning, done entirely in flat 2D metres.
 *
 * Wrapping the result onto the sphere happens later — planning in the tangent
 * plane keeps the geometry readable and means blocks stay rectangular where
 * they should be. Coordinates are (x = east, z = north) in metres from the
 * district centre.
 */

function jitterPolyline(rng, ax, az, bx, bz, segments, wobble) {
  const pts = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const edge = Math.sin(t * Math.PI)
    pts.push({
      x: ax + (bx - ax) * t + rngRange(rng, -wobble, wobble) * edge,
      z: az + (bz - az) * t + rngRange(rng, -wobble, wobble) * edge,
    })
  }
  return pts
}

function clipToDisc(points, radius) {
  const out = []
  let run = []
  for (const p of points) {
    if (Math.hypot(p.x, p.z) <= radius) run.push(p)
    else if (run.length) {
      if (run.length > 1) out.push(run)
      run = []
    }
  }
  if (run.length > 1) out.push(run)
  return out
}

/**
 * An irregular grid of streets clipped to the district disc, plus a ring road
 * and a plaza at the centre for the districts that want one.
 */
export function planStreets(seed, opts = {}) {
  const rng = makeRng(seed)
  const extent = opts.extent ?? 26
  const minGap = opts.minGap ?? 9
  const maxGap = opts.maxGap ?? 16
  const wobble = opts.wobble ?? 1.4
  const mainWidth = opts.mainWidth ?? 6.2
  const sideWidth = opts.sideWidth ?? 4.2

  const xs = []
  const zs = []
  for (let x = -extent; x <= extent; x += rngRange(rng, minGap, maxGap)) xs.push(x)
  for (let z = -extent; z <= extent; z += rngRange(rng, minGap, maxGap)) zs.push(z)

  const streets = []
  const segments = Math.max(14, Math.round(extent * 1.1))

  xs.forEach((x, i) => {
    const line = jitterPolyline(rng, x, -extent, x, extent, segments, wobble)
    const w = i === Math.floor(xs.length / 2) ? mainWidth : sideWidth * rngRange(rng, 0.85, 1.15)
    for (const run of clipToDisc(line, extent)) streets.push({ points: run, width: w, axis: 'x', at: x })
  })
  zs.forEach((z, i) => {
    const line = jitterPolyline(rng, -extent, z, extent, z, segments, wobble)
    const w = i === Math.floor(zs.length / 2) ? mainWidth : sideWidth * rngRange(rng, 0.85, 1.15)
    for (const run of clipToDisc(line, extent)) streets.push({ points: run, width: w, axis: 'z', at: z })
  })

  // Ring road just inside the district edge.
  if (opts.ring !== false) {
    const r = extent * 0.82
    const ring = []
    const steps = 40
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2
      const rr = r + Math.sin(a * 3 + seed) * 0.9
      ring.push({ x: Math.cos(a) * rr, z: Math.sin(a) * rr })
    }
    streets.push({ points: ring, width: sideWidth * 1.1, axis: 'ring', at: r, loop: true })
  }

  return { streets, xs, zs, extent, rng }
}

/**
 * Building lots: one per block, inset from the streets, with a facing angle
 * pointing at the nearest street so shopfronts never end up backwards.
 */
export function planLots(plan, opts = {}) {
  const { xs, zs, extent } = plan
  const rng = makeRng(opts.seed ?? 991)
  const inset = opts.inset ?? 3.4
  const lots = []

  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < zs.length - 1; j++) {
      const x0 = xs[i] + inset
      const x1 = xs[i + 1] - inset
      const z0 = zs[j] + inset
      const z1 = zs[j + 1] - inset
      const w = x1 - x0
      const d = z1 - z0
      if (w < 4 || d < 4) continue

      const cx = (x0 + x1) / 2
      const cz = (z0 + z1) / 2
      if (Math.hypot(cx, cz) > extent * 0.92) continue

      // Split larger blocks into a couple of plots.
      const splitX = w > 13 && rngChance(rng, 0.7)
      const splitZ = d > 13 && rngChance(rng, 0.7)
      const cols = splitX ? 2 : 1
      const rows = splitZ ? 2 : 1

      for (let a = 0; a < cols; a++) {
        for (let b = 0; b < rows; b++) {
          const pw = w / cols
          const pd = d / rows
          const px = x0 + pw * (a + 0.5)
          const pz = z0 + pd * (b + 0.5)
          // Face whichever street edge is closest.
          const dx = px - (xs[i] + xs[i + 1]) / 2
          const dz = pz - (zs[j] + zs[j + 1]) / 2
          const facing = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 0.5 : -0.5) : dz > 0 ? 0 : 1
          lots.push({
            x: px,
            z: pz,
            width: pw * rngRange(rng, 0.72, 0.92),
            depth: pd * rngRange(rng, 0.72, 0.92),
            facing: facing * Math.PI,
            block: `${i}-${j}`,
          })
        }
      }
    }
  }

  return lots
}

/**
 * Points along the street edges where props belong — poles, signs, cones,
 * vending machines. Returns {x, z, angle, side}.
 */
export function planStreetFurniture(plan, opts = {}) {
  const rng = makeRng(opts.seed ?? 4711)
  const density = opts.density ?? 0.55
  const spots = []

  for (const street of plan.streets) {
    const pts = street.points
    const half = street.width * 0.5 + rngRange(rng, 0.5, 1.1)
    for (let i = 1; i < pts.length - 1; i++) {
      if (!rngChance(rng, density)) continue
      const p = pts[i]
      const prev = pts[i - 1]
      const next = pts[i + 1]
      const tx = next.x - prev.x
      const tz = next.z - prev.z
      const len = Math.hypot(tx, tz) || 1
      const nx = -tz / len
      const nz = tx / len
      const side = rngChance(rng, 0.5) ? 1 : -1
      spots.push({
        x: p.x + nx * half * side,
        z: p.z + nz * half * side,
        angle: Math.atan2(-nx * side, -nz * side),
        side,
        streetWidth: street.width,
      })
    }
  }
  return spots
}

/** Where the pavement meets the road, used for kerbs and crossings. */
export function planCrossings(plan, opts = {}) {
  const rng = makeRng(opts.seed ?? 8123)
  const out = []
  for (const street of plan.streets) {
    if (street.loop) continue
    const pts = street.points
    for (let i = 3; i < pts.length - 3; i += rngInt(rng, 4, 8)) {
      if (!rngChance(rng, 0.4)) continue
      const p = pts[i]
      const prev = pts[i - 1]
      const next = pts[i + 1]
      const angle = Math.atan2(next.x - prev.x, next.z - prev.z)
      out.push({ x: p.x, z: p.z, angle, width: street.width })
    }
  }
  return out
}

/** Scatter positions inside the district that avoid the streets. */
export function scatterOffStreet(plan, count, seed, minStreetDistance = 4.5) {
  const rng = makeRng(seed)
  const out = []
  const { extent, streets } = plan
  let guard = count * 24
  while (out.length < count && guard-- > 0) {
    const a = rng() * Math.PI * 2
    const r = Math.sqrt(rng()) * extent
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    let ok = true
    for (const s of streets) {
      for (const p of s.points) {
        if ((p.x - x) ** 2 + (p.z - z) ** 2 < (minStreetDistance + s.width * 0.5) ** 2) {
          ok = false
          break
        }
      }
      if (!ok) break
    }
    if (ok) out.push({ x, z, angle: rng() * Math.PI * 2, scale: rngRange(rng, 0.8, 1.25) })
  }
  return out
}

export { rngPick }
