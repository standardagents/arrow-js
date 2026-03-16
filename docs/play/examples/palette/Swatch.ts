import { component, html, reactive } from '@arrow-js/core'

export const Swatch = component((props: { hex: string; fg: string }) => {
  const state = reactive({ copied: false })

  const copy = () => {
    navigator.clipboard.writeText(props.hex)
    state.copied = true
    setTimeout(() => {
      state.copied = false
    }, 1200)
  }

  return html`<button
    class="pal-swatch"
    style="${() => `background:${props.hex}; color:${props.fg}`}"
    @click="${copy}"
  >
    <span class="pal-hex">${() => (state.copied ? 'Copied!' : props.hex)}</span>
  </button>`
})
