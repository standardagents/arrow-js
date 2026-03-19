# @arrow-js/sandbox

![ArrowJS](./arrow-logo.png)

ArrowJS sandbox executes user-authored Arrow JavaScript or TypeScript inside an async QuickJS/WASM VM while rendering through trusted host DOM code.

[Docs](https://arrow-js.com) · [API Reference](https://arrow-js.com/api) · [Playground](https://arrow-js.com/play/)

## What this package does

`@arrow-js/sandbox` lets you run untrusted Arrow code without executing that code in the page's `window` realm.

It provides:

- an async QuickJS/WASM runtime for user-authored modules
- AST-based preprocessing for implicit Arrow imports and template extraction
- a sandbox-specific `@arrow-js/core` shim
- a host DOM renderer and delegated event bridge

## Install

```sh
pnpm add @arrow-js/sandbox
```

## Basic usage

```ts
import { sandbox } from '@arrow-js/sandbox'

const view = sandbox({
  source: {
    'main.ts': `
      const state = reactive({ count: 0 })

      export default html\`<button @click="\${() => state.count++}">
        Clicked \${() => state.count}
      </button>\`
    `,
  },
})

view(document.getElementById('app')!)
```

Arrow identifiers such as `html`, `reactive`, `component`, `pick`, and `props` can be auto-injected when they are used as free identifiers. Explicit user imports are preserved.

## Multi-file modules

```ts
const view = sandbox({
  source: {
    'main.ts': `
      import App from './App.ts'

      export default App
    `,
    'state.ts': `
      import { reactive } from '@arrow-js/core'
      export const state = reactive({ count: 0 })
    `,
    'App.ts': `
      import { html } from '@arrow-js/core'
      import { state } from './state.ts'

      export default html\`
        <button @click="\${() => state.count++}">
          Clicked \${() => state.count}
        </button>
      \`
    `,
  },
})

view(mountPoint)
```

Supported virtual imports:

- relative imports between provided virtual files
- `.ts`, `.js`, `.mjs`, and `index.*` fallback resolution
- `@arrow-js/core`, resolved to the sandbox shim

Unsupported imports fail fast. There is no network fetch fallback.

## API

```ts
export interface SandboxProps {
  source: Record<string, string>
  shadowDOM?: boolean
  onError?: (error: Error | string) => void
  debug?: boolean
}

export interface SandboxEvents {
  output?: (payload: unknown) => void
}

export function sandbox(
  props: SandboxProps,
  events?: SandboxEvents
): ArrowTemplate
```

`sandbox()` returns an Arrow template. You can mount it directly, or compose it inside a larger Arrow template:

```ts
html`<section>${sandbox({ source })}</section>`
```

The rendered host element is always `<arrow-sandbox>`.

Source requirements:

- exactly one entry file: `main.ts` or `main.js`
- optional `main.css`, injected into the sandbox host root
- all other entries are virtual JS/TS/MJS modules

`shadowDOM` defaults to `true`. When enabled, the sandbox mounts into an open shadow root on `<arrow-sandbox>`. When disabled, it mounts into the element’s light DOM instead.

### Sandbox output bridge

The optional `events.output` callback receives values emitted from inside QuickJS through the global `output(payload)` function:

```ts
const view = sandbox(
  {
    source: {
      'main.ts': `
        output({ status: 'ready' })
        export default html\`<div>Sandbox Ready</div>\`
      `,
    },
  },
  {
    output(payload) {
      console.log(payload)
    },
  }
)
```

`output(payload)` accepts one payload value. The payload is serialized to plain data before it crosses from the VM into the host.

## Security model

- User-authored logic runs inside QuickJS/WASM.
- The host page mutates the real DOM through trusted renderer code only.
- Event listeners on the real DOM forward sanitized payloads back to the VM.
- The sandbox does not receive direct access to `window`, `document`, DOM nodes, storage, or arbitrary browser APIs.
- `html` templates are preprocessed into descriptors. The host never evaluates user expressions.
- DOM listeners in the host never attach raw user callbacks from sandbox code.
- Synthetic sandbox events preserve common access patterns such as
  `event.target.value` and `event.currentTarget.checked` without exposing live
  host DOM nodes.

Explicitly bridged globals currently include `setTimeout`, `clearTimeout`, `setInterval`, `clearInterval`, and a restricted `fetch()` proxy. The host owns the real timers and networking, but the registered callbacks and response handling still execute inside QuickJS.

Event payloads are forwarded as plain data. The VM receives a narrow snapshot,
not a live DOM event object.

The sandbox exposes `event.target`, `event.currentTarget`, and
`event.srcElement` as plain data snapshots with a deliberately small surface:
`value`, `checked`, `id`, and `tagName`. Compatibility shortcuts such as
`event.value` and `event.checked` are still present, but `event.target.value`
is the preferred shape.

### Sandboxed fetch

The sandbox `fetch()` bridge is intentionally narrower than browser `window.fetch`:

- only absolute `https:` URLs are allowed, plus `http:` for localhost addresses
- no `Request` objects, no relative URLs, and no inherited browser request context
- credentials are always forced to `omit`
- `referrerPolicy` is always forced to `no-referrer`
- `mode` is always forced to `cors`
- request headers are user-supplied only and sensitive ambient headers such as `authorization`, `cookie`, `origin`, `referer`, and `user-agent` are blocked
- responses are exposed as a small Response-like object with `ok`, `status`, `statusText`, `url`, `redirected`, `headers`, `text()`, `json()`, and `arrayBuffer()`
- requests time out after 15 seconds and responses are capped at 1 MB

This bridge is designed to avoid ambient page credentials and host DOM access. It is still routed through the browser networking stack, so browser-controlled metadata such as `Origin` or `User-Agent` may still exist at the HTTP layer.

## Supported subset

- text interpolation
- attribute interpolation
- event bindings such as `@click`
- nested elements
- sync `component()` composition
- component emits via `component((props, emit) => ...)` and parent listeners via `Child(props, { eventName })`
- async `component()` composition with VM-owned fallback/render/error handling
- `pick()` / `props()` narrowing for component props
- global `output(payload)` host bridge
- reactive updates inside the VM
- restricted bridged `fetch()` requests and JSON/text response handling
- bridged timer callbacks via `setTimeout` and `setInterval`
- arrays and conditional child regions
- multi-root templates without a wrapper element

## Unsupported or partial

- full `@arrow-js/core` parity
- keyed list diffing
- direct DOM refs or real DOM node access
- arbitrary external imports
- browser API access without an explicit bridge
- hard CPU and memory isolation

## Current limitations

- This is not yet a hard boundary against CPU or memory exhaustion.
- Memory limits are applied to the QuickJS runtime, but denial-of-service hardening still needs more work.
- TypeScript support uses `typescript.transpileModule`, not full semantic type-checking.
- Template support is intentionally narrower than the standard Arrow host runtime.

## Development

```sh
pnpm --filter @arrow-js/sandbox sync:vm
pnpm --filter @arrow-js/sandbox demo
pnpm exec vitest run packages/sandbox/src/index.spec.ts
pnpm exec playwright test -c playwright.sandbox.config.ts
```

The demo includes a weather mini-app that fetches current conditions from the public Open-Meteo forecast API.
