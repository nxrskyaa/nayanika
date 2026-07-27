import * as THREE from 'three'

/**
 * Speech bubbles.
 *
 * They are DOM, not sprites — crisp text at any resolution, and CSS gives us
 * the border, the tail and the pop animation for free. Each frame the manager
 * projects its anchor point into screen space and moves the node.
 */

const _v = new THREE.Vector3()

class Bubble {
  constructor(layer, cls) {
    this.node = document.createElement('div')
    this.node.className = cls
    layer.appendChild(this.node)
    this.anchor = null
    this.offset = 0.34
    this.visible = true
    this.scale = 1
  }

  destroy() {
    this.node.remove()
  }
}

export class BubbleManager {
  constructor(layer) {
    this.layer = layer
    this.hints = new Map()
    this.dialogue = null
    this.emotes = []

    this.lines = []
    this.lineIndex = 0
    this.charIndex = 0
    this.charTimer = 0
    this.charRate = 42 // characters per second
    this.speaker = null
    this.onFinished = null
    this.onLineDone = null
    this.onChar = null
    this.holdTimer = 0
  }

  get active() {
    return !!this.dialogue
  }

  /** The looping "..." bubble that marks somebody worth talking to. */
  showHint(entity) {
    if (this.hints.has(entity)) return
    const b = new Bubble(this.layer, 'bubble hint pop')
    b.node.innerHTML = '<span class="dots"><i></i><i></i><i></i></span>'
    b.anchor = entity
    b.node.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
      this.onHintClick?.(entity)
    })
    this.hints.set(entity, b)
  }

  hideHint(entity) {
    const b = this.hints.get(entity)
    if (!b) return
    b.destroy()
    this.hints.delete(entity)
  }

  clearHints() {
    for (const b of this.hints.values()) b.destroy()
    this.hints.clear()
  }

  /** Start a run of lines above `entity`. Resolves through onFinished. */
  start(entity, lines, opts = {}) {
    this.stop()
    const list = Array.isArray(lines) ? lines.filter(Boolean) : [lines]
    if (!list.length) return
    this.hideHint(entity)

    const b = new Bubble(this.layer, 'bubble pop')
    b.anchor = entity
    b.offset = opts.offset ?? 0.38
    this.dialogue = b
    this.lines = list
    this.lineIndex = 0
    this.charIndex = 0
    this.charTimer = 0
    this.holdTimer = 0
    this.speaker = opts.speaker || null
    this.onFinished = opts.onFinished || null
    this.autoAdvance = opts.autoAdvance ?? false
    this._render()
  }

  stop() {
    if (this.dialogue) {
      this.dialogue.destroy()
      this.dialogue = null
    }
    this.lines = []
    this.onFinished = null
  }

  /** Skip to the end of the line, or move on if it is already complete. */
  advance() {
    if (!this.dialogue) return false
    const line = this.lines[this.lineIndex] || ''
    if (this.charIndex < line.length) {
      this.charIndex = line.length
      this._render()
      return true
    }
    this.lineIndex++
    this.charIndex = 0
    this.charTimer = 0
    this.holdTimer = 0
    if (this.lineIndex >= this.lines.length) {
      const done = this.onFinished
      this.stop()
      done?.()
      return true
    }
    this.dialogue.node.classList.remove('pop')
    void this.dialogue.node.offsetWidth
    this.dialogue.node.classList.add('pop')
    this._render()
    return true
  }

  _render() {
    if (!this.dialogue) return
    const line = this.lines[this.lineIndex] || ''
    const shown = line.slice(0, this.charIndex)
    const complete = this.charIndex >= line.length
    const more = this.lineIndex < this.lines.length - 1 ? '▸' : '×'
    this.dialogue.node.innerHTML =
      (this.speaker ? `<span class="speaker">${this.speaker}</span>` : '') +
      escapeHtml(shown) +
      `<span class="more${complete ? ' on' : ''}">${more}</span>`
  }

  /** A one-shot emoji puff above somebody. */
  popEmote(entity, glyph, life = 1.9) {
    const b = new Bubble(this.layer, 'emote-bubble')
    b.node.textContent = glyph
    b.anchor = entity
    b.offset = 0.5
    b.life = life
    this.emotes.push(b)
  }

  update(dt, camera, width, height) {
    // Typewriter.
    if (this.dialogue) {
      const line = this.lines[this.lineIndex] || ''
      if (this.charIndex < line.length) {
        this.charTimer += dt * this.charRate
        while (this.charTimer >= 1 && this.charIndex < line.length) {
          this.charTimer -= 1
          this.charIndex++
          const ch = line[this.charIndex - 1]
          if (ch && ch !== ' ') this.onChar?.(ch)
          // A beat after punctuation reads much better than a constant rate.
          if (/[.,!?…]/.test(ch)) this.charTimer -= 5
        }
        this._render()
      } else if (this.autoAdvance) {
        this.holdTimer += dt
        if (this.holdTimer > 1.4 + line.length * 0.022) this.advance()
      }
    }

    // Emote lifetimes.
    for (let i = this.emotes.length - 1; i >= 0; i--) {
      const b = this.emotes[i]
      b.life -= dt
      if (b.life <= 0) {
        b.destroy()
        this.emotes.splice(i, 1)
      }
    }

    // Projection.
    const all = [...this.hints.values(), ...this.emotes]
    if (this.dialogue) all.push(this.dialogue)
    for (const b of all) this._position(b, camera, width, height)
  }

  _position(b, camera, width, height) {
    const a = b.anchor
    if (!a) return
    const head = a.headPos || a.worldPos
    if (!head) return
    _v.copy(head)
    if (a.up) _v.addScaledVector(a.up, b.offset)
    else _v.y += b.offset

    // Behind the camera, or facing away from us on the far side of the planet.
    const toCam = _v.clone().sub(camera.position)
    const facing = a.up ? a.up.dot(toCam.clone().normalize()) : -1

    _v.project(camera)
    const behind = _v.z > 1
    const off = _v.x < -1.25 || _v.x > 1.25 || _v.y < -1.3 || _v.y > 1.3

    if (behind || off || facing > 0.62) {
      b.node.style.opacity = '0'
      b.node.style.pointerEvents = 'none'
      return
    }
    b.node.style.opacity = '1'
    b.node.style.pointerEvents = b.node.classList.contains('hint') ? 'auto' : 'none'

    const x = (_v.x * 0.5 + 0.5) * width
    const y = (-_v.y * 0.5 + 0.5) * height
    b.node.style.left = `${Math.round(x)}px`
    b.node.style.top = `${Math.round(y)}px`
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
}
