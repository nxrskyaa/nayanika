/**
 * Keyboard, mouse and touch, folded into one small state object.
 *
 * Desktop: WASD / arrows to move, Shift to run, Space to jump, E or click to
 * talk, drag to swing the camera, wheel to zoom.
 * Touch: left thumb is a floating stick, right thumb swings the camera, and a
 * jump button sits bottom-right.
 */

const MOVE_KEYS = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
}

export class Input {
  constructor(target, opts = {}) {
    this.target = target
    this.keys = new Set()
    this.move = { x: 0, y: 0 }
    this.run = false
    this.lookDelta = { x: 0, y: 0 }
    this.zoomDelta = 0
    this._jumpQueued = false
    this._interactQueued = false
    this._clickQueued = null
    this.enabled = true
    this.pointerLocked = false
    this.touchActive = false
    this.stick = { active: false, id: -1, ox: 0, oy: 0, x: 0, y: 0 }
    this.lookTouch = { active: false, id: -1, x: 0, y: 0 }
    this.dragging = false
    this._dragMoved = 0
    this.onEscape = opts.onEscape || null

    this._bind()
  }

  _bind() {
    const t = this.target

    this._onKeyDown = (e) => {
      if (e.repeat) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      this.keys.add(e.code)
      if (e.code === 'Space') {
        this._jumpQueued = true
        e.preventDefault()
      }
      if (e.code === 'KeyE' || e.code === 'Enter') this._interactQueued = true
      if (e.code === 'Escape' && this.onEscape) this.onEscape()
      if (MOVE_KEYS[e.code]) e.preventDefault()
    }
    this._onKeyUp = (e) => this.keys.delete(e.code)
    this._onBlur = () => this.keys.clear()

    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup', this._onKeyUp)
    window.addEventListener('blur', this._onBlur)

    // --- pointer ------------------------------------------------------
    this._pointers = new Map()

    this._onPointerDown = (e) => {
      if (!this.enabled) return
      if (e.pointerType === 'touch') {
        this.touchActive = true
        const left = e.clientX < window.innerWidth * 0.5
        if (left && !this.stick.active) {
          this.stick.active = true
          this.stick.id = e.pointerId
          this.stick.ox = e.clientX
          this.stick.oy = e.clientY
          this.stick.x = 0
          this.stick.y = 0
          if (this.onStickChange) this.onStickChange(this.stick)
        } else if (!this.lookTouch.active) {
          this.lookTouch.active = true
          this.lookTouch.id = e.pointerId
          this.lookTouch.x = e.clientX
          this.lookTouch.y = e.clientY
        }
      } else {
        this.dragging = true
        this._dragMoved = 0
        this._lastX = e.clientX
        this._lastY = e.clientY
        t.setPointerCapture?.(e.pointerId)
      }
      this._pointers.set(e.pointerId, e)
    }

    this._onPointerMove = (e) => {
      if (!this.enabled) return
      if (e.pointerType === 'touch') {
        if (this.stick.active && e.pointerId === this.stick.id) {
          const dx = e.clientX - this.stick.ox
          const dy = e.clientY - this.stick.oy
          const max = 62
          const len = Math.hypot(dx, dy)
          const k = len > max ? max / len : 1
          this.stick.x = (dx * k) / max
          this.stick.y = (-dy * k) / max
          if (this.onStickChange) this.onStickChange(this.stick)
        } else if (this.lookTouch.active && e.pointerId === this.lookTouch.id) {
          this.lookDelta.x += e.clientX - this.lookTouch.x
          this.lookDelta.y += e.clientY - this.lookTouch.y
          this.lookTouch.x = e.clientX
          this.lookTouch.y = e.clientY
        }
      } else if (this.dragging) {
        const dx = e.clientX - this._lastX
        const dy = e.clientY - this._lastY
        this.lookDelta.x += dx
        this.lookDelta.y += dy
        this._dragMoved += Math.abs(dx) + Math.abs(dy)
        this._lastX = e.clientX
        this._lastY = e.clientY
      }
    }

    this._onPointerUp = (e) => {
      this._pointers.delete(e.pointerId)
      if (e.pointerType === 'touch') {
        if (e.pointerId === this.stick.id) {
          this.stick.active = false
          this.stick.id = -1
          this.stick.x = 0
          this.stick.y = 0
          if (this.onStickChange) this.onStickChange(this.stick)
        }
        if (e.pointerId === this.lookTouch.id) {
          this.lookTouch.active = false
          this.lookTouch.id = -1
          // A tap without much travel counts as "interact with what I tapped".
          this._clickQueued = { x: e.clientX, y: e.clientY }
        }
      } else if (this.dragging) {
        this.dragging = false
        if (this._dragMoved < 6) this._clickQueued = { x: e.clientX, y: e.clientY }
      }
    }

    this._onWheel = (e) => {
      if (!this.enabled) return
      this.zoomDelta += Math.sign(e.deltaY) * 0.6
      e.preventDefault()
    }

    t.addEventListener('pointerdown', this._onPointerDown)
    window.addEventListener('pointermove', this._onPointerMove)
    window.addEventListener('pointerup', this._onPointerUp)
    window.addEventListener('pointercancel', this._onPointerUp)
    t.addEventListener('wheel', this._onWheel, { passive: false })
    t.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  /** Call once per frame, before reading `move`. */
  sample() {
    let x = 0
    let y = 0
    for (const code of this.keys) {
      const v = MOVE_KEYS[code]
      if (v) {
        x += v[0]
        y += v[1]
      }
    }
    if (this.stick.active) {
      x += this.stick.x
      y += this.stick.y
    }
    const len = Math.hypot(x, y)
    if (len > 1) {
      x /= len
      y /= len
    }
    this.move.x = x
    this.move.y = y
    this.run = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || (this.stick.active && Math.hypot(x, y) > 0.82)
    return this.move
  }

  consumeJump() {
    const v = this._jumpQueued
    this._jumpQueued = false
    return v
  }

  queueJump() {
    this._jumpQueued = true
  }

  consumeInteract() {
    const v = this._interactQueued
    this._interactQueued = false
    return v
  }

  queueInteract() {
    this._interactQueued = true
  }

  consumeClick() {
    const v = this._clickQueued
    this._clickQueued = null
    return v
  }

  consumeLook() {
    const d = { x: this.lookDelta.x, y: this.lookDelta.y }
    this.lookDelta.x = 0
    this.lookDelta.y = 0
    return d
  }

  consumeZoom() {
    const z = this.zoomDelta
    this.zoomDelta = 0
    return z
  }

  reset() {
    this.keys.clear()
    this.move.x = 0
    this.move.y = 0
    this.lookDelta.x = 0
    this.lookDelta.y = 0
    this.stick.active = false
    this.stick.x = 0
    this.stick.y = 0
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown)
    window.removeEventListener('keyup', this._onKeyUp)
    window.removeEventListener('blur', this._onBlur)
    window.removeEventListener('pointermove', this._onPointerMove)
    window.removeEventListener('pointerup', this._onPointerUp)
    window.removeEventListener('pointercancel', this._onPointerUp)
  }
}
