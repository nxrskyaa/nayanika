/**
 * Yield to the browser between long build steps.
 *
 * Prefers a frame so the loading bar actually repaints, but falls back to a
 * timer: a backgrounded tab never fires requestAnimationFrame, and without the
 * fallback the whole load would hang until you came back to it.
 */
export function nextFrame(timeoutMs = 90) {
  return new Promise((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      resolve()
    }
    requestAnimationFrame(done)
    setTimeout(done, timeoutMs)
  })
}
