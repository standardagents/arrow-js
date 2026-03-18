import type { NavGroup } from '../../components/ScrollSpyNav'

export const apiNavGroups: NavGroup[] = [
  {
    title: '@arrow-js/core',
    items: [
      { id: 'reactive', label: 'reactive()' },
      { id: 'watch', label: 'watch()' },
      { id: 'html', label: 'html' },
      { id: 'component', label: 'component()' },
      { id: 'pick', label: 'pick() / props()' },
      { id: 'next-tick', label: 'nextTick()' },
    ],
  },
  {
    title: '@arrow-js/framework',
    items: [
      { id: 'render', label: 'render()' },
      { id: 'boundary', label: 'boundary()' },
      { id: 'to-template', label: 'toTemplate()' },
      { id: 'render-document', label: 'renderDocument()' },
    ],
  },
  {
    title: '@arrow-js/ssr',
    items: [
      { id: 'render-to-string', label: 'renderToString()' },
      { id: 'serialize-payload', label: 'serializePayload()' },
    ],
  },
  {
    title: '@arrow-js/hydrate',
    items: [
      { id: 'hydrate', label: 'hydrate()' },
      { id: 'read-payload', label: 'readPayload()' },
    ],
  },
  {
    title: 'Types',
    items: [{ id: 'types', label: 'Type Reference' }],
  },
]
