import * as THREE from 'three'
import { SKY } from '../core/palette.js'
import { makeRng, rngRange } from '../core/rng.js'

/**
 * The sky is a painted dome, not a shader gradient — the clouds are brush
 * strokes drawn onto a canvas so they keep the flat, hand-inked edges the rest
 * of the game has. It turns very slowly, which is the only motion in the sky.
 *
 * The canvas holds a *mask* rather than finished colour: white where a cloud
 * is, black where it is not. The three colours (zenith, horizon, cloud) are
 * uniforms the day/night grade writes every frame. Tinting a finished blue sky
 * towards orange only ever produces grey — a sunset needs the hue replaced,
 * not multiplied, and this is the cheapest way to get that.
 */

function drawStroke(ctx, x, y, len, thick, angle, alpha) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = '#ffffff'
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.beginPath()
  const r = thick * 0.5
  // Tapered capsule: fat in the middle, pointed at both ends.
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

  // Clusters of strokes, biased away from the very top and bottom of the map
  // where equirect distortion would smear them.
  const clusters = 78
  for (let c = 0; c < clusters; c++) {
    const cx = rng() * width
    const cy = rngRange(rng, height * 0.16, height * 0.84)
    const scale = rngRange(rng, 0.5, 1.7)
    const tilt = rngRange(rng, -0.22, 0.22)
    const strokes = 3 + Math.floor(rng() * 6)
    for (let s = 0; s < strokes; s++) {
      const dx = rngRange(rng, -140, 140) * scale
      const dy = rngRange(rng, -26, 26) * scale
      const len = rngRange(rng, 110, 340) * scale
      const th = rngRange(rng, 12, 30) * scale
      const near = rng() > 0.45
      const a = near ? rngRange(rng, 0.65, 1.0) : rngRange(rng, 0.28, 0.55)
      drawStroke(ctx, cx + dx, cy + dy, len, th, tilt + rngRange(rng, -0.09, 0.09), a)
      // Wrap horizontally so the seam never shows.
      if (cx + dx < 400) drawStroke(ctx, cx + dx + width, cy + dy, len, th, tilt, a)
      if (cx + dx > width - 400) drawStroke(ctx, cx + dx - width, cy + dy, len, th, tilt, a)
    }
  }

  // Scattered flecks.
  for (let i = 0; i < 240; i++) {
    drawStroke(
      ctx,
      rng() * width,
      rngRange(rng, height * 0.12, height * 0.88),
      rngRange(rng, 24, 90),
      rngRange(rng, 5, 12),
      rngRange(rng, -0.3, 0.3),
      rngRange(rng, 0.22, 0.5),
    )
  }

  return canvas
}

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const FRAG = /* glsl */ `
precision mediump float;
uniform sampler2D tMask;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uCloud;
varying vec2 vUv;

void main() {
  // vUv.y runs 0 at the south pole to 1 at the north; 0.5 is the horizon ring.
  float h = abs(vUv.y - 0.5) * 2.0;
  vec3 base = mix(uHorizon, uZenith, smoothstep(0.0, 0.8, h));
  float m = texture2D(tMask, vUv).r;
  gl_FragColor = vec4(mix(base, uCloud, m), 1.0);
}
`

export class Sky {
  constructor(scene) {
    const canvas = paintCloudMask()
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.NoColorSpace
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.ClampToEdgeWrapping
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.anisotropy = 4
    tex.needsUpdate = true

    const geo = new THREE.SphereGeometry(680, 48, 32)
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

  /** Recolour the dome for the time of day. */
  setColors(zenith, horizon, cloud) {
    this.material.uniforms.uZenith.value.setHex(zenith)
    this.material.uniforms.uHorizon.value.setHex(horizon)
    this.material.uniforms.uCloud.value.setHex(cloud)
  }

  update(dt) {
    this.mesh.rotation.y += dt * 0.0055
  }
}
