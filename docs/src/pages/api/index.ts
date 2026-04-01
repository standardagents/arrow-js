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
  SvgApi,
  HighlightedSvgApi,
  ComponentApi,
  HighlightedComponentApi,
  OnCleanupApi,
  HighlightedOnCleanupApi,
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
  SandboxApi,
  HighlightedSandboxApi,
  TypesReference,
  HighlightedTypesReference,
} from './content'

export function ApiPage(options: { highlightCode?: boolean } = {}) {
  const highlightCode = options.highlightCode !== false
  const nav = ScrollSpyNav(apiNavGroups)
  const ReactiveApiSection = highlightCode ? HighlightedReactiveApi : ReactiveApi
  const WatchApiSection = highlightCode ? HighlightedWatchApi : WatchApi
  const HtmlApiSection = highlightCode ? HighlightedHtmlApi : HtmlApi
  const SvgApiSection = highlightCode ? HighlightedSvgApi : SvgApi
  const ComponentApiSection = highlightCode ? HighlightedComponentApi : ComponentApi
  const OnCleanupApiSection = highlightCode ? HighlightedOnCleanupApi : OnCleanupApi
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
  const SandboxApiSection = highlightCode ? HighlightedSandboxApi : SandboxApi
  const TypesReferenceSection = highlightCode ? HighlightedTypesReference : TypesReference

  return html`
    <div>
      <div id="api-mobile-nav-root">${nav.mobile()}</div>
      <div class="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-12">
        <div class="flex gap-12">
          <div id="api-sidebar-nav-root" class="hidden lg:block">
            ${nav.sidebar()}
          </div>
          <article class="min-w-0 max-w-3xl flex-1">
            <div class="flex items-start justify-between gap-4 mb-8">
              <h1
                class="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white"
              >
                API Reference
              </h1>
              ${CopyPageMenuIsland({ markdownPath: '/api.md' })}
            </div>
            <h2 class="text-sm font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-8 mt-4">@arrow-js/core</h2>
            ${ReactiveApiSection()} ${WatchApiSection()} ${HtmlApiSection()}
            ${SvgApiSection()}
            ${ComponentApiSection()} ${OnCleanupApiSection()} ${PickApiSection()}
            ${NextTickApiSection()}

            <h2 class="text-sm font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-8 mt-12">@arrow-js/framework</h2>
            ${RenderApiSection()} ${BoundaryApiSection()}
            ${ToTemplateApiSection()} ${RenderDocumentApiSection()}

            <h2 class="text-sm font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-8 mt-12">@arrow-js/ssr</h2>
            ${RenderToStringApiSection()} ${SerializePayloadApiSection()}

            <h2 class="text-sm font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-8 mt-12">@arrow-js/hydrate</h2>
            ${HydrateApiSection()} ${ReadPayloadApiSection()}

            <h2 class="text-sm font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-8 mt-12">@arrow-js/sandbox</h2>
            ${SandboxApiSection()}

            ${TypesReferenceSection()}
          </article>
        </div>
      </div>
    </div>
  `
}
