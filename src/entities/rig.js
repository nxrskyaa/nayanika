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
  /** Udeng — the folded headcloth. Knot at the front, tail at the back. */
  udeng(color, R) {
    const g = new THREE.Group()
    const hairCap = ellipsoid(R * 1.06, R * 0.98, R * 1.06, color, 12)
    hairCap.position.y = R * 0.08
    g.add(hairCap)
    const band = boxMesh(R * 2.16, R * 0.68, R * 2.1, ACCENT.polengWhite, R * 0.2)
    band.position.y = R * 0.5
    g.add(band)
    const knot = boxMesh(R * 0.34, R * 0.5, R * 0.34, ACCENT.polengWhite, R * 0.1)
    knot.position.set(0, R * 0.92, R * 0.86)
    knot.rotation.z = 0.3
    g.add(knot)
    const tail = boxMesh(R * 0.9, R * 0.5, R * 0.3, ACCENT.polengWhite, R * 0.1)
    tail.position.set(0, R * 0.62, -R * 1.02)
    tail.rotation.x = -0.35
    g.add(tail)
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
  for (const s of [-1, 1]) {
    const ear = ellipsoid(R * 0.1, R * 0.17, R * 0.13, L.skin, 8)
    ear.position.set(s * R * 0.97, -R * 0.06, -R * 0.02)
    head.add(ear)
  }

  // Face. Big eyes with a catchlight — at this camera distance the eyes are
  // most of what carries the character, so they get the detail budget.
  const face = new THREE.Group()
  face.position.z = R * 0.9
  head.add(face)
  for (const s of [-1, 1]) {
    const eye = ellipsoid(R * 0.16, R * 0.21, R * 0.1, CHAR.eye, 10)
    eye.position.set(s * R * 0.36, -R * 0.02, 0)
    eye.castShadow = false
    face.add(eye)

    const spark = ellipsoid(R * 0.055, R * 0.065, R * 0.04, ACCENT.white, 6)
    spark.position.set(s * R * 0.36 + R * 0.05, R * 0.06, R * 0.07)
    spark.castShadow = false
    face.add(spark)

    const browBar = boxMesh(R * 0.26, R * 0.05, R * 0.06, L.hair, R * 0.02)
    browBar.position.set(s * R * 0.37, R * 0.29, -R * 0.02)
    browBar.rotation.z = s * -0.14
    browBar.castShadow = false
    face.add(browBar)
  }
  const mouth = boxMesh(R * 0.2, R * 0.045, R * 0.05, CHAR.eye, R * 0.02)
  mouth.position.set(0, -R * 0.42, -R * 0.1)
  mouth.castShadow = false
  face.add(mouth)
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
