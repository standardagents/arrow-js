import { html } from '@arrow-js/core'

export function Philosophy() {
  return html`
    <section class="py-20 md:py-28 px-6 border-t border-zinc-200 dark:border-zinc-800">
      <div class="max-w-3xl mx-auto">
        <p
          class="text-2xl md:text-3xl font-semibold leading-snug text-zinc-900 dark:text-white tracking-tight"
        >
          At its core, Arrow is an admission that while we developers were busy
          falling in love with fancy UI frameworks, JavaScript itself got good
          &mdash; like
          <span class="text-arrow-500">really</span>
          good.
        </p>

        <div class="mt-12 space-y-10 text-zinc-600 dark:text-zinc-400 leading-relaxed">
          <div>
            <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-3">
              Commitment to JavaScript
            </h3>
            <p>
              Arrow relies heavily on modern features: template literals,
              ES modules, and Proxies. There is no special template language.
              Learning Arrow is mostly learning how to use modern native
              JavaScript &mdash; so the concepts here are portable.
            </p>
          </div>

          <div>
            <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-3">
              Commitment to no build tools
            </h3>
            <p>
              Build tools can be useful, but Arrow will never require one.
              It will always be good and right to pull in Arrow from a CDN
              and start building your project right away.
            </p>
          </div>

          <div>
            <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-3">
              Commitment to performance
            </h3>
            <p>
              Arrow is fast. Downloading, booting, and patching are all fast.
              You can generally expect on-par-or-better performance than bigger
              JS framework counterparts. A guilt-free choice for those under a
              performance budget.
            </p>
          </div>
        </div>

        <div class="mt-14 pt-10 border-t border-zinc-200 dark:border-zinc-800 text-center">
          <a
            href="/docs"
            class="inline-flex px-8 py-3.5 bg-arrow-500 text-zinc-950 font-semibold rounded-lg hover:bg-arrow-400 transition-all hover:shadow-lg hover:shadow-arrow-500/20 text-sm"
          >
            Get Started with Arrow
          </a>
        </div>
      </div>
    </section>
  `
}
