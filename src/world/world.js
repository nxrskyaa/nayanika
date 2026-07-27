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

      // Poles at a steady spacing, with the cables actually strung between
      // them. Skipping poles at random left ragged clumps and the wires were
      // never drawn at all, so the roadside read as scattered posts.
      const rng = makeRng(3000 + i)
      const side = offsetPath(dirs, 5.6, t.radius)
      const height = rngRange(rng, 7.5, 9)
      const attach = P.POLE_ATTACH(height)
      let prevPoints = null
      for (let s = 4; s < dirs.length - 4; s += 9) {
        const d = side[s]
        const pole = P.utilityPole(rng, height)
        this.placeLocal(pole, d, dirs[Math.min(dirs.length - 1, s + 1)])
        highways.add(pole)

        pole.updateMatrixWorld(true)
        const points = attach.map(([x, y, z]) => pole.localToWorld(new THREE.Vector3(x, y, z)))
        if (prevPoints) {
          for (let k = 0; k < points.length; k++) {
            const span = prevPoints[k].distanceTo(points[k])
            highways.add(P.powerLine(prevPoints[k], points[k], span * 0.055))
          }
        }
        prevPoints = points
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
    await tick('planting the jungle')

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
      minBlock: urban ? 21 : 26,
      branches: urban ? 2 : 1,
      // Low wobble on purpose. The streets are meant to look laid out, not
      // sketched; the curvature of the planet supplies plenty of irregularity.
      wobble: urban ? 0.8 : 1.7,
      mainWidth: urban ? 6.6 : 5.4,
      sideWidth: urban ? 4.4 : 3.8,
      // No ring road. At this district size a ring sits barely a building's
      // width outside the crossroads, and every lot between the two gets
      // squeezed out — you end up with a district of roads and no houses. The
      // loop highway already carries traffic through each district anyway.
      ring: false,
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

    // Buildings, lined up along the street frontages.
    // Town plots are deliberately small. Two 6.6m streets crossing already eat
    // ten metres out of the middle of a forty-metre district; at nine-metre
    // plots only the four corners survive the clearance checks and the village
    // comes out nearly empty. Narrow frontages packed close is also just what a
    // market street looks like.
    const lots = planLots(plan, {
      seed: seed + 17,
      pavement: urban ? 1.4 : 1.0,
      setback: urban ? 0.6 : 2.0,
      spacing: urban ? 6.5 : 10,
      size: urban ? 5.6 : 6.0,
      fill: urban ? 0.92 : 0.55,
    })
    for (const lot of lots) {
      const d = toDir(lot.x, lot.z, new THREE.Vector3())
      const building = this.makeBuilding(zone, rng, lot)
      if (!building) continue
      this.placeLocalYaw(building, d, lot.facing)
      g.add(building)
      this.addObstacle(d, (building.userData.footprint ?? 3) * 1.0)
    }

    // Street furniture.
    const spots = planStreetFurniture(plan, {
      seed: seed + 41,
      density: urban ? 0.72 : 0.4,
      stride: urban ? 4.6 : 7,
      minGap: urban ? 3.0 : 4.5,
    })
    for (const s of spots) {
      const d = toDir(s.x, s.z, new THREE.Vector3())
      const prop = this.makeStreetProp(zone, rng)
      if (!prop) continue
      this.placeLocalYaw(prop, d, s.angle)
      g.add(prop)
      if (prop.userData.solid) this.addObstacle(d, prop.userData.solid)
    }

    // Nature and clutter away from the streets.
    const scatterCount = zone.biome === 'forest' ? 130 : zone.biome === 'town' ? 44 : 78
    for (const s of scatterOffStreet(plan, scatterCount, seed + 77, urban ? 3.5 : 2.5, lots)) {
      const d = toDir(s.x, s.z, new THREE.Vector3())
      const prop = this.makeNatureProp(zone, rng, s.scale, t.slopeAt(d))
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
      case 'town': {
        // A walled compound needs room for a gate, a bale and a shrine; below
        // about six metres it reads as a shed with a fence. Narrow frontages
        // get shophouses and warungs instead, which is what lines a market
        // street anyway.
        const roomy = Math.min(lot.width, lot.depth) >= 6.2
        const r = rng()
        if (roomy && r < 0.55) return P.balineseCompound(rng, opts)
        if (r < 0.74) return P.townBuilding(rng, { ...opts, floors: rngInt(rng, 2, 3), color: BUILD.cream })
        return P.warung(rng)
      }
      case 'industry': {
        const r = rng()
        if (r < 0.24) return P.corpTower(rng, opts)
        if (r < 0.42) return P.factoryShed(rng)
        if (r < 0.5) return P.silos(rng)
        if (r < 0.78) return P.townBuilding(rng, { ...opts, floors: rngInt(rng, 2, 4) })
        return P.balineseCompound(rng, opts)
      }
      case 'beach':
        return rngChance(rng, 0.55) ? P.bale(rng, opts) : rngChance(rng, 0.5) ? P.warung(rng) : null
      case 'forest':
        return rngChance(rng, 0.22) ? P.balineseCompound(rng, opts) : null
      case 'falls':
        return rngChance(rng, 0.28) ? (rngChance(rng, 0.5) ? P.warung(rng) : P.bale(rng, opts)) : null
      case 'temple':
        return rngChance(rng, 0.22) ? P.bale(rng, opts) : null
      case 'rice':
        return rngChance(rng, 0.16) ? (rngChance(rng, 0.5) ? P.bale(rng, opts) : P.warung(rng)) : null
      case 'cliff':
        return rngChance(rng, 0.4) ? P.balineseCompound(rng, opts) : null
      case 'graveyard':
        return rngChance(rng, 0.14) ? P.bale(rng, opts) : null
      default:
        return P.balineseCompound(rng, opts)
    }
  }

  makeStreetProp(zone, rng) {
    const urban = zone.biome === 'town' || zone.biome === 'industry'
    const table = urban
      ? [
          [P.penjor, 0.13],
          [P.utilityPole, 0.1],
          [P.moped, 0.1],
          [P.umbulUmbul, 0.09],
          [P.canang, 0.09],
          [P.balineseShrine, 0.06],
          [P.planter, 0.08],
          [P.roadSign, 0.05],
          [P.bicycle, 0.05],
          [P.streetLamp, 0.05],
          [P.tedung, 0.05],
          [P.trafficCone, 0.04],
          [P.trashBin, 0.03],
          [P.vendingMachine, 0.03],
          [P.bench, 0.03],
          [P.crateStack, 0.02],
        ]
      : [
          [P.utilityPole, 0.11],
          [P.penjor, 0.09],
          [P.canang, 0.09],
          [P.roadSign, 0.05],
          [P.planter, 0.08],
          [P.bench, 0.06],
          [P.balineseShrine, 0.06],
          [P.bush, 0.22],
          [P.rock, 0.14],
          [P.grassTuft, 0.1],
        ]
    let r = rng()
    for (const [fn, weight] of table) {
      r -= weight
      if (r <= 0) {
        const prop = fn(rng)
        if (fn === P.vendingMachine || fn === P.postBox) prop.userData.solid = 0.8
        if (fn === P.balineseShrine) prop.userData.solid = 0.85
        return prop
      }
    }
    return P.trafficCone(rng)
  }

  makeNatureProp(zone, rng, scale, slope = 0) {
    switch (zone.biome) {
      case 'beach': {
        const r = rng()
        if (r < 0.42) return P.palm(rng)
        if (r < 0.54) return P.jukung(rng)
        if (r < 0.66) return P.frangipani(rng, { scale: scale * 0.8 })
        if (r < 0.82) return P.rock(rng, { scale: scale * 0.7, color: GROUND.rock })
        return P.grassTuft(rng)
      }
      case 'forest': {
        const r = rng()
        if (r < 0.16) return P.banyan(rng, { scale: scale * 1.1 })
        if (r < 0.34) return P.palm(rng)
        if (r < 0.72) return P.tree(rng, { scale })
        if (r < 0.86) return P.frangipani(rng, { scale })
        return P.bush(rng)
      }
      case 'falls':
        return rngChance(rng, 0.4) ? P.tree(rng, { scale }) : rngChance(rng, 0.5) ? P.rock(rng, { scale }) : P.bush(rng)
      case 'temple': {
        const r = rng()
        if (r < 0.3) return P.frangipani(rng, { scale })
        if (r < 0.45) return P.tedung(rng, 0.85)
        if (r < 0.6) return P.balineseShrine(rng, 0.7)
        if (r < 0.8) return P.rock(rng, { scale: scale * 1.3 })
        return P.bush(rng)
      }
      case 'rice': {
        // The big terrace flights are placed by hand in addLandmarks so they
        // step down the ridge in order; these are the odds and ends between.
        const r = rng()
        // Terraces only on ground gentle enough for a rigid flight to sit on.
        if (r < 0.14 && slope < 0.16) return P.riceTerrace(rng, { steps: rngInt(rng, 3, 5), width: rngRange(rng, 7, 9) })
        if (r < 0.32) return P.palm(rng)
        if (r < 0.42) return P.balineseShrine(rng, 0.6)
        if (r < 0.52) return P.frangipani(rng, { scale: scale * 0.9 })
        if (r < 0.72) return P.bush(rng)
        return P.grassTuft(rng)
      }
      case 'industry':
        return rngChance(rng, 0.4) ? P.crateStack(rng) : rngChance(rng, 0.4) ? P.palm(rng) : P.rock(rng, { scale: scale * 0.7, color: GROUND.rockDark })
      case 'graveyard': {
        // A setra is not a lawn of headstones — it is frangipani and banyan
        // with a few shrines underneath.
        const r = rng()
        if (r < 0.4) return P.frangipani(rng, { scale })
        if (r < 0.52) return P.banyan(rng, { scale: scale * 0.9 })
        if (r < 0.74) return P.gravestone(rng)
        return P.bush(rng)
      }
      case 'cliff':
        return rngChance(rng, 0.45) ? P.rock(rng, { scale: scale * 1.2, color: 0xc0b393 }) : rngChance(rng, 0.4) ? P.frangipani(rng, { scale: scale * 0.8 }) : P.bush(rng)
      default:
        return rngChance(rng, 0.4) ? P.tree(rng, { scale }) : rngChance(rng, 0.5) ? P.bush(rng) : P.flowerPatch(rng)
    }
  }

  addLandmarks(zone, g, rng, toDir, extent) {
    const t = this.terrain
    // `solid` registers a collider. Landmarks that skip it are things the
    // camera is allowed to sit inside — gates, statues, flat furniture. Any
    // landmark with walls needs one, or the follow camera will happily reverse
    // straight through it and fill the screen with the inside of a roof.
    const put = (obj, x, z, yaw = 0, anchorId = null, solid = 0) => {
      const d = toDir(x, z, new THREE.Vector3())
      this.placeLocalYaw(obj, d, yaw)
      g.add(obj)
      if (anchorId) this.anchor(anchorId, d)
      if (solid > 0) this.addObstacle(d, solid)
      return d
    }

    switch (zone.id) {
      case 'main-square': {
        // The player spawns here facing north, which puts the camera boom at
        // roughly (0, -8.5) local. Everything with a wall stays out of that
        // corridor, and the plaza anchor is the open ground it points at.
        this.anchor('main-square:plaza', zone.dir)
        this.anchor('main-square:center', zone.dir)

        // The banyan on the crossroads is the centre of any Balinese village —
        // the market, the temple and the road arrange themselves around it.
        put(P.banyan(rng, { scale: 2.0 }), -6.5, 5.5, 0, null, 2.2)

        put(P.candiBentar(rng, 1.0), 0, extent * 0.5, 0, 'main-square:gate')
        for (const s of [-1, 1]) put(P.guardianStatue(rng, 1), s * 2.4, extent * 0.5 - 1.7, 0)
        for (const s of [-1, 1]) put(P.penjor(rng), s * 5.4, extent * 0.3, s > 0 ? -Math.PI / 2 : Math.PI / 2)

        // The banjar's drum tower — after the temple it is the tallest thing in
        // any Balinese village, and it marks the centre from a long way off.
        put(P.kulkulTower(rng, 1), -9.5, -5.5, Math.PI * 0.18, null, 1.7)
        for (const s of [-1, 1]) put(P.umbulUmbul(rng, 1), s * 3.2, extent * 0.36, 0)

        put(P.columnSign(rng, 3.2), 7.5, 3.5, -0.4, 'main-square:board')
        this.anchor('main-square:flowers', toDir(-4.5, 2.5, new THREE.Vector3()))
        put(P.warung(rng), -7.5, 0.5, Math.PI * 0.55, null, 2.4)
        this.anchor('main-square:office', toDir(7.0, -1.5, new THREE.Vector3()))

        // Depot sits off the spawn axis so the camera never reverses into it.
        const depot = P.townBuilding(rng, { width: 9, depth: 7, floors: 2, color: BUILD.cream })
        put(depot, 8.0, -8.0, 0, null, 5.4)
        this.anchor('main-square:depot', toDir(8.0, -3.6, new THREE.Vector3()))
        break
      }
      case 'back-streets': {
        this.anchor('back-streets:alley', toDir(3, 4, new THREE.Vector3()))
        for (let i = 0; i < 5; i++) {
          put(P.moped(rng), rngRange(rng, -10, 10), rngRange(rng, -10, 10), rng() * 6.28)
        }
        for (let i = 0; i < 4; i++) {
          put(P.penjor(rng), rngRange(rng, -11, 11), rngRange(rng, -11, 11), rng() * 6.28)
        }
        put(P.balineseShrine(rng, 1.1), -5, -5, Math.PI * 0.4)
        break
      }
      case 'seaside': {
        const lh = P.lighthouse(rng)
        const d = put(lh, extent * 0.55, extent * 0.35, 0, 'seaside:lighthouse')
        this.addObstacle(d, 2.4)
        for (let i = 0; i < 11; i++) {
          put(P.palm(rng), rngRange(rng, -extent, extent), rngRange(rng, -extent, extent), rng() * 6.28)
        }
        // Jukung hauled up the sand in a row, the way they are every morning.
        for (let i = 0; i < 5; i++) {
          put(P.jukung(rng), -7 + i * 3.4 + rngRange(rng, -0.6, 0.6), extent * 0.62 + rngRange(rng, -1.2, 1.2), rngRange(rng, -0.25, 0.25))
        }
        put(P.balineseShrine(rng, 1.0), -extent * 0.4, extent * 0.3, 0)
        this.anchor('seaside:pier', toDir(0, extent * 0.7, new THREE.Vector3()))
        break
      }
      case 'rice-terrace': {
        // Flights of terraces stepping down the ridge, with a subak water
        // temple at the top where the irrigation is divided up.
        // Flights step down the ridge, but only where the ground is gentle
        // enough for a rigid one to sit flat. Anywhere steeper and the far end
        // of the flight lifts clear of the hill.
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2 + rngRange(rng, -0.15, 0.15)
          const r = rngRange(rng, 7, extent * 0.82)
          const x = Math.cos(a) * r
          const z = Math.sin(a) * r
          const d = toDir(x, z, new THREE.Vector3())
          if (t.slopeAt(d) > 0.17) continue
          put(P.riceTerrace(rng, { steps: rngInt(rng, 3, 5), width: rngRange(rng, 7, 9) }), x, z, a + Math.PI / 2)
        }
        const shrine = P.meruTower(rng, 3, 0.6)
        const sd = put(shrine, 0, 2, Math.PI, 'rice-terrace:subak')
        this.addObstacle(sd, 2.2)
        put(P.candiBentar(rng, 0.7), 0, 8, 0)
        for (const s of [-1, 1]) put(P.tedung(rng, 1), s * 2.6, 3.5, 0)
        put(P.bale(rng, { width: 4, depth: 3.4 }), -8, -5, Math.PI * 0.3)
        this.anchor('rice-terrace:hut', toDir(-8, -8, new THREE.Vector3()))
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
        // Besakih reads as a stack: gate, stairs, courtyard, then a row of meru
        // getting taller toward the middle.
        const meru = P.meruTower(rng, 11, 1.0)
        const d = put(meru, 0, -6, Math.PI, 'mountain-temple:hall')
        this.addObstacle(d, 3.2)
        for (const [x, tiers] of [[-5.5, 7], [5.5, 7], [-10, 5], [10, 5]]) {
          const m = P.meruTower(rng, tiers, 0.82)
          const md = put(m, x, -6.5, Math.PI)
          this.addObstacle(md, 2.4)
        }

        put(P.candiBentar(rng, 1.35), 0, 11, 0, 'mountain-temple:gate')
        for (const s of [-1, 1]) put(P.guardianStatue(rng, 1.15), s * 3.2, 9.4, 0)
        for (let i = 0; i < 8; i++) {
          const side = i % 2 ? 1 : -1
          put(P.tedung(rng, 0.95), side * 3.6, 8 - Math.floor(i / 2) * 3.4, 0)
        }
        put(P.stairs(14, 5, 0.24, 0.5, BUILD.paras), 0, 6, 0)
        for (const s of [-1, 1]) put(P.balineseWall(9, 1.6), s * 8, 0, Math.PI / 2)
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
        // A clifftop compound with its own gate, looking straight out to sea.
        const h = P.balineseCompound(rng, { width: 9, depth: 8 })
        const d = put(h, 0, 0, Math.PI, 'red-cliff:house')
        this.addObstacle(d, 4.6)
        put(P.meruTower(rng, 3, 0.7), 0, -7.5, Math.PI)
        put(P.guardRail(9, rng), 0, 8, 0)
        for (const s of [-1, 1]) put(P.frangipani(rng, { scale: 1.1 }), s * 6, 5, 0)
        break
      }
      case 'lucero-graveyard': {
        for (let i = 0; i < 18; i++) {
          const row = Math.floor(i / 6)
          const col = i % 6
          put(P.gravestone(rng), -8 + col * 3.2 + rngRange(rng, -0.4, 0.4), -6 + row * 4 + rngRange(rng, -0.5, 0.5), rngRange(rng, -0.2, 0.2))
        }
        const tree = P.banyan(rng, { scale: 2.0 })
        const bd = put(tree, 5, -2, 0)
        this.addObstacle(bd, 2.0)
        put(P.candiBentar(rng, 0.85), 0, extent * 0.6, 0, 'lucero-graveyard:gate')
        for (const s of [-1, 1]) put(P.guardianStatue(rng, 0.9), s * 2.2, extent * 0.6 - 1.4, 0)
        put(P.balineseShrine(rng, 1.15), -5, 3, 0)
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

  /**
   * Trees and rocks outside the districts so the planet is never empty.
   *
   * Merged per patch of sky rather than all at once: one planet-spanning mesh
   * has a bounding sphere the size of the world, so the frustum can never cull
   * it and every frame pays for the vegetation on the far side of the planet.
   */
  buildWilderness() {
    const t = this.terrain
    const rng = makeRng(555)
    /** Coarse lat/lon buckets, each merged separately so culling can work. */
    const cells = new Map()
    const cellFor = (d) => {
      const lat = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1))
      const lon = Math.atan2(d.x, d.z)
      // Eight cells, not more. Each cell costs one draw call per material it
      // contains, so a fine grid buys culling and immediately hands the saving
      // back at the command buffer.
      const i = Math.min(1, Math.floor(((lat + Math.PI / 2) / Math.PI) * 2))
      const j = Math.floor(((lon + Math.PI) / (Math.PI * 2)) * 4) % 4
      const key = `${i}:${j}`
      let cell = cells.get(key)
      if (!cell) {
        cell = new THREE.Group()
        cells.set(key, cell)
      }
      return cell
    }
    const dir = new THREE.Vector3()
    let placed = 0
    let guard = 22000

    // Budgeted against the frame, not the map: the camera on a planet this
    // small sees a long way, so this is roughly as much greenery as can be
    // drawn twice (colour pass + normal pass) and still hold 60fps.
    while (placed < 900 && guard-- > 0) {
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

      // Vegetation by altitude: palms and jepun on the coast, jungle and paddy
      // through the middle, casuarina and bare rock up on the volcanic flanks.
      let prop
      if (h > 20) prop = rngChance(rng, 0.62) ? P.rock(rng, { scale: rngRange(rng, 0.6, 2.2) }) : P.pine(rng, { scale: rngRange(rng, 0.7, 1.2) })
      else if (h < 2.6) prop = rngChance(rng, 0.55) ? P.palm(rng) : rngChance(rng, 0.4) ? P.frangipani(rng, { scale: rngRange(rng, 0.8, 1.1) }) : P.rock(rng, { scale: rngRange(rng, 0.4, 1.2) })
      else if (rngChance(rng, 0.38)) prop = P.tree(rng, { scale: rngRange(rng, 0.8, 1.7) })
      else if (rngChance(rng, 0.22)) prop = P.palm(rng)
      // No terraces out in the wild. A flight is rigid, up to nine metres
      // across and laid flat against a curved planet, so on open hillside the
      // far end climbs metres into the air. They belong on district ground,
      // which the zone flattening has already levelled.
      else if (rngChance(rng, 0.26)) prop = P.frangipani(rng, { scale: rngRange(rng, 0.8, 1.3) })
      else prop = rngChance(rng, 0.5) ? P.bush(rng) : P.grassTuft(rng)

      this.placeLocalYaw(prop, dir.clone(), rng() * Math.PI * 2)
      cellFor(dir).add(prop)
      placed++
    }

    const out = new THREE.Group()
    out.name = 'wilderness'
    for (const cell of cells.values()) out.add(mergeByMaterial(cell))
    return out
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
