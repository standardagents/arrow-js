# Arrow Examples

## Counter

```ts
import { html, reactive } from '@arrow-js/core'

const state = reactive({ count: 0 })

html`
  <button @click="${() => state.count++}">
    Clicked ${() => state.count} times
  </button>
`
```

## Component composition

```ts
import { component, html, reactive } from '@arrow-js/core'

const Counter = component((props) =>
  html`<strong>${() => props.count}</strong>`
)

const state = reactive({ count: 1 })

html`<p>Current count: ${Counter(state)}</p>`
```

## Scaffolded routing

```ts
import { html } from '@arrow-js/core'

export function routeToPage(url: string) {
  if (url === '/about') {
    return {
      title: 'About',
      view: html`<main><h1>About</h1></main>`,
      status: 200,
    }
  }

  return {
    title: 'Home',
    view: html`<main><h1>Home</h1></main>`,
    status: 200,
  }
}
```

## SSR + hydration

```ts
import { renderToString, serializePayload } from '@arrow-js/ssr'
import { hydrate, readPayload } from '@arrow-js/hydrate'
import { routeToPage } from './page'

const page = routeToPage(url)
const ssr = await renderToString(page.view)
const payloadScript = serializePayload(ssr.payload)

await hydrate(
  document.getElementById('app')!,
  routeToPage(window.location.pathname).view,
  readPayload()
)
```
