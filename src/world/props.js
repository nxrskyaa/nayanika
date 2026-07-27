import * as THREE from 'three'
import { ACCENT, BUILD, GROUND, INK, NATURE } from '../core/palette.js'
import { rngPick, rngRange, rngInt, rngChance } from '../core/rng.js'
import { toon } from '../render/materials.js'
import { at, box, cone, cyl, group, sphere } from './geo.js'
import { SIGN, signPlane } from './atlas.js'

/**
 * The prop library.
 *
 * Every builder returns a group whose origin sits on the ground, facing +Z.
 * They are deliberately blocky — the ink pass does the detailing, so extra
 * polygons here mostly just cost frames.
 */

/* ------------------------------------------------------------------ */
/* street furniture                                                     */
/* ------------------------------------------------------------------ */

export function utilityPole(rng, height = 9) {
  const g = group()
  g.add(at(cyl(0.13, 0.17, height, 7, BUILD.concreteDark), 0, height / 2, 0))
  const arms = rngInt(rng, 1, 3)
  for (let i = 0; i < arms; i++) {
    const y = height - 0.9 - i * 1.15
    g.add(at(box(2.5, 0.11, 0.11, BUILD.metalDark), 0, y, 0))
    for (let k = -1; k <= 1; k += 2) {
      g.add(at(cyl(0.055, 0.055, 0.28, 6, BUILD.frame), k * 1.05, y + 0.19, 0))
    }
  }
  if (rngChance(rng, 0.55)) {
    g.add(at(box(0.5, 0.72, 0.42, BUILD.metal), 0.34, height - 3.1, 0))
  }
  if (rngChance(rng, 0.4)) {
    const lamp = group(
      at(box(0.1, 0.1, 1.35, BUILD.metalDark), 0, 0, 0.62),
      at(box(0.46, 0.16, 0.9, BUILD.frame), 0, -0.12, 1.25),
    )
    lamp.position.set(0, height - 0.55, 0)
    g.add(lamp)
  }
  return g
}

export function powerLine(a, b, sag = 0.6, color = INK) {
  const pts = []
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5)
  const down = mid.clone().normalize().multiplyScalar(-sag)
  mid.add(down)
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b)
  for (let i = 0; i <= 12; i++) pts.push(curve.getPoint(i / 12))
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.035, 4, false)
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }))
}

export function roadSign(rng, kind = null) {
  const g = group()
  const h = rngRange(rng, 2.3, 3.1)
  g.add(at(cyl(0.055, 0.065, h, 6, BUILD.metalDark), 0, h / 2, 0))
  const which = kind ?? rngPick(rng, [SIGN.warnTriangle, SIGN.arrowUp, SIGN.noEntry])
  const s = which === SIGN.warnTriangle ? 0.98 : 0.82
  const face = signPlane(which, s, s)
  face.position.set(0, h + s * 0.32, 0.035)
  g.add(face)
  const back = at(box(s * 0.94, s * 0.94, 0.06, BUILD.frame), 0, h + s * 0.32, 0)
  g.add(back)
  return g
}

export function trafficCone(rng) {
  const g = group()
  g.add(at(box(0.44, 0.06, 0.44, ACCENT.orange), 0, 0.03, 0))
  g.add(at(cone(0.19, 0.62, 8, ACCENT.orange), 0, 0.37, 0))
  g.add(at(cyl(0.115, 0.135, 0.13, 8, ACCENT.white), 0, 0.4, 0))
  g.rotation.y = rng() * Math.PI * 2
  return g
}

export function vendingMachine(rng) {
  const g = group()
  const w = 1.15
  const h = 1.95
  const d = 0.72
  g.add(at(box(w, h, d, ACCENT.blue), 0, h / 2, 0))
  const face = signPlane(SIGN.vending, w * 0.96, h * 0.96)
  face.position.set(0, h / 2, d / 2 + 0.012)
  g.add(face)
  g.add(at(box(w * 1.04, 0.09, d * 1.06, BUILD.metalDark), 0, 0.045, 0))
  return g
}

export function postBox(rng) {
  const g = group()
  g.add(at(cyl(0.28, 0.3, 1.45, 10, ACCENT.deepRed), 0, 0.72, 0))
  g.add(at(cyl(0.32, 0.32, 0.12, 10, ACCENT.deepRed), 0, 1.5, 0))
  g.add(at(cyl(0.2, 0.3, 0.24, 10, ACCENT.deepRed), 0, 1.62, 0))
  g.add(at(box(0.34, 0.07, 0.06, INK), 0, 1.24, 0.28))
  g.add(at(box(0.26, 0.32, 0.03, ACCENT.white), 0, 0.86, 0.3))
  g.add(at(cyl(0.34, 0.36, 0.1, 10, BUILD.concreteDark), 0, 0.05, 0))
  return g
}

export function trashBin(rng) {
  const g = group()
  const c = rngPick(rng, [BUILD.ash, BUILD.metal, ACCENT.green])
  g.add(at(cyl(0.26, 0.23, 0.78, 9, c), 0, 0.39, 0))
  g.add(at(cyl(0.29, 0.29, 0.08, 9, BUILD.metalDark), 0, 0.8, 0))
  return g
}

export function airCon(rng) {
  const g = group()
  g.add(at(box(0.82, 0.58, 0.34, BUILD.frame), 0, 0.29, 0))
  g.add(at(cyl(0.2, 0.2, 0.06, 10, BUILD.metalDark), 0, 0.29, 0.18, Math.PI / 2))
  g.add(at(box(0.86, 0.05, 0.4, BUILD.metalDark), 0, 0.02, 0))
  return g
}

export function planter(rng) {
  const g = group()
  const r = rngRange(rng, 0.24, 0.36)
  g.add(at(cyl(r, r * 0.8, 0.42, 9, rngPick(rng, [BUILD.clay, BUILD.concrete, BUILD.wood])), 0, 0.21, 0))
  const leaves = rngInt(rng, 3, 6)
  for (let i = 0; i < leaves; i++) {
    const a = (i / leaves) * Math.PI * 2 + rng()
    const s = rngRange(rng, 0.18, 0.32)
    const leaf = sphere(s, rngPick(rng, [NATURE.bush, NATURE.leaf, NATURE.leafLight]), 8)
    leaf.scale.set(s * 1.3, s * 0.85, s * 1.1)
    g.add(at(leaf, Math.cos(a) * r * 0.5, 0.5 + rng() * 0.25, Math.sin(a) * r * 0.5))
  }
  if (rngChance(rng, 0.35)) {
    g.add(at(sphere(0.07, rngPick(rng, [NATURE.flowerA, NATURE.flowerB]), 6), rngRange(rng, -0.2, 0.2), 0.72, rngRange(rng, -0.2, 0.2)))
  }
  return g
}

export function guardRail(length = 4, rng) {
  const g = group()
  const posts = Math.max(2, Math.round(length / 1.6))
  for (let i = 0; i < posts; i++) {
    const x = -length / 2 + (i / (posts - 1)) * length
    g.add(at(cyl(0.05, 0.05, 0.95, 6, BUILD.metal), x, 0.47, 0))
  }
  g.add(at(box(length, 0.075, 0.075, BUILD.metal), 0, 0.9, 0))
  g.add(at(box(length, 0.055, 0.055, BUILD.metal), 0, 0.55, 0))
  return g
}

export function lowWall(length = 4, height = 1.1, color = BUILD.concrete) {
  const g = group()
  g.add(at(box(length, height, 0.28, color), 0, height / 2, 0))
  g.add(at(box(length + 0.12, 0.1, 0.38, BUILD.concreteDark), 0, height + 0.04, 0))
  return g
}

export function stairs(steps = 6, width = 2.2, rise = 0.19, run = 0.34, color = BUILD.concrete) {
  const g = group()
  for (let i = 0; i < steps; i++) {
    g.add(at(box(width, rise, run, i % 2 ? color : BUILD.concreteDark), 0, rise * (i + 0.5), run * (i + 0.5)))
  }
  return g
}

export function bench(rng) {
  const g = group()
  g.add(at(box(1.8, 0.09, 0.46, BUILD.wood), 0, 0.44, 0))
  g.add(at(box(1.8, 0.4, 0.08, BUILD.wood), 0, 0.66, -0.2))
  for (let k = -1; k <= 1; k += 2) {
    g.add(at(box(0.09, 0.44, 0.42, BUILD.metalDark), k * 0.75, 0.22, 0))
  }
  return g
}

export function manhole() {
  const g = group()
  g.add(at(cyl(0.42, 0.42, 0.05, 14, BUILD.metalDark), 0, 0.025, 0))
  g.add(at(cyl(0.3, 0.3, 0.055, 14, BUILD.metal), 0, 0.03, 0))
  return g
}

export function bicycle(rng) {
  const g = group()
  const c = rngPick(rng, [ACCENT.green, ACCENT.blue, ACCENT.red, BUILD.metalDark, ACCENT.teal])
  const wheelGeo = new THREE.TorusGeometry(0.33, 0.045, 6, 16)
  for (let k = -1; k <= 1; k += 2) {
    const w = new THREE.Mesh(wheelGeo, toon(INK))
    w.position.set(0, 0.33, k * 0.55)
    g.add(w)
  }
  g.add(at(box(0.06, 0.06, 1.05, c), 0, 0.62, 0))
  g.add(at(box(0.06, 0.42, 0.06, c), 0, 0.5, -0.5, 0.25))
  g.add(at(box(0.06, 0.5, 0.06, c), 0, 0.55, 0.5, -0.2))
  g.add(at(box(0.09, 0.07, 0.28, INK), 0, 0.78, -0.52))
  g.add(at(box(0.44, 0.05, 0.05, INK), 0, 0.86, 0.55))
  if (rngChance(rng, 0.5)) g.add(at(box(0.3, 0.24, 0.34, BUILD.metal), 0, 0.78, 0.62))
  return g
}

export function moped(rng) {
  const g = group()
  const c = rngPick(rng, [NATURE.leaf, ACCENT.red, ACCENT.white, ACCENT.blue])
  const wheelGeo = new THREE.TorusGeometry(0.26, 0.09, 6, 14)
  const dark = toon(INK)
  for (const z of [-0.52, 0.52]) {
    const w = new THREE.Mesh(wheelGeo, dark)
    w.position.set(0, 0.26, z)
    g.add(w)
  }
  g.add(at(box(0.4, 0.34, 1.2, c), 0, 0.6, 0))
  g.add(at(box(0.36, 0.16, 0.5, INK), 0, 0.85, -0.18))
  g.add(at(box(0.08, 0.6, 0.08, BUILD.metalDark), 0, 0.85, 0.5, -0.22))
  g.add(at(box(0.62, 0.06, 0.06, INK), 0, 1.12, 0.42))
  g.add(at(box(0.5, 0.38, 0.42, BUILD.metal), 0, 0.9, -0.62))
  return g
}

export function keiTruck(rng) {
  const g = group()
  const body = rngPick(rng, [ACCENT.white, BUILD.bone, ACCENT.blue, BUILD.ash])
  g.add(at(box(1.5, 1.0, 1.7, body), 0, 1.05, 0.9))
  g.add(at(box(1.46, 0.62, 2.3, body), 0, 0.85, -0.85))
  g.add(at(box(1.4, 0.06, 2.2, BUILD.metal), 0, 1.16, -0.85))
  g.add(at(box(1.38, 0.5, 0.06, BUILD.window), 0, 1.32, 1.74))
  const wheelGeo = new THREE.CylinderGeometry(0.31, 0.31, 0.2, 10)
  const dark = toon(INK)
  for (const [x, z] of [[0.72, 1.1], [-0.72, 1.1], [0.72, -1.2], [-0.72, -1.2]]) {
    const w = new THREE.Mesh(wheelGeo, dark)
    w.position.set(x, 0.31, z)
    w.rotation.z = Math.PI / 2
    g.add(w)
  }
  return g
}

export function awning(width = 3, rng) {
  const g = group()
  const stripeA = rngPick(rng, [ACCENT.white, BUILD.bone])
  const stripeB = rngPick(rng, [ACCENT.blue, ACCENT.red, ACCENT.green, ACCENT.teal])
  const stripes = Math.max(4, Math.round(width / 0.34))
  for (let i = 0; i < stripes; i++) {
    const w = width / stripes
    const x = -width / 2 + w * (i + 0.5)
    const s = at(box(w, 0.06, 1.1, i % 2 ? stripeA : stripeB), x, 0, 0.55)
    s.rotation.x = -0.34
    g.add(s)
  }
  g.add(at(box(width + 0.1, 0.14, 0.14, BUILD.metalDark), 0, 0.1, 0.02))
  return g
}

export function shopSign(rng, width = 2.6) {
  const g = group()
  const kind = rngPick(rng, [SIGN.bannerWarm, SIGN.bannerCool, SIGN.bannerMint, SIGN.noodleBar])
  const h = width * 0.34
  const face = signPlane(kind, width, h)
  face.position.set(0, 0, 0.06)
  g.add(face)
  g.add(at(box(width * 1.03, h * 1.05, 0.11, BUILD.frame), 0, 0, 0))
  return g
}

export function columnSign(rng, height = 2.4) {
  const g = group()
  const face = signPlane(SIGN.columnSign, height * 0.28, height)
  face.position.set(0, height / 2, 0.05)
  g.add(face)
  const back = signPlane(SIGN.columnSign, height * 0.28, height)
  back.position.set(0, height / 2, -0.05)
  back.rotation.y = Math.PI
  g.add(back)
  g.add(at(box(height * 0.29, height * 1.02, 0.08, BUILD.frame), 0, height / 2, 0))
  return g
}

export function streetLamp(rng, height = 4.2) {
  const g = group()
  g.add(at(cyl(0.07, 0.11, height, 8, BUILD.metalDark), 0, height / 2, 0))
  g.add(at(box(0.1, 0.1, 0.9, BUILD.metalDark), 0, height, 0.42))
  g.add(at(box(0.34, 0.18, 0.66, BUILD.frame), 0, height - 0.1, 0.82))
  g.add(at(box(0.3, 0.05, 0.6, ACCENT.white), 0, height - 0.2, 0.82))
  return g
}

export function trafficLight() {
  const g = group()
  g.add(at(cyl(0.07, 0.09, 4.6, 8, BUILD.metalDark), 0, 2.3, 0))
  g.add(at(box(0.09, 0.09, 1.4, BUILD.metalDark), 0, 4.6, 0.68))
  const head = group(
    at(box(1.1, 0.36, 0.28, BUILD.metalDark), 0, 0, 0),
    at(cyl(0.11, 0.11, 0.06, 10, ACCENT.red), -0.34, 0, 0.16, Math.PI / 2),
    at(cyl(0.11, 0.11, 0.06, 10, ACCENT.amber), 0, 0, 0.16, Math.PI / 2),
    at(cyl(0.11, 0.11, 0.06, 10, ACCENT.green), 0.34, 0, 0.16, Math.PI / 2),
  )
  head.position.set(0, 4.5, 1.3)
  g.add(head)
  return g
}

export function crateStack(rng) {
  const g = group()
  const n = rngInt(rng, 2, 5)
  let y = 0
  for (let i = 0; i < n; i++) {
    const s = rngRange(rng, 0.4, 0.62)
    const c = rngPick(rng, [BUILD.wood, BUILD.tan, ACCENT.white, BUILD.ash])
    g.add(at(box(s, s * 0.72, s, c), rngRange(rng, -0.12, 0.12), y + s * 0.36, rngRange(rng, -0.12, 0.12), 0, rng() * 0.5, 0))
    y += s * 0.72
  }
  return g
}

export function ventPipe(rng, height = 2.2) {
  const g = group()
  g.add(at(cyl(0.14, 0.14, height, 8, BUILD.metal), 0, height / 2, 0))
  g.add(at(cyl(0.2, 0.2, 0.16, 8, BUILD.metalDark), 0, height + 0.05, 0))
  return g
}

export function waterTank(rng) {
  const g = group()
  g.add(at(cyl(0.9, 0.9, 1.1, 12, NATURE.leafDark), 0, 1.55, 0))
  g.add(at(cyl(0.9, 0.9, 0.14, 12, BUILD.metalDark), 0, 2.15, 0))
  for (const [x, z] of [[0.6, 0.6], [-0.6, 0.6], [0.6, -0.6], [-0.6, -0.6]]) {
    g.add(at(box(0.1, 1.0, 0.1, BUILD.metalDark), x, 0.5, z))
  }
  return g
}

/* ------------------------------------------------------------------ */
/* buildings                                                            */
/* ------------------------------------------------------------------ */

const WALL_COLORS = [BUILD.cream, BUILD.bone, BUILD.mint, BUILD.blush, BUILD.ash, BUILD.tan, BUILD.sage]

/**
 * A boxy town building: stacked floors, window strips, a shop front at street
 * level and clutter on the roof.
 */
export function townBuilding(rng, opts = {}) {
  const w = opts.width ?? rngRange(rng, 4.5, 8.5)
  const d = opts.depth ?? rngRange(rng, 4.5, 8)
  const floors = opts.floors ?? rngInt(rng, 2, 4)
  const floorH = 2.65
  const h = floors * floorH
  const wall = opts.color ?? rngPick(rng, WALL_COLORS)
  const g = group()

  g.add(at(box(w, h, d, wall), 0, h / 2, 0))

  // Window bands on the street-facing side and one flank.
  for (let f = 1; f < floors; f++) {
    const y = f * floorH + floorH * 0.5
    const winW = w * rngRange(rng, 0.6, 0.82)
    const front = signPlane(SIGN.windowGrid, winW, floorH * 0.52)
    front.position.set(0, y, d / 2 + 0.03)
    g.add(front)
    g.add(at(box(winW + 0.16, floorH * 0.6, 0.07, BUILD.frame), 0, y, d / 2 + 0.005))

    if (rngChance(rng, 0.7)) {
      const sideW = d * rngRange(rng, 0.45, 0.7)
      const side = signPlane(SIGN.windowGrid, sideW, floorH * 0.5)
      side.position.set(w / 2 + 0.03, y, 0)
      side.rotation.y = Math.PI / 2
      g.add(side)
    }
    // Balcony rail.
    if (rngChance(rng, 0.35)) {
      g.add(at(box(w * 0.9, 0.42, 0.1, BUILD.frame), 0, f * floorH + 0.28, d / 2 + 0.32))
      g.add(at(box(w * 0.9, 0.08, 0.7, BUILD.concrete), 0, f * floorH + 0.05, d / 2 + 0.2))
    }
  }

  // Ground floor: shutter or glazing.
  const groundKind = rngChance(rng, 0.45) ? SIGN.shutter : SIGN.posters
  const gw = w * 0.78
  const gf = signPlane(groundKind, gw, floorH * 0.72)
  gf.position.set(0, floorH * 0.45, d / 2 + 0.03)
  g.add(gf)
  g.add(at(box(gw + 0.2, floorH * 0.8, 0.07, BUILD.frame), 0, floorH * 0.44, d / 2 + 0.005))

  // Door.
  g.add(at(box(0.95, 2.05, 0.1, rngPick(rng, [BUILD.woodDark, ACCENT.orange, BUILD.metalDark])), w * 0.34, 1.02, d / 2 + 0.04))

  // Signage.
  if (rngChance(rng, 0.8)) {
    const s = shopSign(rng, Math.min(w * 0.86, 4.2))
    s.position.set(0, floorH * 0.98, d / 2 + 0.12)
    g.add(s)
  }
  if (rngChance(rng, 0.45)) {
    const cs = columnSign(rng, rngRange(rng, 1.8, 2.8))
    cs.position.set(-w * 0.42, floorH * 1.15, d / 2 + 0.2)
    g.add(cs)
  }
  if (rngChance(rng, 0.4)) {
    const a = awning(Math.min(w * 0.8, 3.6), rng)
    a.position.set(0, floorH * 0.85, d / 2)
    g.add(a)
  }

  // Roof clutter.
  g.add(at(box(w + 0.24, 0.18, d + 0.24, BUILD.concreteDark), 0, h + 0.09, 0))
  if (rngChance(rng, 0.5)) g.add(at(box(w * 0.9, 0.5, 0.14, BUILD.concrete), 0, h + 0.34, d / 2 - 0.05))
  if (rngChance(rng, 0.6)) {
    const t = waterTank(rng)
    t.position.set(rngRange(rng, -w * 0.2, w * 0.2), h + 0.18, rngRange(rng, -d * 0.2, d * 0.2))
    t.scale.setScalar(rngRange(rng, 0.7, 1))
    g.add(t)
  }
  if (rngChance(rng, 0.7)) {
    const v = ventPipe(rng, rngRange(rng, 1.2, 2.4))
    v.position.set(rngRange(rng, -w * 0.35, w * 0.35), h + 0.18, rngRange(rng, -d * 0.35, d * 0.35))
    g.add(v)
  }
  for (let i = 0; i < rngInt(rng, 1, 3); i++) {
    const ac = airCon(rng)
    ac.position.set(w / 2 + 0.16, rngRange(rng, 2.9, h - 0.8), rngRange(rng, -d * 0.3, d * 0.3))
    ac.rotation.y = Math.PI / 2
    g.add(ac)
  }

  g.userData.footprint = Math.max(w, d) * 0.72
  return g
}

/** Low suburban house with a pitched roof. */
export function house(rng, opts = {}) {
  const w = opts.width ?? rngRange(rng, 4.2, 6.4)
  const d = opts.depth ?? rngRange(rng, 4.4, 6.6)
  const h = opts.height ?? rngRange(rng, 3.2, 5.4)
  const wall = opts.color ?? rngPick(rng, [BUILD.bone, BUILD.cream, BUILD.mint, BUILD.blush])
  const roofCol = opts.roof ?? rngPick(rng, [BUILD.roofBrown, BUILD.roofSlate, BUILD.roofRed])
  const g = group()

  g.add(at(box(w, h, d, wall), 0, h / 2, 0))

  // Pitched roof from two slabs.
  const rise = rngRange(rng, 0.9, 1.5)
  const slope = Math.atan2(rise, d / 2)
  const slabLen = Math.hypot(rise, d / 2) + 0.2
  for (let k = -1; k <= 1; k += 2) {
    const slab = at(box(w + 0.5, 0.16, slabLen, roofCol), 0, h + rise / 2, (k * d) / 4)
    slab.rotation.x = -k * slope
    g.add(slab)
  }
  g.add(at(box(w + 0.55, 0.16, 0.2, roofCol), 0, h + rise, 0))

  // Gable ends.
  for (let k = -1; k <= 1; k += 2) {
    const tri = new THREE.Shape()
    tri.moveTo(-w / 2, 0)
    tri.lineTo(w / 2, 0)
    tri.lineTo(0, rise)
    const geo = new THREE.ShapeGeometry(tri)
    const m = new THREE.Mesh(geo, toon(wall))
    m.position.set(0, h, (k * d) / 2)
    if (k < 0) m.rotation.y = Math.PI
    g.add(m)
  }

  const win = signPlane(SIGN.windowGrid, w * 0.4, h * 0.34)
  win.position.set(-w * 0.2, h * 0.62, d / 2 + 0.03)
  g.add(win)
  g.add(at(box(w * 0.44, h * 0.38, 0.07, BUILD.frame), -w * 0.2, h * 0.62, d / 2 + 0.01))
  g.add(at(box(0.9, 1.95, 0.1, rngPick(rng, [BUILD.woodDark, ACCENT.navy, ACCENT.green])), w * 0.22, 0.98, d / 2 + 0.04))
  g.add(at(box(1.5, 0.12, 0.6, roofCol), w * 0.22, 2.15, d / 2 + 0.28))

  if (rngChance(rng, 0.5)) {
    const ac = airCon(rng)
    ac.position.set(w / 2 + 0.16, 0.9, rngRange(rng, -d * 0.25, d * 0.25))
    ac.rotation.y = Math.PI / 2
    g.add(ac)
  }
  g.userData.footprint = Math.max(w, d) * 0.72
  return g
}

/** Corporate tower for the industrial district. */
export function corpTower(rng, opts = {}) {
  const w = opts.width ?? rngRange(rng, 5, 8)
  const d = opts.depth ?? rngRange(rng, 5, 8)
  const floors = opts.floors ?? rngInt(rng, 5, 11)
  const floorH = 2.5
  const h = floors * floorH
  const g = group()
  const wall = rngPick(rng, [BUILD.ash, BUILD.slate, BUILD.concrete, BUILD.bone])

  g.add(at(box(w, h, d, wall), 0, h / 2, 0))
  for (let f = 0; f < floors; f++) {
    const y = f * floorH + floorH * 0.55
    for (const [sx, sz, ry] of [
      [0, d / 2 + 0.03, 0],
      [0, -d / 2 - 0.03, Math.PI],
      [w / 2 + 0.03, 0, Math.PI / 2],
      [-w / 2 - 0.03, 0, -Math.PI / 2],
    ]) {
      const span = ry === 0 || Math.abs(ry) === Math.PI ? w : d
      const strip = at(box(span * 0.86, floorH * 0.46, 0.04, BUILD.window), sx, y, sz)
      strip.rotation.y = ry
      g.add(strip)
    }
  }
  g.add(at(box(w + 0.4, 0.3, d + 0.4, BUILD.concreteDark), 0, h + 0.15, 0))
  g.add(at(box(w * 0.4, 1.4, d * 0.4, BUILD.concrete), 0, h + 0.85, 0))
  g.add(at(cyl(0.06, 0.06, 3.2, 6, BUILD.metalDark), w * 0.15, h + 3.1, 0))
  g.add(at(sphere(0.14, ACCENT.red, 8), w * 0.15, h + 4.7, 0))
  g.userData.footprint = Math.max(w, d) * 0.75
  return g
}

/** Factory shed with a saw-tooth roof and a chimney. */
export function factoryShed(rng) {
  const w = rngRange(rng, 9, 14)
  const d = rngRange(rng, 7, 11)
  const h = rngRange(rng, 4.5, 6.5)
  const g = group()
  g.add(at(box(w, h, d, BUILD.metal), 0, h / 2, 0))
  const teeth = Math.max(3, Math.round(w / 3))
  for (let i = 0; i < teeth; i++) {
    const x = -w / 2 + (w / teeth) * (i + 0.5)
    const slab = at(box(w / teeth + 0.1, 0.14, 2.3, BUILD.metalDark), x, h + 0.6, 0)
    slab.rotation.z = 0.5
    g.add(slab)
    g.add(at(box(w / teeth * 0.85, 1.1, 0.06, BUILD.window), x + w / teeth * 0.25, h + 0.62, 0, 0, 0, 0))
  }
  g.add(at(box(w * 0.98, 0.2, d * 0.98, BUILD.metalDark), 0, h + 0.08, 0))
  g.add(at(box(3.2, 3.4, 0.14, BUILD.metalDark), -w * 0.2, 1.7, d / 2 + 0.04))
  g.add(at(cyl(0.55, 0.75, 9, 10, BUILD.concrete), w * 0.36, 4.5, -d * 0.3))
  g.add(at(cyl(0.62, 0.62, 0.5, 10, ACCENT.red), w * 0.36, 8.9, -d * 0.3))
  g.userData.footprint = Math.max(w, d) * 0.72
  return g
}

/** Silo cluster. */
export function silos(rng) {
  const g = group()
  const n = rngInt(rng, 2, 4)
  for (let i = 0; i < n; i++) {
    const r = rngRange(rng, 1.1, 1.7)
    const h = rngRange(rng, 5, 8)
    const x = i * (r * 2.3) - ((n - 1) * r * 2.3) / 2
    g.add(at(cyl(r, r, h, 12, BUILD.bone), x, h / 2, 0))
    g.add(at(cone(r * 1.05, r * 0.7, 12, BUILD.metalDark), x, h + r * 0.35, 0))
    g.add(at(cyl(r * 1.05, r * 1.05, 0.2, 12, BUILD.metalDark), x, 0.1, 0))
  }
  g.userData.footprint = n * 2.2
  return g
}

/* ------------------------------------------------------------------ */
/* landmarks                                                            */
/* ------------------------------------------------------------------ */

export function torii(rng, scale = 1) {
  const g = group()
  const h = 4.6 * scale
  const w = 3.4 * scale
  const c = ACCENT.deepRed
  for (let k = -1; k <= 1; k += 2) {
    g.add(at(cyl(0.17 * scale, 0.22 * scale, h, 9, c), (k * w) / 2, h / 2, 0))
  }
  const lintel = at(box(w * 1.42, 0.28 * scale, 0.42 * scale, c), 0, h + 0.05 * scale, 0)
  g.add(lintel)
  g.add(at(box(w * 1.52, 0.2 * scale, 0.52 * scale, INK), 0, h + 0.28 * scale, 0))
  g.add(at(box(w * 1.05, 0.2 * scale, 0.3 * scale, c), 0, h - 0.7 * scale, 0))
  g.add(at(box(0.26 * scale, 0.8 * scale, 0.26 * scale, c), 0, h - 0.4 * scale, 0))
  return g
}

export function stoneLantern(rng, scale = 1) {
  const g = group()
  g.add(at(cyl(0.18 * scale, 0.26 * scale, 0.9 * scale, 8, BUILD.concrete), 0, 0.45 * scale, 0))
  g.add(at(cyl(0.34 * scale, 0.3 * scale, 0.14 * scale, 8, BUILD.concreteDark), 0, 0.97 * scale, 0))
  g.add(at(box(0.44 * scale, 0.42 * scale, 0.44 * scale, BUILD.bone), 0, 1.25 * scale, 0))
  g.add(at(cone(0.44 * scale, 0.34 * scale, 6, BUILD.concreteDark), 0, 1.63 * scale, 0))
  g.add(at(sphere(0.08 * scale, BUILD.concreteDark, 6), 0, 1.86 * scale, 0))
  return g
}

export function templeHall(rng, scale = 1) {
  const g = group()
  const w = 9 * scale
  const d = 7 * scale
  const h = 3.6 * scale
  g.add(at(box(w * 1.12, 0.7 * scale, d * 1.12, BUILD.concrete), 0, 0.35 * scale, 0))
  g.add(at(box(w, h, d, BUILD.bone), 0, 0.7 * scale + h / 2, 0))
  for (let i = -2; i <= 2; i++) {
    g.add(at(cyl(0.2 * scale, 0.2 * scale, h, 8, ACCENT.deepRed), i * w * 0.22, 0.7 * scale + h / 2, d / 2 + 0.2 * scale))
  }
  const rise = 2.2 * scale
  const slabLen = Math.hypot(rise, d * 0.72) + 0.4 * scale
  for (let k = -1; k <= 1; k += 2) {
    const slab = at(box(w * 1.34, 0.24 * scale, slabLen, BUILD.roofSlate), 0, 0.7 * scale + h + rise / 2, k * d * 0.36)
    slab.rotation.x = -k * Math.atan2(rise, d * 0.72)
    g.add(slab)
  }
  g.add(at(box(w * 1.4, 0.26 * scale, 0.4 * scale, BUILD.roofSlate), 0, 0.7 * scale + h + rise, 0))
  g.add(at(box(w * 0.28, h * 0.72, 0.12 * scale, BUILD.woodDark), 0, 0.7 * scale + h * 0.36, d / 2 + 0.05 * scale))
  const plaque = signPlane(SIGN.plaque, w * 0.3, w * 0.14)
  plaque.position.set(0, 0.7 * scale + h * 0.86, d / 2 + 0.3 * scale)
  g.add(plaque)
  g.userData.footprint = w * 0.75
  return g
}

export function gravestone(rng) {
  const g = group()
  const kind = rng()
  if (kind < 0.45) {
    g.add(at(box(0.46, 1.05, 0.24, BUILD.concrete), 0, 0.52, 0))
    g.add(at(box(0.56, 0.14, 0.34, BUILD.concreteDark), 0, 0.06, 0))
  } else if (kind < 0.78) {
    g.add(at(cyl(0.22, 0.26, 1.25, 8, BUILD.slate), 0, 0.62, 0))
    g.add(at(sphere(0.22, BUILD.slate, 8), 0, 1.28, 0))
  } else {
    g.add(at(box(0.7, 0.16, 0.5, BUILD.concreteDark), 0, 0.08, 0))
    g.add(at(box(0.34, 1.4, 0.2, BUILD.bone), 0, 0.78, 0))
    g.add(at(box(0.9, 0.2, 0.2, BUILD.bone), 0, 1.2, 0))
  }
  g.rotation.z = rngRange(rng, -0.05, 0.05)
  return g
}

export function lighthouse(rng) {
  const g = group()
  g.add(at(cyl(1.0, 1.5, 9, 12, ACCENT.white), 0, 4.5, 0))
  for (let i = 0; i < 3; i++) {
    g.add(at(cyl(1.5 - i * 0.16, 1.5 - i * 0.16, 0.9, 12, ACCENT.red), 0, 1.2 + i * 3, 0))
  }
  g.add(at(cyl(1.25, 1.25, 0.3, 12, BUILD.metalDark), 0, 9.1, 0))
  g.add(at(cyl(0.75, 0.75, 1.2, 10, ACCENT.amber), 0, 9.8, 0))
  g.add(at(cone(1.1, 1.0, 10, ACCENT.deepRed), 0, 10.9, 0))
  g.userData.footprint = 2.2
  return g
}

/* ------------------------------------------------------------------ */
/* nature                                                               */
/* ------------------------------------------------------------------ */

export function tree(rng, opts = {}) {
  const g = group()
  const scale = opts.scale ?? rngRange(rng, 0.8, 1.5)
  const trunkH = rngRange(rng, 1.8, 3.2) * scale
  g.add(at(cyl(0.13 * scale, 0.24 * scale, trunkH, 7, rngPick(rng, [NATURE.trunk, NATURE.trunkDark])), 0, trunkH / 2, 0))
  const blobs = rngInt(rng, 3, 6)
  const leafCol = opts.leaf ?? rngPick(rng, [NATURE.leaf, NATURE.leafDark, NATURE.leafLight, NATURE.bush])
  for (let i = 0; i < blobs; i++) {
    const r = rngRange(rng, 0.75, 1.35) * scale
    const a = (i / blobs) * Math.PI * 2 + rng() * 0.7
    const rad = i === 0 ? 0 : rngRange(rng, 0.25, 0.85) * scale
    const s = sphere(r, leafCol, 9)
    s.scale.set(r * 1.15, r * 0.86, r * 1.1)
    g.add(at(s, Math.cos(a) * rad, trunkH + rngRange(rng, 0.2, 0.95) * scale, Math.sin(a) * rad))
  }
  g.userData.footprint = 1.4 * scale
  return g
}

export function pine(rng, opts = {}) {
  const g = group()
  const scale = opts.scale ?? rngRange(rng, 0.9, 1.7)
  const trunkH = 1.2 * scale
  g.add(at(cyl(0.13 * scale, 0.2 * scale, trunkH, 6, NATURE.trunkDark), 0, trunkH / 2, 0))
  const tiers = rngInt(rng, 3, 5)
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers
    const r = (1.5 - t * 0.95) * scale
    const h = 1.5 * scale
    g.add(at(cone(r, h, 8, i % 2 ? NATURE.pine : NATURE.leafDark), 0, trunkH + i * h * 0.62 + h * 0.5, 0))
  }
  g.userData.footprint = 1.3 * scale
  return g
}

export function palm(rng) {
  const g = group()
  const h = rngRange(rng, 3.4, 5.6)
  const lean = rngRange(rng, -0.2, 0.2)
  const trunk = at(cyl(0.14, 0.24, h, 7, NATURE.trunk), 0, h / 2, 0)
  trunk.rotation.z = lean
  g.add(trunk)
  const top = new THREE.Group()
  top.position.set(-Math.sin(lean) * h, Math.cos(lean) * h, 0)
  const fronds = rngInt(rng, 6, 9)
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2
    const f = at(box(0.24, 0.07, 2.1, NATURE.leaf), Math.cos(a) * 0.9, -0.18, Math.sin(a) * 0.9)
    f.rotation.y = -a
    f.rotation.x = 0.32
    top.add(f)
  }
  top.add(at(sphere(0.28, NATURE.trunkDark, 7), 0, 0, 0))
  g.add(top)
  g.userData.footprint = 1.1
  return g
}

export function bush(rng) {
  const g = group()
  const n = rngInt(rng, 2, 4)
  for (let i = 0; i < n; i++) {
    const r = rngRange(rng, 0.35, 0.72)
    const s = sphere(r, rngPick(rng, [NATURE.bush, NATURE.leaf, NATURE.leafDark]), 8)
    s.scale.set(r * 1.2, r * 0.8, r * 1.1)
    g.add(at(s, rngRange(rng, -0.4, 0.4), r * 0.55, rngRange(rng, -0.4, 0.4)))
  }
  g.userData.footprint = 0.8
  return g
}

export function rock(rng, opts = {}) {
  const scale = opts.scale ?? rngRange(rng, 0.4, 1.4)
  const geo = new THREE.IcosahedronGeometry(scale, 0)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(
      i,
      pos.getX(i) * rngRange(rng, 0.7, 1.3),
      pos.getY(i) * rngRange(rng, 0.55, 1.1),
      pos.getZ(i) * rngRange(rng, 0.7, 1.3),
    )
  }
  geo.computeVertexNormals()
  const m = new THREE.Mesh(geo, toon(opts.color ?? rngPick(rng, [GROUND.rock, GROUND.rockDark, BUILD.concrete])))
  m.position.y = scale * 0.45
  const g = group(m)
  g.rotation.y = rng() * Math.PI * 2
  g.userData.footprint = scale
  return g
}

export function grassTuft(rng) {
  const g = group()
  const n = rngInt(rng, 3, 6)
  for (let i = 0; i < n; i++) {
    const h = rngRange(rng, 0.22, 0.55)
    const b = at(box(0.05, h, 0.05, rngPick(rng, [NATURE.leaf, NATURE.leafLight, NATURE.bamboo])), rngRange(rng, -0.16, 0.16), h / 2, rngRange(rng, -0.16, 0.16))
    b.rotation.z = rngRange(rng, -0.4, 0.4)
    b.rotation.x = rngRange(rng, -0.4, 0.4)
    g.add(b)
  }
  return g
}

export function flowerPatch(rng) {
  const g = group()
  const n = rngInt(rng, 4, 9)
  for (let i = 0; i < n; i++) {
    const h = rngRange(rng, 0.22, 0.42)
    const x = rngRange(rng, -0.5, 0.5)
    const z = rngRange(rng, -0.5, 0.5)
    g.add(at(box(0.04, h, 0.04, NATURE.leaf), x, h / 2, z))
    g.add(at(sphere(0.075, rngPick(rng, [NATURE.flowerA, NATURE.flowerB, NATURE.flowerC]), 6), x, h + 0.04, z))
  }
  return g
}
