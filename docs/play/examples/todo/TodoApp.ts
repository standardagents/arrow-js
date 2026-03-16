import { component, html, reactive } from '@arrow-js/core'
import { TodoItem } from './TodoItem'

type Todo = { id: number; text: string; done: boolean }

export const TodoApp = component(() => {
  const state = reactive({
    todos: [
      { id: 1, text: 'Learn reactive state with reactive()', done: true },
      { id: 2, text: 'Build a component with component()', done: true },
      { id: 3, text: 'Render a keyed list with .key()', done: false },
      { id: 4, text: 'Try editing this code live', done: false },
    ] as Todo[],
    input: '',
    filter: 'all' as 'all' | 'active' | 'done',
    nextId: 5,
  })

  const filtered = () => {
    if (state.filter === 'active') return state.todos.filter((t) => !t.done)
    if (state.filter === 'done') return state.todos.filter((t) => t.done)
    return state.todos
  }

  const remaining = () => state.todos.filter((t) => !t.done).length

  const addTodo = () => {
    const text = state.input.trim()
    if (!text) return
    state.todos.push({ id: state.nextId, text, done: false })
    state.nextId++
    state.input = ''
  }

  const removeTodo = (id: number) => {
    const index = state.todos.findIndex((t) => t.id === id)
    if (index >= 0) state.todos.splice(index, 1)
  }

  const toggleTodo = (id: number) => {
    const todo = state.todos.find((t) => t.id === id)
    if (todo) todo.done = !todo.done
  }

  const clearDone = () => {
    state.todos = state.todos.filter((t) => !t.done)
  }

  const handleInput = (e: Event) => {
    state.input = (e.target as HTMLInputElement).value
  }

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') addTodo()
  }

  const filters = ['all', 'active', 'done'] as const

  return html`<main class="todo">
    <header class="todo-header">
      <h1>Todos</h1>
      <span class="todo-count">${() => remaining()} remaining</span>
    </header>

    <div class="todo-input-row">
      <input
        class="todo-input"
        type="text"
        placeholder="What needs to be done?"
        @input="${handleInput}"
        @keydown="${handleKeydown}"
      />
      <button class="todo-add" @click="${addTodo}">Add</button>
    </div>

    <nav class="todo-filters">
      ${filters.map(
        (f) => html`<button
          class="todo-filter"
          data-active="${() => String(state.filter === f)}"
          @click="${() => { state.filter = f }}"
        >${f}</button>`
      )}
    </nav>

    <ul class="todo-list">
      ${() =>
        filtered().map((todo) =>
          TodoItem({
            done: todo.done,
            id: todo.id,
            text: todo.text,
            onRemove: removeTodo,
            onToggle: toggleTodo,
          }).key(todo.id)
        )}
    </ul>

    <footer class="todo-footer">
      <span>${() => remaining()} ${() => remaining() === 1 ? 'item' : 'items'} left</span>
      <button class="todo-clear" @click="${clearDone}">Clear done</button>
    </footer>
  </main>`
})
