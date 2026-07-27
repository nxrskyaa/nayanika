import * as THREE from 'three'
import { ACCENT, BUILD, GROUND, INK } from '../core/palette.js'
import { makeRng, rngRange } from '../core/rng.js'
import { gradientRamp } from '../render/materials.js'

/**
 * One canvas atlas for every flat graphic in the world — shop banners, road
 * signs, shutters, posters, vending machine fronts.
 *
 * The "writing" is abstract block glyphs. It reads as a busy signposted street
 * from a distance, which is the whole job, without pretending to be any real
 * language.
 */

const CELLS = 4
const CELL = 256
const SIZE = CELLS * CELL

export const SIGN = {
  bannerWarm: 0,
  bannerCool: 1,
  bannerMint: 2,
  columnSign: 3,
  warnTriangle: 4,
  arrowUp: 5,
  noEntry: 6,
  vending: 7,
  posters: 8,
  windowGrid: 9,
  shutter: 10,
  noodleBar: 11,
  priceBoard: 12,
  noticeBoard: 13,
  plaque: 14,
  crossing: 15,
}

function hex(c) {
  return '#' + c.toString(16).padStart(6, '0')
}

/** A block of pseudo-glyphs: short thick strokes arranged on a grid. */
function glyphRun(ctx, x, y, w, h, count, color, rng, weight = 0.17) {
  ctx.fillStyle = color
  const gw = w / count
  for (let i = 0; i < count; i++) {
    const gx = x + i * gw + gw * 0.12
    const gwi = gw * 0.76
    const strokes = 2 + Math.floor(rng() * 3)
    const t = h * weight
    for (let s = 0; s < strokes; s++) {
      const sy = y + (h * (s + 0.5)) / strokes - t * 0.5
      const inset = rng() * gwi * 0.28
      ctx.fillRect(gx + inset, sy, gwi - inset * (rng() > 0.5 ? 1.4 : 0.4), t)
    }
    if (rng() > 0.45) ctx.fillRect(gx + gwi * 0.42, y + h * 0.1, t * 0.85, h * 0.8)
  }
}

function textLines(ctx, x, y, w, lines, gap, color, rng) {
  ctx.fillStyle = color
  for (let i = 0; i < lines; i++) {
    const lw = w * rngRange(rng, 0.45, 1.0)
    ctx.fillRect(x, y + i * gap, lw, gap * 0.42)
  }
}

function cellRect(index) {
  const cx = index % CELLS
  const cy = Math.floor(index / CELLS)
  return { x: cx * CELL, y: cy * CELL }
}

function paint(ctx, index, draw) {
  const { x, y } = cellRect(index)
  ctx.save()
  ctx.translate(x, y)
  ctx.beginPath()
  ctx.rect(0, 0, CELL, CELL)
  ctx.clip()
  draw(ctx)
  ctx.restore()
}

let _atlas = null

export function buildAtlas() {
  if (_atlas) return _atlas

  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  const rng = makeRng(4242)

  ctx.fillStyle = hex(BUILD.bone)
  ctx.fillRect(0, 0, SIZE, SIZE)

  const banner = (bg, panel, glyph) => (c) => {
    c.fillStyle = hex(bg)
    c.fillRect(0, 0, CELL, CELL)
    c.fillStyle = hex(ACCENT.white)
    c.fillRect(CELL * 0.44, CELL * 0.14, CELL * 0.5, CELL * 0.72)
    glyphRun(c, CELL * 0.05, CELL * 0.2, CELL * 0.34, CELL * 0.6, 2, hex(glyph), rng, 0.14)
    textLines(c, CELL * 0.48, CELL * 0.2, CELL * 0.42, 5, CELL * 0.115, hex(INK), rng)
    c.fillStyle = hex(panel)
    c.fillRect(CELL * 0.48, CELL * 0.74, CELL * 0.3, CELL * 0.045)
    c.strokeStyle = hex(INK)
    c.lineWidth = 5
    c.strokeRect(2, 2, CELL - 4, CELL - 4)
  }

  paint(ctx, SIGN.bannerWarm, banner(ACCENT.orange, ACCENT.amber, ACCENT.amber))
  paint(ctx, SIGN.bannerCool, banner(ACCENT.blue, ACCENT.white, ACCENT.white))
  paint(ctx, SIGN.bannerMint, banner(ACCENT.teal, ACCENT.white, ACCENT.amber))

  paint(ctx, SIGN.columnSign, (c) => {
    c.fillStyle = hex(ACCENT.amber)
    c.fillRect(0, 0, CELL, CELL)
    c.strokeStyle = hex(INK)
    c.lineWidth = 6
    c.strokeRect(3, 3, CELL - 6, CELL - 6)
    for (let i = 0; i < 4; i++) {
      glyphRun(c, CELL * 0.22, CELL * (0.08 + i * 0.23), CELL * 0.56, CELL * 0.18, 1, hex(INK), rng, 0.2)
    }
  })

  paint(ctx, SIGN.warnTriangle, (c) => {
    c.fillStyle = hex(ACCENT.white)
    c.fillRect(0, 0, CELL, CELL)
    c.beginPath()
    c.moveTo(CELL * 0.5, CELL * 0.08)
    c.lineTo(CELL * 0.94, CELL * 0.86)
    c.lineTo(CELL * 0.06, CELL * 0.86)
    c.closePath()
    c.fillStyle = hex(ACCENT.deepRed)
    c.fill()
    c.beginPath()
    c.moveTo(CELL * 0.5, CELL * 0.21)
    c.lineTo(CELL * 0.83, CELL * 0.79)
    c.lineTo(CELL * 0.17, CELL * 0.79)
    c.closePath()
    c.fillStyle = hex(ACCENT.white)
    c.fill()
    glyphRun(c, CELL * 0.34, CELL * 0.45, CELL * 0.32, CELL * 0.26, 1, hex(ACCENT.deepRed), rng, 0.22)
  })

  paint(ctx, SIGN.arrowUp, (c) => {
    c.fillStyle = hex(ACCENT.white)
    c.fillRect(0, 0, CELL, CELL)
    c.beginPath()
    c.arc(CELL * 0.5, CELL * 0.5, CELL * 0.44, 0, Math.PI * 2)
    c.fillStyle = hex(ACCENT.blue)
    c.fill()
    c.fillStyle = hex(ACCENT.white)
    c.beginPath()
    c.moveTo(CELL * 0.5, CELL * 0.16)
    c.lineTo(CELL * 0.74, CELL * 0.46)
    c.lineTo(CELL * 0.6, CELL * 0.46)
    c.lineTo(CELL * 0.6, CELL * 0.84)
    c.lineTo(CELL * 0.4, CELL * 0.84)
    c.lineTo(CELL * 0.4, CELL * 0.46)
    c.lineTo(CELL * 0.26, CELL * 0.46)
    c.closePath()
    c.fill()
  })

  paint(ctx, SIGN.noEntry, (c) => {
    c.fillStyle = hex(ACCENT.white)
    c.fillRect(0, 0, CELL, CELL)
    c.beginPath()
    c.arc(CELL * 0.5, CELL * 0.5, CELL * 0.44, 0, Math.PI * 2)
    c.fillStyle = hex(ACCENT.red)
    c.fill()
    c.fillStyle = hex(ACCENT.white)
    c.fillRect(CELL * 0.18, CELL * 0.42, CELL * 0.64, CELL * 0.16)
  })

  paint(ctx, SIGN.vending, (c) => {
    c.fillStyle = hex(ACCENT.blue)
    c.fillRect(0, 0, CELL, CELL)
    c.fillStyle = hex(BUILD.window)
    c.fillRect(CELL * 0.06, CELL * 0.05, CELL * 0.88, CELL * 0.62)
    const cols = 5
    const rows = 3
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < cols; i++) {
        const bx = CELL * 0.09 + i * CELL * 0.172
        const by = CELL * 0.09 + r * CELL * 0.195
        c.fillStyle = hex([ACCENT.white, ACCENT.amber, ACCENT.green, ACCENT.red, ACCENT.teal][Math.floor(rng() * 5)])
        c.fillRect(bx, by, CELL * 0.12, CELL * 0.135)
        c.fillStyle = 'rgba(0,0,0,0.25)'
        c.fillRect(bx, by + CELL * 0.09, CELL * 0.12, CELL * 0.045)
      }
      c.fillStyle = hex(ACCENT.white)
      c.fillRect(CELL * 0.07, CELL * 0.225 + r * CELL * 0.195, CELL * 0.86, CELL * 0.012)
    }
    c.fillStyle = hex(BUILD.frame)
    c.fillRect(CELL * 0.06, CELL * 0.7, CELL * 0.6, CELL * 0.1)
    c.fillStyle = hex(ACCENT.red)
    c.fillRect(CELL * 0.7, CELL * 0.7, CELL * 0.24, CELL * 0.1)
    c.fillStyle = hex(BUILD.metalDark)
    c.fillRect(CELL * 0.1, CELL * 0.86, CELL * 0.5, CELL * 0.09)
  })

  paint(ctx, SIGN.posters, (c) => {
    c.fillStyle = hex(BUILD.concrete)
    c.fillRect(0, 0, CELL, CELL)
    for (let i = 0; i < 9; i++) {
      const px = rng() * CELL * 0.72
      const py = rng() * CELL * 0.72
      const pw = rngRange(rng, CELL * 0.16, CELL * 0.3)
      const ph = rngRange(rng, CELL * 0.18, CELL * 0.32)
      c.fillStyle = hex([ACCENT.white, ACCENT.amber, ACCENT.pink, ACCENT.blue, BUILD.bone][Math.floor(rng() * 5)])
      c.fillRect(px, py, pw, ph)
      c.strokeStyle = 'rgba(20,22,24,0.55)'
      c.lineWidth = 2
      c.strokeRect(px, py, pw, ph)
      textLines(c, px + pw * 0.1, py + ph * 0.15, pw * 0.8, 3, ph * 0.22, 'rgba(20,22,24,0.7)', rng)
    }
  })

  paint(ctx, SIGN.windowGrid, (c) => {
    c.fillStyle = hex(BUILD.frame)
    c.fillRect(0, 0, CELL, CELL)
    c.fillStyle = hex(BUILD.window)
    c.fillRect(CELL * 0.05, CELL * 0.05, CELL * 0.9, CELL * 0.9)
    c.fillStyle = hex(BUILD.frame)
    c.fillRect(CELL * 0.47, CELL * 0.05, CELL * 0.06, CELL * 0.9)
    c.fillRect(CELL * 0.05, CELL * 0.47, CELL * 0.9, CELL * 0.06)
    c.fillStyle = 'rgba(255,255,255,0.16)'
    c.beginPath()
    c.moveTo(CELL * 0.08, CELL * 0.9)
    c.lineTo(CELL * 0.44, CELL * 0.08)
    c.lineTo(CELL * 0.56, CELL * 0.08)
    c.lineTo(CELL * 0.2, CELL * 0.9)
    c.closePath()
    c.fill()
  })

  paint(ctx, SIGN.shutter, (c) => {
    c.fillStyle = hex(BUILD.metal)
    c.fillRect(0, 0, CELL, CELL)
    c.fillStyle = 'rgba(30,34,36,0.22)'
    for (let i = 0; i < 16; i++) c.fillRect(0, i * (CELL / 16) + CELL / 32, CELL, CELL / 42)
    c.fillStyle = hex(BUILD.metalDark)
    c.fillRect(0, CELL * 0.93, CELL, CELL * 0.07)
  })

  paint(ctx, SIGN.noodleBar, (c) => {
    c.fillStyle = hex(BUILD.bone)
    c.fillRect(0, 0, CELL, CELL)
    c.fillStyle = hex(ACCENT.deepRed)
    c.fillRect(0, CELL * 0.18, CELL, CELL * 0.5)
    c.fillStyle = hex(ACCENT.amber)
    glyphRun(c, CELL * 0.08, CELL * 0.26, CELL * 0.84, CELL * 0.34, 4, hex(ACCENT.amber), rng, 0.16)
    c.fillStyle = hex(INK)
    textLines(c, CELL * 0.12, CELL * 0.74, CELL * 0.7, 2, CELL * 0.1, hex(INK), rng)
  })

  paint(ctx, SIGN.priceBoard, (c) => {
    c.fillStyle = hex(ACCENT.white)
    c.fillRect(0, 0, CELL, CELL)
    c.strokeStyle = hex(INK)
    c.lineWidth = 5
    c.strokeRect(3, 3, CELL - 6, CELL - 6)
    for (let i = 0; i < 6; i++) {
      textLines(c, CELL * 0.1, CELL * (0.1 + i * 0.14), CELL * 0.5, 1, CELL * 0.1, hex(INK), rng)
      c.fillStyle = hex(ACCENT.red)
      c.fillRect(CELL * 0.68, CELL * (0.1 + i * 0.14), CELL * 0.22, CELL * 0.045)
    }
  })

  paint(ctx, SIGN.noticeBoard, (c) => {
    c.fillStyle = hex(BUILD.wood)
    c.fillRect(0, 0, CELL, CELL)
    c.fillStyle = 'rgba(80,60,35,0.25)'
    for (let i = 0; i < 7; i++) c.fillRect(0, i * (CELL / 7), CELL, 3)
    for (let i = 0; i < 5; i++) {
      const px = rngRange(rng, CELL * 0.05, CELL * 0.6)
      const py = rngRange(rng, CELL * 0.05, CELL * 0.6)
      c.fillStyle = hex(ACCENT.white)
      c.fillRect(px, py, CELL * 0.3, CELL * 0.3)
      textLines(c, px + 8, py + 10, CELL * 0.22, 4, CELL * 0.06, 'rgba(20,22,24,0.6)', rng)
    }
  })

  paint(ctx, SIGN.plaque, (c) => {
    c.fillStyle = hex(BUILD.woodDark)
    c.fillRect(0, 0, CELL, CELL)
    c.strokeStyle = hex(ACCENT.amber)
    c.lineWidth = 8
    c.strokeRect(10, 10, CELL - 20, CELL - 20)
    glyphRun(c, CELL * 0.2, CELL * 0.24, CELL * 0.6, CELL * 0.52, 1, hex(ACCENT.amber), rng, 0.16)
  })

  paint(ctx, SIGN.crossing, (c) => {
    c.fillStyle = hex(GROUND.road)
    c.fillRect(0, 0, CELL, CELL)
    c.fillStyle = hex(GROUND.line)
    for (let i = 0; i < 6; i++) c.fillRect(CELL * (0.04 + i * 0.16), 0, CELL * 0.1, CELL)
  })

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.anisotropy = 8
  tex.needsUpdate = true

  _atlas = { texture: tex, canvas }
  return _atlas
}

const INSET = 1.5 / SIZE

/** UV rectangle for an atlas cell, inset slightly to avoid bleeding. */
export function cellUv(index) {
  const cx = index % CELLS
  const cy = Math.floor(index / CELLS)
  const u0 = cx / CELLS + INSET
  const u1 = (cx + 1) / CELLS - INSET
  // Canvas y runs down, texture v runs up.
  const v1 = 1 - cy / CELLS - INSET
  const v0 = 1 - (cy + 1) / CELLS + INSET
  return { u0, u1, v0, v1 }
}

let _signMaterial = null

export function signMaterial(opts = {}) {
  if (_signMaterial && !opts.fresh) return _signMaterial
  const { texture } = buildAtlas()
  const mat = new THREE.MeshToonMaterial({
    map: texture,
    gradientMap: gradientRamp(),
    side: opts.side ?? THREE.FrontSide,
    transparent: false,
  })
  if (!opts.fresh) _signMaterial = mat
  return mat
}

/** A quad showing one atlas cell, sized in world units. */
export function signPlane(index, w, h, opts = {}) {
  const geo = new THREE.PlaneGeometry(w, h)
  const { u0, u1, v0, v1 } = cellUv(index)
  const uv = geo.attributes.uv
  // PlaneGeometry uv order: (0,1) (1,1) (0,0) (1,0)
  uv.setXY(0, u0, v1)
  uv.setXY(1, u1, v1)
  uv.setXY(2, u0, v0)
  uv.setXY(3, u1, v0)
  uv.needsUpdate = true
  const mesh = new THREE.Mesh(geo, signMaterial(opts))
  return mesh
}
