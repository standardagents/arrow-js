import { component, html, reactive } from '@arrow-js/core'
import { StrengthMeter } from './StrengthMeter'

const CHARS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*_+-=?',
}

function generate(
  length: number,
  lower: boolean,
  upper: boolean,
  digits: boolean,
  symbols: boolean
): string {
  let pool = ''
  if (lower) pool += CHARS.lower
  if (upper) pool += CHARS.upper
  if (digits) pool += CHARS.digits
  if (symbols) pool += CHARS.symbols
  if (!pool) pool = CHARS.lower

  let result = ''
  for (let i = 0; i < length; i++) {
    result += pool[Math.floor(Math.random() * pool.length)]
  }
  return result
}

function scoreStrength(
  length: number,
  lower: boolean,
  upper: boolean,
  digits: boolean,
  symbols: boolean
): number {
  let score = 0
  if (length >= 8) score++
  if (length >= 16) score++
  if (lower && upper) score++
  if (digits) score++
  if (symbols) score++
  return Math.min(score, 4)
}

function charClass(ch: string): string {
  if (/[0-9]/.test(ch)) return 'ch-num'
  if (/[^a-zA-Z0-9]/.test(ch)) return 'ch-sym'
  return ''
}

export const GeneratorApp = component(() => {
  const state = reactive({
    length: 20,
    lower: true,
    upper: true,
    digits: true,
    symbols: false,
    password: '',
    copied: false,
  })

  const regenerate = () => {
    state.password = generate(
      state.length,
      state.lower,
      state.upper,
      state.digits,
      state.symbols
    )
    state.copied = false
  }

  regenerate()

  const strength = () =>
    scoreStrength(
      state.length,
      state.lower,
      state.upper,
      state.digits,
      state.symbols
    )

  const copy = () => {
    navigator.clipboard.writeText(state.password)
    state.copied = true
    setTimeout(() => {
      state.copied = false
    }, 1500)
  }

  const handleLengthChange = (e: Event) => {
    state.length = Number((e.target as HTMLInputElement).value)
    regenerate()
  }

  return html`<main class="gen">
    <section class="gen-display">
      <code class="gen-password">${() =>
        state.password
          .split('')
          .map((ch) => html`<span class="${charClass(ch)}">${ch}</span>`)
      }</code>
      <div class="gen-actions">
        <button class="gen-copy" @click="${copy}">
          ${() => (state.copied ? 'Copied!' : 'Copy')}
        </button>
        <button class="gen-new" @click="${regenerate}">Regenerate</button>
      </div>
    </section>

    ${StrengthMeter({ score: strength })}

    <section class="gen-options">
      <label class="gen-length">
        <span>Length: <strong>${() => state.length}</strong></span>
        <input
          type="range"
          min="4"
          max="64"
          class="gen-range"
          @input="${handleLengthChange}"
        />
      </label>

      <div class="gen-toggles">
        <label class="gen-sw">
          <input type="checkbox" checked @change="${() => { state.lower = !state.lower; regenerate() }}" />
          <span class="gen-sw-track"></span>
          <span>Lowercase</span>
        </label>
        <label class="gen-sw">
          <input type="checkbox" checked @change="${() => { state.upper = !state.upper; regenerate() }}" />
          <span class="gen-sw-track"></span>
          <span>Uppercase</span>
        </label>
        <label class="gen-sw">
          <input type="checkbox" checked @change="${() => { state.digits = !state.digits; regenerate() }}" />
          <span class="gen-sw-track"></span>
          <span>Numbers</span>
        </label>
        <label class="gen-sw">
          <input type="checkbox" @change="${() => { state.symbols = !state.symbols; regenerate() }}" />
          <span class="gen-sw-track"></span>
          <span>Symbols</span>
        </label>
      </div>
    </section>
  </main>`
})
