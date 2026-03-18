# Arrow API Notes

Use this reference when you need the main runtime semantics quickly.

## `reactive()`

- Turns objects and arrays into live reactive state.
- Reads inside callable template expressions stay reactive.
- Plain values in template expressions render once.

## `html`

- Use the `html` tagged template literal to render DOM.
- `${data.foo}` is static.
- `${() => data.foo}` stays live.
- Return arrays of templates to render lists.
- Use `.key(...)` when DOM identity must survive reorders.

## `component()`

- Wraps a plain function and gives it stable instance semantics per render slot.
- Pass reactive objects as props.
- Read props lazily with callable expressions.

## `watch()`

- Use for side effects, not primary rendering.
- Prefer template expressions for UI updates and `watch()` for imperative work.

## Framework + SSR

- `render(root, view)` mounts a view to the DOM.
- `boundary(view, options)` gives async and hydration recovery boundaries.
- `renderToString(view)` returns `{ html, payload }`.
- `serializePayload(payload)` writes the SSR payload into the page.
- `hydrate(root, view, payload)` adopts matching SSR DOM in the browser.
