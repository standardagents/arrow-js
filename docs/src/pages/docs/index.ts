import { html } from '@arrow-js/core'
import { Navigation } from './Navigation'
import {
  WhatIsArrow,
  Quickstart,
  Components,
  ReactiveData,
  WatchingData,
  Templates,
  ServerRendering,
  Examples,
} from './content'

export function DocsPage() {
  return html`
    <div class="max-w-7xl mx-auto px-6 py-12">
      <div class="flex gap-12">
        ${Navigation()}
        <article class="min-w-0 max-w-3xl flex-1">
          <h1
            class="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-8"
          >
            Documentation
          </h1>

          ${WhatIsArrow()} ${Quickstart()} ${Components()}

          <div
            class="border-t border-zinc-200 dark:border-zinc-800 my-12 pt-12"
          >
            <h1
              class="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-8"
            >
              API Reference
            </h1>
          </div>

          ${ReactiveData()} ${WatchingData()} ${Templates()}
          ${ServerRendering()} ${Examples()}
        </article>
      </div>
    </div>
  `
}
