import { html } from '@arrow-js/core'
import { sandbox } from '@arrow-js/sandbox'
import { widgetSource } from './widget'

export function App() {
  return html`<main class="page">
    <div class="card">
      <header class="header">
        <h1 class="title">Sandbox Isolation</h1>
        <p class="subtitle">
          This widget runs inside a WASM virtual machine. The host page
          owns the real DOM — sandboxed code communicates only through
          serialized messages.
        </p>
      </header>
      <div class="frame">
        ${sandbox({ source: widgetSource, shadowDOM: true })}
      </div>
    </div>
  </main>`
}
