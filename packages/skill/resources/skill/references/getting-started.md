# Arrow Getting Started

Use this reference for scaffolded Arrow apps and project structure.

## Scaffold

The Vite 8 scaffold command is:

```sh
pnpm create arrow-js@latest arrow-app
```

The scaffolded app includes:

- `src/page.ts` with `routeToPage(url)`
- `src/entry-server.ts` for SSR
- `src/entry-client.ts` for hydration
- `server.mjs` for local dev/preview

## Mental model

- `routeToPage(url)` resolves the route to `{ title, description, view, status }`.
- `renderPage(url)` calls `routeToPage(url)` and then `renderToString(page.view)`.
- The client reads the SSR payload with `readPayload()` and hydrates `routeToPage(window.location.pathname).view`.

## Package split

- `@arrow-js/core`: `reactive`, `html`, `component`, `watch`
- `@arrow-js/framework`: `render`, `boundary`, async component runtime
- `@arrow-js/ssr`: `renderToString`, `serializePayload`
- `@arrow-js/hydrate`: `hydrate`, `readPayload`
