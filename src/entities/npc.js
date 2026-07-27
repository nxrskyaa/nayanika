import * as THREE from 'three'
import { INTERACT } from '../core/config.js'
import { moveAlongSphere, surfaceQuaternion, tangentBasis, slerpDir } from '../core/sphere.js'
import { makeRng, rngPick, rngRange, rngInt } from '../core/rng.js'
import { ACCENT, BUILD, CHAR } from '../core/palette.js'
import { Animator } from './animator.js'
import { createCharacter, HAIR_STYLES } from './rig.js'

/**
 * Townsfolk.
 *
 * Named NPCs stand at an anchor and turn to face you when you come close.
 * Wanderers walk a loop of street points so the districts are never still.
 */

const _t = new THREE.Vector3()
const _t2 = new THREE.Vector3()
const _east = new THREE.Vector3()
const _north = new THREE.Vector3()

function localOffset(center, x, z, radius, out = new THREE.Vector3()) {
  const len = Math.hypot(x, z)
  if (len < 1e-6) return out.copy(center).normalize()
  tangentBasis(center, _east, _north)
  const t = _t.copy(_east).multiplyScalar(x / len).addScaledVector(_north, z / len)
  return moveAlongSphere(center, t, len / radius, out)
}

export class NPC {
  constructor(def, terrain, world) {
    this.def = def
    this.id = def.id
    this.name = def.name
    this.terrain = terrain
    this.world = world

    this.rig = createCharacter(def.look || {})
    this.animator = new Animator(this.rig)
    this.object = this.rig.root
    this.object.name = `npc:${def.id}`

    this.dir = new THREE.Vector3(0, 1, 0)
    this.heading = new THREE.Vector3(0, 0, 1)
    this.baseHeading = new THREE.Vector3(0, 0, 1)
    this.worldPos = new THREE.Vector3()
    this.headPos = new THREE.Vector3()
    this.up = new THREE.Vector3(0, 1, 0)

    this.talking = false
    this.nearby = false
    this.hasBubble = true
    this.interactable = true
    this.idleIndex = 0
    this._faceBlend = 0
  }

  place() {
    const anchorDir = this.world.getAnchor(this.def.at)
    let base = anchorDir
    if (!base && Array.isArray(this.def.at)) base = new THREE.Vector3(...this.def.at).normalize()
    if (!base) base = new THREE.Vector3(0, 1, 0)

    const [ox, oz] = this.def.offset || [0, 0]
    localOffset(base, ox, oz, this.terrain.radius, this.dir)
    this.dir.normalize()

    tangentBasis(this.dir, _east, _north)
    const yaw = this.def.facing ?? 0
    this.baseHeading.copy(_north).multiplyScalar(Math.cos(yaw)).addScaledVector(_east, Math.sin(yaw)).normalize()
    this.heading.copy(this.baseHeading)
    this.sync()
    return this
  }

  sync() {
    const h = Math.max(this.terrain.heightAt(this.dir), 0)
    this.up.copy(this.dir).normalize()
    this.worldPos.copy(this.up).multiplyScalar(this.terrain.radius + h)
    this.object.position.copy(this.worldPos)
    surfaceQuaternion(this.up, this.heading, this.object.quaternion)
    this.headPos.copy(this.worldPos).addScaledVector(this.up, this.rig.height * 0.98)
  }

  distanceTo(player) {
    const dot = THREE.MathUtils.clamp(this.dir.dot(player.dir), -1, 1)
    return Math.acos(dot) * this.terrain.radius
  }

  update(dt, player) {
    const d = this.distanceTo(player)
    this.nearby = d < INTERACT.notice

    // Turn to face whoever is talking to us.
    const shouldFace = this.talking || d < INTERACT.talk * 1.35
    this._faceBlend = THREE.MathUtils.damp(this._faceBlend, shouldFace ? 1 : 0, 4, dt)

    if (this._faceBlend > 0.001) {
      _t.copy(player.worldPos).sub(this.worldPos)
      _t.addScaledVector(this.up, -this.up.dot(_t))
      if (_t.lengthSq() > 1e-6) {
        _t.normalize()
        _t2.copy(this.baseHeading).lerp(_t, this._faceBlend).normalize()
        this.heading.copy(_t2)
      }
    } else {
      this.heading.copy(this.baseHeading)
    }

    // Head tracking on top of the body turn.
    if (d < INTERACT.notice) {
      _t.copy(player.worldPos).sub(this.worldPos)
      _t.addScaledVector(this.up, -this.up.dot(_t))
      if (_t.lengthSq() > 1e-6) {
        _t.normalize()
        const fwd = _t2.copy(this.heading).normalize()
        const right = _east.crossVectors(this.up, fwd).normalize()
        const yaw = Math.atan2(-right.dot(_t), fwd.dot(_t))
        const rise = player.worldPos.clone().sub(this.headPos).dot(this.up)
        this.animator.lookAt(yaw, THREE.MathUtils.clamp(-rise * 0.25, -0.4, 0.4))
      }
    } else {
      this.animator.lookAt(0, 0)
    }

    this.sync()
    this.animator.update(dt, { speed01: 0, grounded: true, talking: this.talking })
  }

  nextIdleLine() {
    const lines = this.def.idle || ['...']
    const line = lines[this.idleIndex % lines.length]
    this.idleIndex++
    return line
  }
}

/**
 * Background pedestrians. They loop a patrol built from a district's street
 * centrelines, which keeps them on the pavement without any pathfinding.
 */
export class Wanderer {
  constructor(path, terrain, world, seed) {
    this.terrain = terrain
    this.world = world
    const rng = makeRng(seed)

    this.rig = createCharacter(randomLook(rng))
    this.animator = new Animator(this.rig)
    this.object = this.rig.root
    this.object.name = 'pedestrian'

    this.path = path
    this.t = rng()
    this.speed = rngRange(rng, 1.1, 2.2)
    this.dirSign = rng() > 0.5 ? 1 : -1
    this.pauseTimer = rngRange(rng, 2, 14)
    this.paused = false

    this.dir = new THREE.Vector3()
    this.heading = new THREE.Vector3(0, 0, 1)
    this.worldPos = new THREE.Vector3()
    this.headPos = new THREE.Vector3()
    this.up = new THREE.Vector3(0, 1, 0)
    this.talking = false
    this.interactable = false
    this.hasBubble = false
    this._pathLength = estimatePathLength(path, terrain.radius)
    this.sample(this.t, this.dir)
  }

  sample(t, out) {
    const n = this.path.length
    const f = THREE.MathUtils.clamp(t, 0, 0.9999) * (n - 1)
    const i = Math.floor(f)
    const frac = f - i
    return slerpDir(this.path[i], this.path[Math.min(n - 1, i + 1)], frac, out)
  }

  update(dt, player) {
    if (this.paused) {
      this.pauseTimer -= dt
      if (this.pauseTimer <= 0) {
        this.paused = false
        this.pauseTimer = rngRangeFast(4, 18)
      }
    } else {
      this.pauseTimer -= dt
      if (this.pauseTimer <= 0) {
        this.paused = true
        this.pauseTimer = rngRangeFast(1.5, 5)
      }
      const step = (this.speed * dt) / Math.max(this._pathLength, 1)
      this.t += step * this.dirSign
      if (this.t > 1) {
        this.t = 1
        this.dirSign = -1
      } else if (this.t < 0) {
        this.t = 0
        this.dirSign = 1
      }
    }

    const prev = _t.copy(this.dir)
    this.sample(this.t, this.dir)
    this.up.copy(this.dir).normalize()

    _t2.copy(this.dir).sub(prev)
    _t2.addScaledVector(this.up, -this.up.dot(_t2))
    if (_t2.lengthSq() > 1e-10) {
      _t2.normalize()
      this.heading.lerp(_t2, 1 - Math.exp(-6 * dt)).normalize()
    }

    const h = Math.max(this.terrain.heightAt(this.dir), 0)
    this.worldPos.copy(this.up).multiplyScalar(this.terrain.radius + h)
    this.object.position.copy(this.worldPos)
    surfaceQuaternion(this.up, this.heading, this.object.quaternion)
    this.headPos.copy(this.worldPos).addScaledVector(this.up, this.rig.height * 0.98)

    const moving = !this.paused
    this.animator.update(dt, {
      speed01: moving ? this.speed / 9.4 : 0,
      grounded: true,
      talking: false,
    })
  }

  distanceTo(player) {
    const dot = THREE.MathUtils.clamp(this.dir.dot(player.dir), -1, 1)
    return Math.acos(dot) * this.terrain.radius
  }
}

function estimatePathLength(path, radius) {
  let total = 0
  for (let i = 1; i < path.length; i++) {
    total += Math.acos(THREE.MathUtils.clamp(path[i - 1].dot(path[i]), -1, 1)) * radius
  }
  return total
}

function rngRangeFast(a, b) {
  return a + Math.random() * (b - a)
}

const SHIRTS = [0xf3efe2, 0xd9e3e6, 0xe7b6ac, 0xc6d6c2, 0xf2c24b, 0x8fb0c4, 0xe4622f, 0x4fae63, 0x2f3438]
const PANTS = [0x212223, 0x4a5158, 0x8a7a5e, 0x2c4a6b, 0x6d5f54, 0x39434b]
const SHOES = [0x35bfa0, 0xc6394a, 0x3fa7c9, 0x212223, 0xf3efe2, 0xe4622f, 0x8a7a5e]
const HAIRS = [0x1a1a1c, 0x40352c, 0x7a5638, 0xb98d52, 0xd8d2c6, 0x2f4f63, 0x7d3a4a, 0x2b2a2c]
const SKINS = [0xf7d9c0, 0xf4cdb0, 0xe4b189, 0xc98f63, 0x9c6540, 0x6f452b]

function randomLook(rng) {
  const style = rngPick(rng, HAIR_STYLES.filter((s) => s !== 'strawHat'))
  return {
    hairStyle: style,
    hair: rngPick(rng, HAIRS),
    skin: rngPick(rng, SKINS),
    shirt: rngPick(rng, SHIRTS),
    shorts: rngPick(rng, PANTS),
    shoes: rngPick(rng, SHOES),
    socks: 0xf2f0e8,
    bag: rng() > 0.72 ? rngPick(rng, [ACCENT.red, ACCENT.blue, BUILD.tan]) : null,
    accessory: rng() > 0.75 ? rngPick(rng, ['tie', 'backpack', 'apron']) : null,
    accessoryColor: rngPick(rng, [ACCENT.amber, ACCENT.deepRed, ACCENT.navy, BUILD.metal]),
    longPants: rng() > 0.45,
    longSleeves: rng() > 0.35,
    scale: rngRange(rng, 0.86, 1.12),
    build: rngRange(rng, 0.92, 1.12),
  }
}

export { randomLook }
