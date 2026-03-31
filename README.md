<p align="center">
  <img src="docs/public/arrowjs-logo.png" alt="ArrowJS" width="360" />
</p>

![test badge](https://github.com/standardagents/arrow-js/actions/workflows/tests.yml/badge.svg)
![size badge](https://img.shields.io/endpoint?url=https%3A%2F%2Farrow-js.com%2Fbadges%2Fcore-size.json)
[![npm version](https://badge.fury.io/js/@arrow-js%2Fcore.svg)](https://badge.fury.io/js/@arrow-js%2Fcore)

## The UI framework for coding agents

ArrowJS is a tiny, blazing-fast, type-safe reactive UI runtime built around platform primitives that coding agents deeply understand: JavaScript modules, template literals, and the DOM.

Use `@arrow-js/core` when you want direct reactive DOM updates with minimal API surface. Add `@arrow-js/framework`, `@arrow-js/ssr`, and `@arrow-js/hydrate` when you need async components, server-side rendering, and client-side hydration on top of the same component model.

[Documentation](https://arrow-js.com) · [API Reference](https://arrow-js.com/api) · [Playground](https://arrow-js.com/play/) · [Discord](https://discord.gg/fBy7csvmAt)

## Core Package

- `@arrow-js/core`: reactive state, tagged-template rendering, components, `pick()` / `props()`, and `nextTick()`

## Framework Packages
- `@arrow-js/framework`: async component runtime, `boundary()`, `render()`, `toTemplate()`, and document rendering helpers
- `@arrow-js/ssr`: `renderToString()` and `serializePayload()` for server output
- `@arrow-js/hydrate`: `hydrate()` and `readPayload()` for adopting SSR output in the browser
- `@arrow-js/sandbox`: QuickJS/WASM-backed sandbox runtime for executing Arrow code off the host `window` realm while rendering into the real DOM
- `@arrow-js/vite-plugin-arrow`: Vite integration package included in the monorepo

## Install

Scaffold a complete Vite 8 Arrow app with SSR, hydration, and the full framework stack:

```sh
pnpm create arrow-js@latest arrow-app
```

Agent skill: Equip your preferred coding agent to add Arrow to an existing project:

```sh
npx @arrow-js/skill
```

Core-only:

```sh
npm install @arrow-js/core
```

Full SSR + hydration stack:

```sh
pnpm add @arrow-js/core @arrow-js/framework @arrow-js/ssr @arrow-js/hydrate
```

No build step is required for the core runtime. You can also import it directly in the browser:

```html
<script type="module">
  import { html, reactive } from 'https://esm.sh/@arrow-js/core'
</script>
```

## Core Example

```ts
import { component, html, reactive } from '@arrow-js/core'

const Counter = component(() => {
  const state = reactive({ count: 0 })

  return html`<button @click="${() => state.count++}">
    Clicked ${() => state.count} times
  </button>`
})

html`${Counter()}`(document.body)
```

## Async Components, SSR, and Hydration

Async components use the same `component()` API, but they require the async runtime from `@arrow-js/framework`, `@arrow-js/ssr`, or `@arrow-js/hydrate` to be imported before rendering.

The current project structure keeps that layering explicit:

- `@arrow-js/core` stays DOM-first and framework-agnostic.
- `@arrow-js/framework` adds async render tracking and boundaries.
- `@arrow-js/ssr` renders HTML and serializes async payloads on the server.
- `@arrow-js/hydrate` adopts existing SSR HTML instead of replacing it on the client.

## Editor Support

Install the official [ArrowJS Syntax](https://marketplace.visualstudio.com/items?itemName=StandardAgents.arrowjs-syntax) extension for VSCode to get syntax highlighting and autocomplete inside `html` template literals.

## Community

- [Discord](https://discord.gg/fBy7csvmAt) — ask questions, share what you're building, and connect with other Arrow developers
- [GitHub Issues](https://github.com/standardagents/arrow-js/issues) — report bugs and request features
- Follow [@jpschroeder](https://x.com/intent/follow?screen_name=jpschroeder) on X for updates and releases

## Monorepo Development

- `pnpm dev`: run the docs app locally
- `pnpm test`: run Vitest
- `pnpm test:e2e`: run Playwright tests
- `pnpm typecheck`: run TypeScript across the workspace
