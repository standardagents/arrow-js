import { component, html } from '@arrow-js/core'

export const TodoItem = component((props: {
  done: boolean
  id: number
  text: string
  onRemove: (id: number) => void
  onToggle: (id: number) => void
}) =>
  html`<li class="todo-item" data-done="${() => String(props.done)}">
    <button
      class="todo-check"
      @click="${() => props.onToggle(props.id)}"
    >
      ${() => props.done ? '\u2713' : ''}
    </button>
    <span class="todo-text">${() => props.text}</span>
    <button
      class="todo-remove"
      @click="${() => props.onRemove(props.id)}"
    >\u00d7</button>
  </li>`
)
