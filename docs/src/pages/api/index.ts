import { html } from '@arrow-js/core'
import { CopyPageMenuIsland } from '../../components/CopyPageMenu'
import { ScrollSpyNav } from '../../components/ScrollSpyNav'
import { apiNavGroups } from './nav'
import {
  ReactiveApi,
  HighlightedReactiveApi,
  WatchApi,
  HighlightedWatchApi,
  HtmlApi,
  HighlightedHtmlApi,
  ComponentApi,
  HighlightedComponentApi,
  PickApi,
  HighlightedPickApi,
  NextTickApi,
  HighlightedNextTickApi,
  RenderApi,
  HighlightedRenderApi,
  BoundaryApi,
  HighlightedBoundaryApi,
  ToTemplateApi,
  HighlightedToTemplateApi,
  RenderDocumentApi,
  HighlightedRenderDocumentApi,
  RenderToStringApi,
  HighlightedRenderToStringApi,
  SerializePayloadApi,
  HighlightedSerializePayloadApi,
  HydrateApi,
  HighlightedHydrateApi,
  ReadPayloadApi,
  HighlightedReadPayloadApi,
  TypesReference,
  HighlightedTypesReference,
} from './content'

export function ApiPage(options: { highlightCode?: boolean } = {}) {
  const highlightCode = options.highlightCode !== false
  const nav = ScrollSpyNav(apiNavGroups)
  const ReactiveApiSection = highlightCode ? HighlightedReactiveApi : ReactiveApi
  const WatchApiSection = highlightCode ? HighlightedWatchApi : WatchApi
  const HtmlApiSection = highlightCode ? HighlightedHtmlApi : HtmlApi
  const ComponentApiSection = highlightCode ? HighlightedComponentApi : ComponentApi
  const PickApiSection = highlightCode ? HighlightedPickApi : PickApi
  const NextTickApiSection = highlightCode ? HighlightedNextTickApi : NextTickApi
  const RenderApiSection = highlightCode ? HighlightedRenderApi : RenderApi
  const BoundaryApiSection = highlightCode ? HighlightedBoundaryApi : BoundaryApi
  const ToTemplateApiSection = highlightCode ? HighlightedToTemplateApi : ToTemplateApi
  const RenderDocumentApiSection =
    highlightCode ? HighlightedRenderDocumentApi : RenderDocumentApi
  const RenderToStringApiSection =
    highlightCode ? HighlightedRenderToStringApi : RenderToStringApi
  const SerializePayloadApiSection =
    highlightCode ? HighlightedSerializePayloadApi : SerializePayloadApi
  const HydrateApiSection = highlightCode ? HighlightedHydrateApi : HydrateApi
  const ReadPayloadApiSection = highlightCode ? HighlightedReadPayloadApi : ReadPayloadApi
  const TypesReferenceSection = highlightCode ? HighlightedTypesReference : TypesReference

  return html`
    <div>
      <div id="api-mobile-nav-root">${nav.mobile()}</div>
      <div class="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-12">
        <div class="flex gap-12">
          <div id="api-sidebar-nav-root">${nav.sidebar()}</div>
          <article class="min-w-0 max-w-3xl flex-1">
            <div class="flex items-start justify-between gap-4 mb-8">
              <h1
                class="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white"
              >
                API Reference
              </h1>
              ${CopyPageMenuIsland({ markdownPath: '/api.md' })}
            </div>
            ${ReactiveApiSection()} ${WatchApiSection()} ${HtmlApiSection()}
            ${ComponentApiSection()} ${PickApiSection()}
            ${NextTickApiSection()} ${RenderApiSection()} ${BoundaryApiSection()}
            ${ToTemplateApiSection()} ${RenderDocumentApiSection()}
            ${RenderToStringApiSection()} ${SerializePayloadApiSection()}
            ${HydrateApiSection()} ${ReadPayloadApiSection()}
            ${TypesReferenceSection()}
          </article>
        </div>
      </div>
    </div>
  `
}
