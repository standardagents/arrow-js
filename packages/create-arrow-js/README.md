# create-arrow-js

![ArrowJS](./arrow-logo.png)

ArrowJS is a tiny, type-safe reactive UI runtime built around JavaScript modules, template literals, and the DOM.

[Docs](https://arrow-js.com) · [API Reference](https://arrow-js.com/api) · [Playground](https://arrow-js.com/play/)

## What this package does

`create-arrow-js` scaffolds a complete ArrowJS Vite 8 app.

The generated project includes:

- `@arrow-js/core`
- `@arrow-js/framework`
- `@arrow-js/ssr`
- `@arrow-js/hydrate`
- Vite 8 setup for SSR and hydration

It can also install the Arrow coding-agent skill during setup.

## Create a project

```sh
pnpm create arrow-js@latest my-arrow-app
```

`create-arrow-js` installs dependencies automatically when it can detect the invoking package manager. Use `--no-install` to skip that step.

Then:

```sh
cd my-arrow-app
pnpm dev
```
