import { nextTick, reactive, watch } from './reactive'
import type {
  HostToVmMessage,
  SandboxedEventPayload,
  SandboxConsoleMethod,
  SerializedNode,
  TemplateDescriptor,
  TemplateNodeDescriptor,
  TemplateValuePart,
  VmInitPayload,
  VmPatch,
  VmToHostMessage,
} from '../../shared/protocol'

interface TemplateInstance {
  __arrowSandboxTemplate: true
  descriptorId: string
  expressions: unknown[]
}

type ComponentProps = Record<PropertyKey, unknown> | undefined
type ComponentEventMap = Record<string, unknown>
type ComponentEvents<T extends ComponentEventMap = ComponentEventMap> = {
  [K in keyof T]?: (payload: T[K]) => void
}
type ComponentEmit<T extends ComponentEventMap = ComponentEventMap> = <
  K extends keyof T,
>(
  event: K,
  payload: T[K]
) => void
type ComponentFactory = (
  props?: Record<PropertyKey, unknown>,
  emit?: ComponentEmit
) => unknown

interface ComponentCall {
  __arrowSandboxComponent: true
  h: ComponentFactory
  p: ComponentProps
  e: ComponentEvents | undefined
  k: unknown
  key: (key: unknown) => ComponentCall
}

type SandboxComponent = (
  input?: ComponentProps,
  events?: ComponentEvents
) => ComponentCall

type AsyncStatus = 'idle' | 'pending' | 'resolved' | 'rejected'

interface AsyncSandboxComponentOptions<TValue = unknown> {
  fallback?: unknown
  onError?: (
    error: unknown,
    props: Record<PropertyKey, unknown> | undefined,
    emit: ComponentEmit
  ) => unknown
  render?: (
    value: TValue,
    props: Record<PropertyKey, unknown> | undefined,
    emit: ComponentEmit
  ) => unknown
  serialize?: (
    value: TValue,
    props: Record<PropertyKey, unknown> | undefined,
    emit: ComponentEmit
  ) => unknown
  deserialize?: (snapshot: unknown, props: Record<PropertyKey, unknown> | undefined) => TValue
  idPrefix?: string
}

interface RefHandle {
  current?: unknown
}

interface MountedElementNode {
  kind: 'element'
  id: string
  tag: string
  attrs: Record<string, string | boolean>
  events: Record<string, string>
  children: MountedNode[]
  cleanups: Array<() => void>
}

interface MountedTextNode {
  kind: 'text'
  id: string
  text: string
  cleanups: Array<() => void>
}

interface MountedRegionNode {
  kind: 'region'
  id: string
  children: MountedNode[]
  cleanups: Array<() => void>
}

interface MountedFragmentNode {
  kind: 'fragment'
  children: MountedNode[]
  cleanups: Array<() => void>
}

type MountedNode =
  | MountedFragmentNode
  | MountedElementNode
  | MountedTextNode
  | MountedRegionNode

interface RuntimeState {
  descriptors: Record<string, TemplateDescriptor>
  handlers: Map<string, (event: SandboxedEventPayload) => unknown>
  root: MountedNode | null
  nextNodeId: number
  nextHandlerId: number
  debug: boolean
}

declare global {
  const __arrowHostSend: (message: string) => void
}

const state: RuntimeState = {
  descriptors: {},
  handlers: new Map(),
  root: null,
  nextNodeId: 0,
  nextHandlerId: 0,
  debug: false,
}

const ASYNC_COMPONENT_DESCRIPTOR: TemplateDescriptor = {
  id: '__arrow_sandbox_async_component__',
  root: {
    kind: 'region',
    exprIndex: 0,
  },
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as {
  new (...args: unknown[]): unknown
}

function setComponentKey(this: ComponentCall, key: unknown) {
  this.k = key
  return this
}

const propsProxyHandler: ProxyHandler<Record<number, unknown>> = {
  get(target, key) {
    const source = target[0] as ComponentProps
    if (!source) return undefined
    return (source as Record<PropertyKey, unknown>)[key]
  },
  set(target, key, value) {
    const source = target[0] as ComponentProps
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
      ? (target.s as Record<PropertyKey, unknown>)[key]
      : undefined
  },
  set(target, key, value) {
    if (!target.k.includes(key)) return false
    return Reflect.set(target.s, key, value)
  },
}

function send(message: VmToHostMessage) {
  __arrowHostSend(JSON.stringify(message))
}

function reportError(error: unknown) {
  const message =
    error instanceof Error
      ? [error.message, error.stack].filter(Boolean).join('\n')
      : String(error)

  send({
    type: 'error',
    error: message,
  })
}

function allocNodeId() {
  state.nextNodeId += 1
  return `snode:${state.nextNodeId}`
}

function allocHandlerId() {
  state.nextHandlerId += 1
  return `shandler:${state.nextHandlerId}`
}

function isTemplateInstance(value: unknown): value is TemplateInstance {
  return (
    !!value &&
    typeof value === 'object' &&
    '__arrowSandboxTemplate' in value
  )
}

function isComponentCall(value: unknown): value is ComponentCall {
  return (
    !!value &&
    typeof value === 'object' &&
    '__arrowSandboxComponent' in value
  )
}

function createPropsProxy(
  source: ComponentProps,
  factory: ComponentFactory,
  events?: ComponentEvents
) {
  const box = reactive({ 0: source, 1: factory, 2: events }) as Record<
    number,
    unknown
  >
  const emit = ((event: PropertyKey, payload: unknown) => {
    const handlers = box[2] as ComponentEvents | undefined
    const handler = handlers?.[event as keyof ComponentEvents]
    if (typeof handler === 'function') {
      handler(payload)
    }
  }) as ComponentEmit

  return [
    new Proxy(box, propsProxyHandler) as Record<PropertyKey, unknown>,
    emit,
    box,
  ] as const
}

function toTextValue(value: unknown): string {
  if (value == null || value === false) return ''
  if (Array.isArray(value)) return value.map((item) => toTextValue(item)).join('')
  return String(value)
}

function computeTextParts(parts: TemplateValuePart[], expressions: unknown[]) {
  return parts
    .map((part) => {
      if (part.kind === 'static') return part.value
      const expression = expressions[part.exprIndex]
      const value =
        typeof expression === 'function'
          ? (expression as () => unknown)()
          : expression
      return toTextValue(value)
    })
    .join('')
}

function computeAttributeValue(parts: TemplateValuePart[], expressions: unknown[]) {
  if (parts.length === 1 && parts[0]?.kind === 'expr') {
    const expression = expressions[parts[0].exprIndex]
    return typeof expression === 'function'
      ? (expression as () => unknown)()
      : expression
  }

  return parts
    .map((part) => {
      if (part.kind === 'static') return part.value
      const expression = expressions[part.exprIndex]
      const value =
        typeof expression === 'function'
          ? (expression as () => unknown)()
          : expression
      return value == null || value === false ? '' : String(value)
    })
    .join('')
}

function serialize(node: MountedNode): SerializedNode {
  switch (node.kind) {
    case 'fragment':
      return {
        kind: 'fragment',
        children: node.children.map(serialize),
      }
    case 'element':
      return {
        kind: 'element',
        id: node.id,
        tag: node.tag,
        attrs: { ...node.attrs },
        events: { ...node.events },
        children: node.children.map(serialize),
      }
    case 'text':
      return {
        kind: 'text',
        id: node.id,
        text: node.text,
      }
    case 'region':
      return {
        kind: 'region',
        id: node.id,
        children: node.children.map(serialize),
      }
  }
}

function emitPatches(patches: VmPatch[]) {
  if (!patches.length) return
  send({
    type: 'patch',
    patches,
  })
}

function cleanupNode(node: MountedNode) {
  for (const cleanup of node.cleanups) {
    cleanup()
  }

  if (node.kind !== 'text') {
    for (const child of node.children) {
      cleanupNode(child)
    }
  }
}

function createFragmentNode(children: MountedNode[]): MountedFragmentNode {
  return {
    kind: 'fragment',
    children,
    cleanups: [],
  }
}

function normalizeRenderable(
  value: unknown,
  emitPatchUpdates: boolean
): MountedNode[] {
  if (value == null || value === false) return []

  if (Array.isArray(value)) {
    return value.flatMap((entry) =>
      normalizeRenderable(entry, emitPatchUpdates)
    )
  }

  if (isComponentCall(value)) {
    const [props, emit] = createPropsProxy(value.p, value.h, value.e)
    const renderable = value.h(props, emit)
    const children = normalizeRenderable(renderable, emitPatchUpdates)
    return [children.length === 1 ? children[0] : createFragmentNode(children)]
  }

  if (isTemplateInstance(value)) {
    return [mountTemplate(value, emitPatchUpdates)]
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return [
      {
        kind: 'text',
        id: allocNodeId(),
        text: String(value),
        cleanups: [],
      },
    ]
  }

  throw new Error(
    `Unsupported sandbox renderable: ${Object.prototype.toString.call(value)}`
  )
}

function bindRef(target: unknown, id: string, tagName: string) {
  if (!target || typeof target !== 'object') {
    return () => {}
  }

  const ref = target as RefHandle
  const refValue = {
    id,
    kind: 'node',
    tagName,
  }
  ref.current = refValue

  return () => {
    if (ref.current === refValue) {
      ref.current = null
    }
  }
}

function mountDescriptor(
  descriptor: TemplateNodeDescriptor,
  expressions: unknown[],
  emitPatchUpdates: boolean
): MountedNode {
  switch (descriptor.kind) {
    case 'fragment':
      return createFragmentNode(
        descriptor.children.map((child) =>
          mountDescriptor(child, expressions, emitPatchUpdates)
        )
      )
    case 'text':
      return {
        kind: 'text',
        id: allocNodeId(),
        text: descriptor.value,
        cleanups: [],
      }
    case 'text-binding': {
      const node: MountedTextNode = {
        kind: 'text',
        id: allocNodeId(),
        text: '',
        cleanups: [],
      }
      node.text = computeTextParts(descriptor.parts, expressions)

      const isDynamic = descriptor.parts.some((part) => {
        if (part.kind !== 'expr') return false
        return typeof expressions[part.exprIndex] === 'function'
      })

      if (isDynamic) {
        const [, stop] = watch(
          () => computeTextParts(descriptor.parts, expressions),
          (value) => {
            if (value === node.text) return value
            node.text = value
            if (emitPatchUpdates) {
              emitPatches([
                {
                  type: 'set-text',
                  nodeId: node.id,
                  text: value,
                },
              ])
            }
            return value
          }
        )
        node.cleanups.push(stop)
      }

      return node
    }
    case 'region': {
      const node: MountedRegionNode = {
        kind: 'region',
        id: allocNodeId(),
        children: [],
        cleanups: [],
      }

      const expression = expressions[descriptor.exprIndex]
      const updateChildren = (value: unknown, emit: boolean) => {
        for (const child of node.children) {
          cleanupNode(child)
        }

        node.children = normalizeRenderable(value, emitPatchUpdates)

        if (emit) {
          emitPatches([
            {
              type: 'replace-region',
              regionId: node.id,
              children: node.children.map(serialize),
            },
          ])
        }
      }

      if (typeof expression === 'function') {
        updateChildren((expression as () => unknown)(), false)
        const [, stop] = watch(expression as () => unknown, (value) => {
          updateChildren(value, emitPatchUpdates)
          return value
        })
        node.cleanups.push(stop)
      } else {
        updateChildren(expression, false)
      }

      return node
    }
    case 'element': {
      const node: MountedElementNode = {
        kind: 'element',
        id: allocNodeId(),
        tag: descriptor.tag,
        attrs: { ...descriptor.staticAttributes },
        events: {},
        children: [],
        cleanups: [],
      }

      if (descriptor.refBinding) {
        node.cleanups.push(
          bindRef(
            expressions[descriptor.refBinding.exprIndex],
            node.id,
            descriptor.tag
          )
        )
      }

      for (const binding of descriptor.dynamicAttributes) {
        const applyValue = (value: unknown, emit: boolean) => {
          if (value == null || value === false) {
            delete node.attrs[binding.name]
            if (emit) {
              emitPatches([
                {
                  type: 'remove-attribute',
                  nodeId: node.id,
                  name: binding.name,
                },
              ])
            }
            return
          }

          const nextValue = value === true ? true : String(value)
          node.attrs[binding.name] = nextValue

          if (emit) {
            emitPatches([
              {
                type: 'set-attribute',
                nodeId: node.id,
                name: binding.name,
                value: nextValue,
              },
            ])
          }
        }

        applyValue(computeAttributeValue(binding.parts, expressions), false)

        const isDynamic = binding.parts.some((part) => {
          if (part.kind !== 'expr') return false
          return typeof expressions[part.exprIndex] === 'function'
        })

        if (isDynamic) {
          const [, stop] = watch(
            () => computeAttributeValue(binding.parts, expressions),
            (value) => {
              applyValue(value, emitPatchUpdates)
              return value
            }
          )
          node.cleanups.push(stop)
        }
      }

      for (const eventBinding of descriptor.eventBindings) {
        const handler = expressions[eventBinding.exprIndex]
        if (typeof handler !== 'function') continue

        const handlerId = allocHandlerId()
        state.handlers.set(handlerId, handler as (event: SandboxedEventPayload) => unknown)
        node.events[eventBinding.eventType] = handlerId
        node.cleanups.push(() => {
          state.handlers.delete(handlerId)
        })
      }

      node.children = descriptor.children.map((child) =>
        mountDescriptor(child, expressions, emitPatchUpdates)
      )
      return node
    }
  }
}

function mountTemplate(
  template: TemplateInstance,
  emitPatchUpdates: boolean
): MountedNode {
  const descriptor = state.descriptors[template.descriptorId]
  if (!descriptor) {
    throw new Error(`Unknown sandbox template "${template.descriptorId}".`)
  }

  return mountDescriptor(descriptor.root, template.expressions, emitPatchUpdates)
}

function destroyRuntime() {
  if (state.root) {
    cleanupNode(state.root)
  }

  state.handlers.clear()
  state.root = null
  state.descriptors = {}
  state.nextNodeId = 0
  state.nextHandlerId = 0
}

export function createTemplateInstance(
  descriptorId: string,
  expressions: unknown[]
): TemplateInstance {
  return {
    __arrowSandboxTemplate: true,
    descriptorId,
    expressions,
  }
}

export async function initSandbox(payload: VmInitPayload) {
  destroyRuntime()
  state.descriptors = {
    [ASYNC_COMPONENT_DESCRIPTOR.id]: ASYNC_COMPONENT_DESCRIPTOR,
    ...payload.descriptors,
  }
  state.debug = !!payload.debug

  const entryModule = await import(payload.entryPath)
  const rootNodes = normalizeRenderable(entryModule.default, true)
  state.root =
    rootNodes.length === 1 ? rootNodes[0] : createFragmentNode(rootNodes)

  send({ type: 'ready' })
  send({
    type: 'render',
    tree: serialize(state.root),
  })
}

export async function dispatchMessage(message: HostToVmMessage) {
  if (message.type === 'destroy') {
    destroyRuntime()
    return
  }

  if (message.type === 'event') {
    const handler = state.handlers.get(message.payload.handlerId)
    if (!handler) return
    await Promise.resolve(handler(message.payload.event))
    return
  }

  if (message.type === 'init') {
    await initSandbox(message.payload)
  }
}

export function html(
  _strings?: TemplateStringsArray | string[],
  ..._expSlots: unknown[]
) {
  throw new Error(
    'Sandbox html tags must be precompiled before execution.'
  )
}

function createAsyncComponent(
  loader: ComponentFactory,
  options: AsyncSandboxComponentOptions = {}
) : SandboxComponent {
  return component((props?: ComponentProps, emit?: ComponentEmit) => {
    const state = reactive({
      status: 'idle' as AsyncStatus,
      value: null as unknown,
      error: null as unknown,
    })
    let inFlight: Promise<void> | null = null

    const start = () => {
      if (inFlight) return inFlight

      state.status = 'pending'
      const task = (async () => {
        try {
          const value = await loader(props, emit)
          state.value = value
          state.status = 'resolved'
        } catch (error) {
          state.error = error
          state.status = 'rejected'
        } finally {
          inFlight = null
        }
      })()

      inFlight = task
      return task
    }

    if (state.status === 'idle') {
      void start()
    }

    return createTemplateInstance(ASYNC_COMPONENT_DESCRIPTOR.id, [
      () => {
        if (state.status === 'rejected') {
          if (options.onError) {
            return options.onError(state.error, props, emit as ComponentEmit)
          }
          throw state.error
        }

        if (state.status === 'resolved') {
          return options.render
            ? options.render(
                state.value,
                props,
                emit as ComponentEmit
              )
            : state.value
        }

        return options.fallback ?? ''
      },
    ])
  })
}

export function component(
  factory: ComponentFactory,
  options?: AsyncSandboxComponentOptions
) : SandboxComponent {
  if (options || factory instanceof AsyncFunction) {
    return createAsyncComponent(factory, options)
  }

  return ((input?: ComponentProps, events?: ComponentEvents) =>
    ({
      __arrowSandboxComponent: true,
      h: factory,
      k: undefined,
      p: input,
      e: events,
      key: setComponentKey,
    })) as SandboxComponent
}

export function pick<T extends object, K extends keyof T>(
  source: T,
  ...keys: K[]
): T | Pick<T, K> {
  return keys.length
    ? (new Proxy(
        {
          k: keys as PropertyKey[],
          s: source,
        },
        narrowedPropsHandler
      ) as unknown as Pick<T, K>)
    : source
}

export const t = html
export const c = component
export const props = pick
export const r = reactive
export const w = watch

function serializeConsoleValue(
  value: unknown,
  depth = 0,
  seen = new Set<object>()
): unknown {
  if (value == null) return value

  switch (typeof value) {
    case 'string':
    case 'number':
    case 'boolean':
      return value
    case 'undefined':
      return '[undefined]'
    case 'bigint':
      return `${value}n`
    case 'symbol':
      return String(value)
    case 'function':
      return `[Function ${(value as Function).name || 'anonymous'}]`
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    }
  }

  if (typeof value !== 'object') {
    return String(value)
  }

  if (seen.has(value as object)) {
    return '[Circular]'
  }

  if (depth >= 3) {
    return Object.prototype.toString.call(value)
  }

  seen.add(value as object)

  try {
    if (Array.isArray(value)) {
      return value.map((entry) => serializeConsoleValue(entry, depth + 1, seen))
    }

    const output: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      output[key] = serializeConsoleValue(entry, depth + 1, seen)
    }

    if (Object.keys(output).length) {
      return output
    }

    return Object.prototype.toString.call(value)
  } finally {
    seen.delete(value as object)
  }
}

export function log(method: SandboxConsoleMethod, args: unknown[]) {
  send({
    type: 'log',
    method,
    args: args.map((arg) => serializeConsoleValue(arg)),
  })
}

export function output(payload: unknown) {
  send({
    type: 'output',
    payload: serializeConsoleValue(payload),
  })
}

export {
  nextTick,
  reactive,
  reportError,
  watch,
}
