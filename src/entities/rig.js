import * as THREE from 'three'
import { CHAR, ACCENT, BUILD, INK, NATURE } from '../core/palette.js'
import { toon } from '../render/materials.js'

/**
 * A procedural humanoid.
 *
 * Bones are plain Object3Ds; the meshes hanging off them are boxes and
 * squashed spheres. Everything is built in code so a whole town of NPCs costs
 * nothing to load, and re-colouring for the wardrobe is a material swap.
 *
 * Proportions are deliberately a little chibi: big head, short limbs.
 */

/**
 * Skeleton measurements, in metres from the soles.
 *
 * The head is deliberately large — a shade over a quarter of the total height,
 * about 1:3.6. That is what makes a small figure legible at the distance this
 * camera sits at: at realistic proportions the head is a few pixels across and
 * the character reads as a walking stick.
 */
const DIM = {
  hipY: 0.68,
  chestY: 0.3, // relative to hips
  neckY: 0.3, // relative to chest
  headY: 0.22, // relative to neck
  shoulderY: 0.2,
  shoulderX: 0.165,
  upperArm: 0.26,
  foreArm: 0.24,
  thigh: 0.32,
  shin: 0.3,
  headR: 0.235,
}

function mesh(geo, color, opts) {
  const m = new THREE.Mesh(geo, toon(color, { cache: false, ...opts }))
  m.castShadow = true
  m.receiveShadow = true
  return m
}

/* ------------------------------------------------------------------ */
/* baking                                                              */
/* ------------------------------------------------------------------ */

/** One material for every character in the game; colour rides on the verts. */
let _bakedMaterial = null
function bakedMaterial() {
  if (!_bakedMaterial) _bakedMaterial = toon(0xffffff, { vertexColors: true })
  return _bakedMaterial
}

/** Tag a group as an animated joint so baking stops at its boundary. */
function bone(group) {
  group.userData.isBone = true
  return group
}

const _bakeColor = new THREE.Color()

/**
 * Walk the rigid subtree under a joint, stopping at nested joints, and record
 * each mesh with its matrix relative to that joint.
 */
function collectStatic(node, matrix, out) {
  for (const child of node.children) {
    if (child.userData.isBone || child.userData.noBake) continue
    child.updateMatrix()
    const m = matrix.clone().multiply(child.matrix)
    if (child.isMesh) out.push({ mesh: child, matrix: m })
    else collectStatic(child, m, out)
  }
}

/**
 * Collapse everything rigidly attached to a bone into a single vertex-coloured
 * mesh. A character drops from ~40 draw calls to about a dozen, and every
 * character in the world shares one material.
 */
function bakeBone(bone) {
  bone.updateMatrix()
  const found = []
  collectStatic(bone, new THREE.Matrix4(), found)
  if (found.length === 0) return
  if (found.length === 1) {
    // Still worth converting so it shares the one character material.
    const only = found[0].mesh
    applyVertexColor(only.geometry, only.material.color)
    only.material.dispose?.()
    only.material = bakedMaterial()
    return
  }

  let total = 0
  const parts = []
  for (const { mesh: m, matrix } of found) {
    let geo = m.geometry.clone()
    geo.applyMatrix4(matrix)
    if (geo.index) geo = geo.toNonIndexed()
    for (const name of Object.keys(geo.attributes)) {
      if (name !== 'position' && name !== 'normal') geo.deleteAttribute(name)
    }
    total += geo.attributes.position.count
    parts.push({ geo, color: m.material.color })
  }

  const pos = new Float32Array(total * 3)
  const nor = new Float32Array(total * 3)
  const col = new Float32Array(total * 3)
  let o = 0
  for (const { geo, color } of parts) {
    const count = geo.attributes.position.count
    pos.set(geo.attributes.position.array, o * 3)
    nor.set(geo.attributes.normal.array, o * 3)
    _bakeColor.copy(color)
    for (let i = 0; i < count; i++) {
      col[(o + i) * 3] = _bakeColor.r
      col[(o + i) * 3 + 1] = _bakeColor.g
      col[(o + i) * 3 + 2] = _bakeColor.b
    }
    o += count
    geo.dispose()
  }

  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  merged.setAttribute('color', new THREE.BufferAttribute(col, 3))
  merged.computeBoundingSphere()

  for (const { mesh: m } of found) {
    m.parent?.remove(m)
    m.geometry.dispose()
    m.material.dispose?.()
  }

  const baked = new THREE.Mesh(merged, bakedMaterial())
  baked.castShadow = true
  baked.receiveShadow = true
  bone.add(baked)
}

function applyVertexColor(geo, color) {
  const count = geo.attributes.position.count
  const col = new Float32Array(count * 3)
  _bakeColor.copy(color)
  for (let i = 0; i < count; i++) {
    col[i * 3] = _bakeColor.r
    col[i * 3 + 1] = _bakeColor.g
    col[i * 3 + 2] = _bakeColor.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
}

function boxMesh(w, h, d, color, radius = 0) {
  const geo = radius > 0 ? roundedBox(w, h, d, radius) : new THREE.BoxGeometry(w, h, d)
  return mesh(geo, color)
}

/** Cheap rounded box: a box with its corner vertices pulled in. */
function roundedBox(w, h, d, r) {
  const geo = new THREE.BoxGeometry(w, h, d, 2, 2, 2)
  const pos = geo.attributes.position
  const v = new THREE.Vector3()
  const hw = w / 2
  const hh = h / 2
  const hd = d / 2
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const sx = Math.sign(v.x)
    const sy = Math.sign(v.y)
    const sz = Math.sign(v.z)
    const corner = Math.abs(Math.abs(v.x) - hw) < 1e-4 && Math.abs(Math.abs(v.y) - hh) < 1e-4 && Math.abs(Math.abs(v.z) - hd) < 1e-4
    if (corner) {
      v.set(sx * (hw - r), sy * (hh - r), sz * (hd - r))
      v.x += sx * r * 0.62
      v.y += sy * r * 0.62
      v.z += sz * r * 0.62
      pos.setXYZ(i, v.x, v.y, v.z)
    }
  }
  geo.computeVertexNormals()
  return geo
}

function ellipsoid(rx, ry, rz, color, seg = 12) {
  const geo = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7))
  geo.scale(rx, ry, rz)
  return mesh(geo, color)
}

/**
 * A rounded limb hanging from the joint at the origin down to y = -length.
 * Capsules rather than boxes: the silhouette is the whole character at this
 * size, and a box arm reads as a plank however it is shaded.
 */
function limb(radius, length, color, seg = 10) {
  const geo = new THREE.CapsuleGeometry(radius, Math.max(0.02, length - radius), 3, seg)
  const m = mesh(geo, color)
  m.position.y = -length / 2
  return m
}

/* ------------------------------------------------------------------ */
/* hair styles                                                          */
/* ------------------------------------------------------------------ */

const HAIR_BUILDERS = {
  /** The messenger's bob. */
  bob(color, R) {
    const g = new THREE.Group()
    const cap = ellipsoid(R * 1.14, R * 1.1, R * 1.14, color, 14)
    cap.position.y = R * 0.1
    g.add(cap)
    const back = ellipsoid(R * 1.05, R * 0.78, R * 0.72, color, 12)
    back.position.set(0, -R * 0.42, -R * 0.34)
    g.add(back)
    const fringe = boxMesh(R * 2.0, R * 0.62, R * 0.4, color, R * 0.14)
    fringe.position.set(0, R * 0.62, R * 0.82)
    g.add(fringe)
    for (const s of [-1, 1]) {
      const lock = boxMesh(R * 0.36, R * 1.15, R * 0.9, color, R * 0.12)
      lock.position.set(s * R * 1.0, -R * 0.16, R * 0.14)
      g.add(lock)
    }
    return g
  },
  short(color, R) {
    const g = new THREE.Group()
    const cap = ellipsoid(R * 1.1, R * 1.02, R * 1.1, color, 12)
    cap.position.y = R * 0.16
    g.add(cap)
    const fringe = boxMesh(R * 1.9, R * 0.42, R * 0.35, color, R * 0.1)
    fringe.position.set(0, R * 0.72, R * 0.8)
    g.add(fringe)
    return g
  },
  long(color, R) {
    const g = new THREE.Group()
    const cap = ellipsoid(R * 1.14, R * 1.08, R * 1.14, color, 14)
    cap.position.y = R * 0.1
    g.add(cap)
    const tail = boxMesh(R * 1.5, R * 2.4, R * 0.7, color, R * 0.2)
    tail.position.set(0, -R * 1.15, -R * 0.6)
    g.add(tail)
    const fringe = boxMesh(R * 2.0, R * 0.55, R * 0.4, color, R * 0.12)
    fringe.position.set(0, R * 0.65, R * 0.82)
    g.add(fringe)
    return g
  },
  bun(color, R) {
    const g = new THREE.Group()
    const cap = ellipsoid(R * 1.1, R * 1.04, R * 1.1, color, 12)
    cap.position.y = R * 0.14
    g.add(cap)
    const bun = ellipsoid(R * 0.52, R * 0.52, R * 0.52, color, 10)
    bun.position.set(0, R * 1.1, -R * 0.5)
    g.add(bun)
    return g
  },
  spiky(color, R) {
    const g = new THREE.Group()
    const cap = ellipsoid(R * 1.08, R * 1.0, R * 1.08, color, 12)
    cap.position.y = R * 0.16
    g.add(cap)
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2
      const spike = new THREE.Mesh(new THREE.ConeGeometry(R * 0.26, R * 0.7, 5), toon(color, { cache: false }))
      spike.castShadow = true
      spike.position.set(Math.cos(a) * R * 0.6, R * 0.95, Math.sin(a) * R * 0.6)
      spike.rotation.z = -Math.cos(a) * 0.7
      spike.rotation.x = Math.sin(a) * 0.7
      g.add(spike)
    }
    return g
  },
  bald(color, R) {
    const g = new THREE.Group()
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 0.98, R * 0.16, 6, 16), toon(color, { cache: false }))
    ring.rotation.x = Math.PI / 2
    ring.position.y = -R * 0.15
    ring.castShadow = true
    g.add(ring)
    return g
  },
  cap(color, R) {
    const g = new THREE.Group()
    const dome = ellipsoid(R * 1.12, R * 0.82, R * 1.12, color, 12)
    dome.position.y = R * 0.3
    g.add(dome)
    const brim = boxMesh(R * 1.9, R * 0.12, R * 1.0, color, R * 0.05)
    brim.position.set(0, R * 0.18, R * 1.05)
    g.add(brim)
    const hairBack = ellipsoid(R * 1.0, R * 0.5, R * 0.7, INK, 10)
    hairBack.position.set(0, -R * 0.4, -R * 0.4)
    g.add(hairBack)
    return g
  },
  /**
   * Udeng — the folded headcloth.
   *
   * A real one is a band low around the brow with a peak folded up at the
   * front and a knot behind; the crown of the head stays visible. The previous
   * version was a single slab wider and deeper than the skull sat on top of it,
   * so from behind the character was a white brick.
   */
  udeng(color, R) {
    const g = new THREE.Group()
    const cap = ellipsoid(R * 1.06, R * 1.0, R * 1.06, color, 14)
    cap.position.y = R * 0.1
    g.add(cap)

    // Low band around the brow — only as wide as the head.
    const band = ellipsoid(R * 1.1, R * 0.3, R * 1.1, ACCENT.polengWhite, 14)
    band.position.y = R * 0.46
    g.add(band)
    const trim = ellipsoid(R * 1.11, R * 0.07, R * 1.11, BUILD.gold, 14)
    trim.position.y = R * 0.3
    g.add(trim)

    // The folded peak, rising and tipping forward over the forehead.
    const peak = boxMesh(R * 0.16, R * 0.78, R * 0.72, ACCENT.polengWhite, R * 0.06)
    peak.position.set(0, R * 0.92, R * 0.4)
    peak.rotation.x = -0.42
    g.add(peak)
    const wing = boxMesh(R * 0.9, R * 0.5, R * 0.16, ACCENT.polengWhite, R * 0.07)
    wing.position.set(0, R * 0.74, R * 0.72)
    wing.rotation.x = -0.5
    g.add(wing)

    // Knot at the back.
    const knot = boxMesh(R * 0.42, R * 0.32, R * 0.3, ACCENT.polengWhite, R * 0.1)
    knot.position.set(0, R * 0.56, -R * 1.0)
    g.add(knot)
    return g
  },
  /**
   * Barong mask headdress. Not the whole beast — one dancer's share of it:
   * the gold crown fanning up and out, red mask plate over the brow, gilded
   * ear wings and the white beard hanging under the jaw.
   */
  barong(color, R) {
    const g = new THREE.Group()
    const cap = ellipsoid(R * 1.08, R * 1.0, R * 1.08, ACCENT.deepRed, 12)
    cap.position.y = R * 0.12
    g.add(cap)

    // Brow plate.
    const plate = boxMesh(R * 1.7, R * 0.5, R * 0.34, ACCENT.deepRed, R * 0.1)
    plate.position.set(0, R * 0.56, R * 0.62)
    plate.rotation.x = -0.32
    g.add(plate)
    const plateTrim = boxMesh(R * 1.78, R * 0.14, R * 0.36, BUILD.gold, R * 0.05)
    plateTrim.position.set(0, R * 0.82, R * 0.56)
    plateTrim.rotation.x = -0.32
    g.add(plateTrim)

    // Crown: gold fans stepping up and back.
    for (let i = 0; i < 4; i++) {
      const w = R * (1.9 - i * 0.34)
      const fan = boxMesh(w, R * 0.34, R * 0.14, i % 2 ? BUILD.gold : BUILD.goldDark, R * 0.05)
      fan.position.set(0, R * (0.95 + i * 0.3), R * (0.28 - i * 0.2))
      fan.rotation.x = -0.5 + i * 0.1
      g.add(fan)
    }
    const crest = new THREE.Mesh(new THREE.ConeGeometry(R * 0.22, R * 0.62, 6), toon(BUILD.gold, { cache: false }))
    crest.castShadow = true
    crest.position.set(0, R * 2.05, -R * 0.32)
    g.add(crest)

    // Gilded ear wings.
    for (const s of [-1, 1]) {
      const wing = boxMesh(R * 0.24, R * 0.72, R * 0.5, BUILD.gold, R * 0.07)
      wing.position.set(s * R * 1.12, R * 0.32, -R * 0.05)
      wing.rotation.z = s * 0.4
      g.add(wing)
    }

    // White beard fringe under the jaw.
    for (let i = -2; i <= 2; i++) {
      const tuft = boxMesh(R * 0.18, R * 0.44, R * 0.12, ACCENT.polengWhite, R * 0.05)
      tuft.position.set(i * R * 0.2, -R * 0.78, R * 0.5)
      tuft.rotation.x = 0.25
      g.add(tuft)
    }
    return g
  },
  strawHat(color, R) {
    const g = new THREE.Group()
    const dome = ellipsoid(R * 1.05, R * 0.6, R * 1.05, BUILD.tan, 12)
    dome.position.y = R * 0.5
    g.add(dome)
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(R * 2.1, R * 2.1, R * 0.08, 16), toon(BUILD.tan, { cache: false }))
    brim.position.y = R * 0.3
    brim.castShadow = true
    g.add(brim)
    const hairBack = ellipsoid(R * 1.0, R * 0.55, R * 0.75, color, 10)
    hairBack.position.set(0, -R * 0.42, -R * 0.35)
    g.add(hairBack)
    return g
  },
}

export const HAIR_STYLES = Object.keys(HAIR_BUILDERS)

/* ------------------------------------------------------------------ */
/* accessories                                                          */
/* ------------------------------------------------------------------ */

function messengerBag(color, strapColor) {
  const g = new THREE.Group()
  const body = boxMesh(0.25, 0.22, 0.13, color, 0.05)
  g.add(body)
  const flap = boxMesh(0.26, 0.12, 0.14, color, 0.04)
  flap.position.set(0, 0.08, 0.005)
  g.add(flap)
  const label = boxMesh(0.12, 0.09, 0.01, ACCENT.white)
  label.position.set(0, -0.01, 0.072)
  g.add(label)
  g.userData.strapColor = strapColor
  return g
}

function tie(color) {
  const g = new THREE.Group()
  const knot = boxMesh(0.06, 0.05, 0.03, color)
  knot.position.set(0, 0.2, 0.125)
  g.add(knot)
  const blade = boxMesh(0.07, 0.24, 0.025, color)
  blade.position.set(0, 0.05, 0.13)
  g.add(blade)
  return g
}

function apron(color) {
  const g = new THREE.Group()
  const front = boxMesh(0.34, 0.42, 0.04, color)
  front.position.set(0, -0.02, 0.13)
  g.add(front)
  return g
}

function backpack(color) {
  const g = new THREE.Group()
  const body = boxMesh(0.3, 0.34, 0.18, color, 0.05)
  body.position.set(0, 0.02, -0.2)
  g.add(body)
  return g
}

/** Selendang — the kebaya sash: a wrap at the waist and a band across the chest. */
function sash(color) {
  const g = new THREE.Group()
  const waist = boxMesh(0.4, 0.1, 0.25, color, 0.03)
  waist.position.set(0, -0.12, 0)
  g.add(waist)
  const knot = boxMesh(0.09, 0.16, 0.05, color, 0.02)
  knot.position.set(0.17, -0.15, 0.1)
  knot.rotation.z = 0.3
  g.add(knot)
  const band = boxMesh(0.09, 0.5, 0.03, color)
  band.position.set(-0.05, 0.08, 0.125)
  band.rotation.z = 0.5
  g.add(band)
  return g
}

/** VR goggles, worn over the eyes with a strap round the back of the head. */
function vrGoggles(R) {
  const g = new THREE.Group()
  const visor = boxMesh(R * 1.3, R * 0.52, R * 0.4, 0x24262b, R * 0.1)
  visor.position.set(0, R * 0.02, R * 0.78)
  g.add(visor)
  const lens = boxMesh(R * 1.1, R * 0.34, R * 0.05, 0x3fa7c9, R * 0.05)
  lens.position.set(0, R * 0.02, R * 0.99)
  lens.castShadow = false
  g.add(lens)
  const pad = boxMesh(R * 1.34, R * 0.14, R * 0.36, 0x3a3d44, R * 0.04)
  pad.position.set(0, R * 0.32, R * 0.72)
  g.add(pad)
  for (const s of [-1, 1]) {
    const strap = boxMesh(R * 0.9, R * 0.16, R * 0.08, 0x24262b)
    strap.position.set(s * R * 0.72, R * 0.05, R * 0.1)
    strap.rotation.y = s * 0.9
    g.add(strap)
  }
  return g
}

/** The barong's shaggy white collar, in layered rings around the shoulders. */
function mane(color) {
  const g = new THREE.Group()
  for (let ring = 0; ring < 3; ring++) {
    const y = 0.16 - ring * 0.13
    const rad = 0.24 + ring * 0.05
    const tufts = 9
    for (let i = 0; i < tufts; i++) {
      const a = (i / tufts) * Math.PI * 2 + ring * 0.35
      const tuft = boxMesh(0.09, 0.3, 0.06, ring % 2 ? color : BUILD.gold, 0.02)
      tuft.position.set(Math.cos(a) * rad, y, Math.sin(a) * rad)
      tuft.rotation.z = -Math.cos(a) * 0.45
      tuft.rotation.x = Math.sin(a) * 0.45
      g.add(tuft)
    }
  }
  return g
}

/* ------------------------------------------------------------------ */
/* the rig                                                              */
/* ------------------------------------------------------------------ */

export const DEFAULT_LOOK = {
  skin: CHAR.skin,
  hair: CHAR.hair,
  hairStyle: 'udeng',
  shirt: CHAR.shirt,
  shorts: CHAR.shorts,
  socks: CHAR.socks,
  shoes: CHAR.shoes,
  bag: CHAR.bag,
  strap: CHAR.strap,
  scale: 1,
  build: 1,
  accessory: null, // 'tie' | 'apron' | 'backpack' | 'sash' | 'vr' | 'mane' | null
  accessoryColor: ACCENT.red,
  /** null for human; 'koala' swaps the ears and nose. */
  species: null,
  /** A colour to tuck a flower over the right ear, or null. */
  hairFlower: null,
  longSleeves: true,
  longPants: false,
}

export function createCharacter(look = {}) {
  const L = { ...DEFAULT_LOOK, ...look }
  const R = DIM.headR

  const root = new THREE.Group()
  root.name = 'character'

  const body = new THREE.Group()
  root.add(body)

  const hips = bone(new THREE.Group())
  hips.position.y = DIM.hipY
  body.add(hips)

  const chest = bone(new THREE.Group())
  chest.position.y = DIM.chestY
  hips.add(chest)

  const neck = bone(new THREE.Group())
  neck.position.y = DIM.neckY
  chest.add(neck)

  const head = bone(new THREE.Group())
  head.position.y = DIM.headY
  neck.add(head)

  // Torso + hips. The pelvis reaches below the top of the thighs and the yoke
  // above the shoulder joints; leave either short and the figure comes apart.
  const torsoW = 0.34 * L.build
  const torso = boxMesh(torsoW, 0.4, 0.21 * L.build, L.shirt, 0.1)
  torso.position.y = 0.06
  chest.add(torso)

  const pelvis = boxMesh(torsoW * 1.02, 0.24, 0.215 * L.build, L.shorts, 0.075)
  pelvis.position.y = -0.2
  chest.add(pelvis)

  const yoke = boxMesh(torsoW * 0.94, 0.13, 0.2 * L.build, L.longSleeves ? L.shirt : L.skin, 0.06)
  yoke.position.y = 0.21
  chest.add(yoke)

  // Neck. Short and thick — bridges the top of the torso to the jaw.
  const neckMesh = mesh(new THREE.CylinderGeometry(0.078, 0.094, 0.16, 10), L.skin)
  neckMesh.position.y = -0.045
  neck.add(neckMesh)

  // Head: one soft mass, slightly wider than deep, with the jaw tucked in
  // rather than bolted on as a separate slab.
  const skull = ellipsoid(R, R * 0.98, R * 0.94, L.skin, 18)
  head.add(skull)
  const jaw = ellipsoid(R * 0.82, R * 0.55, R * 0.8, L.skin, 14)
  jaw.position.set(0, -R * 0.46, R * 0.06)
  head.add(jaw)
  if (L.species === 'koala') {
    // Big round fluffy ears high on the skull, and the wide flat nose. These
    // two features *are* the koala — everything else can stay humanoid.
    for (const s of [-1, 1]) {
      const ear = ellipsoid(R * 0.42, R * 0.44, R * 0.18, L.skin, 12)
      ear.position.set(s * R * 0.88, R * 0.52, -R * 0.08)
      head.add(ear)
      const inner = ellipsoid(R * 0.24, R * 0.26, R * 0.1, 0xd8b8c0, 10)
      inner.position.set(s * R * 0.86, R * 0.52, R * 0.02)
      head.add(inner)
    }
    const kNose = ellipsoid(R * 0.17, R * 0.26, R * 0.12, INK, 10)
    kNose.position.set(0, -R * 0.12, R * 0.88)
    head.add(kNose)
  } else {
    for (const s of [-1, 1]) {
      const ear = ellipsoid(R * 0.1, R * 0.17, R * 0.13, L.skin, 8)
      ear.position.set(s * R * 0.97, -R * 0.06, -R * 0.02)
      head.add(ear)
    }
  }

  /**
   * Face.
   *
   * Every feature is dropped onto the skull's actual surface rather than onto
   * one flat plane in front of it. On a plane the eyes bulge off the middle of
   * the face while the mouth and brows — further from the centre, where the
   * head curves away — sink inside it, and the whole face reads as stuck on.
   */
  const surfaceZ = (x, y) => {
    const k = 1 - (x / R) ** 2 - (y / (R * 0.98)) ** 2
    return R * 0.94 * Math.sqrt(Math.max(0.05, k))
  }

  const face = new THREE.Group()
  head.add(face)

  const eyeX = R * 0.34
  const eyeY = R * 0.01
  const browY = R * 0.36
  for (const s of [-1, 1]) {
    /**
     * White sclera under a dark pupil. Dark-only eyes vanished into the
     * shadow under the fringe and the whole face read as a smudge — the white
     * is what makes a face legible at this camera distance, the same trick
     * every character in this genre leans on.
     */
    const sclera = ellipsoid(R * 0.15, R * 0.19, R * 0.055, ACCENT.white, 14)
    sclera.position.set(s * eyeX, eyeY, surfaceZ(eyeX, eyeY) - R * 0.03)
    sclera.castShadow = false
    face.add(sclera)

    const pupil = ellipsoid(R * 0.088, R * 0.12, R * 0.045, CHAR.eye, 10)
    pupil.position.set(s * (eyeX - R * 0.01), eyeY - R * 0.005, surfaceZ(eyeX, eyeY) + R * 0.005)
    pupil.castShadow = false
    face.add(pupil)

    const spark = ellipsoid(R * 0.028, R * 0.034, R * 0.02, ACCENT.white, 6)
    spark.position.set(s * (eyeX - R * 0.04), eyeY + R * 0.04, surfaceZ(eyeX, eyeY) + R * 0.038)
    spark.castShadow = false
    face.add(spark)

    // Brows: short, thin, high enough to clear the fringe line.
    const browBar = boxMesh(R * 0.17, R * 0.032, R * 0.04, L.hair, R * 0.013)
    browBar.position.set(s * eyeX, browY, surfaceZ(eyeX, browY) - R * 0.006)
    browBar.rotation.z = s * -0.14
    browBar.castShadow = false
    face.add(browBar)
  }

  // Just enough nose to break the profile.
  const noseY = -R * 0.13
  const nose = ellipsoid(R * 0.05, R * 0.042, R * 0.042, L.skin, 8)
  nose.position.set(0, noseY, surfaceZ(0, noseY))
  nose.castShadow = false
  face.add(nose)

  // Mouth as a shallow arc of three segments — a straight bar looks grim, and
  // the curve is what makes the whole face read as friendly.
  const mouthY = -R * 0.37
  for (const [dx, dy, rot, w] of [
    [0, 0, 0, 0.11],
    [-0.075, 0.028, 0.42, 0.07],
    [0.075, 0.028, -0.42, 0.07],
  ]) {
    const seg = boxMesh(R * w, R * 0.036, R * 0.04, CHAR.eye, R * 0.014)
    const mx = R * dx
    const my = mouthY + R * dy
    seg.position.set(mx, my, surfaceZ(mx, my) - R * 0.012)
    seg.rotation.z = rot
    seg.castShadow = false
    face.add(seg)
  }

  const brow = new THREE.Group()
  face.add(brow)

  const hairGroup = HAIR_BUILDERS[L.hairStyle in HAIR_BUILDERS ? L.hairStyle : 'bob'](L.hair, R)
  head.add(hairGroup)

  // Arms.
  const arms = {}
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? -1 : 1
    const shoulder = bone(new THREE.Group())
    shoulder.position.set(s * DIM.shoulderX * L.build, DIM.shoulderY, 0)
    chest.add(shoulder)

    const sleeve = L.longSleeves ? L.shirt : L.skin
    const upper = bone(new THREE.Group())
    shoulder.add(upper)
    // Rounded cap on the joint so the arm reads as attached rather than butted
    // against the side of the torso.
    upper.add(ellipsoid(0.078, 0.075, 0.078, sleeve, 10))
    upper.add(limb(0.066, DIM.upperArm, sleeve))

    const fore = bone(new THREE.Group())
    fore.position.y = -DIM.upperArm
    upper.add(fore)
    fore.add(limb(0.058, DIM.foreArm, L.skin))

    const hand = bone(new THREE.Group())
    hand.position.y = -DIM.foreArm
    fore.add(hand)
    // Chunky mitten hands. Fingers would be invisible at this size and only
    // add silhouette noise.
    const handMesh = ellipsoid(0.062, 0.072, 0.055, L.skin, 10)
    handMesh.position.y = -0.05
    hand.add(handMesh)

    arms[side] = { shoulder, upper, fore, hand }
  }

  // Legs.
  const legs = {}
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? -1 : 1
    const thigh = bone(new THREE.Group())
    thigh.position.set(s * 0.088 * L.build, -0.02, 0)
    hips.add(thigh)
    thigh.add(ellipsoid(0.085, 0.08, 0.085, L.shorts, 10))
    thigh.add(limb(0.078, DIM.thigh, L.shorts))

    const shin = bone(new THREE.Group())
    shin.position.y = -DIM.thigh
    thigh.add(shin)
    shin.add(limb(0.062, DIM.shin, L.longPants ? L.shorts : L.skin))

    const sock = mesh(new THREE.CylinderGeometry(0.066, 0.07, 0.1, 10), L.socks)
    sock.position.y = -DIM.shin + 0.11
    shin.add(sock)

    // The foot bone is the ankle. Build the shoe upward from there so the sole
    // lands on y = 0 rather than below the character's own feet.
    const foot = bone(new THREE.Group())
    foot.position.y = -DIM.shin
    shin.add(foot)
    const sole = boxMesh(0.125, 0.035, 0.235, ACCENT.white, 0.016)
    sole.position.set(0, -0.0225, 0.038)
    foot.add(sole)
    const shoe = boxMesh(0.12, 0.085, 0.225, L.shoes, 0.045)
    shoe.position.set(0, 0.038, 0.038)
    foot.add(shoe)

    legs[side] = { thigh, shin, foot }
  }

  // Bag on a shoulder strap, worn across the body.
  let bag = null
  if (L.bag !== null && L.bag !== undefined) {
    bag = messengerBag(L.bag, L.strap)
    bag.position.set(0.04, -0.09, 0.12)
    bag.rotation.y = -0.15
    chest.add(bag)
    const strap = boxMesh(0.05, 0.46, 0.028, L.strap)
    strap.position.set(-0.05, 0.09, 0.11)
    strap.rotation.z = 0.44
    chest.add(strap)
    const strapBack = boxMesh(0.05, 0.44, 0.028, L.strap)
    strapBack.position.set(-0.04, 0.09, -0.1)
    strapBack.rotation.z = 0.44
    chest.add(strapBack)
  }

  if (L.accessory === 'tie') chest.add(tie(L.accessoryColor))
  else if (L.accessory === 'apron') chest.add(apron(L.accessoryColor))
  else if (L.accessory === 'backpack') chest.add(backpack(L.accessoryColor))
  else if (L.accessory === 'sash') chest.add(sash(L.accessoryColor))
  else if (L.accessory === 'vr') head.add(vrGoggles(R))
  else if (L.accessory === 'mane') chest.add(mane(L.accessoryColor))

  // A frangipani tucked over the ear, the way dancers wear one.
  if (L.hairFlower) {
    const petals = ellipsoid(R * 0.16, R * 0.13, R * 0.13, L.hairFlower, 8)
    petals.position.set(R * 0.82, R * 0.42, R * 0.42)
    head.add(petals)
    const heart = ellipsoid(R * 0.06, R * 0.06, R * 0.06, 0xf2cc57, 6)
    heart.position.set(R * 0.86, R * 0.44, R * 0.5)
    heart.castShadow = false
    head.add(heart)
  }

  root.scale.setScalar(L.scale)

  // Collapse everything rigid into one mesh per joint.
  const joints = [hips, chest, neck, head]
  for (const side of ['L', 'R']) {
    joints.push(arms[side].shoulder, arms[side].upper, arms[side].fore, arms[side].hand)
    joints.push(legs[side].thigh, legs[side].shin, legs[side].foot)
  }
  for (const j of joints) bakeBone(j)

  // Something to hand over during a delivery. Added after the bake so it
  // stays a live object.
  const carry = new THREE.Group()
  carry.userData.isBone = true
  carry.position.set(0, -0.03, 0.04)
  arms.R.hand.add(carry)

  return {
    root,
    body,
    bones: { hips, chest, neck, head, arms, legs },
    carry,
    look: L,
    // Sole (y=0) to crown: head bone at 1.50 plus the skull and whatever the
    // hairstyle stacks on top of it.
    height: 1.78 * L.scale,
  }
}

export { DIM }
