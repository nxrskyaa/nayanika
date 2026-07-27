/**
 * Tuning constants. The planet radius is the number everything else is
 * expressed relative to — if you change it, expect to re-tune the camera.
 */

export const PLANET = {
  /**
   * Radius of the sea-level sphere, in world units.
   *
   * At 92 a district worked out to about 10 metres of usable ground, which is
   * smaller than the gap between two streets — the grid landed on the rim and
   * got shredded into stubs, and there was no room left to put buildings. The
   * horizon still curves plainly at 150.
   */
  radius: 150,
  /** Terrain displacement range above sea level. */
  reliefMax: 22,
  /** Quad-sphere subdivisions per cube face. Higher = smoother silhouette. */
  faceSegments: 112,
}

export const PLAYER = {
  walkSpeed: 4.2,
  runSpeed: 9.4,
  accel: 34,
  decel: 26,
  turnRate: 11,
  /** Distance from the character's feet to the top of its head. */
  height: 1.78,
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
  /**
   * Default rig — individual zones nudge these.
   *
   * `height` and `pitch` both raise the camera above the look target, so both
   * of them tilt the view *down*. On a planet this small the surface curves
   * away another ~5 degrees over the length of the boom, and at the old values
   * that added up to a 31 degree downward look — with a 58 degree vertical fov
   * that put the horizon just past the top edge, so the sky never appeared and
   * the whole game read as a patch of ground. Keep the total under ~20.
   */
  distance: 7.4,
  height: 1.15,
  pitch: 0.1,
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
  direction: [0.34, 0.86, 0.38],
  /** Physical intensity — see the budget note in render/stage.js. */
  intensity: 2.05,
  ambient: 1.15,
  /** Tropical mid-afternoon: warm, but nowhere near golden hour. */
  color: 0xfff2d8,
  shadowRadius: 34,
  shadowMapSize: 2048,
}

export const DAY = {
  /** Seconds of real time for one full rotation. */
  length: 420,
  /**
   * How far the sun's track is tilted off the equator. Keeps it from passing
   * exactly overhead at noon, which flattens every shadow on the planet.
   */
  tilt: 0.34,
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
export const GAME_TAGLINE = 'A small island of a planet. Somebody still has to make the round.'
export const GAME_AUTHOR = 'nxrskyaa'
export const GAME_CREDIT = 'a game by nxrskyaa'
export const SAVE_KEY = 'nayanika.save.v2'
