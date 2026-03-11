import { ArrowTemplate, Chunk } from './html'
import { Reactive, PropertyObserver, ReactiveTarget } from './reactive'

/**
 * A queue of expressions to run as soon as an async slot opens up.
 */
const queueStack: Set<CallableFunction> = new Set()
/**
 * A stack of functions to run on the next tick.
 */
const nextTicks: Set<CallableFunction> = new Set()

/**
 * A map of node types to their respective interfaces.
 */
type NodeTypes = {
  1: Element
  8: Comment
  11: DocumentFragment
}

/**
 * Adds the ability to listen to the next tick.
 * @param  {CallableFunction} fn?
 * @returns Promise
 */
export function nextTick(fn?: CallableFunction): Promise<unknown> {
  if (!queueStack.size) {
    if (fn) fn()
    return Promise.resolve()
  }
  let resolve: (value?: unknown) => void
  const p = new Promise((r) => {
    resolve = r
  })
  nextTicks.add(() => {
    if (fn) fn()
    resolve()
  })
  return p
}

export function isTpl(template: unknown): template is ArrowTemplate {
  return typeof template === 'function' && !!(template as ArrowTemplate).isT
}

export function isO(obj: unknown): obj is ReactiveTarget {
  return obj !== null && typeof obj === 'object'
}

export function isR(obj: unknown): obj is Reactive<ReactiveTarget> {
  return isO(obj) && '$on' in obj
}

export function isChunk(chunk: unknown): chunk is Chunk {
  return isO(chunk) && '$' in chunk
}

export function isType<T extends keyof NodeTypes>(
  obj: Node,
  type: T
): obj is NodeTypes[T] {
  return obj.nodeType === type
}

/**
 * Queue an item to execute after all synchronous functions have been run. This
 * is used for `w()` to ensure multiple dependency mutations tracked on the
 * same expression do not result in multiple calls.
 * @param  {CallableFunction} fn
 * @returns PropertyObserver
 */
export function queue<T extends unknown>(
  fn: PropertyObserver<T>
): PropertyObserver<T> {
  return (newValue?: T, oldValue?: T) => {
    function executeQueue() {
      // copy the current queues and clear it to allow new items to be added
      // during the execution of the current queue.
      const queue = [...queueStack]
      queueStack.clear()
      const ticks = [...nextTicks]
      nextTicks.clear()
      queue.forEach((fn) => fn(newValue, oldValue))
      ticks.forEach((fn) => fn())
      if (queueStack.size) {
        // we received new items while executing the queue, so we need to
        // execute the queue again.
        queueMicrotask(executeQueue)
      }
    }
    if (!queueStack.size) {
      queueMicrotask(executeQueue)
    }
    queueStack.add(fn)
  }
}
