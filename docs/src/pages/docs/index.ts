import { html } from '@arrow-js/core'
import { CopyPageMenu } from '../../components/CopyPageMenu'
import { Navigation } from './Navigation'
import {
  WhyArrow,
  Quickstart,
  Community,
  Components,
  HighlightedComponents,
  ReactiveData,
  HighlightedReactiveData,
  WatchingData,
  HighlightedWatchingData,
  Templates,
  Routing,
  HighlightedTemplates,
  Examples,
  HighlightedExamples,
} from './content'

export function DocsPage(options: { highlightCode?: boolean } = {}) {
  const highlightCode = options.highlightCode !== false
  const ComponentsSection = highlightCode ? HighlightedComponents : Components
  const ReactiveDataSection = highlightCode ? HighlightedReactiveData : ReactiveData
  const WatchingDataSection = highlightCode ? HighlightedWatchingData : WatchingData
  const TemplatesSection = highlightCode ? HighlightedTemplates : Templates
  const ExamplesSection = highlightCode ? HighlightedExamples : Examples

  return html`
    <div class="max-w-7xl mx-auto px-4 sm:px-6 py-12">
      <div class="flex gap-12">
        ${Navigation()}
        <article class="min-w-0 max-w-3xl flex-1">
          <div class="flex items-start justify-between gap-4 mb-8">
            <h1
              class="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white"
            >
              Documentation
            </h1>
            ${CopyPageMenu({ markdownPath: '/docs.md' })}
          </div>

          ${WhyArrow()} ${Quickstart({ highlightCode })}
          ${Community()}
          ${ComponentsSection()}

          <div
            class="border-t border-zinc-200 dark:border-zinc-800 my-12 pt-12"
          >
            <h1
              class="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-8"
            >
              Essentials
            </h1>
          </div>

          ${ReactiveDataSection()} ${WatchingDataSection()}
          ${TemplatesSection()} ${Routing()} ${ExamplesSection()}
        </article>
      </div>
    </div>
  `
}
