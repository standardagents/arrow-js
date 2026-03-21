import { html } from '@arrow-js/core'
import {
  docsExampleMeta,
  playgroundExampleHref,
  starterExampleId,
} from '../../../play/example-meta.js'
import { CodeBlock } from '../../components/CodeBlock'
import { CliCommandIsland } from '../../components/CliCommand'
import { CopyableSnippet } from '../../components/CopyableSnippet'
import { TsCodeBlock } from '../../components/TsCodeBlock'
import { highlightedSection } from '../../components/highlighted-section'

/**
 * All docs content sections. Each is a plain function — no local state needed
 * for static documentation content. The component() wrapper is reserved for
 * interactive widgets with local state.
 */

export function WhyArrow() {
  return html`
    <section id="why-arrow" class="mb-16">
      <h2
        class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4"
      >
        Why Arrow
      </h2>
      <div class="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>
          Arrow is a reactive UI framework built around JavaScript primitives:
          Modules, functions, and template literals. Arrow is just TypeScript, so your coding agent already knows how to use it really well.
        </p>
        <p>You only need 3 functions:</p>
        <ul>
          <li><code>reactive</code></li>
          <li><code>html</code></li>
          <li><code>component</code></li>
        </ul>
        <p>
           Unlike other major frameworks, there is no "idomatic" way to use Arrow since it's just TypeScript functions and template literals. The entire documentation fits in less than 5% of a 200k context window.
        </p>
        <p>
          Arrow requires no build step, no JSX compilation, no React compiler, no Vite plugin (there is one if you need SSR), no Vue template complier, and yet it runs incredibly fast at less than 5kb over the wire. When coupled with the <a href="#sandbox" class="text-arrow-600 dark:text-arrow-400 underline underline-offset-2">Arrow sandbox</a>, it's perfect for interfaces produced by chat agents too.
        </p>
      </div>
    </section>
  `
}

export interface DocsContentOptions {
  highlightCode?: boolean
}

export function Quickstart(options: DocsContentOptions = {}) {
  const highlightCode = options.highlightCode !== false

  return html`
    <section id="quick-start" class="mb-16">
      <h2
        class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4"
      >
        Quickstart
      </h2>
      <div class="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>
          Scaffold a complete Vite 8 Arrow app with SSR, hydration, route-based
          metadata, and the full framework stack in one command:
        </p>

        ${CliCommandIsland()}

        <h3 class="text-lg font-semibold text-zinc-900 dark:text-white pt-6">
          Coding agent skill
        </h3>
        <p>
          Install the Arrow coding agent skill wrapper if you want the same
          project-specific guidance in tools like Codex and Claude Code.
        </p>

        ${CliCommandIsland({
          command: 'npx @arrow-js/skill@latest',
          ariaLabel: 'Copy Arrow coding agent skill install command',
        })}

        <h3 class="text-lg font-semibold text-zinc-900 dark:text-white pt-6">
          Other ways to install
        </h3>
        <p>
          Arrow still works fine without a build tool. If you only need the core
          runtime, a simple module import is enough.
        </p>

        <h4 class="font-semibold text-zinc-800 dark:text-zinc-200">
          From npm:
        </h4>
        ${CodeBlock({
          lang: 'shell',
          code: 'npm install @arrow-js/core',
        }, highlightCode)}

        <h4 class="font-semibold text-zinc-800 dark:text-zinc-200">
          From a CDN:
        </h4>
        ${CodeBlock({
          lang: 'html',
          code: `&lt;script type="module"&gt;
  import { reactive, html } from 'https://esm.sh/@arrow-js/core'
&lt;/script&gt;`,
        }, highlightCode)}

        <h3 class="text-lg font-semibold text-zinc-900 dark:text-white pt-4">
          Editor support
        </h3>
        <p>
          Install the official
          <a
            href="https://marketplace.visualstudio.com/items?itemName=StandardAgents.arrowjs-syntax"
            class="text-arrow-600 dark:text-arrow-400 underline underline-offset-2"
          >ArrowJS Syntax</a>
          extension for VSCode to get syntax highlighting and
          autocomplete inside <code>html</code> template literals.
          Arrow also ships TypeScript definitions for full editor support.
        </p>

      </div>
    </section>
  `
}

export function Community() {
  return html`
    <section id="community" class="mb-16">
      <h2
        class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4"
      >
        Community
      </h2>
      <div class="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>
          Join the
          <a
            href="https://discord.gg/fBy7csvmAt"
            class="text-arrow-600 dark:text-arrow-400 underline underline-offset-2"
          >Arrow Discord</a>
          to ask questions, share what you're building, and connect with
          other developers using Arrow.
        </p>
        <p>
          Follow the author
          <a
            href="https://x.com/intent/follow?screen_name=jpschroeder"
            class="text-arrow-600 dark:text-arrow-400 underline underline-offset-2"
            target="_blank"
            rel="noopener"
          >Justin Schroeder</a>
          on X for updates, releases, and behind-the-scenes development.
        </p>
        <p>
          Browse the source, report issues, and contribute on
          <a
            href="https://github.com/standardagents/arrow-js"
            class="text-arrow-600 dark:text-arrow-400 underline underline-offset-2"
            target="_blank"
            rel="noopener"
          >GitHub</a>.
        </p>
      </div>
    </section>
  `
}

export function Components() {
  return html`
    <section id="components" class="mb-16">
      <h2
        class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4"
      >
        Components
      </h2>
      <div class="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>
          Arrow components are plain functions wrapped with
          <code>component()</code>. A component mounts once per render slot and
          keeps local state while that slot survives parent rerenders.
        </p>
        <ul class="list-disc pl-6 space-y-2">
          <li>Pass a reactive object as props.</li>
          <li>
            Read props lazily inside expressions like
            <code>() =&gt; props.count</code>.
          </li>
          <li>
            Keep local component state with <code>reactive()</code> inside the
            component.
          </li>
          <li>
            Use <code>.key(...)</code> when rendering components in keyed lists.
          </li>
        </ul>

        <div class="code-block">
          <pre><code class="language-ts">import { component, html, onCleanup, reactive } from '@arrow-js/core'
import type { Props } from '@arrow-js/core'

const parentState = reactive({ count: 1 })

const Counter = component((props: Props&lt;{ count: number }&gt;) =&gt; {
  const local = reactive({ clicks: 0 })
  const onResize = () =&gt; console.log(window.innerWidth)

  window.addEventListener('resize', onResize)
  onCleanup(() =&gt; window.removeEventListener('resize', onResize))

  return html\`&lt;button @click="\${() =&gt; local.clicks++}"&gt;
    Root count \${() =&gt; props.count} | Local clicks \${() =&gt; local.clicks}
  &lt;/button&gt;\`
})

html\`&lt;section&gt;
  &lt;h3&gt;Dashboard&lt;/h3&gt;
  \${Counter(parentState)}
&lt;/section&gt;\`</code></pre>
        </div>

        <div class="callout callout-tip">
          <div class="callout-label">Key concept</div>
          <p>
            The component function itself is not rerun on every parent update.
            Arrow keeps the instance for that slot and retargets its props when
            needed. That makes local state stable across higher-order rerenders.
          </p>
        </div>

        <p>
          In the common case, just pass a reactive object directly as the
          component props.
        </p>

        <div class="code-block">
          <pre><code class="language-ts">import { component, html, reactive } from '@arrow-js/core'

const state = reactive({ count: 1, theme: 'dark' })
const Counter = component((props) =&gt;
  html\`&lt;strong&gt;\${() =&gt; props.count}&lt;/strong&gt;\`
)

html\`&lt;p&gt;
  Current count:
  \${Counter(state)}
&lt;/p&gt;\`</code></pre>
        </div>

        <div class="callout callout-tip">
          <div class="callout-label">Tip</div>
          <p>
            Props stay live when you read them lazily. Avoid destructuring them
            once at component creation time if you expect updates.
          </p>
        </div>

        <p>
          Use <code>onCleanup()</code> inside a component when you set up
          manual listeners, timers, or sockets that need teardown when the
          component slot unmounts.
        </p>

        <h3 class="text-lg font-semibold text-zinc-900 dark:text-white pt-4">
          Async components
        </h3>
        <p>
          The same core <code>component()</code> also accepts async factories
          when the Arrow async runtime is present:
        </p>

        <div class="code-block">
          <pre><code class="language-ts">import { component, html } from '@arrow-js/core'
import type { Props } from '@arrow-js/core'

type User = { id: string; name: string }

const UserName = component(
  async ({ id }: Props&lt;{ id: string }&gt;) =&gt; {
    const user = await fetch(\`/api/users/\${id}\`)
      .then((r) =&gt; r.json() as Promise&lt;User&gt;)
    return user.name
  },
  { fallback: html\`&lt;span&gt;Loading user…&lt;/span&gt;\` }
)

const UserCard = component((props: Props&lt;{ id: string }&gt;) =&gt;
  html\`&lt;article&gt;\${UserName(props)}&lt;/article&gt;\`
)</code></pre>
        </div>

        <p>
          The async body resolves data, and the surrounding template stays
          reactive in the usual Arrow way. SSR waits for async components to
          settle, and hydration resumes JSON-safe results from serialized
          payload data automatically.
        </p>

        <div class="callout callout-tip">
          <div class="callout-label">Tip</div>
          <p>
            Most async components need no extra options. Arrow assigns ids,
            snapshots JSON-safe results, and renders resolved values directly by
            default. Reach for <code>fallback</code>, <code>render</code>,
            <code>serialize</code>, <code>deserialize</code>, or
            <code>idPrefix</code> only when the default behavior is not enough.
          </p>
        </div>
      </div>
    </section>
  `
}

export function ReactiveData() {
  return html`
    <section id="reactive-data" class="mb-16">
      <h2
        class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4"
      >
        Reactive Data
      </h2>
      <div class="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>
          <code>reactive()</code> turns plain objects, arrays, or expressions
          into live state that Arrow (or anyone else) can track and update from.
        </p>
        <p>
          <code>reactive(value)</code> or <code>reactive(() =&gt; value)</code>
        </p>
        <ul class="list-disc pl-6 space-y-2">
          <li>Wrap objects or arrays to create observable state.</li>
          <li>Pass an expression to create a computed value.</li>
          <li>
            Use it for local component state, shared stores, and mutable props.
          </li>
          <li>
            Read properties normally. Arrow tracks those reads inside watchers
            and template expressions.
          </li>
          <li>
            Use <code>$on</code> and <code>$off</code> when you want manual
            subscriptions.
          </li>
        </ul>

        <div class="code-block">
          <pre><code class="language-ts">import { reactive } from '@arrow-js/core'

const data = reactive({
  price: 25,
  quantity: 10
})

console.log(data.price) // 25</code></pre>
        </div>

        <h3 class="text-lg font-semibold text-zinc-900 dark:text-white pt-4">
          Computed values
        </h3>
        <p>
          <code>reactive(() =&gt; value)</code> reruns when its tracked reads
          change.
        </p>

        <div class="code-block">
          <pre><code class="language-ts">import { reactive } from '@arrow-js/core'

const props = reactive({ count: 2, multiplier: 10 })

const data = reactive({
  total: reactive(() =&gt; props.count * props.multiplier)
})

console.log(data.total) // 20
props.count = 3
console.log(data.total) // 30</code></pre>
        </div>

        <div class="callout callout-tip">
          <div class="callout-label">Tip</div>
          <p>
            <code>data.total</code> reads like a normal value even though it is
            backed by a tracked expression.
          </p>
        </div>
      </div>
    </section>
  `
}

export function WatchingData() {
  return html`
    <section id="watching-data" class="mb-16">
      <h2
        class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4"
      >
        Watching Data
      </h2>
      <div class="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>
          <code>watch(effect)</code> or
          <code>watch(getter, afterEffect)</code>
        </p>
        <ul class="list-disc pl-6 space-y-2">
          <li>Use it for derived side effects outside templates.</li>
          <li>
            Dependencies are discovered automatically from reactive reads.
          </li>
          <li>
            Arrow also drops dependencies that are no longer touched on later
            runs.
          </li>
          <li>
            Watchers created inside a component are stopped automatically when
            that component unmounts.
          </li>
        </ul>

        <p>Single-effect form:</p>
        <div class="code-block">
          <pre><code class="language-ts">import { reactive, watch } from '@arrow-js/core'

const data = reactive({ price: 25, quantity: 10, logTotal: true })

watch(() =&gt; {
  if (data.logTotal) {
    console.log(\`Total: \${data.price * data.quantity}\`)
  }
})</code></pre>
        </div>

        <p>Getter plus effect form:</p>
        <div class="code-block">
          <pre><code class="language-ts">import { reactive, watch } from '@arrow-js/core'

const data = reactive({ price: 25, quantity: 10, logTotal: true })

watch(
  () =&gt; data.logTotal ? data.price * data.quantity : null,
  (total) =&gt; total !== null && console.log(\`Total: \${total}\`)
)</code></pre>
        </div>
      </div>
    </section>
  `
}

export function Templates() {
  return html`
    <section id="templates" class="mb-16">
      <h2
        class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4"
      >
        Templates
      </h2>
      <div class="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>
          To render DOM elements with Arrow you use the
          <code>html</code> tagged template literal.
        </p>
        <p><code>html\`...\`</code> &mdash; create a mountable template</p>
        <ul class="list-disc pl-6 space-y-2">
          <li>
            Templates can be mounted directly, passed around, or returned from
            components.
          </li>
          <li>
            Expression slots are static by default, but if callable functions
            are provided they will update when their respective reactive data is
            changed. In other words <code>\${data.foo}</code> is static but
            <code>\${() =&gt; data.foo}</code> is reactive.
          </li>
          <li>
            Templates can render text, attributes, properties, lists, nested
            templates, and events.
          </li>
        </ul>

        <p>
          Plain values render once. If you pass a function like
          <code>() =&gt; data.count</code>, Arrow tracks the reactive reads inside
          that function and updates only that part of the template when they
          change.
        </p>

        <h3 class="text-lg font-semibold text-zinc-900 dark:text-white pt-4">
          Attributes
        </h3>
        <p>Use a function expression to keep an attribute in sync.</p>
        <div class="code-block">
          <pre><code class="language-ts">import { html, reactive } from '@arrow-js/core'

const data = reactive({ disabled: false })

html\`&lt;button disabled="\${() =&gt; data.disabled}"&gt;
  Save
&lt;/button&gt;\`</code></pre>
        </div>
        <div class="callout callout-tip">
          <div class="callout-label">Tip</div>
          <p>
            Returning <code>false</code> from an attribute expression will
            remove the attribute. This makes it easy to toggle attributes.
          </p>
        </div>
        <div class="code-block">
          <pre><code class="language-ts">import { html, reactive } from '@arrow-js/core'

const data = reactive({ disabled: false })

html\`&lt;button disabled="\${() =&gt; data.disabled ? true : false}"&gt;
  Save
&lt;/button&gt;\`</code></pre>
        </div>
        <h3 class="text-lg font-semibold text-zinc-900 dark:text-white pt-4">
          Lists
        </h3>
        <p>
          Return an array of templates to render a list. Add
          <code>.key(...)</code> when identity must survive reorders.
        </p>
        <div class="code-block">
          <pre><code class="language-ts">import { html, reactive } from '@arrow-js/core'

const data = reactive({
  todos: [
    { id: 1, text: 'Write docs' },
    { id: 2, text: 'Ship app' },
  ],
})

html\`&lt;ul&gt;
  \${() =&gt; data.todos.map((todo) =&gt;
    html\`&lt;li&gt;\${todo.text}&lt;/li&gt;\`.key(todo.id)
  )}
&lt;/ul&gt;\`</code></pre>
        </div>
        <div class="callout callout-tip">
          <div class="callout-label">Tip</div>
          <p>
            Keys are only necessary if you want to preserve the DOM nodes and
            their state. Avoid using the index as a key.
          </p>
        </div>
        <div class="code-block">
          <pre><code class="language-ts">import { html, reactive } from '@arrow-js/core'

const data = reactive({ tags: ['alpha', 'beta', 'gamma'] })

html\`&lt;ul&gt;
  \${() =&gt; data.tags.map((tag) =&gt; html\`&lt;li&gt;\${tag}&lt;/li&gt;\`)}
&lt;/ul&gt;\`</code></pre>
        </div>

        <h3 class="text-lg font-semibold text-zinc-900 dark:text-white pt-4">
          Events
        </h3>
        <p><code>@eventName</code> attaches an event listener.</p>
        <div class="code-block">
          <pre><code class="language-ts">import { html } from '@arrow-js/core'

html\`&lt;button @click="\${(e) =&gt; console.log(e)}"&gt;Click&lt;/button&gt;\`</code></pre>
        </div>
      </div>
    </section>
  `
}

export function SandboxGuide() {
  const agentPrompt = `Build this UI as an Arrow sandbox payload. Return an object for sandbox({ source, ... }) with exactly one entry file named main.ts or main.js, plus main.css only if styles are needed. Use @arrow-js/core primitives directly: reactive(...) for state, html\`...\` for DOM, and component(...) only when reusable local state or composition is actually needed. Arrow expression slots are static by default, so any live value must be wrapped in a callable function like \${() => state.count}. Use event bindings like @click="\${() => state.count++}", do not use JSX, React hooks, Vue directives, direct DOM mutation, or framework-specific render APIs.

Export a default Arrow template or component result from main.ts. Keep the example self-contained, prefer a single clear root view, and communicate back to the host with output(payload) when needed. Put CSS in main.css, keep payloads JSON-serializable, and only return the files that are necessary for the requested interface. If you create multiple files, make sure imports match the virtual filenames you place in source.`

  const sandboxTool = `{
  "name": "create_arrow_sandbox",
  "description": "Produce arguments for @arrow-js/sandbox.",
  "inputSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "source": {
        "type": "object",
        "description": "Virtual files passed to sandbox({ source }). Must include main.ts or main.js. main.css is optional.",
        "additionalProperties": false,
        "properties": {
          "main.ts": {
            "type": "string",
            "description": "Main Arrow TypeScript entry file."
          },
          "main.js": {
            "type": "string",
            "description": "Main Arrow JavaScript entry file."
          },
          "main.css": {
            "type": "string",
            "description": "Optional stylesheet for the sandbox root."
          }
        },
        "anyOf": [
          { "required": ["main.ts"] },
          { "required": ["main.js"] }
        ]
      },
      "shadowDOM": {
        "type": "boolean",
        "description": "Whether the sandbox should render inside shadow DOM."
      },
      "debug": {
        "type": "boolean",
        "description": "Whether sandbox debug logging should be enabled."
      }
    },
    "required": ["source"]
  }
}`

  return html`
    <section id="sandbox" class="mb-16">
      <h2
        class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4"
      >
        Sandbox
      </h2>
      <div class="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>
          <code>@arrow-js/sandbox</code> lets you run JS/TS/Arrow inside
          a WASM virtual machine while the host page keeps ownership of the real DOM rendered by <code>html()</code>. These two environments only communicate through serialized messages, which allows safe execution of AI-generated code and makes the sandbox a good fit for inline UI produced by chat agents.
        </p>
        <ul class="list-disc pl-6 space-y-2">
          <li>
            <code>source</code> must include exactly one
            <code>main.ts</code> or <code>main.js</code> entry file.
          </li>
          <li>
            <code>main.css</code> is optional and is injected into the sandbox
            host root.
          </li>
          <li>
            The sandbox renders through a stable <code>&lt;arrow-sandbox&gt;</code>
            custom element.
          </li>
          <li>
            Call <code>output(payload)</code> inside sandboxed code to send data
            back through the optional <code>events.output</code> handler.
          </li>
        </ul>

        ${TsCodeBlock(`import { html } from '@arrow-js/core'
import { sandbox } from '@arrow-js/sandbox'

const root = document.getElementById('app')
if (!root) throw new Error('Missing #app root')

const source = {
  'main.ts': [
    "import { html, reactive } from '@arrow-js/core'",
    '',
    'const state = reactive({ count: 0 })',
    '',
    'export default html\`<button @click="\${() => state.count++}">',
    '  Count \${() => state.count}',
    '</button>\`',
  ].join('\\n'),
  'main.css': [
    'button {',
    '  font: inherit;',
    '  padding: 0.75rem 1rem;',
    '}',
  ].join('\\n'),
}

html\`<section>\${sandbox({ source })}</section>\`(root)`)}
        <a
          href="${playgroundExampleHref('sandbox')}"
          class="playground-cta"
        >
          <span class="playground-cta-label">Live Demo</span>
          <span class="playground-cta-heading">See sandbox isolation in action</span>
          <span class="playground-cta-desc"
            >A full interactive example showing reactivity inside the VM,
            blocked browser globals, and the restricted fetch bridge.</span
          >
          <span class="playground-cta-action"
            >Open in Playground<span aria-hidden="true"> &rarr;</span></span
          >
        </a>

        <h3 class="text-lg font-semibold text-zinc-900 dark:text-white pt-4">
          Prompt for agents
        </h3>
        <p>
          If you want an agent to generate a sandbox payload directly, this
          prompt keeps the output narrow and aligned with Arrow.
        </p>
        ${CopyableSnippet({
          label: 'Agent Prompt',
          language: 'md',
          source: agentPrompt,
        })}

        <h3 class="text-lg font-semibold text-zinc-900 dark:text-white pt-4">
          JSON schema tool
        </h3>
        <p>
          If your agent supports tool calling, this schema produces the exact
          argument object expected by <code>sandbox()</code>.
        </p>
        ${CopyableSnippet({
          label: 'create_arrow_sandbox',
          language: 'json',
          source: sandboxTool,
        })}
      </div>
    </section>
  `
}

export function ServerRendering() {
  return html`
    <section id="ssr" class="mb-16">
      <h2
        class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4"
      >
        Server Rendering
      </h2>
      <div class="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>
          <code>render(root, view)</code> and
          <code>renderToString(view)</code>
        </p>
        <ul class="list-disc pl-6 space-y-2">
          <li>
            <code>@arrow-js/core</code> stays DOM-first and framework-agnostic.
          </li>
          <li>
            <code>@arrow-js/framework</code> adds async render tracking and
            boundaries.
          </li>
          <li><code>@arrow-js/ssr</code> renders HTML and payload data.</li>
          <li>
            <code>@arrow-js/hydrate</code> resumes the same view in the browser.
          </li>
        </ul>
        <p>
          During SSR, <code>renderToString()</code> waits for nested async
          components and dependent async work before it returns HTML.
        </p>
      </div>
    </section>

    <section id="hydration" class="mb-16">
      <h2
        class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4"
      >
        Hydration
      </h2>
      <div class="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>
          <code>hydrate(root, view, payload)</code>
        </p>
        <ul class="list-disc pl-6 space-y-2">
          <li>The server emits HTML plus a small JSON payload.</li>
          <li>
            The client stages the same view, adopts matching DOM, and reconnects
            reactivity.
          </li>
          <li>
            JSON-safe async results resume from serialized payload data, so
            matching components do not refetch.
          </li>
          <li>
            If a subtree does not match, Arrow repairs marked boundaries before
            falling back further up.
          </li>
        </ul>
      </div>
    </section>

    <section id="ecosystem" class="mb-16">
      <h2
        class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4"
      >
        Ecosystem Packages
      </h2>
      <div class="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>The current split is intentionally simple:</p>
        <ul class="list-disc pl-6 space-y-2">
          <li>
            <code>@arrow-js/core</code> exposes <code>reactive</code>,
            <code>watch</code>, <code>html</code>, and the stable
            <code>component</code> primitive.
          </li>
          <li>
            <code>@arrow-js/framework</code> installs the async runtime behind
            <code>component()</code>, and adds <code>boundary()</code> and
            <code>render()</code>.
          </li>
          <li>
            <code>@arrow-js/ssr</code> exposes <code>renderToString()</code> and
            <code>serializePayload()</code>.
          </li>
          <li>
            <code>@arrow-js/hydrate</code> exposes <code>hydrate()</code> and
            <code>readPayload()</code>.
          </li>
        </ul>
        <div class="callout callout-tip">
          <div class="callout-label">Tip</div>
          <p>
            If the default async behavior works for your case, keep the
            component declaration simple. The option bag is for custom
            fallbacks, custom serialization, or easier-to-read SSR ids, not for
            the common case.
          </p>
        </div>
      </div>
    </section>
  `
}

export function Routing() {
  return html`
    <section id="routing" class="mb-16">
      <h2
        class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4"
      >
        Routing
      </h2>
      <div class="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>
          The Vite scaffold uses a simple <code>routeToPage(url)</code> entry so
          the server and browser both resolve the same route tree.
        </p>
        <ul class="list-disc pl-6 space-y-2">
          <li>Choose a route from the incoming URL.</li>
          <li>Return the page status, metadata, and Arrow view together.</li>
          <li>
            Reuse the same routing function for SSR and hydration so both sides
            render the same page shape.
          </li>
        </ul>

        ${TsCodeBlock(`import { html } from '@arrow-js/core'

export function routeToPage(url: string) {
  if (url === '/') {
    return {
      status: 200,
      title: 'Home',
      view: html\`<main>Home</main>\`,
    }
  }

  return {
    status: 404,
    title: 'Not Found',
    view: html\`<main>Not found</main>\`,
  }
}`)}
      </div>
    </section>
  `
}

interface ExampleEntry {
  id: string
  title: string
  description: string
  icon?: string
  sourceUrl?: string
}

const examples = docsExampleMeta as ExampleEntry[]

export function Examples() {
  return html`
    <section id="examples" class="mb-16">
      <h2
        class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4"
      >
        Examples
      </h2>
      <div class="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>
          Each example runs in the playground with full source you can edit
          live.
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          ${examples.map(
            (entry) => html`
              <a
                href="${playgroundExampleHref(entry.id)}"
                class="group block rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 no-underline transition-colors hover:border-arrow-400 dark:hover:border-arrow-600 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <h3
                  class="text-base font-semibold text-zinc-900 dark:text-white mb-1.5"
                >
                  <span class="mr-1.5 example-icon">${entry.icon}</span>${entry.title}
                </h3>
                <p class="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                  ${entry.description}
                </p>
                <span
                  class="text-sm font-medium text-arrow-600 dark:text-arrow-400 group-hover:underline underline-offset-2 transition-colors"
                >Open in Playground &rarr;</span>
              </a>
            `,
          )}
        </div>

        <a
          href="${playgroundExampleHref(starterExampleId)}"
          class="playground-cta"
        >
          <span class="playground-cta-label">Playground</span>
          <span class="playground-cta-heading">Build something with Arrow</span>
          <span class="playground-cta-desc"
            >Open a live editor with a starter template, hot reloading, and
            every Arrow package ready to import.</span
          >
          <span class="playground-cta-action"
            >Open Playground<span aria-hidden="true"> &rarr;</span></span
          >
        </a>
      </div>
    </section>
  `
}

export const HighlightedWhyArrow = highlightedSection(
  WhyArrow,
  'docs-why-arrow'
)
export const HighlightedComponents = highlightedSection(
  Components,
  'docs-components'
)
export const HighlightedReactiveData = highlightedSection(
  ReactiveData,
  'docs-reactive-data'
)
export const HighlightedWatchingData = highlightedSection(
  WatchingData,
  'docs-watching-data'
)
export const HighlightedTemplates = highlightedSection(
  Templates,
  'docs-templates'
)
export const HighlightedSandboxGuide = highlightedSection(
  SandboxGuide,
  'docs-sandbox'
)
export const HighlightedRouting = highlightedSection(
  Routing,
  'docs-routing'
)
export const HighlightedExamples = highlightedSection(
  Examples,
  'docs-examples'
)
