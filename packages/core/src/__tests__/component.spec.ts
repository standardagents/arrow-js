import { describe, expect, it, vi } from 'vitest'

import { component, html, nextTick, pick, reactive } from '..'
import type { Emit, Props } from '..'

const text = (node: Node) => node.textContent?.replace(/\s+/g, '') ?? ''

describe('component', () => {
  it('renders reactive props without extra wrappers', async () => {
    const data = reactive({ count: 1, other: 'value' })
    const Counter = component((props: Props<{ count: number }>) =>
      html`<div>${() => props.count}</div>`
    )
    const root = document.createElement('div')

    html`<main>${Counter(data)}</main>`(root)
    expect(root.innerHTML).toBe('<main><div>1</div></main>')

    data.count = 2
    await nextTick()

    expect(root.innerHTML).toBe('<main><div>2</div></main>')
  })

  it('supports components with no props', () => {
    const Static = component(() => html`<section>hello</section>`)
    const root = document.createElement('div')

    html`<main>${Static()}</main>`(root)

    expect(root.innerHTML).toBe('<main><section>hello</section></main>')
  })

  it('keeps local component state across higher-order rerenders', async () => {
    const data = reactive({ count: 1, outer: true })
    let created = 0
    const Child = component((props: Props<{ count: number }>) => {
      const local = reactive({ id: ++created, clicks: 0 })
      return html`<button
        @click="${() => local.clicks++}"
      >${() => `${props.count}|${local.id}|${local.clicks}`}</button>`
    })
    const root = document.createElement('div')

    html`<main>${() => (data.outer ? Child(data) : Child(data))}</main>`(root)
    let button = root.querySelector('button') as HTMLButtonElement
    button.click()
    await nextTick()
    expect(button.textContent).toBe('1|1|1')

    data.outer = false
    await nextTick()
    button = root.querySelector('button') as HTMLButtonElement
    expect(button.textContent).toBe('1|1|1')
    expect(created).toBe(1)

    data.count = 2
    await nextTick()
    expect(button.textContent).toBe('2|1|1')
  })

  it('swaps prop sources without recreating the component instance', async () => {
    const left = reactive({ count: 1 })
    const right = reactive({ count: 5 })
    const data = reactive({ left: true })
    let created = 0
    const Child = component((props: Props<{ count: number }>) => {
      const local = reactive({ id: ++created })
      return html`<div>${() => `${props.count}|${local.id}`}</div>`
    })
    const root = document.createElement('div')

    html`<main>${() => Child(data.left ? left : right)}</main>`(root)
    expect(root.textContent).toBe('1|1')

    data.left = false
    await nextTick()
    expect(root.textContent).toBe('5|1')
    expect(created).toBe(1)

    right.count = 6
    await nextTick()
    expect(root.textContent).toBe('6|1')
  })

  it('creates separate instances for the same props object in separate slots', () => {
    const data = reactive({ count: 1 })
    let created = 0
    const Child = component((props: Props<{ count: number }>) => {
      const local = reactive({ id: ++created })
      return html`<div>${() => `${props.count}|${local.id}`}</div>`
    })
    const root = document.createElement('div')

    html`<main>${[Child(data), Child(data)]}</main>`(root)

    expect(root.textContent).toBe('1|11|2')
    expect(created).toBe(2)
  })

  it('preserves keyed child components when surrounding shape changes', async () => {
    const data = reactive({ count: 1, wrapped: true })
    let created = 0
    const Child = component((props: Props<{ count: number }>) => {
      const local = reactive({ id: ++created })
      return html`<button>${() => `${props.count}|${local.id}`}</button>`
    })
    const root = document.createElement('div')

    html`<main>
      ${() =>
        data.wrapped
          ? [html`<span>before</span>`, Child(data).key('child')]
          : [Child(data).key('child')]}
    </main>`(root)

    expect(text(root)).toBe('before1|1')
    data.wrapped = false
    await nextTick()
    expect(text(root)).toBe('1|1')
    expect(created).toBe(1)
  })

  it('resets component state after the slot is removed', async () => {
    const data = reactive({ count: 1, show: true })
    let created = 0
    const Child = component((props: Props<{ count: number }>) => {
      const local = reactive({ id: ++created })
      return html`<div>${() => `${props.count}|${local.id}`}</div>`
    })
    const root = document.createElement('div')

    html`<main>${() => (data.show ? Child(data) : '')}</main>`(root)
    expect(root.textContent).toBe('1|1')

    data.show = false
    await nextTick()
    expect(root.textContent).toBe('')

    data.show = true
    await nextTick()
    expect(root.textContent).toBe('1|2')
  })

  it('cleans up computed values created inside a component when the slot unmounts', async () => {
    const data = reactive({ count: 1, show: true })
    const runs = vi.fn((count: number) => count * 2)
    const Child = component((props: Props<{ count: number }>) => {
      const local = reactive({
        total: reactive(() => runs(props.count)),
      })

      return html`<div>${() => local.total}</div>`
    })
    const root = document.createElement('div')

    html`<main>${() => (data.show ? Child(pick(data, 'count')) : '')}</main>`(root)
    expect(root.textContent).toBe('2')
    expect(runs).toHaveBeenCalledTimes(1)

    data.count = 2
    await nextTick()
    expect(root.textContent).toBe('4')
    expect(runs).toHaveBeenCalledTimes(2)

    data.show = false
    await nextTick()
    expect(root.textContent).toBe('')

    data.count = 3
    await nextTick()
    expect(runs).toHaveBeenCalledTimes(2)
  })

  it('preserves keyed component state across list reorders', async () => {
    const data = reactive({
      items: [
        reactive({ id: 1, label: 'one' }),
        reactive({ id: 2, label: 'two' }),
      ],
    })
    let created = 0
    const Child = component((props: Props<{ label: string }>) => {
      const local = reactive({ id: ++created, clicks: 0 })
      return html`<button
        @click="${() => local.clicks++}"
      >${() => `${props.label}|${local.id}|${local.clicks}`}</button>`
    })
    const root = document.createElement('div')

    html`<main>
      ${() => data.items.map((item) => Child(item).key(item.id))}
    </main>`(root)

    const first = root.querySelector('button') as HTMLButtonElement
    first.click()
    await nextTick()
    expect(text(root)).toBe('one|1|1two|2|0')

    data.items.reverse()
    await nextTick()
    expect(text(root)).toBe('two|2|0one|1|1')
  })

  it('uses position rather than identity for non-keyed lists', async () => {
    const data = reactive({
      items: [
        reactive({ id: 1, label: 'one' }),
        reactive({ id: 2, label: 'two' }),
      ],
    })
    let created = 0
    const Child = component((props: Props<{ label: string }>) => {
      const local = reactive({ id: ++created })
      return html`<div>${() => `${props.label}|${local.id}`}</div>`
    })
    const root = document.createElement('div')

    html`<main>${() => data.items.map((item) => Child(item))}</main>`(root)
    expect(root.textContent).toBe('one|1two|2')

    data.items.reverse()
    await nextTick()
    expect(root.textContent).toBe('two|1one|2')
  })

  it('keeps narrowed props live without a call-site closure', async () => {
    const data = reactive({ count: 1, other: 'value' })
    const Child = component((props: Props<{ count: number }>) =>
      html`<div>${() => props.count}</div>`
    )
    const root = document.createElement('div')

    html`<main>${Child(pick(data, 'count'))}</main>`(root)
    expect(root.textContent).toBe('1')

    data.other = 'changed'
    await nextTick()
    expect(root.textContent).toBe('1')

    data.count = 2
    await nextTick()
    expect(root.textContent).toBe('2')
  })

  it('forwards top-level prop writes to the source object', async () => {
    const data = reactive({ count: 1 })
    const Child = component((props: Props<{ count: number }>) =>
      html`<button @click="${() => props.count++}">${() => props.count}</button>`
    )
    const root = document.createElement('div')

    html`<main>${Child(data)}</main>`(root)

    const button = root.querySelector('button') as HTMLButtonElement
    button.click()
    await nextTick()

    expect(data.count).toBe(2)
    expect(button.textContent).toBe('2')
  })

  it('forwards top-level writes for narrowed props created with pick()', async () => {
    const data = reactive({ count: 1, other: 'value' })
    const Child = component((props: Props<{ count: number }>) =>
      html`<button @click="${() => props.count++}">${() => props.count}</button>`
    )
    const root = document.createElement('div')

    html`<main>${Child(pick(data, 'count'))}</main>`(root)

    const button = root.querySelector('button') as HTMLButtonElement
    button.click()
    await nextTick()

    expect(data.count).toBe(2)
    expect(button.textContent).toBe('2')
    expect(data.other).toBe('value')
  })

  it('emits payloads to parent listeners without recreating child state', async () => {
    const data = reactive({ count: 1, second: false })
    const first = vi.fn()
    const second = vi.fn()
    let created = 0

    const Child = component(
      (
        props: Props<{ count: number }>,
        emit: Emit<{ color: string }>
      ) => {
        const local = reactive({ id: ++created })
        return html`<button
          @click="${() => emit('color', `${props.count}|${local.id}`)}"
        >emit</button>`
      }
    )
    const root = document.createElement('div')

    html`<main>
      ${() =>
        Child(data, {
          color: data.second ? second : first,
        })}
    </main>`(root)

    let button = root.querySelector('button') as HTMLButtonElement
    button.click()
    expect(first).toHaveBeenCalledWith('1|1')
    expect(created).toBe(1)

    data.second = true
    await nextTick()

    button = root.querySelector('button') as HTMLButtonElement
    button.click()
    expect(second).toHaveBeenCalledWith('1|1')
    expect(created).toBe(1)
  })

  it('supports emits for components without props', () => {
    const ready = vi.fn()
    const Child = component(
      (_props: undefined, emit: Emit<{ ready: string }>) =>
        html`<button @click="${() => emit('ready', 'ok')}">go</button>`
    )
    const root = document.createElement('div')

    html`<main>${Child(undefined, { ready })}</main>`(root)

    const button = root.querySelector('button') as HTMLButtonElement
    button.click()

    expect(ready).toHaveBeenCalledWith('ok')
  })
})
