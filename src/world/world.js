import * as THREE from 'three'
import { ACCENT, BUILD, GROUND, INK, NATURE } from '../core/palette.js'
import { nextFrame } from '../core/async.js'
import { makeRng, rngChance, rngInt, rngPick, rngRange } from '../core/rng.js'
import { moveAlongSphere, slerpDir, tangentBasis, surfaceQuaternion } from '../core/sphere.js'
import { toon } from '../render/materials.js'
import { mergeByMaterial } from './geo.js'
import { planLots, planStreetFurniture, planStreets, scatterOffStreet } from './layout.js'
import * as P from './props.js'
import { buildCrossing, buildOcean, buildPlaza, buildRoad, offsetPath } from './surfaces.js'
import { ROAD_LOOP, ZONES, zoneById } from './zones.js'

/**
 * Assembles the whole planet: terrain, sea, districts, the road that loops all
 * the way around, and the landmarks quests point at.
 *
 * Build runs in slices with a yield between each district so the loading
 * screen can actually animate.
 */


/** District-local metres -> unit direction on the sphere. */
function localDir(center, east, north, x, z, radius, out = new THREE.Vector3()) {
  const len = Math.hypot(x, z)
  if (len < 1e-6) return out.copy(center).normalize()
  const t = new THREE.Vector3().copy(east).multiplyScalar(x / len).addScaledVector(north, z / len)
  return moveAlongSphere(center, t, len / radius, out)
}

export class World {
  constructor(scene, terrain) {
    this.scene = scene
    this.terrain = terrain
    this.root = new THREE.Group()
    this.root.name = 'world'
    scene.add(this.root)

    /** Circular colliders on the sphere: { dir, radius (metres) }. */
    this.obstacles = []
    /** Named points quests and NPCs can be pinned to. */
    this.anchors = new Map()
    /** Per-district street centrelines, reused for NPC patrol routes. */
    this.streetPaths = new Map()
    this.animated = []
  }

  anchor(id, dir) {
    this.anchors.set(id, dir.clone().normalize())
  }

  getAnchor(id) {
    return this.anchors.get(id) || null
  }

  addObstacle(dir, radius) {
    this.obstacles.push({ dir: dir.clone().normalize(), radius })
  }

  async build(onProgress = () => {}) {
    const t = this.terrain
    let step = 0
    const totalSteps = ZONES.length + 4
    const tick = async (label) => {
      step++
      onProgress(step / totalSteps, label)
      await nextFrame()
    }

    // --- terrain -----------------------------------------------------
    const groundGeo = t.buildGeometry()
    const ground = new THREE.Mesh(groundGeo, toon(0xffffff, { vertexColors: true }))
    ground.receiveShadow = true
    // The shadow frustum only covers a few dozen metres around the player, so
    // terrain self-shadowing buys nothing and costs a whole extra pass over
    // 150k triangles.
    ground.castShadow = false
    ground.name = 'terrain'
    this.root.add(ground)
    this.ground = ground
    await tick('shaping the planet')

    // --- sea ---------------------------------------------------------
    this.ocean = buildOcean(t, GROUND.water, GROUND.waterDeep)
    this.root.add(this.ocean)
    await tick('filling the sea')

    // --- the loop road ------------------------------------------------
    const highways = new THREE.Group()
    for (let i = 0; i < ROAD_LOOP.length - 1; i++) {
      const a = zoneById(ROAD_LOOP[i])
      const b = zoneById(ROAD_LOOP[i + 1])
      if (!a || !b) continue
      const dirs = []
      const steps = 96
      for (let s = 0; s <= steps; s++) {
        const d = slerpDir(a.dir, b.dir, s / steps, new THREE.Vector3())
        // Nudge the highway off the exact great circle so it reads as a route
        // rather than a ruler line.
        const { east } = tangentBasis(d)
        const wobble = Math.sin((s / steps) * Math.PI) * Math.sin(i * 2.3) * 7
        dirs.push(moveAlongSphere(d, east, wobble / t.radius, new THREE.Vector3()))
      }
      const road = buildRoad(dirs, t, {
        width: 7,
        pavement: 1.2,
        roadColor: GROUND.road,
        pavementColor: GROUND.pavement,
        lineColor: GROUND.line,
        dashed: true,
        edgeLines: true,
      })
      highways.add(road)

      // Poles and guard rails strung along the route.
      const rng = makeRng(3000 + i)
      const side = offsetPath(dirs, 5.6, t.radius)
      for (let s = 4; s < dirs.length - 4; s += 8) {
        if (!rngChance(rng, 0.5)) continue
        const d = side[s]
        const pole = P.utilityPole(rng, rngRange(rng, 7, 10))
        this.placeLocal(pole, d, dirs[Math.min(dirs.length - 1, s + 1)])
        highways.add(pole)
      }
    }
    this.root.add(mergeByMaterial(highways))
    await tick('paving the roads')

    // --- districts ---------------------------------------------------
    for (const zone of ZONES) {
      const g = await this.buildDistrict(zone)
      this.root.add(g)
      await tick(`building ${zone.label.toLowerCase()}`)
    }

    // --- wilderness ---------------------------------------------------
    this.root.add(this.buildWilderness())
    await tick('planting trees')

    this.root.traverse((o) => {
      if (o.isMesh && o !== ground && o !== this.ocean) o.receiveShadow = true
    })

    return this
  }

  /** Position + orient a prop group on the sphere at `dir`, facing `towards`. */
  placeLocal(obj, dir, towards = null, lift = 0) {
    const t = this.terrain
    const up = dir.clone().normalize()
    obj.position.copy(t.surfacePoint(up, lift))
    let forward
    if (towards) {
      forward = towards.clone()
      forward.addScaledVector(up, -up.dot(forward))
      if (forward.lengthSq() < 1e-9) forward = null
    }
    if (!forward) {
      const { north } = tangentBasis(up)
      forward = north
    }
    surfaceQuaternion(up, forward.normalize(), obj.quaternion)
    return obj
  }

  /** Same, but with an extra spin about the local up axis. */
  placeLocalYaw(obj, dir, yaw, lift = 0) {
    const up = dir.clone().normalize()
    const { east, north } = tangentBasis(up)
    const forward = north.clone().multiplyScalar(Math.cos(yaw)).addScaledVector(east, Math.sin(yaw))
    return this.placeLocal(obj, dir, forward, lift)
  }

  async buildDistrict(zone) {
    const t = this.terrain
    const R = t.radius
    const seed = hashString(zone.id)
    const rng = makeRng(seed)
    const g = new THREE.Group()
    g.name = zone.id

    const center = zone.dir
    const { east, north } = tangentBasis(center)
    const extent = zone.radius * R * 0.95
    const toDir = (x, z, out = new THREE.Vector3()) => localDir(center, east, north, x, z, R, out)

    const urban = zone.biome === 'town' || zone.biome === 'industry'
    const plan = planStreets(seed, {
      extent,
      minGap: urban ? 10 : 14,
      maxGap: urban ? 17 : 24,
      wobble: urban ? 1.2 : 2.4,
      mainWidth: urban ? 6.6 : 5.4,
      sideWidth: urban ? 4.4 : 3.8,
      ring: urban,
    })

    // Streets.
    const streetDirs = []
    for (const street of plan.streets) {
      const dirs = street.points.map((p) => toDir(p.x, p.z, new THREE.Vector3()))
      if (dirs.length < 2) continue
      streetDirs.push(dirs)
      const road = buildRoad(dirs, t, {
        width: street.width,
        pavement: urban ? 1.7 : 1.0,
        roadColor: GROUND.road,
        pavementColor: urban ? GROUND.pavement : GROUND.pavementWarm,
        lineColor: GROUND.line,
        dashed: street.width > 5.4,
        edgeLines: false,
      })
      g.add(road)
    }
    this.streetPaths.set(zone.id, streetDirs)

    // Central plaza for the town squares.
    if (urban) {
      const { mesh } = buildPlaza(center, extent * 0.3, t, GROUND.pavementWarm, 44)
      g.add(mesh)
    }

    // Crossings.
    if (urban) {
      for (const street of plan.streets) {
        if (street.loop) continue
        for (let i = 6; i < street.points.length - 6; i += 12) {
          if (!rngChance(rng, 0.35)) continue
          const p = street.points[i]
          const q = street.points[i + 1]
          const d = toDir(p.x, p.z, new THREE.Vector3())
          const dn = toDir(q.x, q.z, new THREE.Vector3())
          const fwd = new THREE.Vector3().subVectors(dn, d)
          g.add(buildCrossing(d, fwd, t, street.width, GROUND.line))
        }
      }
    }

    // Buildings.
    const lots = planLots(plan, { seed: seed + 17, inset: urban ? 3.2 : 5 })
    for (const lot of lots) {
      if (!rngChance(rng, urban ? 0.88 : 0.5)) continue
      const d = toDir(lot.x, lot.z, new THREE.Vector3())
      const building = this.makeBuilding(zone, rng, lot)
      if (!building) continue
      this.placeLocalYaw(building, d, lot.facing)
      g.add(building)
      this.addObstacle(d, (building.userData.footprint ?? 3) * 1.0)
    }

    // Street furniture.
    const spots = planStreetFurniture(plan, { seed: seed + 41, density: urban ? 0.4 : 0.16 })
    for (const s of spots) {
      const d = toDir(s.x, s.z, new THREE.Vector3())
      const prop = this.makeStreetProp(zone, rng)
      if (!prop) continue
      this.placeLocalYaw(prop, d, s.angle)
      g.add(prop)
      if (prop.userData.solid) this.addObstacle(d, prop.userData.solid)
    }

    // Nature and clutter away from the streets.
    const scatterCount = zone.biome === 'forest' ? 150 : zone.biome === 'town' ? 34 : 70
    for (const s of scatterOffStreet(plan, scatterCount, seed + 77, urban ? 3.5 : 2.5)) {
      const d = toDir(s.x, s.z, new THREE.Vector3())
      const prop = this.makeNatureProp(zone, rng, s.scale)
      if (!prop) continue
      this.placeLocalYaw(prop, d, s.angle)
      g.add(prop)
      if (prop.userData.footprint > 1) this.addObstacle(d, prop.userData.footprint * 0.55)
    }

    this.addLandmarks(zone, g, rng, toDir, extent)

    const merged = mergeByMaterial(g)
    merged.name = zone.id
    return merged
  }

  makeBuilding(zone, rng, lot) {
    const opts = { width: Math.min(lot.width, 10), depth: Math.min(lot.depth, 10) }
    switch (zone.biome) {
      case 'town':
        return rngChance(rng, 0.65) ? P.townBuilding(rng, opts) : P.house(rng, opts)
      case 'industry':
        if (rngChance(rng, 0.35)) return P.corpTower(rng, opts)
        if (rngChance(rng, 0.5)) return P.factoryShed(rng)
        return P.silos(rng)
      case 'beach':
        return rngChance(rng, 0.7) ? P.house(rng, { ...opts, color: BUILD.bone, roof: BUILD.roofSlate }) : null
      case 'forest':
        return rngChance(rng, 0.25) ? P.house(rng, { ...opts, color: BUILD.wood, roof: BUILD.roofBrown }) : null
      case 'falls':
        return rngChance(rng, 0.3) ? P.house(rng, opts) : null
      case 'temple':
        return rngChance(rng, 0.25) ? P.house(rng, { ...opts, color: BUILD.bone, roof: BUILD.roofSlate }) : null
      case 'cliff':
        return rngChance(rng, 0.5) ? P.house(rng, { ...opts, color: BUILD.blush, roof: BUILD.roofRed }) : null
      case 'graveyard':
        return rngChance(rng, 0.2) ? P.house(rng, { ...opts, color: BUILD.ash }) : null
      default:
        return P.house(rng, opts)
    }
  }

  makeStreetProp(zone, rng) {
    const urban = zone.biome === 'town' || zone.biome === 'industry'
    const table = urban
      ? [
          [P.utilityPole, 0.16],
          [P.roadSign, 0.13],
          [P.vendingMachine, 0.09],
          [P.postBox, 0.05],
          [P.trafficCone, 0.11],
          [P.trashBin, 0.07],
          [P.planter, 0.11],
          [P.bicycle, 0.08],
          [P.streetLamp, 0.07],
          [P.bench, 0.04],
          [P.moped, 0.04],
          [P.crateStack, 0.05],
        ]
      : [
          [P.utilityPole, 0.14],
          [P.roadSign, 0.08],
          [P.trafficCone, 0.08],
          [P.planter, 0.1],
          [P.bench, 0.08],
          [P.bush, 0.28],
          [P.rock, 0.16],
          [P.grassTuft, 0.08],
        ]
    let r = rng()
    for (const [fn, weight] of table) {
      r -= weight
      if (r <= 0) {
        const prop = fn(rng)
        if (fn === P.vendingMachine || fn === P.postBox) prop.userData.solid = 0.8
        return prop
      }
    }
    return P.trafficCone(rng)
  }

  makeNatureProp(zone, rng, scale) {
    switch (zone.biome) {
      case 'beach':
        return rngChance(rng, 0.35)
          ? P.palm(rng)
          : rngChance(rng, 0.5)
            ? P.rock(rng, { scale: scale * 0.7, color: GROUND.rock })
            : P.grassTuft(rng)
      case 'forest':
        return rngChance(rng, 0.55) ? P.pine(rng, { scale }) : rngChance(rng, 0.6) ? P.tree(rng, { scale }) : P.bush(rng)
      case 'falls':
        return rngChance(rng, 0.4) ? P.tree(rng, { scale }) : rngChance(rng, 0.5) ? P.rock(rng, { scale }) : P.bush(rng)
      case 'temple':
        return rngChance(rng, 0.35) ? P.pine(rng, { scale }) : rngChance(rng, 0.5) ? P.rock(rng, { scale: scale * 1.3 }) : P.stoneLantern(rng, 0.8)
      case 'industry':
        return rngChance(rng, 0.5) ? P.crateStack(rng) : P.rock(rng, { scale: scale * 0.7, color: GROUND.rockDark })
      case 'graveyard':
        return rngChance(rng, 0.62) ? P.gravestone(rng) : rngChance(rng, 0.5) ? P.tree(rng, { scale, leaf: NATURE.leafDark }) : P.bush(rng)
      case 'cliff':
        return rngChance(rng, 0.5) ? P.rock(rng, { scale: scale * 1.2, color: 0xa8664f }) : P.bush(rng)
      default:
        return rngChance(rng, 0.4) ? P.tree(rng, { scale }) : rngChance(rng, 0.5) ? P.bush(rng) : P.flowerPatch(rng)
    }
  }

  addLandmarks(zone, g, rng, toDir, extent) {
    const t = this.terrain
    const put = (obj, x, z, yaw = 0, anchorId = null) => {
      const d = toDir(x, z, new THREE.Vector3())
      this.placeLocalYaw(obj, d, yaw)
      g.add(obj)
      if (anchorId) this.anchor(anchorId, d)
      return d
    }

    switch (zone.id) {
      case 'main-square': {
        put(P.trafficLight(), 7, 7, Math.PI * 0.75)
        put(P.trafficLight(), -7, -7, -Math.PI * 0.25)
        const board = P.columnSign(rng, 3.2)
        put(board, 0, extent * 0.22, 0, 'main-square:board')
        this.anchor('main-square:center', zone.dir)
        this.anchor('main-square:flowers', toDir(-5.5, 3.5, new THREE.Vector3()))
        this.anchor('main-square:office', toDir(6.5, -4, new THREE.Vector3()))
        this.anchor('main-square:depot', toDir(0, -extent * 0.42, new THREE.Vector3()))
        const depot = P.townBuilding(rng, { width: 9, depth: 7, floors: 2, color: BUILD.cream })
        put(depot, 0, -extent * 0.55, Math.PI)
        break
      }
      case 'back-streets': {
        this.anchor('back-streets:alley', toDir(3, 4, new THREE.Vector3()))
        for (let i = 0; i < 6; i++) {
          put(P.bicycle(rng), rngRange(rng, -10, 10), rngRange(rng, -10, 10), rng() * 6.28)
        }
        break
      }
      case 'seaside': {
        const lh = P.lighthouse(rng)
        const d = put(lh, extent * 0.55, extent * 0.35, 0, 'seaside:lighthouse')
        this.addObstacle(d, 2.4)
        for (let i = 0; i < 9; i++) {
          put(P.palm(rng), rngRange(rng, -extent, extent), rngRange(rng, -extent, extent), rng() * 6.28)
        }
        this.anchor('seaside:pier', toDir(0, extent * 0.7, new THREE.Vector3()))
        break
      }
      case 'smelly-falls': {
        const fall = this.buildWaterfall(zone, rng)
        if (fall) g.add(fall)
        this.anchor('smelly-falls:pool', toDir(0, -6, new THREE.Vector3()))
        for (let i = 0; i < 5; i++) {
          put(P.rock(rng, { scale: rngRange(rng, 1.2, 2.4) }), rngRange(rng, -12, 12), rngRange(rng, -12, 4), rng() * 6.28)
        }
        break
      }
      case 'whisper-woods': {
        const cave = this.buildCave(rng)
        const d = put(cave, 4, -8, Math.PI * 0.15, 'whisper-woods:cave')
        this.addObstacle(d, 3.2)
        break
      }
      case 'mountain-temple': {
        const hall = P.templeHall(rng, 1.15)
        const d = put(hall, 0, -4, Math.PI, 'mountain-temple:hall')
        this.addObstacle(d, 6.5)
        put(P.torii(rng, 1.25), 0, 11, 0, 'mountain-temple:gate')
        for (let i = 0; i < 8; i++) {
          const side = i % 2 ? 1 : -1
          put(P.stoneLantern(rng, 1), side * 3.4, 9 - Math.floor(i / 2) * 3.4, 0)
        }
        put(P.stairs(14, 5, 0.24, 0.5), 0, 6, 0)
        this.anchor('mountain-temple:base', toDir(0, extent * 0.75, new THREE.Vector3()))
        break
      }
      case 'capital-corp': {
        const tower = P.corpTower(rng, { width: 9, depth: 9, floors: 13 })
        const d = put(tower, 0, 0, Math.PI * 0.25, 'capital-corp:tower')
        this.addObstacle(d, 7)
        put(P.silos(rng), extent * 0.5, -extent * 0.3, 0)
        put(P.factoryShed(rng), -extent * 0.45, extent * 0.25, Math.PI * 0.5)
        this.anchor('capital-corp:lobby', toDir(0, 9, new THREE.Vector3()))
        break
      }
      case 'red-cliff': {
        const h = P.house(rng, { width: 7, depth: 6.5, height: 4.4, color: ACCENT.deepRed, roof: BUILD.roofSlate })
        const d = put(h, 0, 0, Math.PI, 'red-cliff:house')
        this.addObstacle(d, 4.2)
        put(P.guardRail(9, rng), 0, 8, 0)
        break
      }
      case 'lucero-graveyard': {
        for (let i = 0; i < 26; i++) {
          const row = Math.floor(i / 6)
          const col = i % 6
          put(P.gravestone(rng), -8 + col * 3.2 + rngRange(rng, -0.4, 0.4), -6 + row * 4 + rngRange(rng, -0.5, 0.5), rngRange(rng, -0.2, 0.2))
        }
        put(P.torii(rng, 0.9), 0, extent * 0.6, 0, 'lucero-graveyard:gate')
        this.anchor('lucero-graveyard:center', zone.dir)
        break
      }
      default:
        break
    }
  }

  buildWaterfall(zone, rng) {
    const t = this.terrain
    const R = t.radius
    const center = zone.dir
    const { east, north } = tangentBasis(center)
    const g = new THREE.Group()

    const topDir = localDir(center, east, north, 0, 11, R, new THREE.Vector3())
    const botDir = localDir(center, east, north, 0, -3, R, new THREE.Vector3())
    const top = t.surfacePoint(topDir, 0.3, new THREE.Vector3())
    const bot = t.surfacePoint(botDir, 0.1, new THREE.Vector3())

    // Basis: +Y runs up the falls, +Z faces out of the cliff.
    const down = new THREE.Vector3().subVectors(bot, top)
    const height = down.length()
    const yAxis = down.clone().normalize().negate()
    const xAxis = new THREE.Vector3().crossVectors(yAxis, topDir).normalize()
    if (xAxis.lengthSq() < 1e-6) xAxis.set(1, 0, 0)
    const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize()

    const mat = toon(GROUND.foam, { transparent: true, opacity: 0.92, cache: false, side: THREE.DoubleSide })
    mat.map = waterStreakTexture()
    mat.needsUpdate = true

    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(6.5, height, 2, 10), mat)
    sheet.position.addVectors(top, bot).multiplyScalar(0.5)
    sheet.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis))
    sheet.userData.noMerge = true
    g.add(sheet)
    this.animated.push({ kind: 'waterfall', mesh: sheet })

    // Spray at the bottom.
    const spray = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 12, 8),
      toon(GROUND.foam, { transparent: true, opacity: 0.55, cache: false }),
    )
    spray.scale.set(1.5, 0.5, 1.5)
    spray.position.copy(bot)
    spray.userData.noMerge = true
    g.add(spray)

    const pool = buildPlaza(botDir, 6.5, t, GROUND.water, 26)
    pool.mesh.material = toon(GROUND.water, { transparent: true, opacity: 0.85, cache: false })
    g.add(pool.mesh)

    for (let i = 0; i < 10; i++) {
      const a = rng() * Math.PI * 2
      const r = rngRange(rng, 5, 9)
      const d = localDir(center, east, north, Math.cos(a) * r, Math.sin(a) * r - 3, R, new THREE.Vector3())
      const rk = P.rock(rng, { scale: rngRange(rng, 0.8, 2) })
      this.placeLocalYaw(rk, d, rng() * 6.28)
      g.add(rk)
    }
    return g
  }

  buildCave(rng) {
    const g = new THREE.Group()
    const hill = new THREE.Mesh(
      new THREE.SphereGeometry(5.2, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
      toon(GROUND.rockDark),
    )
    hill.scale.set(1, 0.75, 1.1)
    g.add(hill)
    const mouth = new THREE.Mesh(new THREE.CircleGeometry(1.75, 16), toon(0x14181a))
    mouth.position.set(0, 1.5, 4.6)
    g.add(mouth)
    const lintel = new THREE.Mesh(new THREE.TorusGeometry(1.85, 0.34, 6, 16, Math.PI), toon(GROUND.rock))
    lintel.position.set(0, 1.5, 4.5)
    g.add(lintel)
    for (let i = 0; i < 6; i++) {
      const rk = P.rock(rng, { scale: rngRange(rng, 0.5, 1.4), color: GROUND.rock })
      rk.position.set(rngRange(rng, -5, 5), 0, rngRange(rng, 2.5, 6))
      g.add(rk)
    }
    g.userData.footprint = 5
    return g
  }

  /** Trees and rocks outside the districts so the planet is never empty. */
  buildWilderness() {
    const t = this.terrain
    const rng = makeRng(555)
    const g = new THREE.Group()
    const dir = new THREE.Vector3()
    let placed = 0
    let guard = 9000

    while (placed < 620 && guard-- > 0) {
      const z = rng() * 2 - 1
      const a = rng() * Math.PI * 2
      const r = Math.sqrt(Math.max(0, 1 - z * z))
      dir.set(r * Math.cos(a), z, r * Math.sin(a))

      const h = t.heightAt(dir)
      if (h < 1.4 || h > 27) continue
      const slope = t.slopeAt(dir)
      if (slope > 0.72) continue

      // Skip anywhere a district already handles.
      let inZone = false
      for (const zn of ZONES) {
        if (dir.dot(zn.dir) > Math.cos(zn.radius + zn.falloff * 0.8)) {
          inZone = true
          break
        }
      }
      if (inZone) continue

      let prop
      if (h > 20) prop = rngChance(rng, 0.6) ? P.rock(rng, { scale: rngRange(rng, 0.6, 2.2) }) : P.pine(rng, { scale: rngRange(rng, 0.7, 1.2) })
      else if (h < 2.6) prop = rngChance(rng, 0.5) ? P.palm(rng) : P.rock(rng, { scale: rngRange(rng, 0.4, 1.2) })
      else if (rngChance(rng, 0.45)) prop = P.tree(rng, { scale: rngRange(rng, 0.8, 1.7) })
      else if (rngChance(rng, 0.4)) prop = P.pine(rng, { scale: rngRange(rng, 0.8, 1.6) })
      else prop = rngChance(rng, 0.5) ? P.bush(rng) : P.grassTuft(rng)

      this.placeLocalYaw(prop, dir.clone(), rng() * Math.PI * 2)
      g.add(prop)
      placed++
    }

    return mergeByMaterial(g)
  }

  update(dt, time) {
    for (const a of this.animated) {
      if (a.kind === 'waterfall' && a.mesh.material.map) {
        a.mesh.material.map.offset.y -= dt * 0.8
      }
    }
  }
}

let _streakTex = null
/** Vertical streaks that scroll downward to sell the falling water. */
function waterStreakTexture() {
  if (_streakTex) return _streakTex
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 256
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#e8f7f3'
  ctx.fillRect(0, 0, 128, 256)
  const rng = makeRng(31)
  for (let i = 0; i < 34; i++) {
    ctx.fillStyle = `rgba(120,200,205,${rngRange(rng, 0.1, 0.38).toFixed(3)})`
    const x = rng() * 128
    const w = rngRange(rng, 2, 9)
    const y = rng() * 256
    const h = rngRange(rng, 40, 190)
    ctx.fillRect(x, y, w, h)
    if (y + h > 256) ctx.fillRect(x, y - 256, w, h)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1, 2)
  _streakTex = tex
  return tex
}

function hashString(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
