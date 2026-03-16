import { html } from '@arrow-js/core'

export function ReactiveApi() {
  return html`
    <section id="reactive" class="mb-16">
      <h2
        class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4"
      >
        reactive()
      </h2>
      <div class="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>Creates observable state or computed values.</p>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Signatures
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">// Observable state
function reactive&lt;T extends ReactiveTarget&gt;(data: T): Reactive&lt;T&gt;

// Computed value
function reactive&lt;T&gt;(effect: () =&gt; T): Computed&lt;T&gt;</code></pre>
        </div>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Observable state
        </h3>
        <p>
          Pass an object or array to get a reactive proxy. Property reads
          are tracked inside watchers and template expressions. Property
          writes notify observers.
        </p>
        <div class="code-block">
          <pre><code class="language-ts">import { reactive } from '@arrow-js/core'

const data = reactive({ count: 0, items: [] as string[] })

data.count++              // triggers observers
data.items.push('hello')  // array mutations trigger parent observers</code></pre>
        </div>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Computed values
        </h3>
        <p>
          Pass an arrow function to create a computed value. The expression
          re-evaluates when tracked reads change.
        </p>
        <div class="code-block">
          <pre><code class="language-ts">const props = reactive({ count: 2, multiplier: 10 })

const data = reactive({
  total: reactive(() =&gt; props.count * props.multiplier)
})

data.total // 20 — reads like a normal value, auto-updates</code></pre>
        </div>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Manual subscriptions
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">type PropertyObserver&lt;T&gt; = (newValue?: T, oldValue?: T) =&gt; void

data.$on('count', (newVal, oldVal) =&gt; { /* ... */ })
data.$off('count', callback)</code></pre>
        </div>
        <p>
          Prefer <code>watch()</code> or template expressions over manual
          subscriptions. Use <code>$on</code>/<code>$off</code> only when
          you need direct per-property control.
        </p>

        <div class="callout callout-tip">
          <div class="callout-label">Rules</div>
          <ul class="list-disc pl-6 space-y-1">
            <li>Only objects and arrays can be reactive. Primitives cannot.</li>
            <li>Nested objects are lazily made reactive on first access.</li>
            <li>
              <code>reactive()</code> on an already-reactive object returns
              the same proxy (idempotent).
            </li>
          </ul>
        </div>
      </div>
    </section>
  `
}

export function WatchApi() {
  return html`
    <section id="watch" class="mb-16">
      <h2
        class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4"
      >
        watch()
      </h2>
      <div class="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>Runs side effects that re-execute when tracked reactive reads change.</p>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Signatures
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">// Single-effect form
function watch&lt;F extends () =&gt; unknown&gt;(
  effect: F
): [returnValue: ReturnType&lt;F&gt;, stop: () =&gt; void]

// Getter + afterEffect form
function watch&lt;F extends () =&gt; unknown, A extends (arg: ReturnType&lt;F&gt;) =&gt; unknown&gt;(
  effect: F,
  afterEffect: A
): [returnValue: ReturnType&lt;A&gt;, stop: () =&gt; void]</code></pre>
        </div>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Parameters
        </h3>
        <ul class="list-disc pl-6 space-y-2">
          <li>
            <code>effect</code> — A function that reads reactive properties.
            Runs immediately on creation. In the single-effect form, this is
            both the tracker and the side effect.
          </li>
          <li>
            <code>afterEffect</code> <span class="text-zinc-400">(optional)</span> —
            Receives the return value of <code>effect</code>. Only the
            <code>effect</code> function tracks dependencies; the
            <code>afterEffect</code> runs after dependency collection.
          </li>
        </ul>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Returns
        </h3>
        <p>
          A tuple <code>[returnValue, stop]</code>. Call <code>stop()</code>
          to unsubscribe from all tracked dependencies.
        </p>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Examples
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">import { reactive, watch } from '@arrow-js/core'

const data = reactive({ price: 25, quantity: 10 })

// Single-effect: tracks and runs in one function
const [, stop] = watch(() =&gt; {
  console.log(\`Total: \${data.price * data.quantity}\`)
})

// Getter + effect: separates tracking from side effect
watch(
  () =&gt; data.price * data.quantity,
  (total) =&gt; console.log(\`Total: \${total}\`)
)

// Stop watching
stop()</code></pre>
        </div>

        <div class="callout callout-tip">
          <div class="callout-label">Rules</div>
          <ul class="list-disc pl-6 space-y-1">
            <li>Dependencies are auto-discovered from reactive reads.</li>
            <li>Dependencies no longer read on subsequent runs are dropped.</li>
          </ul>
        </div>
      </div>
    </section>
  `
}

export function HtmlApi() {
  return html`
    <section id="html" class="mb-16">
      <h2
        class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4"
      >
        html
      </h2>
      <div class="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>Tagged template literal that creates an <code>ArrowTemplate</code>.</p>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Signature
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">function html(
  strings: TemplateStringsArray,
  ...expSlots: ArrowExpression[]
): ArrowTemplate</code></pre>
        </div>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Mounting
        </h3>
        <p>
          An <code>ArrowTemplate</code> is callable. Pass a parent node to
          mount into the DOM, or call with no arguments to get a
          <code>DocumentFragment</code>.
        </p>
        <div class="code-block">
          <pre><code class="language-ts">const template = html\`&lt;h1&gt;Hello&lt;/h1&gt;\`

// Mount to a DOM node
template(document.getElementById('app'))

// Get a DocumentFragment
const fragment = template()</code></pre>
        </div>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Expression types
        </h3>
        <ul class="list-disc pl-6 space-y-2">
          <li>
            <strong>Static</strong> — Any non-function value. Renders once.
            <div class="code-block mt-2">
              <pre><code class="language-ts">html\`&lt;p&gt;\${someString}&lt;/p&gt;\`</code></pre>
            </div>
          </li>
          <li>
            <strong>Reactive</strong> — A function expression. Re-evaluates
            when tracked reads change.
            <div class="code-block mt-2">
              <pre><code class="language-ts">html\`&lt;p&gt;\${() =&gt; data.count}&lt;/p&gt;\`</code></pre>
            </div>
          </li>
          <li>
            <strong>Template / component</strong> — Nest directly.
            <div class="code-block mt-2">
              <pre><code class="language-ts">html\`&lt;div&gt;\${otherTemplate}&lt;/div&gt;\`
html\`&lt;div&gt;\${MyComponent({ label: 'hi' })}&lt;/div&gt;\`</code></pre>
            </div>
          </li>
          <li>
            <strong>Array</strong> — Renders a list of templates.
            <div class="code-block mt-2">
              <pre><code class="language-ts">html\`&lt;ul&gt;\${() =&gt; items.map(i =&gt; html\`&lt;li&gt;\${i.name}&lt;/li&gt;\`)}&lt;/ul&gt;\`</code></pre>
            </div>
          </li>
        </ul>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Attribute binding
        </h3>
        <p>Static or reactive. Return <code>false</code> to remove the attribute.</p>
        <div class="code-block">
          <pre><code class="language-ts">// Static
html\`&lt;div class="\${cls}"&gt;&lt;/div&gt;\`

// Reactive
html\`&lt;div class="\${() =&gt; data.active ? 'on' : 'off'}"&gt;&lt;/div&gt;\`

// Boolean removal
html\`&lt;button disabled="\${() =&gt; data.loading ? '' : false}"&gt;Submit&lt;/button&gt;\`</code></pre>
        </div>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Property binding
        </h3>
        <p>Prefix with <code>.</code> to set an IDL property instead of an attribute.</p>
        <div class="code-block">
          <pre><code class="language-ts">html\`&lt;input .value="\${() =&gt; data.text}" /&gt;\`</code></pre>
        </div>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Event binding
        </h3>
        <p>Prefix with <code>@</code> to attach an event listener.</p>
        <div class="code-block">
          <pre><code class="language-ts">html\`&lt;button @click="\${(e) =&gt; handleClick(e)}"&gt;Click&lt;/button&gt;\`</code></pre>
        </div>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          List keys
        </h3>
        <p>
          Call <code>.key()</code> on a template to give it stable identity
          in a list. Without keys, list patches reuse slots by position.
        </p>
        <div class="code-block">
          <pre><code class="language-ts">html\`&lt;ul&gt;\${() =&gt; items.map(item =&gt;
  html\`&lt;li&gt;\${item.name}&lt;/li&gt;\`.key(item.id)
)}&lt;/ul&gt;\`</code></pre>
        </div>
      </div>
    </section>
  `
}

export function ComponentApi() {
  return html`
    <section id="component" class="mb-16">
      <h2
        class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4"
      >
        component()
      </h2>
      <div class="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>
          Wraps a factory function to provide stable local state across
          parent re-renders.
        </p>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Signatures
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">// Sync — no props
function component(
  factory: () =&gt; ArrowTemplate
): Component

// Sync — with props
function component&lt;T extends ReactiveTarget&gt;(
  factory: (props: Props&lt;T&gt;) =&gt; ArrowTemplate
): ComponentWithProps&lt;T&gt;

// Async — no props
function component&lt;TValue, TSnapshot = TValue&gt;(
  factory: () =&gt; Promise&lt;TValue&gt; | TValue,
  options?: AsyncComponentOptions&lt;ReactiveTarget, TValue, TSnapshot&gt;
): Component

// Async — with props
function component&lt;T extends ReactiveTarget, TValue, TSnapshot = TValue&gt;(
  factory: (props: Props&lt;T&gt;) =&gt; Promise&lt;TValue&gt; | TValue,
  options?: AsyncComponentOptions&lt;T, TValue, TSnapshot&gt;
): ComponentWithProps&lt;T&gt;</code></pre>
        </div>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          AsyncComponentOptions
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">interface AsyncComponentOptions&lt;TProps, TValue, TSnapshot = TValue&gt; {
  fallback?: unknown                                       // shown while pending
  render?: (value: TValue, props: Props&lt;TProps&gt;) =&gt; unknown  // custom render
  onError?: (error: unknown, props: Props&lt;TProps&gt;) =&gt; unknown // error handler
  serialize?: (value: TValue, props: Props&lt;TProps&gt;) =&gt; TSnapshot   // SSR snapshot
  deserialize?: (snapshot: TSnapshot, props: Props&lt;TProps&gt;) =&gt; TValue // restore
  idPrefix?: string                                        // readable SSR ids
}</code></pre>
        </div>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Usage
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">import { component, html, reactive } from '@arrow-js/core'
import type { Props } from '@arrow-js/core'

// Sync component with props
const Counter = component((props: Props&lt;{ count: number }&gt;) =&gt; {
  const local = reactive({ clicks: 0 })
  return html\`&lt;button @click="\${() =&gt; local.clicks++}"&gt;
    Root \${() =&gt; props.count} | Local \${() =&gt; local.clicks}
  &lt;/button&gt;\`
})

// Async component
const UserName = component(async ({ id }: { id: string }) =&gt; {
  const user = await fetch(\`/api/users/\${id}\`).then(r =&gt; r.json())
  return user.name
})</code></pre>
        </div>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          .key() for lists
        </h3>
        <p>
          Call <code>.key()</code> on the component call to preserve identity
          when rendering in a keyed list.
        </p>
        <div class="code-block">
          <pre><code class="language-ts">html\`\${() =&gt; items.map(item =&gt;
  ItemCard(item).key(item.id)
)}\`</code></pre>
        </div>

        <div class="callout callout-tip">
          <div class="callout-label">Rules</div>
          <ul class="list-disc pl-6 space-y-1">
            <li>The factory runs <strong>once per slot</strong>, not on every update.</li>
            <li>
              <strong>Never destructure props</strong> at the top of the factory —
              read them lazily inside reactive expressions.
            </li>
            <li>SSR waits for all async components to resolve before returning HTML.</li>
            <li>
              JSON-safe async results are auto-serialized into the hydration payload.
            </li>
          </ul>
        </div>
      </div>
    </section>
  `
}

export function PickApi() {
  return html`
    <section id="pick" class="mb-16">
      <h2
        class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4"
      >
        pick() / props()
      </h2>
      <div class="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>
          Narrows a reactive object down to specific keys. <code>props</code>
          is an alias for <code>pick</code>.
        </p>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Signatures
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">function pick&lt;T extends object, K extends keyof T&gt;(
  source: T,
  ...keys: K[]
): Pick&lt;T, K&gt;

function pick&lt;T extends object&gt;(source: T): T

const props = pick  // alias</code></pre>
        </div>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Usage
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">import { pick, reactive } from '@arrow-js/core'

const state = reactive({ count: 1, theme: 'dark', locale: 'en' })

// Pass only the keys a component needs
html\`\${Counter(pick(state, 'count'))}\`

// Without keys — returns the source as-is
html\`\${Counter(pick(state))}\`</code></pre>
        </div>

        <div class="callout callout-tip">
          <div class="callout-label">Tip</div>
          <p>
            The returned object is a live proxy — reads and writes flow
            through to the source. It is not a copy.
          </p>
        </div>
      </div>
    </section>
  `
}

export function NextTickApi() {
  return html`
    <section id="next-tick" class="mb-16">
      <h2
        class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4"
      >
        nextTick()
      </h2>
      <div class="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>
          Flushes Arrow's internal microtask queue, then runs an optional
          callback.
        </p>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Signature
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">function nextTick(fn?: CallableFunction): Promise&lt;unknown&gt;</code></pre>
        </div>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Usage
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">import { nextTick, reactive } from '@arrow-js/core'

const data = reactive({ count: 0 })

data.count = 5

// Wait for all pending reactive updates to flush
await nextTick()
// DOM is now updated

// Or pass a callback
nextTick(() =&gt; {
  console.log('DOM updated')
})</code></pre>
        </div>

        <p>
          Arrow batches reactive updates into a microtask.
          <code>nextTick</code> lets you wait for that flush before reading
          the DOM or performing follow-up work.
        </p>
      </div>
    </section>
  `
}

export function RenderApi() {
  return html`
    <section id="render" class="mb-16">
      <h2
        class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4"
      >
        render()
      </h2>
      <div class="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>
          Full-lifecycle render that mounts a view into a root element,
          tracking async components and boundaries.
        </p>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Signature
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">function render(
  root: ParentNode,
  view: unknown,
  options?: RenderOptions
): Promise&lt;RenderResult&gt;</code></pre>
        </div>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          RenderOptions
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">interface RenderOptions {
  clear?: boolean                              // clear root before rendering
  hydrationSnapshots?: Record&lt;string, unknown&gt; // pre-loaded async snapshots
}</code></pre>
        </div>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          RenderResult
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">interface RenderResult {
  root: ParentNode
  template: ArrowTemplate
  payload: RenderPayload
}

interface RenderPayload {
  async: Record&lt;string, unknown&gt;  // serialized async component results
  boundaries: string[]             // boundary ids encountered
}</code></pre>
        </div>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Usage
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">import { render } from '@arrow-js/framework'
import { html } from '@arrow-js/core'

const view = html\`&lt;h1&gt;Hello&lt;/h1&gt;\`
const { root, payload } = await render(document.getElementById('app'), view)</code></pre>
        </div>
      </div>
    </section>
  `
}

export function BoundaryApi() {
  return html`
    <section id="boundary" class="mb-16">
      <h2
        class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4"
      >
        boundary()
      </h2>
      <div class="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>
          Wraps a view in hydration boundary markers, enabling targeted
          recovery during hydration.
        </p>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Signature
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">function boundary(
  view: unknown,
  options?: BoundaryOptions
): ArrowTemplate

interface BoundaryOptions {
  idPrefix?: string  // readable identifier for the boundary
}</code></pre>
        </div>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Usage
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">import { boundary } from '@arrow-js/framework'
import { html } from '@arrow-js/core'

html\`
  &lt;main&gt;
    \${boundary(Sidebar(), { idPrefix: 'sidebar' })}
    \${boundary(Content(), { idPrefix: 'content' })}
  &lt;/main&gt;
\`</code></pre>
        </div>

        <p>
          This inserts <code>&lt;template data-arrow-boundary-start/end&gt;</code>
          markers in the HTML. During hydration, if a subtree mismatches,
          Arrow repairs that boundary region instead of replacing the
          entire root.
        </p>

        <div class="callout callout-tip">
          <div class="callout-label">When to use</div>
          <p>
            Always wrap async components in a boundary for SSR/hydration
            recovery. Also useful around any subtree that may diverge
            between server and client (e.g. time-dependent content).
          </p>
        </div>
      </div>
    </section>
  `
}

export function ToTemplateApi() {
  return html`
    <section id="to-template" class="mb-16">
      <h2
        class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4"
      >
        toTemplate()
      </h2>
      <div class="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>
          Normalizes any view value into an <code>ArrowTemplate</code>.
          Useful when you have a value that might be a string, number,
          template, or component call and need a consistent template type.
        </p>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Signature
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">function toTemplate(view: unknown): ArrowTemplate</code></pre>
        </div>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Usage
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">import { toTemplate } from '@arrow-js/framework'
import { html } from '@arrow-js/core'

const view = 'Hello, world'
const template = toTemplate(view)

// Now usable anywhere an ArrowTemplate is expected
template(document.getElementById('app'))</code></pre>
        </div>
      </div>
    </section>
  `
}

export function RenderDocumentApi() {
  return html`
    <section id="render-document" class="mb-16">
      <h2
        class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4"
      >
        renderDocument()
      </h2>
      <div class="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>
          Injects rendered HTML, head content, and payload script into an
          HTML shell template string. Used in custom server setups.
        </p>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Signature
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">function renderDocument(
  template: string,
  parts: DocumentRenderParts
): string

interface DocumentRenderParts {
  head?: string       // injected at &lt;!--app-head--&gt;
  html: string        // injected at &lt;!--app-html--&gt;
  payloadScript?: string  // injected at &lt;!--app-payload--&gt;
}</code></pre>
        </div>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Placeholder markers
        </h3>
        <p>
          The <code>template</code> string should contain these HTML comment
          placeholders:
        </p>
        <ul class="list-disc pl-6 space-y-1">
          <li><code>&lt;!--app-head--&gt;</code> — replaced with <code>parts.head</code></li>
          <li><code>&lt;!--app-html--&gt;</code> — replaced with <code>parts.html</code></li>
          <li><code>&lt;!--app-payload--&gt;</code> — replaced with <code>parts.payloadScript</code></li>
        </ul>
      </div>
    </section>
  `
}

export function RenderToStringApi() {
  return html`
    <section id="render-to-string" class="mb-16">
      <h2
        class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4"
      >
        renderToString()
      </h2>
      <div class="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>
          Renders a view to an HTML string on the server. Waits for all
          async components to resolve before returning.
        </p>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Signature
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">function renderToString(
  view: unknown,
  options?: SsrRenderOptions
): Promise&lt;SsrRenderResult&gt;

interface SsrRenderOptions {
  rootId?: string  // id attribute for the root container
}

interface SsrRenderResult {
  html: string
  payload: HydrationPayload
}

interface HydrationPayload {
  html?: string
  rootId?: string
  async?: Record&lt;string, unknown&gt;   // serialized async component results
  boundaries?: string[]              // boundary ids
}</code></pre>
        </div>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Usage
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">import { renderToString, serializePayload } from '@arrow-js/ssr'

const { html, payload } = await renderToString(view)

// Serialize payload for client-side hydration
const script = serializePayload(payload)</code></pre>
        </div>

        <p>
          Internally uses JSDOM to render templates into a virtual DOM,
          then serializes the result. All async components are awaited
          and their results captured in the payload.
        </p>
      </div>
    </section>
  `
}

export function SerializePayloadApi() {
  return html`
    <section id="serialize-payload" class="mb-16">
      <h2
        class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4"
      >
        serializePayload()
      </h2>
      <div class="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>
          Serializes a hydration payload into a
          <code>&lt;script type="application/json"&gt;</code> tag that can
          be embedded in the HTML document.
        </p>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Signature
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">function serializePayload(
  payload: unknown,
  id?: string  // default: 'arrow-ssr-payload'
): string</code></pre>
        </div>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Returns
        </h3>
        <p>
          An HTML string containing a <code>&lt;script&gt;</code> tag with
          the JSON-serialized payload. The <code>id</code> attribute matches
          what <code>readPayload()</code> looks for on the client.
        </p>

        <div class="code-block">
          <pre><code class="language-ts">const script = serializePayload(payload)
// &lt;script id="arrow-ssr-payload" type="application/json"&gt;{...}&lt;/script&gt;

// Custom id
const script = serializePayload(payload, 'my-payload')
// &lt;script id="my-payload" type="application/json"&gt;{...}&lt;/script&gt;</code></pre>
        </div>

        <div class="callout callout-tip">
          <div class="callout-label">Tip</div>
          <p>
            The serializer escapes <code>&lt;/script&gt;</code> sequences
            inside the JSON to prevent injection.
          </p>
        </div>
      </div>
    </section>
  `
}

export function HydrateApi() {
  return html`
    <section id="hydrate" class="mb-16">
      <h2
        class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4"
      >
        hydrate()
      </h2>
      <div class="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>
          Reconciles server-rendered HTML with the client-side view tree,
          reconnecting reactivity without replacing existing DOM nodes.
        </p>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Signature
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">function hydrate(
  root: ParentNode,
  view: unknown,
  payload?: HydrationPayload,
  options?: HydrationOptions
): Promise&lt;HydrationResult&gt;</code></pre>
        </div>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          HydrationOptions
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">interface HydrationOptions {
  onMismatch?: (details: HydrationMismatchDetails) =&gt; void
}

interface HydrationMismatchDetails {
  actual: string       // server HTML
  expected: string     // client HTML
  mismatches: number   // number of differences found
  repaired: boolean    // true if boundary repair succeeded
  boundaryFallbacks: number  // boundaries that fell back
}</code></pre>
        </div>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          HydrationResult
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">interface HydrationResult {
  root: ParentNode
  template: ArrowTemplate
  payload: RenderPayload
  adopted: boolean           // true if DOM was adopted without replacement
  mismatches: number         // total mismatches encountered
  boundaryFallbacks: number  // boundaries that required fallback
}</code></pre>
        </div>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Usage
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">import { hydrate, readPayload } from '@arrow-js/hydrate'
import { createApp } from './app'

const payload = readPayload()
const root = document.getElementById('app')!

const result = await hydrate(root, createApp(), payload, {
  onMismatch: (details) =&gt; {
    console.warn('Hydration mismatch:', details)
  }
})</code></pre>
        </div>

        <p>
          When the server HTML matches the client view, Arrow adopts the
          existing DOM nodes and attaches reactive bindings. When a
          mismatch is detected, boundary regions are repaired individually
          before falling back to a full root replacement.
        </p>
      </div>
    </section>
  `
}

export function ReadPayloadApi() {
  return html`
    <section id="read-payload" class="mb-16">
      <h2
        class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4"
      >
        readPayload()
      </h2>
      <div class="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>
          Reads the hydration payload from a
          <code>&lt;script type="application/json"&gt;</code> tag embedded
          in the document by the server.
        </p>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Signature
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">function readPayload(
  doc?: Document,  // default: document
  id?: string      // default: 'arrow-ssr-payload'
): HydrationPayload</code></pre>
        </div>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Usage
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">import { readPayload } from '@arrow-js/hydrate'

// Default — reads from document, id="arrow-ssr-payload"
const payload = readPayload()

// Custom document and id
const payload = readPayload(iframe.contentDocument, 'my-payload')</code></pre>
        </div>
      </div>
    </section>
  `
}

export function TypesReference() {
  return html`
    <section id="types" class="mb-16">
      <h2
        class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4"
      >
        Type Reference
      </h2>
      <div class="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>
          All types are exported from their respective packages. Import them
          with the <code>type</code> keyword for type-only imports.
        </p>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          @arrow-js/core
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">// The template function returned by html\`...\`
interface ArrowTemplate {
  (parent: ParentNode): ParentNode
  (): DocumentFragment
  isT: boolean
  key(key: ArrowTemplateKey): ArrowTemplate
}

// Reactive proxy — the object plus $on/$off methods
type Reactive&lt;T extends ReactiveTarget&gt; = T &amp; {
  $on&lt;K extends keyof T&gt;(
    property: K,
    observer: PropertyObserver&lt;T[K]&gt;
  ): void
  $off&lt;K extends keyof T&gt;(
    property: K,
    observer: PropertyObserver&lt;T[K]&gt;
  ): void
}

// Computed value wrapper
type Computed&lt;T&gt; = Readonly&lt;Reactive&lt;{ value: T }&gt;&gt;

// Constraint for reactive() input — objects or arrays
type ReactiveTarget = Record&lt;PropertyKey, unknown&gt; | unknown[]

// Observer callback for $on/$off
type PropertyObserver&lt;T&gt; = (newValue?: T, oldValue?: T) =&gt; void

// Component prop types
type Props&lt;T extends ReactiveTarget&gt; = /* mapped reactive proxy */

// Component types
interface Component {
  (): ComponentCall
}
interface ComponentWithProps&lt;T extends ReactiveTarget&gt; {
  &lt;S extends Props&lt;T&gt;&gt;(props: S): ComponentCall
}</code></pre>
        </div>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          @arrow-js/framework
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">interface RenderOptions {
  clear?: boolean
  hydrationSnapshots?: Record&lt;string, unknown&gt;
}

interface RenderResult {
  root: ParentNode
  template: ArrowTemplate
  payload: RenderPayload
}

interface RenderPayload {
  async: Record&lt;string, unknown&gt;
  boundaries: string[]
}

interface BoundaryOptions {
  idPrefix?: string
}

interface DocumentRenderParts {
  head?: string
  html: string
  payloadScript?: string
}</code></pre>
        </div>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          @arrow-js/ssr
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">interface SsrRenderOptions {
  rootId?: string
}

interface SsrRenderResult {
  html: string
  payload: HydrationPayload
}

interface HydrationPayload {
  html?: string
  rootId?: string
  async?: Record&lt;string, unknown&gt;
  boundaries?: string[]
}</code></pre>
        </div>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          @arrow-js/hydrate
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">interface HydrationOptions {
  onMismatch?: (details: HydrationMismatchDetails) =&gt; void
}

interface HydrationMismatchDetails {
  actual: string
  expected: string
  mismatches: number
  repaired: boolean
  boundaryFallbacks: number
}

interface HydrationResult {
  root: ParentNode
  template: ArrowTemplate
  payload: RenderPayload
  adopted: boolean
  mismatches: number
  boundaryFallbacks: number
}</code></pre>
        </div>
      </div>
    </section>
  `
}
