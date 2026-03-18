import { html } from '@arrow-js/core'
import { CopyPageMenuIsland } from '../../components/CopyPageMenu'
import { Hero } from './Hero'
import { ScrollSpyNav } from '../../components/ScrollSpyNav'
import { homeNavGroups } from './nav'
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
} from '../docs/content'

export function HomePage(
  options: { highlightCode?: boolean } = {}
) {
  const highlightCode = options.highlightCode !== false
  const nav = ScrollSpyNav(homeNavGroups)
  const ComponentsSection = highlightCode ? HighlightedComponents : Components
  const ReactiveDataSection = highlightCode ? HighlightedReactiveData : ReactiveData
  const WatchingDataSection = highlightCode ? HighlightedWatchingData : WatchingData
  const TemplatesSection = highlightCode ? HighlightedTemplates : Templates
  const ExamplesSection = highlightCode ? HighlightedExamples : Examples

  return html`
    <div>
      ${Hero({ highlightCode })}
      <div id="home-mobile-nav-root">${nav.mobile()}</div>

      <div class="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-12">
        <div class="flex gap-12">
          <div id="home-sidebar-nav-root">${nav.sidebar()}</div>
          <article class="min-w-0 max-w-3xl flex-1">
            <div class="flex justify-end mb-4">
              ${CopyPageMenuIsland({ markdownPath: '/docs.md' })}
            </div>
            ${WhyArrow()} ${Quickstart({ highlightCode })}
            ${Community()}
            ${ComponentsSection()} ${ReactiveDataSection()}
            ${WatchingDataSection()} ${TemplatesSection()}
            ${Routing()} ${ExamplesSection()}
          </article>
        </div>
      </div>
    </div>
  `
}
