import { describe, expect, it, vi } from 'vitest'
import { component, html, nextTick, reactive } from '@arrow-js/core'
import type { Emit } from '@arrow-js/core'
import { boundary, render } from '@arrow-js/framework'
import { hydrate } from '@arrow-js/hydrate'
import { renderToString } from '@arrow-js/ssr'

function delay(ms = 0) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

describe('framework render', () => {
  it('waits for async child components to flush', async () => {
    const root = document.createElement('div')
    const child = component(async () => {
      await delay()
      return html`<span>ready</span>`
    })

    await render(root, html`<div>${child()}</div>`)

    expect(root.innerHTML).toContain('<span>ready</span>')
  })

  it('waits for nested async child components to flush', async () => {
    const root = document.createElement('div')
    const grandChild = component(async () => {
      await delay()
      return html`<em>nested ready</em>`
    })
    const child = component(async () => {
      await delay()
      return html`<div>${grandChild()}</div>`
    })

    await render(root, html`<section>${child()}</section>`)

    expect(root.innerHTML).toContain('nested ready')
  })

  it('passes emit handlers through async components', async () => {
    const root = document.createElement('div')
    const state = reactive({
      color: 'none',
    })
    const ColorButton = component(async (
      _props: undefined,
      emit: Emit<{ color: string }>
    ) => {
      await delay()
      return html`<button
        id="async-color"
        @click="${() => emit('color', 'green')}"
      >
        emit
      </button>`
    })

    await render(
      root,
      html`<div>
        ${ColorButton(undefined, {
          color: (value) => {
            state.color = value
          },
        })}
        <span id="async-color-value">${() => state.color}</span>
      </div>`
    )

    ;(root.querySelector('#async-color') as HTMLButtonElement).click()
    await nextTick()

    expect(root.querySelector('#async-color-value')?.textContent).toBe('green')
  })
})

describe('framework ssr', () => {
  it('serializes resolved async content', async () => {
    const child = component(async () => {
      await delay()
      return html`<span>server ready</span>`
    })

    const result = await renderToString(html`<div>${child()}</div>`)

    expect(result.html).toContain('server ready')
    expect(result.payload.html).toBe(result.html)
  })

  it('emits explicit boundary markers and payload manifests', async () => {
    const result = await renderToString(
      html`<main>${boundary(html`<p id="marker-probe">probe</p>`, { idPrefix: 'probe' })}</main>`
    )

    expect(result.html).toContain('data-arrow-boundary-start="probe:0"')
    expect(result.html).toContain('data-arrow-boundary-end="probe:0"')
    expect(result.payload.boundaries).toEqual(['probe:0'])
  })

  it('keeps nested async SSR isolated across concurrent renders', async () => {
    const GrandChild = component<{ label: string }, string>(
      async ({ label }: { label: string }) => {
        await delay()
        return label
      },
      {
        render: (value) => html`<strong>${value}</strong>`,
      }
    )
    const Child = component<{ label: string }, string>(
      async ({ label }: { label: string }) => {
        await delay()
        return label
      },
      {
        render: (value) => html`<section>${GrandChild({ label: `${value} ready` })}</section>`,
      }
    )

    const labels = Array.from({ length: 8 }, (_, index) => `request-${index}`)
    const results = await Promise.all(
      labels.map((label) => renderToString(html`<div>${Child({ label })}</div>`))
    )

    results.forEach((result, index) => {
      expect(result.html).toContain(`${labels[index]} ready`)
    })
  })
})

describe('framework hydrate', () => {
  it('adopts generated html(string[]) templates when markup matches', async () => {
    const root = document.createElement('div')
    const state = reactive({
      label: 'Ready',
      id: 'probe',
    })

    const createView = () =>
      html`${html(['<button id="', '">', '</button>'], state.id, state.label)}`

    const ssr = await renderToString(createView())
    root.innerHTML = ssr.html
    const existing = root.querySelector('#probe')

    const result = await hydrate(root, createView(), ssr.payload)

    expect(result.adopted).toBe(true)
    expect(root.querySelector('#probe')).toBe(existing)
    expect(root.querySelector('#probe')?.textContent).toContain('Ready')
  })

  it('adopts existing server-rendered nodes when markup matches', async () => {
    const root = document.createElement('div')
    const Counter = component(() => {
      const state = reactive({
        clicks: 0,
      })

      return html`<button
        id="probe"
        @click="${() => {
          state.clicks += 1
        }}"
      >
        Clicks: ${() => state.clicks}
      </button>`
    })

    const createView = () => html`${Counter()}`
    const ssr = await renderToString(createView())
    root.innerHTML = ssr.html
    const existing = root.querySelector('#probe')

    const result = await hydrate(root, createView(), ssr.payload)

    expect(result.adopted).toBe(true)
    expect(root.querySelector('#probe')).toBe(existing)

    ;(existing as HTMLButtonElement).click()
    await nextTick()

    expect(root.querySelector('#probe')?.textContent).toContain('Clicks: 1')
  })

  it('preserves component-local state when a hydrated parent rerenders', async () => {
    const root = document.createElement('div')

    const Counter = component(() => {
      const state = reactive({
        clicks: 0,
      })

      return html`<button
        id="component-probe"
        @click="${() => {
          state.clicks += 1
        }}"
      >
        Count: ${() => state.clicks}
      </button>`
    })

    const Shell = component(() => {
      const shell = reactive({
        mode: 'steady',
      })

      return html`<section data-mode="${() => shell.mode}">
        ${Counter()}
        <button
          id="component-shell"
          @click="${() => {
            shell.mode = shell.mode === 'steady' ? 'alt' : 'steady'
          }}"
        >
          Toggle shell
        </button>
      </section>`
    })

    const createView = () => html`${Shell()}`
    const ssr = await renderToString(createView())
    root.innerHTML = ssr.html
    const existing = root.querySelector('#component-probe')

    const result = await hydrate(root, createView(), ssr.payload)

    expect(result.adopted).toBe(true)
    ;(existing as HTMLButtonElement).click()
    await nextTick()
    ;(root.querySelector('#component-shell') as HTMLButtonElement).click()
    await nextTick()

    expect(root.querySelector('#component-probe')).toBe(existing)
    expect(root.querySelector('#component-probe')?.textContent).toContain('Count: 1')
  })

  it('hydrates resolved async child content without replacing matching nodes', async () => {
    const root = document.createElement('div')
    const state = reactive({
      clicks: 0,
    })
    const AsyncCounter = component(async () => {
      await delay()
      return html`<button
        id="async-probe"
        @click="${() => {
          state.clicks += 1
        }}"
      >
        Async clicks: ${() => state.clicks}
      </button>`
    })

    const createView = () => html`<section>${AsyncCounter()}</section>`
    const ssr = await renderToString(createView())
    root.innerHTML = ssr.html
    const existing = root.querySelector('#async-probe')

    const result = await hydrate(root, createView(), ssr.payload)

    expect(result.adopted).toBe(true)
    expect(root.querySelector('#async-probe')).toBe(existing)

    ;(existing as HTMLButtonElement).click()
    await nextTick()

    expect(root.querySelector('#async-probe')?.textContent).toContain(
      'Async clicks: 1'
    )
  })

  it('keeps async component template computations live when they depend on reactive props', async () => {
    const root = document.createElement('div')
    const state = reactive({
      count: 2,
      multiplier: 3,
    })
    const AsyncCounter = component(async (props: { count: number; multiplier: number }) => {
      const resolvedMultiplier = await Promise.resolve(props.multiplier)
      return html`<strong id="async-derived">${() => props.count * resolvedMultiplier}</strong>`
    })

    const createView = () => html`${AsyncCounter(state)}`

    await render(root, createView())
    expect(root.querySelector('#async-derived')?.textContent).toBe('6')

    state.count = 4
    await nextTick()
    expect(root.querySelector('#async-derived')?.textContent).toBe('12')
  })

  it('hydrates deeply nested serialized async request results without refetching', async () => {
    const root = document.createElement('div')
    const createView = (
      request: (resource: string) => Promise<{ resource: string; message: string }>
    ) => {
      const AsyncLeaf = component<
        { resource: string },
        { resource: string; message: string },
        { resource: string; message: string }
      >(
        async ({ resource }: { resource: string }) => request(resource),
        {
          serialize: (value) => value,
          deserialize: (snapshot) => snapshot,
          render: (value) => html`<strong id="serialized-request">${value.message}</strong>`,
        }
      )

      const Inner = component(
        () => html`<article>${AsyncLeaf({ resource: 'guide' })}</article>`
      )
      const Middle = component(() => html`<section>${Inner()}</section>`)
      const Outer = component(() => html`<div>${Middle()}</div>`)

      return html`${Outer()}`
    }
    const serverRequest = vi.fn(async (resource: string) => {
      await delay()
      return {
        resource,
        message: `Loaded ${resource}`,
      }
    })
    const clientRequest = vi.fn(async (resource: string) => {
      await delay()
      return {
        resource,
        message: `Client loaded ${resource}`,
      }
    })

    const ssr = await renderToString(createView(serverRequest))

    expect(serverRequest).toHaveBeenCalledTimes(1)
    expect(ssr.html).toContain('Loaded guide')
    expect(Object.values(ssr.payload.async ?? {})).toContainEqual({
      resource: 'guide',
      message: 'Loaded guide',
    })

    root.innerHTML = ssr.html
    const existing = root.querySelector('#serialized-request')

    const result = await hydrate(root, createView(clientRequest), ssr.payload)

    expect(result.adopted).toBe(true)
    expect(clientRequest).not.toHaveBeenCalled()
    expect(root.querySelector('#serialized-request')).toBe(existing)
    expect(root.querySelector('#serialized-request')?.textContent).toBe('Loaded guide')
  })

  it('keeps hydration captures isolated across concurrent async roots', async () => {
    const createView = (prefix: string) => {
      const AsyncCounter = component(async () => {
        await delay()
        return prefix
      }, {
        render: (value) => html`<span id="${`${value}-probe`}">${value}</span>`,
      })

      return html`<section>${AsyncCounter()}</section>`
    }

    const leftRoot = document.createElement('div')
    const rightRoot = document.createElement('div')
    const leftSsr = await renderToString(createView('left'))
    const rightSsr = await renderToString(createView('right'))

    leftRoot.innerHTML = leftSsr.html
    rightRoot.innerHTML = rightSsr.html

    const existingLeft = leftRoot.querySelector('#left-probe')
    const existingRight = rightRoot.querySelector('#right-probe')

    expect(leftSsr.html).toContain('left-probe')
    expect(rightSsr.html).toContain('right-probe')

    const [left, right] = await Promise.all([
      hydrate(leftRoot, createView('left'), leftSsr.payload),
      hydrate(rightRoot, createView('right'), rightSsr.payload),
    ])

    expect(left.adopted).toBe(true)
    expect(right.adopted).toBe(true)
    expect(leftRoot.querySelector('#left-probe')).toBe(existingLeft)
    expect(rightRoot.querySelector('#right-probe')).toBe(existingRight)
    expect(leftRoot.querySelector('#left-probe')?.textContent).toBe('left')
    expect(rightRoot.querySelector('#right-probe')?.textContent).toBe('right')
  })

  it('repairs a missing middle subtree without remounting later components', async () => {
    const root = document.createElement('div')

    const Tail = component(() => {
      const state = reactive({
        clicks: 0,
      })

      return html`<button
        id="tail-probe"
        @click="${() => {
          state.clicks += 1
        }}"
      >
        Tail: ${() => state.clicks}
      </button>`
    })

    const createView = () => html`<section>
      <p id="first-copy">first</p>
      <p id="middle-copy">middle</p>
      ${Tail()}
    </section>`

    const ssr = await renderToString(createView())
    root.innerHTML = ssr.html

    const existingTail = root.querySelector('#tail-probe')
    const existingSection = root.firstElementChild
    root.querySelector('#middle-copy')?.remove()

    const onMismatch = vi.fn()
    const result = await hydrate(root, createView(), ssr.payload, { onMismatch })

    expect(result.adopted).toBe(true)
    expect(result.mismatches).toBeGreaterThan(0)
    expect(onMismatch).toHaveBeenCalledOnce()
    expect(onMismatch.mock.calls[0]?.[0]).toMatchObject({
      repaired: true,
    })
    expect(root.firstElementChild).toBe(existingSection)
    expect(root.querySelector('#tail-probe')).toBe(existingTail)
    expect(root.querySelector('#middle-copy')?.textContent).toContain('middle')

    ;(existingTail as HTMLButtonElement).click()
    await nextTick()

    expect(root.querySelector('#tail-probe')?.textContent).toContain('Tail: 1')
  })

  it('falls back to mismatched boundaries without remounting intact neighbors', async () => {
    const root = document.createElement('div')

    const Counter = component(() => {
      const state = reactive({
        clicks: 0,
      })

      return html`<button
        id="boundary-counter"
        @click="${() => {
          state.clicks += 1
        }}"
      >
        Boundary clicks: ${() => state.clicks}
      </button>`
    })

    const createView = () => html`<main>
      ${boundary(html`<section id="fragile">original</section>`, {
        idPrefix: 'fragile',
      })}
      ${boundary(Counter(), { idPrefix: 'stable' })}
    </main>`

    const ssr = await renderToString(createView())
    root.innerHTML = ssr.html

    const existingMain = root.firstElementChild
    const onMismatch = vi.fn()

    root.querySelector('#fragile')?.replaceWith(document.createElement('aside'))

    const replaceChild = vi
      .spyOn(Element.prototype, 'replaceChild')
      .mockImplementation(function (this: Element, newChild: Node, oldChild: Node) {
        if (this === existingMain) {
          throw new Error('force boundary fallback')
        }
        return Node.prototype.replaceChild.call(this, newChild, oldChild)
      })

    const result = await hydrate(root, createView(), ssr.payload, { onMismatch })

    replaceChild.mockRestore()

    expect(result.adopted).toBe(false)
    expect(result.boundaryFallbacks).toBe(2)
    expect(root.firstElementChild).toBe(existingMain)
    expect(root.querySelector('#fragile')?.textContent).toContain('original')

    ;(root.querySelector('#boundary-counter') as HTMLButtonElement).click()
    await nextTick()

    expect(root.querySelector('#boundary-counter')?.textContent).toContain(
      'Boundary clicks: 1'
    )
    expect(onMismatch).toHaveBeenCalledOnce()
    expect(onMismatch.mock.calls[0]?.[0]).toMatchObject({
      repaired: true,
      boundaryFallbacks: 2,
    })
  })

  it('invokes root fallback when subtree repair throws', async () => {
    const root = document.createElement('div')
    root.innerHTML = '<p>server</p>'
    const existing = root.firstChild

    const onMismatch = vi.fn()
    const replaceChild = vi
      .spyOn(Element.prototype, 'replaceChild')
      .mockImplementation(() => {
        throw new Error('repair failed')
      })

    const result = await hydrate(
      root,
      html`<p>client</p>`,
      { html: '<p>different</p>' },
      { onMismatch }
    )

    replaceChild.mockRestore()

    expect(result.adopted).toBe(false)
    expect(onMismatch).toHaveBeenCalledOnce()
    expect(onMismatch.mock.calls[0]?.[0]).toMatchObject({
      repaired: false,
    })
    expect(root.innerHTML).toContain('client')
    expect(root.firstChild).not.toBe(existing)
  })
})
