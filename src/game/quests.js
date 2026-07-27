import { SAVE_KEY } from '../core/config.js'
import { QUESTS, NPCS } from './content.js'

/**
 * Quest state.
 *
 * Every quest is the same shape — take a thing from A to B — so the log is
 * little more than a status per id plus the rules for what unlocks next.
 */

const NPC_BY_ID = new Map(NPCS.map((n) => [n.id, n]))

export class QuestLog {
  constructor(hooks = {}) {
    this.hooks = hooks
    this.status = new Map()
    for (const q of QUESTS) this.status.set(q.id, 'locked')
    this.activeId = null
    this.seenIntro = false
    this.refresh()
  }

  get active() {
    return this.activeId ? QUESTS.find((q) => q.id === this.activeId) : null
  }

  get completedCount() {
    let n = 0
    for (const s of this.status.values()) if (s === 'done') n++
    return n
  }

  get allDone() {
    return this.completedCount === QUESTS.length
  }

  /** Promote anything whose prerequisites are satisfied. */
  refresh() {
    for (const q of QUESTS) {
      const s = this.status.get(q.id)
      if (s === 'done' || s === 'active') continue
      const ready = q.requires.every((r) => this.status.get(r) === 'done')
      this.status.set(q.id, ready ? 'available' : 'locked')
    }
  }

  /** The quest this NPC is currently able to hand out, if any. */
  offerFrom(npcId) {
    for (const q of QUESTS) {
      if (q.from !== npcId) continue
      if (this.status.get(q.id) === 'available' && !this.activeId) return q
    }
    return null
  }

  /** True if handing over to this NPC completes the active quest. */
  deliveryTo(npcId) {
    const q = this.active
    if (!q) return null
    return q.to === npcId ? q : null
  }

  accept(quest) {
    this.status.set(quest.id, 'active')
    this.activeId = quest.id
    this.save()
    this.hooks.onAccepted?.(quest)
  }

  complete(quest) {
    this.status.set(quest.id, 'done')
    if (this.activeId === quest.id) this.activeId = null
    this.refresh()
    this.save()
    this.hooks.onCompleted?.(quest)

    // Some hand-offs chain straight into the next leg.
    const next = QUESTS.find(
      (q) => q.autoStart && this.status.get(q.id) === 'available' && q.requires.includes(quest.id),
    )
    if (next) this.accept(next)
    if (this.allDone) this.hooks.onAllDone?.()
  }

  /** Rows for the checklist panel. */
  entries() {
    return QUESTS.map((q) => {
      const state = this.status.get(q.id)
      const where =
        state === 'active'
          ? `Deliver to ${NPC_BY_ID.get(q.to)?.name ?? q.to}`
          : state === 'available'
            ? `Speak to ${NPC_BY_ID.get(q.from)?.name ?? q.from}`
            : ''
      return { id: q.id, summary: q.summary, state, where }
    })
  }

  /** Is there something new worth showing a red dot for? */
  get hasNews() {
    if (this.activeId) return true
    return QUESTS.some((q) => this.status.get(q.id) === 'available')
  }

  /* ---------------------------------------------------------------- */
  /* persistence                                                       */
  /* ---------------------------------------------------------------- */

  save(extra = {}) {
    try {
      const prev = readSave()
      const data = {
        ...prev,
        ...extra,
        quests: Object.fromEntries(this.status),
        activeId: this.activeId,
        seenIntro: this.seenIntro,
      }
      localStorage.setItem(SAVE_KEY, JSON.stringify(data))
    } catch {
      /* private browsing, quota, whatever — the game still works */
    }
  }

  load() {
    const data = readSave()
    if (!data?.quests) return false
    for (const q of QUESTS) {
      const s = data.quests[q.id]
      if (s) this.status.set(q.id, s)
    }
    this.activeId = data.activeId ?? null
    this.seenIntro = !!data.seenIntro
    // An active id that no longer resolves would soft-lock the log.
    if (this.activeId && !QUESTS.some((q) => q.id === this.activeId)) this.activeId = null
    if (this.activeId) this.status.set(this.activeId, 'active')
    this.refresh()
    return true
  }

  reset() {
    for (const q of QUESTS) this.status.set(q.id, 'locked')
    this.activeId = null
    this.seenIntro = false
    this.refresh()
    this.save()
  }
}

export function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) || {}
  } catch {
    return {}
  }
}

export function writeSave(patch) {
  try {
    const data = { ...readSave(), ...patch }
    localStorage.setItem(SAVE_KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

export { NPC_BY_ID }
