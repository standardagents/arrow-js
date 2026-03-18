import { html } from '@arrow-js/core'

export function Footer() {
  return html`
    <footer class="site-footer border-t border-zinc-200 dark:border-zinc-800 mt-24">
      <div
        class="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm"
      >
        <p>
          Built by
          <a
            href="https://standardagents.com"
            class="text-zinc-700 dark:text-zinc-300 underline decoration-current underline-offset-2 hover:text-arrow-500 transition-colors"
            target="_blank"
            rel="noopener"
          >
            Standard Agents</a
          >. Open Source under MIT.
        </p>
        <div class="flex items-center gap-6">
          <a
            href="https://github.com/standardagents/arrow-js"
            class="hover:text-arrow-500 transition-colors"
            target="_blank"
            rel="noopener"
          >
            GitHub
          </a>
          <a
            href="https://discord.gg/fBy7csvmAt"
            class="hover:text-arrow-500 transition-colors"
            target="_blank"
            rel="noopener"
          >
            Discord
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
