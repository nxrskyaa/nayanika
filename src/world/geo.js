import * as THREE from 'three'
import { toon } from '../render/materials.js'

/**
 * Small builders for the prop library, plus a merger.
 *
 * Props are authored as ordinary nested groups (readable), then flattened into
 * one mesh per material per district before they reach the scene. A town of a
 * few thousand boxes ends up as a couple of dozen draw calls.
 */

const _mat4 = new THREE.Matrix4()
const _normalMat = new THREE.Matrix3()

/* ------------------------------------------------------------------ */
/* primitives                                                          */
/* ------------------------------------------------------------------ */

const _boxGeo = new THREE.BoxGeometry(1, 1, 1)
const _cylCache = new Map()
const _sphereCache = new Map()
const _planeGeo = new THREE.PlaneGeometry(1, 1)
const _coneCache = new Map()

export function box(w, h, d, color, opts = {}) {
  const m = new THREE.Mesh(_boxGeo, toon(color, opts))
  m.scale.set(w, h, d)
  return m
}

export function cyl(rTop, rBottom, h, seg, color, opts = {}) {
  const key = `${rTop}|${rBottom}|${seg}|${opts.open ? 1 : 0}`
  let geo = _cylCache.get(key)
  if (!geo) {
    geo = new THREE.CylinderGeometry(rTop, rBottom, 1, seg, 1, !!opts.open)
    _cylCache.set(key, geo)
  }
  const m = new THREE.Mesh(geo, toon(color, opts))
  m.scale.set(1, h, 1)
  return m
}

export function sphere(r, color, seg = 12, opts = {}) {
  const key = `${seg}`
  let geo = _sphereCache.get(key)
  if (!geo) {
    geo = new THREE.SphereGeometry(1, seg, Math.max(6, Math.round(seg * 0.6)))
    _sphereCache.set(key, geo)
  }
  const m = new THREE.Mesh(geo, toon(color, opts))
  m.scale.setScalar(r)
  return m
}

export function cone(r, h, seg, color, opts = {}) {
  const key = `${seg}`
  let geo = _coneCache.get(key)
  if (!geo) {
    geo = new THREE.ConeGeometry(1, 1, seg)
    _coneCache.set(key, geo)
  }
  const m = new THREE.Mesh(geo, toon(color, opts))
  m.scale.set(r, h, r)
  return m
}

export function plane(w, h, color, opts = {}) {
  const m = new THREE.Mesh(_planeGeo, toon(color, opts))
  m.scale.set(w, h, 1)
  return m
}

/** Positions a mesh and returns it, so builders read as one expression. */
export function at(mesh, x, y, z, rx = 0, ry = 0, rz = 0) {
  mesh.position.set(x, y, z)
  mesh.rotation.set(rx, ry, rz)
  return mesh
}

export function group(...children) {
  const g = new THREE.Group()
  for (const c of children) if (c) g.add(c)
  return g
}

/* ------------------------------------------------------------------ */
/* merging                                                             */
/* ------------------------------------------------------------------ */

function cloneTransformed(mesh, parentMatrix) {
  const geo = mesh.geometry.clone()
  _mat4.copy(parentMatrix)
  geo.applyMatrix4(_mat4)
  // Only keep the attributes every prop shares, or the merge will refuse.
  const keep = ['position', 'normal', 'uv']
  for (const name of Object.keys(geo.attributes)) {
    if (!keep.includes(name)) geo.deleteAttribute(name)
  }
  if (!geo.attributes.uv) {
    const count = geo.attributes.position.count
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2))
  }
  if (geo.index) return geo.toNonIndexed()
  return geo
}

function mergeBuffers(geometries) {
  let total = 0
  for (const g of geometries) total += g.attributes.position.count
  const pos = new Float32Array(total * 3)
  const nor = new Float32Array(total * 3)
  const uv = new Float32Array(total * 2)
  let o = 0
  for (const g of geometries) {
    const p = g.attributes.position.array
    const n = g.attributes.normal.array
    const u = g.attributes.uv.array
    pos.set(p, o * 3)
    nor.set(n, o * 3)
    uv.set(u, o * 2)
    o += g.attributes.position.count
    g.dispose()
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  out.computeBoundingSphere()
  return out
}

/**
 * Flatten a group into one mesh per material. Anything tagged
 * `userData.noMerge` is carried over untouched (animated props, billboards).
 */
export function mergeByMaterial(root, { castShadow = true, receiveShadow = true } = {}) {
  root.updateMatrixWorld(true)
  const buckets = new Map()
  const passthrough = []

  root.traverse((obj) => {
    if (!obj.isMesh) return
    if (obj.userData.noMerge) {
      passthrough.push(obj)
      return
    }
    const mat = obj.material
    if (Array.isArray(mat)) return
    const key = mat.uuid
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { material: mat, geos: [] }
      buckets.set(key, bucket)
    }
    bucket.geos.push(cloneTransformed(obj, obj.matrixWorld))
  })

  const out = new THREE.Group()
  for (const { material, geos } of buckets.values()) {
    if (!geos.length) continue
    const merged = mergeBuffers(geos)
    const mesh = new THREE.Mesh(merged, material)
    mesh.castShadow = castShadow && !material.transparent
    mesh.receiveShadow = receiveShadow
    out.add(mesh)
  }
  for (const obj of passthrough) {
    obj.matrix.copy(obj.matrixWorld)
    obj.matrix.decompose(obj.position, obj.quaternion, obj.scale)
    out.add(obj)
  }
  return out
}

/* ------------------------------------------------------------------ */
/* misc                                                                */
/* ------------------------------------------------------------------ */

/** A thin ribbon following a list of points, used for roads, wires and rails. */
export function ribbon(points, widths, color, opts = {}) {
  const n = points.length
  if (n < 2) return null
  const up = opts.up || null
  const positions = new Float32Array(n * 2 * 3)
  const normals = new Float32Array(n * 2 * 3)
  const uvs = new Float32Array(n * 2 * 2)
  const indices = []

  const tangent = new THREE.Vector3()
  const side = new THREE.Vector3()
  const nrm = new THREE.Vector3()

  for (let i = 0; i < n; i++) {
    const p = points[i]
    const prev = points[Math.max(0, i - 1)]
    const next = points[Math.min(n - 1, i + 1)]
    tangent.subVectors(next, prev).normalize()
    nrm.copy(up ? up[i] : p).normalize()
    side.crossVectors(tangent, nrm).normalize()
    const w = (Array.isArray(widths) ? widths[i] : widths) * 0.5

    positions[i * 6 + 0] = p.x - side.x * w
    positions[i * 6 + 1] = p.y - side.y * w
    positions[i * 6 + 2] = p.z - side.z * w
    positions[i * 6 + 3] = p.x + side.x * w
    positions[i * 6 + 4] = p.y + side.y * w
    positions[i * 6 + 5] = p.z + side.z * w

    normals[i * 6 + 0] = nrm.x
    normals[i * 6 + 1] = nrm.y
    normals[i * 6 + 2] = nrm.z
    normals[i * 6 + 3] = nrm.x
    normals[i * 6 + 4] = nrm.y
    normals[i * 6 + 5] = nrm.z

    const v = i / (n - 1)
    uvs[i * 4 + 0] = 0
    uvs[i * 4 + 1] = v
    uvs[i * 4 + 2] = 1
    uvs[i * 4 + 3] = v

    if (i < n - 1) {
      const a = i * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeBoundingSphere()
  const mesh = new THREE.Mesh(geo, toon(color, opts))
  return mesh
}
