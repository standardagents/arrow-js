import { component, html, reactive } from '@arrow-js/core'
import { Swatch } from './Swatch'

type HarmonyMode = 'analogous' | 'complementary' | 'triadic' | 'split' | 'mono'

function hslToHex(h: number, s: number, l: number): string {
  s = Math.max(0, Math.min(100, s))
  l = Math.max(5, Math.min(95, l))
  const ln = l / 100
  const a = (s / 100) * Math.min(ln, 1 - ln)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = ln - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function fgColor(hex: string): string {
  return luminance(hex) > 0.35 ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.9)'
}

const MODES: Array<{ id: HarmonyMode; label: string }> = [
  { id: 'analogous', label: 'Analogous' },
  { id: 'complementary', label: 'Complement' },
  { id: 'triadic', label: 'Triadic' },
  { id: 'split', label: 'Split' },
  { id: 'mono', label: 'Mono' },
]

function harmony(
  mode: HarmonyMode,
  h: number,
  s: number,
  l: number
): Array<{ h: number; s: number; l: number }> {
  const wrap = (v: number) => ((v % 360) + 360) % 360
  switch (mode) {
    case 'analogous':
      return [
        { h: wrap(h - 30), s, l: l + 10 },
        { h: wrap(h - 15), s, l: l + 4 },
        { h, s, l },
        { h: wrap(h + 15), s, l: l - 4 },
        { h: wrap(h + 30), s, l: l - 10 },
      ]
    case 'complementary':
      return [
        { h, s, l: l + 28 },
        { h, s, l },
        { h, s, l: l - 16 },
        { h: wrap(h + 180), s, l: l + 12 },
        { h: wrap(h + 180), s, l },
      ]
    case 'triadic':
      return [
        { h, s, l },
        { h, s: s - 12, l: l + 24 },
        { h: wrap(h + 120), s, l },
        { h: wrap(h + 240), s, l },
        { h: wrap(h + 240), s: s - 8, l: l + 18 },
      ]
    case 'split':
      return [
        { h, s, l },
        { h, s: s - 10, l: l + 24 },
        { h: wrap(h + 150), s, l },
        { h: wrap(h + 210), s, l },
        { h: wrap(h + 180), s: s - 25, l: l + 32 },
      ]
    case 'mono':
      return [
        { h, s: s - 8, l: 90 },
        { h, s, l: 72 },
        { h, s, l: 50 },
        { h, s, l: 32 },
        { h, s: s + 6, l: 16 },
      ]
  }
}

export const PaletteApp = component(() => {
  const state = reactive({
    hue: 210,
    sat: 65,
    lit: 50,
    mode: 'analogous' as HarmonyMode,
  })

  const colors = () =>
    harmony(state.mode, state.hue, state.sat, state.lit).map((c) => {
      const hex = hslToHex(c.h, c.s, c.l)
      return { hex, fg: fgColor(hex) }
    })

  const generate = () => {
    state.hue = Math.floor(Math.random() * 360)
    state.sat = 45 + Math.floor(Math.random() * 40)
    state.lit = 38 + Math.floor(Math.random() * 26)
  }

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault()
      generate()
    }
  })

  return html`<main class="pal">
    <header class="pal-bar">
      <nav class="pal-modes">
        ${MODES.map(
          (m) => html`
            <button
              class="${() =>
                `pal-mode${state.mode === m.id ? ' pal-mode--on' : ''}`}"
              @click="${() => {
                state.mode = m.id
              }}"
            >
              ${m.label}
            </button>
          `
        )}
      </nav>
      <button class="pal-gen" @click="${generate}">
        Generate <kbd>space</kbd>
      </button>
    </header>
    <section class="pal-strip">
      ${() =>
        colors().map((c, i) => Swatch({ hex: c.hex, fg: c.fg }).key(i))}
    </section>
  </main>`
})
