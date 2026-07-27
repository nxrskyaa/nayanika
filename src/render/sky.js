import * as THREE from 'three'
import { SKY } from '../core/palette.js'
import { makeRng, rngRange } from '../core/rng.js'

/**
 * The sky is a painted dome, not a shader gradient — the clouds are brush
 * strokes drawn onto a canvas so they keep the flat, hand-inked edges the rest
 * of the game has. It turns very slowly, which is the only motion in the sky.
 */

function hex(c) {
  return '#' + c.toString(16).padStart(6, '0')
}

function drawStroke(ctx, x, y, len, thick, angle, color, alpha) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
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

function paintSky(width = 2048, height = 1024, seed = 7) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  const rng = makeRng(seed)

  const grad = ctx.createLinearGradient(0, 0, 0, height)
  grad.addColorStop(0.0, hex(SKY.zenith))
  grad.addColorStop(0.42, hex(SKY.horizon))
  grad.addColorStop(1.0, hex(SKY.zenith))
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)

  const nearCol = hex(SKY.cloudNear)
  const farCol = hex(SKY.cloudFar)

  // Clusters of strokes, biased away from the very top and bottom of the map
  // where equirect distortion would smear them.
  const clusters = 78
  for (let c = 0; c < clusters; c++) {
    const cx = rng() * width
    const cy = rngRange(rng, height * 0.1, height * 0.9)
    const scale = rngRange(rng, 0.5, 1.7)
    const tilt = rngRange(rng, -0.22, 0.22)
    const strokes = 3 + Math.floor(rng() * 6)
    for (let s = 0; s < strokes; s++) {
      const dx = rngRange(rng, -140, 140) * scale
      const dy = rngRange(rng, -26, 26) * scale
      const len = rngRange(rng, 110, 340) * scale
      const th = rngRange(rng, 12, 30) * scale
      const useNear = rng() > 0.45
      drawStroke(
        ctx,
        cx + dx,
        cy + dy,
        len,
        th,
        tilt + rngRange(rng, -0.09, 0.09),
        useNear ? nearCol : farCol,
        useNear ? rngRange(rng, 0.5, 0.85) : rngRange(rng, 0.25, 0.5),
      )
      // Wrap horizontally so the seam never shows.
      if (cx + dx < 400) drawStroke(ctx, cx + dx + width, cy + dy, len, th, tilt, useNear ? nearCol : farCol, useNear ? 0.7 : 0.4)
      if (cx + dx > width - 400) drawStroke(ctx, cx + dx - width, cy + dy, len, th, tilt, useNear ? nearCol : farCol, useNear ? 0.7 : 0.4)
    }
  }

  // Scattered flecks.
  for (let i = 0; i < 240; i++) {
    drawStroke(
      ctx,
      rng() * width,
      rngRange(rng, height * 0.08, height * 0.92),
      rngRange(rng, 24, 90),
      rngRange(rng, 5, 12),
      rngRange(rng, -0.3, 0.3),
      rng() > 0.5 ? nearCol : farCol,
      rngRange(rng, 0.2, 0.5),
    )
  }

  return canvas
}

export class Sky {
  constructor(scene) {
    const canvas = paintSky()
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.ClampToEdgeWrapping
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.anisotropy = 4
    tex.needsUpdate = true

    const geo = new THREE.SphereGeometry(680, 48, 32)
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    })

    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.renderOrder = -1000
    this.mesh.frustumCulled = false
    this.mesh.name = 'sky'
    scene.add(this.mesh)

    this.texture = tex
  }

  update(dt) {
    this.mesh.rotation.y += dt * 0.0055
  }
}
