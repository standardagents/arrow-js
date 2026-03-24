import { component, html, reactive } from '@arrow-js/core'

export const CounterCard = component(() => {
  const state = reactive({ count: 0 })

  return html`<div class="card">
    <p class="section__label">Reactive state</p>
    <p class="card__copy">
      Call <code>reactive()</code> to make an object observable.
      Templates re-render only where data is read.
    </p>
    <div class="counter">
      <button class="btn" @click="${() => state.count--}">-</button>
      <span class="counter__value">${() => state.count}</span>
      <button class="btn" @click="${() => state.count++}">+</button>
    </div>
  </div>`
})
