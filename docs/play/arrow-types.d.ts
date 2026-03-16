declare module '@arrow-js/core' {
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

  export type Props<T extends ReactiveTarget> = {
    [P in keyof T]: T[P] extends ReactiveTarget ? Props<T[P]> | T[P] : T[P]
  }

  export interface ComponentCall {
    key: (key: string | number | undefined) => ComponentCall
  }

  export interface Component {
    (): ComponentCall
  }

  export interface ComponentWithProps<T extends ReactiveTarget> {
    <S extends Props<T>>(props: S): ComponentCall
  }

  export interface Computed<TValue> {
    readonly value: TValue
  }

  export interface AsyncComponentOptions<
    T extends ReactiveTarget,
    TValue,
    TSnapshot = TValue,
  > {
    fallback?: unknown
    onError?: (error: unknown, props: Props<T>) => unknown
    render?: (value: TValue, props: Props<T>) => unknown
    serialize?: (value: TValue, props: Props<T>) => TSnapshot
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
  export function component<T extends ReactiveTarget>(
    factory: (props: Props<T>) => ArrowTemplate
  ): ComponentWithProps<T>
  export function component<TValue, TSnapshot = TValue>(
    factory: () => Promise<TValue> | TValue,
    options?: AsyncComponentOptions<ReactiveTarget, TValue, TSnapshot>
  ): Component
  export function component<T extends ReactiveTarget, TValue, TSnapshot = TValue>(
    factory: (props: Props<T>) => Promise<TValue> | TValue,
    options?: AsyncComponentOptions<T, TValue, TSnapshot>
  ): ComponentWithProps<T>
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

  export function boundary(view: unknown, options?: BoundaryOptions): ArrowTemplate
  export function render(
    root: ParentNode,
    view: unknown,
    options?: RenderOptions
  ): Promise<RenderResult>
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