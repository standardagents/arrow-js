declare module '@arrow-js/core' {
  export type ArrowTemplateKey = string | number | undefined
  export type ParentNode = Node | DocumentFragment
  export type ArrowRenderable =
    | string
    | number
    | boolean
    | null
    | undefined
    | ComponentCall
    | ArrowTemplate
    | Array<string | number | boolean | ComponentCall | ArrowTemplate>
  export type ArrowExpression =
    | ArrowRenderable
    | ((...args: unknown[]) => ArrowRenderable)
    | EventListener
    | ((evt: InputEvent) => void)

  export type ReactiveTarget = Record<PropertyKey, unknown> | unknown[]

  export interface ArrowTemplate {
    (parent: ParentNode): ParentNode
    (): DocumentFragment
    isT: boolean
    key: (key: string | number | undefined) => ArrowTemplate
  }

  export type Reactive<T extends ReactiveTarget> = {
    [P in keyof T]:
      T[P] extends Computed<infer TValue>
        ? TValue
        : T[P] extends ReactiveTarget
          ? Reactive<T[P]> | T[P]
          : T[P]
  } & {
    $on: <P extends keyof T>(
      property: P,
      callback: (value?: T[P], oldValue?: T[P]) => void
    ) => void
    $off: <P extends keyof T>(
      property: P,
      callback: (value?: T[P], oldValue?: T[P]) => void
    ) => void
  }

  export interface PropertyObserver<T> {
    (newValue?: T, oldValue?: T): void
  }

  export type Props<T extends ReactiveTarget> = {
    [P in keyof T]: T[P] extends ReactiveTarget ? Props<T[P]> | T[P] : T[P]
  }

  export type EventMap = Record<string, unknown>

  export type Events<T extends EventMap> = {
    [K in keyof T]?: (payload: T[K]) => void
  }

  export type Emit<T extends EventMap> = <K extends keyof T>(
    event: K,
    payload: T[K]
  ) => void

  export interface ComponentCall {
    key: (key: string | number | undefined) => ComponentCall
  }

  export interface Component<TEvents extends EventMap = EventMap> {
    (props?: undefined, events?: Events<TEvents>): ComponentCall
  }

  export interface ComponentWithProps<
    T extends ReactiveTarget,
    TEvents extends EventMap = EventMap,
  > {
    <S extends Props<T>>(props: S, events?: Events<TEvents>): ComponentCall
  }

  export interface Computed<TValue> {
    readonly value: TValue
  }

  export interface AsyncComponentOptions<
    T extends ReactiveTarget,
    TValue,
    TEvents extends EventMap = EventMap,
    TSnapshot = TValue,
  > {
    fallback?: unknown
    onError?: (
      error: unknown,
      props: Props<T>,
      emit: Emit<TEvents>
    ) => unknown
    render?: (
      value: TValue,
      props: Props<T>,
      emit: Emit<TEvents>
    ) => unknown
    serialize?: (
      value: TValue,
      props: Props<T>,
      emit: Emit<TEvents>
    ) => TSnapshot
    deserialize?: (snapshot: TSnapshot, props: Props<T>) => TValue
    idPrefix?: string
  }

  export function html(
    strings: TemplateStringsArray | string[],
    ...expressions: unknown[]
  ): ArrowTemplate
  export { html as t }

  export function reactive<T extends ReactiveTarget>(data: T): Reactive<T>
  export function reactive<TValue>(effect: () => TValue): Computed<TValue>
  export { reactive as r }

  export function watch<F extends (...args: unknown[]) => unknown>(
    effect: F
  ): [returnValue: ReturnType<F>, stop: () => void]
  export function watch<
    F extends (...args: unknown[]) => unknown,
    A extends (arg: ReturnType<F>) => unknown,
  >(effect: F, afterEffect: A): [returnValue: ReturnType<A>, stop: () => void]
  export { watch as w }

  export function nextTick(fn?: CallableFunction): Promise<unknown>

  export function component(factory: () => ArrowTemplate): Component
  export function component<TEvents extends EventMap>(
    factory: (props: undefined, emit: Emit<TEvents>) => ArrowTemplate
  ): Component<TEvents>
  export function component<T extends ReactiveTarget>(
    factory: (props: Props<T>) => ArrowTemplate
  ): ComponentWithProps<T>
  export function component<T extends ReactiveTarget, TEvents extends EventMap>(
    factory: (props: Props<T>, emit: Emit<TEvents>) => ArrowTemplate
  ): ComponentWithProps<T, TEvents>
  export function component<TValue, TSnapshot = TValue>(
    factory: () => Promise<TValue> | TValue,
    options?: AsyncComponentOptions<ReactiveTarget, TValue, EventMap, TSnapshot>
  ): Component
  export function component<
    TValue,
    TEvents extends EventMap,
    TSnapshot = TValue,
  >(
    factory: (props: undefined, emit: Emit<TEvents>) => Promise<TValue> | TValue,
    options?: AsyncComponentOptions<ReactiveTarget, TValue, TEvents, TSnapshot>
  ): Component<TEvents>
  export function component<T extends ReactiveTarget, TValue, TSnapshot = TValue>(
    factory: (props: Props<T>) => Promise<TValue> | TValue,
    options?: AsyncComponentOptions<T, TValue, EventMap, TSnapshot>
  ): ComponentWithProps<T>
  export function component<
    T extends ReactiveTarget,
    TValue,
    TEvents extends EventMap,
    TSnapshot = TValue,
  >(
    factory: (props: Props<T>, emit: Emit<TEvents>) => Promise<TValue> | TValue,
    options?: AsyncComponentOptions<T, TValue, TEvents, TSnapshot>
  ): ComponentWithProps<T, TEvents>
  export { component as c }

  export function pick<T extends object, K extends keyof T>(
    source: T,
    ...keys: K[]
  ): Pick<T, K>
  export function pick<T extends object>(source: T): T
  export const props: typeof pick
}

declare module '@arrow-js/framework' {
  import type {
    ArrowTemplate,
  } from '@arrow-js/core'

  export interface BoundaryOptions {
    idPrefix?: string
  }

  export interface RenderOptions {
    clear?: boolean
    hydrationSnapshots?: Record<string, unknown>
  }

  export interface RenderPayload {
    async: Record<string, unknown>
    boundaries: string[]
  }

  export interface RenderResult {
    root: ParentNode
    template: ArrowTemplate
    payload: RenderPayload
  }

  export interface DocumentRenderParts {
    head?: string
    html: string
    payloadScript?: string
  }

  export function boundary(view: unknown, options?: BoundaryOptions): ArrowTemplate
  export function render(
    root: ParentNode,
    view: unknown,
    options?: RenderOptions
  ): Promise<RenderResult>
  export function toTemplate(view: unknown): ArrowTemplate
  export function renderDocument(template: string, parts: DocumentRenderParts): string
}

declare module '@arrow-js/sandbox' {
  import type { ArrowTemplate } from '@arrow-js/core'

  export interface SandboxProps {
    source: Record<string, string>
    shadowDOM?: boolean
    onError?: (error: Error | string) => void
    debug?: boolean
  }

  export interface SandboxEvents {
    output?: (payload: unknown) => void
  }

  export function sandbox(
    props: SandboxProps,
    events?: SandboxEvents
  ): ArrowTemplate
}

declare module '@arrow-js/ssr' {
  export interface HydrationPayload {
    html?: string
    rootId?: string
    async?: Record<string, unknown>
    boundaries?: string[]
  }

  export interface SsrRenderOptions {
    rootId?: string
  }

  export interface SsrRenderResult {
    html: string
    payload: HydrationPayload
  }

  export function renderToString(
    view: unknown,
    options?: SsrRenderOptions
  ): Promise<SsrRenderResult>

  export function serializePayload(payload: unknown, id?: string): string
}

declare module '@arrow-js/hydrate' {
  import type { ArrowTemplate } from '@arrow-js/core'
  import type { RenderPayload } from '@arrow-js/framework'

  export interface HydrationPayload {
    html?: string
    rootId?: string
    async?: Record<string, unknown>
    boundaries?: string[]
  }

  export interface HydrationMismatchDetails {
    actual: string
    expected: string
    mismatches: number
    repaired: boolean
    boundaryFallbacks: number
  }

  export interface HydrationOptions {
    onMismatch?: (details: HydrationMismatchDetails) => void
  }

  export interface HydrationResult {
    root: ParentNode
    template: ArrowTemplate
    payload: RenderPayload
    adopted: boolean
    mismatches: number
    boundaryFallbacks: number
  }

  export function hydrate(
    root: ParentNode,
    view: unknown,
    payload?: HydrationPayload,
    options?: HydrationOptions
  ): Promise<HydrationResult>

  export function readPayload(doc?: Document, id?: string): HydrationPayload
}

declare module './App' {
  import type { ArrowTemplate } from '@arrow-js/core'

  export function createApp(): ArrowTemplate
}

declare module './app' {
  import type { ArrowTemplate } from '@arrow-js/core'

  export function createApp(): ArrowTemplate
}

type ArrowTemplate = import('@arrow-js/core').ArrowTemplate
type ReactiveTarget = import('@arrow-js/core').ReactiveTarget
type Reactive<T extends ReactiveTarget> = import('@arrow-js/core').Reactive<T>
type Computed<T> = import('@arrow-js/core').Computed<T>
type Props<T extends ReactiveTarget> = import('@arrow-js/core').Props<T>
type EventMap = import('@arrow-js/core').EventMap
type Events<T extends EventMap> = import('@arrow-js/core').Events<T>
type Emit<T extends EventMap> = import('@arrow-js/core').Emit<T>
type ArrowTemplateKey = import('@arrow-js/core').ArrowTemplateKey
type PropertyObserver<T> = import('@arrow-js/core').PropertyObserver<T>
type RenderOptions = import('@arrow-js/framework').RenderOptions
type RenderPayload = import('@arrow-js/framework').RenderPayload
type RenderResult = import('@arrow-js/framework').RenderResult
type BoundaryOptions = import('@arrow-js/framework').BoundaryOptions
type DocumentRenderParts = import('@arrow-js/framework').DocumentRenderParts
type HydrationPayload = import('@arrow-js/hydrate').HydrationPayload
type HydrationMismatchDetails = import('@arrow-js/hydrate').HydrationMismatchDetails
type HydrationOptions = import('@arrow-js/hydrate').HydrationOptions
type HydrationResult = import('@arrow-js/hydrate').HydrationResult
type SsrRenderOptions = import('@arrow-js/ssr').SsrRenderOptions
type SsrRenderResult = import('@arrow-js/ssr').SsrRenderResult

declare const html: typeof import('@arrow-js/core').html
declare const reactive: typeof import('@arrow-js/core').reactive
declare const watch: typeof import('@arrow-js/core').watch
declare const nextTick: typeof import('@arrow-js/core').nextTick
declare const component: typeof import('@arrow-js/core').component
declare const pick: typeof import('@arrow-js/core').pick
declare const props: typeof import('@arrow-js/core').props
declare const render: typeof import('@arrow-js/framework').render
declare const boundary: typeof import('@arrow-js/framework').boundary
declare const toTemplate: typeof import('@arrow-js/framework').toTemplate
declare const renderDocument: typeof import('@arrow-js/framework').renderDocument
declare const renderToString: typeof import('@arrow-js/ssr').renderToString
declare const serializePayload: typeof import('@arrow-js/ssr').serializePayload
declare const hydrate: typeof import('@arrow-js/hydrate').hydrate
declare const readPayload: typeof import('@arrow-js/hydrate').readPayload

declare const cls: string
declare const data: {
  active: boolean
  boundaries: string[]
  count: number
  list: string[]
  loading: boolean
  logTotal: boolean
  price: number
  quantity: number
  text: string
  user: { last: string }
}
declare const items: Array<{ id: string | number; label: string; name: string }>
declare const someString: string
declare const otherTemplate: ArrowTemplate
declare const view: unknown
declare const callback: PropertyObserver<unknown>
declare function handleClick(event: Event): void
declare function MyComponent(props: { label: string }): unknown
declare function Counter(props: { count: number }): unknown
declare function Sidebar(): unknown
declare function Content(): unknown
declare function ItemCard(props: { id: string | number; name: string }): {
  key(key: string | number | undefined): unknown
}
declare function createApp(): unknown
