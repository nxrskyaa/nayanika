import * as THREE from 'three'

/**
 * Everything in Nayanika lives on the surface of a ball, so "position" is
 * really (unit direction from the core, altitude above sea level). These
 * helpers keep that convention in one place.
 */

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _c = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _m = new THREE.Matrix4()

/** Unit direction from latitude/longitude in radians. */
export function dirFromLatLon(lat, lon, out = new THREE.Vector3()) {
  const cl = Math.cos(lat)
  return out.set(cl * Math.sin(lon), Math.sin(lat), cl * Math.cos(lon))
}

/** Degrees convenience wrapper — most content is authored in degrees. */
export function dirFromDeg(latDeg, lonDeg, out = new THREE.Vector3()) {
  return dirFromLatLon(THREE.MathUtils.degToRad(latDeg), THREE.MathUtils.degToRad(lonDeg), out)
}

export function latLonFromDir(dir) {
  const d = _a.copy(dir).normalize()
  return { lat: Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)), lon: Math.atan2(d.x, d.z) }
}

/**
 * An east/north tangent frame for a point on the sphere. `north` is the
 * direction of increasing latitude; at the poles we fall back to a fixed axis
 * so the basis never collapses.
 */
export function tangentBasis(dir, east = new THREE.Vector3(), north = new THREE.Vector3()) {
  const up = _a.copy(dir).normalize()
  const ref = Math.abs(up.y) > 0.999 ? _b.set(0, 0, 1) : _b.set(0, 1, 0)
  east.crossVectors(ref, up)
  if (east.lengthSq() < 1e-9) east.set(1, 0, 0)
  east.normalize()
  north.crossVectors(up, east).normalize()
  return { east, north }
}

/**
 * Walk `angle` radians from `dir` along the tangent direction `tangent`.
 * This is exact geodesic motion — no drift, no re-normalisation error.
 */
export function moveAlongSphere(dir, tangent, angle, out = new THREE.Vector3()) {
  const up = _a.copy(dir).normalize()
  const t = _b.copy(tangent).addScaledVector(up, -up.dot(tangent))
  if (t.lengthSq() < 1e-12) return out.copy(up)
  t.normalize()
  return out.copy(up).multiplyScalar(Math.cos(angle)).addScaledVector(t, Math.sin(angle)).normalize()
}

/** Angular distance (radians) between two directions. */
export function angleBetween(a, b) {
  const d = THREE.MathUtils.clamp(_a.copy(a).normalize().dot(_b.copy(b).normalize()), -1, 1)
  return Math.acos(d)
}

/** Surface (arc) distance between two directions on a sphere of radius r. */
export function arcDistance(a, b, radius) {
  return angleBetween(a, b) * radius
}

/** Great-circle interpolation between two unit directions. */
export function slerpDir(a, b, t, out = new THREE.Vector3()) {
  const ang = angleBetween(a, b)
  if (ang < 1e-6) return out.copy(a).normalize()
  const s = Math.sin(ang)
  const w1 = Math.sin((1 - t) * ang) / s
  const w2 = Math.sin(t * ang) / s
  return out.copy(a).multiplyScalar(w1).addScaledVector(_b.copy(b), w2).normalize()
}

/**
 * The tangent heading at `a` that points towards `b` along the great circle.
 * Returns a unit vector in the tangent plane of `a`.
 */
export function headingTowards(a, b, out = new THREE.Vector3()) {
  const up = _a.copy(a).normalize()
  out.copy(b).addScaledVector(up, -up.dot(b))
  if (out.lengthSq() < 1e-12) {
    const { north } = tangentBasis(up, _b, _c)
    return out.copy(north)
  }
  return out.normalize()
}

/**
 * Build a world matrix for something standing on the planet: +Y away from the
 * core, +Z along `forward` (projected into the tangent plane).
 */
export function surfaceQuaternion(dir, forward, out = new THREE.Quaternion()) {
  const up = _a.copy(dir).normalize()
  const fwd = _b.copy(forward).addScaledVector(up, -up.dot(forward))
  if (fwd.lengthSq() < 1e-10) {
    const { north } = tangentBasis(up, _c, fwd)
    fwd.copy(north)
  }
  fwd.normalize()
  const right = _c.crossVectors(up, fwd).normalize()
  _m.makeBasis(right, up, fwd)
  return out.setFromRotationMatrix(_m)
}

/** Place an Object3D on the surface, `altitude` units above sea level. */
export function placeOnSurface(object, dir, radius, altitude, forward = null) {
  object.position.copy(dir).normalize().multiplyScalar(radius + altitude)
  if (forward) surfaceQuaternion(dir, forward, object.quaternion)
  else {
    const { north } = tangentBasis(dir, _b, _c)
    surfaceQuaternion(dir, north, object.quaternion)
  }
  return object
}

/**
 * Rotate a tangent vector around the local up axis by `angle` radians.
 * Used for turning the camera and steering the player.
 */
export function rotateTangent(dir, tangent, angle, out = new THREE.Vector3()) {
  _q.setFromAxisAngle(_a.copy(dir).normalize(), angle)
  return out.copy(tangent).applyQuaternion(_q).normalize()
}

/**
 * Signed angle from tangent `from` to tangent `to`, measured around `up`.
 * Positive is counter-clockwise when looking down at the surface.
 */
export function signedTangentAngle(up, from, to) {
  const u = _a.copy(up).normalize()
  const f = _b.copy(from).addScaledVector(u, -u.dot(from)).normalize()
  const t = _c.copy(to).addScaledVector(u, -u.dot(to)).normalize()
  const cos = THREE.MathUtils.clamp(f.dot(t), -1, 1)
  const sin = f.clone().cross(t).dot(u)
  return Math.atan2(sin, cos)
}

/** Uniformly distributed direction — handy for scattering scenery. */
export function randomDir(rng, out = new THREE.Vector3()) {
  const z = rng() * 2 - 1
  const a = rng() * Math.PI * 2
  const r = Math.sqrt(Math.max(0, 1 - z * z))
  return out.set(r * Math.cos(a), z, r * Math.sin(a))
}

/**
 * Jitter a direction by up to `maxAngle` radians — scatters props around a
 * landmark without them all landing on one spot.
 */
export function jitterDir(dir, maxAngle, rng, out = new THREE.Vector3()) {
  const { east, north } = tangentBasis(dir, _b, _c)
  const a = rng() * Math.PI * 2
  const r = Math.sqrt(rng()) * maxAngle
  const tangent = new THREE.Vector3()
    .copy(east)
    .multiplyScalar(Math.cos(a))
    .addScaledVector(north, Math.sin(a))
  return moveAlongSphere(dir, tangent, r, out)
}
