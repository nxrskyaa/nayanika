import * as THREE from 'three'
import { CAMERA, RENDER, SUN } from '../core/config.js'
import { INK, SKY } from '../core/palette.js'

/**
 * Renderer, lights and the ink-line post pass.
 *
 * Each frame renders the scene twice: once for colour (into a target that also
 * keeps a depth texture) and once with a normal-only override material. A
 * fullscreen shader then runs an edge filter over depth + normals and stamps
 * black lines wherever it finds a discontinuity. That is what turns flat toon
 * shading into something that reads as drawn.
 */

const COMPOSITE_VERT = /* glsl */ `
precision highp float;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const COMPOSITE_FRAG = /* glsl */ `
precision highp float;

uniform sampler2D tColor;
uniform sampler2D tNormal;
uniform sampler2D tDepth;
uniform vec2  uTexel;
uniform float uThickness;
uniform float uNear;
uniform float uFar;
uniform float uDepthSensitivity;
uniform float uNormalSensitivity;
uniform float uWobble;
uniform float uTime;
uniform float uGrain;
uniform vec3  uInk;

varying vec2 vUv;

float linearDepth(vec2 uv) {
  float z = texture2D(tDepth, uv).x;
  float ndc = z * 2.0 - 1.0;
  float viewZ = (2.0 * uNear * uFar) / (uFar + uNear - ndc * (uFar - uNear));
  return viewZ;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec3 base = texture2D(tColor, vUv).rgb;

  // Hand-drawn wobble: nudge where we sample so the lines are not machine
  // straight. Cheap, and it does a lot of work for the look.
  float w = sin(vUv.y * 220.0 + uTime * 0.15) * 0.5 + sin(vUv.x * 173.0 - uTime * 0.11) * 0.5;
  float t = uThickness * (1.0 + w * uWobble * 0.28);
  vec2 off = uTexel * t;

  float dC = linearDepth(vUv);
  float dL = linearDepth(vUv - vec2(off.x, 0.0));
  float dR = linearDepth(vUv + vec2(off.x, 0.0));
  float dU = linearDepth(vUv + vec2(0.0, off.y));
  float dD = linearDepth(vUv - vec2(0.0, off.y));

  // Normalising by distance keeps line weight even across the whole planet.
  float invD = 1.0 / max(dC, 0.35);
  float depthEdge = (abs(dL - dR) + abs(dU - dD)) * invD;
  depthEdge = smoothstep(uDepthSensitivity * 0.06, uDepthSensitivity * 0.20, depthEdge);

  vec3 nC = texture2D(tNormal, vUv).xyz * 2.0 - 1.0;
  vec3 nL = texture2D(tNormal, vUv - vec2(off.x, 0.0)).xyz * 2.0 - 1.0;
  vec3 nR = texture2D(tNormal, vUv + vec2(off.x, 0.0)).xyz * 2.0 - 1.0;
  vec3 nU = texture2D(tNormal, vUv + vec2(0.0, off.y)).xyz * 2.0 - 1.0;
  vec3 nD = texture2D(tNormal, vUv - vec2(0.0, off.y)).xyz * 2.0 - 1.0;

  float normalEdge = (1.0 - dot(nL, nR)) + (1.0 - dot(nU, nD));
  // Fade normal creases with distance or far-off roofs turn into mush.
  float fade = 1.0 - smoothstep(60.0, 240.0, dC);
  normalEdge = smoothstep(uNormalSensitivity * 0.35, uNormalSensitivity * 1.05, normalEdge) * fade;

  float edge = clamp(max(depthEdge, normalEdge * 0.92), 0.0, 1.0);

  // Nothing to outline against the empty sky.
  float isSky = step(uFar * 0.985, dC);
  edge *= 1.0 - isSky;

  vec3 col = mix(base, uInk, edge);

  // A trace of paper grain. Just enough to kill banding on the big flat areas.
  float g = hash(floor(gl_FragCoord.xy * 0.75)) - 0.5;
  col += g * uGrain;

  gl_FragColor = vec4(col, 1.0);
}
`

export class Stage {
  constructor(container) {
    this.container = container

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
    })
    this.renderer.setClearColor(SKY.horizon, 1)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.NoToneMapping
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(SKY.horizon)

    this.camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far)
    this.camera.position.set(0, 0, 140)

    this._setupLights()
    this._setupTargets()
    this._setupComposite()

    this.pixelRatio = Math.min(window.devicePixelRatio || 1, RENDER.maxPixelRatio)
    this._time = 0
    this.resize()

    // If the very first layout is 0x0 — a background tab, a hidden iframe, a
    // window that has not composited yet — a one-shot resize() leaves the
    // renderer stuck at nothing for the rest of the session. Watch the
    // container instead of trusting that first measurement.
    if (typeof ResizeObserver !== 'undefined') {
      this._observer = new ResizeObserver(() => this.resize())
      this._observer.observe(container)
    }
  }

  _setupLights() {
    const sunDir = new THREE.Vector3(...SUN.direction).normalize()

    // three r155+ dropped the legacy light scaling, so these intensities are
    // physical: a diffuse surface receives intensity * (1/PI) * albedo. The
    // three lights below are budgeted to sum to just over PI, which puts a lit
    // surface at roughly its authored colour and the shade side at ~0.62 of it.
    // Scaling them down "to taste" is what makes the whole planet read muddy.
    this.ambient = new THREE.AmbientLight(SKY.ambient, SUN.ambient * 0.72)
    this.scene.add(this.ambient)

    this.hemi = new THREE.HemisphereLight(SKY.hemiSky, SKY.hemiGround, SUN.ambient * 0.3)
    this.scene.add(this.hemi)

    this.sun = new THREE.DirectionalLight(SUN.color, SUN.intensity)
    this.sun.position.copy(sunDir).multiplyScalar(260)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(SUN.shadowMapSize, SUN.shadowMapSize)
    this.sun.shadow.bias = -0.0006
    this.sun.shadow.normalBias = 0.06
    if ('intensity' in this.sun.shadow) this.sun.shadow.intensity = 0.78
    const cam = this.sun.shadow.camera
    cam.left = -SUN.shadowRadius
    cam.right = SUN.shadowRadius
    cam.top = SUN.shadowRadius
    cam.bottom = -SUN.shadowRadius
    cam.near = 1
    cam.far = 620
    cam.updateProjectionMatrix()
    this.scene.add(this.sun)
    this.scene.add(this.sun.target)

    this.sunDir = sunDir
  }

  _setupTargets() {
    const opts = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false,
      colorSpace: THREE.SRGBColorSpace,
    }
    this.rtColor = new THREE.WebGLRenderTarget(2, 2, opts)
    this.rtColor.depthTexture = new THREE.DepthTexture(2, 2, THREE.UnsignedIntType)
    this.rtColor.depthTexture.format = THREE.DepthFormat

    this.rtNormal = new THREE.WebGLRenderTarget(2, 2, {
      ...opts,
      colorSpace: THREE.NoColorSpace,
    })

    this.normalMaterial = new THREE.MeshNormalMaterial()
  }

  _setupComposite() {
    this.compositeScene = new THREE.Scene()
    this.compositeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2))

    this.compositeMaterial = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL1,
      vertexShader: `attribute vec3 position;\nattribute vec2 uv;\n${COMPOSITE_VERT}`,
      fragmentShader: COMPOSITE_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tColor: { value: this.rtColor.texture },
        tNormal: { value: this.rtNormal.texture },
        tDepth: { value: this.rtColor.depthTexture },
        uTexel: { value: new THREE.Vector2(1 / 1280, 1 / 720) },
        uThickness: { value: RENDER.outlineThickness },
        uNear: { value: CAMERA.near },
        uFar: { value: CAMERA.far },
        uDepthSensitivity: { value: RENDER.outlineDepthSensitivity },
        uNormalSensitivity: { value: RENDER.outlineNormalSensitivity },
        uWobble: { value: RENDER.outlineWobble },
        uTime: { value: 0 },
        uGrain: { value: 0.012 },
        uInk: { value: new THREE.Color(INK) },
      },
    })

    this.compositeScene.add(new THREE.Mesh(geo, this.compositeMaterial))
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth
    const h = this.container.clientHeight || window.innerHeight
    // Nothing to size to yet. Bail rather than baking in a zero — the observer
    // will call back once the container actually has a box.
    if (w < 1 || h < 1) return
    if (w === this.width && h === this.height) return
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, RENDER.maxPixelRatio)

    this.renderer.setPixelRatio(this.pixelRatio)
    this.renderer.setSize(w, h, false)
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'

    this.camera.aspect = w / h
    // Narrow phone screens crop too much off the sides otherwise.
    this.camera.fov = w / h < 0.85 ? CAMERA.fov + 10 : CAMERA.fov
    this.camera.updateProjectionMatrix()

    const pw = Math.max(2, Math.floor(w * this.pixelRatio))
    const ph = Math.max(2, Math.floor(h * this.pixelRatio))
    this.rtColor.setSize(pw, ph)
    this.rtNormal.setSize(pw, ph)
    this.compositeMaterial.uniforms.uTexel.value.set(1 / pw, 1 / ph)
    this.width = w
    this.height = h
  }

  /** Keep the shadow frustum tight around wherever the player is. */
  updateSunTarget(focus) {
    this.sun.target.position.copy(focus)
    this.sun.position.copy(focus).addScaledVector(this.sunDir, 200)
    this.sun.target.updateMatrixWorld()
  }

  render(dt) {
    this._time += dt

    const r = this.renderer

    // Colour + depth.
    r.setRenderTarget(this.rtColor)
    r.clear(true, true, false)
    r.render(this.scene, this.camera)

    // View-space normals for the edge filter.
    const prevBg = this.scene.background
    const prevOverride = this.scene.overrideMaterial
    this.scene.background = null
    this.scene.overrideMaterial = this.normalMaterial
    r.setRenderTarget(this.rtNormal)
    r.setClearColor(0x8080ff, 1)
    r.clear(true, true, false)
    r.render(this.scene, this.camera)
    this.scene.overrideMaterial = prevOverride
    this.scene.background = prevBg
    r.setClearColor(SKY.horizon, 1)

    // Ink.
    this.compositeMaterial.uniforms.uTime.value = this._time
    r.setRenderTarget(null)
    r.render(this.compositeScene, this.compositeCamera)
  }

  dispose() {
    this._observer?.disconnect()
    this.rtColor.dispose()
    this.rtNormal.dispose()
    this.renderer.dispose()
  }
}
