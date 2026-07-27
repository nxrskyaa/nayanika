import * as THREE from 'three'

/**
 * One toon material factory for the whole game.
 *
 * The look is deliberately flat: a two-step gradient ramp means every surface
 * is either "lit" or "in shade", with no gradient in between. Combined with the
 * ink pass in stage.js that gives the printed-cel feel.
 */

let _ramp = null

export function gradientRamp() {
  if (_ramp) return _ramp
  // Two texels: shade, light. Nearest filtering makes the terminator a hard line.
  const data = new Uint8Array([110, 110, 110, 255, 255, 255, 255, 255])
  const tex = new THREE.DataTexture(data, 2, 1, THREE.RGBAFormat)
  tex.minFilter = THREE.NearestFilter
  tex.magFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  _ramp = tex
  return tex
}

const _cache = new Map()

/**
 * A cel-shaded material. Identical requests share one instance, which keeps
 * the draw-call count sane when a thousand props all want "cream".
 */
export function toon(color, opts = {}) {
  const {
    vertexColors = false,
    transparent = false,
    opacity = 1,
    side = THREE.FrontSide,
    emissive = 0x000000,
    emissiveIntensity = 1,
    depthWrite = true,
    fog = true,
    cache = true,
    polygonOffset = false,
    polygonOffsetFactor = 0,
    polygonOffsetUnits = 0,
  } = opts

  const key = cache
    ? `${color}|${vertexColors}|${transparent}|${opacity}|${side}|${emissive}|${emissiveIntensity}|${depthWrite}|${fog}|${polygonOffset}|${polygonOffsetFactor}|${polygonOffsetUnits}`
    : null
  if (key && _cache.has(key)) return _cache.get(key)

  const mat = new THREE.MeshToonMaterial({
    color,
    gradientMap: gradientRamp(),
    vertexColors,
    transparent,
    opacity,
    side,
    emissive,
    emissiveIntensity,
    depthWrite,
    fog,
    polygonOffset,
    polygonOffsetFactor,
    polygonOffsetUnits,
  })
  if (key) _cache.set(key, mat)
  return mat
}

/**
 * Material for anything painted onto the ground — tarmac, pavement, road
 * markings, plaza paving. The polygon offset keeps it in front of the terrain
 * without needing a lift big enough to see from the side.
 */
export function groundDecal(color, opts = {}) {
  return toon(color, { ...opts, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })
}

/** Unlit flat colour — used for things that should not pick up the sun at all. */
export function flat(color, opts = {}) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    depthWrite: opts.depthWrite ?? true,
    fog: opts.fog ?? true,
    vertexColors: opts.vertexColors ?? false,
  })
}

export function disposeMaterialCache() {
  for (const m of _cache.values()) m.dispose()
  _cache.clear()
}
