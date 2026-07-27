import * as THREE from 'three'
import './ui/ui.css'

import { CAMERA, INTERACT, PLAYER } from './core/config.js'
import { ACCENT } from './core/palette.js'
import { nextFrame } from './core/async.js'
import { makeRng, rngPick } from './core/rng.js'
import { headingTowards, moveAlongSphere, tangentBasis } from './core/sphere.js'

import { Stage } from './render/stage.js'
import { Sky } from './render/sky.js'
import { DayNight } from './render/daynight.js'
import { toon } from './render/materials.js'

import { Terrain } from './world/terrain.js'
import { World } from './world/world.js'
import { ZONES, zoneAt, zoneById } from './world/zones.js'

import { Player } from './entities/player.js'
import { NPC, Wanderer } from './entities/npc.js'
import { createCharacter, DEFAULT_LOOK } from './entities/rig.js'

import { Input } from './game/input.js'
import { FollowCamera } from './game/camera.js'
import { QuestLog, readSave, writeSave } from './game/quests.js'
import { Audio } from './game/audio.js'
import { ENDING_LINES, EMOTES, INTRO_LINES, NPCS, WARDROBE } from './game/content.js'

import { Hud, IntroScreen } from './ui/hud.js'
import { BubbleManager } from './ui/bubbles.js'

/**
 * Nayanika — wiring.
 *
 * Build the planet, populate it, then run one loop that steps physics, the
 * camera, the townsfolk and the DOM overlay in that order.
 */

const app = document.getElementById('app')
const sceneEl = document.getElementById('scene')

const intro = new IntroScreen(app)

const stage = new Stage(sceneEl)
const sky = new Sky(stage.scene)
const dayNight = new DayNight(stage, sky)
const terrain = new Terrain()
const world = new World(stage.scene, terrain)

const audio = new Audio()
const hud = new Hud(app, {
  onToggleMusic: () => {
    audio.resume()
    return audio.toggleMusic()
  },
  onEmote: (e) => doEmote(e),
  onJump: () => input.queueJump(),
  onUiSound: (k) => audio.ui(k),
  onPanelOpen: () => {},
  onEndingClosed: () => {},
})
const bubbles = new BubbleManager(hud.bubbleLayer)

const input = new Input(stage.renderer.domElement, {
  onEscape: () => {
    if (bubbles.active) endConversation()
    else hud.setPanel(null)
  },
})
input.onStickChange = (s) => hud.setStick(s)

const followCam = new FollowCamera(stage.camera, terrain)

const quests = new QuestLog({
  onAccepted: (q) => {
    hud.showBanner(q.banner)
    hud.setChecklistBadge(true)
    hud.renderChecklist(quests.entries())
    audio.ui('accept')
    setCarrying(true, q)
  },
  onCompleted: (q) => {
    hud.showBanner(q.banner, true)
    hud.showToast(q.thanks || 'PACKAGE RECEIVED')
    hud.setChecklistBadge(true)
    hud.renderChecklist(quests.entries())
    audio.ui('complete')
    setCarrying(false)
  },
  onAllDone: () => {
    setTimeout(() => hud.showEnding(rngPick(Math.random, ENDING_LINES)), 2200)
  },
})

/* ------------------------------------------------------------------ */
/* state                                                               */
/* ------------------------------------------------------------------ */

let player = null
let npcs = []
let wanderers = []
let currentZone = null
let candidate = null
let conversation = null
let started = false
let introTimer = 0
let parcelMesh = null
const raycaster = new THREE.Raycaster()
/**
 * Characters further than this stop updating and stop drawing. A district is
 * about forty metres across, so this still covers the one you are in and the
 * approach to the next, and each character costs fifteen draw calls per pass.
 */
const CULL_DISTANCE = 56
const pointer = new THREE.Vector2()

const saved = readSave()
const playerLook = { ...DEFAULT_LOOK, ...(saved.look || {}) }

/* ------------------------------------------------------------------ */
/* boot                                                                */
/* ------------------------------------------------------------------ */

async function boot() {
  await world.build((p, label) => intro.setProgress(p * 0.9, label))

  intro.setProgress(0.93, 'hiring the neighbours')
  await nextFrame()

  // Player.
  player = new Player(terrain, world, playerLook)
  // Open plaza, not the depot doorway — the camera boom needs clear ground.
  const spawnAnchor = world.getAnchor('main-square:plaza') || ZONES[0].dir
  player.spawn(nudgeOutOfObstacles(spawnAnchor.clone(), 1.6))
  stage.scene.add(player.object)
  player.animator.onFootstep = (s) => audio.footstep(s, terrain.heightAt(player.dir) < 0.15 ? 'water' : 'ground')

  // Named cast.
  for (const def of NPCS) {
    const npc = new NPC(def, terrain, world)
    npc.place()
    npc.dir.copy(nudgeOutOfObstacles(npc.dir, 1.1))
    npc.sync()
    stage.scene.add(npc.object)
    npcs.push(npc)
  }

  // Background pedestrians walking the streets.
  const rng = makeRng(8080)
  let seed = 1
  for (const zone of ZONES) {
    const paths = world.streetPaths.get(zone.id) || []
    if (!paths.length) continue
    const count = zone.biome === 'town' ? 5 : zone.biome === 'industry' ? 3 : 2
    for (let i = 0; i < count; i++) {
      const path = paths[Math.floor(rng() * paths.length)]
      if (!path || path.length < 4) continue
      const w = new Wanderer(path, terrain, world, seed++ * 7919)
      stage.scene.add(w.object)
      wanderers.push(w)
    }
  }

  intro.setProgress(1, 'ready')

  quests.load()
  hud.renderChecklist(quests.entries())
  hud.setChecklistBadge(quests.hasNews)
  hud.renderWardrobe(playerLook, onWardrobePick)
  hud.setMusicOn(audio.musicOn)
  if (quests.active) setCarrying(true, quests.active)

  followCam.snapBehind(player)
  followCam.setZoneFraming(zoneById('main-square'))
  updateZone(true)

  // Start the round mid-morning wherever the player happens to be standing.
  dayNight.alignMorning(player.up)
  dayNight.update(0, player.up, stage.camera)

  // One warm-up frame so the first visible frame is not a blank teal screen.
  stage.updateSunTarget(player.worldPos)
  followCam.update(0.016, player)
  stage.render(0.016)

  intro.ready(start)
}

function start() {
  started = true
  introTimer = 0
  intro.dismiss()
  document.body.classList.toggle('touch', matchMedia('(pointer: coarse)').matches)
  audio.resume()
  audio.setAmbience(currentZone?.ambience || 'city')

  if (!quests.seenIntro) {
    quests.seenIntro = true
    quests.save()
    setTimeout(() => {
      bubbles.start(player, INTRO_LINES, { autoAdvance: true, offset: 0.42 })
      bubbles.onChar = () => audio.say(1)
      audio.bubble(true)
    }, 900)
  }
  followCam.snapBehind(player)
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function nudgeOutOfObstacles(dir, extra = 0.8) {
  const R = terrain.radius
  const out = dir.clone().normalize()
  const push = new THREE.Vector3()
  for (let pass = 0; pass < 6; pass++) {
    let moved = false
    for (const o of world.obstacles) {
      const dot = THREE.MathUtils.clamp(out.dot(o.dir), -1, 1)
      const d = Math.acos(dot) * R
      const need = o.radius + extra
      if (d >= need) continue
      headingTowards(o.dir, out, push)
      if (push.lengthSq() < 1e-9) push.copy(tangentBasis(o.dir).north)
      moveAlongSphere(o.dir, push, need / R, out)
      moved = true
    }
    if (!moved) break
  }
  return out
}

function setCarrying(on, quest = null) {
  if (!player) return
  player.carrying = on
  if (parcelMesh) {
    parcelMesh.parent?.remove(parcelMesh)
    parcelMesh = null
  }
  if (on) {
    const colour = quest?.parcel?.color ?? ACCENT.saffron
    const g = new THREE.Group()
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.17), toon(colour, { cache: false }))
    box.castShadow = true
    g.add(box)
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.235, 0.035, 0.185), toon(0xf3efe2, { cache: false }))
    g.add(band)
    g.position.set(0.02, -0.1, 0.08)
    player.rig.carry.add(g)
    parcelMesh = g
  }
}

function updateZone(force = false) {
  const zone = zoneAt(player.dir)
  if (zone === currentZone && !force) return
  currentZone = zone
  hud.showZone(zone)
  followCam.setZoneFraming(zone)
  audio.setAmbience(zone?.ambience || 'base')
}

function onWardrobePick(key, value) {
  playerLook[key] = value
  writeSave({ look: playerLook })
  rebuildPlayerLook()
  audio.ui('click')
}

function rebuildPlayerLook() {
  const old = player.object
  const dir = player.dir.clone()
  const heading = player.heading.clone()
  const elevation = player.elevation
  const carrying = player.carrying
  stage.scene.remove(old)
  disposeTree(old)

  const next = new Player(terrain, world, playerLook)
  next.dir.copy(dir)
  next.heading.copy(heading)
  next.elevation = elevation
  next.syncTransform()
  next.animator.onFootstep = (s) => audio.footstep(s, terrain.heightAt(next.dir) < 0.15 ? 'water' : 'ground')
  stage.scene.add(next.object)
  player = next
  parcelMesh = null
  if (carrying) setCarrying(true, quests.active)
}

/**
 * Geometry only — every character shares one baked material, so disposing
 * materials here would blank out the rest of the town.
 */
function disposeTree(root) {
  root.traverse((o) => {
    if (o.isMesh) o.geometry?.dispose?.()
  })
}

function doEmote(e) {
  if (!player) return
  bubbles.popEmote(player, e.glyph, 1.8)
  player.animator.playEmote(1.1)
  audio.bubble(true)
}

/* ------------------------------------------------------------------ */
/* conversations                                                       */
/* ------------------------------------------------------------------ */

function linesFor(npc) {
  const offer = quests.offerFrom(npc.id)
  if (offer) return { kind: 'offer', quest: offer, lines: offer.offer }

  const delivery = quests.deliveryTo(npc.id)
  if (delivery) return { kind: 'deliver', quest: delivery, lines: delivery.deliver }

  const active = quests.active
  if (active && active.from === npc.id) return { kind: 'chat', lines: active.reminder }

  return { kind: 'chat', lines: [npc.nextIdleLine()] }
}

function beginConversation(npc) {
  if (conversation) return
  const plan = linesFor(npc)
  conversation = { npc, ...plan }

  npc.talking = true
  player.talking = true
  player.glanceAt(npc.worldPos)

  followCam.focus = new THREE.Vector3().addVectors(npc.headPos, player.eyePos).multiplyScalar(0.5)

  const voice = (npc.id.charCodeAt(0) + npc.id.length) % 4
  bubbles.onChar = () => audio.say(voice)
  bubbles.start(npc, plan.lines, {
    speaker: npc.name,
    offset: 0.4,
    onFinished: () => finishConversation(),
  })
  audio.bubble(true)
}

function finishConversation() {
  const c = conversation
  if (!c) return
  if (c.kind === 'offer') quests.accept(c.quest)
  else if (c.kind === 'deliver') quests.complete(c.quest)
  endConversation()
}

function endConversation() {
  bubbles.stop()
  if (conversation) {
    conversation.npc.talking = false
    conversation = null
  }
  if (player) {
    player.talking = false
    player.clearGlance()
  }
  followCam.focus = null
  audio.bubble(false)
}

function pickCandidate() {
  let best = null
  let bestD = INTERACT.notice
  for (const npc of npcs) {
    const d = npc.distanceTo(player)
    if (d < bestD) {
      bestD = d
      best = npc
    }
  }
  return best
}

function raycastNpc(clientX, clientY) {
  pointer.x = (clientX / stage.width) * 2 - 1
  pointer.y = -(clientY / stage.height) * 2 + 1
  raycaster.setFromCamera(pointer, stage.camera)
  const objects = npcs.map((n) => n.object)
  const hits = raycaster.intersectObjects(objects, true)
  if (!hits.length) return null
  let node = hits[0].object
  while (node && !node.name.startsWith('npc:')) node = node.parent
  if (!node) return null
  const id = node.name.slice(4)
  return npcs.find((n) => n.id === id) || null
}

/* ------------------------------------------------------------------ */
/* loop                                                                */
/* ------------------------------------------------------------------ */

let lastTime = performance.now()
let elapsed = 0

function frame() {
  requestAnimationFrame(frame)
  const now = performance.now()
  const dt = Math.min((now - lastTime) / 1000, 0.05)
  lastTime = now
  elapsed += dt

  sky.update(dt)
  hud.tick(dt)

  if (!player) {
    stage.render(dt)
    return
  }

  const talkingNow = bubbles.active

  // --- input ---------------------------------------------------------
  input.sample()
  const look = input.consumeLook()
  followCam.applyLook(look, dt)
  followCam.applyZoom(input.consumeZoom())

  const click = input.consumeClick()
  const interactPressed = input.consumeInteract()
  const jumpPressed = input.consumeJump()

  if (started) {
    if (talkingNow) {
      if (interactPressed || click || jumpPressed) bubbles.advance()
    } else {
      let target = null
      if (click) target = raycastNpc(click.x, click.y)
      if (!target && (interactPressed || click) && candidate && candidate.distanceTo(player) < INTERACT.talk) {
        target = candidate
      }
      if (target && target.distanceTo(player) < INTERACT.notice) beginConversation(target)
    }
  }

  // --- player --------------------------------------------------------
  const moveInput = started && !talkingNow ? input.move : { x: 0, y: 0 }
  const wasGrounded = player.grounded
  player.update(dt, moveInput, followCam.forward, input.run, started && !talkingNow && jumpPressed && !talkingNow)
  if (wasGrounded && !player.grounded && player.verticalVel > 0) audio.jump()
  if (!wasGrounded && player.grounded) audio.land()

  // --- camera --------------------------------------------------------
  if (!started) {
    // Slow drift-in behind the character while the title card is up.
    introTimer += dt
    followCam.zoom = 1 + Math.max(0, 1.9 - introTimer * 0.35)
    followCam.yaw += dt * 0.06
  }
  followCam.update(dt, player)
  // Time of day is graded from the sun's height above *this* spot, so walking
  // far enough around the planet moves you through the hours as well.
  dayNight.update(started ? dt : 0, player.up, stage.camera)
  stage.updateSunTarget(player.worldPos)
  hud.setClock(dayNight.clockLabel(), dayNight.grade.name)

  // --- townsfolk -----------------------------------------------------
  // Far-off characters are dropped entirely; on a planet this size most of
  // the cast is over the horizon at any moment.
  for (const npc of npcs) {
    const near = npc.distanceTo(player) < CULL_DISTANCE
    npc.object.visible = near
    if (near) npc.update(dt, player)
  }
  for (const w of wanderers) {
    const near = w.distanceTo(player) < CULL_DISTANCE
    w.object.visible = near
    if (near) w.update(dt, player)
  }
  world.update(dt, elapsed)

  // --- interaction hints ---------------------------------------------
  candidate = pickCandidate()
  for (const npc of npcs) {
    const near = npc.distanceTo(player) < INTERACT.notice
    const relevant = !!(quests.offerFrom(npc.id) || quests.deliveryTo(npc.id))
    const show = started && !talkingNow && near && (relevant || npc.distanceTo(player) < INTERACT.talk * 1.6)
    if (show) bubbles.showHint(npc)
    else bubbles.hideHint(npc)
  }

  updateZone()

  bubbles.update(dt, stage.camera, stage.width, stage.height)
  stage.render(dt)
}

bubbles.onHintClick = (entity) => {
  if (!started || bubbles.active) return
  if (entity.distanceTo(player) < INTERACT.notice) beginConversation(entity)
}

window.addEventListener('resize', () => stage.resize())
window.addEventListener('orientationchange', () => setTimeout(() => stage.resize(), 250))
document.addEventListener('visibilitychange', () => {
  if (document.hidden) input.reset()
})

boot()
frame()

// A tiny console handle for poking at the world during development.
if (import.meta.env?.DEV) {
  window.NAYANIKA = { stage, sky, dayNight, terrain, world, quests, get player() { return player }, followCam, audio }
}
