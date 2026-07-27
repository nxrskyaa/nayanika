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

  /**
   * Smooth the noise out. The jitter is independent per point, so adjacent
   * points can sit a metre apart sideways over a metre of forward travel —
   * a turn far tighter than the road is wide. Ribbon a 6.6m road along that
   * and the inner edge crosses over itself; the folded quads wind backwards
   * and get culled, which is exactly what "holes in the road" looks like.
   * Four binomial passes leave a gentle curve and no fold.
   */
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 1; i < pts.length - 1; i++) {
      pts[i].x = (pts[i - 1].x + pts[i].x * 2 + pts[i + 1].x) * 0.25
      pts[i].z = (pts[i - 1].z + pts[i].z * 2 + pts[i + 1].z) * 0.25
    }
  }
  return pts
}

/**
 * Keep the parts of a polyline inside the disc. Short runs are thrown away
 * rather than kept: a jittered line grazing the rim weaves in and out and
 * leaves a trail of two-point stubs, which is what makes a district look like
 * it has broken roads scattered through it.
 */
function clipToDisc(points, radius, minLength = 6) {
  const out = []
  let run = []
  const flush = () => {
    if (run.length < 3) return
    let len = 0
    for (let i = 1; i < run.length; i++) len += Math.hypot(run[i].x - run[i - 1].x, run[i].z - run[i - 1].z)
    if (len >= minLength) out.push(run)
  }
  for (const p of points) {
    if (Math.hypot(p.x, p.z) <= radius) run.push(p)
    else {
      flush()
      run = []
    }
  }
  flush()
  return out
}

/**
 * An irregular grid of streets clipped to the district disc, plus a ring road
 * and a plaza at the centre for the districts that want one.
 */
export function planStreets(seed, opts = {}) {
  const rng = makeRng(seed)
  const extent = opts.extent ?? 26
  const wobble = opts.wobble ?? 1.4
  const mainWidth = opts.mainWidth ?? 6.2
  const sideWidth = opts.sideWidth ?? 4.2
  const minBlock = opts.minBlock ?? 22
  const wantRing = opts.ring !== false

  /**
   * Lane offsets, symmetric about the centre with an odd count so there is
   * always a lane straight through the middle.
   *
   * The lane count is whatever leaves at least `minBlock` between neighbours.
   * That number is not cosmetic: a block has to fit a building plus a road
   * half-width and a pavement on *both* sides, so anything tighter than about
   * 20 metres leaves nowhere legal to put a house and the district comes out
   * as empty streets. Small districts therefore get a single crossroads rather
   * than a grid, which is also what a village that size actually looks like.
   */
  const reach = extent * (wantRing ? 0.7 : 0.78)
  const spans = 2 * Math.floor(reach / minBlock)
  const lanes = []
  if (spans === 0) lanes.push(0)
  else for (let i = 0; i <= spans; i++) lanes.push(-reach + (i / spans) * reach * 2)
  const middle = spans / 2

  const streets = []
  const segments = Math.max(18, Math.round(extent * 1.4))
  const clipRadius = extent * 0.97

  lanes.forEach((x, i) => {
    const line = jitterPolyline(rng, x, -extent, x, extent, segments, wobble)
    const w = i === middle ? mainWidth : sideWidth * rngRange(rng, 0.9, 1.1)
    for (const run of clipToDisc(line, clipRadius)) streets.push({ points: run, width: w, axis: 'x', at: x })
  })
  lanes.forEach((z, i) => {
    const line = jitterPolyline(rng, -extent, z, extent, z, segments, wobble)
    const w = i === middle ? mainWidth : sideWidth * rngRange(rng, 0.9, 1.1)
    for (const run of clipToDisc(line, clipRadius)) streets.push({ points: run, width: w, axis: 'z', at: z })
  })

  /**
   * Gang — short alleys hanging off the main streets, alternating parent and
   * side. On a district with no room for a second full lane these are what
   * turn one crossroads into a neighbourhood, and they are how a Balinese
   * village is actually laid out: one road, and everybody lives up an alley.
   */
  const branches = opts.branches ?? 0
  for (let i = 0; i < branches; i++) {
    const t = (i + 0.5) / branches
    const along = -reach * 0.8 + t * reach * 1.6 + rngRange(rng, -1.2, 1.2)
    const side = i % 4 < 2 ? 1 : -1
    const len = reach * rngRange(rng, 0.6, 0.88)
    const steps = Math.max(8, Math.round(len * 1.2))
    const offMainX = i % 2 === 0
    const line = offMainX
      ? jitterPolyline(rng, 0, along, side * len, along, steps, wobble * 0.5)
      : jitterPolyline(rng, along, 0, along, side * len, steps, wobble * 0.5)
    for (const run of clipToDisc(line, clipRadius, 5)) {
      streets.push({ points: run, width: sideWidth * 0.8, axis: 'gang', at: along })
    }
  }

  // Ring road outside the grid, so the two never sit on top of each other.
  if (wantRing) {
    const r = extent * 0.9
    const ring = []
    const steps = Math.max(48, Math.round(r * 3))
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2
      const rr = r + Math.sin(a * 3 + seed) * 0.7
      ring.push({ x: Math.cos(a) * rr, z: Math.sin(a) * rr })
    }
    streets.push({ points: ring, width: sideWidth * 1.05, axis: 'ring', at: r, loop: true })
  }

  return { streets, lanes, xs: lanes, zs: lanes, extent, rng }
}

/**
 * Building lots, placed as frontages along the streets rather than as one
 * block-filling slab per grid cell.
 *
 * Walking the street and dropping plots at a fixed spacing on either side is
 * what makes a village read as a village: every building sits the same
 * distance back from the same kerb and turns the same way to face it. Filling
 * block interiors instead leaves buildings floating at odd angles with their
 * backs to the road, which is most of what made this look unplanned.
 */
export function planLots(plan, opts = {}) {
  const rng = makeRng(opts.seed ?? 991)
  const { streets, extent } = plan
  const pavement = opts.pavement ?? 1.7
  const setback = opts.setback ?? 1.1
  const spacing = opts.spacing ?? 10
  const size = opts.size ?? 7.5
  const fill = opts.fill ?? 0.75
  const lots = []

  const clearOfStreets = (x, z, r) => {
    for (const s of streets) {
      const need = (s.width * 0.5 + pavement * 0.7 + r) ** 2
      for (const p of s.points) {
        if ((p.x - x) ** 2 + (p.z - z) ** 2 < need) return false
      }
    }
    return true
  }
  const clearOfLots = (x, z, r) =>
    lots.every((l) => (l.x - x) ** 2 + (l.z - z) ** 2 >= (r + Math.max(l.width, l.depth) * 0.5) ** 2)

  for (const street of streets) {
    const pts = street.points
    if (pts.length < 4) continue
    let acc = spacing * rngRange(rng, 0.2, 0.85)

    for (let i = 1; i < pts.length - 1; i++) {
      acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z)
      if (acc < spacing) continue
      acc = 0

      const dx = pts[i + 1].x - pts[i - 1].x
      const dz = pts[i + 1].z - pts[i - 1].z
      const len = Math.hypot(dx, dz) || 1
      const nx = -dz / len
      const nz = dx / len

      for (const side of [-1, 1]) {
        if (!rngChance(rng, fill)) continue
        const w = size * rngRange(rng, 0.84, 1.12)
        const d = size * rngRange(rng, 0.8, 1.06)
        const r = Math.max(w, d) * 0.5
        const off = street.width * 0.5 + pavement + setback + r
        const x = pts[i].x + nx * off * side
        const z = pts[i].z + nz * off * side

        if (Math.hypot(x, z) > extent * 0.95) continue
        if (!clearOfStreets(x, z, r * 0.8)) continue
        if (!clearOfLots(x, z, r * 0.92)) continue

        lots.push({
          x,
          z,
          width: w,
          depth: d,
          // Front (+Z local) turns back toward the kerb it was measured from.
          facing: Math.atan2(-nx * side, -nz * side),
          axis: street.axis,
        })
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

/**
 * Scatter positions inside the district that avoid the streets, and the
 * buildings if you pass the lots in — otherwise trees grow through roofs.
 */
export function scatterOffStreet(plan, count, seed, minStreetDistance = 4.5, lots = null) {
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
    if (ok && lots) {
      for (const l of lots) {
        const keep = Math.max(l.width, l.depth) * 0.5 + 1.2
        if ((l.x - x) ** 2 + (l.z - z) ** 2 < keep * keep) {
          ok = false
          break
        }
      }
    }
    if (ok) out.push({ x, z, angle: rng() * Math.PI * 2, scale: rngRange(rng, 0.8, 1.25) })
  }
  return out
}

export { rngPick }
