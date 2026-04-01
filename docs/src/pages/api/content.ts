import { html } from '@arrow-js/core'
import { TsCodeBlock } from '../../components/TsCodeBlock'
import { highlightedSection } from '../../components/highlighted-section'
import {
  coreTypeReferenceSnippet,
  frameworkTypeReferenceSnippet,
  hydrateTypeReferenceSnippet,
  sandboxTypeReferenceSnippet,
  ssrTypeReferenceSnippet,
} from '../../components/typeReferenceSnippets'

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
        ${TsCodeBlock(`import type { Computed, Reactive, ReactiveTarget } from '@arrow-js/core'

// Observable state
declare function reactive&lt;T extends ReactiveTarget&gt;(data: T): Reactive&lt;T&gt;

// Computed value
declare function reactive&lt;T&gt;(effect: () =&gt; T): Computed&lt;T&gt;`)}

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
        ${TsCodeBlock(`import { reactive } from '@arrow-js/core'

const data = reactive({ count: 0, items: [] as string[] })

data.count++              // triggers observers
data.items.push('hello')  // array mutations trigger parent observers`)}

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Computed values
        </h3>
        <p>
          Pass an arrow function to create a computed value. The expression
          re-evaluates when tracked reads change.
        </p>
        ${TsCodeBlock(`import { reactive } from '@arrow-js/core'

const props = reactive({ count: 2, multiplier: 10 })

const data = reactive({
  total: reactive(() =&gt; props.count * props.multiplier)
})

data.total // 20 — reads like a normal value, auto-updates`)}

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Manual subscriptions
        </h3>
        ${TsCodeBlock(`// ---cut-start---
import { reactive } from '@arrow-js/core'
import type { PropertyObserver } from '@arrow-js/core'
const data = reactive({ count: 0 })
const callback: PropertyObserver&lt;number&gt; = () =&gt; {}
// ---cut-end---

data.$on('count', (newVal, oldVal) =&gt; { /* ... */ })
data.$off('count', callback)`)}
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
declare function watch&lt;F extends () =&gt; unknown&gt;(
  effect: F
): [returnValue: ReturnType&lt;F&gt;, stop: () =&gt; void]

// Getter + afterEffect form
declare function watch&lt;F extends () =&gt; unknown, A extends (arg: ReturnType&lt;F&gt;) =&gt; unknown&gt;(
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
        <p>
          When a watcher is created inside <code>component()</code>, Arrow
          also stops it automatically when that component unmounts.
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

export function OnCleanupApi() {
  return html`
    <section id="on-cleanup" class="mb-16">
      <h2
        class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4"
      >
        onCleanup()
      </h2>
      <div class="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>
          Registers teardown work for the current component instance.
        </p>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Signature
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">declare function onCleanup(fn: () =&gt; void): () =&gt; void</code></pre>
        </div>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Behavior
        </h3>
        <ul class="list-disc pl-6 space-y-2">
          <li>
            Call it inside <code>component()</code> while setting up local
            side effects.
          </li>
          <li>
            Arrow runs the cleanup automatically when that component slot
            unmounts.
          </li>
          <li>
            It also returns a disposer so you can stop the side effect early.
          </li>
        </ul>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Example
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">import { component, html, onCleanup } from '@arrow-js/core'

const ResizeProbe = component(() =&gt; {
  const onResize = () =&gt; console.log(window.innerWidth)

  window.addEventListener('resize', onResize)
  onCleanup(() =&gt; window.removeEventListener('resize', onResize))

  return html\`&lt;div&gt;Watching resize…&lt;/div&gt;\`
})</code></pre>
        </div>

        <div class="callout callout-tip">
          <div class="callout-label">Tip</div>
          <p>
            Use <code>onCleanup()</code> for manual subscriptions like DOM
            listeners, timers, sockets, or anything else Arrow did not create
            for you.
          </p>
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
        ${TsCodeBlock(`import type { ArrowExpression, ArrowTemplate } from '@arrow-js/core'

declare function html(
  strings: TemplateStringsArray | string[],
  ...expSlots: ArrowExpression[]
): ArrowTemplate`)}
        <p>
          Compiler output can call <code>html(strings, ...exprs)</code> directly
          with a generated <code>string[]</code>. Arrow will route it through the
          same template caching, pooling, hydration, and cleanup path as a
          tagged literal.
        </p>

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

export function SvgApi() {
  return html`
    <section id="svg" class="mb-16">
      <h2
        class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4"
      >
        svg
      </h2>
      <div class="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>
          Tagged template literal for SVG child templates. It returns an
          <code>ArrowTemplate</code> just like <code>html</code>, but parses the
          template in the SVG namespace.
        </p>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Signature
        </h3>
        ${TsCodeBlock(`import type { ArrowExpression, ArrowTemplate } from '@arrow-js/core'

declare function svg(
  strings: TemplateStringsArray | string[],
  ...expSlots: ArrowExpression[]
): ArrowTemplate`)}

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          When to use
        </h3>
        <p>
          Use <code>svg</code> when you need to nest SVG elements like
          <code>&lt;rect&gt;</code>, <code>&lt;circle&gt;</code>, or
          <code>&lt;path&gt;</code> as child templates inside an
          <code>&lt;svg&gt;</code>. A nested <code>html</code> template parses in
          HTML mode and will not create SVG nodes correctly.
        </p>

        <div class="code-block">
          <pre><code class="language-ts">import { html, svg } from '@arrow-js/core'

html\`&lt;svg width="100" height="100" viewBox="0 0 100 100"&gt;
  \${() =&gt; data.values.map((v, i) =&gt; svg\`&lt;rect
    x="\${i * 10}"
    y="\${100 - v}"
    width="9"
    height="\${v}"
    fill="red"
  /&gt;\`)}
&lt;/svg&gt;\`</code></pre>
        </div>

        <p>
          <code>svg</code> uses the same mounting, reactivity, list rendering,
          keys, hydration, and cleanup behavior as <code>html</code>. The
          difference is only the parse namespace.
        </p>
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
        ${TsCodeBlock(`import type {
  ArrowTemplate,
  AsyncComponentOptions,
  Component,
  ComponentWithProps,
  Props,
  ReactiveTarget,
} from '@arrow-js/core'

// Sync — no props
declare function component(
  factory: () =&gt; ArrowTemplate
): Component

// Sync — with props
declare function component&lt;T extends ReactiveTarget&gt;(
  factory: (props: Props&lt;T&gt;) =&gt; ArrowTemplate
): ComponentWithProps&lt;T&gt;

// Async — no props
declare function component&lt;TValue, TSnapshot = TValue&gt;(
  factory: () =&gt; Promise&lt;TValue&gt; | TValue,
  options?: AsyncComponentOptions&lt;ReactiveTarget, TValue, TSnapshot&gt;
): Component

// Async — with props
declare function component&lt;T extends ReactiveTarget, TValue, TSnapshot = TValue&gt;(
  factory: (props: Props&lt;T&gt;) =&gt; Promise&lt;TValue&gt; | TValue,
  options?: AsyncComponentOptions&lt;T, TValue, TSnapshot&gt;
): ComponentWithProps&lt;T&gt;`)}

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          AsyncComponentOptions
        </h3>
        ${TsCodeBlock(`import type { AsyncComponentOptions } from '@arrow-js/core'`)}

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Usage
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">import { component, html, onCleanup, reactive } from '@arrow-js/core'
import type { Props } from '@arrow-js/core'

// Sync component with props
const Counter = component((props: Props&lt;{ count: number }&gt;) =&gt; {
  const local = reactive({ clicks: 0 })
  const onResize = () =&gt; console.log('resize')

  window.addEventListener('resize', onResize)
  onCleanup(() =&gt; window.removeEventListener('resize', onResize))

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
            <li>
              <code>Props&lt;T&gt;</code> is a live proxy over the source object, so
              checks like <code>'count' in props</code> and
              <code>Object.keys(props)</code> reflect the current source keys.
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
          <pre><code class="language-ts">declare function pick&lt;T extends object, K extends keyof T&gt;(
  source: T,
  ...keys: K[]
): Pick&lt;T, K&gt;

declare function pick&lt;T extends object&gt;(source: T): T

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
          <pre><code class="language-ts">declare function nextTick(fn?: CallableFunction): Promise&lt;unknown&gt;</code></pre>
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
        ${TsCodeBlock(`import type { RenderOptions, RenderResult } from '@arrow-js/framework'

declare function render(
  root: ParentNode,
  view: unknown,
  options?: RenderOptions
): Promise&lt;RenderResult&gt;`)}

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          RenderOptions
        </h3>
        ${TsCodeBlock(`import type { RenderOptions } from '@arrow-js/framework'`)}

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          RenderResult
        </h3>
        ${TsCodeBlock(`import type { RenderPayload, RenderResult } from '@arrow-js/framework'`)}

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
        ${TsCodeBlock(`import type { ArrowTemplate } from '@arrow-js/core'
import type { BoundaryOptions } from '@arrow-js/framework'

declare function boundary(
  view: unknown,
  options?: BoundaryOptions
): ArrowTemplate`)}

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
        ${TsCodeBlock(`import type { ArrowTemplate } from '@arrow-js/core'

declare function toTemplate(view: unknown): ArrowTemplate`)}

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
        ${TsCodeBlock(`import type { DocumentRenderParts } from '@arrow-js/framework'

declare function renderDocument(
  template: string,
  parts: DocumentRenderParts
): string`)}

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
        <p>
          This is the main SSR entry point. Use it inside your request handler
          after you have chosen the page and built the Arrow view for the
          incoming URL.
        </p>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Signature
        </h3>
        ${TsCodeBlock(`import type {
  HydrationPayload,
  SsrRenderOptions,
  SsrRenderResult,
} from '@arrow-js/ssr'

declare function renderToString(
  view: unknown,
  options?: SsrRenderOptions
): Promise&lt;SsrRenderResult&gt;`)}

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

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Typical server flow
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">import { renderToString, serializePayload } from '@arrow-js/ssr'

export async function renderPage(url: string) {
  const page = routeToPage(url)
  const result = await renderToString(page.view)

  return [
    '&lt;!doctype html&gt;',
    '&lt;html&gt;',
    '  &lt;head&gt;',
    \`    &lt;title&gt;\${page.title}&lt;/title&gt;\`,
    '  &lt;/head&gt;',
    '  &lt;body&gt;',
    \`    &lt;div id="app"&gt;\${result.html}&lt;/div&gt;\`,
    \`    \${serializePayload(result.payload)}\`,
    '  &lt;/body&gt;',
    '&lt;/html&gt;'
  ].join('\\n')
}</code></pre>
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
          <pre><code class="language-ts">declare function serializePayload(
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
          <pre><code class="language-ts">const payload = { rootId: 'app', async: {}, boundaries: [] }

const defaultScript = serializePayload(payload)
// &lt;script id="arrow-ssr-payload" type="application/json"&gt;{...}&lt;/script&gt;

// Custom id
const customScript = serializePayload(payload, 'my-payload')
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
        <p>
          Call it once in your browser entry after reading the server payload
          and rebuilding the same page view that was used during SSR.
        </p>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Signature
        </h3>
        ${TsCodeBlock(`import type {
  HydrationOptions,
  HydrationPayload,
  HydrationResult,
} from '@arrow-js/hydrate'

declare function hydrate(
  root: ParentNode,
  view: unknown,
  payload?: HydrationPayload,
  options?: HydrationOptions
): Promise&lt;HydrationResult&gt;`)}

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          HydrationOptions
        </h3>
        ${TsCodeBlock(`import type {
  HydrationMismatchDetails,
  HydrationOptions,
} from '@arrow-js/hydrate'`)}

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          HydrationResult
        </h3>
        ${TsCodeBlock(`import type { HydrationResult } from '@arrow-js/hydrate'`)}

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

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Typical client flow
        </h3>
        <div class="code-block">
          <pre><code class="language-ts">import { hydrate, readPayload } from '@arrow-js/hydrate'

const payload = readPayload()
const root = document.getElementById(payload.rootId ?? 'app')

if (!root) {
  throw new Error('Missing #app root')
}

await hydrate(
  root,
  routeToPage(window.location.pathname).view,
  payload
)</code></pre>
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
          <pre><code class="language-ts">declare function readPayload(
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
const iframe = document.querySelector('iframe')
const payloadFromFrame = iframe?.contentDocument
  ? readPayload(iframe.contentDocument, 'my-payload')
  : null</code></pre>
        </div>
      </div>
    </section>
  `
}

export function SandboxApi() {
  return html`
    <section id="sandbox" class="mb-16">
      <h2
        class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4"
      >
        sandbox()
      </h2>
      <div class="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>
          Returns an <code>ArrowTemplate</code> that renders a stable
          <code>&lt;arrow-sandbox&gt;</code> host element and boots a QuickJS +
          WASM VM behind it.
        </p>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Signature
        </h3>
        ${TsCodeBlock(`import type { ArrowTemplate } from '@arrow-js/core'

type HostBridgeFn = (...args: unknown[]) => unknown | Promise&lt;unknown&gt;
type HostBridgeModule = Record&lt;string, HostBridgeFn&gt;
type HostBridge = Record&lt;string, HostBridgeModule&gt;

interface SandboxProps {
  source: Record&lt;string, string&gt;
  shadowDOM?: boolean;
  onError?: (error: Error | string) =&gt; void;
  debug?: boolean;
}

interface SandboxEvents {
  output?: (payload: unknown) =&gt; void;
}

declare function sandbox&lt;T extends {
  source: object;
  shadowDOM?: boolean;
  onError?: (error: Error | string) =&gt; void;
  debug?: boolean;
}&gt;(
  props: T,
  events?: SandboxEvents,
  hostBridge?: HostBridge
): ArrowTemplate`)}

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Rules
        </h3>
        <ul class="list-disc pl-6 space-y-2">
          <li>
            <code>source</code> must contain exactly one
            <code>main.ts</code> or <code>main.js</code> entry file.
          </li>
          <li>
            <code>main.css</code> is optional and is injected into the sandbox
            host root. By default that root is an open shadow root.
          </li>
          <li>
            Pass <code>shadowDOM: false</code> to render into the custom
            element’s light DOM instead.
          </li>
          <li>
            Use the optional second argument to receive
            <code>output(payload)</code> calls from inside the sandbox.
          </li>
          <li>
            Use the optional third argument to expose host bridge modules that
            sandbox code can import directly.
          </li>
        </ul>

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          Usage
        </h3>
        ${TsCodeBlock(`import { html } from '@arrow-js/core'
import { sandbox } from '@arrow-js/sandbox'

const source = {
  'main.ts': [
    "import { html, reactive } from '@arrow-js/core'",
    "import { formatCount } from 'host-bridge:demo'",
    '',
    'const state = reactive({ count: 0 })',
    '',
    'export default html\`<button @click="\${() => state.count++}">',
    '  \${() => formatCount(state.count)}',
    '</button>\`',
  ].join('\\n'),
}

html\`<main>\${sandbox({ source }, {
  output(payload) {
    console.log(payload)
  },
}, {
  'host-bridge:demo': {
    formatCount(count) {
      return 'Count ' + count
    },
  },
})}</main>\``)}

        <div class="callout callout-tip">
          <div class="callout-label">Security Model</div>
          <p>
            User-authored Arrow code runs inside QuickJS/WASM. The host page
            only mounts trusted DOM and forwards sanitized event payloads. It
            does not run user callbacks in the window realm.
          </p>
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
        ${TsCodeBlock(coreTypeReferenceSnippet)}

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          @arrow-js/framework
        </h3>
        ${TsCodeBlock(frameworkTypeReferenceSnippet)}

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          @arrow-js/ssr
        </h3>
        ${TsCodeBlock(ssrTypeReferenceSnippet)}

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          @arrow-js/hydrate
        </h3>
        ${TsCodeBlock(hydrateTypeReferenceSnippet)}

        <h3
          class="text-lg font-semibold text-zinc-900 dark:text-white pt-4"
        >
          @arrow-js/sandbox
        </h3>
        ${TsCodeBlock(sandboxTypeReferenceSnippet)}
      </div>
    </section>
  `
}

export const HighlightedReactiveApi = highlightedSection(
  ReactiveApi,
  'api-reactive'
)
export const HighlightedWatchApi = highlightedSection(
  WatchApi,
  'api-watch'
)
export const HighlightedHtmlApi = highlightedSection(
  HtmlApi,
  'api-html'
)
export const HighlightedSvgApi = highlightedSection(
  SvgApi,
  'api-svg'
)
export const HighlightedComponentApi = highlightedSection(
  ComponentApi,
  'api-component'
)
export const HighlightedOnCleanupApi = highlightedSection(
  OnCleanupApi,
  'api-on-cleanup'
)
export const HighlightedPickApi = highlightedSection(
  PickApi,
  'api-pick'
)
export const HighlightedNextTickApi = highlightedSection(
  NextTickApi,
  'api-next-tick'
)
export const HighlightedRenderApi = highlightedSection(
  RenderApi,
  'api-render'
)
export const HighlightedBoundaryApi = highlightedSection(
  BoundaryApi,
  'api-boundary'
)
export const HighlightedToTemplateApi = highlightedSection(
  ToTemplateApi,
  'api-to-template'
)
export const HighlightedRenderDocumentApi = highlightedSection(
  RenderDocumentApi,
  'api-render-document'
)
export const HighlightedRenderToStringApi = highlightedSection(
  RenderToStringApi,
  'api-render-to-string'
)
export const HighlightedSerializePayloadApi = highlightedSection(
  SerializePayloadApi,
  'api-serialize-payload'
)
export const HighlightedHydrateApi = highlightedSection(
  HydrateApi,
  'api-hydrate'
)
export const HighlightedReadPayloadApi = highlightedSection(
  ReadPayloadApi,
  'api-read-payload'
)
export const HighlightedSandboxApi = highlightedSection(
  SandboxApi,
  'api-sandbox'
)
export const HighlightedTypesReference = highlightedSection(
  TypesReference,
  'api-types'
)
