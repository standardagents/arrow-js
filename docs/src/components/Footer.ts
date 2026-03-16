import { html } from '@arrow-js/core'

export function Footer() {
  return html`
    <footer class="border-t border-zinc-200 dark:border-zinc-800 mt-24">
      <div
        class="max-w-7xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-500 dark:text-zinc-500"
      >
        <p>
          Built with Arrow by
          <a
            href="https://twitter.com/jpschroeder"
            class="text-zinc-700 dark:text-zinc-300 hover:text-arrow-500 transition-colors"
            target="_blank"
            rel="noopener"
          >
            Justin Schroeder</a
          >. Open Source under MIT.
        </p>
        <div class="flex items-center gap-6">
          <a
            href="https://github.com/justin-schroeder/arrow-js"
            class="hover:text-arrow-500 transition-colors"
            target="_blank"
            rel="noopener"
          >
            GitHub
          </a>
          <a
            href="https://x.com/intent/follow?screen_name=jpschroeder"
            class="hover:text-arrow-500 transition-colors"
            target="_blank"
            rel="noopener"
          >
            Twitter
          </a>
        </div>
      </div>
    </footer>
  `
}
