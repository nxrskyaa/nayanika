import * as THREE from 'three'
import { PLAYER } from '../core/config.js'
import { moveAlongSphere, tangentBasis, surfaceQuaternion, headingTowards } from '../core/sphere.js'
import { Animator } from './animator.js'
import { createCharacter } from './rig.js'

/**
 * The messenger.
 *
 * Position is (unit direction, elevation from the planet core). Walking is a
 * rotation of that direction along a great circle, so there is no drift and no
 * pole singularity to worry about.
 */

const _t = new THREE.Vector3()
const _t2 = new THREE.Vector3()
const _desired = new THREE.Vector3()
const _east = new THREE.Vector3()
const _north = new THREE.Vector3()
const _nextDir = new THREE.Vector3()
const _push = new THREE.Vector3()
const _right = new THREE.Vector3()

export class Player {
  constructor(terrain, world, look = {}) {
    this.terrain = terrain
    this.world = world

    this.rig = createCharacter(look)
    this.animator = new Animator(this.rig)
    this.object = this.rig.root

    this.dir = new THREE.Vector3(0, 1, 0)
    this.elevation = terrain.radius
    this.heading = new THREE.Vector3(0, 0, 1)
    this.speed = 0
    this.verticalVel = 0
    this.grounded = true
    this.frozen = false
    this.carrying = false
    this.talking = false

    this.up = new THREE.Vector3(0, 1, 0)
    this.worldPos = new THREE.Vector3()
    this.eyePos = new THREE.Vector3()
  }

  spawn(dir) {
    this.dir.copy(dir).normalize()
    const { north } = tangentBasis(this.dir, _east, _north)
    this.heading.copy(north)
    this.elevation = this.terrain.radius + this.groundHeight()
    this.speed = 0
    this.verticalVel = 0
    this.syncTransform()
  }

  groundHeight(dir = this.dir) {
    return Math.max(this.terrain.heightAt(dir), 0)
  }

  get groundElevation() {
    return this.terrain.radius + this.groundHeight()
  }

  syncTransform() {
    this.up.copy(this.dir).normalize()
    this.worldPos.copy(this.up).multiplyScalar(this.elevation)
    this.object.position.copy(this.worldPos)
    surfaceQuaternion(this.up, this.heading, this.object.quaternion)
    this.eyePos.copy(this.worldPos).addScaledVector(this.up, PLAYER.height * 0.62)
  }

  /**
   * @param dt          seconds
   * @param moveInput   {x, y} in camera space, already clamped to the unit disc
   * @param camForward  world-space forward of the camera
   * @param wantsRun    boolean
   * @param wantsJump   boolean
   */
  update(dt, moveInput, camForward, wantsRun, wantsJump) {
    const R = this.terrain.radius
    const up = _t.copy(this.dir).normalize()
    tangentBasis(up, _east, _north)

    // Camera-relative movement basis.
    _t2.copy(camForward)
    _t2.addScaledVector(up, -up.dot(_t2))
    if (_t2.lengthSq() < 1e-8) _t2.copy(_north)
    _t2.normalize()
    // forward × up, not up × forward — the other order points west and hands
    // you a game where D walks left.
    const right = _right.crossVectors(_t2, up).normalize()

    const inputLen = Math.hypot(moveInput.x, moveInput.y)
    let hasInput = inputLen > 0.02 && !this.frozen && !this.talking

    if (hasInput) {
      _desired.copy(_t2).multiplyScalar(moveInput.y).addScaledVector(right, moveInput.x)
      if (_desired.lengthSq() < 1e-8) hasInput = false
      else _desired.normalize()
    }

    const maxSpeed = (wantsRun ? PLAYER.runSpeed : PLAYER.walkSpeed) * Math.min(1, inputLen / 0.9)
    const targetSpeed = hasInput ? maxSpeed : 0
    const rate = targetSpeed > this.speed ? PLAYER.accel : PLAYER.decel
    this.speed = THREE.MathUtils.damp(this.speed, targetSpeed, rate / 6, dt)
    if (this.speed < 0.02) this.speed = 0

    // Turn toward the desired heading.
    if (hasInput) {
      const turn = 1 - Math.exp(-PLAYER.turnRate * dt)
      this.heading.lerp(_desired, turn)
      this.heading.addScaledVector(up, -up.dot(this.heading))
      if (this.heading.lengthSq() < 1e-8) this.heading.copy(_desired)
      this.heading.normalize()
    }

    // Walk the great circle.
    if (this.speed > 0) {
      const stepDist = this.speed * dt
      const angle = stepDist / R
      moveAlongSphere(this.dir, this.heading, angle, _nextDir)

      const curH = this.groundHeight(this.dir)
      const nextH = this.groundHeight(_nextDir)
      const rise = nextH - curH
      const climbable = !this.grounded || rise <= 0 || rise / Math.max(stepDist, 1e-4) < 1.25

      if (climbable) {
        this.dir.copy(_nextDir)
      } else {
        // Slide along the wall of the slope instead of stopping dead.
        const side = _push.crossVectors(up, this.heading).normalize()
        moveAlongSphere(this.dir, side, angle * 0.55, _nextDir)
        if (this.groundHeight(_nextDir) - curH < rise * 0.5) this.dir.copy(_nextDir)
        this.speed *= 0.5
      }
      this.dir.normalize()
    }

    this.resolveObstacles()

    // Vertical.
    const groundEl = this.groundElevation
    if (this.grounded && wantsJump && !this.frozen && !this.talking) {
      this.verticalVel = PLAYER.jumpSpeed
      this.grounded = false
    }

    if (!this.grounded) {
      this.verticalVel -= PLAYER.gravity * dt
      this.elevation += this.verticalVel * dt
      if (this.elevation <= groundEl) {
        this.elevation = groundEl
        this.verticalVel = 0
        this.grounded = true
      }
    } else {
      // Stick to the ground, but ease over bumps so the camera does not jolt.
      this.elevation = THREE.MathUtils.damp(this.elevation, groundEl, 22, dt)
      if (this.elevation < groundEl - 0.6) this.elevation = groundEl
      if (groundEl - this.elevation > 0.35) {
        this.grounded = false
        this.verticalVel = 0
      }
    }

    this.syncTransform()

    const speed01 = this.speed / PLAYER.runSpeed
    this.animator.update(dt, {
      speed01,
      grounded: this.grounded,
      talking: this.talking,
      carrying: this.carrying,
    })
  }

  /** Push out of building footprints. */
  resolveObstacles() {
    const obstacles = this.world?.obstacles
    if (!obstacles || !obstacles.length) return
    const R = this.terrain.radius
    const r = PLAYER.radius

    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i]
      const dot = THREE.MathUtils.clamp(this.dir.dot(o.dir), -1, 1)
      const distance = Math.acos(dot) * R
      const minDist = o.radius + r
      if (distance >= minDist) continue

      // Push straight out from the obstacle centre.
      headingTowards(o.dir, this.dir, _push)
      if (_push.lengthSq() < 1e-8) continue
      moveAlongSphere(o.dir, _push, minDist / R, _nextDir)
      this.dir.copy(_nextDir).normalize()
    }
  }

  /** Turn the head toward a world point, for conversations. */
  glanceAt(point) {
    const toTarget = _t.copy(point).sub(this.worldPos)
    const up = _t2.copy(this.up)
    toTarget.addScaledVector(up, -up.dot(toTarget))
    if (toTarget.lengthSq() < 1e-6) return
    toTarget.normalize()
    const forward = _desired.copy(this.heading).normalize()
    const right = _east.crossVectors(up, forward).normalize()
    const yaw = Math.atan2(-right.dot(toTarget), forward.dot(toTarget))
    this.animator.lookAt(yaw, 0)
  }

  clearGlance() {
    this.animator.lookAt(0, 0)
  }
}
