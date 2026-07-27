import * as THREE from 'three'
import { CHAR, ACCENT, BUILD, INK } from '../core/palette.js'
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

const DIM = {
  hipY: 0.82,
  chestY: 0.30, // relative to hips
  neckY: 0.30, // relative to chest
  headY: 0.20, // relative to neck
  shoulderY: 0.22,
  shoulderX: 0.20,
  upperArm: 0.30,
  foreArm: 0.27,
  thigh: 0.40,
  shin: 0.38,
  headR: 0.185,
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
  const body = boxMesh(0.3, 0.26, 0.15, color, 0.05)
  body.position.set(0, 0, 0)
  g.add(body)
  const flap = boxMesh(0.31, 0.14, 0.16, color, 0.04)
  flap.position.set(0, 0.09, 0.005)
  g.add(flap)
  const label = boxMesh(0.15, 0.11, 0.01, ACCENT.white)
  label.position.set(0, 0.0, 0.082)
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

/* ------------------------------------------------------------------ */
/* the rig                                                              */
/* ------------------------------------------------------------------ */

export const DEFAULT_LOOK = {
  skin: CHAR.skin,
  hair: CHAR.hair,
  hairStyle: 'bob',
  shirt: CHAR.shirt,
  shorts: CHAR.shorts,
  socks: CHAR.socks,
  shoes: CHAR.shoes,
  bag: CHAR.bag,
  strap: CHAR.strap,
  scale: 1,
  build: 1,
  accessory: null, // 'tie' | 'apron' | 'backpack' | null
  accessoryColor: ACCENT.red,
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

  // Torso + hips.
  const torsoW = 0.38 * L.build
  const torso = boxMesh(torsoW, 0.36, 0.22 * L.build, L.shirt, 0.07)
  torso.position.y = 0.02
  chest.add(torso)

  const pelvis = boxMesh(torsoW * 0.95, 0.2, 0.21 * L.build, L.shorts, 0.05)
  pelvis.position.y = -0.16
  chest.add(pelvis)

  // Head.
  const skull = ellipsoid(R, R * 1.08, R * 0.98, L.skin, 16)
  head.add(skull)
  const jaw = boxMesh(R * 1.2, R * 0.7, R * 1.35, L.skin, R * 0.3)
  jaw.position.y = -R * 0.38
  head.add(jaw)

  // Face. Only really visible when an NPC turns to talk, so keep it simple.
  const face = new THREE.Group()
  face.position.z = R * 0.9
  head.add(face)
  for (const s of [-1, 1]) {
    const eye = ellipsoid(R * 0.11, R * 0.15, R * 0.06, CHAR.eye, 8)
    eye.position.set(s * R * 0.38, -R * 0.05, 0)
    eye.castShadow = false
    face.add(eye)
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

    const upper = bone(new THREE.Group())
    shoulder.add(upper)
    const upperMesh = boxMesh(0.105, DIM.upperArm, 0.105, L.longSleeves ? L.shirt : L.skin, 0.03)
    upperMesh.position.y = -DIM.upperArm / 2
    upper.add(upperMesh)

    const fore = bone(new THREE.Group())
    fore.position.y = -DIM.upperArm
    upper.add(fore)
    const foreMesh = boxMesh(0.09, DIM.foreArm, 0.09, L.skin, 0.03)
    foreMesh.position.y = -DIM.foreArm / 2
    fore.add(foreMesh)

    const hand = bone(new THREE.Group())
    hand.position.y = -DIM.foreArm
    fore.add(hand)
    const handMesh = boxMesh(0.085, 0.1, 0.07, L.skin, 0.03)
    handMesh.position.y = -0.04
    hand.add(handMesh)

    arms[side] = { shoulder, upper, fore, hand }
  }

  // Legs.
  const legs = {}
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? -1 : 1
    const thigh = bone(new THREE.Group())
    thigh.position.set(s * 0.1 * L.build, -0.02, 0)
    hips.add(thigh)
    const thighMesh = boxMesh(0.135, DIM.thigh, 0.15, L.shorts, 0.04)
    thighMesh.position.y = -DIM.thigh / 2
    thigh.add(thighMesh)

    const shin = bone(new THREE.Group())
    shin.position.y = -DIM.thigh
    thigh.add(shin)
    const shinMesh = boxMesh(0.105, DIM.shin, 0.115, L.longPants ? L.shorts : L.skin, 0.035)
    shinMesh.position.y = -DIM.shin / 2
    shin.add(shinMesh)

    const sock = boxMesh(0.11, 0.11, 0.12, L.socks, 0.03)
    sock.position.y = -DIM.shin + 0.06
    shin.add(sock)

    const foot = bone(new THREE.Group())
    foot.position.y = -DIM.shin
    shin.add(foot)
    const shoe = boxMesh(0.115, 0.075, 0.24, L.shoes, 0.035)
    shoe.position.set(0, -0.038, 0.045)
    foot.add(shoe)
    const sole = boxMesh(0.12, 0.03, 0.245, ACCENT.white)
    sole.position.set(0, -0.072, 0.045)
    foot.add(sole)

    legs[side] = { thigh, shin, foot }
  }

  // Bag on a shoulder strap, worn across the body.
  let bag = null
  if (L.bag !== null && L.bag !== undefined) {
    bag = messengerBag(L.bag, L.strap)
    bag.position.set(0.02, -0.06, 0.14)
    bag.rotation.y = -0.15
    chest.add(bag)
    const strap = boxMesh(0.055, 0.5, 0.03, L.strap)
    strap.position.set(-0.06, 0.1, 0.12)
    strap.rotation.z = 0.42
    chest.add(strap)
    const strapBack = boxMesh(0.055, 0.48, 0.03, L.strap)
    strapBack.position.set(-0.05, 0.1, -0.11)
    strapBack.rotation.z = 0.42
    chest.add(strapBack)
  }

  if (L.accessory === 'tie') chest.add(tie(L.accessoryColor))
  else if (L.accessory === 'apron') chest.add(apron(L.accessoryColor))
  else if (L.accessory === 'backpack') chest.add(backpack(L.accessoryColor))

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
    height: 1.72 * L.scale,
  }
}

export { DIM }
