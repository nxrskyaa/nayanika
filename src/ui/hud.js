import { EMOTES, WARDROBE, WARDROBE_LABELS } from '../game/content.js'
import { GAME_AUTHOR, GAME_CREDIT, GAME_TAGLINE, GAME_TITLE } from '../core/config.js'
import {
  ICON_CHECKLIST,
  ICON_CLOSE,
  ICON_EMOTE,
  ICON_HELP,
  ICON_MUSIC,
  ICON_MUSIC_OFF,
  ICON_SHIRT,
} from './icons.js'

/**
 * All the DOM. Bubbles are positioned from the game loop each frame; the rest
 * is event driven.
 */

const hex = (c) => '#' + c.toString(16).padStart(6, '0')

function el(tag, cls, html) {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (html != null) n.innerHTML = html
  return n
}

export class Hud {
  constructor(root, hooks = {}) {
    this.root = root
    this.hooks = hooks
    this.openPanel = null

    this.layer = el('div')
    this.layer.id = 'ui'
    root.appendChild(this.layer)

    this._buildBubbles()
    this._buildRight()
    this._buildZoneTitle()
    this._buildBanner()
    this._buildToast()
    this._buildChecklist()
    this._buildWardrobe()
    this._buildEmotes()
    this._buildTouch()
    this._buildEnding()
    this._buildCredit()

    this._zoneTimer = 0
    this._bannerTimer = 0
    this._toastTimer = 0
    this._lastZoneId = null

    document.addEventListener('pointerdown', (e) => {
      if (!this.openPanel) return
      if (e.target.closest('.panel, #emote-bar, #hud-right')) return
      this.setPanel(null)
    })
  }

  /* ---------------------------------------------------------------- */
  /* construction                                                      */
  /* ---------------------------------------------------------------- */

  _buildBubbles() {
    this.bubbleLayer = el('div')
    this.bubbleLayer.id = 'bubbles'
    this.layer.appendChild(this.bubbleLayer)
  }

  _buildRight() {
    const wrap = el('div')
    wrap.id = 'hud-right'

    this.checklistBtn = el('button', 'btn', ICON_CHECKLIST)
    this.checklistBtn.title = 'Deliveries'
    this.checklistBadge = el('span', 'badge')
    this.checklistBtn.appendChild(this.checklistBadge)
    this.checklistBtn.addEventListener('click', () => this.togglePanel('checklist'))
    wrap.appendChild(this.checklistBtn)

    const stack = el('div', 'stack')

    this.musicBtn = el('button', 'btn', ICON_MUSIC)
    this.musicBtn.title = 'Music'
    this.musicBtn.addEventListener('click', () => {
      const on = this.hooks.onToggleMusic?.()
      this.setMusicOn(on)
    })
    stack.appendChild(this.musicBtn)

    this.wardrobeBtn = el('button', 'btn', ICON_SHIRT)
    this.wardrobeBtn.title = 'Wardrobe'
    this.wardrobeBtn.addEventListener('click', () => this.togglePanel('wardrobe'))
    stack.appendChild(this.wardrobeBtn)

    this.emoteBtn = el('button', 'btn', ICON_EMOTE)
    this.emoteBtn.title = 'Emotes'
    this.emoteBtn.addEventListener('click', () => this.togglePanel('emotes'))
    stack.appendChild(this.emoteBtn)

    this.helpBtn = el('button', 'btn', ICON_HELP)
    this.helpBtn.title = 'Controls'
    this.helpBtn.addEventListener('click', () => this.togglePanel('help'))
    stack.appendChild(this.helpBtn)

    wrap.appendChild(stack)
    this.layer.appendChild(wrap)
  }

  _buildZoneTitle() {
    this.zoneTitle = el('div')
    this.zoneTitle.id = 'zone-title'
    this.layer.appendChild(this.zoneTitle)
  }

  _buildBanner() {
    this.banner = el('div')
    this.banner.id = 'quest-banner'
    this.layer.appendChild(this.banner)
  }

  _buildToast() {
    this.toast = el('div')
    this.toast.id = 'toast'
    this.layer.appendChild(this.toast)
  }

  _panelShell(id, title) {
    const p = el('div', 'panel')
    p.id = id
    const close = el('button', 'close', '×')
    close.addEventListener('click', () => this.setPanel(null))
    p.appendChild(close)
    const h = el('h2')
    h.innerHTML = `<span>${title}</span><span class="count"></span>`
    p.appendChild(h)
    const body = el('div', 'body')
    p.appendChild(body)
    this.layer.appendChild(p)
    return { panel: p, body, count: h.querySelector('.count') }
  }

  _buildChecklist() {
    const { panel, body, count } = this._panelShell('panel-checklist', 'Deliveries')
    this.checklistPanel = panel
    this.checklistBody = body
    this.checklistCount = count
  }

  _buildWardrobe() {
    const { panel, body } = this._panelShell('panel-wardrobe', 'Wardrobe')
    this.wardrobePanel = panel
    this.wardrobeBody = body
  }

  _buildEmotes() {
    const bar = el('div')
    bar.id = 'emote-bar'
    for (const e of EMOTES) {
      const b = el('button', null, e.glyph)
      b.title = e.label
      b.addEventListener('click', () => {
        this.hooks.onEmote?.(e)
        this.setPanel(null)
      })
      bar.appendChild(b)
    }
    this.emoteBar = bar
    this.layer.appendChild(bar)

    const { panel, body } = this._panelShell('panel-help', 'Controls')
    body.innerHTML = `
      <div class="quest-row"><span class="tickbox">W</span><span class="label">Move<span class="where">W A S D or the arrow keys</span></span></div>
      <div class="quest-row"><span class="tickbox">⇧</span><span class="label">Run<span class="where">Hold shift</span></span></div>
      <div class="quest-row"><span class="tickbox">␣</span><span class="label">Jump<span class="where">Space</span></span></div>
      <div class="quest-row"><span class="tickbox">E</span><span class="label">Talk<span class="where">E, or click somebody</span></span></div>
      <div class="quest-row"><span class="tickbox">↔</span><span class="label">Look around<span class="where">Drag anywhere. Wheel to zoom</span></span></div>
      <div class="quest-row"><span class="tickbox">☰</span><span class="label">Deliveries<span class="where">The list, top right</span></span></div>
      <div class="about">${GAME_TITLE} — ${GAME_CREDIT}</div>
    `
    this.helpPanel = panel
  }

  _buildTouch() {
    this.stick = el('div', null, '<div class="knob"></div>')
    this.stick.id = 'touch-stick'
    this.layer.appendChild(this.stick)

    this.jumpBtn = el('button', 'btn', 'JUMP')
    this.jumpBtn.id = 'touch-jump'
    this.jumpBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
      this.hooks.onJump?.()
    })
    this.layer.appendChild(this.jumpBtn)
  }

  _buildEnding() {
    this.ending = el('div')
    this.ending.id = 'ending'
    this.ending.innerHTML = `
      <div class="card">
        <h2>THANK YOU</h2>
        <p class="line"></p>
        <button class="btn clickable" style="width:auto;padding:10px 22px;margin-top:18px;font-family:'Nayanika Display',sans-serif;font-size:14px;letter-spacing:.08em">KEEP WALKING</button>
      </div>`
    this.ending.querySelector('button').addEventListener('click', () => this.hideEnding())
    this.layer.appendChild(this.ending)
  }

  /** Quiet corner byline. Sits under everything and never takes a click. */
  _buildCredit() {
    this.credit = el('div', null, `${GAME_TITLE} · by ${GAME_AUTHOR}`)
    this.credit.id = 'credit'
    this.layer.appendChild(this.credit)
  }

  /* ---------------------------------------------------------------- */
  /* panels                                                            */
  /* ---------------------------------------------------------------- */

  togglePanel(name) {
    this.setPanel(this.openPanel === name ? null : name)
  }

  setPanel(name) {
    this.openPanel = name
    this.checklistPanel.classList.toggle('open', name === 'checklist')
    this.wardrobePanel.classList.toggle('open', name === 'wardrobe')
    this.helpPanel.classList.toggle('open', name === 'help')
    this.emoteBar.classList.toggle('open', name === 'emotes')
    if (name === 'checklist') this.setChecklistBadge(false)
    if (name) this.hooks.onPanelOpen?.(name)
    this.hooks.onUiSound?.(name ? 'open' : 'close')
  }

  setMusicOn(on) {
    this.musicBtn.innerHTML = on ? ICON_MUSIC : ICON_MUSIC_OFF
    this.musicBtn.classList.toggle('is-off', !on)
  }

  setChecklistBadge(on) {
    this.checklistBadge.classList.toggle('on', !!on)
  }

  renderChecklist(entries) {
    this.checklistBody.innerHTML = ''
    const done = entries.filter((e) => e.state === 'done').length
    this.checklistCount.textContent = `${done}/${entries.length}`

    let shown = 0
    for (const e of entries) {
      if (e.state === 'locked') continue
      shown++
      const row = el('div', `quest-row ${e.state}`)
      row.innerHTML = `
        <span class="tickbox">${e.state === 'done' ? '✓' : ''}</span>
        <span class="label">${e.summary}${e.where ? `<span class="where">${e.where}</span>` : ''}</span>`
      this.checklistBody.appendChild(row)
    }
    if (!shown) {
      this.checklistBody.appendChild(el('div', 'empty-note', 'Nothing on the list yet. Go and talk to somebody.'))
    }
  }

  renderWardrobe(look, onPick) {
    this.wardrobeBody.innerHTML = ''
    for (const key of Object.keys(WARDROBE)) {
      const group = el('div', 'wardrobe-group')
      group.appendChild(el('div', 'title', WARDROBE_LABELS[key] || key))
      const row = el('div', 'swatches')
      for (const value of WARDROBE[key]) {
        const isText = typeof value === 'string'
        const b = el('button', `swatch${isText ? ' text' : ''}`)
        if (isText) b.textContent = value === 'strawHat' ? 'hat' : value
        else b.style.background = hex(value)
        if (look[key] === value) b.classList.add('on')
        b.addEventListener('click', () => {
          onPick(key, value)
          this.renderWardrobe({ ...look, [key]: value }, onPick)
        })
        row.appendChild(b)
      }
      group.appendChild(row)
      this.wardrobeBody.appendChild(group)
    }
  }

  /* ---------------------------------------------------------------- */
  /* transient messages                                                */
  /* ---------------------------------------------------------------- */

  showZone(zone) {
    if (!zone) {
      this.zoneTitle.classList.remove('show')
      this._lastZoneId = null
      return
    }
    if (zone.id === this._lastZoneId) return
    this._lastZoneId = zone.id
    this.zoneTitle.textContent = zone.name
    this.zoneTitle.classList.add('show')
    this._zoneTimer = 4.2
  }

  showBanner(text, tick = false) {
    if (!text) {
      this.banner.classList.remove('show')
      return
    }
    this.banner.innerHTML = tick ? `<span class="tick">✓</span> ${text}` : text
    this.banner.classList.add('show')
    this._bannerTimer = tick ? 3.6 : 7.5
  }

  showToast(text) {
    this.toast.textContent = text
    this.toast.classList.add('show')
    this._toastTimer = 2.4
  }

  showEnding(line) {
    this.ending.querySelector('.line').textContent = line
    this.ending.classList.add('show')
  }

  hideEnding() {
    this.ending.classList.remove('show')
    this.hooks.onEndingClosed?.()
  }

  setStick(state) {
    if (!state.active) {
      this.stick.classList.remove('on')
      return
    }
    this.stick.classList.add('on')
    this.stick.style.left = `${state.ox}px`
    this.stick.style.top = `${state.oy}px`
    const knob = this.stick.querySelector('.knob')
    knob.style.transform = `translate(${state.x * 34}px, ${-state.y * 34}px)`
  }

  tick(dt) {
    if (this._zoneTimer > 0) {
      this._zoneTimer -= dt
      if (this._zoneTimer <= 0) this.zoneTitle.classList.remove('show')
    }
    if (this._bannerTimer > 0) {
      this._bannerTimer -= dt
      if (this._bannerTimer <= 0) this.banner.classList.remove('show')
    }
    if (this._toastTimer > 0) {
      this._toastTimer -= dt
      if (this._toastTimer <= 0) this.toast.classList.remove('show')
    }
  }
}

/* ------------------------------------------------------------------ */
/* intro / loading screen                                              */
/* ------------------------------------------------------------------ */

export class IntroScreen {
  constructor(root) {
    this.node = el('div')
    this.node.id = 'intro'
    this.node.classList.add('loading')
    this.node.innerHTML = `
      <div class="inner">
        <h1>${GAME_TITLE}</h1>
        <p class="tag">${GAME_TAGLINE}</p>
        <div class="swap">
          <div class="loader">
            <div class="bar"><span></span></div>
            <div class="statusrow">
              <span class="status">waking up</span>
              <span class="pct">0%</span>
            </div>
          </div>
          <button class="start">START YOUR ROUND</button>
        </div>
        <div class="hint">WASD to walk · shift to run · space to jump · E to talk · drag to look</div>
        <div class="credit">${GAME_CREDIT}</div>
      </div>`
    root.appendChild(this.node)
    this.fill = this.node.querySelector('.bar span')
    this.status = this.node.querySelector('.status')
    this.pct = this.node.querySelector('.pct')
    this.startBtn = this.node.querySelector('.start')
    /** Progress never walks backwards, however the caller reports it. */
    this._shown = 0
  }

  setProgress(p, label) {
    this._shown = Math.max(this._shown, Math.min(1, p))
    this.fill.style.width = `${(this._shown * 100).toFixed(1)}%`
    this.pct.textContent = `${Math.round(this._shown * 100)}%`
    if (label) this.status.textContent = label
  }

  ready(onStart) {
    this.setProgress(1, 'ready')
    // Hold the finished bar on screen for a beat. Snapping from 40% straight to
    // a start button is why the loader never registered as a loader.
    setTimeout(() => {
      this.node.classList.remove('loading')
      this.node.classList.add('ready')
    }, 420)

    const go = () => {
      this.startBtn.removeEventListener('click', go)
      window.removeEventListener('keydown', keyGo)
      onStart()
    }
    const keyGo = (e) => {
      if (e.code === 'Enter' || e.code === 'Space') go()
    }
    this.startBtn.addEventListener('click', go)
    window.addEventListener('keydown', keyGo)
  }

  dismiss() {
    this.node.classList.add('gone')
    setTimeout(() => this.node.remove(), 900)
  }
}
