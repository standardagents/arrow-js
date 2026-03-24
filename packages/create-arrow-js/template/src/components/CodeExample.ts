import { html } from '@arrow-js/core'

export function CodeExample() {
  return html`<div class="card">
    <p class="section__label">The basics</p>
    <p class="card__copy">
      Everything you need in three imports. No build step required,
      no virtual DOM, just tagged templates and proxies.
    </p>
    <pre class="code-block"><span class="kw">import</span> <span class="hl">{ html, reactive }</span> <span class="kw">from</span> <span class="str">'@arrow-js/core'</span>

<span class="kw">const</span> <span class="hl">data</span> = <span class="fn">reactive</span>({ count: <span class="pr">0</span> })

<span class="fn">html</span><span class="str">\`</span>
  <span class="tag">&lt;button</span> <span class="pr">@click</span>=<span class="str">"\${() => data.count++}"</span><span class="tag">&gt;</span>
    Clicks: <span class="str">\${() => data.count}</span>
  <span class="tag">&lt;/button&gt;</span>
<span class="str">\`</span>(<span class="hl">document</span>.<span class="fn">getElementById</span>(<span class="str">'app'</span>))</pre>
  </div>`
}
