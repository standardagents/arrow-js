# Arrow.js Docs — Agent Guide

This is the Arrow.js documentation site, built with Arrow's own meta-framework
on Vite 8. It must be a model citizen of Arrow.js usage: proper components, SSR,
hydration, and reactive patterns throughout.

## Project structure

```
docs/
  server.mjs              Vite 8 custom app server (dev + prod)
  index.html              HTML shell with <!--app-head/html/payload--> slots
  vite.config.ts          Vite 8 config with SSR environment
  src/
    entry-server.ts       SSR entry: renderToString → HTML + payload
    entry-client.ts       Client entry: readPayload → hydrate
    app.ts                Route dispatch: URL → page factory
    layout.ts             Shared layout shell
    styles/main.css       Tailwind 4 + custom theme tokens
    components/           Shared UI components (Header, Footer, etc.)
    pages/
      home/               Landing page sections
      docs/               Documentation page + content sections
```

## Package imports

Always import from the published package names, never from relative source paths:

```ts
// Core runtime (~3KB) — always available on client AND server
import { html, reactive, watch, component, pick, props } from '@arrow-js/core'
import type { ArrowTemplate, Props, Reactive, Computed } from '@arrow-js/core'

// Framework layer — async components, boundaries, render context
import { boundary, render, toTemplate, renderDocument } from '@arrow-js/framework'

// SSR — server only
import { renderToString, serializePayload } from '@arrow-js/ssr'

// Hydration — client only
import { hydrate, readPayload } from '@arrow-js/hydrate'
```

Short aliases exist but prefer the full names for readability:
- `html` / `t` — template tag
- `reactive` / `r` — reactive proxy
- `watch` / `w` — watcher
- `component` / `c` — component wrapper

---

## Core API reference

### `html` — Tagged template literal

Creates an `ArrowTemplate` — a function that mounts DOM to a parent node.

```ts
import { html } from '@arrow-js/core'

// Static template — renders once, no reactivity overhead
const greeting = html`<h1>Hello, world</h1>`

// Mount to DOM:
greeting(document.getElementById('app'))

// Or get a DocumentFragment (no parent):
const fragment = greeting()
```

**Expressions in templates:**

- **Static** (render once): any non-function value
  ```ts
  html`<p>${someString}</p>`
  ```
- **Reactive** (live updates): wrap in an arrow function
  ```ts
  html`<p>${() => data.count}</p>`
  ```
- **Templates/components**: nest directly
  ```ts
  html`<div>${otherTemplate}</div>`
  html`<div>${MyComponent({ label: 'hi' })}</div>`
  ```
- **Lists**: return an array of templates
  ```ts
  html`<ul>${() => items.map(i => html`<li>${i.name}</li>`)}</ul>`
  ```
- **Events**: `@eventName` attribute
  ```ts
  html`<button @click="${(e) => handleClick(e)}">Click</button>`
  ```
- **Attributes**: static or reactive
  ```ts
  html`<div class="${staticClass}"></div>`
  html`<div class="${() => data.active ? 'on' : 'off'}"></div>`
  ```
  Returning `false` from an attribute expression removes the attribute.
- **IDL properties**: prefix with `.`
  ```ts
  html`<input .value="${() => data.text}" />`
  ```

**Key rule**: expressions are *static by default*. Only function expressions
(`() => ...`) create reactive bindings. This keeps the static path cheap.

### `reactive` — Observable state

```ts
import { reactive } from '@arrow-js/core'

// Plain object → reactive proxy
const data = reactive({ count: 0, items: [] })

data.count++               // triggers observers
data.items.push('hello')   // array mutations trigger parent observers

// Computed value → reactive(() => expression)
const totals = reactive({
  total: reactive(() => data.count * 10)
})
totals.total  // reads like a normal value, auto-updates

// Manual subscription (prefer watch() or template expressions instead)
data.$on('count', (newVal, oldVal) => { ... })
data.$off('count', callback)
```

**Rules:**
- Only objects and arrays can be reactive. Primitives cannot.
- Nested objects are lazily made reactive on first access.
- `reactive()` on an already-reactive object returns the same proxy.
- Computed values are created with `reactive(() => expr)` and auto-update.

### `watch` — Side effects

```ts
import { reactive, watch } from '@arrow-js/core'

const data = reactive({ price: 25, quantity: 10 })

// Single-effect form: runs immediately, re-runs when tracked reads change
watch(() => {
  console.log(`Total: ${data.price * data.quantity}`)
})

// Getter + effect form: getter tracks, effect receives result
watch(
  () => data.price * data.quantity,
  (total) => console.log(`Total: ${total}`)
)
```

**Rules:**
- Dependencies are auto-discovered from reactive reads inside the watcher.
- Dependencies that are no longer read on subsequent runs are dropped.
- Returns `[returnValue, stop]` — call `stop()` to unsubscribe.

### `component` — Stable component instances

This is the key abstraction. Components wrap a factory function to provide
**stable local state** across parent re-renders.

```ts
import { component, html, reactive } from '@arrow-js/core'
import type { Props } from '@arrow-js/core'

// Define a component:
const Counter = component((props: Props<{ count: number }>) => {
  // This factory runs ONCE per render slot.
  // Local state survives parent re-renders.
  const local = reactive({ clicks: 0 })

  return html`<button @click="${() => local.clicks++}">
    Root count ${() => props.count} | Local clicks ${() => local.clicks}
  </button>`
})

// Use in a template:
const state = reactive({ count: 1 })
html`${Counter(state)}`
```

**Critical rules:**
1. The factory function runs **once per slot**, not on every update.
2. **Never destructure props** at the top of the factory — read them lazily
   inside reactive expressions so updates flow through:
   ```ts
   // WRONG — captures value once, never updates:
   const Counter = component(({ count }) => {
     return html`<p>${count}</p>`
   })

   // RIGHT — reads lazily, stays reactive:
   const Counter = component((props) => {
     return html`<p>${() => props.count}</p>`
   })
   ```
3. Use `pick(source, ...keys)` or `props(source, ...keys)` to narrow a large
   reactive object down to the keys a component needs:
   ```ts
   import { pick } from '@arrow-js/core'

   const state = reactive({ count: 1, theme: 'dark', locale: 'en' })
   html`${Counter(pick(state, 'count'))}`
   ```
4. Use `.key()` when rendering components in keyed lists:
   ```ts
   html`${() => items.map(item =>
     ItemCard(item).key(item.id)
   )}`
   ```
5. Factory must return an `ArrowTemplate` (the result of `html\`...\``).

### Async components

When the Arrow framework runtime is loaded (`@arrow-js/framework`,
`@arrow-js/ssr`, or `@arrow-js/hydrate`), `component()` also accepts async
factories:

```ts
import { component, html } from '@arrow-js/core'
import { boundary } from '@arrow-js/framework'

const UserName = component(async ({ id }: { id: string }) => {
  const user = await fetch(`/api/users/${id}`).then(r => r.json())
  return user.name  // resolved value rendered directly by default
})

// Always wrap async components in a boundary for SSR/hydration recovery:
html`${boundary(UserName({ id: '42' }), { idPrefix: 'user' })}`
```

**Options bag (all optional):**
```ts
component(asyncFactory, {
  fallback: html`<span>Loading...</span>`,         // shown while pending
  render: (value, props) => html`<p>${value}</p>`,  // custom render
  onError: (error, props) => html`<p>Error</p>`,    // error handler
  serialize: (value, props) => value.id,             // custom SSR snapshot
  deserialize: (snapshot, props) => ({ id: snapshot }), // restore on client
  idPrefix: 'user',                                  // readable SSR ids
})
```

**Rules:**
- SSR waits for all async components to resolve before returning HTML.
- JSON-safe results are auto-serialized into the hydration payload.
- On hydration, matching components resume from serialized data (no refetch).
- Always use `boundary()` around async component output.

---

## SSR + Hydration architecture

This site uses a standard Arrow SSR flow:

### Server (`entry-server.ts`)

```ts
import { renderToString, serializePayload } from '@arrow-js/ssr'
import { createPage } from './app'

export async function renderPage(url: string) {
  const page = createPage(url)
  const result = await renderToString(page.view)

  return {
    html: result.html,
    head: `<title>${page.title}</title>`,
    payloadScript: serializePayload({
      ...result.payload,
      path: url,
    }),
    status: 200,
  }
}
```

### Client (`entry-client.ts`)

```ts
import { hydrate, readPayload } from '@arrow-js/hydrate'
import { createPage } from './app'

const payload = readPayload()
const root = document.getElementById('app')!

await hydrate(root, createPage(window.location.pathname).view, payload)
```

### How it works

1. Server calls `renderToString(view)` → returns `{ html, payload }`.
2. Payload is serialized as a `<script type="application/json">` tag.
3. Server injects HTML + payload into `index.html` template slots.
4. Client reads payload with `readPayload()`, then calls `hydrate()`.
5. Hydration reconciles the existing DOM with the client template.
6. If a subtree mismatches, `boundary()` markers enable targeted recovery.

### `boundary(view, options)` — Hydration boundaries

Wrap subtrees that need independent recovery during hydration:

```ts
import { boundary } from '@arrow-js/framework'

html`
  <main>
    ${boundary(SomeComponent(), { idPrefix: 'sidebar' })}
    ${boundary(OtherComponent(), { idPrefix: 'content' })}
  </main>
`
```

This inserts `<template data-arrow-boundary-start/end>` markers so the
hydrator can repair individual regions instead of replacing the entire root.

---

## When to use `component()` vs plain functions

| Pattern | Use when |
|---------|----------|
| Plain function returning `html\`...\`` | Static or compositional content with no local state. Pages, sections, layout wrappers. |
| `component(factory)` | The UI has **local state** that must survive parent re-renders, or receives **reactive props** that update over time. Interactive widgets, toggles, forms. |
| `component(async factory)` | The UI needs to **fetch data** or perform async work. Combined with `boundary()` for SSR. |

### Plain function example (static content)

```ts
// This is fine for content sections — no local state needed
export function Introduction() {
  return html`
    <section>
      <h2>What is Arrow?</h2>
      <p>Arrow is a small reactive UI runtime...</p>
    </section>
  `
}
```

### Component example (interactive widget)

```ts
// This needs component() because it has local state
const ThemeToggle = component(() => {
  const state = reactive({ theme: 'dark' })

  return html`
    <button @click="${() => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark'
      document.documentElement.setAttribute('data-theme', state.theme)
    }}">
      ${() => state.theme === 'dark' ? 'Light mode' : 'Dark mode'}
    </button>
  `
})
```

---

## Template patterns for this project

### Tailwind classes in templates

Arrow templates are HTML strings — Tailwind utility classes work directly:

```ts
html`<div class="flex items-center gap-4 px-6 py-3 bg-white dark:bg-zinc-950">
  <span class="text-sm font-medium text-zinc-600 dark:text-zinc-400">
    ${() => props.label}
  </span>
</div>`
```

### Conditional rendering

```ts
// Reactive conditional — use a function expression
html`${() => data.isOpen
  ? html`<div class="dropdown">...</div>`
  : ''
}`

// Static conditional — no function wrapper needed
html`${isDocsPage ? Navigation() : ''}`
```

### List rendering

```ts
html`<ul>
  ${() => data.items.map(item =>
    html`<li>${item.name}</li>`.key(item.id)
  )}
</ul>`
```

### Nesting components

```ts
html`
  <div>
    ${Header()}
    <main>${content}</main>
    ${Footer()}
  </div>
`
```

Components and templates compose by nesting — no special slot or children API.

---

## File conventions

- **TypeScript** throughout (`*.ts`). The project uses strict mode.
- Components that hold local state: use `component()`, name as `PascalCase` const.
- Static view functions: plain functions, `PascalCase` export name.
- One component/function per file when it's substantial; group small related ones.
- Import `html`, `reactive`, `watch`, `component` from `@arrow-js/core`.
- Import `boundary` from `@arrow-js/framework` when wrapping async components.

## Styling

- **Tailwind CSS 4** via `@tailwindcss/vite` plugin.
- CSS lives in `src/styles/main.css` — imports Tailwind, defines theme tokens.
- Dark mode: `@custom-variant dark` keyed to `data-theme="dark"` on `<html>`.
- Brand color: `arrow-500` (#ffb000) and its scale (`arrow-50` through `arrow-950`).
- Fonts: Inter (sans), JetBrains Mono (mono) — loaded from Google Fonts.
- Use Tailwind utilities in templates. Avoid custom CSS unless truly shared
  (code blocks, callouts, nav links).

## Development

```sh
pnpm dev               # Start dev server on http://127.0.0.1:4174
pnpm build             # Build client + SSR bundles
pnpm preview           # Preview production build
```

## Common mistakes to avoid

1. **Passing HTML strings as template expressions:**
   ```ts
   // Bug — renders as escaped text, not DOM:
   const icon = `<svg>...</svg>`
   html`<div>${icon}</div>`

   // Fix — use an html template so Arrow renders it as DOM:
   function Icon() {
     return html`<svg>...</svg>`
   }
   html`<div>${Icon()}</div>`
   ```

2. **Forgetting the function wrapper for reactive expressions:**
   ```ts
   // Bug — renders once, never updates:
   html`<p>${data.count}</p>`
   // Fix:
   html`<p>${() => data.count}</p>`
   ```

3. **Destructuring component props:**
   ```ts
   // Bug — captures values once:
   const Foo = component(({ x, y }) => html`<p>${x}, ${y}</p>`)
   // Fix — read props lazily:
   const Foo = component((props) => html`<p>${() => props.x}, ${() => props.y}</p>`)
   ```

4. **Using `component()` when a plain function suffices:**
   Static content sections don't need component wrappers. Only use `component()`
   when local state or stable instance identity matters.

5. **Forgetting `boundary()` around async components:**
   Without a boundary, hydration mismatches in async regions force a full
   root replacement instead of targeted repair.

6. **Using browser APIs during SSR:**
   `localStorage`, `window`, `document.querySelector` etc. don't exist during
   `renderToString()`. Guard with runtime checks or move to client-only code
   paths (e.g., inside `entry-client.ts` or behind `typeof window !== 'undefined'`).

7. **Not calling `.key()` on list-rendered components:**
   Without keys, list patches reuse slots by position. If items reorder,
   local component state will attach to the wrong item.
