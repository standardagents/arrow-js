import coreComponentSource from '../../../packages/core/src/component.ts?raw'
import coreHtmlSource from '../../../packages/core/src/html.ts?raw'
import coreReactiveSource from '../../../packages/core/src/reactive.ts?raw'
import frameworkBoundarySource from '../../../packages/framework/src/boundary.ts?raw'
import frameworkHttpSource from '../../../packages/framework/src/http.ts?raw'
import frameworkRenderSource from '../../../packages/framework/src/render.ts?raw'
import frameworkSsrSource from '../../../packages/framework/src/ssr.ts?raw'
import hydrateSource from '../../../packages/hydrate/src/index.ts?raw'
import sandboxHostSource from '../../../packages/sandbox/src/host/instance.ts?raw'
import sandboxProtocolSource from '../../../packages/sandbox/src/shared/protocol.ts?raw'

function stripComments(source: string) {
  return source
    .replace(/\/\*\*?[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
}

function extractBlock(source: string, signature: string | string[]) {
  const signatures = Array.isArray(signature) ? signature : [signature]
  let start = -1
  let matched = ''

  for (const candidate of signatures) {
    start = source.indexOf(candidate)
    if (start !== -1) {
      matched = candidate
      break
    }
  }

  if (start === -1) {
    throw new Error(
      `Unable to find declaration starting with: ${signatures[0]}`
    )
  }

  const end = source.indexOf('\n\n', start)
  let block = stripComments(source.slice(start, end === -1 ? source.length : end))

  if (matched.startsWith('type ') && signatures[0].startsWith('export type ')) {
    block = block.replace(/^type\s/, 'export type ')
  }

  return block
}

function joinBlocks(...blocks: string[]) {
  return blocks.join('\n\n')
}

export const coreTypeReferenceSnippet = joinBlocks(
  extractBlock(coreHtmlSource, 'export type ParentNode ='),
  extractBlock(coreHtmlSource, 'export interface ArrowTemplate {'),
  extractBlock(coreHtmlSource, [
    'export type ArrowTemplateKey =',
    'type ArrowTemplateKey =',
  ]),
  extractBlock(coreHtmlSource, 'export type ArrowRenderable ='),
  extractBlock(coreHtmlSource, 'export type ArrowFunction ='),
  extractBlock(coreHtmlSource, 'export type ArrowExpression ='),
  extractBlock(coreReactiveSource, 'export type ReactiveTarget ='),
  extractBlock(coreReactiveSource, 'interface ReactiveAPI<T> {'),
  extractBlock(coreReactiveSource, 'export interface Computed<T>'),
  extractBlock(coreReactiveSource, 'type ReactiveValue<T> ='),
  extractBlock(coreReactiveSource, 'export type Reactive<T extends ReactiveTarget> ='),
  extractBlock(coreReactiveSource, 'export interface PropertyObserver<T> {'),
  extractBlock(coreComponentSource, 'export type Props<T extends ReactiveTarget> ='),
  extractBlock(coreComponentSource, 'export type EventMap ='),
  extractBlock(coreComponentSource, 'export type Events<T extends EventMap> ='),
  extractBlock(coreComponentSource, 'export type Emit<T extends EventMap> ='),
  extractBlock(coreComponentSource, 'export type ComponentFactory ='),
  extractBlock(coreComponentSource, 'export interface AsyncComponentOptions<'),
  extractBlock(coreComponentSource, 'export interface ComponentCall {'),
  extractBlock(coreComponentSource, 'export interface Component<TEvents extends EventMap = EventMap> {'),
  extractBlock(coreComponentSource, 'export interface ComponentWithProps<')
)

export const frameworkTypeReferenceSnippet = joinBlocks(
  '// ---cut-start---',
  "import type { ArrowTemplate } from '@arrow-js/core'",
  '// ---cut-end---',
  extractBlock(frameworkRenderSource, 'export interface RenderOptions {'),
  extractBlock(frameworkRenderSource, 'export interface RenderPayload {'),
  extractBlock(frameworkRenderSource, 'export interface RenderResult {'),
  extractBlock(frameworkBoundarySource, 'export interface BoundaryOptions {'),
  extractBlock(frameworkHttpSource, 'export interface DocumentRenderParts {')
)

export const ssrTypeReferenceSnippet = joinBlocks(
  extractBlock(frameworkSsrSource, 'export interface HydrationPayload {'),
  extractBlock(frameworkSsrSource, 'export interface SsrRenderOptions {'),
  extractBlock(frameworkSsrSource, 'export interface SsrRenderResult {')
)

export const hydrateTypeReferenceSnippet = joinBlocks(
  '// ---cut-start---',
  "import type { ArrowTemplate, ParentNode } from '@arrow-js/core'",
  "import type { RenderPayload } from '@arrow-js/framework'",
  '// ---cut-end---',
  extractBlock(hydrateSource, 'export interface HydrationPayload {'),
  extractBlock(hydrateSource, 'export interface HydrationMismatchDetails {'),
  extractBlock(hydrateSource, 'export interface HydrationOptions {'),
  extractBlock(hydrateSource, 'export interface HydrationResult {')
)

export const sandboxTypeReferenceSnippet = joinBlocks(
  '// ---cut-start---',
  "import type { ArrowTemplate } from '@arrow-js/core'",
  '// ---cut-end---',
  extractBlock(sandboxProtocolSource, 'export interface SandboxProps {'),
  extractBlock(sandboxProtocolSource, 'export interface SandboxEvents {'),
  extractBlock(sandboxHostSource, [
    'export function sandbox<',
    'export function sandbox(',
  ])
)
