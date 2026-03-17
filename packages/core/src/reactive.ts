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
export type TrackedDependencies = Dependencies

type ListenerSlot =
  | PropertyObserver<unknown>
  | Set<PropertyObserver<unknown>>
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
    return createComputed(data as () => TValue)
  }
  // The data is already a reactive object, so return it.
  if (isR(data)) return data as Reactive<T>
  // Only valid objects can be reactive.
  if (!isO(data)) throw Error('Non object passed to reactive.')
  // Create a new slot in the listeners registry and then store the relationship
  // of this object to its index.
  const id = ++index
  listeners[id] = {}
  // Create the actual reactive proxy.
  const proxy = new Proxy(data, proxyHandler) as Reactive<T>
  // let the ids know about the index
  ids.set(data, index).set(proxy, index)
  return proxy
}

/**
 * Determines if a certain key is in the target object.
 * @param target - The object to check.
 * @param key - The property to check.
 * @returns
 */
function has(id: number, target: ReactiveTarget, key: PropertyKey): boolean {
  if (key in api) return true
  track(id, key)
  return key in target
}

/**
 * Gets a property from the target object.
 * @param target - The object to get the property on.
 * @param key - The property to get.
 * @param receiver - The proxy object.
 * @returns
 */
function get(
  id: number,
  target: ReactiveTarget,
  key: PropertyKey,
  receiver: object
): unknown {
  if (key in api) return api[key as keyof typeof api](target)
  const result = Reflect.get(target, key, receiver)
  let child: Reactive<ReactiveTarget> | undefined
  if (isO(result) && !isR(result)) {
    // Lazily create a child reactive object.
    child = createChild(result, id, key)
    target[key as number] = child
  }
  const value = child ?? result

  if (Array.isArray(target)) {
    // Explicitly don’t track the length property.
    return trackArray(id, key, target, value)
  }
  if (isComputed(value)) return readComputed(value, id, key)
  track(id, key)
  return value
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
  if (typeof value === 'function' && isArrayMutation(key)) {
    return (...args: unknown[]) => {
      const result = Reflect.apply(
        value as (...args: unknown[]) => unknown,
        target,
        args
      )
      parents[id]?.forEach(([parentId, property]) => emit(parentId, property))
      return result
    }
  }
  if (isComputed(value)) return readComputed(value, id, key)
  return value
}

/**
 * Gets a property from the target object.
 * @param target - The object to get the property on.
 * @param key - The property to get.
 * @param receiver - The proxy object.
 * @returns
 */
function set(
  id: number,
  target: ReactiveTarget,
  key: PropertyKey,
  value: unknown,
  receiver: object
): boolean {
  // If this is a new property then we need to notify parent properties
  const isNewProperty = !(key in target)
  // If the newly assigned item is not reactive, make it so.
  const newReactive =
    isO(value) && !isR(value) ? createChild(value, id, key) : null
  // Retrieve the old value
  const oldValue = target[key as number]
  // The new value
  const newValue = newReactive ?? value
  if (isR(newValue) && computedIds[getId(newValue as object)]) {
    linkParent(getId(newValue as object), id, key)
  }
  // Perform the actual set operation
  const didSucceed = Reflect.set(target, key, newValue, receiver)
  // If the old value was reactive, and the new value is
  if (oldValue !== newValue && isR(oldValue) && isR(newValue)) {
    reassign(id, key, getId(oldValue), getId(newValue))
  }
  // Notify all listeners
  emit(
    id,
    key,
    value,
    oldValue,
    isNewProperty || (key === 'value' && computedIds[id])
  )
  // If the array length is modified, notify all parents
  if (Array.isArray(target) && key === 'length') {
    parents[id]?.forEach(([parentId, property]) => emit(parentId, property))
  }
  return didSucceed
}

const proxyHandler: ProxyHandler<ReactiveTarget> = {
  has(target, key) {
    return has(getId(target as object), target, key)
  },
  get(target, key, receiver) {
    return get(getId(target as object), target, key, receiver)
  },
  set(target, key, value, receiver) {
    return set(getId(target as object), target, key, value, receiver)
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

function createComputed<T>(effect: () => T): Computed<T> {
  const source = {
    value: undefined as T,
  }
  const state = reactive(source) as Reactive<{ value: T }>
  computedIds[getId(state as object)] = true
  const [, stop] = watch(
    effect,
    (value) => (state.value = value as Reactive<{ value: T }>['value'])
  )
  registerCleanup(stop)
  return state as Computed<T>
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
 * Transfers listeners from one parent object’s reactive property to another.
 * @param parentId - The parent id
 * @param key - The property key to reassign
 * @param from - The previous reactive id
 * @param to - The new reactive id
 */
function reassign(
  parentId: number,
  key: PropertyKey,
  from: number,
  to: number
) {
  // Remove the old parent relationship
  if (parents[from]) {
    let index = -1
    for (let i = 0; i < parents[from].length; i++) {
      const [parent, property] = parents[from][i]
      if (parent == parentId && property == key) {
        index = i
        break
      }
    }
    if (index > -1) parents[from].splice(index, 1)
  }
  linkParent(to, parentId, key)
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
    if (typeof propertyListeners === 'function') {
      propertyListeners(newValue, oldValue)
    } else {
      propertyListeners.forEach((callback) => callback(newValue, oldValue))
    }
  }
  if (notifyParents) {
    parents[id]?.forEach(([parentId, property]) => emit(parentId, property))
  }
}

/**
 * The public reactive API for a reactive object.
 */
const api = {
  $on:
    (target: ReactiveTarget): ReactiveAPI<ReactiveTarget>['$on'] =>
    (property, callback) =>
      addListener(
        listeners[getId(target)] as ListenerMap,
        property as PropertyKey,
        callback as PropertyObserver<unknown>
      ),
  $off:
    (target: ReactiveTarget): ReactiveAPI<ReactiveTarget>['$off'] =>
    (property, callback) =>
      removeListener(
        listeners[getId(target)] as ListenerMap,
        property as PropertyKey,
        callback as PropertyObserver<unknown>
      ),
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

export function withoutTracking<T>(fn: () => T): T {
  const previous = trackKey
  trackKey = 0
  try {
    return fn()
  } finally {
    trackKey = previous
  }
}

/**
 * Begin tracking reactive dependencies.
 */
function startTracking() {
  trackedDependencies[++trackKey] = takeDependencies()
}

export function captureDependencies<F extends (...args: unknown[]) => unknown>(
  effect: F
): [returnValue: ReturnType<F>, deps: TrackedDependencies] {
  const key = ++trackKey
  const deps = (trackedDependencies[key] = takeDependencies())
  try {
    return [(effect as CallableFunction)() as ReturnType<F>, deps]
  } catch (error) {
    trackedDependencies[key] = undefined
    trackKey--
    releaseDependencies(deps)
    throw error
  } finally {
    if (trackedDependencies[key]) {
      trackedDependencies[key] = undefined
      trackKey--
    }
  }
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
  if (sameDependencies(previousDeps, deps)) {
    watchedDependencies[watchKey] = previousDeps
    releaseDependencies(deps)
    trackedDependencies[key] = undefined
    return
  }
  flushListeners(previousDeps, callback)
  const len = deps.length
  for (let i = 0; i < len; i += 2) {
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
  const len = deps.length
  for (let i = 0; i < len; i += 2) {
    removeListener(listeners[deps[i] as number], deps[i + 1], callback)
  }
  releaseDependencies(deps)
}

export function observeDependencies(
  deps: TrackedDependencies,
  callback: PropertyObserver<unknown>
): () => void {
  const len = deps.length
  if (!len) return () => releaseDependencies(deps)
  for (let i = 0; i < len; i += 2) {
    addListener(listeners[deps[i] as number], deps[i + 1], callback)
  }
  return () => flushListeners(deps, callback)
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
  if (slot === callback) return
  if (typeof slot === 'function') {
    targetListeners[key] = new Set([slot, callback])
    return
  }
  slot.add(callback)
}

function removeListener(
  targetListeners: ListenerMap,
  key: PropertyKey,
  callback: PropertyObserver<unknown>
) {
  const slot = targetListeners[key]
  if (!slot) return
  if (slot === callback) {
    delete targetListeners[key]
    return
  }
  if (typeof slot === 'function') return
  slot.delete(callback)
  if (slot.size === 1) {
    targetListeners[key] = slot.values().next().value as PropertyObserver<unknown>
  } else if (!slot.size) {
    delete targetListeners[key]
  }
}

function takeDependencies(): Dependencies {
  return dependencyPool.pop() ?? []
}

function sameDependencies(
  left: Dependencies | undefined,
  right: Dependencies | undefined
) {
  if (!left || !right) return false
  const length = left.length
  if (length !== right.length) return false
  for (let i = 0; i < length; i++) {
    if (left[i] !== right[i]) return false
  }
  return true
}

function releaseDependencies(deps: Dependencies | undefined) {
  if (!deps) return
  deps.length = 0
  dependencyPool.push(deps)
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
  if (isPointer) onExpressionUpdate(effect as number, runEffect)
  return [runEffect(), stop]
}

function isArrayMutation(key: PropertyKey) {
  switch (key) {
    case 'push':
    case 'pop':
    case 'shift':
    case 'unshift':
    case 'splice':
    case 'sort':
    case 'copyWithin':
    case 'fill':
    case 'reverse':
      return true
  }
  return false
}
