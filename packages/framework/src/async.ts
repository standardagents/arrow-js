import { component, html, reactive } from '@arrow-js/core'
import type {
  AsyncComponentOptions,
  Component,
  ComponentWithProps,
  Emit,
  EventMap,
  Props,
  ReactiveTarget,
} from '@arrow-js/core'
import { getRenderContext, runWithRenderContext } from './context'

type AsyncStatus = 'idle' | 'pending' | 'resolved' | 'rejected'

export function asyncComponent<
  TValue,
  TEvents extends EventMap = EventMap,
  TSnapshot = unknown,
>(
  loader:
    | (() => Promise<TValue> | TValue)
    | ((props: undefined, emit: Emit<TEvents>) => Promise<TValue> | TValue),
  options?: AsyncComponentOptions<ReactiveTarget, TValue, TEvents, TSnapshot>
): Component
export function asyncComponent<
  TProps extends ReactiveTarget,
  TValue,
  TEvents extends EventMap = EventMap,
  TSnapshot = unknown,
>(
  loader:
    | ((props: Props<TProps>) => Promise<TValue> | TValue)
    | ((props: Props<TProps>, emit: Emit<TEvents>) => Promise<TValue> | TValue),
  options?: AsyncComponentOptions<TProps, TValue, TEvents, TSnapshot>
): ComponentWithProps<TProps, TEvents>
export function asyncComponent<
  TProps extends ReactiveTarget,
  TValue,
  TEvents extends EventMap = EventMap,
  TSnapshot = unknown,
>(
  loader:
    | ((props: Props<TProps>) => Promise<TValue> | TValue)
    | ((props: Props<TProps>, emit: Emit<TEvents>) => Promise<TValue> | TValue)
    | (() => Promise<TValue> | TValue)
    | ((props: undefined, emit: Emit<TEvents>) => Promise<TValue> | TValue),
  options: AsyncComponentOptions<TProps, TValue, TEvents, TSnapshot> = {}
): Component<TEvents> | ComponentWithProps<TProps, TEvents> {
  let clientComponentIndex = 0

  return component((props: Props<TProps>, emit: Emit<TEvents>) => {
    const state = reactive({
      id: '' as string,
      status: 'idle' as AsyncStatus,
      value: null as unknown,
      error: null as unknown,
    })
    let inFlight: Promise<void> | null = null

    const context = getRenderContext()
    const runInContext = <T>(fn: () => T) => runWithRenderContext(context, fn)
    if (!state.id) {
      state.id =
        context?.claimComponentId(options.idPrefix) ??
        `${options.idPrefix ?? 'c'}:client:${clientComponentIndex++}`
    }

    if (state.status === 'idle' && context) {
      const snapshot = context.consumeSnapshot(state.id)
      if (snapshot !== undefined) {
        state.value = options.deserialize
          ? options.deserialize(snapshot as TSnapshot, props)
          : snapshot
        state.status = 'resolved'
      }
    }

    const start = () => {
      if (inFlight) return inFlight

      state.status = 'pending'
      const task = Promise.resolve()
        .then(() =>
          runInContext(() =>
            (
              loader as (
                props: Props<TProps>,
                emit: Emit<TEvents>
              ) => Promise<TValue> | TValue
            )(props, emit)
          )
        )
        .then((value) => {
          runInContext(() => {
            state.value = value
            state.status = 'resolved'
            const snapshot =
              options.serialize?.(value, props, emit) ??
              createDefaultSnapshot(value)

            if (context && snapshot !== undefined) {
              context.recordSnapshot(state.id, snapshot)
            }
          })
        })
        .catch((error) => {
          runInContext(() => {
            state.error = error
            state.status = 'rejected'
          })
        })
        .finally(() => {
          inFlight = null
        })

      inFlight = task
      context?.track(task)
      return task
    }

    if (state.status === 'idle') {
      void start()
    }

    return html`${() => {
      if (state.status === 'rejected') {
        if (options.onError) {
          return runInContext(() => options.onError!(state.error, props, emit))
        }
        throw state.error
      }

      if (state.status === 'resolved') {
        return runInContext(() =>
          options.render
            ? options.render(state.value as TValue, props, emit)
            : (state.value as TValue)
        )
      }

      return options.fallback ?? ''
    }}`
  }) as Component<TEvents> | ComponentWithProps<TProps, TEvents>
}

function createDefaultSnapshot<TValue>(value: TValue) {
  try {
    return JSON.stringify(value) === undefined ? undefined : value
  } catch {
    return undefined
  }
}
