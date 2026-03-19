import { afterEach, describe, expect, it, vi } from 'vitest'
import { html, reactive } from '@arrow-js/core'
import { compileSandboxGraph } from './compiler'
import {
  sandbox as renderSandbox,
  type SandboxEvents,
  type SandboxProps,
} from './index'

const realSetTimeout = globalThis.setTimeout.bind(globalThis)

function waitForSandbox() {
  return new Promise((resolve) => realSetTimeout(resolve, 25))
}

async function flushSandboxJobs() {
  await Promise.resolve()
  await Promise.resolve()
}

async function waitForSandboxHost(host: Element | null) {
  if (!(host instanceof HTMLElement)) {
    throw new Error('Sandbox host element was not rendered.')
  }

  customElements.upgrade?.(host)
  ;(host as unknown as { connectedCallback?: () => void }).connectedCallback?.()

  if (host.dataset.ready === 'true') {
    return
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = realSetTimeout(() => {
      cleanup()
      reject(
        new Error(
          `Sandbox host did not become ready. ctor=${host.constructor.name} host=${host.outerHTML} shadow=${host.shadowRoot?.innerHTML ?? 'none'}`
        )
      )
    }, 1000)
    const onReady = () => {
      cleanup()
      resolve()
    }
    const onError = (event: Event) => {
      cleanup()
      if (event instanceof CustomEvent) {
        reject(event.detail)
        return
      }
      reject(new Error('Sandbox host failed to boot.'))
    }
    const cleanup = () => {
      clearTimeout(timeout)
      host.removeEventListener('sandbox-ready', onReady)
      host.removeEventListener('sandbox-error', onError)
    }

    host.addEventListener('sandbox-ready', onReady, { once: true })
    host.addEventListener('sandbox-error', onError, { once: true })
  })
}

function getSandboxHost(root: ParentNode) {
  if (!('querySelector' in root)) {
    throw new Error('Sandbox root does not support querySelector.')
  }

  const host = root.querySelector('arrow-sandbox')
  if (!(host instanceof HTMLElement)) {
    throw new Error('Sandbox host element was not rendered.')
  }

  return host
}

function getSandboxRenderRoot(host: HTMLElement) {
  if (host.shadowRoot) {
    const root = host.shadowRoot.querySelector('div')
    if (!(root instanceof HTMLDivElement)) {
      throw new Error('Sandbox shadow render root was not created.')
    }
    return root
  }

  const root = Array.from(host.children).find(
    (child) => child instanceof HTMLDivElement
  )
  if (!(root instanceof HTMLDivElement)) {
    throw new Error('Sandbox light DOM render root was not created.')
  }
  return root
}

function destroySandboxMount(mountPoint: Element) {
  for (const host of Array.from(mountPoint.querySelectorAll('arrow-sandbox'))) {
    if (!(host instanceof HTMLElement)) continue
    customElements.upgrade?.(host)
    ;(host as unknown as { disconnectedCallback?: () => void })
      .disconnectedCallback?.()
  }

  mountPoint.replaceChildren()
}

interface LegacySandboxOptions extends Omit<SandboxProps, 'source'> {
  entry?: string
  files?: Record<string, string>
}

interface LegacySandboxInstance {
  destroy(): void
  update(code: string, options?: Partial<LegacySandboxOptions>): Promise<void>
}

function stripLeadingSlash(value: string) {
  return value.replace(/^\/+/, '')
}

function buildLegacySandboxProps(
  code: string,
  options: LegacySandboxOptions = {}
): SandboxProps {
  const source: Record<string, string> = {}

  for (const [name, value] of Object.entries(options.files ?? {})) {
    source[stripLeadingSlash(name)] = value
  }

  if (!options.files) {
    source['main.ts'] = code
  } else {
    const entry = stripLeadingSlash(options.entry ?? 'main.ts')
    const entrySource = code.trim() ? code : source[entry]
    if (entrySource) {
      source[entry] = entrySource
    }

    if (entry !== 'main.ts' && entry !== 'main.js') {
      const mainEntry = entry.endsWith('.js') ? 'main.js' : 'main.ts'
      source[mainEntry] = `import Entry from './${entry}'

export default Entry`
    }
  }

  return {
    debug: options.debug,
    onError: options.onError,
    shadowDOM: options.shadowDOM ?? false,
    source,
  }
}

async function sandbox(
  code: string,
  mountPoint: Element,
  options: LegacySandboxOptions = {},
  events?: SandboxEvents
): Promise<LegacySandboxInstance> {
  let currentCode = code
  let currentOptions = options
  let currentEvents = events

  const mount = async (
    nextCode = currentCode,
    nextOptions = currentOptions,
    nextEvents = currentEvents
  ) => {
    currentCode = nextCode
    currentOptions = nextOptions
    currentEvents = nextEvents
    const props = buildLegacySandboxProps(currentCode, currentOptions)
    compileSandboxGraph(props)

    let mountError: unknown
    let mounting = true
    const providedOnError = props.onError

    destroySandboxMount(mountPoint)
    renderSandbox(
      {
        ...props,
        onError(error) {
          if (mounting) {
            mountError = error
          }
          providedOnError?.(error)
        },
      },
      currentEvents
    )(mountPoint)
    await flushSandboxJobs()
    await waitForSandboxHost(mountPoint.querySelector('arrow-sandbox'))
    mounting = false

    if (mountError) {
      throw mountError
    }
  }

  await mount()

  return {
    destroy() {
      destroySandboxMount(mountPoint)
    },
    async update(code, options = {}) {
      const nextOptions: LegacySandboxOptions = {
        ...currentOptions,
        ...options,
        entry: options.entry ?? currentOptions.entry,
        files: options.files ?? currentOptions.files,
        onError: options.onError ?? currentOptions.onError,
        debug: options.debug ?? currentOptions.debug,
        shadowDOM: options.shadowDOM ?? currentOptions.shadowDOM,
      }

      await mount(code, nextOptions, currentEvents)
    },
  }
}

function createMockFetchResponse(
  body: string,
  options: {
    headers?: Record<string, string>
    ok?: boolean
    redirected?: boolean
    status?: number
    statusText?: string
    url?: string
  } = {}
) {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    statusText: options.statusText ?? 'OK',
    url: options.url ?? 'https://api.example.test/data',
    redirected: options.redirected ?? false,
    headers: new Headers(options.headers),
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
  } as Response
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).__sandboxTouched
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('@arrow-js/sandbox', () => {
  it('mounts a simple button with implicit Arrow imports', async () => {
    const root = document.createElement('div')

    const instance = await sandbox(
      `
        const state = reactive({ count: 0 })
        export default html\`<button @click="\${() => state.count++}">Clicked \${() => state.count}</button>\`
      `,
      root
    )

    const button = root.querySelector('button')
    expect(button?.textContent).toBe('Clicked 0')
    expect(button?.onclick).toBe(null)
    expect(button?.getAttribute('onclick')).toBe(null)

    instance.destroy()
  })

  it('mounts as an Arrow template inside a host template', async () => {
    const root = document.createElement('div')

    html`<section>${renderSandbox({
      source: {
        'main.ts': `
          const state = reactive({ count: 0 })
          export default html\`<button @click="\${() => state.count++}">Count \${() => state.count}</button>\`
        `,
      },
    })}</section>`(root)
    const host = getSandboxHost(root)
    await waitForSandboxHost(host)
    const button = host.shadowRoot?.querySelector('button') as HTMLButtonElement
    expect(button.textContent).toBe('Count 0')

    button.click()
    await waitForSandbox()

    expect(button.textContent).toBe('Count 1')
  })

  it('accepts reactive sandbox props', async () => {
    const root = document.createElement('div')
    const config = reactive({
      shadowDOM: false,
      source: {
        'main.ts': `export default html\`<button>Alpha</button>\``,
      },
    })

    html`<section>${renderSandbox(config)}</section>`(root)
    const host = getSandboxHost(root)
    await waitForSandboxHost(host)

    expect(getSandboxRenderRoot(host).textContent).toContain('Alpha')
  })

  it('injects main.css into the shadow root by default', async () => {
    const root = document.createElement('div')

    renderSandbox({
      source: {
        'main.ts': `
          export default html\`<button class="probe">ready</button>\`
        `,
        'main.css': `
          :host {
            display: block;
          }

          .probe {
            color: red;
          }
        `,
      },
    })(root)

    const host = getSandboxHost(root)
    await waitForSandboxHost(host)

    expect(host.shadowRoot).not.toBeNull()
    expect(host.shadowRoot?.querySelector('style')?.textContent).toContain(
      '.probe'
    )
    expect(host.shadowRoot?.querySelector('button')?.textContent).toBe('ready')
  })

  it('injects main.css into the light DOM when shadowDOM is false', async () => {
    const root = document.createElement('div')

    renderSandbox({
      shadowDOM: false,
      source: {
        'main.ts': `
          export default html\`<button class="probe">ready</button>\`
        `,
        'main.css': '.probe { color: blue; }',
      },
    })(root)

    const host = getSandboxHost(root)
    await waitForSandboxHost(host)

    expect(host.shadowRoot).toBeNull()
    expect(host.querySelector('style')?.textContent).toContain('.probe')
    expect(getSandboxRenderRoot(host).querySelector('button')?.textContent).toBe(
      'ready'
    )
  })

  it('requires exactly one main entry file', async () => {
    const root = document.createElement('div')

    renderSandbox({
      source: {
        'App.ts': `export default html\`<div>missing entry</div>\``,
      },
    })(root)

    await expect(waitForSandboxHost(getSandboxHost(root))).rejects.toThrow(
      /exactly one entry file: "main\.ts" or "main\.js"/i
    )
  })

  it('rejects sandbox sources that provide both main.ts and main.js', async () => {
    const root = document.createElement('div')

    renderSandbox({
      source: {
        'main.ts': `export default html\`<div>ts</div>\``,
        'main.js': `export default html\`<div>js</div>\``,
      },
    })(root)

    await expect(waitForSandboxHost(getSandboxHost(root))).rejects.toThrow(
      /exactly one entry file: "main\.ts" or "main\.js"/i
    )
  })

  it('updates reactive text through the VM event path', async () => {
    const root = document.createElement('div')

    const instance = await sandbox(
      `
        const state = reactive({ count: 0 })
        export default html\`<button @click="\${() => state.count++}">Clicked \${() => state.count}</button>\`
      `,
      root
    )

    const button = root.querySelector('button') as HTMLButtonElement
    button.click()
    await waitForSandbox()

    expect(button.textContent).toBe('Clicked 1')
    instance.destroy()
  })

  it('keeps user event handlers inside the VM instead of the host window', async () => {
    const root = document.createElement('div')

    const instance = await sandbox(
      `
        const state = reactive({ count: 0 })

        export default html\`
          <button @click="\${() => {
            globalThis.__sandboxTouched = (globalThis.__sandboxTouched ?? 0) + 1
            state.count++
          }}">
            Count \${() => state.count}
          </button>
        \`
      `,
      root
    )

    const button = root.querySelector('button') as HTMLButtonElement
    expect((globalThis as Record<string, unknown>).__sandboxTouched).toBeUndefined()
    expect(button.onclick).toBe(null)

    button.click()
    await waitForSandbox()

    expect(button.textContent?.trim()).toBe('Count 1')
    expect((globalThis as Record<string, unknown>).__sandboxTouched).toBeUndefined()
    instance.destroy()
  })

  it('supports multi-file modules with explicit imports', async () => {
    const root = document.createElement('div')

    const instance = await sandbox('', root, {
      entry: '/App.ts',
      files: {
        '/state.ts': `
          import { reactive } from '@arrow-js/core'
          export const state = reactive({ count: 0 })
        `,
        '/App.ts': `
          import { html } from '@arrow-js/core'
          import { state } from './state.ts'

          export default html\`
            <div>
              <button @click="\${() => state.count++}">+</button>
              <span>\${() => state.count}</span>
            </div>
          \`
        `,
      },
    })

    const button = root.querySelector('button') as HTMLButtonElement
    button.click()
    await waitForSandbox()

    expect(root.querySelector('span')?.textContent).toBe('1')
    instance.destroy()
  })

  it('supports sandbox component emits with parent-provided listeners', async () => {
    const root = document.createElement('div')

    const instance = await sandbox(
      `
        const state = reactive({ color: 'none' })

        const ColorButton = component(
          (_props, emit) => html\`
            <button @click="\${() => emit('color', 'red')}">Emit</button>
          \`
        )

        export default html\`
          <div>
            \${ColorButton(undefined, {
              color: (value) => {
                state.color = value
              },
            })}
            <span>\${() => state.color}</span>
          </div>
        \`
      `,
      root
    )

    const button = root.querySelector('button') as HTMLButtonElement
    button.click()
    await waitForSandbox()

    expect(root.querySelector('span')?.textContent).toBe('red')
    instance.destroy()
  })

  it('supports attribute interpolation updates', async () => {
    const root = document.createElement('div')

    const instance = await sandbox(
      `
        const state = reactive({ disabled: false })

        export default html\`
          <button
            disabled="\${() => state.disabled}"
            @click="\${() => (state.disabled = true)}"
          >
            \${() => (state.disabled ? 'Done' : 'Click me')}
          </button>
        \`
      `,
      root
    )

    const button = root.querySelector('button') as HTMLButtonElement
    expect(button.hasAttribute('disabled')).toBe(false)
    button.click()
    await waitForSandbox()

    expect(button.hasAttribute('disabled')).toBe(true)
    expect(button.textContent?.trim()).toBe('Done')
    instance.destroy()
  })

  it('exposes event.target and event.currentTarget snapshots for form handlers', async () => {
    const root = document.createElement('div')

    const instance = await sandbox(
      `
        const state = reactive({
          current: '',
          fieldId: '',
          tagName: '',
          value: '',
        })

        export default html\`
          <div>
            <input
              id="city-input"
              data-kind="city"
              @input="\${(event) => {
                state.value = event.target?.value ?? ''
                state.current = event.currentTarget?.value ?? ''
                state.fieldId = event.currentTarget?.id ?? ''
                state.tagName = event.target?.tagName ?? ''
              }}"
            />
            <output>\${() =>
              [
                state.value,
                state.current,
                state.fieldId,
                state.tagName,
              ].join('|')}</output>
          </div>
        \`
      `,
      root
    )

    const input = root.querySelector('input') as HTMLInputElement
    input.value = 'Boston'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await waitForSandbox()

    expect(root.querySelector('output')?.textContent).toBe(
      'Boston|Boston|city-input|input'
    )
    instance.destroy()
  })

  it('exposes checked on sanitized change events without leaking DOM nodes', async () => {
    const root = document.createElement('div')

    const instance = await sandbox(
      `
        const state = reactive({
          checked: 'no',
          fieldId: '',
          tagName: '',
        })

        export default html\`
          <label>
            <input
              id="terms"
              type="checkbox"
              @change="\${(event) => {
                state.checked = event.target?.checked ? 'yes' : 'no'
                state.fieldId = event.currentTarget?.id ?? ''
                state.tagName = event.target?.tagName ?? ''
              }}"
            />
            <output>\${() =>
              [state.checked, state.fieldId, state.tagName].join('|')}</output>
          </label>
        \`
      `,
      root
    )

    const input = root.querySelector('input') as HTMLInputElement
    input.checked = true
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await waitForSandbox()

    expect(root.querySelector('output')?.textContent).toBe('yes|terms|input')
    instance.destroy()
  })

  it('supports sandboxed setTimeout callbacks', async () => {
    vi.useFakeTimers()

    const root = document.createElement('div')

    const instance = await sandbox(
      `
        const state = reactive({ count: 0 })

        setTimeout(() => {
          state.count = 1
        }, 10)

        export default html\`<span>\${() => state.count}</span>\`
      `,
      root
    )

    expect(root.textContent).toBe('0')
    await vi.advanceTimersByTimeAsync(10)

    expect(root.textContent).toBe('1')
    instance.destroy()
  })

  it('forwards sandbox output payloads through the optional output event', async () => {
    const root = document.createElement('div')
    const output = vi.fn()

    renderSandbox(
      {
        source: {
          'main.ts': `
            output({ color: 'red' })
            export default html\`<div>ok</div>\`
          `,
        },
      },
      { output }
    )(root)
    await waitForSandboxHost(getSandboxHost(root))

    expect(output).toHaveBeenCalledTimes(1)
    expect(output).toHaveBeenCalledWith({ color: 'red' })
  })

  it('supports sandboxed fetch JSON responses with safe host defaults', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        createMockFetchResponse(JSON.stringify({
          current: {
            label: 'Test City',
            temperature: 72,
          },
        }), {
          headers: {
            'content-type': 'application/json',
          },
          url: 'https://api.example.test/weather',
        })
      )

    const root = document.createElement('div')

    const instance = await sandbox(
      `
        const response = await fetch('https://api.example.test/weather', {
          headers: {
            Accept: 'application/json',
          },
        })
        const data = await response.json()

        export default html\`<div id="weather">\${data.current.label}: \${data.current.temperature}</div>\`
      `,
      root
    )

    expect(root.querySelector('#weather')?.textContent).toBe('Test City: 72')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.example.test/weather',
      expect.objectContaining({
        credentials: 'omit',
        headers: {
          accept: 'application/json',
        },
        method: 'GET',
        mode: 'cors',
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
      })
    )

    instance.destroy()
  })

  it('supports sandboxed fetch text responses and response header helpers', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createMockFetchResponse('storm watch', {
        headers: {
          'content-type': 'text/plain',
        },
        url: 'https://api.example.test/text',
      })
    )

    const root = document.createElement('div')

    const instance = await sandbox(
      `
        const response = await fetch('https://api.example.test/text')
        const contentType = response.headers.get('content-type')
        const body = await response.text()

        export default html\`<p id="payload">\${contentType}|\${body}</p>\`
      `,
      root
    )

    expect(root.querySelector('#payload')?.textContent).toBe('text/plain|storm watch')
    instance.destroy()
  })

  it('rejects sandbox fetch requests that use relative URLs', async () => {
    const root = document.createElement('div')

    await expect(
      sandbox(
        `
          await fetch('/weather')
          export default html\`<div>unreachable</div>\`
        `,
        root
      )
    ).rejects.toThrow('requires an absolute URL')
  })

  it('rejects sandbox fetch requests that try to include host credentials', async () => {
    const root = document.createElement('div')

    await expect(
      sandbox(
        `
          await fetch('https://api.example.test/private', {
            credentials: 'include',
          })
          export default html\`<div>unreachable</div>\`
        `,
        root
      )
    ).rejects.toThrow('credentials: "omit"')
  })

  it('aborts pending sandbox fetch requests on destroy', async () => {
    let capturedSignal: AbortSignal | undefined

    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          capturedSignal = init?.signal as AbortSignal | undefined
          capturedSignal?.addEventListener(
            'abort',
            () => {
              reject(new DOMException('Aborted', 'AbortError'))
            },
            { once: true }
          )
        }) as Promise<Response>
    )

    const root = document.createElement('div')

    const instance = await sandbox(
      `
        void fetch('https://api.example.test/slow')
        export default html\`<div id="pending">pending</div>\`
      `,
      root,
      {
        onError() {},
      }
    )

    expect(root.querySelector('#pending')?.textContent).toBe('pending')
    instance.destroy()
    await flushSandboxJobs()

    expect(capturedSignal?.aborted).toBe(true)
  })

  it('supports sync sandbox components with reactive props and local state', async () => {
    const root = document.createElement('div')

    const instance = await sandbox(
      `
        const state = reactive({ count: 1 })

        const Counter = component((props) => {
          const local = reactive({ clicks: 0 })

          return html\`
            <button
              class="child"
              @click="\${() => local.clicks++}"
            >
              \${() => props.count}|\${() => local.clicks}
            </button>
          \`
        })

        export default html\`
          <div>
            <button class="parent" @click="\${() => state.count++}">inc</button>
            \${Counter(state)}
          </div>
        \`
      `,
      root
    )

    const parent = root.querySelector('.parent') as HTMLButtonElement
    const child = root.querySelector('.child') as HTMLButtonElement

    expect(child.textContent?.trim()).toBe('1|0')

    child.click()
    await waitForSandbox()
    expect(child.textContent?.trim()).toBe('1|1')

    parent.click()
    await waitForSandbox()
    expect(child.textContent?.trim()).toBe('2|1')

    instance.destroy()
  })

  it('supports async sandbox components with fallback and eventual resolution', async () => {
    vi.useFakeTimers()

    const root = document.createElement('div')

    const instance = await sandbox(
      `
        const AsyncLabel = component(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10))
          return 'ready'
        }, {
          fallback: html\`<span class="loading">loading</span>\`
        })

        export default html\`<div>\${AsyncLabel()}</div>\`
      `,
      root
    )

    expect(root.querySelector('.loading')?.textContent).toBe('loading')

    await vi.advanceTimersByTimeAsync(10)
    await flushSandboxJobs()

    expect(root.textContent?.trim()).toBe('ready')
    instance.destroy()
  })

  it('keeps async component computations live when they depend on reactive props', async () => {
    const root = document.createElement('div')

    const instance = await sandbox(
      `
        const state = reactive({
          count: 2,
          multiplier: 3,
        })

        const AsyncCounter = component(async (props) => {
          const resolvedMultiplier = await Promise.resolve(props.multiplier)
          return html\`<strong id="async-derived">\${() => props.count * resolvedMultiplier}</strong>\`
        })

        export default html\`
          <div>
            <button id="inc" @click="\${() => state.count++}">inc</button>
            \${AsyncCounter(state)}
          </div>
        \`
      `,
      root
    )

    await flushSandboxJobs()
    expect(root.querySelector('#async-derived')?.textContent).toBe('6')

    const button = root.querySelector('#inc') as HTMLButtonElement
    button.click()
    await waitForSandbox()

    expect(root.querySelector('#async-derived')?.textContent).toBe('9')
    instance.destroy()
  })

  it('supports sandbox components without props', async () => {
    const root = document.createElement('div')

    const instance = await sandbox(
      `
        const Static = component(() => html\`<section>hello</section>\`)
        export default html\`<main>\${Static()}</main>\`
      `,
      root
    )

    expect(root.querySelector('main > section')?.textContent).toBe('hello')
    instance.destroy()
  })

  it('supports sandboxed setInterval and clearInterval callbacks', async () => {
    vi.useFakeTimers()

    const root = document.createElement('div')

    const instance = await sandbox(
      `
        const state = reactive({ count: 0 })
        const timer = setInterval(() => {
          state.count++
          if (state.count >= 2) {
            clearInterval(timer)
          }
        }, 5)

        export default html\`<span>\${() => state.count}</span>\`
      `,
      root
    )

    expect(root.textContent).toBe('0')
    await vi.advanceTimersByTimeAsync(10)
    expect(root.textContent).toBe('2')

    await vi.advanceTimersByTimeAsync(20)
    expect(root.textContent).toBe('2')
    instance.destroy()
  })

  it('supports setTimeout during top-level await module initialization', async () => {
    vi.useFakeTimers()

    const root = document.createElement('div')

    const pendingInstance = sandbox(
      `
        await new Promise((resolve) => setTimeout(resolve, 10))
        export default html\`<span>ready</span>\`
      `,
      root
    )

    await vi.advanceTimersByTimeAsync(10)
    const instance = await pendingInstance

    expect(root.textContent).toBe('ready')
    instance.destroy()
  })

  it('allows multi-root html blocks without injecting a wrapper element', async () => {
    const root = document.createElement('div')

    const instance = await sandbox(
      `
        const state = reactive({ count: 0 })

        export default html\`
          <button @click="\${() => state.count++}">+</button>
          <span>\${() => state.count}</span>
        \`
      `,
      root
    )

    const renderRoot = getSandboxRenderRoot(getSandboxHost(root))
    expect(renderRoot.children.length).toBe(2)
    expect(renderRoot.firstElementChild?.tagName).toBe('BUTTON')
    expect(renderRoot.lastElementChild?.tagName).toBe('SPAN')
    expect(renderRoot.querySelector('span')?.textContent).toBe('0')

    const button = renderRoot.querySelector('button') as HTMLButtonElement
    button.click()
    await waitForSandbox()

    expect(renderRoot.querySelector('span')?.textContent).toBe('1')
    instance.destroy()
  })

  it('updates with a fresh module graph and does not leak prior handlers or state', async () => {
    const root = document.createElement('div')

    const instance = await sandbox(
      `
        const state = reactive({ count: 0 })
        export default html\`<button @click="\${() => state.count++}">First \${() => state.count}</button>\`
      `,
      root
    )

    const firstButton = root.querySelector('button') as HTMLButtonElement
    firstButton.click()
    await waitForSandbox()
    expect(firstButton.textContent).toBe('First 1')

    await instance.update(`
      const state = reactive({ count: 10 })
      export default html\`<button @click="\${() => (state.count += 2)}">Second \${() => state.count}</button>\`
    `)

    const secondButton = root.querySelector('button') as HTMLButtonElement
    expect(secondButton.textContent).toBe('Second 10')

    firstButton.click()
    await waitForSandbox()
    expect(secondButton.textContent).toBe('Second 10')

    secondButton.click()
    await waitForSandbox()
    expect(secondButton.textContent).toBe('Second 12')

    instance.destroy()
  })

  it('destroys cleanly and clears the mount point', async () => {
    const root = document.createElement('div')

    const instance = await sandbox(
      `
        const state = reactive({ count: 0 })
        export default html\`<button @click="\${() => state.count++}">\${() => state.count}</button>\`
      `,
      root
    )

    expect(root.querySelector('button')).not.toBe(null)
    instance.destroy()
    expect(root.innerHTML).toBe('')
  })

  it('surfaces invalid code errors', async () => {
    const root = document.createElement('div')
    const onError = vi.fn()

    await expect(
      sandbox(
        `
          export default html\`<div>\${</div>\`
        `,
        root,
        { onError }
      )
    ).rejects.toThrow(/Unexpected|Unterminated|Expression expected|Type expected/i)

    expect(onError).not.toHaveBeenCalled()
  })

  it('includes location information in runtime errors passed to onError', async () => {
    const root = document.createElement('div')
    const onError = vi.fn()

    const instance = await sandbox(
      `
        export default html\`
          <button @click="\${() => {
            throw new Error('not a number')
          }}">
            break
          </button>
        \`
      `,
      root,
      { onError }
    )

    const button = root.querySelector('button') as HTMLButtonElement
    button.click()
    await waitForSandbox()

    expect(onError).toHaveBeenCalledTimes(1)
    const payload = onError.mock.calls[0]?.[0]
    const message = typeof payload === 'string' ? payload : payload?.message

    expect(message).toMatch(/not a number/i)
    expect(message).toMatch(/main\.ts:\d+:\d+/i)
    instance.destroy()
  })

  it('supports expanded sandbox console methods in debug mode', async () => {
    const root = document.createElement('div')
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const group = vi.spyOn(console, 'group').mockImplementation(() => {})
    const groupEnd = vi.spyOn(console, 'groupEnd').mockImplementation(() => {})
    const time = vi.spyOn(console, 'time').mockImplementation(() => {})
    const timeEnd = vi.spyOn(console, 'timeEnd').mockImplementation(() => {})
    const assert = vi.spyOn(console, 'assert').mockImplementation(() => {})
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    const instance = await sandbox(
      `
        console.info('info')
        console.debug('debug')
        console.group('group')
        console.groupEnd()
        console.time('timer')
        console.timeEnd('timer')
        console.assert(false, 'assertion failed')
        console.trace('trace marker')

        export default html\`<div>ok</div>\`
      `,
      root,
      { debug: true }
    )

    expect(info).toHaveBeenCalledWith('info')
    expect(debug).toHaveBeenCalledWith('debug')
    expect(group).toHaveBeenCalledWith('group')
    expect(groupEnd).toHaveBeenCalled()
    expect(time).toHaveBeenCalledWith('timer')
    expect(timeEnd).toHaveBeenCalledWith('timer')
    expect(assert).toHaveBeenCalledWith(false, 'assertion failed')
    expect(
      log.mock.calls.some(
        (call) =>
          call[0] === 'trace marker' &&
          call.some(
            (value) =>
              typeof value === 'string' && /main\.ts:\d+:\d+/i.test(value)
          )
      )
    ).toBe(true)

    instance.destroy()
  })
})
