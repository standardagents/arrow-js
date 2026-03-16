export default {
  install: `pnpm create arrow-js@latest arrow-app
cd arrow-app
pnpm install
pnpm dev`,

  app: `import { component, html, reactive } from '@arrow-js/core'
import { boundary } from '@arrow-js/framework'

const WelcomeCard = component(async () => {
  const message = await Promise.resolve(
    'SSR waits for async work before the page is sent.'
  )

  return html\`<p>\${message}</p>\`
})

const state = reactive({ count: 2 })

export const App = component(() =>
  html\`<main>
    <h1>Arrow + Vite 8</h1>
    <button @click="\${() => state.count++}">
      Count \${() => state.count}
    </button>
    \${boundary(WelcomeCard())}
  </main>\`
)`,

  server: `import { renderToString, serializePayload } from '@arrow-js/ssr'

declare function createPage(url: string): {
  html?: string
  status: number
  title: string
  view: unknown
}

export async function renderPage(url: string) {
  const page = createPage(url)
  const result = await renderToString(page.view)

  return {
    status: page.status,
    head: \`<title>\${page.title}</title>\`,
    html: result.html,
    payloadScript: serializePayload(result.payload),
  }
}`,

  client: `import { hydrate, readPayload } from '@arrow-js/hydrate'

declare function createPage(url: string): {
  view: unknown
}

const payload = readPayload()
const root = document.getElementById(payload.rootId ?? 'app')

if (!root) {
  throw new Error('Missing #app root')
}

await hydrate(root, createPage(window.location.pathname).view, payload)`,

  asyncComponent: `import { component, html } from '@arrow-js/core'
import { boundary } from '@arrow-js/framework'

type User = {
  id: string
  name: string
}

const UserName = component(async ({ id }: { id: string }) => {
  const user = await fetch(\`/api/users/\${id}\`).then(
    (r) => r.json() as Promise<User>
  )

  return user.name
})

const UserCard = component((props: { id: string }) =>
  html\`<article>\${UserName(props)}</article>\`
)

export const view = html\`<main>
  \${boundary(UserCard({ id: '42' }))}
</main>\``,
}
