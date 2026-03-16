import { html, reactive } from '@arrow-js/core'

const heroData = reactive({ count: 0 })

function scrollToDocs(e: Event) {
  e.preventDefault()
  const el = document.getElementById('what-is-arrow')
  if (el) el.scrollIntoView({ behavior: 'smooth' })
}

export function Hero() {
  return html`
    <section id="hero" class="relative min-h-[92vh] flex flex-col items-center justify-center px-6 pt-20 pb-16 overflow-x-clip">
      <div class="hero-grid absolute inset-0 pointer-events-none"></div>
      <div class="absolute inset-x-0 bottom-0 h-64 pointer-events-none bg-gradient-to-t from-white dark:from-zinc-950 to-transparent"></div>
      <div class="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          class="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-arrow-500/3 dark:bg-arrow-500/4 rounded-full blur-[120px]"
        ></div>
      </div>

      <div class="relative text-center max-w-4xl mx-auto">
        <h1
          data-rain-collider="text"
          class="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tighter leading-[1.0] text-zinc-900 dark:text-white"
        >
          Reactive interfaces in
          <span
            class="text-transparent bg-clip-text bg-gradient-to-r from-arrow-400 via-arrow-500 to-arrow-600"
          >
            pure JavaScript
          </span>
        </h1>

        <p
          class="mt-6 md:mt-8 text-lg md:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed text-balance"
        >
          A tiny
          <span class="font-semibold text-arrow-500">~3KB</span>
          type-safe library for building reactive
          interfaces in native JavaScript &mdash; with full SSR support,
          zero dependencies, and no build step required.
        </p>

        <div class="mt-8 md:mt-10 flex flex-wrap gap-4 justify-center">
          <a
            data-rain-collider
            href="#what-is-arrow"
            @click="${scrollToDocs}"
            class="px-7 py-3 bg-arrow-500 text-zinc-950 font-semibold rounded-lg hover:bg-arrow-400 transition-all hover:shadow-lg hover:shadow-arrow-500/20 text-sm"
          >
            Get Started
          </a>
          <a
            data-rain-collider
            href="https://github.com/justin-schroeder/arrow-js"
            class="px-7 py-3 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-semibold rounded-lg hover:border-arrow-500/50 hover:text-arrow-600 dark:hover:text-arrow-400 transition-all text-sm"
            target="_blank"
            rel="noopener"
          >
            View on GitHub
          </a>
        </div>
      </div>

      <div class="relative mt-14 md:mt-20 w-full max-w-xl mx-auto">
        <div
          data-rain-collider
          class="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 overflow-visible shadow-2xl shadow-zinc-900/5 dark:shadow-arrow-500/5"
        >
          <div
            class="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900 rounded-t-xl"
          >
            <div class="flex gap-1.5">
              <div class="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700"></div>
              <div class="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700"></div>
              <div class="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700"></div>
            </div>
            <span class="ml-2 text-xs text-zinc-400 dark:text-zinc-600 font-mono">
              counter.ts
            </span>
          </div>
          <div class="hero-code">
            <pre><code class="language-ts">import { component, html, reactive } from '@arrow-js/core'

const Counter = component(() =&gt; {
  const data = reactive({ count: 0 })
  return html&#96;
    &lt;button @click="&#36;{() =&gt; data.count++}"&gt;
      Clicked &#36;{() =&gt; data.count} times
    &lt;/button&gt;
  &#96;
})

html&#96;&#36;{Counter()}&#96;(document.body)</code></pre>
          </div>
          <div
            class="border-t border-zinc-200 dark:border-zinc-800 px-5 py-4 rounded-b-xl bg-white dark:bg-zinc-900/80"
          >
            <div class="flex items-center gap-2 mb-3">
              <span class="text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-600">
                Result
              </span>
            </div>
            <button
              @click="${() => heroData.count++}"
              class="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:bg-zinc-200 dark:active:bg-zinc-700 transition-colors cursor-pointer outline-none"
            >
              Clicked ${() => heroData.count} times
            </button>
          </div>
        </div>
      </div>
    </section>
  `
}
