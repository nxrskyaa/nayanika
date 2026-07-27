/**
 * All sound is synthesised at runtime — no audio files ship with the game.
 *
 * The music is a slow pentatonic music box over a pad that follows a four-chord
 * loop; ambience is a filtered noise bed whose character changes per district.
 * Everything is deliberately quiet.
 */

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12)

/**
 * Pelog selisir, the five-tone scale most Balinese gong kebyar is built on.
 *
 * The steps are deliberately not equal tempered — that uneven spacing is most
 * of why gamelan does not sound like a Western pentatonic, and rounding it to
 * the piano throws the whole character away.
 */
const PELOG_CENTS = [0, 130, 275, 700, 830]
const GAMELAN_ROOT = 261.6

/** Frequency for a scale degree; degrees past 4 carry on into the next octave. */
function pelog(degree) {
  const oct = Math.floor(degree / 5)
  const step = ((degree % 5) + 5) % 5
  return GAMELAN_ROOT * Math.pow(2, oct + PELOG_CENTS[step] / 1200)
}

/** Core melodies (pokok). Eight beats each, cycled for variation. */
const POKOK = [
  [0, 1, 3, 4, 3, 1, 2, 0],
  [2, 3, 4, 3, 1, 0, 1, 2],
  [0, 4, 3, 4, 1, 3, 2, 1],
]

// Kept for the older pad path and the UI blips.
const SCALE = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84]
const CHORDS = [
  [45, 52, 57, 64],
  [50, 57, 62, 69],
  [43, 50, 55, 62],
  [48, 55, 60, 67],
]

const AMBIENCE = {
  city: { cutoff: 900, q: 0.7, gain: 0.05, wobble: 0.12 },
  beach: { cutoff: 620, q: 0.5, gain: 0.075, wobble: 0.35 },
  forest: { cutoff: 2600, q: 1.6, gain: 0.032, wobble: 0.5 },
  waterfalls: { cutoff: 1500, q: 0.35, gain: 0.11, wobble: 0.08 },
  temple: { cutoff: 480, q: 0.8, gain: 0.03, wobble: 0.22 },
  factory: { cutoff: 320, q: 2.2, gain: 0.055, wobble: 0.05 },
  base: { cutoff: 700, q: 0.6, gain: 0.03, wobble: 0.2 },
  /** Open paddy: wind over water, insects, nothing solid to bounce off. */
  rice: { cutoff: 1900, q: 0.9, gain: 0.038, wobble: 0.42 },
}

export class Audio {
  constructor() {
    this.ctx = null
    this.enabled = true
    this.musicOn = true
    this.master = null
    this.started = false
    this._nextNoteTime = 0
    this._step = 0
    this._schedTimer = null
    this._ambienceKey = null
  }

  init() {
    if (this.ctx) return
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) {
      this.enabled = false
      return
    }
    this.ctx = new AC()

    this.master = this.ctx.createGain()
    this.master.gain.value = 0.9
    this.master.connect(this.ctx.destination)

    this.sfxBus = this.ctx.createGain()
    this.sfxBus.gain.value = 0.7
    this.sfxBus.connect(this.master)

    this.musicBus = this.ctx.createGain()
    this.musicBus.gain.value = 0
    this.musicBus.connect(this.master)

    this.ambienceBus = this.ctx.createGain()
    this.ambienceBus.gain.value = 0
    this.ambienceBus.connect(this.master)

    // A gentle plate to sit everything in the same room.
    this.reverb = this.ctx.createConvolver()
    this.reverb.buffer = makeImpulse(this.ctx, 2.4, 2.6)
    const wet = this.ctx.createGain()
    wet.gain.value = 0.24
    this.reverb.connect(wet)
    wet.connect(this.master)
    this.reverbIn = this.ctx.createGain()
    this.reverbIn.gain.value = 1
    this.reverbIn.connect(this.reverb)

    this._buildNoise()
    this._buildAmbience()
  }

  async resume() {
    this.init()
    if (!this.ctx) return
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume()
      } catch {
        /* user gesture will retry */
      }
    }
    if (!this.started) {
      this.started = true
      this._nextNoteTime = this.ctx.currentTime + 0.15
      this._schedTimer = setInterval(() => this._schedule(), 60)
      this.setMusic(this.musicOn)
    }
  }

  _buildNoise() {
    const ctx = this.ctx
    const len = ctx.sampleRate * 2
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    this.noiseBuffer = buf
  }

  _buildAmbience() {
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.loop = true

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 700
    filter.Q.value = 0.6

    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.09
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 160
    lfo.connect(lfoGain)
    lfoGain.connect(filter.frequency)

    src.connect(filter)
    filter.connect(this.ambienceBus)
    src.start()
    lfo.start()

    this.ambienceFilter = filter
    this.ambienceLfo = lfoGain
  }

  setAmbience(key) {
    if (!this.ctx || key === this._ambienceKey) return
    this._ambienceKey = key
    const cfg = AMBIENCE[key] || AMBIENCE.base
    const t = this.ctx.currentTime
    this.ambienceFilter.frequency.linearRampToValueAtTime(cfg.cutoff, t + 1.6)
    this.ambienceFilter.Q.linearRampToValueAtTime(cfg.q, t + 1.6)
    this.ambienceLfo.gain.linearRampToValueAtTime(cfg.cutoff * cfg.wobble, t + 1.6)
    this.ambienceBus.gain.linearRampToValueAtTime(this.enabled ? cfg.gain : 0, t + 1.6)
  }

  setMusic(on) {
    this.musicOn = on
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.musicBus.gain.cancelScheduledValues(t)
    this.musicBus.gain.linearRampToValueAtTime(on ? 0.22 : 0, t + 0.8)
    return on
  }

  toggleMusic() {
    return this.setMusic(!this.musicOn)
  }

  setMuted(muted) {
    this.enabled = !muted
    if (!this.ctx) return
    this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.9, this.ctx.currentTime + 0.3)
  }

  /* ---------------------------------------------------------------- */
  /* music                                                             */
  /* ---------------------------------------------------------------- */

  _schedule() {
    if (!this.ctx || !this.started) return
    const ahead = 0.4
    while (this._nextNoteTime < this.ctx.currentTime + ahead) {
      this._playStep(this._step, this._nextNoteTime)
      this._nextNoteTime += 0.19
      this._step++
    }
  }

  /**
   * One step of a sixteen-beat gongan.
   *
   * The shape is the standard colotomic one: the big gong lands on beat zero,
   * a kempur answers it halfway, small kempli tick the quarters, jegogan hold
   * the bass, and the pokok melody runs over the top with kotekan figuration
   * interlocking above that.
   */
  _playStep(step, time) {
    const beat = step % 16
    const cycle = Math.floor(step / 16)
    const pokok = POKOK[cycle % POKOK.length]

    if (beat === 0) {
      this._gong(time, 0.16)
      // Alternate cycles carry the fast interlocking part, so it breathes.
      this._busy = cycle % 2 === 1
    }
    if (beat === 8) this._gong(time, 0.075, 1.5)
    if (beat % 4 === 2) this._gangsa(pelog(11), time, 0.016, 0.34)

    // Jegogan: one low note per quarter of the cycle.
    if (beat % 4 === 0) this._gangsa(pelog(pokok[(beat / 4) * 2]) * 0.25, time, 0.07, 3.2)

    // Pokok: the melody proper, one note every other beat.
    if (beat % 2 === 0) this._gangsa(pelog(pokok[beat / 2] + 5), time, 0.05, 1.4)

    // Kotekan: fast interlocking figuration an octave up.
    if (this._busy) {
      const deg = pokok[Math.floor(beat / 2)]
      this._gangsa(pelog(deg + 10 + (beat % 2 ? 2 : 0)), time, 0.024, 0.4)
    }
  }

  /**
   * A struck bronze bar: inharmonic partials, an almost instant attack and a
   * long ring. The fundamental is played by a detuned pair a few Hz apart —
   * the beating between them is the "ombak" that gives a Balinese gamelan its
   * shimmer, and without it the whole thing sounds like a toy xylophone.
   */
  _gangsa(freq, time, gain = 0.05, decay = 1.4) {
    const ctx = this.ctx
    if (!ctx) return
    const voices = [
      [1, 1, 1],
      [1, 1, -1],
      [2.76, 0.36, 0],
      [5.4, 0.13, 0],
    ]
    for (const [mult, amp, beatSide] of voices) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq * mult + beatSide * 2.8
      const d = decay / (1 + (mult > 1 ? 1.4 : 0))
      const g = ctx.createGain()
      const peak = Math.max(0.0002, gain * amp * (beatSide === 0 ? 1 : 0.5))
      g.gain.setValueAtTime(0.0001, time)
      g.gain.exponentialRampToValueAtTime(peak, time + 0.004)
      g.gain.exponentialRampToValueAtTime(0.0001, time + d)
      osc.connect(g)
      g.connect(this.musicBus)
      g.connect(this.reverbIn)
      osc.start(time)
      osc.stop(time + d + 0.05)
    }
  }

  /** The hanging gong: low, slow to bloom, and it bends down as it settles. */
  _gong(time, gain = 0.16, pitch = 1) {
    const ctx = this.ctx
    if (!ctx) return
    const base = 65.4 * pitch
    for (const [mult, amp, dec] of [
      [1, 1, 5.5],
      [2.01, 0.34, 3.6],
      [2.98, 0.16, 2.4],
    ]) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(base * mult * 1.008, time)
      osc.frequency.exponentialRampToValueAtTime(base * mult, time + 1.1)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, time)
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * amp), time + 0.06)
      g.gain.exponentialRampToValueAtTime(0.0001, time + dec)
      osc.connect(g)
      g.connect(this.musicBus)
      g.connect(this.reverbIn)
      osc.start(time)
      osc.stop(time + dec + 0.1)
    }
  }

  _pluck(freq, time, gain) {
    const ctx = this.ctx
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = freq

    const osc2 = ctx.createOscillator()
    osc2.type = 'sine'
    osc2.frequency.value = freq * 2.01

    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, time)
    g.gain.exponentialRampToValueAtTime(gain, time + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, time + 1.5)

    const g2 = ctx.createGain()
    g2.gain.setValueAtTime(0.0001, time)
    g2.gain.exponentialRampToValueAtTime(gain * 0.3, time + 0.008)
    g2.gain.exponentialRampToValueAtTime(0.0001, time + 0.5)

    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 2600

    osc.connect(g)
    osc2.connect(g2)
    g.connect(lp)
    g2.connect(lp)
    lp.connect(this.musicBus)
    lp.connect(this.reverbIn)

    osc.start(time)
    osc2.start(time)
    osc.stop(time + 1.6)
    osc2.stop(time + 0.6)
  }

  _pad(freq, time, dur) {
    const ctx = this.ctx
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = freq
    const det = ctx.createOscillator()
    det.type = 'sawtooth'
    det.frequency.value = freq * 1.005

    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, time)
    g.gain.linearRampToValueAtTime(0.026, time + 0.9)
    g.gain.linearRampToValueAtTime(0.0001, time + dur)

    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(500, time)
    lp.frequency.linearRampToValueAtTime(900, time + dur * 0.6)
    lp.Q.value = 0.6

    osc.connect(g)
    det.connect(g)
    g.connect(lp)
    lp.connect(this.musicBus)
    lp.connect(this.reverbIn)

    osc.start(time)
    det.start(time)
    osc.stop(time + dur + 0.1)
    det.stop(time + dur + 0.1)
  }

  /* ---------------------------------------------------------------- */
  /* sfx                                                               */
  /* ---------------------------------------------------------------- */

  _noiseBurst(time, { dur = 0.12, freq = 900, q = 1.2, gain = 0.2, type = 'bandpass' } = {}) {
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.loop = true
    src.playbackRate.value = 0.7 + Math.random() * 0.6

    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q

    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, time)
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur)

    src.connect(f)
    f.connect(g)
    g.connect(this.sfxBus)
    src.start(time)
    src.stop(time + dur + 0.02)
  }

  _blip(time, freq, { dur = 0.07, gain = 0.09, type = 'square' } = {}) {
    const ctx = this.ctx
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(freq, time)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, time)
    g.gain.exponentialRampToValueAtTime(gain, time + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur)
    osc.connect(g)
    g.connect(this.sfxBus)
    osc.start(time)
    osc.stop(time + dur + 0.02)
  }

  footstep(speed01 = 0.4, surface = 'ground') {
    if (!this.ctx || !this.enabled) return
    const t = this.ctx.currentTime
    if (surface === 'water') {
      this._noiseBurst(t, { dur: 0.18, freq: 1600, q: 0.6, gain: 0.1 + speed01 * 0.06 })
      return
    }
    this._noiseBurst(t, {
      dur: 0.075 + speed01 * 0.03,
      freq: 320 + Math.random() * 180,
      q: 1.1,
      gain: 0.055 + speed01 * 0.075,
    })
  }

  jump() {
    if (!this.ctx || !this.enabled) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(240, t)
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.13)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.1, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
    osc.connect(g)
    g.connect(this.sfxBus)
    osc.start(t)
    osc.stop(t + 0.2)
  }

  land() {
    if (!this.ctx || !this.enabled) return
    this._noiseBurst(this.ctx.currentTime, { dur: 0.14, freq: 220, q: 0.9, gain: 0.14 })
  }

  ui(kind = 'click') {
    if (!this.ctx || !this.enabled) return
    const t = this.ctx.currentTime
    switch (kind) {
      case 'open':
        this._blip(t, 620, { dur: 0.06, gain: 0.05, type: 'triangle' })
        this._blip(t + 0.05, 930, { dur: 0.07, gain: 0.04, type: 'triangle' })
        break
      case 'close':
        this._blip(t, 780, { dur: 0.05, gain: 0.04, type: 'triangle' })
        this._blip(t + 0.04, 520, { dur: 0.06, gain: 0.035, type: 'triangle' })
        break
      case 'accept':
        this._blip(t, 523, { dur: 0.1, gain: 0.06, type: 'triangle' })
        this._blip(t + 0.09, 784, { dur: 0.12, gain: 0.055, type: 'triangle' })
        break
      case 'complete':
        this._blip(t, 659, { dur: 0.11, gain: 0.06, type: 'triangle' })
        this._blip(t + 0.1, 880, { dur: 0.12, gain: 0.055, type: 'triangle' })
        this._blip(t + 0.22, 1319, { dur: 0.24, gain: 0.05, type: 'triangle' })
        break
      default:
        this._blip(t, 880, { dur: 0.04, gain: 0.05, type: 'square' })
    }
  }

  /** One tick per revealed character, pitched a little randomly. */
  say(voice = 0) {
    if (!this.ctx || !this.enabled) return
    const base = [300, 380, 460, 240][voice % 4]
    this._blip(this.ctx.currentTime, base + Math.random() * 90, {
      dur: 0.032,
      gain: 0.026,
      type: 'square',
    })
  }

  bubble(open = true) {
    if (!this.ctx || !this.enabled) return
    const t = this.ctx.currentTime
    this._blip(t, open ? 420 : 620, { dur: 0.06, gain: 0.045, type: 'sine' })
    this._blip(t + 0.045, open ? 640 : 400, { dur: 0.07, gain: 0.035, type: 'sine' })
  }
}

function makeImpulse(ctx, duration, decay) {
  const rate = ctx.sampleRate
  const len = Math.floor(rate * duration)
  const buf = ctx.createBuffer(2, len, rate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
    }
  }
  return buf
}
