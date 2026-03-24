import { component, html } from '@arrow-js/core'
import type { Props } from '@arrow-js/core'

type NotFoundProps = Record<PropertyKey, unknown> & {
  path: string
}

export const NotFound = component((props: Props<NotFoundProps>) =>
  html`<main class="not-found">
    <p class="section__label">404</p>
    <h1>Nothing lives at ${() => props.path}</h1>
    <p>
      Edit <code>src/App.ts</code> to add routes or wire this into a
      larger app.
    </p>
    <a class="btn btn--accent" href="/">Back home</a>
  </main>`
)
