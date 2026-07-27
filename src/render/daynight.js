import * as THREE from 'three'
import { DAY } from '../core/config.js'

/**
 * Time of day.
 *
 * There is no night. The sun climbs from mid-morning to noon and back down to
 * late afternoon, and the cycle repeats — the light, the shadow direction and
 * the sky all move, so the island never looks frozen, but it never goes dark
 * either. A dark pass on a game this colourful just drains it.
 *
 * The sun is built in the player's own tangent frame, which is what guarantees
 * the "no night" property: on a planet this small a fixed world-space sun would
 * put whole districts on the far side in shadow no matter how it was graded.
 */

/** Grading stops, keyed by how high the sun sits. All of them are daylight. */
const STOPS = [
  {
    at: 0.3,
    name: 'sore',
    sun: 0xffcb8c,
    sunIntensity: 1.92,
    ambient: 0xdcdcea,
    ambientIntensity: 0.82,
    hemiSky: 0xf2e2c8,
    hemiGround: 0x96a070,
    hemiIntensity: 0.34,
    skyZenith: 0x4f9ed2,
    skyHorizon: 0xf8d6a8,
    skyCloud: 0xfff0d6,
    horizon: 0xeccca4,
    glow: 1,
  },
  {
    at: 0.58,
    name: 'siang',
    sun: 0xfff0cf,
    sunIntensity: 2.0,
    ambient: 0xc8e2ee,
    ambientIntensity: 0.83,
    hemiSky: 0xe0f2f2,
    hemiGround: 0x8a9b6a,
    hemiIntensity: 0.35,
    skyZenith: 0x46a9d6,
    skyHorizon: 0xc2e8e2,
    skyCloud: 0xfffdf4,
    horizon: 0xb8e4de,
    glow: 0.45,
  },
  {
    at: 0.93,
    name: 'terik',
    sun: 0xfff8e8,
    sunIntensity: 2.05,
    ambient: 0xbfe3ec,
    ambientIntensity: 0.84,
    hemiSky: 0xd8f2f0,
    hemiGround: 0x8a9b6a,
    hemiIntensity: 0.35,
    skyZenith: 0x3f9fd2,
    skyHorizon: 0xa8e2df,
    skyCloud: 0xfffdf4,
    horizon: 0xa8e2df,
    glow: 0.25,
  },
]

const _cA = new THREE.Color()
const _cB = new THREE.Color()
const _east = new THREE.Vector3()
const _north = new THREE.Vector3()
const _ref = new THREE.Vector3()

function lerpStops(elev) {
  if (elev <= STOPS[0].at) return { ...STOPS[0] }
  if (elev >= STOPS[STOPS.length - 1].at) return { ...STOPS[STOPS.length - 1] }
  let i = 0
  while (i < STOPS.length - 2 && elev > STOPS[i + 1].at) i++
  const a = STOPS[i]
  const b = STOPS[i + 1]
  const raw = (elev - a.at) / (b.at - a.at)
  const t = raw * raw * (3 - 2 * raw)
  const mix = (ka, kb) => ka + (kb - ka) * t
  const col = (ka, kb) => _cA.setHex(ka).lerp(_cB.setHex(kb), t).getHex()
  return {
    name: t < 0.5 ? a.name : b.name,
    sun: col(a.sun, b.sun),
    sunIntensity: mix(a.sunIntensity, b.sunIntensity),
    ambient: col(a.ambient, b.ambient),
    ambientIntensity: mix(a.ambientIntensity, b.ambientIntensity),
    hemiSky: col(a.hemiSky, b.hemiSky),
    hemiGround: col(a.hemiGround, b.hemiGround),
    hemiIntensity: mix(a.hemiIntensity, b.hemiIntensity),
    skyZenith: col(a.skyZenith, b.skyZenith),
    skyHorizon: col(a.skyHorizon, b.skyHorizon),
    skyCloud: col(a.skyCloud, b.skyCloud),
    horizon: col(a.horizon, b.horizon),
    glow: mix(a.glow, b.glow),
  }
}

export class DayNight {
  constructor(stage, sky) {
    this.stage = stage
    this.sky = sky
    this.dayLength = DAY.length
    this.paused = false

    /** 0 at the start of the day, 1 at the end of it. */
    this.time = 0.35
    this.sunDir = new THREE.Vector3(0, 1, 0)
    this.elevation = 0.9
    this.grade = lerpStops(0.9)

    const discGeo = new THREE.CircleGeometry(1, 28)
    this.discMat = new THREE.MeshBasicMaterial({
      color: 0xfff6dc,
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false,
    })
    this.disc = new THREE.Mesh(discGeo, this.discMat)
    this.disc.name = 'sundisc'
    this.disc.scale.setScalar(24)
    this.disc.frustumCulled = false
    this.disc.renderOrder = -985
    stage.scene.add(this.disc)

    // Soft halo around the sun, wider and fainter.
    this.haloMat = new THREE.MeshBasicMaterial({
      color: 0xffe9bc,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
    })
    this.halo = new THREE.Mesh(new THREE.CircleGeometry(1, 28), this.haloMat)
    this.halo.name = 'sunhalo'
    this.halo.scale.setScalar(95)
    this.halo.frustumCulled = false
    this.halo.renderOrder = -986
    stage.scene.add(this.halo)

    // Billboards have no meaningful normals; the edge filter would stipple them.
    stage.excludeFromInk(this.disc)
    stage.excludeFromInk(this.halo)
  }

  /** Kept for the boot sequence — the day simply starts mid-morning. */
  alignMorning() {
    this.time = 0.3
  }

  setTime(t) {
    this.time = ((t % 1) + 1) % 1
  }

  /** @param up  the player's local up, which the sun is positioned against. */
  update(dt, up, camera) {
    if (!this.paused && this.dayLength > 0) this.time = (this.time + dt / this.dayLength) % 1

    // One arc: lowest at either end of the day, highest in the middle.
    const arc = 1 - Math.abs(this.time - 0.5) * 2
    const smooth = arc * arc * (3 - 2 * arc)
    this.elevation = 0.28 + smooth * 0.66

    // Azimuth swings roughly east to west across the day so shadows rotate.
    const azim = (this.time - 0.5) * 2.5
    _ref.set(0, 1, 0)
    if (Math.abs(up.y) > 0.999) _ref.set(0, 0, 1)
    _east.crossVectors(_ref, up).normalize()
    _north.crossVectors(up, _east).normalize()
    const horiz = Math.sqrt(Math.max(0, 1 - this.elevation * this.elevation))
    this.sunDir
      .copy(up)
      .multiplyScalar(this.elevation)
      .addScaledVector(_east, Math.sin(azim) * horiz)
      .addScaledVector(_north, Math.cos(azim) * horiz)
      .normalize()

    const g = lerpStops(this.elevation)
    this.grade = g

    const st = this.stage
    st.sunDir.copy(this.sunDir)
    st.sun.color.setHex(g.sun)
    st.sun.intensity = g.sunIntensity
    st.ambient.color.setHex(g.ambient)
    st.ambient.intensity = g.ambientIntensity
    st.hemi.color.setHex(g.hemiSky)
    st.hemi.groundColor.setHex(g.hemiGround)
    st.hemi.intensity = g.hemiIntensity

    st.setHorizon(g.horizon)
    this.sky.setColors(g.skyZenith, g.skyHorizon, g.skyCloud)
    this.sky.setGlow(g.glow)
    if (camera) this.sky.follow(camera, up)
    this.sky.setSun(this.sunDir)

    this.disc.position.copy(this.sunDir).multiplyScalar(620)
    this.halo.position.copy(this.sunDir).multiplyScalar(624)
    if (camera) {
      this.disc.quaternion.copy(camera.quaternion)
      this.halo.quaternion.copy(camera.quaternion)
    }
    this.discMat.color.setHex(g.sun)
    this.haloMat.opacity = 0.1 + g.glow * 0.16
    this.halo.scale.setScalar(70 + g.glow * 60)
  }

  /** Local wall clock: the day runs 07:00 to 17:00 and starts over. */
  clockLabel() {
    const hours = 7 + this.time * 10
    const hh = Math.floor(hours)
    const mm = Math.floor((hours - hh) * 60)
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
  }
}
