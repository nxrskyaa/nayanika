/** Inline SVG for the HUD. Stroke-first so they sit next to the ink outlines. */

const S = 'fill="none" stroke="#4d585d" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"'

export const ICON_CHECKLIST = `
<svg viewBox="0 0 24 24" aria-hidden="true">
  <circle cx="5" cy="6.5" r="1.7" fill="#4d585d"/>
  <circle cx="5" cy="12" r="1.7" fill="#4d585d"/>
  <circle cx="5" cy="17.5" r="1.7" fill="#4d585d"/>
  <rect x="9" y="5" width="11" height="3" rx="1.5" fill="#4d585d"/>
  <rect x="9" y="10.5" width="11" height="3" rx="1.5" fill="#4d585d"/>
  <rect x="9" y="16" width="11" height="3" rx="1.5" fill="#4d585d"/>
</svg>`

export const ICON_MUSIC = `
<svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="M10 18V6.2l8-1.7v11" ${S}/>
  <ellipse cx="7.6" cy="18" rx="2.6" ry="2.2" fill="#4d585d"/>
  <ellipse cx="15.6" cy="15.5" rx="2.6" ry="2.2" fill="#4d585d"/>
</svg>`

export const ICON_MUSIC_OFF = `
<svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="M10 18V6.2l8-1.7v11" ${S}/>
  <ellipse cx="7.6" cy="18" rx="2.6" ry="2.2" fill="#4d585d"/>
  <ellipse cx="15.6" cy="15.5" rx="2.6" ry="2.2" fill="#4d585d"/>
  <path d="M3.5 3.5 20.5 20.5" stroke="#d0303f" stroke-width="2.6" stroke-linecap="round"/>
</svg>`

export const ICON_SHIRT = `
<svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="M9 3.4 12 5.6l3-2.2 5.2 2.6-1.9 4-2.1-.8v8.6H7.8v-8.6l-2.1.8-1.9-4z" ${S} fill="#e9e6da"/>
</svg>`

export const ICON_EMOTE = `
<svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="M4 5.6h16v9.2H12.8L8.4 18.4v-3.6H4z" ${S} fill="#e9e6da"/>
  <circle cx="9" cy="10" r="1.25" fill="#4d585d"/>
  <circle cx="15" cy="10" r="1.25" fill="#4d585d"/>
</svg>`

export const ICON_CLOSE = `
<svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="M6 6 18 18M18 6 6 18" ${S}/>
</svg>`

export const ICON_HELP = `
<svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="M8.8 8.6a3.2 3.2 0 1 1 4.4 3c-.9.5-1.2 1.1-1.2 2.1v.6" ${S}/>
  <circle cx="12" cy="18" r="1.5" fill="#4d585d"/>
</svg>`
