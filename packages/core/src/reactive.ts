import { isR, isO, queue, registerCleanup } from './common'
import { expressionPool, onExpressionUpdate } from './expressions'
import { ArrowFunction, ArrowRenderable } from './html'

/**
 * The target of a reactive object.
 */
export type ReactiveTarget = Record<PropertyKey, unknown> | unknown[]

interface ReactiveAPI<T> {
  /**
   * Adds an observer to a given property.
   * @param p - The property to watch.
   * @param c - The callback to call when the property changes.
   * @returns
   */
  $on: <P extends keyof T>(p: P, c: PropertyObserver<T[P]>) => void
  /**
   * Removes an observer from a given property.
   * @param p - The property to stop watching.
   * @param c - The callback to stop calling when the property changes.
   * @returns
   */
  $off: <P extends keyof T>(p: P, c: PropertyObserver<T[P]>) => void
}

/**
 * A reactive object is a proxy of an original object.
 */
export interface Computed<T> extends Readonly<Reactive<{ value: T }>> {}

type ReactiveValue<T> = T extends Computed<infer TValue>
  ? TValue
  : T extends ReactiveTarget
    ? Reactive<T> | T
    : T

export type Reactive<T extends ReactiveTarget> = {
  /**
   * In the future it would be great to have variant types here for
   * accessing vs setting types. For example:
   * ```js
   * const obj = reactive({ x: { a: 123 } })
   * // Assignment should support non-reactive
   * obj.x = { a: 456 }
   * // Accessor should always be reactive:
   * obj.x.$on('a', (value) => console.log(value))
   * ```
   * This requires an update to TypeScript: https://github.com/microsoft/TypeScript/issues/43826
   */
  [P in keyof T]: ReactiveValue<T[P]>
} & ReactiveAPI<T>

/**
 * A callback used to observe a property changes on a reactive object.
 */
export interface PropertyObserver<T> {
  (newValue?: T, oldValue?: T): void
}

/**
 * An array of dependency couples. The array is staggard between object ids and
 * their respective properties. Duplicate properties are allowed.
 * ```hs
 * [1, 'property', 1, 'property2', 1, 'property']
 * ```
 */
type Dependencies = Array<number | PropertyKey>

type ListenerSlot =
  | PropertyObserver<unknown>
  | Array<PropertyObserver<unknown>>
type ListenerMap = Partial<Record<PropertyKey, ListenerSlot>>

/**
 * A registry of reactive objects to their unique numeric index which serves as
 * an unique identifier.
 */
const ids = new WeakMap<object, number>()
const computedIds: boolean[] = []

/**
 * A registry of reactive objects to their property observers.
 */
const listeners: ListenerMap[] = []

/**
 * Gets the unique id of a given target.
 * @param target - The object to get the id of.
 * @returns
 */
const getId = (target: object): number => ids.get(target)!

/**
 * An index counter for the reactive objects.
 */
let index = -1
/**
 * An index counter to identify watchers.
 */
let watchIndex = 0
/**
 * The current key being tracked.
 */
let trackKey = 0

/**
 * Array methods that modify the array.
 */
/**
 * A registry of dependencies for each tracked key.
 */
const trackedDependencies: Array<Dependencies | undefined> = []

/**
 * A registry of dependencies that are being watched by a given watcher.
 */
const watchedDependencies: Array<Dependencies | undefined> = []
const dependencyPool: Dependencies[] = []
const arrayMutationWrappers: Array<
  Partial<Record<PropertyKey, (...args: unknown[]) => unknown>> | undefined
> = []
const arrayMutations = {
  push: 1,
  pop: 1,
  shift: 1,
  unshift: 1,
  splice: 1,
  sort: 1,
  copyWithin: 1,
  fill: 1,
  reverse: 1,
}

/**
 * A map of child ids to their parents (a child can have multiple parents).
 */
const parents: Array<[parent: number, property: PropertyKey]>[] = []

/**
 * A reactive object is a proxy of the original object that allows for
 * reactive dependency watching. It is created by calling `reactive()` and
 * should be used to store reactive data in your app and components.
 *
 * @param data - The data to make reactive, typically a plain object.
 * @returns A reactive proxy of the original data.
 */
export function reactive<T>(effect: () => T): Computed<T>
export function reactive<T extends ReactiveTarget>(data: T): Reactive<T>
export function reactive<T extends ReactiveTarget, TValue>(
  data: T | (() => TValue)
): Reactive<T> | Computed<TValue> {
  if (typeof data === 'function') {
    const state = reactive({
      value: undefined as TValue,
    }) as Reactive<{ value: TValue }>
    computedIds[getId(state as object)] = true
    watch(
      data as () => TValue,
      (value) => (state.value = value as Reactive<{ value: TValue }>['value'])
    )
    return state as Computed<TValue>
  }
  // The data is already a reactive object, so return it.
  if (isR(data)) return data as Reactive<T>
  // Only valid objects can be reactive.
  if (!isO(data)) throw Error('Expected object')
  // Create a new slot in the listeners registry and then store the relationship
  // of this object to its index.
  const id = ++index
  listeners[id] = {}
  // Create the actual reactive proxy.
  const proxy = new Proxy(data, proxyHandler) as Reactive<T>
  // let the ids know about the index
  ids.set(data, id).set(proxy, id)
  return proxy
}

/**
 *
 * @param parentId - The id of the parent object.
 * @param property - The property of the parent object.
 * @param value - The value of the property.
 * @returns
 */
function trackArray(
  id: number,
  key: PropertyKey,
  target: ReactiveTarget,
  value: unknown
) {
  if (
    typeof value === 'function' &&
    arrayMutations[key as keyof typeof arrayMutations]
  ) {
    let wrappers = arrayMutationWrappers[id]
    if (!wrappers) wrappers = arrayMutationWrappers[id] = {}
    let wrapper = wrappers[key]
    if (!wrapper) {
      wrapper = (...args: unknown[]) => {
        const result = Reflect.apply(
          value as (...args: unknown[]) => unknown,
          target,
          args
        )
        emitParents(id)
        return result
      }
      wrappers[key] = wrapper
    }
    return wrapper
  }
  if (isComputed(value)) return readComputed(value, id, key)
  if (key !== 'length' && typeof value !== 'function') {
    track(id, key)
  }
  return value
}

const proxyHandler: ProxyHandler<ReactiveTarget> = {
  has(target, key) {
    if (key in api) return true
    track(getId(target as object), key)
    return key in target
  },
  get(target, key, receiver) {
    const id = getId(target as object)
    if (key in api) return api[key as keyof typeof api]
    const result = Reflect.get(target, key, receiver)
    let child: Reactive<ReactiveTarget> | undefined
    if (isO(result) && !isR(result)) {
      child = createChild(result, id, key)
      ;(target as Record<PropertyKey, unknown>)[key] = child
    }
    const value = child ?? result
    if (Array.isArray(target)) return trackArray(id, key, target, value)
    if (isComputed(value)) return readComputed(value, id, key)
    track(id, key)
    return value
  },
  set(target, key, value, receiver) {
    const id = getId(target as object)
    const isNewProperty = !(key in target)
    const newReactive =
      isO(value) && !isR(value) ? createChild(value, id, key) : null
    const oldValue = (target as Record<PropertyKey, unknown>)[key]
    const newValue = newReactive ?? value
    if (isR(newValue) && computedIds[getId(newValue as object)]) {
      linkParent(getId(newValue as object), id, key)
    }
    const didSucceed = Reflect.set(target, key, newValue, receiver)
    if (oldValue !== newValue && isR(oldValue) && isR(newValue)) {
      const oldParents = parents[getId(oldValue as object)]
      if (oldParents) {
        let index = -1
        for (let i = 0; i < oldParents.length; i++) {
          const [parent, property] = oldParents[i]
          if (parent == id && property == key) {
            index = i
            break
          }
        }
        if (index > -1) oldParents.splice(index, 1)
      }
      linkParent(getId(newValue as object), id, key)
    }
    emit(
      id,
      key,
      value,
      oldValue,
      isNewProperty || (key === 'value' && computedIds[id])
    )
    if (Array.isArray(target) && key === 'length') {
      emitParents(id)
    }
    return didSucceed
  },
}

/**
 *
 * @param child - Creates a child relationship
 * @param parent
 * @param key
 * @returns
 */
function createChild(
  child: ReactiveTarget,
  parentId: number,
  key: PropertyKey
): Reactive<ReactiveTarget> {
  const r = reactive(child)
  linkParent(getId(child), parentId, key)
  return r
}

function isComputed(value: unknown): value is Reactive<{ value: unknown }> {
  return isR(value) && computedIds[getId(value as object)]
}

function readComputed(
  value: Reactive<{ value: unknown }>,
  parentId: number,
  key: PropertyKey
) {
  const computedId = getId(value as object)
  track(parentId, key)
  linkParent(computedId, parentId, key)
  track(computedId, 'value')
  return value.value
}

function linkParent(childId: number, parentId: number, key: PropertyKey) {
  const entries = parents[childId]
  if (entries) {
    for (let i = 0; i < entries.length; i++) {
      const [parent, property] = entries[i]
      if (parent === parentId && property === key) return
    }
  } else {
    parents[childId] = []
  }
  parents[childId].push([parentId, key])
}

/**
 *
 * @param id - The reactive id that changed.
 * @param key - The property that changed.
 * @param newValue - The new value of the property.
 * @param oldValue - The old value of the property.
 */
function emit(
  id: number,
  key: PropertyKey,
  newValue?: unknown,
  oldValue?: unknown,
  notifyParents?: boolean
) {
  const targetListeners = listeners[id]
  const propertyListeners = targetListeners[key]
  if (propertyListeners) {
    if (Array.isArray(propertyListeners)) {
      for (let i = 0; i < propertyListeners.length; i++) {
        propertyListeners[i](newValue, oldValue)
      }
    } else {
      propertyListeners(newValue, oldValue)
    }
  }
  if (notifyParents) {
    emitParents(id)
  }
}

function emitParents(id: number) {
  const parentEntries = parents[id]
  if (!parentEntries) return
  for (let i = 0; i < parentEntries.length; i++) {
    const [parentId, property] = parentEntries[i]
    emit(parentId, property)
  }
}

function reactiveOn(
  this: ReactiveTarget,
  property: PropertyKey,
  callback: PropertyObserver<unknown>
) {
  addListener(listeners[getId(this as object)] as ListenerMap, property, callback)
}

function reactiveOff(
  this: ReactiveTarget,
  property: PropertyKey,
  callback: PropertyObserver<unknown>
) {
  removeListener(
    listeners[getId(this as object)] as ListenerMap,
    property,
    callback
  )
}

/**
 * The public reactive API for a reactive object.
 */
const api = {
  $on: reactiveOn,
  $off: reactiveOff,
}

/**
 * Track a reactive property as a dependency.
 * @param target
 * @param key
 */
function track(id: number, property: PropertyKey): void {
  if (!trackKey) return
  trackedDependencies[trackKey]!.push(id, property)
}

/**
 * Begin tracking reactive dependencies.
 */
function startTracking() {
  trackedDependencies[++trackKey] = dependencyPool.pop() ?? []
}

/**
 * Stop tracking reactive dependencies and register a callback for when any of
 * the tracked dependencies change.
 * @param callback - A function to re-run when dependencies change.
 */
function stopTracking(watchKey: number, callback: PropertyObserver<unknown>) {
  const key = trackKey--
  const deps = trackedDependencies[key]!
  const previousDeps = watchedDependencies[watchKey]
  const previousLength = previousDeps?.length
  if (previousLength && previousLength === deps.length) {
    let matched = true
    for (let i = 0; i < previousLength; i++) {
      if (previousDeps[i] === deps[i]) continue
      matched = false
      break
    }
    if (matched) {
      watchedDependencies[watchKey] = previousDeps
      deps.length = 0
      dependencyPool.push(deps)
      trackedDependencies[key] = undefined
      return
    }
  }
  flushListeners(previousDeps, callback)
  for (let i = 0; i < deps.length; i += 2) {
    addListener(
      listeners[deps[i] as number],
      deps[i + 1],
      callback
    )
  }
  watchedDependencies[watchKey] = deps
  trackedDependencies[key] = undefined
}

/**
 * Removes a callback from the listeners registry for a given set of
 * dependencies.
 * @param deps - The dependencies to flush.
 * @param callback - The callback to remove.
 */
function flushListeners(
  deps: Dependencies | undefined,
  callback: PropertyObserver<unknown>
) {
  if (!deps) return
  for (let i = 0; i < deps.length; i += 2) {
    removeListener(listeners[deps[i] as number], deps[i + 1], callback)
  }
  deps.length = 0
  dependencyPool.push(deps)
}

function addListener(
  targetListeners: ListenerMap,
  key: PropertyKey,
  callback: PropertyObserver<unknown>
) {
  const slot = targetListeners[key]
  if (!slot) {
    targetListeners[key] = callback
    return
  }
  if (Array.isArray(slot)) {
    if (!slot.includes(callback)) slot.push(callback)
    return
  }
  if (slot !== callback) targetListeners[key] = [slot, callback]
}

function removeListener(
  targetListeners: ListenerMap,
  key: PropertyKey,
  callback: PropertyObserver<unknown>
) {
  const slot = targetListeners[key]
  if (!slot) return
  if (Array.isArray(slot)) {
    const index = slot.indexOf(callback)
    if (index < 0) return
    if (slot.length === 2) {
      targetListeners[key] = slot[index ? 0 : 1]
      return
    }
    slot.splice(index, 1)
    return
  }
  if (slot === callback) {
    delete targetListeners[key]
  }
}

/**
 * Calls a function and watches it for changes.
 * @param fn - A function to watch.
 * @param after - A function to call after the watched function with the result.
 */
export function watch<A extends (arg: ArrowRenderable) => unknown>(
  pointer: number,
  afterEffect: A
): [returnValue: ReturnType<A>, stop: () => void]
export function watch<F extends (...args: unknown[]) => unknown>(
  effect: F
): [returnValue: ReturnType<F>, stop: () => void]
export function watch<
  F extends (...args: unknown[]) => unknown,
  A extends (arg: ReturnType<F>) => unknown
>(effect: F, afterEffect: A): [returnValue: ReturnType<A>, stop: () => void]
export function watch<
  F extends (...args: unknown[]) => unknown,
  A extends (arg: ReturnType<F>) => unknown
>(
  effect: F | number,
  afterEffect?: A
): [returnValue: ReturnType<F> | ReturnType<A>, stop: () => void] {
  const watchKey = ++watchIndex
  const isPointer = typeof effect === 'number'
  let rerun: null | PropertyObserver<unknown> = queue(
    runEffect as PropertyObserver<unknown>
  )
  function runEffect() {
    startTracking()

    const effectValue = isPointer
      ? (expressionPool[effect as number] as ArrowFunction)()
      : (effect as CallableFunction)()

    stopTracking(watchKey, rerun!)
    return afterEffect ? afterEffect(effectValue) : effectValue
  }
  const stop = () => {
    flushListeners(watchedDependencies[watchKey], rerun!)
    watchedDependencies[watchKey] = undefined
    if (isPointer) onExpressionUpdate(effect as number)
    rerun = null
  }
  if (!isPointer) registerCleanup(stop)
  if (isPointer) onExpressionUpdate(effect as number, runEffect)
  return [runEffect(), stop]
}
