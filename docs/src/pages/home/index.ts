import { html } from '@arrow-js/core'
import { Hero } from './Hero'
import { ScrollSpyNav } from '../../components/ScrollSpyNav'
import type { NavGroup } from '../../components/ScrollSpyNav'
import {
  WhatIsArrow,
  Quickstart,
  Components,
  ReactiveData,
  WatchingData,
  Templates,
  ServerRendering,
  Examples,
} from '../docs/content'

const homeNavGroups: NavGroup[] = [
  {
    title: 'Essentials',
    items: [
      { id: 'what-is-arrow', label: 'What is Arrow' },
      { id: 'quick-start', label: 'Quickstart' },
      { id: 'components', label: 'Components' },
    ],
  },
  {
    title: 'Core Concepts',
    items: [
      { id: 'reactive-data', label: 'Reactive Data' },
      { id: 'watching-data', label: 'Watching Data' },
      { id: 'templates', label: 'Templates' },
      { id: 'ssr', label: 'Server Rendering' },
    ],
  },
  {
    title: 'Examples',
    items: [{ id: 'examples', label: 'Playground' }],
  },
]

export function HomePage() {
  const nav = ScrollSpyNav(homeNavGroups)
  return html`
    <div>
      ${Hero()}
      ${nav.mobile()}

      <div class="max-w-7xl mx-auto px-6 pt-20 pb-12">
        <div class="flex gap-12">
          ${nav.sidebar()}
          <article class="min-w-0 max-w-3xl flex-1">
            ${WhatIsArrow()} ${Quickstart()} ${Components()}
            ${ReactiveData()} ${WatchingData()} ${Templates()}
            ${ServerRendering()} ${Examples()}
          </article>
        </div>
      </div>
    </div>
  `
}
