import { component, html, reactive } from '@arrow-js/core'

export const CounterPanel = component((props: { model: { count: number } }) => {
  const local = reactive({ presses: 0 })

  const press = (delta: number) => {
    props.model.count += delta
    local.presses++
  }

  const reset = () => {
    props.model.count = 0
  }

  return html`<section class="panel">
    <div class="panel-stats">
      <div class="panel-stat">
        <span class="panel-label">Shared count</span>
        <span class="panel-value">${() => props.model.count}</span>
      </div>
      <div class="panel-stat">
        <span class="panel-label">Local presses</span>
        <span class="panel-value panel-value--local">${() => local.presses}</span>
      </div>
    </div>
    <div class="panel-actions">
      <button class="btn" @click="${() => press(-1)}">−</button>
      <button class="btn" @click="${() => press(1)}">+</button>
      <button class="btn btn--ghost" @click="${reset}">Reset</button>
    </div>
  </section>`
})
