import { html } from '@arrow-js/core'
import { ScrollSpyNav } from '../../components/ScrollSpyNav'
import type { NavGroup } from '../../components/ScrollSpyNav'
import {
  ReactiveApi,
  WatchApi,
  HtmlApi,
  ComponentApi,
  PickApi,
  NextTickApi,
  RenderApi,
  BoundaryApi,
  ToTemplateApi,
  RenderDocumentApi,
  RenderToStringApi,
  SerializePayloadApi,
  HydrateApi,
  ReadPayloadApi,
  TypesReference,
} from './content'

const apiNavGroups: NavGroup[] = [
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

export function ApiPage() {
  const nav = ScrollSpyNav(apiNavGroups)
  return html`
    <div>
      ${nav.mobile()}
      <div class="max-w-7xl mx-auto px-6 pt-8 pb-12">
        <div class="flex gap-12">
          ${nav.sidebar()}
          <article class="min-w-0 max-w-3xl flex-1">
            ${ReactiveApi()} ${WatchApi()} ${HtmlApi()} ${ComponentApi()}
            ${PickApi()} ${NextTickApi()} ${RenderApi()} ${BoundaryApi()}
            ${ToTemplateApi()} ${RenderDocumentApi()} ${RenderToStringApi()}
            ${SerializePayloadApi()} ${HydrateApi()} ${ReadPayloadApi()}
            ${TypesReference()}
          </article>
        </div>
      </div>
    </div>
  `
}
