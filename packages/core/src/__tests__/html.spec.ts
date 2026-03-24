import { html, reactive, nextTick, ArrowTemplate } from '..'
import { click, setValue } from './utils/events'
import { describe, it, expect, vi } from 'vitest'
import {
  createHydrationCapture,
  installHydrationCaptureProvider,
} from '../internal'
interface User {
  name: string
  id: number
}

describe('hydration capture', () => {
  it('records adoption hooks only when a capture provider is active', () => {
    const template = html`<button @click="${() => {}}">probe</button>`
    const inactiveRoot = document.createElement('div')

    template(inactiveRoot)

    const capture = createHydrationCapture()
    installHydrationCaptureProvider(() => capture)
    try {
      const activeTemplate = html`<button @click="${() => {}}">probe</button>`
      const activeRoot = document.createElement('div')

      activeTemplate(activeRoot)

      expect(capture.hooks.get(template._c())).toBeUndefined()
      expect(capture.hooks.get(activeTemplate._c())?.length).toBeGreaterThan(0)
    } finally {
      installHydrationCaptureProvider(null)
    }
  })
})

// describe('createHTML', () => {
//   it('ignores empty templates', () => {
//     const html = createHTML([''])
//     expect(html).toBe('')
//   })
//   it('adds a delimiter even when there is no html', () => {
//     const html = createHTML(['', ''])
//     expect(html).toBe('<!--➳❍-->')
//   })
//   it('adds multiple delimiters even when there is no html', () => {
//     const html = createHTML(['', '', '', ''])
//     expect(html).toBe('<!--➳❍--><!--➳❍--><!--➳❍-->')
//   })
//   it('can place a delimiter comment inside an element', () => {
//     const html = createHTML(['<div>', '</div>'])
//     expect(html).toBe(`<div><!--➳❍--></div>`)
//   })
//   it('can place a delimiter comment after a self closing element', () => {
//     const html = createHTML(['<input>', ''])
//     expect(html).toBe(`<input><!--➳❍-->`)
//   })
//   it('can place an attr delimiter comment after a self closing element', () => {
//     const html = createHTML(['<input type=', ' >', ''])
//     expect(html).toBe(`<input type=❲❍❳ ><!--❲❍❳--><!--➳❍-->`)
//   })
// })

// describe('attrCommentPos', () => {
//   it('can find the position of an attribute comment', () => {
//     // prettier-ignore
//     const left = ["<input type="]
//     const right = [' data-foo="bar">']
//     const [stackIndex, posIndex] = attrCommentPos(left, right)
//     expect(stackIndex).toBe(0)
//     expect(posIndex).toBe(16)
//   })
//   it('can find the position of an attribute comment in the second index of the right hand stack', () => {
//     // prettier-ignore
//     const left = ["<input type="]
//     const right = [' data-foo="', '">']
//     const [stackIndex, posIndex] = attrCommentPos(left, right)
//     expect(stackIndex).toBe(1)
//     expect(posIndex).toBe(2)
//   })

//   it('can find the position of an attribute comment in the second index of the right hand stack', () => {
//     // prettier-ignore
//     const left = ["<input data-bar=\"", "\" type="]
//     const right = [' data-foo="', '"> things here']
//     const [stackIndex, posIndex] = attrCommentPos(left, right)
//     expect(stackIndex).toBe(1)
//     expect(posIndex).toBe(2)
//   })

//   it('can find the position of an attribute comment in the second index of the right hand stack', () => {
//     // prettier-ignore
//     const left = ["&lt;input type="]
//     const right = [' data-foo="', '">']
//     const [stackIndex, posIndex] = attrCommentPos(left, right)
//     expect(stackIndex).toBe(null)
//     expect(posIndex).toBe(null)
//   })
//   it('does not find a position if the opening < is inside quotes', () => {
//     // prettier-ignore
//     const left = ['&lt;input type="<div"=']
//     const right = [' data-foo="', '">']
//     const [stackIndex, posIndex] = attrCommentPos(left, right)
//     expect(stackIndex).toBe(null)
//     expect(posIndex).toBe(null)
//   })
//   it('can find the correct position if the opening < is in the middle of some html', () => {
//     // prettier-ignore
//     const left = ["<p>Hello</p> <div data-foo=\""]
//     const right = ['" data-bar="', '">', ' some stuff in here </div>']
//     const [stackIndex, posIndex] = attrCommentPos(left, right)
//     expect(stackIndex).toBe(1)
//     expect(posIndex).toBe(2)
//   })
//   it('can find the correct position attributes contain < >and escaped quotes', () => {
//     // prettier-ignore
//     const left = ["<p>Hello</p> <div data-html=\"<!--\\\"here-there\\\"-->\" data-foo=\""]
//     // prettier-ignore
//     const right = ['" data-bar="', "\" data-post-html=\"<!--\\\"here-there\\\"-->\"><p></p>', ' some stuff in here </div>"]
//     const [stackIndex, posIndex] = attrCommentPos(left, right)
//     expect(stackIndex).toBe(1)
//     expect(posIndex).toBe(41)
//   })
//   it('can immediately break out when finding a < outside quotes in the front stack', () => {
//     // prettier-ignore
//     const left = ["<input type="]
//     const right = ['" data-foo="bar" <div></div>']
//     const [stackIndex, posIndex] = attrCommentPos(left, right)
//     expect(stackIndex).toBe(null)
//     expect(posIndex).toBe(null)
//   })
//   it('can immediately break out when finding a < outside quotes in the front stack', () => {
//     // prettier-ignore
//     const left = ["<input <div> type="]
//     const right = ['" data-foo="bar">']
//     const [stackIndex, posIndex] = attrCommentPos(left, right)
//     expect(stackIndex).toBe(null)
//     expect(posIndex).toBe(null)
//   })
//   it('returns null when attributes contain < > and escaped quotes but the ending quote is never found', () => {
//     // prettier-ignore
//     const left = ["<p>Hello</p> <div data-html=\"<!--\\\"here-there\\\"-->' data-foo=\""]
//     // prettier-ignore
//     const right = ['" data-bar="', "\" data-post-html=\"<!--\\\"here-there\\\"-->'><p></p>', ' some stuff in here </div>"]
//     const [stackIndex, posIndex] = attrCommentPos(left, right)
//     expect(stackIndex).toBe(null)
//     expect(posIndex).toBe(null)
//   })
// })

describe('html', () => {
  it('can render simple strings', () => {
    const nodes = html`foo bar`().childNodes
    expect(nodes.length).toBe(1)
    expect(nodes[0].nodeName).toBe('#text')
    expect(nodes[0].nodeValue).toBe('foo bar')
  })

  it('can render simple numeric expressions', () => {
    const nodes = html`${10 * 10}`().childNodes
    expect(nodes.length).toBe(1)
    expect(nodes[0].nodeName).toBe('#text')
    expect(nodes[0].nodeValue).toBe('100')
  })

  it('does not render falsy expressions', () => {
    const parent = document.createElement('div')
    html`${false}-${null}-${undefined}-${0}-${NaN}`(parent)
    expect(parent.innerHTML).toBe('---0-')
  })

  it('does not render falsy expression returns', () => {
    const parent = document.createElement('div')
    html`${() => false}-${() => null}-${() => undefined}-${() => 0}-${() =>
      NaN}`(parent)
    expect(parent.innerHTML).toBe('---0-')
  })

  it('can render simple text with expressions', async () => {
    const world = 'World'
    const fragment = html`Hello ${world}`()
    const nodes = fragment.childNodes
    await nextTick()
    expect(nodes.length).toBe(2)
    expect(nodes[0].nodeName).toBe('#text')
    expect(fragment.textContent).toBe('Hello World')
  })

  it('can render reactive data once without arrow fn', async () => {
    const data = reactive({ name: 'World' })
    const node = html`Hello ${data.name}`()
    expect(node.childNodes.length).toBe(2)
    expect(node.textContent).toBe('Hello World')
    data.name = 'Justin'
    await nextTick()
    expect(node.textContent).toBe('Hello World')
  })

  it('can render reactive data once without arrow fn at depth', async () => {
    const data = reactive({ name: 'world' })
    const parent = document.createElement('div')
    html`<div><h1>Hello ${data.name}</h1></div>`(parent)
    expect(parent.innerHTML).toBe('<div><h1>Hello world</h1></div>')
    data.name = 'Justin'
    await nextTick()
    expect(parent.innerHTML).toBe('<div><h1>Hello world</h1></div>')
  })

  it('can render static expression in an attribute', async () => {
    const data = reactive({ name: 'world' })
    const parent = document.createElement('div')
    html`<div data-foo="${true}">
      <h1 data-disappear="${false}">Hello ${data.name}</h1>
    </div>`(parent)
    expect(parent.innerHTML).toMatchSnapshot()
    data.name = 'Justin'
    await nextTick()
    expect(parent.innerHTML).toMatchSnapshot()
  })

  it('throws a clear error when an expression is placed inside a tag opening', () => {
    expect(() => html`<div><h1${() => 'broken'}></div>`()).toThrow(
      /invalid HTML position/i
    )
  })

  it('automatically updates expressions with arrow fn', async () => {
    const data = reactive({ name: 'World' })
    const parent = document.createElement('div')
    html`Hello ${() => data.name}`(parent)
    expect(parent.textContent).toBe('Hello World')
    data.name = 'Justin'
    await nextTick()
    expect(parent.textContent).toBe('Hello Justin')
  })

  it('can create a token expression at the beginning of template', async () => {
    const data = reactive({ name: 'Hello' })
    const parent = document.createElement('div')
    html`${() => data.name} Worldilocks`(parent)
    expect(parent.textContent).toBe('Hello Worldilocks')
    data.name = 'Justin'
    await nextTick()
    expect(parent.textContent).toBe('Justin Worldilocks')
  })

  it('can place expression nested inside some elements inside a string', async () => {
    const data = reactive({ name: 'Hello' })
    const parent = document.createElement('div')
    html`This is cool
      <div>
        And here is more text
        <h2>Name: ${() => data.name} ok?</h2>
      </div>
      <span>${data.name}</span>`(parent)
    expect(parent.innerHTML).toMatchSnapshot()
    data.name = 'Justin'
    await nextTick()
    expect(parent.innerHTML).toMatchSnapshot()
  })

  it('can sub-render templates without reactivity.', async () => {
    const data = reactive({ name: 'World' })
    const parent = document.createElement('div')
    html`Hello ${html`<div>${data.name}</div>`}`(parent)
    expect(parent.innerHTML).toBe('Hello <div>World</div>')
    data.name = 'Justin'
    await nextTick()
    expect(parent.innerHTML).toBe('Hello <div>World</div>')
  })

  it('upgrades reactive text bindings to structured renderables and back', async () => {
    const data = reactive({ active: false })
    const parent = document.createElement('div')

    html`<div><span>before</span>${() =>
      data.active ? html`<strong>after</strong>` : 'text'}<em>end</em></div>`(
      parent
    )

    const before = parent.querySelector('span')
    const end = parent.querySelector('em')
    expect(parent.innerHTML).toBe(
      '<div><span>before</span>text<em>end</em></div>'
    )

    data.active = true
    await nextTick()
    expect(parent.innerHTML).toBe(
      '<div><span>before</span><strong>after</strong><em>end</em></div>'
    )
    expect(parent.querySelector('span')).toBe(before)
    expect(parent.querySelector('em')).toBe(end)

    data.active = false
    await nextTick()
    expect(parent.innerHTML).toBe(
      '<div><span>before</span>text<em>end</em></div>'
    )
    expect(parent.querySelector('span')).toBe(before)
    expect(parent.querySelector('em')).toBe(end)
  })

  it('can render a simple non-reactive list', async () => {
    const data = reactive({ list: ['a', 'b', 'c'] })
    const parent = document.createElement('div')
    html`Hello
      <ul>
        ${data.list.map((item: string) => html`<li>${item}</li>`)}
      </ul>`(parent)
    expect(parent.innerHTML).toMatchSnapshot()
    data.list[1] = 'Justin'
    await nextTick()
    // We shouldn't see any changes because that list was non-reactive.
    expect(parent.innerHTML).toMatchSnapshot()
  })

  it('can render a simple reactive list that pushes a new reactive value on', async () => {
    const data = reactive({ list: ['a', 'b', 'c'] })
    const parent = document.createElement('div')
    html`Hello
      <ul>
        ${() => data.list.map((item: string) => html`<li>${() => item}</li>`)}
      </ul>`(parent)
    expect(parent.innerHTML).toMatchSnapshot()
    data.list.push('next')
    await nextTick()
    expect(parent.innerHTML).toMatchSnapshot()
  })

  it('can render a simple reactive list that unshifts a new reactive value on', async () => {
    const data = reactive({ list: ['a', 'b', 'c'] })
    const parent = document.createElement('div')
    html`Hello
      <ul>
        ${() => data.list.map((item: string) => html`<li>${() => item}</li>`)}
      </ul>`(parent)
    const firstListItem = parent.querySelector('li')
    data.list.unshift('0')
    await nextTick()
    const listValues: string[] = []
    parent
      .querySelectorAll('li')
      .forEach((el) => listValues.push(el.textContent!))
    expect(listValues).toEqual(['0', 'a', 'b', 'c'])
    expect(parent.querySelector('li')).toBe(firstListItem)
  })

  it('re-renders a simple list that changes a static value', async () => {
    const data = reactive({
      list: [{ value: 'a' }, { value: 'b' }, { value: 'c' }],
    })
    const parent = document.createElement('div')
    html`Hello
      <ul>
        ${() => data.list.map((item) => html`<li>${item.value}</li>`)}
      </ul>`(parent)
    data.list[1].value = 'foo'
    await nextTick()
    const listValues: string[] = []
    parent
      .querySelectorAll('li')
      .forEach((el) => listValues.push(el.textContent!))
    expect(listValues).toEqual(['a', 'foo', 'c'])
  })

  it('reuses non-keyed nodes when a same-length list updates static values', async () => {
    const data = reactive({
      list: [{ value: 'a' }, { value: 'b' }, { value: 'c' }],
    })
    const parent = document.createElement('div')
    html`<ul>
      ${() => data.list.map((item) => html`<li>${item.value}</li>`)}
    </ul>`(parent)

    const before = [...parent.querySelectorAll('li')]
    data.list[1].value = 'next'
    await nextTick()
    const after = [...parent.querySelectorAll('li')]

    expect(after).toHaveLength(3)
    expect(after[0]).toBe(before[0])
    expect(after[1]).toBe(before[1])
    expect(after[2]).toBe(before[2])
    expect(after[1]?.textContent).toBe('next')
  })

  it('can render an empty list, render some items, remove the items, and render some again', async () => {
    const data = reactive<{ list: string[] }>({ list: [] })
    const parent = document.createElement('div')
    html`<ul>
      ${() => data.list.map((item: string) => html`<li>${() => item}</li>`)}
    </ul>`(parent)
    expect(parent.querySelector('ul')?.innerHTML).toMatchSnapshot()
    data.list.push('a')
    await nextTick()
    expect(parent.querySelector('ul')?.innerHTML).toMatchSnapshot()
    data.list.shift()
    await nextTick()
    expect(parent.querySelector('ul')?.innerHTML).toMatchSnapshot()
    data.list.push('c')
    await nextTick()
    expect(parent.querySelector('ul')?.innerHTML).toMatchSnapshot()
  })

  it('can render a simple reactive list that shifts a static value off', async () => {
    const data = reactive({ list: ['a', 'b', 'c'] })
    const parent = document.createElement('div')
    html`Hello
      <ul>
        ${() => data.list.map((item: string) => html`<li>${item}</li>`)}
      </ul>`(parent)
    // expect(parent.innerHTML).toMatchSnapshot()
    expect(parent.querySelectorAll('li').length).toBe(3)
    data.list.shift()
    await nextTick()
    // expect(parent.querySelectorAll('li').length).toBe(2)
    const listValues: string[] = []
    parent
      .querySelectorAll('li')
      .forEach((el) => listValues.push(el.textContent!))
    expect(listValues).toEqual(['b', 'c'])
  })

  it('can render a list with different templates', async () => {
    const data = reactive({ list: ['a', 'b', 'c'] })
    const parent = document.createElement('div')
    html`${() =>
      data.list.map((item: string) => {
        if (item === 'a') return html`<h1>${item}</h1>`
        if (item === 'b') return html`<h2>${item}</h2>`
        if (item === 'c') return html`<h3>${item}</h3>`
        return html`<h4>${item}</h4>`
      })}`(parent)
    expect(parent.innerHTML).toBe('<h1>a</h1><h2>b</h2><h3>c</h3>')
    data.list.shift()
    await nextTick()
    expect(parent.innerHTML).toBe('<h2>b</h2><h3>c</h3>')
  })

  it('can render a list with multiple repeated roots.', () => {
    const data = reactive({ list: ['a', 'b', 'c'] })
    const parent = document.createElement('div')
    html`<div>
      ${() =>
        data.list.map(
          (item: string) =>
            html`<h2>${item}</h2>
              <p>foobar</p>`
        )}
    </div>`(parent)
    expect(parent.innerHTML).toMatchSnapshot()
  })

  it('can render a list with new values un-shifted on', async () => {
    const data = reactive({ list: ['a', 'b', 'c'] })
    const parent = document.createElement('div')
    html`<ul>
      ${() => data.list.map((item: string) => html`<li>${item}</li>`)}
    </ul>`(parent)
    expect(parent.innerHTML).toBe(`<ul>
      <li>a</li><li>b</li><li>c</li>
    </ul>`)
    data.list.unshift('z', 'x')
    await nextTick()
    expect(parent.innerHTML).toBe(`<ul>
      <li>z</li><li>x</li><li>a</li><li>b</li><li>c</li>
    </ul>`)
  })

  it('can render a list with new values pushed', async () => {
    const data = reactive({ list: ['a', 'b', 'c'] })
    const parent = document.createElement('div')
    html`<ul>
      ${() => data.list.map((item: string) => html`<li>${item}</li>`)}
    </ul>`(parent)
    expect(parent.innerHTML).toBe(`<ul>
      <li>a</li><li>b</li><li>c</li>
    </ul>`)
    data.list.push('z', 'x')
    await nextTick()
    expect(parent.innerHTML).toBe(`<ul>
      <li>a</li><li>b</li><li>c</li><li>z</li><li>x</li>
    </ul>`)
  })

  it('can render a list with new values spliced in', async () => {
    const data = reactive({ list: ['a', 'b', 'c'] })
    const parent = document.createElement('div')
    html`<ul>
      ${() => data.list.map((item: string) => html`<li>${item}</li>`)}
    </ul>`(parent)
    expect(parent.innerHTML).toBe(`<ul>
      <li>a</li><li>b</li><li>c</li>
    </ul>`)
    data.list.splice(1, 2, 'z', 'y', 'x', 'l')
    await nextTick()
    expect(parent.innerHTML).toBe(`<ul>
      <li>a</li><li>z</li><li>y</li><li>x</li><li>l</li>
    </ul>`)
  })

  it('can render a list with new values spliced in', async () => {
    const data = reactive({ list: ['a', 'b', 'c'] })
    const parent = document.createElement('div')
    html`<ul>
      ${() => data.list.map((item: string) => html`<li>${item}</li>`)}
    </ul>`(parent)
    expect(parent.innerHTML).toBe(`<ul>
      <li>a</li><li>b</li><li>c</li>
    </ul>`)
    data.list.splice(1, 2, 'z', 'y', 'x', 'l')
    await nextTick()
    expect(parent.innerHTML).toBe(`<ul>
      <li>a</li><li>z</li><li>y</li><li>x</li><li>l</li>
    </ul>`)
  })

  it('can render a list with a for loop', async () => {
    const data = reactive({ list: ['a', 'b', 'c'] as string[] })
    const parent = document.createElement('div')
    function list(items: string[]): ArrowTemplate[] {
      const els: ArrowTemplate[] = []
      for (const i in items) {
        els.push(html`<li>${items[i]}</li>`)
      }
      return els
    }
    html`<ul>
      ${() => list(data.list)}
    </ul>`(parent)
    expect(parent.innerHTML).toBe(`<ul>
      <li>a</li><li>b</li><li>c</li>
    </ul>`)
    data.list.push('item')
    await nextTick()
    expect(parent.innerHTML).toBe(`<ul>
      <li>a</li><li>b</li><li>c</li><li>item</li>
    </ul>`)
  })

  it('can remove items from a mapped list by splicing', async () => {
    const data = reactive({
      list: [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
    })
    const parent = document.createElement('div')
    html`<ul>
      ${() => data.list.map((item) => html`<li>${() => item.name}</li>`)}
    </ul>`(parent)
    expect(parent.innerHTML).toBe(`<ul>
      <li>a</li><li>b</li><li>c</li>
    </ul>`)
    data.list.splice(0, 1)
    await nextTick()
    expect(parent.innerHTML).toBe(`<ul>
      <li>b</li><li>c</li>
    </ul>`)
    data.list.splice(0, 1)
    await nextTick()
    expect(parent.innerHTML).toBe(`<ul>
      <li>c</li>
    </ul>`)
    data.list.splice(0, 1)
    await nextTick()
    expect(parent.innerHTML).toBe(`<ul>
      
    </ul>`)
  })

  it('can render a list from an object', async () => {
    const data = reactive<{ food: Record<string, string> }>({
      food: {
        main: 'Pizza',
        desert: 'ice cream',
      },
    })
    const parent = document.createElement('div')
    function list(items: Record<string, string>): ArrowTemplate[] {
      const els: ArrowTemplate[] = []
      for (const i in items) {
        els.push(html`<li>${i}: ${items[i]}</li>`)
      }
      return els
    }
    html`<ul>
      ${() => list(data.food)}
    </ul>`(parent)
    expect(parent.innerHTML).toBe(`<ul>
      <li>main: Pizza</li><li>desert: ice cream</li>
    </ul>`)
    data.food.breakfast = 'bacon'
    await nextTick()
    expect(parent.innerHTML).toBe(`<ul>
      <li>main: Pizza</li><li>desert: ice cream</li><li>breakfast: bacon</li>
    </ul>`)
  })

  it('re-uses nodes that had sub value change.', async () => {
    const data = reactive({
      list: [
        { name: 'Justin', id: 3 },
        { name: 'Luan', id: 1 },
        { name: 'Andrew', id: 2 },
      ],
    })
    const parent = document.createElement('div')
    html`<ul>
      ${() => data.list.map((user: User) => html`<li>${() => user.name}</li>`)}
    </ul>`(parent)
    expect(parent.innerHTML).toBe(`<ul>
      <li>Justin</li><li>Luan</li><li>Andrew</li>
    </ul>`)
    const first = parent.querySelector('li')
    data.list[0].name = 'Bob'
    await nextTick()
    expect(first).toBe(parent.querySelector('li'))
    expect(parent.innerHTML).toBe(`<ul>
      <li>Bob</li><li>Luan</li><li>Andrew</li>
    </ul>`)
  })

  it('can move keyed nodes in a list', async () => {
    const data = reactive({
      list: [
        { name: 'Justin', id: 3 },
        { name: 'Luan', id: 0 },
        { name: 'Andrew', id: 2 },
      ] as Array<{ name: string; id: number }>,
    })
    const parent = document.createElement('div')
    html`<ul>
      ${() =>
        data.list.map((user: User) =>
          html`<li>${() => user.name}</li>`.key(user.id)
        )}
    </ul>`(parent)
    expect(parent.innerHTML).toBe(`<ul>
      <li>Justin</li><li>Luan</li><li>Andrew</li>
    </ul>`)

    // Manually apply some "state" to the DOM
    parent.querySelector('li')?.setAttribute('data-is-justin', 'true')
    data.list.splice(0, 1)
    data.list.push(
      reactive({ name: 'Justin', id: 3 }),
      reactive({ name: 'Fred', id: 1 })
    )
    await nextTick()
    expect(parent.innerHTML).toBe(`<ul>
      <li>Luan</li><li>Andrew</li><li data-is-justin="true">Justin</li><li>Fred</li>
    </ul>`)
  })

  it('can sort keyed nodes in a list', async () => {
    const data = reactive({
      list: [
        { name: 'Justin', id: 3 },
        { name: 'Luan', id: 1 },
        { name: 'Andrew', id: 2 },
      ],
    })
    const parent = document.createElement('div')
    html`<ul>
      ${() =>
        data.list.map((user: User) =>
          html`<li>${() => user.name}</li>`.key(user.id)
        )}
    </ul>`(parent)
    parent.querySelector('li')?.setAttribute('data-is-justin', 'true')
    parent
      .querySelector('li:nth-child(2)')
      ?.setAttribute('data-is-luan', 'true')
    parent
      .querySelector('li:nth-child(3)')
      ?.setAttribute('data-is-andrew', 'true')
    data.list.sort((a: User, b: User) => {
      return a.name > b.name ? 1 : -1
    })
    // await nextTick()
    // expect(parent.innerHTML).toBe(`<ul>
    //   <li data-is-andrew="true">Andrew</li><li data-is-justin="true">Justin</li><li data-is-luan="true">Luan</li>
    // </ul>`)
  })

  it('can swap keyed nodes without losing order', async () => {
    const data = reactive({
      list: [
        { name: 'a', id: 1 },
        { name: 'b', id: 2 },
        { name: 'c', id: 3 },
        { name: 'd', id: 4 },
      ],
    })
    const parent = document.createElement('div')
    html`<ul>
      ${() =>
        data.list.map((item: User) => html`<li>${item.name}</li>`.key(item.id))}
    </ul>`(parent)
    const before = [...parent.querySelectorAll('li')]
    data.list = [data.list[0], data.list[2], data.list[1], data.list[3]]
    await nextTick()
    const after = [...parent.querySelectorAll('li')]
    expect(after.map((item) => item.textContent)).toEqual(['a', 'c', 'b', 'd'])
    expect(after[1]).toBe(before[2])
    expect(after[2]).toBe(before[1])
  })

  it('can update the values in keyed nodes', async () => {
    const data = reactive({
      list: [
        { name: 'Justin', id: 3 },
        { name: 'Luan', id: 1 },
        { name: 'Andrew', id: 2 },
      ],
    })
    const parent = document.createElement('div')
    html`<ul>
      ${() =>
        data.list.map((user: User) => {
          return html`<li>${() => user.name}</li>`.key(user.id)
        })}
    </ul>`(parent)
    data.list[0].name = 'Bob'
    data.list[1] = { name: 'Jeff', id: 1 }
    data.list[2].name = 'Fred'
    await nextTick()
    expect(parent.innerHTML).toBe(`<ul>
      <li>Bob</li><li>Jeff</li><li>Fred</li>
    </ul>`)
    data.list[2].name = 'Ted'
    await nextTick()
    expect(parent.innerHTML).toBe(`<ul>
      <li>Bob</li><li>Jeff</li><li>Ted</li>
    </ul>`)
  })

  it('can render results of multiple data objects', async () => {
    const a = reactive({ price: 45 })
    const b = reactive({ quantity: 25 })
    const parent = document.createElement('div')
    html`${() => a.price * b.quantity}`(parent)
    expect(parent.innerHTML).toBe('1125')
    a.price = 100
    await nextTick()
    expect(parent.innerHTML).toBe('2500')
  })

  it('can conditionally swap nodes', async () => {
    const data = reactive({
      price: 100,
      promo: 'free',
      showPromo: false,
    })
    const parent = document.createElement('div')
    const componentA = html`Price: ${() => data.price}`
    const componentB = html`Promo: <input type="text" />`
    html`<div class="checkout">
      ${() => (data.showPromo ? componentB : componentA)}
    </div>`(parent)
    expect(parent.innerHTML).toBe(`<div class="checkout">
      Price: 100
    </div>`)
    data.showPromo = true
    await nextTick()
    expect(parent.innerHTML).toBe(`<div class="checkout">
      Promo: <input type="text">
    </div>`)
  })

  it('can conditionally show/remove nodes', async () => {
    const data = reactive({
      showPromo: false,
    })
    const parent = document.createElement('div')
    // Note: this test seems obtuse but it isn't since it performing this toggle
    // action multiple times stress tests the underlying placeholder mechanism.
    const promo = html`Promo: <input type="text" />`
    html`<div class="checkout">${() => data.showPromo && promo}</div>`(parent)
    expect(parent.innerHTML).toMatchSnapshot()
    data.showPromo = true
    await nextTick()
    expect(parent.innerHTML).toMatchSnapshot()
    data.showPromo = false
    await nextTick()
    expect(parent.innerHTML).toMatchSnapshot()
    data.showPromo = true
    await nextTick()
    expect(parent.innerHTML).toMatchSnapshot()
  })

  it('outputs the boolean true, but not the boolean false', () => {
    const parent = document.createElement('div')
    expect(
      (html`${() => true}${() => false}`(parent) as Element).innerHTML
    ).toBe('true')
  })

  it('can render an attribute', () => {
    const parent = document.createElement('div')
    const data = reactive({
      org: 'braid',
    })
    expect(
      (html`<div data-org="${() => data.org}"></div>`(parent) as Element)
        .innerHTML
    ).toBe(`<div data-org="braid"></div>`)
  })

  it('can remove and re-add multiple attributes', async () => {
    const parent = document.createElement('div')
    const data = reactive({
      org: 'braid' as boolean | string,
      precinct: false as boolean | string,
      state: 'virginia',
    })
    html`<div x-precinct="${() => data.precinct}" data-org="${() => data.org}">
      ${() => data.state}
    </div>`(parent) as Element
    await nextTick()
    expect(parent.innerHTML).toMatchSnapshot()
    data.precinct = 'cville'
    await nextTick()
    expect(parent.innerHTML).toMatchSnapshot()
    data.org = false
    await nextTick()
    expect(parent.innerHTML).toMatchSnapshot()
    data.org = 'other'
    data.state = 'california'
    await nextTick()
    expect(parent.innerHTML).toMatchSnapshot()
  })

  it('can render nested nodes with attribute expressions', async () => {
    const parent = document.createElement('div')
    const data = reactive({
      country: 'usa',
      states: [
        { name: 'virginia', abbr: 'va' },
        { name: 'nebraska', abbr: 'ne' },
        { name: 'california', abbr: 'ca' },
      ] as Array<{ name: string; abbr: string }>,
    })
    html`<ul data-country="${data.country}">
      ${() =>
        data.states.map(
          (state: { name: string; abbr: string }) =>
            html`<li data-abbr="${() => state.abbr}">${() => state.name}</li>`
        )}
      <li data-first-abbr="${() => data.states[0].abbr}">
        ${() => data.states[0].name}
      </li>
    </ul> `(parent)
    expect(parent.innerHTML).toMatchSnapshot()
    data.states.sort((a, b) => {
      return a.abbr > b.abbr ? 1 : -1
    })
    await nextTick()
    expect(parent.innerHTML).toMatchSnapshot()
  })

  it('can render the number zero', async () => {
    const parent = document.createElement('div')
    html`${() => 0}|${0}`(parent)
    expect(parent.innerHTML).toBe('0|0')
  })

  it('can bind to native events as easily as pecan pie', async () => {
    const parent = document.createElement('div')
    const data = reactive({ value: '' })
    const update = (event: Event) => {
      data.value = (event.target as HTMLInputElement).value
    }
    html`<input type="text" @input="${update}" />${() => data.value}`(parent)
    setValue(parent.querySelector('input'), 'pizza')
    await nextTick()
    expect(parent.innerHTML).toBe('<input type="text">pizza')
  })

  it('preserves currentTarget for shared event handlers', () => {
    const parent = document.createElement('div')
    const handler = vi.fn((event: Event) => event.currentTarget)
    html`<button @click="${handler}">probe</button>`(parent)
    const button = parent.querySelector('button') as HTMLButtonElement
    click(button)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.results[0]?.value).toBe(button)
  })

  it('honors stopPropagation with delegated bubbling handlers', () => {
    const parent = document.createElement('div')
    const outer = vi.fn()
    const inner = vi.fn((event: Event) => event.stopPropagation())

    html`<div @click="${outer}"><button @click="${inner}">probe</button></div>`(
      parent
    )

    click(parent.querySelector('button') as HTMLButtonElement)
    expect(inner).toHaveBeenCalledTimes(1)
    expect(outer).toHaveBeenCalledTimes(0)
  })

  it('updates shared event handlers when a reused node changes templates', async () => {
    const parent = document.createElement('div')
    const first = vi.fn()
    const second = vi.fn()
    const data = reactive({ active: 'first' as 'first' | 'second' })

    html`${() =>
      data.active === 'first'
        ? html`<button @click="${first}">probe</button>`
        : html`<button @click="${second}">probe</button>`}`(parent)

    const button = parent.querySelector('button') as HTMLButtonElement
    click(button)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(0)

    data.active = 'second'
    await nextTick()
    expect(parent.querySelector('button')).toBe(button)

    click(button)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('supports compiler-generated string arrays with attrs, events, and signature reuse', async () => {
    const parent = document.createElement('div')
    const first = vi.fn()
    const second = vi.fn()
    const data = reactive({
      title: 'ready',
      label: 'Push',
      active: 'first' as 'first' | 'second',
    })

    const button = () =>
      html(
        ['<button title="', '" @click="', '">', '</button>'],
        data.title,
        data.active === 'first' ? first : second,
        data.label
      )

    html`${() => button()}`(parent)

    const target = parent.querySelector('button') as HTMLButtonElement
    expect(target.getAttribute('title')).toBe('ready')
    expect(target.textContent).toBe('Push')

    click(target)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(0)

    data.title = 'clicked'
    data.label = 'Again'
    data.active = 'second'
    await nextTick()

    expect(parent.querySelector('button')).toBe(target)
    expect(target.getAttribute('title')).toBe('clicked')
    expect(target.textContent).toBe('Again')

    click(target)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('sets the IDL value attribute on input elements', async () => {
    const parent = document.createElement('div')
    const data = reactive({ value: '' })
    const update = (event: InputEvent) => {
      data.value = (event.target as HTMLInputElement).value
    }
    html`<input
        type="text"
        value="${() => data.value}"
        @input="${update}"
        id="a"
      />
      <input
        type="text"
        value="${() => data.value}"
        @input="${update}"
        id="b"
      />${() => data.value}`(parent)
    const a = parent.querySelector('[id="a"]') as HTMLInputElement
    const b = parent.querySelector('[id="b"]') as HTMLInputElement
    setValue(a, 'pizza')
    await nextTick()
    expect(b.value).toBe('pizza')
    setValue(b, 'pie')
    await nextTick()
    expect(a.value).toBe('pie')
    expect(a.getAttribute('value')).toBe(null)
  })

  it('sets the IDL checked attribute on checkbox elements', async () => {
    const parent = document.createElement('div')
    const data = reactive({ checked: false })
    html`<input type="checkbox" checked="${() => data.checked}" id="a" />`(
      parent
    )
    const a = parent.querySelector('[id="a"]') as HTMLInputElement
    expect(a.checked).toBe(false)
    a.checked = true
    await nextTick()
    expect(a.checked).toBe(true)
    expect(data.checked).toBe(false)
    data.checked = true
    await nextTick()
    expect(a.checked).toBe(true)
    data.checked = false
    await nextTick()
    expect(a.checked).toBe(false)
    expect(a.getAttribute('checked')).toBe(null)
  })

  it('cleans up event listeners when a node has been removed', async () => {
    const clickHandler = vi.fn()
    const parent = document.createElement('div')
    const data = reactive({
      show: true,
    })
    html`${() =>
      data.show ? html`<button @click="${clickHandler}"></button>` : ''}`(
      parent
    )
    let button = parent.querySelector('button') as HTMLButtonElement
    click(button)
    expect(clickHandler).toHaveBeenCalledTimes(1)
    data.show = false
    await nextTick()
    click(button)
    expect(clickHandler).toHaveBeenCalledTimes(1)
    data.show = true
    await nextTick()
    button = parent.querySelector('button') as HTMLButtonElement
    click(button)
    expect(clickHandler).toHaveBeenCalledTimes(2)
  })

  it('removes deeply nested event listeners', async () => {
    const clickHandler = vi.fn()
    const parent = document.createElement('div')
    const data = reactive({
      show: true,
    })
    html`${() =>
      data.show
        ? html`<div><button @click="${clickHandler}"></button></div>`
        : ''}`(parent)
    let button = parent.querySelector('button') as HTMLButtonElement
    click(button)
    expect(clickHandler).toHaveBeenCalledTimes(1)
    data.show = false
    await nextTick()
    click(button)
    expect(clickHandler).toHaveBeenCalledTimes(1)
    data.show = true
    await nextTick()
    button = parent.querySelector('button') as HTMLButtonElement
    click(button)
    expect(clickHandler).toHaveBeenCalledTimes(2)
  })

  it('defaults to the proper option select element', () => {
    const parent = document.createElement('div')
    const data = reactive({ selected: 'b' })
    html`<select>
      <option value="a" selected="${() => 'a' === data.selected}">A</option>
      <option value="b" selected="${() => 'b' === data.selected}">B</option>
      <option value="c" selected="${() => 'c' === data.selected}">C</option>
    </select>`(parent)
    expect(parent.querySelector('select')?.value).toBe('b')
  })

  it('can create a table with dynamic columns and rows', () => {
    const parent = document.createElement('div')
    const rows = [
      ['Detroit', 'MI'],
      ['Boston', 'MA'],
    ]
    html`<table>
      <tbody>
        ${rows.map(
          (row) =>
            html`<tr>
              ${row.map((column) => html`<td>${column}</td>`)}
            </tr>`
        )}
      </tbody>
    </table>`(parent)
    expect(parent.innerHTML).toMatchSnapshot()
  })

  // it('renders sanitized HTML when reading from a variable.', () => {
  //   const data = reactive({
  //     foo: '<h1>Hello world</h1>',
  //   })
  //   expect(html`<div>${() => data.foo}</div>`().querySelector('h1')).toBe(null)
  // })
  it('renders sanitized HTML when updating from a variable.', async () => {
    const data = reactive({
      html: 'foo',
    })
    const stage = document.createElement('div')
    html`<div>${() => data.html}</div>`(stage)
    data.html = '<h1>Some text</h1>'
    await nextTick()
    expect(stage.querySelector('h1')).toBe(null)
  })
  it('renders keyed list and updates child value without removing/moving any nodes', async () => {
    const data = reactive({
      list: [
        {
          id: 1,
          name: 'foo',
        },
        {
          id: 2,
          name: 'bar',
        },
      ],
    })
    const stage = document.createElement('div')
    html`<ul>
      ${() =>
        data.list.map((item) =>
          html` <li>
            ${() => item.name}<input
              @input="${(e: Event) => {
                item.name = (e.target as HTMLInputElement).value
              }}"
            />
          </li>`.key(item.id)
        )}
    </ul>`(stage)
    const callback = vi.fn()
    const observer = new MutationObserver(callback)
    observer.observe(stage.querySelector('ul')!, { childList: true })
    const input = stage.querySelector('input') as HTMLInputElement
    setValue(input, 'foobar')
    await nextTick()
    expect(callback).not.toHaveBeenCalled()
  })

  it('updates plain attributes without reactive attr watchers', async () => {
    const data = reactive({ state: 'cold', label: 'Alpha' })
    const stage = document.createElement('div')

    html`<div>
      ${() => [html`<span class="${data.state}">${data.label}</span>`]}
    </div>`(stage)

    expect(stage.innerHTML).toBe('<div>\n      <span class="cold">Alpha</span>\n    </div>')
    data.state = 'hot'
    data.label = 'Beta'
    await nextTick()
    expect(stage.innerHTML).toBe('<div>\n      <span class="hot">Beta</span>\n    </div>')
  })

  it('updates shifted recalled list items after removal', async () => {
    const data = reactive({
      list: [
        { id: 1, label: 'one' },
        { id: 2, label: 'two' },
        { id: 3, label: 'three' },
      ],
    })
    const stage = document.createElement('div')

    html`<ul>
      ${() =>
        data.list.map((item) =>
          html`<li data-id="${item.id}">${item.label}</li>`
        )}
    </ul>`(stage)

    data.list.splice(0, 1)
    await nextTick()
    expect(stage.innerHTML).toBe(
      '<ul>\n      <li data-id="2">two</li><li data-id="3">three</li>\n    </ul>'
    )
  })

  it('can render an empty template', async () => {
    const div = document.createElement('div')
    const store = reactive({ show: true })
    expect(() =>
      html`${() => (store.show ? html`<br />` : html``)}`(div)
    ).not.toThrow()
    expect(div.innerHTML).toBe('<br>')
    store.show = false
    await nextTick()
    expect(div.innerHTML).toBe('')
  })

  it('can render an array of items and mutate an item in the array (#49)', async () => {
    const div = document.createElement('div')
    const data = reactive({ order: [1, 2, 3] })
    html`<ul>
      ${() => data.order.map((item) => html`<li>${item}</li>`)}
    </ul>`(div)
    data.order[1] += 10
    await nextTick()
    expect(div.innerHTML).toMatchSnapshot()
  })

  it('can set any arbitrary IDL attribute', async () => {
    const div = document.createElement('div')
    class XFoo extends HTMLDivElement {
      foo: string
      constructor() {
        super()
        this.foo = 'bar'
      }
    }
    customElements.define('x-foo', XFoo, { extends: 'div' })
    const data = reactive({ foo: 'bim' })
    html`<x-foo .foo="${() => data.foo}"></x-foo>`(div)
    const x = div.querySelector('x-foo') as XFoo
    expect(x.foo).toBe('bim')
    data.foo = 'baz'
    await nextTick()
    expect(x.foo).toBe('baz')
    expect(x.getAttribute('foo')).toBe(null)
  })

  it('reuses a detached chunk by explicit template id', async () => {
    const host = document.createElement('div')
    const state = reactive({ show: true, label: 'alpha' })

    html`${() =>
      state.show
        ? html`<button data-probe="id">${() => state.label}</button>`.id('probe')
        : html``}`(host)

    const first = host.querySelector('[data-probe="id"]') as HTMLButtonElement
    state.show = false
    await nextTick()
    expect(host.querySelector('[data-probe="id"]')).toBeNull()

    state.label = 'beta'
    state.show = true
    await nextTick()

    const second = host.querySelector('[data-probe="id"]') as HTMLButtonElement
    expect(second).toBe(first)
    expect(second.textContent).toBe('beta')
  })

  it('keeps event listeners live when a detached chunk is revived', async () => {
    const host = document.createElement('div')
    const state = reactive({ show: true, clicks: 0 })

    html`${() =>
      state.show
        ? html`<button data-probe="reuse" @click="${() => state.clicks++}">
            ${() => state.clicks}
          </button>`.id('reuse-button')
        : html``}`(host)

    const first = host.querySelector('[data-probe="reuse"]') as HTMLButtonElement
    first.click()
    await nextTick()
    expect(first.textContent?.trim()).toBe('1')

    state.show = false
    await nextTick()

    state.show = true
    await nextTick()

    const second = host.querySelector('[data-probe="reuse"]') as HTMLButtonElement
    expect(second).toBe(first)
    second.click()
    await nextTick()
    expect(second.textContent?.trim()).toBe('2')
  })

  it('reuses a detached chunk for the same static signature without an explicit id', async () => {
    const host = document.createElement('div')
    const firstState = reactive({ show: true, label: 'first' })
    const secondState = reactive({ show: true, label: 'second' })

    const ViewA = () => html`<li data-probe="sig">${firstState.label}</li>`
    const ViewB = () => html`<li data-probe="sig">${secondState.label}</li>`

    html`${() => (firstState.show ? ViewA() : html``)}`(host)
    const first = host.querySelector('[data-probe="sig"]') as HTMLLIElement

    firstState.show = false
    await nextTick()

    html`${() => (secondState.show ? ViewB() : html``)}`(host)
    const second = host.querySelector('[data-probe="sig"]') as HTMLLIElement

    expect(second).toBe(first)
    expect(second.textContent).toBe('second')
  })

  it('throws when the same stale id is reused with a different static signature', async () => {
    const host = document.createElement('div')
    const state = reactive({ show: true })

    html`${() => (state.show ? html`<div>alpha</div>`.id('shape-check') : html``)}`(host)
    state.show = false
    await nextTick()

    expect(() => html`<span>beta</span>`.id('shape-check')(host)).toThrow(
      /shape mismatch/
    )
  })

  it('supports compiler-generated property bindings like innerHTML', async () => {
    const host = document.createElement('div')
    const state = reactive({ markup: '<strong>Ready</strong>' })
    const strings = ['<div data-probe="summary" .innerHTML="', '"></div>']

    html`${() => html(strings, state.markup)}`(host)

    const target = host.querySelector('[data-probe="summary"]') as HTMLDivElement
    expect(target.innerHTML).toBe('<strong>Ready</strong>')

    state.markup = '<em>Done</em>'
    await nextTick()

    expect(target.innerHTML).toBe('<em>Done</em>')
  })

  it('swaps compiler-generated templates when a condition changes', async () => {
    const host = document.createElement('div')
    const state = reactive({ accountType: 'business' })
    const company = ['<p data-probe="branch">Company field</p>']
    const personal = ['<p data-probe="branch">Personal account</p>']

    html`${() =>
      state.accountType !== 'personal' ? html(company) : html(personal)}`(host)

    expect(host.textContent).toContain('Company field')

    state.accountType = 'personal'
    await nextTick()

    expect(host.textContent).toContain('Personal account')
    expect(host.textContent).not.toContain('Company field')
  })
})

describe('html text nodes', () => {
  it('updates the the text node itself rather than creating new ones', async () => {
    const parent = document.createElement('div')
    const data = reactive({ text: 'foo' })
    html`<span>${() => data.text}</span>`(parent)
    const initialNode = parent.children[0].childNodes[0]
    expect(initialNode).toBeInstanceOf(Text)
    expect(initialNode.nodeValue).toBe('foo')
    data.text = 'bar'
    await nextTick()
    const postNode = parent.children[0].childNodes[0]
    expect(postNode.nodeValue).toBe('bar')
    expect(initialNode === postNode).toBe(true)
  })
})
