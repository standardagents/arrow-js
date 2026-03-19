import {
  createTemplateInstance,
  dispatchMessage,
  initSandbox,
  log,
  output,
} from './runtime'

const globalObject = globalThis as any as typeof globalThis & {
  __arrowSandboxTemplate?: typeof createTemplateInstance
  __arrowSandboxInit?: typeof initSandbox
  __arrowSandboxDispatch?: typeof dispatchMessage
  output?: typeof output
}

const sandboxConsole = {
  log: (...args: unknown[]) => log('log', args),
  info: (...args: unknown[]) => log('info', args),
  debug: (...args: unknown[]) => log('debug', args),
  warn: (...args: unknown[]) => log('warn', args),
  error: (...args: unknown[]) => log('error', args),
  dir: (...args: unknown[]) => log('dir', args),
  dirxml: (...args: unknown[]) => log('dirxml', args),
  table: (...args: unknown[]) => log('table', args),
  group: (...args: unknown[]) => log('group', args),
  groupCollapsed: (...args: unknown[]) => log('groupCollapsed', args),
  groupEnd: () => log('groupEnd', []),
  clear: () => log('clear', []),
  count: (...args: unknown[]) => log('count', args),
  countReset: (...args: unknown[]) => log('countReset', args),
  time: (...args: unknown[]) => log('time', args),
  timeLog: (...args: unknown[]) => log('timeLog', args),
  timeEnd: (...args: unknown[]) => log('timeEnd', args),
  assert: (condition: unknown, ...args: unknown[]) => {
    if (condition) return
    log('assert', [condition, ...(args.length ? args : ['Assertion failed'])])
  },
  trace: (...args: unknown[]) => {
    const stack = new Error().stack
    log('trace', stack ? [...args, stack] : args)
  },
}

globalObject.__arrowSandboxTemplate = createTemplateInstance
globalObject.__arrowSandboxInit = initSandbox
globalObject.__arrowSandboxDispatch = dispatchMessage
globalObject.output = output
;(globalThis as any).console = sandboxConsole
