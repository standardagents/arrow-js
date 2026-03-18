import { component, html, reactive } from '@arrow-js/core'

function fallbackCopyText(text: string) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.left = '-9999px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  textarea.setSelectionRange(0, text.length)

  let copied = false
  try {
    copied = document.execCommand('copy')
  } catch {
    copied = false
  }

  textarea.remove()
  return copied
}

async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall back to a user-gesture copy path when the async clipboard API is unavailable.
  }

  return fallbackCopyText(text)
}

function getBurstOrigin(event: MouseEvent) {
  const target =
    event.target instanceof Element
      ? event.target.closest('.cli-command')
      : null

  if (target instanceof HTMLElement) {
    const rect = target.getBoundingClientRect()
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2 - 8,
      rect: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      },
    }
  }

  return {
    x: event.clientX,
    y: event.clientY,
    rect: null,
  }
}

export const CliCommand = component(() => {
  const state = reactive({ copied: false })
  let timer: ReturnType<typeof setTimeout>
  const command = 'pnpm create arrow-js@latest arrow-app'

  async function copy(event: MouseEvent) {
    const copied = await copyText(command)

    if (!copied) {
      return
    }

    const origin = getBurstOrigin(event)
    document.dispatchEvent(
      new CustomEvent('arrow:copied-burst', {
        detail: {
          count: 25,
          text: 'copied!',
          x: origin.x,
          y: origin.y,
          rect: origin.rect,
        },
      })
    )

    state.copied = true
    clearTimeout(timer)
    timer = setTimeout(() => {
      state.copied = false
    }, 2000)
  }

  return html`
    <button
      data-rain-collider
      @click="${copy}"
      class="cli-command"
      aria-label="npx @arrow-js/skill. Copy install command"
    >
      <span class="cli-prompt">$</span>
      <code class="cli-text">
        <span class="cli-kw">pnpm</span> create arrow-js@latest arrow-app
      </code>
      <span
        class="${() => state.copied ? 'cli-copy cli-copy--done' : 'cli-copy'}"
      >${() =>
        state.copied
          ? html`<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3.5 8.5 6.5 11.5 12.5 5.5"></polyline></svg>`
          : html`<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5.5" y="5.5" width="8" height="9" rx="1.5"></rect><path d="M10.5 5.5V3a1.5 1.5 0 00-1.5-1.5H3A1.5 1.5 0 001.5 3v7A1.5 1.5 0 003 11.5h2.5"></path></svg>`
      }</span>
    </button>
  `
})

export function CliCommandIsland() {
  return html`<div data-island="cli-command">${CliCommand()}</div>`
}
