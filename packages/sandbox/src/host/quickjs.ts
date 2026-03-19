import {
  DEBUG_ASYNC,
  RELEASE_ASYNC,
  newQuickJSAsyncWASMModule,
} from 'quickjs-emscripten'
import type {
  CompiledSandboxGraph,
} from '../compiler'
import type {
  HostToVmMessage,
  VmInitPayload,
  VmToHostMessage,
} from '../shared/protocol'
import {
  VM_BOOTSTRAP_MODULE_ID,
  VM_CORE_MODULE_ID,
  vmRuntimeModules,
} from '../vm/generated-modules'
import { SandboxRuntimeError } from './errors'

interface VmRunnerOptions {
  compiled: CompiledSandboxGraph
  debug?: boolean
  onMessage: (message: VmToHostMessage) => void
}

interface SandboxTimerRecord {
  callback: any
  args: any[]
  handle: ReturnType<typeof globalThis.setTimeout> | ReturnType<typeof globalThis.setInterval>
  repeat: boolean
}

interface SandboxFetchRequest {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
  redirect: RequestRedirect
}

interface SandboxFetchResponseData {
  ok: boolean
  status: number
  statusText: string
  url: string
  redirected: boolean
  headers: Record<string, string>
  bodyBytes: Uint8Array
}

interface SandboxFetchRecord {
  controller: AbortController
  deferred: any
  timeoutHandle: ReturnType<typeof globalThis.setTimeout> | null
  active: boolean
  timedOut: boolean
}

export interface VmRunner {
  dispatch(message: HostToVmMessage): Promise<void>
  destroy(): void
}

const quickJsModules = new Map<boolean, Promise<Awaited<ReturnType<typeof newQuickJSAsyncWASMModule>>>>()
const SAFE_FETCH_ALLOWED_INIT_KEYS = new Set([
  'body',
  'credentials',
  'headers',
  'method',
  'mode',
  'redirect',
  'referrerPolicy',
])
const SAFE_FETCH_ALLOWED_METHODS = new Set([
  'DELETE',
  'GET',
  'HEAD',
  'PATCH',
  'POST',
  'PUT',
])
const SAFE_FETCH_BLOCKED_HEADER_PATTERNS = [
  /^(authorization|cookie|cookie2|host|origin|referer|user-agent)$/i,
  /^proxy-/i,
  /^sec-/i,
]
const SANDBOX_FETCH_TIMEOUT_MS = 15_000
const SANDBOX_FETCH_MAX_RESPONSE_BYTES = 1_000_000
const textDecoder = new TextDecoder()

function isLocalHttpHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

function sanitizeFetchHeaders(rawHeaders: unknown) {
  if (rawHeaders == null) return {}

  const output: Record<string, string> = {}
  const assignHeader = (name: unknown, value: unknown) => {
    if (typeof name !== 'string' || !name.trim()) {
      throw new SandboxRuntimeError(
        'Sandbox fetch() headers must use non-empty string names.'
      )
    }

    const normalizedName = name.toLowerCase()
    if (
      SAFE_FETCH_BLOCKED_HEADER_PATTERNS.some((pattern) =>
        pattern.test(normalizedName)
      )
    ) {
      throw new SandboxRuntimeError(
        `Sandbox fetch() does not allow the "${normalizedName}" header.`
      )
    }

    if (value == null) {
      delete output[normalizedName]
      return
    }

    output[normalizedName] = String(value)
  }

  if (Array.isArray(rawHeaders)) {
    for (const entry of rawHeaders) {
      if (!Array.isArray(entry) || entry.length !== 2) {
        throw new SandboxRuntimeError(
          'Sandbox fetch() header arrays must use [name, value] tuples.'
        )
      }

      assignHeader(entry[0], entry[1])
    }

    return output
  }

  if (typeof rawHeaders !== 'object') {
    throw new SandboxRuntimeError(
      'Sandbox fetch() headers must be a plain object or [name, value][] array.'
    )
  }

  for (const [name, value] of Object.entries(rawHeaders as Record<string, unknown>)) {
    assignHeader(name, value)
  }

  return output
}

function normalizeFetchRequest(
  rawUrl: string,
  rawInit: unknown
): SandboxFetchRequest {
  let parsedUrl: URL

  try {
    parsedUrl = new URL(rawUrl)
  } catch {
    throw new SandboxRuntimeError(
      'Sandbox fetch() requires an absolute URL.'
    )
  }

  if (
    parsedUrl.protocol !== 'https:' &&
    !(parsedUrl.protocol === 'http:' && isLocalHttpHost(parsedUrl.hostname))
  ) {
    throw new SandboxRuntimeError(
      'Sandbox fetch() only supports https URLs and localhost http URLs.'
    )
  }

  if (rawInit == null) {
    return {
      url: parsedUrl.toString(),
      method: 'GET',
      headers: {},
      redirect: 'follow',
    }
  }

  if (typeof rawInit !== 'object' || Array.isArray(rawInit)) {
    throw new SandboxRuntimeError(
      'Sandbox fetch() init must be a plain object.'
    )
  }

  const init = rawInit as Record<string, unknown>
  for (const [key, value] of Object.entries(init)) {
    if (value === undefined) continue
    if (!SAFE_FETCH_ALLOWED_INIT_KEYS.has(key)) {
      throw new SandboxRuntimeError(
        `Sandbox fetch() does not support the "${key}" option.`
      )
    }
  }

  if (init.credentials !== undefined && init.credentials !== 'omit') {
    throw new SandboxRuntimeError(
      'Sandbox fetch() always uses credentials: "omit".'
    )
  }

  if (init.mode !== undefined && init.mode !== 'cors') {
    throw new SandboxRuntimeError(
      'Sandbox fetch() only supports mode: "cors".'
    )
  }

  if (
    init.referrerPolicy !== undefined &&
    init.referrerPolicy !== 'no-referrer'
  ) {
    throw new SandboxRuntimeError(
      'Sandbox fetch() always uses referrerPolicy: "no-referrer".'
    )
  }

  const method =
    typeof init.method === 'string' && init.method.trim()
      ? init.method.trim().toUpperCase()
      : 'GET'

  if (!SAFE_FETCH_ALLOWED_METHODS.has(method)) {
    throw new SandboxRuntimeError(
      `Sandbox fetch() does not support the "${method}" method.`
    )
  }

  const redirect =
    typeof init.redirect === 'string' && init.redirect
      ? init.redirect
      : 'follow'

  if (
    redirect !== 'error' &&
    redirect !== 'follow' &&
    redirect !== 'manual'
  ) {
    throw new SandboxRuntimeError(
      `Sandbox fetch() does not support redirect: "${String(redirect)}".`
    )
  }

  const body = init.body
  if (body != null && method !== 'GET' && method !== 'HEAD') {
    if (typeof body !== 'string') {
      throw new SandboxRuntimeError(
        'Sandbox fetch() currently only supports string request bodies.'
      )
    }
  } else if (body != null) {
    throw new SandboxRuntimeError(
      `Sandbox fetch() does not allow a body with ${method} requests.`
    )
  }

  return {
    url: parsedUrl.toString(),
    method,
    headers: sanitizeFetchHeaders(init.headers),
    body: typeof body === 'string' ? body : undefined,
    redirect,
  }
}

function normalizeSpecifier(value: string) {
  return value.replace(/\/{2,}/g, '/')
}

function resolveModuleSpecifier(
  baseModuleName: string,
  requestedName: string,
  modules: Record<string, string>
) {
  if (requestedName === '@arrow-js/core') {
    return VM_CORE_MODULE_ID
  }

  if (requestedName.startsWith('/')) {
    const normalized = normalizeSpecifier(requestedName)
    if (normalized in modules) return normalized
    return normalized
  }

  if (requestedName.startsWith('.')) {
    const url = new URL(requestedName, `https://arrow-sandbox.local${baseModuleName}`)
    const normalized = normalizeSpecifier(url.pathname)
    if (normalized in modules) return normalized

    const fallbacks = [
      normalized,
      `${normalized}.ts`,
      `${normalized}.js`,
      `${normalized}.mjs`,
      `${normalized}/index.ts`,
      `${normalized}/index.js`,
      `${normalized}/index.mjs`,
    ]

    const found = fallbacks.find((candidate) => candidate in modules)
    if (found) return found
  }

  throw new SandboxRuntimeError(
    `Unsupported sandbox import "${requestedName}" from "${baseModuleName}".`
  )
}

async function getQuickJsModule(debug = false) {
  let modulePromise = quickJsModules.get(debug)
  if (!modulePromise) {
    modulePromise = newQuickJSAsyncWASMModule(debug ? DEBUG_ASYNC : RELEASE_ASYNC)
    quickJsModules.set(debug, modulePromise)
  }

  return modulePromise
}

function flushPendingJobs(runtime: any, context: any) {
  while (runtime.hasPendingJob()) {
    context.unwrapResult(runtime.executePendingJobs())
  }
}

async function settleHandle(runtime: any, context: any, handle: any) {
  const settledResult = context.resolvePromise(handle)
  flushPendingJobs(runtime, context)
  const settledHandle = context.unwrapResult(await settledResult)
  settledHandle.dispose()
  flushPendingJobs(runtime, context)
}

async function evalModule(runtime: any, context: any, code: string, fileName: string) {
  const result = await context.evalCodeAsync(code, fileName, { type: 'module' })
  const handle = context.unwrapResult(result)
  try {
    await settleHandle(runtime, context, handle)
  } finally {
    handle.dispose()
  }
}

export async function createVmRunner(
  options: VmRunnerOptions
): Promise<VmRunner> {
  const quickJs = await getQuickJsModule(!!options.debug)
  const runtime = quickJs.newRuntime()
  runtime.setMemoryLimit(16 * 1024 * 1024)
  runtime.setMaxStackSize(512 * 1024)

  const context = runtime.newContext()
  let destroyed = false
  let nextTimerId = 0
  const timers = new Map<number, SandboxTimerRecord>()
  const modules = {
    ...vmRuntimeModules,
    ...options.compiled.modules,
  }

  const formatRuntimeError = (error: unknown) =>
    error instanceof Error
      ? [error.message, error.stack].filter(Boolean).join('\n')
      : String(error)

  const reportRuntimeError = (error: unknown) => {
    options.onMessage({
      type: 'error',
      error: formatRuntimeError(error),
    })
  }

  let pendingJobDrainScheduled = false
  let pendingJobDrainPasses = 0
  const schedulePendingJobDrain = (extraPasses = 4) => {
    if (destroyed) return

    pendingJobDrainPasses = Math.max(pendingJobDrainPasses, extraPasses)
    if (pendingJobDrainScheduled) return

    pendingJobDrainScheduled = true
    queueMicrotask(() => {
      pendingJobDrainScheduled = false
      if (destroyed) return

      try {
        flushPendingJobs(runtime, context)
      } catch (error) {
        pendingJobDrainPasses = 0
        reportRuntimeError(error)
        return
      }

      pendingJobDrainPasses -= 1
      if (runtime.hasPendingJob() || pendingJobDrainPasses > 0) {
        schedulePendingJobDrain(0)
        return
      }

      pendingJobDrainPasses = 0
    })
  }

  const pendingFetches = new Set<SandboxFetchRecord>()
  const createErrorHandle = (error: unknown) => {
    if (error instanceof Error) {
      return context.newError({
        name: error.name || 'Error',
        message: error.message || String(error),
      })
    }

    return context.newError(String(error))
  }

  const createFetchResponseHandle = (response: SandboxFetchResponseData) => {
    const responseSource = `(() => {
      const __bodyText = ${JSON.stringify(textDecoder.decode(response.bodyBytes))}
      const __headers = ${JSON.stringify(response.headers)}
      const __bodyBytes = Uint8Array.from(${JSON.stringify(
        Array.from(response.bodyBytes)
      )})

      return {
        ok: ${response.ok ? 'true' : 'false'},
        status: ${JSON.stringify(response.status)},
        statusText: ${JSON.stringify(response.statusText)},
        url: ${JSON.stringify(response.url)},
        redirected: ${response.redirected ? 'true' : 'false'},
        headers: {
          ...__headers,
          get(name) {
            return __headers[String(name).toLowerCase()]
          },
          has(name) {
            return Object.prototype.hasOwnProperty.call(
              __headers,
              String(name).toLowerCase()
            )
          },
          entries() {
            return Object.entries(__headers)
          },
          keys() {
            return Object.keys(__headers)
          },
          values() {
            return Object.values(__headers)
          },
        },
        text() {
          return __bodyText
        },
        json() {
          return JSON.parse(__bodyText)
        },
        arrayBuffer() {
          return __bodyBytes.slice().buffer
        },
      }
    })()`

    return context.unwrapResult(
      context.evalCode(
        responseSource,
        '/__arrow_sandbox/fetch-response.js'
      )
    )
  }

  const clearPendingFetch = (record: SandboxFetchRecord) => {
    if (!record.active) return

    record.active = false
    pendingFetches.delete(record)
    if (record.timeoutHandle) {
      clearTimeout(record.timeoutHandle)
      record.timeoutHandle = null
    }
  }

  const rejectPendingFetch = (record: SandboxFetchRecord, error: unknown) => {
    if (!record.active) return
    clearPendingFetch(record)

    if (destroyed) {
      record.deferred.dispose()
      return
    }

    const errorHandle = createErrorHandle(error)
    try {
      record.deferred.reject(errorHandle)
    } finally {
      errorHandle.dispose()
    }
    schedulePendingJobDrain()
  }

  const resolvePendingFetch = (
    record: SandboxFetchRecord,
    response: SandboxFetchResponseData
  ) => {
    if (!record.active) return
    clearPendingFetch(record)

    if (destroyed) {
      record.deferred.dispose()
      return
    }

    try {
      const responseHandle = createFetchResponseHandle(response)
      try {
        record.deferred.resolve(responseHandle)
      } finally {
        responseHandle.dispose()
      }
    } catch (error) {
      const errorHandle = createErrorHandle(error)
      try {
        record.deferred.reject(errorHandle)
      } finally {
        errorHandle.dispose()
      }
    }

    schedulePendingJobDrain()
  }

  const disposeTimerRecord = (timer: SandboxTimerRecord) => {
    timer.callback.dispose()
    for (const arg of timer.args) {
      arg.dispose()
    }
  }

  const clearTimer = (timerId: number) => {
    const timer = timers.get(timerId)
    if (!timer) return

    timers.delete(timerId)
    if (timer.repeat) {
      clearInterval(timer.handle as ReturnType<typeof globalThis.setInterval>)
    } else {
      clearTimeout(timer.handle as ReturnType<typeof globalThis.setTimeout>)
    }
    disposeTimerRecord(timer)
  }

  const dispatchToVm = async (message: HostToVmMessage) => {
    if (destroyed) return

    await evalModule(
      runtime,
      context,
      `await globalThis.__arrowSandboxDispatch(${JSON.stringify(message)})`,
      `/__arrow_sandbox/dispatch-${Date.now()}.js`
    )
    schedulePendingJobDrain()
  }

  const fireTimer = async (timerId: number) => {
    const timer = timers.get(timerId)
    if (!timer || destroyed) return

    if (!timer.repeat) {
      timers.delete(timerId)
      clearTimeout(timer.handle as ReturnType<typeof globalThis.setTimeout>)
    }

    const callback = timer.callback.dup()
    const args = timer.args.map((arg) => arg.dup())

    try {
      const result = context.callFunction(callback, context.undefined, args)
      const returnedHandle = context.unwrapResult(result)
      returnedHandle.dispose()
      flushPendingJobs(runtime, context)
      schedulePendingJobDrain()
    } catch (error) {
      reportRuntimeError(error)
    } finally {
      callback.dispose()
      for (const arg of args) {
        arg.dispose()
      }

      if (!timer.repeat) {
        disposeTimerRecord(timer)
      }
    }
  }

  const scheduleTimer = (
    callbackHandle: any,
    delayHandle: any,
    argHandles: any[],
    repeat: boolean
  ) => {
    if (context.typeof(callbackHandle) !== 'function') {
      throw new Error('Sandbox timers require a callable callback.')
    }

    nextTimerId += 1
    const timerId = nextTimerId
    const delayValue = context.getNumber(delayHandle)
    const delay =
      Number.isFinite(delayValue) && delayValue > 0 ? delayValue : 0

    const timerRecord: SandboxTimerRecord = {
      callback: callbackHandle.dup(),
      args: argHandles.map((arg) => arg.dup()),
      handle: repeat
        ? globalThis.setInterval(() => {
            void fireTimer(timerId)
          }, delay)
        : globalThis.setTimeout(() => {
            void fireTimer(timerId)
          }, delay),
      repeat,
    }

    timers.set(timerId, timerRecord)
    return context.newNumber(timerId)
  }

  const hostSend = context.newFunction('__arrowHostSend', (messageHandle: any) => {
    const message = context.getString(messageHandle)
    options.onMessage(JSON.parse(message))
  })
  context.setProp(context.global, '__arrowHostSend', hostSend)
  hostSend.dispose()

  const setTimeoutHandle = context.newFunction(
    'setTimeout',
    (callbackHandle: any, delayHandle: any, ...argHandles: any[]) =>
      scheduleTimer(callbackHandle, delayHandle, argHandles, false)
  )
  context.setProp(context.global, 'setTimeout', setTimeoutHandle)
  setTimeoutHandle.dispose()

  const clearTimeoutHandle = context.newFunction(
    'clearTimeout',
    (timerIdHandle: any) => {
      clearTimer(context.getNumber(timerIdHandle))
    }
  )
  context.setProp(context.global, 'clearTimeout', clearTimeoutHandle)
  clearTimeoutHandle.dispose()

  const setIntervalHandle = context.newFunction(
    'setInterval',
    (callbackHandle: any, delayHandle: any, ...argHandles: any[]) =>
      scheduleTimer(callbackHandle, delayHandle, argHandles, true)
  )
  context.setProp(context.global, 'setInterval', setIntervalHandle)
  setIntervalHandle.dispose()

  const clearIntervalHandle = context.newFunction(
    'clearInterval',
    (timerIdHandle: any) => {
      clearTimer(context.getNumber(timerIdHandle))
    }
  )
  context.setProp(context.global, 'clearInterval', clearIntervalHandle)
  clearIntervalHandle.dispose()

  const fetchHandle = context.newFunction(
    'fetch',
    (inputHandle: any, initHandle: any) => {
      if (typeof globalThis.fetch !== 'function') {
        throw new SandboxRuntimeError(
          'Sandbox fetch() is not available in this host environment.'
        )
      }

      if (context.typeof(inputHandle) !== 'string') {
        throw new SandboxRuntimeError(
          'Sandbox fetch() currently only supports string URLs.'
        )
      }

      const request = normalizeFetchRequest(
        context.getString(inputHandle),
        !initHandle || context.typeof(initHandle) === 'undefined'
          ? undefined
          : context.dump(initHandle)
      )

      const deferred = context.newPromise()
      const record: SandboxFetchRecord = {
        controller: new AbortController(),
        deferred,
        timeoutHandle: null,
        active: true,
        timedOut: false,
      }
      pendingFetches.add(record)

      record.timeoutHandle = globalThis.setTimeout(() => {
        if (!record.active) return
        record.timedOut = true
        record.controller.abort()
      }, SANDBOX_FETCH_TIMEOUT_MS)

      void globalThis
        .fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body,
          mode: 'cors',
          credentials: 'omit',
          redirect: request.redirect,
          referrerPolicy: 'no-referrer',
          signal: record.controller.signal,
        })
        .then(async (response) => {
          if (!record.active || destroyed) return

          const contentLength = response.headers.get('content-length')
          if (
            contentLength &&
            Number.isFinite(Number(contentLength)) &&
            Number(contentLength) > SANDBOX_FETCH_MAX_RESPONSE_BYTES
          ) {
            throw new SandboxRuntimeError(
              `Sandbox fetch() response exceeded ${SANDBOX_FETCH_MAX_RESPONSE_BYTES} bytes.`
            )
          }

          const bodyBuffer = new Uint8Array(await response.arrayBuffer())
          if (bodyBuffer.byteLength > SANDBOX_FETCH_MAX_RESPONSE_BYTES) {
            throw new SandboxRuntimeError(
              `Sandbox fetch() response exceeded ${SANDBOX_FETCH_MAX_RESPONSE_BYTES} bytes.`
            )
          }

          const headers: Record<string, string> = {}
          response.headers.forEach((value, name) => {
            headers[name.toLowerCase()] = value
          })

          resolvePendingFetch(record, {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            url: response.url || request.url,
            redirected: response.redirected,
            headers,
            bodyBytes: bodyBuffer,
          })
        })
        .catch((error) => {
          if (!record.active || destroyed) return

          if (record.timedOut) {
            rejectPendingFetch(
              record,
              new SandboxRuntimeError(
                `Sandbox fetch() timed out after ${SANDBOX_FETCH_TIMEOUT_MS}ms.`
              )
            )
            return
          }

          rejectPendingFetch(record, error)
        })

      return deferred.handle
    }
  )
  context.setProp(context.global, 'fetch', fetchHandle)
  fetchHandle.dispose()

  runtime.setModuleLoader(
    (moduleName: string) => {
      const source = modules[moduleName]
      if (!source) {
        throw new SandboxRuntimeError(`Unknown sandbox module "${moduleName}".`)
      }
      return source
    },
    (baseModuleName: string, requestedName: string) =>
      resolveModuleSpecifier(baseModuleName, requestedName, modules)
  )

  await evalModule(
    runtime,
    context,
    `import ${JSON.stringify(VM_BOOTSTRAP_MODULE_ID)}`,
    '/__arrow_sandbox/bootstrap-loader.js'
  )

  const initPayload: VmInitPayload = {
    entryPath: options.compiled.entryPath,
    descriptors: options.compiled.descriptors,
    debug: options.debug,
  }

  await evalModule(
    runtime,
    context,
    `await globalThis.__arrowSandboxInit(${JSON.stringify(initPayload)})`,
    '/__arrow_sandbox/init.js'
  )
  schedulePendingJobDrain()

  return {
    async dispatch(message: HostToVmMessage) {
      await dispatchToVm(message)
    },
    destroy() {
      try {
        destroyed = true
        for (const timerId of Array.from(timers.keys())) {
          clearTimer(timerId)
        }
        for (const record of Array.from(pendingFetches)) {
          clearPendingFetch(record)
          record.controller.abort()
          record.deferred.dispose()
        }
        try {
          const result = context.evalCode(
            'globalThis.__arrowHostSend = undefined; globalThis.console = undefined; globalThis.setTimeout = undefined; globalThis.clearTimeout = undefined; globalThis.setInterval = undefined; globalThis.clearInterval = undefined; globalThis.fetch = undefined; globalThis.output = undefined;'
          )
          context.unwrapResult(result).dispose()
        } catch {}
        context.dispose()
      } finally {
        runtime.dispose()
      }
    },
  }
}
