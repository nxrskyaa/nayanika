import * as THREE from 'three'
import { SKY } from '../core/palette.js'
import { makeRng, rngRange } from '../core/rng.js'

/**
 * The sky dome.
 *
 * The clouds are brush strokes painted onto a canvas so they keep the flat,
 * hand-inked edges the rest of the game has, and the canvas holds a *mask*
 * rather than finished colour — the three colours (zenith, horizon, cloud) are
 * uniforms the time-of-day grade writes every frame. Tinting a finished blue
 * sky towards orange only ever produces grey; a warm sky needs the hue
 * replaced, not multiplied.
 *
 * The dome rides on the camera and tips to match the player's up. Left at the
 * planet's centre it was 155 units off from the viewer, so the painted horizon
 * never lined up with the real one and the gradient sat visibly crooked.
 */

const _localSun = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _upY = new THREE.Vector3(0, 1, 0)

function drawStroke(ctx, x, y, len, thick, angle, alpha) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = '#ffffff'
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.beginPath()
  const r = thick * 0.5
  ctx.moveTo(-len * 0.5, 0)
  ctx.quadraticCurveTo(-len * 0.22, -r, 0, -r * 0.92)
  ctx.quadraticCurveTo(len * 0.26, -r * 0.8, len * 0.5, 0)
  ctx.quadraticCurveTo(len * 0.24, r * 0.72, 0, r * 0.88)
  ctx.quadraticCurveTo(-len * 0.24, r, -len * 0.5, 0)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function paintCloudMask(width = 2048, height = 1024, seed = 7) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  const rng = makeRng(seed)

  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, width, height)

  // Fat tropical cumulus, stacked into piles rather than scattered evenly.
  // Kept sparse on purpose: the dome is a sphere, so a density that looks
  // reasonable on the flat canvas ends up covering the whole sky in white.
  for (let c = 0; c < 26; c++) {
    const cx = rng() * width
    const cy = rngRange(rng, height * 0.2, height * 0.8)
    const scale = rngRange(rng, 0.6, 1.4)
    const tilt = rngRange(rng, -0.16, 0.16)
    const strokes = 3 + Math.floor(rng() * 5)
    for (let s = 0; s < strokes; s++) {
      const dx = rngRange(rng, -90, 90) * scale
      // Piled vertically as well as spread sideways, so they read as volumes.
      const dy = rngRange(rng, -44, 24) * scale * (1 - Math.abs(dx) / (110 * scale))
      const len = rngRange(rng, 80, 210) * scale
      const th = rngRange(rng, 12, 28) * scale
      const a = rng() > 0.42 ? rngRange(rng, 0.55, 0.85) : rngRange(rng, 0.22, 0.44)
      drawStroke(ctx, cx + dx, cy + dy, len, th, tilt + rngRange(rng, -0.07, 0.07), a)
      if (cx + dx < 260) drawStroke(ctx, cx + dx + width, cy + dy, len, th, tilt, a)
      if (cx + dx > width - 260) drawStroke(ctx, cx + dx - width, cy + dy, len, th, tilt, a)
    }
  }

  // Thin high wisps.
  for (let i = 0; i < 90; i++) {
    drawStroke(
      ctx,
      rng() * width,
      rngRange(rng, height * 0.12, height * 0.88),
      rngRange(rng, 45, 140),
      rngRange(rng, 3, 8),
      rngRange(rng, -0.2, 0.2),
      rngRange(rng, 0.12, 0.3),
    )
  }

  return canvas
}

const VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vDir;
void main() {
  vUv = uv;
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const FRAG = /* glsl */ `
precision mediump float;
uniform sampler2D tMask;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uCloud;
uniform vec3 uSunDir;
uniform float uGlow;
uniform vec2 uScrollA;
uniform vec2 uScrollB;
varying vec2 vUv;
varying vec3 vDir;

void main() {
  // vUv.y is 0 at the pole underfoot and 1 overhead; 0.5 is the horizon ring.
  float h = abs(vUv.y - 0.5) * 2.0;
  vec3 base = mix(uHorizon, uZenith, smoothstep(0.0, 0.82, h));

  // Warm bloom around the sun plus a wide lift across the sky near it.
  float sd = max(0.0, dot(vDir, uSunDir));
  base = mix(base, uCloud, pow(sd, 18.0) * 0.55 * uGlow);
  base += uCloud * pow(sd, 5.0) * 0.03 * uGlow;

  // Two cloud layers drifting at different speeds, so the sky has depth. The
  // second only fills in where the first is thin, or the two together wash the
  // whole dome out to white.
  float m1 = texture2D(tMask, vUv + uScrollA).r;
  float m2 = texture2D(tMask, vUv * vec2(1.9, 1.5) + uScrollB).r;
  vec3 col = mix(base, uCloud, m1);
  col = mix(col, uCloud, m2 * 0.22 * (1.0 - m1));

  // Clouds catch the sun on the side facing it.
  col += uCloud * m1 * pow(sd, 6.0) * 0.18 * uGlow;

  gl_FragColor = vec4(col, 1.0);
}
`

export class Sky {
  constructor(scene) {
    const canvas = paintCloudMask()
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.NoColorSpace
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.anisotropy = 4
    tex.needsUpdate = true

    const geo = new THREE.SphereGeometry(680, 56, 36)
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        tMask: { value: tex },
        uZenith: { value: new THREE.Color(SKY.zenith) },
        uHorizon: { value: new THREE.Color(SKY.horizon) },
        uCloud: { value: new THREE.Color(SKY.cloudNear) },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uGlow: { value: 0.5 },
        uScrollA: { value: new THREE.Vector2(0, 0) },
        uScrollB: { value: new THREE.Vector2(0, 0) },
      },
    })

    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.renderOrder = -1000
    this.mesh.frustumCulled = false
    this.mesh.name = 'sky'
    scene.add(this.mesh)

    this.texture = tex
    this.material = mat
  }

  setColors(zenith, horizon, cloud) {
    this.material.uniforms.uZenith.value.setHex(zenith)
    this.material.uniforms.uHorizon.value.setHex(horizon)
    this.material.uniforms.uCloud.value.setHex(cloud)
  }

  setGlow(v) {
    this.material.uniforms.uGlow.value = v
  }

  /** World-space sun direction; stored in the dome's own frame. */
  setSun(dir) {
    _q.copy(this.mesh.quaternion).invert()
    _localSun.copy(dir).applyQuaternion(_q).normalize()
    this.material.uniforms.uSunDir.value.copy(_localSun)
  }

  /** Centre the dome on the viewer and tip it to the local horizon. */
  follow(camera, up) {
    this.mesh.position.copy(camera.position)
    this.mesh.quaternion.setFromUnitVectors(_upY, up)
  }

  update(dt) {
    const a = this.material.uniforms.uScrollA.value
    const b = this.material.uniforms.uScrollB.value
    a.x = (a.x + dt * 0.0016) % 1
    b.x = (b.x + dt * 0.0037) % 1
  }
}
