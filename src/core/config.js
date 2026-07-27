/**
 * Tuning constants. The planet radius is the number everything else is
 * expressed relative to — if you change it, expect to re-tune the camera.
 */

export const PLANET = {
  /** Radius of the sea-level sphere, in world units. */
  radius: 92,
  /** Terrain displacement range above sea level. */
  reliefMax: 22,
  /** Quad-sphere subdivisions per cube face. Higher = smoother silhouette. */
  faceSegments: 96,
}

export const PLAYER = {
  walkSpeed: 4.2,
  runSpeed: 9.4,
  accel: 34,
  decel: 26,
  turnRate: 11,
  /** Distance from the character's feet to the top of its head. */
  height: 1.72,
  radius: 0.42,
  jumpSpeed: 8.6,
  gravity: 24,
  /** Steps taller than this block movement. */
  stepHeight: 0.55,
}

export const CAMERA = {
  fov: 58,
  near: 0.15,
  far: 900,
  /** Default rig — individual zones nudge these. */
  distance: 7.4,
  height: 2.5,
  pitch: 0.16,
  /** Exponential smoothing rates (higher = snappier). */
  followLerp: 6.5,
  yawLerp: 3.0,
  /** How long after a manual drag before the camera re-centres itself. */
  autoAlignDelay: 1.4,
  minPitch: -0.55,
  maxPitch: 0.95,
}

export const SUN = {
  /** Direction the light travels *from*, in planet space. Normalised on use. */
  direction: [0.42, 0.78, 0.46],
  intensity: 2.05,
  ambient: 1.15,
  shadowRadius: 34,
  shadowMapSize: 2048,
}

export const INTERACT = {
  /** Talk range, and the slightly wider range that pops the "..." bubble. */
  talk: 3.1,
  notice: 6.4,
}

export const RENDER = {
  outlineThickness: 1.35,
  outlineDepthSensitivity: 0.55,
  outlineNormalSensitivity: 0.62,
  /** Hand-drawn wobble applied to the outline sampling offsets. */
  outlineWobble: 0.85,
  maxPixelRatio: 1.75,
}

export const GAME_TITLE = 'NAYANIKA'
export const GAME_TAGLINE = "It's a small planet, but someone's gotta make the deliveries."
export const SAVE_KEY = 'nayanika.save.v1'
