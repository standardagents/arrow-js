import type { NavGroup } from '../../components/ScrollSpyNav'
import {
  docsExampleMeta,
  playgroundExampleHref,
} from '../../../play/example-meta.js'

export const homeNavGroups: NavGroup[] = [
  {
    title: 'Getting Started',
    items: [
      { id: 'why-arrow', label: 'Why Arrow' },
      { id: 'quick-start', label: 'Quickstart' },
      { id: 'community', label: 'Community' },
    ],
  },
  {
    title: 'Essentials',
    items: [
      { id: 'components', label: 'Components' },
      { id: 'reactive-data', label: 'Reactive Data' },
      { id: 'watching-data', label: 'Watching Data' },
      { id: 'templates', label: 'Templates' },
      { id: 'routing', label: 'Routing' },
    ],
  },
  {
    title: 'Examples',
    items: [
      { id: 'examples', label: 'Overview' },
      ...docsExampleMeta.map((example) => ({
        label: example.title,
        href: playgroundExampleHref(example.id),
      })),
    ],
  },
]
