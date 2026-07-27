import * as THREE from 'three'
import { DIM } from './rig.js'

/**
 * Procedural animation for the rig.
 *
 * No clips, no skinning — just sine curves driving bone rotations. It is
 * enough for a walk, a run, a jump and a bit of gesturing, and it means every
 * character in the game animates for the cost of a few dozen multiplications.
 */

const lerp = THREE.MathUtils.lerp
const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt))

export class Animator {
  constructor(rig) {
    this.rig = rig
    this.phase = Math.random() * Math.PI * 2
    this.idleTime = Math.random() * 10
    this.speed01 = 0
    this.airborne = 0
    this.talk = 0
    this.emote = 0
    this.emoteTimer = 0
    this.headYaw = 0
    this.headPitch = 0
    this.targetHeadYaw = 0
    this.targetHeadPitch = 0
    this.carryPose = 0
    this.landBounce = 0
    this._wasGrounded = true
    this.footPhase = 0
    /** Set by the game so footstep audio lands on the beat. */
    this.onFootstep = null
    this._lastFootSign = 0
  }

  playEmote(duration = 1.1) {
    this.emote = 1
    this.emoteTimer = duration
  }

  lookAt(yaw, pitch) {
    this.targetHeadYaw = THREE.MathUtils.clamp(yaw, -1.1, 1.1)
    this.targetHeadPitch = THREE.MathUtils.clamp(pitch, -0.6, 0.6)
  }

  update(dt, state) {
    const { bones, body } = this.rig
    const { hips, chest, neck, head, arms, legs } = bones

    const targetSpeed = THREE.MathUtils.clamp(state.speed01 ?? 0, 0, 1)
    this.speed01 = damp(this.speed01, targetSpeed, 12, dt)
    const grounded = state.grounded !== false
    this.airborne = damp(this.airborne, grounded ? 0 : 1, 10, dt)
    this.talk = damp(this.talk, state.talking ? 1 : 0, 8, dt)
    this.carryPose = damp(this.carryPose, state.carrying ? 1 : 0, 6, dt)

    if (!this._wasGrounded && grounded) this.landBounce = 1
    this._wasGrounded = grounded
    this.landBounce = Math.max(0, this.landBounce - dt * 4.5)

    if (this.emoteTimer > 0) {
      this.emoteTimer -= dt
      if (this.emoteTimer <= 0) this.emote = 0
    }

    this.idleTime += dt
    const moving = this.speed01 > 0.02

    // Stride rate scales with speed; runs take longer strides, not just faster.
    const stride = lerp(6.4, 10.6, this.speed01)
    if (moving) this.phase += dt * stride * (0.55 + this.speed01 * 0.75)
    else this.phase = damp(this.phase % (Math.PI * 2), Math.PI * 0.5, 4, dt)

    const p = this.phase
    const sp = this.speed01
    const walkAmp = lerp(0.42, 0.95, sp)
    const armAmp = lerp(0.34, 0.86, sp)

    // Footstep events on each downbeat.
    const footSign = Math.sign(Math.sin(p))
    if (moving && grounded && footSign !== 0 && footSign !== this._lastFootSign) {
      this._lastFootSign = footSign
      if (this.onFootstep) this.onFootstep(sp)
    }

    // --- legs ---------------------------------------------------------
    //
    // Sign convention: a limb hangs down -Y, so a positive rotation.x carries
    // it backwards and a negative one forwards. A knee only bends backwards,
    // which means the shin angle must never go below zero — it was authored
    // negative throughout, so the knees hinged the wrong way on every step and
    // folded forwards in mid-air.
    for (const side of ['L', 'R']) {
      const s = side === 'L' ? 0 : Math.PI
      const leg = legs[side]
      const swing = Math.sin(p + s)
      const blend = Math.min(1, sp * 6)

      // Thigh forward on the front half of the stride, back on the rear half.
      const thighX = lerp(idleLeg(this.idleTime, side), -swing * walkAmp * 0.85, blend)
      // Knee folds through the swing-through, straightens under load, and
      // keeps a little slack so it never locks solid.
      const kneeX = lerp(0.08, Math.max(0, Math.cos(p + s)) * walkAmp * 1.5 + 0.1, blend)

      // Airborne: one leg tucked up in front, the other trailing, both bent.
      const airThigh = side === 'L' ? -0.78 : 0.2
      const airKnee = side === 'L' ? 1.25 : 0.8
      const airFoot = side === 'L' ? 0.3 : 0.46

      leg.thigh.rotation.x = lerp(thighX, airThigh, this.airborne)
      leg.thigh.rotation.z = 0
      leg.shin.rotation.x = Math.max(0, lerp(kneeX, airKnee, this.airborne))
      // Keep the sole roughly level with the ground instead of pointing
      // wherever the leg happens to finish.
      leg.foot.rotation.x = lerp(-(thighX + kneeX) * 0.45, airFoot, this.airborne)
    }

    // --- arms ---------------------------------------------------------
    const gesture = Math.sin(this.idleTime * 2.6) * 0.32 * this.talk
    for (const side of ['L', 'R']) {
      const s = side === 'L' ? Math.PI : 0
      const arm = arms[side]
      const swing = Math.sin(p + s)
      const sgn = side === 'L' ? -1 : 1

      let upperX = lerp(idleArm(this.idleTime, side), -swing * armAmp, Math.min(1, sp * 6))
      let upperZ = sgn * lerp(0.14, 0.24, sp)
      let foreX = lerp(-0.22, -0.5 - Math.max(0, swing) * 0.55, Math.min(1, sp * 6))

      // Talking gestures use the right arm.
      if (side === 'R') {
        upperX = lerp(upperX, -0.55 + gesture, this.talk * (1 - sp))
        foreX = lerp(foreX, -1.25 - gesture * 0.6, this.talk * (1 - sp))
      }

      // Carrying a parcel: both forearms come up.
      foreX = lerp(foreX, -1.5, this.carryPose * (1 - sp * 0.6))
      upperX = lerp(upperX, -0.28, this.carryPose * (1 - sp * 0.6))
      upperZ = lerp(upperZ, sgn * 0.1, this.carryPose)

      // In the air, arms come up for balance — not straight over the head,
      // which is what -2.2 rad was doing.
      upperX = lerp(upperX, -1.15, this.airborne)
      upperZ = lerp(upperZ, sgn * 0.42, this.airborne)
      foreX = lerp(foreX, -0.62, this.airborne)

      // Emote: a big wave with the right arm.
      if (this.emote > 0 && side === 'R') {
        const t = 1 - Math.max(0, this.emoteTimer)
        const w = Math.sin(this.idleTime * 16) * 0.5
        upperX = lerp(upperX, -2.5, this.emote)
        upperZ = lerp(upperZ, 0.5 + w * 0.4, this.emote)
        foreX = lerp(foreX, -0.4 + w * 0.5, this.emote)
      }

      arm.upper.rotation.set(upperX, 0, upperZ)
      arm.fore.rotation.x = foreX
      arm.hand.rotation.x = lerp(0, 0.2, this.carryPose)
    }

    // --- torso ---------------------------------------------------------
    const bob = moving ? Math.abs(Math.sin(p)) * lerp(0.015, 0.05, sp) : Math.sin(this.idleTime * 1.6) * 0.008
    hips.position.y = DIM.hipY + bob - this.landBounce * 0.1 + this.airborne * 0.02
    hips.rotation.y = moving ? Math.sin(p) * lerp(0.05, 0.13, sp) : Math.sin(this.idleTime * 0.9) * 0.03
    hips.rotation.z = moving ? Math.sin(p) * 0.03 : 0

    chest.rotation.x = lerp(
      Math.sin(this.idleTime * 1.7) * 0.012,
      -lerp(0.06, 0.3, sp),
      Math.min(1, sp * 4),
    ) + this.landBounce * 0.3
    chest.rotation.y = moving ? -Math.sin(p) * lerp(0.04, 0.11, sp) : 0
    chest.scale.setScalar(1 + Math.sin(this.idleTime * 1.9) * 0.008 * (1 - sp))

    // --- head ----------------------------------------------------------
    this.headYaw = damp(this.headYaw, this.targetHeadYaw, 7, dt)
    this.headPitch = damp(this.headPitch, this.targetHeadPitch, 7, dt)
    const nod = this.talk * Math.sin(this.idleTime * 5.2) * 0.06
    neck.rotation.set(
      this.headPitch + lerp(0, 0.14, sp) + nod,
      this.headYaw,
      0,
    )
    head.rotation.set(
      -this.headPitch * 0.3 + Math.sin(this.idleTime * 1.3) * 0.01,
      this.headYaw * 0.35,
      Math.sin(this.idleTime * 1.1) * 0.012,
    )

    body.rotation.x = 0
    body.position.y = 0
  }
}

function idleLeg(t, side) {
  const s = side === 'L' ? 0 : 1.7
  return Math.sin(t * 0.8 + s) * 0.015
}

function idleArm(t, side) {
  const s = side === 'L' ? 0 : 2.3
  return Math.sin(t * 0.85 + s) * 0.05 - 0.02
}
