import { component, html, reactive } from '@arrow-js/core'
import { CounterPanel } from './CounterPanel'

const state = reactive({
  name: 'Arrow',
  count: 0,
})

export const App = component(() => {
  const handleInput = (e: Event) => {
    state.name = (e.target as HTMLInputElement).value
  }

  return html`<main class="app">
    <header class="hero">
      <p class="eyebrow">Arrow Playground</p>
      <h1>Hello, <span class="accent">${() => state.name || 'World'}</span></h1>
      <p class="subtitle">
        Type below and watch reactive state update everywhere at once.
      </p>
      <input
        class="name-input"
        type="text"
        placeholder="Your name"
        @input="${handleInput}"
      />
    </header>

    ${CounterPanel({ model: state })}

    <footer class="info">
      <p>
        <strong>${() => state.name || 'World'}</strong> has clicked
        <strong>${() => state.count}</strong> times.
        Edit any file to experiment.
      </p>
    </footer>
  </main>`
})
