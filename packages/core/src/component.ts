import type { ArrowTemplate, ArrowTemplateKey } from './html'
import { reactive } from './reactive'
import type { Reactive, ReactiveTarget } from './reactive'

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

type SyncFactory<T extends ReactiveTarget, TEvents extends EventMap> =
  | (() => ArrowTemplate)
  | ((props: Props<T>) => ArrowTemplate)
  | ((props: Props<T>, emit: Emit<TEvents>) => ArrowTemplate)
  | ((props: undefined, emit: Emit<TEvents>) => ArrowTemplate)
type AsyncFactory<T extends ReactiveTarget, TValue, TEvents extends EventMap> =
  | (() => Promise<TValue> | TValue)
  | ((props: Props<T>) => Promise<TValue> | TValue)
  | ((props: Props<T>, emit: Emit<TEvents>) => Promise<TValue> | TValue)
  | ((props: undefined, emit: Emit<TEvents>) => Promise<TValue> | TValue)

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as {
  new (...args: unknown[]): unknown
}

export type ComponentFactory = (
  props?: Props<ReactiveTarget>,
  emit?: Emit<EventMap>
) => ArrowTemplate

export interface AsyncComponentOptions<
  TProps extends ReactiveTarget,
  TValue,
  TEvents extends EventMap = EventMap,
  TSnapshot = TValue,
> {
  fallback?: unknown
  onError?: (
    error: unknown,
    props: Props<TProps>,
    emit: Emit<TEvents>
  ) => unknown
  render?: (
    value: TValue,
    props: Props<TProps>,
    emit: Emit<TEvents>
  ) => unknown
  serialize?: (
    value: TValue,
    props: Props<TProps>,
    emit: Emit<TEvents>
  ) => TSnapshot
  deserialize?: (snapshot: TSnapshot, props: Props<TProps>) => TValue
  idPrefix?: string
}

export type AsyncComponentInstaller = <
  TProps extends ReactiveTarget,
  TValue,
  TEvents extends EventMap = EventMap,
  TSnapshot = TValue,
>(
  factory: AsyncFactory<TProps, TValue, TEvents>,
  options?: AsyncComponentOptions<TProps, TValue, TEvents, TSnapshot>
) => Component<TEvents> | ComponentWithProps<TProps, TEvents>

export interface ComponentCall {
  h: ComponentFactory
  p: Props<ReactiveTarget> | undefined
  e: Events<EventMap> | undefined
  k: ArrowTemplateKey
  key: (key: ArrowTemplateKey) => ComponentCall
}

export interface Component<TEvents extends EventMap = EventMap> {
  (props?: undefined, events?: Events<TEvents>): ComponentCall
}

export interface ComponentWithProps<
  T extends ReactiveTarget,
  TEvents extends EventMap = EventMap,
> {
  <S extends T>(props: S, events?: Events<TEvents>): ComponentCall
}

let asyncComponentInstaller: AsyncComponentInstaller | null = null

type SourceBox = Reactive<{
  0: Props<ReactiveTarget> | undefined
  1: ComponentFactory
  2: Events<EventMap> | undefined
}>
function setComponentKey(this: ComponentCall, key: ArrowTemplateKey) {
  this.k = key
  return this
}

const propsProxyHandler: ProxyHandler<SourceBox> = {
  get(target, key) {
    const source = target[0]
    if (!source) return
    return (source as Record<PropertyKey, unknown>)[key as PropertyKey]
  },
  set(target, key, value) {
    const source = target[0]
    if (!source) return false
    return Reflect.set(source as object, key, value)
  },
}

const narrowedPropsHandler: ProxyHandler<{
  k: PropertyKey[]
  s: object
}> = {
  get(target, key) {
    return target.k.includes(key)
      ? (target.s as Record<PropertyKey, unknown>)[key as PropertyKey]
      : undefined
  },
  set(target, key, value) {
    if (!target.k.includes(key)) return false
    return Reflect.set(target.s, key, value)
  },
}

export function pick<T extends object, K extends keyof T>(
  source: T,
  ...keys: K[]
): Pick<T, K>
export function pick<T extends object>(
  source: T
): T
export function pick<T extends object, K extends keyof T>(
  source: T,
  ...keys: K[]
): T | Pick<T, K> {
  return keys.length
    ? (new Proxy({
        k: keys as PropertyKey[],
        s: source,
      }, narrowedPropsHandler) as unknown as Pick<T, K>)
    : source
}

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
export function component<TValue, TEvents extends EventMap, TSnapshot = TValue>(
  factory:
    | (() => Promise<TValue> | TValue)
    | ((props: undefined, emit: Emit<TEvents>) => Promise<TValue> | TValue),
  options?: AsyncComponentOptions<ReactiveTarget, TValue, TEvents, TSnapshot>
): Component
export function component<
  T extends ReactiveTarget,
  TValue,
  TEvents extends EventMap,
  TSnapshot = TValue,
>(
  factory:
    | ((props: Props<T>) => Promise<TValue> | TValue)
    | ((props: Props<T>, emit: Emit<TEvents>) => Promise<TValue> | TValue),
  options?: AsyncComponentOptions<T, TValue, TEvents, TSnapshot>
): ComponentWithProps<T, TEvents>
export function component<
  T extends ReactiveTarget,
  TValue,
  TEvents extends EventMap = EventMap,
  TSnapshot = TValue,
>(
  factory: SyncFactory<T, TEvents> | AsyncFactory<T, TValue, TEvents>,
  options?: AsyncComponentOptions<T, TValue, TEvents, TSnapshot>
): Component<TEvents> | ComponentWithProps<T, TEvents> {
  if (options || factory instanceof AsyncFunction) {
    if (!asyncComponentInstaller) {
      throw new Error('Async runtime required.')
    }

    return asyncComponentInstaller(
      factory as AsyncFactory<T, TValue, TEvents>,
      options
    ) as Component<TEvents> | ComponentWithProps<T, TEvents>
  }

  return ((input?: Props<T>, events?: Events<TEvents>) =>
    ({
      h: factory as SyncFactory<T, TEvents> as ComponentFactory,
      k: undefined,
      p: input as Props<ReactiveTarget> | undefined,
      e: events as Events<EventMap> | undefined,
      key: setComponentKey,
    })) as Component<TEvents> | ComponentWithProps<T, TEvents>
}

export function installAsyncComponentInstaller(
  installer: AsyncComponentInstaller | null
) {
  asyncComponentInstaller = installer
}

export function isCmp(value: unknown): value is ComponentCall {
  return !!value && typeof value === 'object' && 'h' in value
}

export function createPropsProxy(
  source: Props<ReactiveTarget> | undefined,
  factory: ComponentFactory,
  events?: Events<EventMap>
): [Props<ReactiveTarget>, Emit<EventMap>, SourceBox] {
  const box = reactive({ 0: source, 1: factory, 2: events })
  const emit = ((event: keyof EventMap, payload: unknown) => {
    const handlers = box[2]
    const handler = handlers?.[event]
    if (typeof handler === 'function') {
      handler(payload)
    }
  }) as Emit<EventMap>

  return [
    new Proxy(box, propsProxyHandler) as unknown as Props<ReactiveTarget>,
    emit,
    box,
  ]
}
