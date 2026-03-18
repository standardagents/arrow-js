import { component, html, reactive, type ArrowTemplate, type Props } from '@arrow-js/core'

type CopyPageMenuProps = Record<PropertyKey, unknown> & {
  markdownPath: string
}

export const CopyPageMenu = component<CopyPageMenuProps, ArrowTemplate>((props: Props<CopyPageMenuProps>) => {
  const state = reactive({ open: false, copied: false })
  const dropdownId = `copy-menu-${props.markdownPath.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()}`

  let copyTimer = 0

  const markdownUrl = () =>
    typeof window !== 'undefined'
      ? `${window.location.origin}${props.markdownPath}`
      : props.markdownPath

  const copyPage = async () => {
    try {
      const res = await fetch(props.markdownPath)
      const text = await res.text()
      await navigator.clipboard.writeText(text)
      state.copied = true
      state.open = false
      window.clearTimeout(copyTimer)
      copyTimer = window.setTimeout(() => {
        state.copied = false
      }, 2000)
    } catch {
      /* clipboard may be blocked */
    }
  }

  const toggle = (e: Event) => {
    e.stopPropagation()
    state.open = !state.open
  }

  const close = () => {
    state.open = false
  }

  if (typeof window !== 'undefined') {
    document.addEventListener('click', (e) => {
      if (state.open && !(e.target as Element).closest('.copy-menu')) {
        close()
      }
    })
  }

  const chatgptUrl = () => {
    const prompt = `Read this documentation and answer my questions: ${markdownUrl()}`
    return `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`
  }

  const claudeUrl = () => {
    const prompt = `Read this documentation and answer my questions: ${markdownUrl()}`
    return `https://claude.ai/new?q=${encodeURIComponent(prompt)}`
  }

  return html`<div class="copy-menu">
    <div class="copy-menu-trigger">
      <button class="copy-menu-btn" @click="${copyPage}">
        <span class="copy-menu-icon copy-menu-icon--copy"></span>
        ${() => (state.copied ? 'Copied!' : 'Copy page')}
      </button>
      <button
        class="copy-menu-toggle"
        type="button"
        aria-label="${() => state.open ? 'Close copy page menu' : 'Open copy page menu'}"
        aria-haspopup="menu"
        aria-controls="${dropdownId}"
        aria-expanded="${() => state.open ? 'true' : 'false'}"
        @click="${toggle}"
      >
        <span class="copy-menu-icon copy-menu-icon--chevron"></span>
      </button>
    </div>
    <div
      id="${dropdownId}"
      class="copy-menu-dropdown"
      data-open="${() => (state.open ? '' : false)}"
    >
      <button class="copy-menu-item" @click="${copyPage}">
        <span class="copy-menu-icon copy-menu-icon--copy"></span>
        <div>
          <div class="copy-menu-item-title">Copy page</div>
          <div class="copy-menu-item-desc">Copy page as Markdown for LLMs</div>
        </div>
      </button>
      <a class="copy-menu-item" href="${props.markdownPath}" target="_blank" rel="noopener" @click="${close}">
        <span class="copy-menu-icon copy-menu-icon--markdown"></span>
        <div>
          <div class="copy-menu-item-title">View as Markdown <span class="copy-menu-external">&nearr;</span></div>
          <div class="copy-menu-item-desc">View this page as plain text</div>
        </div>
      </a>
      <a class="copy-menu-item" href="${chatgptUrl}" target="_blank" rel="noopener" @click="${close}">
        <span class="copy-menu-icon copy-menu-icon--chatgpt"></span>
        <div>
          <div class="copy-menu-item-title">Open in ChatGPT <span class="copy-menu-external">&nearr;</span></div>
          <div class="copy-menu-item-desc">Ask questions about this page</div>
        </div>
      </a>
      <a class="copy-menu-item" href="${claudeUrl}" target="_blank" rel="noopener" @click="${close}">
        <span class="copy-menu-icon copy-menu-icon--claude"></span>
        <div>
          <div class="copy-menu-item-title">Open in Claude <span class="copy-menu-external">&nearr;</span></div>
          <div class="copy-menu-item-desc">Ask questions about this page</div>
        </div>
      </a>
    </div>
  </div>`
})

export function CopyPageMenuIsland(props: CopyPageMenuProps) {
  return html`
    <div
      data-island="copy-page-menu"
      data-markdown-path="${props.markdownPath}"
    >
      ${CopyPageMenu(props)}
    </div>
  `
}
