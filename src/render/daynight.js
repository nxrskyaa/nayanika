import * as THREE from 'three'
import { DAY } from '../core/config.js'
import { signMaterial } from '../world/atlas.js'

/**
 * The day/night cycle.
 *
 * The sun is a direction that sweeps once around a fixed axis. What matters
 * for grading is not that angle on its own but how high the sun sits *where
 * the player is standing* — `sunDir · up`. On a planet this small that means
 * walking far enough east genuinely moves you into a different time of day,
 * which is a nicer property than a global clock and costs nothing extra.
 *
 * Everything below is keyed off that one elevation number: light colours and
 * intensities, the tint over the sky dome, the clear colour, the stars, and
 * the glow on the shopfront signs.
 */

/** Grading stops, darkest first. `at` is sun elevation, -1 (below) to 1 (zenith). */
const STOPS = [
  {
    at: -0.30,
    name: 'night',
    sun: 0x9fbce8,
    sunIntensity: 0.40,
    ambient: 0x38477a,
    ambientIntensity: 0.62,
    hemiSky: 0x4a5b93,
    hemiGround: 0x2b3350,
    hemiIntensity: 0.3,
    skyZenith: 0x101830, skyHorizon: 0x24304f, skyCloud: 0x2c3859,
    horizon: 0x24304f,
    stars: 1,
    signGlow: 0.55,
  },
  {
    at: -0.06,
    name: 'twilight',
    sun: 0xd08a86,
    sunIntensity: 0.72,
    ambient: 0x7a6f9c,
    ambientIntensity: 0.7,
    hemiSky: 0x9a8fb8,
    hemiGround: 0x53506a,
    hemiIntensity: 0.32,
    skyZenith: 0x33406f, skyHorizon: 0xa8626a, skyCloud: 0x8a6382,
    horizon: 0x8a6f86,
    stars: 0.45,
    signGlow: 0.4,
  },
  {
    at: 0.07,
    name: 'goldenhour',
    sun: 0xffa863,
    sunIntensity: 1.55,
    ambient: 0xbfa8bc,
    ambientIntensity: 0.78,
    hemiSky: 0xe8c4ac,
    hemiGround: 0x8a7a62,
    hemiIntensity: 0.32,
    skyZenith: 0x4e86c4, skyHorizon: 0xf2b57a, skyCloud: 0xffd9a8,
    horizon: 0xdca07e,
    stars: 0.08,
    signGlow: 0.16,
  },
  {
    at: 0.30,
    name: 'morning',
    sun: 0xffe2b4,
    sunIntensity: 1.95,
    ambient: 0xcfdcea,
    ambientIntensity: 0.8,
    hemiSky: 0xe0eef0,
    hemiGround: 0x8a9b6a,
    hemiIntensity: 0.33,
    skyZenith: 0x64b4dc, skyHorizon: 0xdcecdf, skyCloud: 0xfff8ec,
    horizon: 0xc8dcd8,
    stars: 0,
    signGlow: 0.04,
  },
  {
    at: 0.62,
    name: 'day',
    sun: 0xfff2d8,
    sunIntensity: 2.05,
    ambient: 0xbfe3ec,
    ambientIntensity: 0.83,
    hemiSky: 0xd8f2f0,
    hemiGround: 0x8a9b6a,
    hemiIntensity: 0.35,
    skyZenith: 0x46a9d6, skyHorizon: 0xa8e2df, skyCloud: 0xfffdf4,
    horizon: 0xa8e2df,
    stars: 0,
    signGlow: 0,
  },
]

const _cA = new THREE.Color()
const _cB = new THREE.Color()

function lerpStops(elev) {
  if (elev <= STOPS[0].at) return { ...STOPS[0], t: 0 }
  if (elev >= STOPS[STOPS.length - 1].at) return { ...STOPS[STOPS.length - 1], t: 1 }
  let i = 0
  while (i < STOPS.length - 2 && elev > STOPS[i + 1].at) i++
  const a = STOPS[i]
  const b = STOPS[i + 1]
  const raw = (elev - a.at) / (b.at - a.at)
  const t = raw * raw * (3 - 2 * raw)
  const mix = (ka, kb) => ka + (kb - ka) * t
  return {
    name: t < 0.5 ? a.name : b.name,
    sun: _cA.setHex(a.sun).lerp(_cB.setHex(b.sun), t).getHex(),
    sunIntensity: mix(a.sunIntensity, b.sunIntensity),
    ambient: _cA.setHex(a.ambient).lerp(_cB.setHex(b.ambient), t).getHex(),
    ambientIntensity: mix(a.ambientIntensity, b.ambientIntensity),
    hemiSky: _cA.setHex(a.hemiSky).lerp(_cB.setHex(b.hemiSky), t).getHex(),
    hemiGround: _cA.setHex(a.hemiGround).lerp(_cB.setHex(b.hemiGround), t).getHex(),
    hemiIntensity: mix(a.hemiIntensity, b.hemiIntensity),
    skyZenith: _cA.setHex(a.skyZenith).lerp(_cB.setHex(b.skyZenith), t).getHex(),
    skyHorizon: _cA.setHex(a.skyHorizon).lerp(_cB.setHex(b.skyHorizon), t).getHex(),
    skyCloud: _cA.setHex(a.skyCloud).lerp(_cB.setHex(b.skyCloud), t).getHex(),
    horizon: _cA.setHex(a.horizon).lerp(_cB.setHex(b.horizon), t).getHex(),
    stars: mix(a.stars, b.stars),
    signGlow: mix(a.signGlow, b.signGlow),
  }
}

/** A dome of points just inside the sky, faded in after sunset. */
function buildStars(radius, count, seed = 5) {
  let s = seed >>> 0
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
  const pos = new Float32Array(count * 3)
  const size = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const z = rand() * 2 - 1
    const a = rand() * Math.PI * 2
    const r = Math.sqrt(Math.max(0, 1 - z * z))
    pos[i * 3] = r * Math.cos(a) * radius
    pos[i * 3 + 1] = z * radius
    pos[i * 3 + 2] = r * Math.sin(a) * radius
    size[i] = 1 + rand() * rand() * 5
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: { uOpacity: { value: 0 }, uScale: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aSize;
      varying float vS;
      uniform float uScale;
      void main() {
        vS = aSize;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uScale;
      }
    `,
    fragmentShader: /* glsl */ `
      precision mediump float;
      uniform float uOpacity;
      varying float vS;
      void main() {
        vec2 d = gl_PointCoord - vec2(0.5);
        float m = 1.0 - smoothstep(0.16, 0.5, length(d));
        if (m <= 0.001) discard;
        float tw = clamp(vS / 4.0, 0.35, 1.0);
        gl_FragColor = vec4(vec3(0.92, 0.95, 1.0), m * uOpacity * tw);
      }
    `,
  })

  const points = new THREE.Points(geo, mat)
  points.name = 'stars'
  points.frustumCulled = false
  points.renderOrder = -990
  return points
}

export class DayNight {
  /**
   * @param stage  the Stage, for its lights, scene and renderer
   * @param sky    the Sky, whose dome gets tinted
   */
  constructor(stage, sky) {
    this.stage = stage
    this.sky = sky
    this.dayLength = DAY.length
    this.tilt = DAY.tilt
    this.paused = false

    /** 0..1 around the planet. 0.25 is local noon on the +X meridian. */
    this.time = 0
    this.sunDir = new THREE.Vector3(1, 0, 0)
    this.elevation = 1
    this.grade = lerpStops(1)

    this.stars = buildStars(640, 900)
    stage.scene.add(this.stars)

    // The sun/moon disc, parked on the sky dome along the light direction.
    const discGeo = new THREE.CircleGeometry(1, 24)
    this.discMat = new THREE.MeshBasicMaterial({
      color: 0xfff6dc,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false,
    })
    this.disc = new THREE.Mesh(discGeo, this.discMat)
    this.disc.name = 'sundisc'
    this.disc.scale.setScalar(26)
    this.disc.frustumCulled = false
    this.disc.renderOrder = -985
    stage.scene.add(this.disc)

    // Neither belongs in the ink pass: the edge filter would stipple them.
    stage.excludeFromInk(this.stars)
    stage.excludeFromInk(this.disc)
  }

  /** Put the sun where it is mid-morning above `up`. */
  alignMorning(up) {
    const theta = Math.atan2(up.z, up.x)
    this.time = ((theta / (Math.PI * 2)) % 1 + 1 - 0.11) % 1
  }

  setTime(t) {
    this.time = ((t % 1) + 1) % 1
  }

  /** @param up  the player's local up, which decides the local time of day. */
  update(dt, up, camera) {
    if (!this.paused && this.dayLength > 0) this.time = (this.time + dt / this.dayLength) % 1

    const theta = this.time * Math.PI * 2
    this.sunDir.set(Math.cos(theta), this.tilt, Math.sin(theta)).normalize()
    this.elevation = THREE.MathUtils.clamp(this.sunDir.dot(up), -1, 1)

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

    this.stars.material.uniforms.uOpacity.value = g.stars
    this.stars.material.uniforms.uScale.value = st.pixelRatio || 1
    this.stars.visible = g.stars > 0.01

    // Disc rides the sky dome; below the horizon it is simply hidden.
    this.disc.position.copy(this.sunDir).multiplyScalar(620)
    if (camera) this.disc.quaternion.copy(camera.quaternion)
    const nightSide = this.elevation < -0.12
    this.discMat.color.setHex(nightSide ? 0xdfe6f6 : g.sun)
    this.disc.scale.setScalar(nightSide ? 17 : 26)
    this.disc.visible = this.sunDir.dot(up) > -0.22

    // Shopfronts and road signs pick up a warm glow once the light goes.
    const sm = signMaterial()
    if (sm.emissive) {
      sm.emissive.setHex(0xffcf8a)
      sm.emissiveIntensity = g.signGlow
    }
  }

  /**
   * Local wall clock. `time === meridian` is the moment the sun stands highest
   * over this spot, so that instant is noon and everything else follows from
   * how far past it the planet has turned. Reading the angle off the sun's
   * azimuth instead goes haywire near the zenith, where azimuth is undefined.
   */
  clockLabel(up) {
    const meridian = Math.atan2(up.z, up.x) / (Math.PI * 2)
    const past = (((this.time - meridian) % 1) + 1) % 1
    const hours = (past * 24 + 12) % 24
    const hh = Math.floor(hours)
    const mm = Math.floor((hours - hh) * 60)
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
  }
}
