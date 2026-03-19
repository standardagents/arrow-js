import { component, html, watch } from '@arrow-js/core'
import type { ArrowTemplate, Props } from '@arrow-js/core'
import type {
  HostToVmMessage,
  SandboxEvents,
  SandboxProps,
  SerializedNode,
  VmPatch,
  VmToHostMessage,
} from '../shared/protocol'
import { normalizeVirtualPath } from '../compiler/normalize'
import { HostRenderer } from './renderer'
import { formatError, toDisplayError } from './errors'
import type { compileSandboxGraph as compileSandboxGraphType } from '../compiler'
import type { VmRunner } from './quickjs'

interface BootResult {
  runner: VmRunner
  initialTree: SerializedNode
  initialPatches: VmPatch[]
}

interface SandboxBootRuntime {
  compileSandboxGraph: typeof compileSandboxGraphType
  createVmRunner: typeof import('./quickjs').createVmRunner
}

interface ResolvedSandboxProps {
  cssText?: string
  debug?: boolean
  onError?: (error: Error | string) => void
  shadowDOM: boolean
  source: Record<string, string>
  sourceSignature: string
}

type SandboxTemplateProps = Record<PropertyKey, unknown> & {
  config: SandboxProps
  events?: SandboxEvents
}

const SANDBOX_TAG_NAME = 'arrow-sandbox'
const sandboxHostRecords = new Map<string, SandboxHostRecord>()
const sandboxHostElements = new Map<string, ArrowSandboxElement>()
let nextSandboxHostId = 0
let sandboxBootRuntimePromise: Promise<SandboxBootRuntime> | null = null

interface SandboxHostRecord {
  events?: SandboxEvents
  props: ResolvedSandboxProps
}

class SandboxController {
  private props: ResolvedSandboxProps
  private events: SandboxEvents | undefined
  private readonly mountPoint: Element
  private readonly renderer: HostRenderer
  private runner: VmRunner | null = null

  constructor(
    mountPoint: Element,
    props: ResolvedSandboxProps,
    events?: SandboxEvents
  ) {
    this.mountPoint = mountPoint
    this.props = props
    this.events = events
    this.renderer = new HostRenderer({
      mountPoint,
      onEvent: (handlerId, payload) =>
        this.dispatch({
          type: 'event',
          payload: {
            handlerId,
            event: payload,
          },
        }),
      onError: (error) => this.handleError(error),
    })
  }

  setCallbacks(props: ResolvedSandboxProps, events?: SandboxEvents) {
    this.props = props
    this.events = events
  }

  async mount() {
    try {
      const booted = await this.boot()
      this.runner?.destroy()
      this.runner = booted.runner
      this.renderer.render(booted.initialTree)
      this.renderer.applyPatches(booted.initialPatches)
    } catch (error) {
      this.handleError(error)
      throw error
    }
  }

  destroy() {
    this.runner?.destroy()
    this.runner = null
    this.renderer.destroy()
  }

  private async boot(): Promise<BootResult> {
    const runtime = await loadSandboxBootRuntime()
    const compiled = runtime.compileSandboxGraph({
      source: this.props.source,
      debug: this.props.debug,
      onError: this.props.onError,
      shadowDOM: this.props.shadowDOM,
    })
    let initialTree: SerializedNode | null = null
    let activated = false
    const initialPatches: VmPatch[] = []

    const runner = await runtime.createVmRunner({
      compiled,
      debug: this.props.debug,
      onMessage: (message) => {
        switch (message.type) {
          case 'render':
            if (!activated) {
              initialTree = message.tree
              return
            }
            this.renderer.render(message.tree)
            return
          case 'patch':
            if (!activated) {
              initialPatches.push(...message.patches)
              return
            }
            this.renderer.applyPatches(message.patches)
            return
          case 'error':
            this.handleError(message.error)
            return
          case 'log':
            if (!this.props.debug) return
            if (message.method === 'trace') {
              console.log(...message.args)
              return
            }
            {
              const method = (
                console as unknown as Record<
                  string,
                  ((...args: unknown[]) => void) | undefined
                >
              )[message.method]
              if (typeof method === 'function') {
                method.apply(console, message.args)
                return
              }
            }
            console.log(...message.args)
            return
          case 'output':
            this.events?.output?.(message.payload)
            return
          case 'ready':
            return
        }
      },
    })

    if (!initialTree) {
      runner.destroy()
      throw new Error('Sandbox VM did not emit an initial render tree.')
    }

    activated = true
    return {
      runner,
      initialTree,
      initialPatches,
    }
  }

  private async dispatch(message: HostToVmMessage) {
    if (!this.runner) return

    try {
      await this.runner.dispatch(message)
    } catch (error) {
      this.handleError(error)
    }
  }

  private handleError(error: unknown) {
    this.props.onError?.(toDisplayError(error))
    if (!this.props.onError) {
      console.error(formatError(error))
    }
  }
}

function loadSandboxBootRuntime(): Promise<SandboxBootRuntime> {
  if (sandboxBootRuntimePromise) {
    return sandboxBootRuntimePromise
  }

  sandboxBootRuntimePromise = Promise.all([
    import('../compiler'),
    import('./quickjs'),
  ]).then(([compiler, quickjs]) => ({
    compileSandboxGraph: compiler.compileSandboxGraph,
    createVmRunner: quickjs.createVmRunner,
  }))

  return sandboxBootRuntimePromise
}

class ArrowSandboxElement extends HTMLElement {
  static get observedAttributes() {
    return ['data-sandbox-id']
  }

  private controller: SandboxController | null = null
  private currentSignature = ''
  private hostId: string | null = null
  private mountPoint: HTMLDivElement | null = null
  private sandboxEventsState: SandboxEvents | undefined
  private sandboxPropsValue: ResolvedSandboxProps | null = null
  private shadowMode = false
  private styleElement: HTMLStyleElement | null = null
  private syncQueued = false
  private syncVersion = 0

  connectedCallback() {
    this.attachHostRecord()
  }

  disconnectedCallback() {
    this.syncVersion += 1
    if (this.hostId && sandboxHostElements.get(this.hostId) === this) {
      const hostId = this.hostId
      sandboxHostElements.delete(hostId)
      queueMicrotask(() => {
        if (!sandboxHostElements.has(hostId)) {
          sandboxHostRecords.delete(hostId)
        }
      })
    }
    this.destroyController()
  }

  attributeChangedCallback(name: string) {
    if (name === 'data-sandbox-id') {
      this.attachHostRecord()
    }
  }

  applyRecord(record: SandboxHostRecord) {
    this.sandboxPropsValue = record.props
    this.sandboxEventsState = record.events
    if (this.controller && this.sandboxPropsValue) {
      this.controller.setCallbacks(
        this.sandboxPropsValue,
        this.sandboxEventsState
      )
    }
    this.requestSync()
  }

  private destroyController() {
    this.controller?.destroy()
    this.controller = null
    this.currentSignature = ''
    this.removeAttribute('data-ready')
  }

  private requestSync() {
    if (this.syncQueued) return
    this.syncQueued = true
    queueMicrotask(() => {
      this.syncQueued = false
      void this.sync()
    })
  }

  private attachHostRecord() {
    const nextHostId = this.getAttribute('data-sandbox-id')
    if (!nextHostId) return

    this.hostId = nextHostId
    sandboxHostElements.set(nextHostId, this)
    const record = sandboxHostRecords.get(nextHostId)
    if (record) {
      this.applyRecord(record)
    } else {
      this.requestSync()
    }
  }

  private ensureSurface(shadowDOM: boolean) {
    if (
      this.mountPoint &&
      this.styleElement &&
      this.shadowMode === shadowDOM
    ) {
      return
    }

    this.destroyController()

    if (shadowDOM) {
      const root =
        this.shadowRoot ??
        this.attachShadow({
          mode: 'open',
        })
      root.replaceChildren()
      this.replaceChildren()
      this.styleElement = document.createElement('style')
      this.mountPoint = document.createElement('div')
      root.append(this.styleElement, this.mountPoint)
    } else {
      this.shadowRoot?.replaceChildren()
      this.replaceChildren()
      this.styleElement = document.createElement('style')
      this.mountPoint = document.createElement('div')
      this.append(this.styleElement, this.mountPoint)
    }

    this.shadowMode = shadowDOM
  }

  private async sync() {
    const props = this.sandboxPropsValue
    if (!props) return

    const version = ++this.syncVersion
    this.ensureSurface(props.shadowDOM)
    if (!this.mountPoint || !this.styleElement) return

    this.styleElement.textContent = props.cssText ?? ''

    if (
      this.controller &&
      this.currentSignature === props.sourceSignature &&
      this.shadowMode === props.shadowDOM
    ) {
      this.controller.setCallbacks(props, this.sandboxEventsState)
      return
    }

    const nextController = new SandboxController(
      this.mountPoint,
      props,
      this.sandboxEventsState
    )

    try {
      await nextController.mount()
    } catch (error) {
      if (version === this.syncVersion) {
        this.dataset.ready = 'error'
        this.dispatchEvent(
          new CustomEvent('sandbox-error', {
            detail: error,
          })
        )
      }
      if (version !== this.syncVersion) {
        nextController.destroy()
      }
      return
    }

    if (version !== this.syncVersion) {
      nextController.destroy()
      return
    }

    this.destroyController()
    this.controller = nextController
    this.currentSignature = props.sourceSignature
    this.dataset.ready = 'true'
    this.dispatchEvent(new CustomEvent('sandbox-ready'))
  }
}

function ensureSandboxElement() {
  if (customElements.get(SANDBOX_TAG_NAME)) return
  customElements.define(SANDBOX_TAG_NAME, ArrowSandboxElement)
}

function setSandboxHostRecord(id: string, record: SandboxHostRecord) {
  sandboxHostRecords.set(id, record)
  sandboxHostElements.get(id)?.applyRecord(record)
}

function cloneSandboxEvents(events?: SandboxEvents) {
  if (!events?.output) return undefined
  return {
    output: events.output,
  }
}

function resolveSandboxProps(props: SandboxProps): ResolvedSandboxProps {
  const sourceEntries = Object.entries(props.source || {})
    .map(([name, value]) => [normalizeVirtualPath(name), String(value)] as const)
    .sort(([left], [right]) => left.localeCompare(right))
  const source = Object.fromEntries(sourceEntries)

  return {
    cssText: source['/main.css'],
    debug: props.debug,
    onError: props.onError,
    shadowDOM: props.shadowDOM !== false,
    source,
    sourceSignature: JSON.stringify([
      props.debug ?? false,
      props.shadowDOM !== false,
      sourceEntries,
    ]),
  }
}

const SandboxHostComponent = component<SandboxTemplateProps>(
  (props: Props<SandboxTemplateProps>) => {
    const hostId = `arrow-sandbox:${++nextSandboxHostId}`
    const syncRecord = () => {
      setSandboxHostRecord(hostId, {
        events: cloneSandboxEvents(props.events),
        props: resolveSandboxProps(props.config),
      })
      return hostId
    }

    syncRecord()
    watch(syncRecord, (value) => value)

    return html`<arrow-sandbox data-sandbox-id="${hostId}"></arrow-sandbox>`
  }
)

export function sandbox(
  props: SandboxProps,
  events?: SandboxEvents
): ArrowTemplate {
  ensureSandboxElement()
  return html`${SandboxHostComponent({ config: props, events })}`
}
