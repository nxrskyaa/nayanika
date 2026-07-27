import * as THREE from 'three'
import { CAMERA } from '../core/config.js'
import { moveAlongSphere, signedTangentAngle, tangentBasis } from '../core/sphere.js'

/**
 * Third-person follow camera that lives in the player's tangent frame.
 *
 * Because "up" is always the direction away from the planet core, the horizon
 * curves with the surface — which is most of what sells the small-planet look.
 * The rig auto-swings behind the player after a moment of not being touched,
 * the way the original does.
 */

const _up = new THREE.Vector3()
const _east = new THREE.Vector3()
const _north = new THREE.Vector3()
const _horiz = new THREE.Vector3()
const _offset = new THREE.Vector3()
const _target = new THREE.Vector3()
const _desired = new THREE.Vector3()
const _tmp = new THREE.Vector3()
const _toCam = new THREE.Vector3()
const _probe = new THREE.Vector3()
const _probeDir = new THREE.Vector3()

export class FollowCamera {
  constructor(camera, terrain) {
    this.camera = camera
    this.terrain = terrain

    this.yaw = 0
    this.pitch = CAMERA.pitch
    this.distance = CAMERA.distance
    this.height = CAMERA.height
    this.targetDistance = CAMERA.distance
    this.targetHeight = CAMERA.height
    this.zoom = 1

    this.position = new THREE.Vector3()
    this.lookTarget = new THREE.Vector3()
    this.forward = new THREE.Vector3(0, 0, 1)

    this.sinceInput = 99
    this.enabled = true
    this.shake = 0
    this._initialised = false
    /** Set while a conversation is on screen. */
    this.focus = null
  }

  setZoneFraming(zone) {
    this.targetDistance = (zone?.camera?.distance ?? CAMERA.distance) * this.zoom
    this.targetHeight = zone?.camera?.height ?? CAMERA.height
  }

  applyLook(delta, dt) {
    if (!this.enabled) return
    if (delta.x || delta.y) {
      this.yaw -= delta.x * 0.0042
      this.pitch = THREE.MathUtils.clamp(this.pitch + delta.y * 0.0032, CAMERA.minPitch, CAMERA.maxPitch)
      this.sinceInput = 0
    } else {
      this.sinceInput += dt
    }
  }

  applyZoom(amount) {
    if (!amount) return
    this.zoom = THREE.MathUtils.clamp(this.zoom + amount * 0.09, 0.55, 2.1)
  }

  /** Snap instantly behind the player, used on spawn and after cutscenes. */
  snapBehind(player) {
    this._alignTo(player, 1)
    this._initialised = false
  }

  _alignTo(player, t) {
    _up.copy(player.up)
    tangentBasis(_up, _east, _north)
    const heading = signedTangentAngle(_up, _north, player.heading)
    // Camera yaw is measured the same way as the player's heading, so aligning
    // is a straight angular lerp on the shortest path.
    let delta = heading - this.yaw
    while (delta > Math.PI) delta -= Math.PI * 2
    while (delta < -Math.PI) delta += Math.PI * 2
    this.yaw += delta * t
  }

  update(dt, player) {
    const cam = this.camera
    const terrain = this.terrain

    _up.copy(player.up)
    tangentBasis(_up, _east, _north)

    // Re-centre behind the player once they have stopped steering the camera.
    if (this.enabled && this.sinceInput > CAMERA.autoAlignDelay && player.speed > 0.6) {
      const k = 1 - Math.exp(-CAMERA.yawLerp * 0.55 * dt)
      this._alignTo(player, k)
    }

    this.distance = THREE.MathUtils.damp(this.distance, this.targetDistance * this.zoom, 3.5, dt)
    this.height = THREE.MathUtils.damp(this.height, this.targetHeight, 3.5, dt)

    // Where the camera is pointing, in the tangent plane. Yaw turns north -> west
    // as it grows, which is the sign convention signedTangentAngle() reports in
    // _alignTo() and the one that makes a rightward drag look right.
    _horiz.copy(_north).multiplyScalar(Math.cos(this.yaw)).addScaledVector(_east, -Math.sin(this.yaw)).normalize()
    this.forward.copy(_horiz)

    _target.copy(player.worldPos).addScaledVector(_up, player.rig.height * 0.56)
    if (this.focus) _target.lerp(this.focus, 0.32)

    const cp = Math.cos(this.pitch)
    const sp = Math.sin(this.pitch)
    _offset.copy(_horiz).multiplyScalar(-this.distance * cp).addScaledVector(_up, this.distance * sp + this.height)
    _desired.copy(_target).add(_offset)

    // Keep the camera above the ground.
    _tmp.copy(_desired).normalize()
    const groundR = terrain.radius + Math.max(terrain.heightAt(_tmp), 0) + 0.9
    if (_desired.length() < groundR) _desired.setLength(groundR)

    // And out of buildings.
    this._avoidObstacles(player, _target, _desired)

    if (!this._initialised) {
      this.position.copy(_desired)
      this.lookTarget.copy(_target)
      this._initialised = true
    } else {
      const k = 1 - Math.exp(-CAMERA.followLerp * dt)
      this.position.lerp(_desired, k)
      this.lookTarget.lerp(_target, Math.min(1, k * 1.5))
    }

    cam.position.copy(this.position)
    cam.up.copy(_up)
    cam.lookAt(this.lookTarget)

    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.4)
      const s = this.shake * this.shake * 0.09
      cam.position.addScaledVector(_east, (Math.random() - 0.5) * s)
      cam.position.addScaledVector(_up, (Math.random() - 0.5) * s)
    }
  }

  /**
   * If a building sits between the player and the camera, dolly in. Uses the
   * world's circular colliders rather than raycasting the merged meshes.
   */
  _avoidObstacles(player, target, desired) {
    const world = player.world
    if (!world?.obstacles?.length) return
    const R = this.terrain.radius

    _toCam.copy(desired).sub(target)
    const camDist = _toCam.length()
    if (camDist < 0.01) return
    _toCam.divideScalar(camDist)

    let closest = camDist
    const steps = 7
    for (let i = 1; i <= steps; i++) {
      const d = (camDist * i) / steps
      _probe.copy(target).addScaledVector(_toCam, d)
      const dir = _probeDir.copy(_probe).normalize()
      const surface = R + Math.max(this.terrain.heightAt(dir), 0)
      const above = _probe.length() - surface

      // Only obstacles that reach this high can block the view.
      if (above > 9) continue
      for (let k = 0; k < world.obstacles.length; k++) {
        const o = world.obstacles[k]
        const dot = THREE.MathUtils.clamp(dir.dot(o.dir), -1, 1)
        if (Math.acos(dot) * R < o.radius * 0.85) {
          closest = Math.min(closest, d - 0.55)
          break
        }
      }
      if (closest < camDist) break
    }

    if (closest < camDist) {
      desired.copy(target).addScaledVector(_toCam, Math.max(1.5, closest))
    }
  }
}

/** Used by the intro fly-in. */
export function orbitPoint(dir, radius, angle, pitch, out = new THREE.Vector3()) {
  const up = _up.copy(dir).normalize()
  tangentBasis(up, _east, _north)
  const horiz = _horiz.copy(_north).multiplyScalar(Math.cos(angle)).addScaledVector(_east, -Math.sin(angle))
  const p = moveAlongSphere(up, horiz, pitch, _tmp)
  return out.copy(p).multiplyScalar(radius)
}
