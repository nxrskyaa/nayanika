/**
 * Automated play-through.
 *
 * Drives the real player, the real NPCs and the real camera for a simulated
 * stretch of game time and asserts the invariants a person would notice within
 * seconds of picking up the controller: nobody standing inside the ground,
 * nobody walking through a wall, nobody moonwalking, no gap in the road.
 *
 * Development only — `main.js` attaches it to window under `import.meta.env.DEV`
 * and it is never reachable from a production bundle.
 */

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)

/** Walk the player a lap of the planet, watching for feet below the surface. */
function walkTest(N, { seconds = 90, dt = 1 / 60 } = {}) {
  const { player: p, followCam: cam, terrain: t, world } = N
  const R = t.radius
  const fail = { sunk: 0, worstSunkM: 0, aboveGround: 0, worstFloatM: 0, insideBuilding: 0, samples: 0 }

  // A long run in a wandering direction, plus periodic jumps.
  let steer = 0
  const steps = Math.round(seconds / dt)
  for (let i = 0; i < steps; i++) {
    steer += dt * 0.35
    const move = { x: Math.sin(steer) * 0.85, y: Math.cos(steer * 0.63) }
    const len = Math.hypot(move.x, move.y) || 1
    move.x /= len
    move.y /= len
    p.update(dt, move, cam.forward, i % 900 < 450, i % 240 === 0)
    cam.update(dt, p)

    if (i % 3) continue
    fail.samples++

    // Feet against the surface actually drawn under them.
    const ground = Math.max(t.renderHeightAt(p.dir), 0)
    const gap = p.elevation - (R + ground)
    if (gap < -0.05) {
      fail.sunk++
      fail.worstSunkM = Math.min(fail.worstSunkM, gap)
    }
    if (p.grounded && gap > 0.5) {
      fail.aboveGround++
      fail.worstFloatM = Math.max(fail.worstFloatM, gap)
    }

    // Standing inside a building footprint.
    for (let k = 0; k < world.obstacles.length; k++) {
      const o = world.obstacles[k]
      const d = Math.acos(clamp(p.dir.dot(o.dir), -1, 1)) * R
      if (d < o.radius - 0.35) {
        fail.insideBuilding++
        break
      }
    }
  }
  return fail
}

/** Run every pedestrian and named NPC, watching for clipping and moonwalking. */
function crowdTest(N, npcs, wanderers, { seconds = 60, dt = 1 / 60 } = {}) {
  const { player: p, terrain: t, world } = N
  const R = t.radius
  const out = {
    samples: 0,
    npcSunk: 0,
    npcWorstSunkM: 0,
    npcInsideBuilding: 0,
    wandererInsideBuilding: 0,
    wandererMoonwalkFrames: 0,
    wandererWorstFacingDot: 1,
  }
  const prev = wanderers.map((w) => w.dir.clone())
  const prevSign = wanderers.map((w) => w.dirSign)

  const steps = Math.round(seconds / dt)
  for (let i = 0; i < steps; i++) {
    for (const n of npcs) n.update(dt, p)
    for (const w of wanderers) w.update(dt, p)

    if (i % 4) continue
    out.samples++

    for (const n of npcs) {
      const gap = n.worldPos.length() - (R + Math.max(t.renderHeightAt(n.dir), 0))
      if (gap < -0.05) {
        out.npcSunk++
        out.npcWorstSunkM = Math.min(out.npcWorstSunkM, gap)
      }
      for (const o of world.obstacles) {
        if (Math.acos(clamp(n.dir.dot(o.dir), -1, 1)) * R < o.radius - 0.35) {
          out.npcInsideBuilding++
          break
        }
      }
    }

    for (let k = 0; k < wanderers.length; k++) {
      const w = wanderers[k]
      for (const o of world.obstacles) {
        if (Math.acos(clamp(w.dir.dot(o.dir), -1, 1)) * R < o.radius - 0.35) {
          out.wandererInsideBuilding++
          break
        }
      }
      // Facing versus the way they actually moved since the last sample. A
      // sample that straddles a turnaround contains travel in both directions,
      // so it says nothing about facing — skip those rather than count them.
      const reversedSinceLast = w.dirSign !== prevSign[k]
      const travel = w.dir.clone().sub(prev[k])
      const up = w.dir.clone().normalize()
      travel.addScaledVector(up, -up.dot(travel))
      if (travel.lengthSq() > 1e-9 && !w.paused && !reversedSinceLast) {
        travel.normalize()
        const facing = w.heading.clone().normalize()
        const d = facing.dot(travel)
        out.wandererWorstFacingDot = Math.min(out.wandererWorstFacingDot, d)
        if (d < -0.35) out.wandererMoonwalkFrames++
      }
      prev[k].copy(w.dir)
      prevSign[k] = w.dirSign
    }
  }
  return out
}

/** Are there holes in the road surface anywhere along it? */
function roadTest(N) {
  const { terrain: t, world } = N
  const R = t.radius
  const decal = new Set(['8f9a94', 'd6cfbb', 'e2d5b4', 'f6f3e8', '77827d'])
  const V = world.obstacles[0]?.dir.constructor
  if (!V) return { tris: 0 }
  const a = new V()
  const b = new V()
  const c = new V()
  const cen = new V()
  let tris = 0
  let buried = 0
  let worst = 0

  world.root.traverse((o) => {
    if (!o.isMesh || !o.material?.color) return
    if (!decal.has(o.material.color.getHexString())) return
    const g = o.geometry
    const pos = g.attributes.position
    const idx = g.index
    const n = idx ? idx.count : pos.count
    for (let i = 0; i + 2 < n; i += 3) {
      const i0 = idx ? idx.getX(i) : i
      const i1 = idx ? idx.getX(i + 1) : i + 1
      const i2 = idx ? idx.getX(i + 2) : i + 2
      a.fromBufferAttribute(pos, i0).applyMatrix4(o.matrixWorld)
      b.fromBufferAttribute(pos, i1).applyMatrix4(o.matrixWorld)
      c.fromBufferAttribute(pos, i2).applyMatrix4(o.matrixWorld)
      cen.addVectors(a, b).add(c).multiplyScalar(1 / 3)
      const d = cen.length() - (R + Math.max(t.renderHeightAt(cen.clone().normalize()), 0))
      tris++
      if (d < -0.02) {
        buried++
        worst = Math.min(worst, d)
      }
    }
  })
  return { tris, buried, pct: +((100 * buried) / Math.max(1, tris)).toFixed(2), worstM: +worst.toFixed(2) }
}

/**
 * Anything solid standing in a carriageway, and any break in the trunk road.
 * Both are things a player sees within a minute of walking anywhere.
 */
function worldTest(N) {
  const { world, terrain: t } = N
  const R = t.radius
  let inCarriageway = 0
  let worstIntrusionM = 0
  for (const o of world.obstacles) {
    let nearest = 1e9
    for (const d of world.highwayDirs) {
      nearest = Math.min(nearest, Math.acos(Math.min(1, Math.max(-1, o.dir.dot(d)))) * R)
    }
    for (const d of world.roadDirs) {
      nearest = Math.min(nearest, Math.acos(Math.min(1, Math.max(-1, o.dir.dot(d)))) * R)
    }
    const clear = nearest - o.radius
    if (clear < 3.3) {
      inCarriageway++
      worstIntrusionM = Math.max(worstIntrusionM, 3.3 - clear)
    }
  }

  // The loop road has to actually reach every district it serves.
  let worstGapM = 0
  for (const z of N.zones) {
    let nearest = 1e9
    for (const d of world.highwayDirs) {
      nearest = Math.min(nearest, Math.acos(Math.min(1, Math.max(-1, z.dir.dot(d)))) * R)
    }
    worstGapM = Math.max(worstGapM, nearest)
  }
  return { inCarriageway, worstIntrusionM: +worstIntrusionM.toFixed(2), worstHighwayGapM: +worstGapM.toFixed(1) }
}

export function runPlaytest(N, npcs, wanderers, opts = {}) {
  const walk = walkTest(N, opts)
  const crowd = crowdTest(N, npcs, wanderers, opts)
  const road = roadTest(N)
  const world = worldTest(N)
  const problems = []
  if (world.inCarriageway) problems.push(`${world.inCarriageway} solid props stand in a road (worst ${world.worstIntrusionM}m in)`)
  if (world.worstHighwayGapM > 6) problems.push(`the loop road stops ${world.worstHighwayGapM}m short of a district`)
  if (walk.sunk) problems.push(`player sank below the surface on ${walk.sunk} samples (worst ${walk.worstSunkM.toFixed(2)}m)`)
  if (walk.insideBuilding) problems.push(`player ended up inside a building on ${walk.insideBuilding} samples`)
  if (crowd.npcSunk) problems.push(`NPCs sank on ${crowd.npcSunk} samples (worst ${crowd.npcWorstSunkM.toFixed(2)}m)`)
  if (crowd.npcInsideBuilding) problems.push(`NPCs stood inside a building on ${crowd.npcInsideBuilding} samples`)
  if (crowd.wandererInsideBuilding) problems.push(`pedestrians walked through a building on ${crowd.wandererInsideBuilding} samples`)
  if (crowd.wandererMoonwalkFrames) problems.push(`pedestrians moonwalked on ${crowd.wandererMoonwalkFrames} samples`)
  if (road.pct > 0.5) problems.push(`${road.pct}% of road surface is under the terrain (worst ${road.worstM}m)`)
  return { walk, crowd, road, world, problems, clean: problems.length === 0 }
}
