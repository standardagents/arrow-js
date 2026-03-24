import { component, html, reactive } from '@arrow-js/core'

interface Todo {
  id: number
  text: string
}

export const TodoCard = component(() => {
  const state = reactive({
    todos: [] as Todo[],
    draft: '',
    nextId: 1,
  })

  function add() {
    const text = state.draft.trim()
    if (!text) return
    state.todos.push({ id: state.nextId++, text })
    state.draft = ''
  }

  function remove(id: number) {
    const i = state.todos.findIndex((t) => t.id === id)
    if (i !== -1) state.todos.splice(i, 1)
  }

  return html`<div class="card">
    <p class="section__label">Keyed lists</p>
    <p class="card__copy">
      Render arrays with <code>.key()</code> so Arrow can patch the
      DOM efficiently when items change.
    </p>
    <div class="todo-input">
      <input
        placeholder="Add a todo..."
        .value="${() => state.draft}"
        @input="${(e: Event) => { state.draft = (e.target as HTMLInputElement).value }}"
        @keydown="${(e: Event) => { if ((e as KeyboardEvent).key === 'Enter') add() }}"
      />
      <button class="btn btn--accent" @click="${add}">Add</button>
    </div>
    ${() =>
      state.todos.length
        ? html`<ul class="todo-list">
            ${() =>
              state.todos.map(
                (todo) =>
                  html`<li class="todo-item">
                    <span>${todo.text}</span>
                    <button @click="${() => remove(todo.id)}">&times;</button>
                  </li>`.key(todo.id)
              )}
          </ul>`
        : html`<p class="todo-empty">No todos yet. Add one above.</p>`}
  </div>`
})
