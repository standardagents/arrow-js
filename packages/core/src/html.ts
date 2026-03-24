import { watch } from './reactive'
import { isChunk, isTpl, swapCleanupCollector } from './common'
import { setAttr } from './dom'
import {
  adoptCapturedChunk,
  getHydrationCapture,
  registerHydrationHook,
} from './hydration'
import type { HydrationCapture, NodeMap } from './hydration'
import {
  createPropsProxy,
  isCmp,
} from './component'
import type { ComponentCall } from './component'
import {
  createExpressionBlock,
  expressionPool,
  initExpressions,
  onExpressionUpdate,
  releaseExpressions,
  writeExpressions,
} from './expressions'

export interface ArrowTemplate {
  (parent: ParentNode): ParentNode
  (): DocumentFragment
  isT: boolean
  key: (key: ArrowTemplateKey) => ArrowTemplate
  id: (id: ArrowTemplateId) => ArrowTemplate
  _c: () => Chunk
  _k: ArrowTemplateKey
  _i?: ArrowTemplateId
}

export type ArrowTemplateKey = string | number | undefined
type ArrowTemplateId = string | number | undefined

export type ArrowRenderable =
  | string
  | number
  | boolean
  | null
  | undefined
  | ComponentCall
  | ArrowTemplate
  | Array<string | number | boolean | ComponentCall | ArrowTemplate>

export interface ReactiveFunction {
  (el?: Node): ArrowRenderable
  $on: (observer: ArrowFunction | null) => ArrowFunction | null
  _up: (newExpression: ReactiveFunction) => void
  e: ArrowExpression
  s: boolean
}

export type ReactiveExpressions = {
  i: number
  e: ReactiveFunction[]
}

export interface ArrowFragment {
  <T extends ParentNode>(parent?: T): T extends undefined ? DocumentFragment : T
}

export type ParentNode = Node | DocumentFragment

export type RenderGroup =
  | ArrowTemplate
  | ArrowTemplate[]
  | Node
  | Node[]
  | string[]

export type ArrowFunction = (...args: unknown[]) => ArrowRenderable

export type ArrowExpression =
  | ArrowRenderable
  | ArrowFunction
  | EventListener
  | ((evt: InputEvent) => void)

export interface Chunk {
  paths: [number[], string[]]
  dom: DocumentFragment
  ref: DOMRef
  _t: ArrowTemplate
  k?: ArrowTemplateKey
  i?: ArrowTemplateId
  e: number
  g: string
  b: boolean
  r: boolean
  st: boolean
  bkn?: Chunk
  v?: Array<[Element, string]> | null
  u?: Array<() => void> | null
  s?: ReturnType<typeof createPropsProxy>[2]
  mk?: number
  next?: Chunk
}

interface ChunkProto {
  readonly template: HTMLTemplateElement
  readonly paths: Chunk['paths']
  readonly signature: string
  readonly expressions: number
}

interface DOMRef {
  f: ChildNode | null
  l: ChildNode | null
}

const eventBindingsKey = Symbol()

interface EventBindingMeta {
  c: Chunk
  p: number
}

interface EventBoundElement extends Element {
  [eventBindingsKey]?: Record<string, EventBindingMeta | undefined>
}

type Rendered = Chunk | Text
type RenderController = ((
  renderable: ArrowRenderable
) => DocumentFragment | Text | void) & {
  adopt: (map: NodeMap, visited: WeakSet<Chunk>) => void
}
type InternalTemplate = ArrowTemplate & {
  _a?: ArrayLike<unknown>
  _h?: Chunk
  _m?: boolean
  _o?: number
  _p?: ChunkProto
  _s?: TemplateStringsArray | string[]
}

interface StaleBucket {
  head?: Chunk
}

let bindingStackPos = -1
const bindingStack: Array<Node | number> = []
const nodeStack: Node[] = []

const delimiter = '¤'
const delimiterComment = `<!--${delimiter}-->`
const initialChunkPoolSize = 1024

const chunkMemo = new WeakMap<Document, Record<string, ChunkProto>>()
const chunkMemoByRef = new WeakMap<
  ReadonlyArray<string>,
  WeakMap<Document, ChunkProto>
>()
const staleById = new Map<Exclude<ArrowTemplateId, undefined>, Chunk>()
const staleBySignature = new Map<string, StaleBucket>()
let chunkPoolHead: Chunk | undefined
let renderedMark = 0

growChunkPool(initialChunkPoolSize)

function moveDOMRef(
  ref: DOMRef,
  parent: Node | null,
  before?: ChildNode | null
) {
  let node = ref.f
  if (!parent || !node) return
  const last = ref.l
  if (node === last) {
    parent.insertBefore(node, before || null)
    return
  }
  while (node) {
    const next: ChildNode | null =
      node === last ? null : (node.nextSibling as ChildNode | null)
    parent.insertBefore(node, before || null)
    if (!next) break
    node = next
  }
}

function markRenderedValue(value: Rendered, mark: number) {
  ;(value as Rendered & { mk?: number }).mk = mark
}

function isRenderedValueMarked(value: Rendered, mark: number) {
  return (value as Rendered & { mk?: number }).mk === mark
}

function getChunkProto(template: InternalTemplate): ChunkProto {
  const cached = template._p
  if (cached) return cached
  return (template._p = resolveChunkProto(template._s as string[]))
}

function resolveChunkProto(rawStrings: TemplateStringsArray | string[]): ChunkProto {
  const doc = document
  let memoByRef = chunkMemoByRef.get(rawStrings)
  const cachedByRef = memoByRef?.get(doc)
  if (cachedByRef) return cachedByRef

  const signature = rawStrings.join(delimiterComment)
  let signatureMemo = chunkMemo.get(doc)
  if (!signatureMemo) {
    signatureMemo = {}
    chunkMemo.set(doc, signatureMemo)
  }
  const cached = signatureMemo[signature]
  if (cached) {
    memoByRef ??= new WeakMap<Document, ChunkProto>()
    memoByRef.set(doc, cached)
    chunkMemoByRef.set(rawStrings, memoByRef)
    return cached
  }

  const template = document.createElement('template')
  template.innerHTML = signature
  const paths = createPaths(template.content)
  const expressions = rawStrings.length - 1
  if (countBindingPaths(paths[0]) !== expressions) {
    throw Error('Invalid HTML position')
  }
  const created = {
    template,
    paths,
    signature,
    expressions,
  }
  memoByRef ??= new WeakMap<Document, ChunkProto>()
  memoByRef.set(doc, created)
  chunkMemoByRef.set(rawStrings, memoByRef)
  signatureMemo[signature] = created
  return created
}

function syncTemplateToChunk(
  template: InternalTemplate,
  chunk: Chunk,
  mounted = false
) {
  if (chunk._t === template) {
    chunk.k = template._k
    chunk.i = template._i
    template._h = chunk
    template._m = mounted
    return
  }
  if (chunk._t && chunk._t !== template) {
    ;(chunk._t as InternalTemplate)._m = false
    ;(chunk._t as InternalTemplate)._h = undefined
  }
  chunk._t = template
  chunk.k = template._k
  chunk.i = template._i
  template._h = chunk
  template._m = mounted
  writeExpressions(template._a!, chunk.e, template._o)
}

function takeChunkRecord(): Chunk {
  if (!chunkPoolHead) growChunkPool(initialChunkPoolSize)
  const chunk = chunkPoolHead!
  chunkPoolHead = chunk.next
  chunk.next = undefined
  return chunk
}

function growChunkPool(size: number) {
  let head: Chunk | undefined
  let tail: Chunk | undefined
  for (let i = 0; i < size; i++) {
    const chunk = {
      paths: [[], []],
      dom: null as unknown as DocumentFragment,
      ref: { f: null, l: null },
      _t: null as unknown as ArrowTemplate,
      e: -1,
      g: '',
      b: false,
      r: true,
      st: false,
      u: null,
      v: null,
      s: undefined,
      k: undefined,
      i: undefined,
      bkn: undefined,
      next: undefined,
    } as Chunk
    if (tail) tail.next = chunk
    else head = chunk
    tail = chunk
  }
  if (tail) tail.next = chunkPoolHead
  chunkPoolHead = head
}

function freeChunk(chunk: Chunk) {
  chunk.next = chunkPoolHead
  chunkPoolHead = chunk
}

function configureChunk(
  chunk: Chunk,
  proto: ChunkProto,
  template: InternalTemplate
) {
  chunk.paths = proto.paths
  chunk.g = proto.signature
  chunk.dom = proto.template.content.cloneNode(true) as DocumentFragment
  chunk.ref.f = chunk.dom.firstChild as ChildNode | null
  chunk.ref.l = chunk.dom.lastChild as ChildNode | null
  chunk.e = createExpressionBlock(proto.expressions)
  chunk.b = false
  chunk.r = true
  chunk.st = false
  chunk.u = null
  chunk.v = null
  chunk.s = undefined
  chunk.bkn = undefined
  syncTemplateToChunk(template, chunk)
}

function acquireChunk(template: InternalTemplate): Chunk {
  const proto = getChunkProto(template)
  const exact = template._i === undefined ? undefined : staleById.get(template._i)
  if (exact && exact.g !== proto.signature) {
    throw Error('shape mismatch')
  }
  if (exact && exact.g === proto.signature && exact.r) {
    removeStaleChunk(exact)
    syncTemplateToChunk(template, exact)
    return exact
  }

  const reused = takeStaleChunk(proto.signature)
  if (reused) {
    syncTemplateToChunk(template, reused)
    return reused
  }

  const chunk = takeChunkRecord()
  configureChunk(chunk, proto, template)
  return chunk
}

function takeStaleChunk(signature: string): Chunk | undefined {
  const bucket = staleBySignature.get(signature)
  const chunk = bucket?.head
  if (!chunk) return
  removeStaleChunk(chunk)
  return chunk
}

function addStaleChunk(chunk: Chunk) {
  if (chunk.st || !chunk.r) return
  chunk.st = true
  const signature = chunk.g
  let bucket = staleBySignature.get(signature)
  if (!bucket) {
    bucket = {}
    staleBySignature.set(signature, bucket)
  }
  chunk.bkn = bucket.head
  bucket.head = chunk

  if (chunk.i !== undefined) staleById.set(chunk.i, chunk)
}

function removeStaleChunk(chunk: Chunk) {
  if (!chunk.st) return
  const bucket = staleBySignature.get(chunk.g)
  if (bucket) {
    let previous: Chunk | undefined
    let current = bucket.head
    while (current && current !== chunk) {
      previous = current
      current = current.bkn
    }
    if (current) {
      if (previous) previous.bkn = current.bkn
      else bucket.head = current.bkn
      if (!bucket.head) staleBySignature.delete(chunk.g)
    }
  }
  if (chunk.i !== undefined && staleById.get(chunk.i) === chunk) {
    staleById.delete(chunk.i)
  }
  chunk.st = false
  chunk.bkn = undefined
}

function dispatchChunkEvent(this: Element, evt: Event) {
  const binding = (this as EventBoundElement)[eventBindingsKey]?.[evt.type]
  if (!binding) return
  const chunk = binding.c
  if (chunk.st || !(chunk._t as InternalTemplate)._m) return
  ;(expressionPool[binding.p] as CallableFunction | undefined)?.(evt)
}

function detachChunkEvents(chunk: Chunk) {
  const events = chunk.v
  if (!events) return
  for (let i = 0; i < events.length; i++) {
    const [target, event] = events[i]
    const bindings = (target as EventBoundElement)[eventBindingsKey]
    if (bindings) {
      delete bindings[event]
      let hasBindings = false
      for (const key in bindings) {
        hasBindings = true
        break
      }
      if (!hasBindings) delete (target as EventBoundElement)[eventBindingsKey]
    }
    target.removeEventListener(event, dispatchChunkEvent)
  }
}

export function html(
  strings: TemplateStringsArray | string[],
  ...expSlots: ArrowExpression[]
): ArrowTemplate
export function html(strings: TemplateStringsArray | string[]): ArrowTemplate {
  const args = arguments
  const template = ((el?: ParentNode) =>
    renderTemplate(template as InternalTemplate, el)) as InternalTemplate
  template.isT = true
  template._a = args
  template._c = ensureChunk
  template._m = false
  template._o = 1
  template._s = strings
  template.key = setTemplateKey
  template.id = setTemplateId
  return template
}

function ensureChunk(this: InternalTemplate) {
  let chunk = this._h
  if (!chunk) {
    chunk = acquireChunk(this)
    this._h = chunk
  }
  return chunk
}

function setTemplateKey(this: InternalTemplate, key: ArrowTemplateKey) {
  this._k = key
  if (this._h) this._h.k = key
  return this
}

function setTemplateId(this: InternalTemplate, id: ArrowTemplateId) {
  this._i = id
  if (this._h) this._h.i = id
  return this
}

function renderTemplate(template: InternalTemplate, el?: ParentNode) {
  const chunk = template._c()
  if (!template._m) {
    template._m = true
    if (!chunk.b) {
      initExpressions(template._a!, chunk.e, template._o)
      return createBindings(chunk, el)
    }
    moveDOMRef(chunk.ref, el ?? chunk.dom)
    return el ?? chunk.dom
  }
  moveDOMRef(chunk.ref, chunk.dom)
  return el ? el.appendChild(chunk.dom) : chunk.dom
}

function createBindings(
  chunk: Chunk,
  el?: ParentNode
): ParentNode | DocumentFragment {
  const expressionPointer = chunk.e
  const totalPaths = expressionPool[expressionPointer] as number
  const [pathTape, attrNames] = chunk.paths
  const stackStart = bindingStackPos + 1
  let tapePos = 0
  nodeStack[0] = chunk.dom
  for (let i = 0; i < totalPaths; i++) {
    const sharedDepth = pathTape[tapePos++]
    let remaining = pathTape[tapePos++]
    let depth = sharedDepth
    let node = nodeStack[depth] as Node
    while (remaining--) {
      node = node.childNodes[pathTape[tapePos++]] as Node
      nodeStack[++depth] = node
    }
    bindingStack[++bindingStackPos] = node
    bindingStack[++bindingStackPos] = pathTape[tapePos++]
  }
  const stackEnd = bindingStackPos
  for (let s = stackStart, e = expressionPointer + 1; s < stackEnd; s++, e++) {
    const node = bindingStack[s] as ChildNode
    const segment = bindingStack[++s] as number
    if (segment) createAttrBinding(node, attrNames[segment - 1], e, chunk)
    else createNodeBinding(node, e, chunk)
  }
  bindingStack.length = stackStart
  bindingStackPos = stackStart - 1
  chunk.b = true
  return el ? el.appendChild(chunk.dom) && el : chunk.dom
}

function createNodeBinding(
  node: ChildNode,
  expressionPointer: number,
  parentChunk: Chunk
) {
  let fragment: DocumentFragment | Text
  const expression = expressionPool[expressionPointer]
  const capture = getHydrationCapture()

  if (isCmp(expression) || isTpl(expression) || Array.isArray(expression)) {
    parentChunk.r = false
    const render = createRenderFn(capture)
    fragment = render(expression)!
    if (capture) {
      registerHydrationHook(parentChunk, (map, visited) => {
        render.adopt(map, visited)
      })
    }
  } else if (typeof expression === 'function') {
    let target: Text | null = null
    let render: RenderController | null = null
    const [frag, stop] = watch(expressionPointer, (value) => {
      if (!render) {
        if (isCmp(value) || isTpl(value) || Array.isArray(value)) {
          parentChunk.r = false
          render = createRenderFn(capture)
          const next = render(value)!
          if (target) {
            target.parentNode?.replaceChild(next, target)
            target = null
          }
          return next
        }
        if (!target) {
          target = document.createTextNode(renderText(value))
          return target
        }
        const next = renderText(value)
        if (target.nodeValue !== next) target.nodeValue = next
        return target
      }
      return render(value)
    })
    ;(parentChunk.u ??= []).push(stop)
    fragment = frag!
    if (capture) {
      registerHydrationHook(parentChunk, (map, visited) => {
        if (target) {
          const adopted = map.get(target)
          if (adopted) target = adopted as Text
        }
        render?.adopt(map, visited)
      })
    }
  } else {
    let target = document.createTextNode(renderText(expression))
    fragment = target
    onExpressionUpdate(
      expressionPointer,
      (value: string) => (target.nodeValue = renderText(value))
    )
    if (capture) {
      registerHydrationHook(parentChunk, (map) => {
        const adopted = map.get(target)
        if (adopted) target = adopted as Text
      })
    }
  }

  if (node === parentChunk.ref.f || node === parentChunk.ref.l) {
    const last =
      fragment.nodeType === 11
        ? (fragment.lastChild as ChildNode | null)
        : (fragment as ChildNode)
    if (node === parentChunk.ref.f) {
      parentChunk.ref.f =
        fragment.nodeType === 11
          ? (fragment.firstChild as ChildNode | null)
          : (fragment as ChildNode)
    }
    if (node === parentChunk.ref.l) parentChunk.ref.l = last
  }

  node.parentNode?.replaceChild(fragment, node)
}

function createAttrBinding(
  node: ChildNode,
  attrName: string,
  expressionPointer: number,
  parentChunk: Chunk
) {
  if (node.nodeType !== 1) return
  let target = node as Element
  const expression = expressionPool[expressionPointer]
  const capture = getHydrationCapture()

  if (attrName[0] === '@') {
    const event = attrName.slice(1)
    const bindings = ((target as EventBoundElement)[eventBindingsKey] ??= {})
    bindings[event] = { c: parentChunk, p: expressionPointer }
    const record: [Element, string] = [target, event]
    target.addEventListener(event, dispatchChunkEvent)
    target.removeAttribute(attrName)
    ;(parentChunk.v ??= []).push(record)
    if (capture) {
      registerHydrationHook(parentChunk, (map) => {
        const adopted = map.get(target)
        if (!adopted) return
        const previousTarget = target as EventBoundElement
        const previousBindings = previousTarget[eventBindingsKey]
        if (previousBindings) {
          delete previousBindings[event]
          let hasBindings = false
          for (const key in previousBindings) {
            hasBindings = true
            break
          }
          if (!hasBindings) delete previousTarget[eventBindingsKey]
        }
        target.removeEventListener(event, dispatchChunkEvent)
        target = adopted as Element
        record[0] = target
        const nextBindings = ((target as EventBoundElement)[eventBindingsKey] ??= {})
        nextBindings[event] = { c: parentChunk, p: expressionPointer }
        target.addEventListener(event, dispatchChunkEvent)
        target.removeAttribute(attrName)
      })
    }
  } else if (typeof expression === 'function' && !isTpl(expression)) {
    const [, stop] = watch(expressionPointer, (value) =>
      setAttr(target, attrName, value as string)
    )
    ;(parentChunk.u ??= []).push(stop)
    if (capture) {
      registerHydrationHook(parentChunk, (map) => {
        const adopted = map.get(target)
        if (adopted) target = adopted as Element
      })
    }
  } else {
    setAttr(target, attrName, expression as string | number | boolean | null)
    onExpressionUpdate(expressionPointer, (value: string) =>
      setAttr(target, attrName, value)
    )
  }
}

function createRenderFn(capture: HydrationCapture | null): RenderController {
  let previous: Chunk | Text | Rendered[]
  const keyedChunks: Record<Exclude<ArrowTemplateKey, undefined>, Chunk> = {}
  let updaterFrag: DocumentFragment | null = null

  const render = function render(
    renderable: ArrowRenderable
  ): DocumentFragment | Text | void {
    if (!previous) {
      if (isCmp(renderable)) {
        const [fragment, chunk] = renderComponent(renderable)
        previous = mountChunkFragment(fragment, chunk)
        return fragment
      }
      if (isTpl(renderable)) {
        const fragment = renderable()
        previous = mountChunkFragment(fragment, renderable._c())
        return fragment
      }
      if (Array.isArray(renderable)) {
        const [fragment, rendered] = renderList(renderable)
        previous = rendered
        return fragment
      }
      return (previous = document.createTextNode(renderText(renderable)))
    }

    if (Array.isArray(renderable)) {
      if (!Array.isArray(previous)) {
        const [fragment, nextList] = renderList(renderable)
        getNode(previous).after(fragment)
        forgetChunk(previous)
        unmount(previous)
        previous = nextList
      } else {
        let i = 0
        const renderableLength = renderable.length
        const previousLength = previous.length
        if (renderableLength && previousLength === 1 && !isChunk(previous[0])) {
          const [fragment, renderedList] = renderList(renderable)
          previous[0].replaceWith(fragment)
          previous = renderedList
          return
        }
        const keyedList = patchKeyedList(renderable, previous)
        if (keyedList) {
          previous = keyedList
          return
        }
        let anchor: ChildNode | undefined
        const renderedList: Rendered[] = []
        const mark = ++renderedMark
        if (renderableLength > previousLength) updaterFrag ??= document.createDocumentFragment()
        for (; i < renderableLength; i++) {
          let item:
            | string
            | number
            | boolean
            | ComponentCall
            | ArrowTemplate = renderable[i] as ArrowTemplate
          const prev = previous[i]
          let key: ArrowTemplateKey
          if (
            isTpl(item) &&
            (key = item._k) !== undefined &&
            key in keyedChunks
          ) {
            const keyedChunk = keyedChunks[key]
            syncTemplateToChunk(item as InternalTemplate, keyedChunk, true)
            item = keyedChunk._t
          }
          if (i > previousLength - 1) {
            renderedList[i] = mountItem(item, updaterFrag!)
            continue
          }
          const used = patch(item, prev, anchor) as Rendered
          anchor = getNode(used)
          renderedList[i] = used
          markRenderedValue(used, mark)
        }
        if (!renderableLength) {
          getNode(previous).after(
            (renderedList[0] = document.createTextNode(''))
          )
          for (i = 0; i < previousLength; i++) forgetChunk(previous[i])
          unmount(previous)
          previous = renderedList
          return
        } else if (renderableLength > previousLength) {
          anchor?.after(updaterFrag!)
        }
        for (i = 0; i < previousLength; i++) {
          const stale = previous[i]
          if (isRenderedValueMarked(stale, mark)) continue
          forgetChunk(stale)
          unmount(stale)
        }
        previous = renderedList
      }
    } else {
      previous = patch(renderable, previous)
    }
  } as RenderController

  render.adopt = (map: NodeMap, visited: WeakSet<Chunk>) => {
    if (!capture) return
    previous = adoptRenderedValue(previous, capture, map, visited) as
      | Chunk
      | Text
      | Rendered[]
  }

  function renderList(
    renderable: Array<string | number | boolean | ComponentCall | ArrowTemplate>,
  ): [DocumentFragment, Rendered[]] {
    const fragment = document.createDocumentFragment()
    if (!renderable.length) {
      const placeholder = document.createTextNode('')
      fragment.appendChild(placeholder)
      return [fragment, [placeholder]]
    }
    const renderedItems: Rendered[] = new Array(renderable.length)
    for (let i = 0; i < renderable.length; i++) {
      renderedItems[i] = mountItem(renderable[i], fragment)
    }
    return [fragment, renderedItems]
  }

  function getRenderableKey(
    renderable: string | number | boolean | ComponentCall | ArrowTemplate
  ): Exclude<ArrowTemplateKey, undefined> | undefined {
    if (isCmp(renderable)) return renderable.k as Exclude<ArrowTemplateKey, undefined> | undefined
    if (isTpl(renderable)) {
      return (renderable as InternalTemplate)._k as
        | Exclude<ArrowTemplateKey, undefined>
        | undefined
    }
    return undefined
  }

  function insertRendered(
    rendered: Rendered,
    parent: Node,
    before: ChildNode | null
  ) {
    if (isChunk(rendered)) {
      moveDOMRef(rendered.ref, parent, before)
      return
    }
    parent.insertBefore(rendered, before)
  }

  function increasingSubsequenceMarks(values: number[]) {
    const length = values.length
    const marks = new Array<boolean>(length).fill(false)
    const predecessors = new Array<number>(length).fill(-1)
    const tails: number[] = []

    for (let i = 0; i < length; i++) {
      const value = values[i]
      if (value < 0) continue
      let low = 0
      let high = tails.length
      while (low < high) {
        const mid = (low + high) >> 1
        if (values[tails[mid]] < value) low = mid + 1
        else high = mid
      }
      if (low > 0) predecessors[i] = tails[low - 1]
      tails[low] = i
    }

    let index = tails[tails.length - 1]
    while (index !== undefined && index >= 0) {
      marks[index] = true
      index = predecessors[index]
    }

    return marks
  }

  function patchKeyedList(
    renderable: Array<string | number | boolean | ComponentCall | ArrowTemplate>,
    previousList: Rendered[]
  ): Rendered[] | null {
    const renderableLength = renderable.length
    const previousLength = previousList.length
    if (!renderableLength) {
      const placeholder = document.createTextNode('')
      getNode(previousList).after(placeholder)
      for (let i = 0; i < previousLength; i++) forgetChunk(previousList[i])
      unmount(previousList)
      return [placeholder]
    }

    const previousByKey = new Map<Exclude<ArrowTemplateKey, undefined>, Chunk>()
    const previousIndexByKey = new Map<Exclude<ArrowTemplateKey, undefined>, number>()
    for (let i = 0; i < previousLength; i++) {
      const rendered = previousList[i]
      if (!isChunk(rendered) || rendered.k === undefined) return null
      if (previousByKey.has(rendered.k as Exclude<ArrowTemplateKey, undefined>)) {
        return null
      }
      previousByKey.set(rendered.k as Exclude<ArrowTemplateKey, undefined>, rendered)
      previousIndexByKey.set(
        rendered.k as Exclude<ArrowTemplateKey, undefined>,
        i
      )
    }

    const nextKeys = new Set<Exclude<ArrowTemplateKey, undefined>>()
    let overlaps = 0
    for (let i = 0; i < renderableLength; i++) {
      const key = getRenderableKey(renderable[i])
      if (key === undefined || nextKeys.has(key)) return null
      nextKeys.add(key)
      if (previousByKey.has(key)) overlaps++
    }
    if (!overlaps) return null

    const renderedList = new Array(renderableLength) as Rendered[]
    const oldIndices = new Array<number>(renderableLength)

    for (let i = 0; i < renderableLength; i++) {
      const item = renderable[i]
      const key = getRenderableKey(item) as Exclude<ArrowTemplateKey, undefined>

      const existing = previousByKey.get(key)
      if (existing) {
        if (isCmp(item)) {
          if (existing.s?.[1] !== item.h) return null
          if (existing.s[0] !== item.p) existing.s[0] = item.p
          if (existing.s[2] !== item.e) existing.s[2] = item.e
        } else if (isTpl(item)) {
          syncTemplateToChunk(item as InternalTemplate, existing, true)
        } else {
          return null
        }
        renderedList[i] = existing
        oldIndices[i] = previousIndexByKey.get(key) as number
      } else {
        if (!isCmp(item) && !isTpl(item)) return null
        const fragment = document.createDocumentFragment()
        renderedList[i] = mountItem(item, fragment)
        oldIndices[i] = -1
      }
    }

    const stay = increasingSubsequenceMarks(oldIndices)
    const parent = getNode(previousList[0]).parentNode
    if (!parent) return null

    let before = getNode(previousList[previousLength - 1]).nextSibling as
      | ChildNode
      | null
    for (let i = renderableLength - 1; i >= 0; i--) {
      const rendered = renderedList[i]
      if (oldIndices[i] === -1 || !stay[i]) {
        insertRendered(rendered, parent, before)
      }
      before = getNode(rendered, undefined, true)
    }

    for (let i = 0; i < previousLength; i++) {
      const stale = previousList[i] as Chunk
      if (nextKeys.has(stale.k as Exclude<ArrowTemplateKey, undefined>)) continue
      forgetChunk(stale)
      unmount(stale)
    }

    return renderedList
  }

  function patch(
    renderable: Exclude<
      ArrowRenderable,
      Array<string | number | boolean | ComponentCall | ArrowTemplate>
    >,
    prev: Chunk | Text | Rendered[],
    anchor?: ChildNode
  ): Chunk | Text | Rendered[] {
    const nodeType = (prev as Node).nodeType ?? 0
    if (isCmp(renderable)) {
      const key = renderable.k
      if (key !== undefined && key in keyedChunks) {
        const keyedChunk = keyedChunks[key]
        if (keyedChunk.s?.[1] === renderable.h) {
          if (keyedChunk.s[0] !== renderable.p) keyedChunk.s[0] = renderable.p
          if (keyedChunk.s[2] !== renderable.e) keyedChunk.s[2] = renderable.e
          if (keyedChunk === prev) return prev
          if (anchor) {
            moveDOMRef(keyedChunk.ref, anchor.parentNode, anchor.nextSibling)
          } else {
            const target = getNode(prev, undefined, true)
            moveDOMRef(keyedChunk.ref, target.parentNode, target)
          }
          return keyedChunk
        }
      } else if (isChunk(prev) && prev.s?.[1] === renderable.h) {
        if (prev.s[0] !== renderable.p) prev.s[0] = renderable.p
        if (prev.s[2] !== renderable.e) prev.s[2] = renderable.e
        if (prev.k !== renderable.k) {
          forgetChunk(prev)
          prev.k = renderable.k
          if (prev.k !== undefined) keyedChunks[prev.k] = prev
        }
        return prev
      }
      const [fragment, chunk] = renderComponent(renderable)
      const mounted = mountChunkFragment(fragment, chunk)
      getNode(prev, anchor).after(fragment)
      forgetChunk(prev)
      unmount(prev)
      if (chunk.k !== undefined) keyedChunks[chunk.k] = chunk
      return mounted
    }
    if (!isTpl(renderable) && nodeType === 3) {
      const value = renderText(renderable)
      if ((prev as Text).data !== value) (prev as Text).data = value
      return prev
    }
    if (isTpl(renderable)) {
      const template = renderable as InternalTemplate
      const key = template._k
      if (key !== undefined && key in keyedChunks) {
        const keyedChunk = keyedChunks[key]
        syncTemplateToChunk(template, keyedChunk, true)
        if (keyedChunk === prev) return prev
        if (anchor) {
          moveDOMRef(keyedChunk.ref, anchor.parentNode, anchor.nextSibling)
        } else {
          const target = getNode(prev, undefined, true)
          moveDOMRef(keyedChunk.ref, target.parentNode, target)
        }
        return keyedChunk
      }
      const proto = getChunkProto(template)
      if (isChunk(prev) && prev.g === proto.signature) {
        syncTemplateToChunk(template, prev, true)
        return prev
      }
      const chunk = template._c()
      const fragment = renderable()
      const mounted = mountChunkFragment(fragment, chunk)
      getNode(prev, anchor).after(fragment)
      forgetChunk(prev)
      unmount(prev)
      if (chunk.k !== undefined) keyedChunks[chunk.k] = chunk
      return mounted
    }
    const text = document.createTextNode(renderText(renderable))
    getNode(prev, anchor).after(text)
    forgetChunk(prev)
    unmount(prev)
    return text
  }

  function mountItem(
    item: string | number | boolean | ComponentCall | ArrowTemplate,
    fragment: DocumentFragment
  ): Rendered {
    if (isCmp(item)) {
      const [inner, chunk] = renderComponent(item)
      fragment.appendChild(inner)
      if (chunk.k !== undefined) keyedChunks[chunk.k] = chunk
      return mountChunkFragment(fragment, chunk)
    }
    if (isTpl(item)) {
      fragment.appendChild(item())
      const chunk = item._c()
      if (chunk.k !== undefined) keyedChunks[chunk.k] = chunk
      return mountChunkFragment(fragment, chunk)
    }
    const node = document.createTextNode(renderText(item))
    fragment.appendChild(node)
    return node
  }

  function mountChunkFragment(fragment: DocumentFragment, chunk: Chunk): Rendered {
    if (chunk.ref.f || chunk.ref.l) return chunk
    const placeholder = document.createTextNode('')
    fragment.appendChild(placeholder)
    return placeholder
  }

  function forgetChunk(item: Chunk | Text | Rendered[] | undefined) {
    if (isChunk(item) && item.k !== undefined && keyedChunks[item.k] === item) {
      delete keyedChunks[item.k]
    }
  }

  function renderComponent(renderable: ComponentCall): [DocumentFragment, Chunk] {
    const [props, emit, box] = createPropsProxy(
      renderable.p,
      renderable.h,
      renderable.e
    )
    const cleanups: Array<() => void> = []
    const previousCollector = swapCleanupCollector(cleanups)
    let template: InternalTemplate
    let fragment: DocumentFragment

    try {
      template = renderable.h(props, emit) as InternalTemplate
      fragment = template() as DocumentFragment
    } finally {
      swapCleanupCollector(previousCollector)
    }

    const chunk = template._c()
    if (cleanups.length) {
      ;(chunk.u ??= []).push(...cleanups)
    }
    chunk.r = false
    chunk.s = box
    chunk.k = renderable.k
    return [fragment, chunk]
  }

  return render
}

let unmountStack: Array<
  | Chunk
  | Text
  | ChildNode
  | Array<Chunk | Text>
> = []

function destroyChunk(chunk: Chunk, detached = false) {
  if (chunk.st) removeStaleChunk(chunk)
  ;(chunk._t as InternalTemplate)._m = false
  ;(chunk._t as InternalTemplate)._h = undefined
  detachChunkEvents(chunk)
  if (chunk.u) {
    for (let i = 0; i < chunk.u.length; i++) chunk.u[i]()
    chunk.u = null
  }
  if (chunk.e + 1) {
    releaseExpressions(chunk.e)
    chunk.e = -1
  }
  let node = chunk.ref.f
  if (!detached && node) {
    const last = chunk.ref.l
    if (node === last) node.remove()
    else {
      while (node) {
        const next: ChildNode | null =
          node === last ? null : (node.nextSibling as ChildNode | null)
        node.remove()
        if (!next) break
        node = next
      }
    }
  }
  chunk.dom.textContent = ''
  chunk.ref.f = null
  chunk.ref.l = null
  chunk.k = undefined
  chunk.i = undefined
  chunk.s = undefined
  chunk.v = null
  chunk.b = false
  chunk.r = true
  chunk.g = ''
  freeChunk(chunk)
}

function recycleChunk(chunk: Chunk, detached = false) {
  if (!detached) moveDOMRef(chunk.ref, chunk.dom)
  ;(chunk._t as InternalTemplate)._m = false
  ;(chunk._t as InternalTemplate)._h = undefined
  addStaleChunk(chunk)
}

let unmountQueued = false

function removeUnmounted(
  chunk:
    | Chunk
    | Text
    | ChildNode
    | Array<Chunk | Text>,
  detached = false
) {
  if (isChunk(chunk)) {
    if (chunk.r) recycleChunk(chunk, detached)
    else destroyChunk(chunk, detached)
    return
  }
  if (Array.isArray(chunk)) {
    if (!detached && chunk.length) {
      const first = getNode(chunk[0], undefined, true)
      const last = getNode(chunk[chunk.length - 1])
      const parent = first.parentNode
      if (parent) {
        const range = document.createRange()
        range.setStartBefore(first)
        range.setEndAfter(last)
        range.deleteContents()
        detached = true
      }
    }
    for (let i = 0; i < chunk.length; i++) {
      const item = chunk[i]
      if (isChunk(item)) {
        if (item.r) recycleChunk(item, detached)
        else destroyChunk(item, detached)
      } else if (!detached) {
        item.remove()
      }
    }
    return
  }
  if (!detached) chunk.remove()
}

function drainUnmountStack() {
  unmountQueued = false
  const stack = unmountStack
  unmountStack = []
  for (let i = 0; i < stack.length; i++) removeUnmounted(stack[i])
  if (unmountStack.length) scheduleUnmountDrain()
}

function scheduleUnmountDrain() {
  if (unmountQueued) return
  unmountQueued = true
  queueMicrotask(drainUnmountStack)
}

function unmount(
  chunk:
    | Chunk
    | Text
    | ChildNode
    | Array<Chunk | Text>
    | undefined
) {
  if (!chunk) return
  unmountStack.push(chunk)
  scheduleUnmountDrain()
}

function isEmpty(value: unknown): value is null | undefined | '' | false {
  return !value && value !== 0
}

function renderText(value: unknown) {
  return isEmpty(value) ? '' : (value as string)
}

function getNode(
  chunk: Chunk | Text | Array<Chunk | Text> | undefined,
  anchor?: ChildNode,
  first?: boolean
): ChildNode {
  if (!chunk && anchor) return anchor
  if (isChunk(chunk)) {
    return first ? chunk.ref.f || chunk.ref.l! : chunk.ref.l || chunk.ref.f || anchor!
  }
  if (Array.isArray(chunk)) {
    return getNode(chunk[first ? 0 : chunk.length - 1], anchor, first)
  }
  return chunk!
}

function adoptRenderedValue(
  value: Chunk | Text | Rendered[] | undefined,
  capture: HydrationCapture,
  map: NodeMap,
  visited: WeakSet<Chunk>
): Chunk | Text | Rendered[] | undefined {
  if (!value) return value
  if (isChunk(value)) {
    adoptCapturedChunk(capture, value, map, visited)
    return value
  }
  if (Array.isArray(value)) {
    const next = new Array(value.length) as Rendered[]
    for (let i = 0; i < value.length; i++) {
      next[i] = adoptRenderedValue(value[i], capture, map, visited) as Rendered
    }
    return next
  }
  return (map.get(value) as Text | undefined) ?? value
}

function createPaths(dom: DocumentFragment): Chunk['paths'] {
  const pathTape: number[] = []
  const attrNames: string[] = []
  const path: number[] = []
  const previous: number[] = []
  const pushPath = (attrName?: string) => {
    const pathLen = path.length
    const previousLen = previous.length
    const limit = pathLen < previousLen ? pathLen : previousLen
    let sharedDepth = 0
    while (sharedDepth < limit && previous[sharedDepth] === path[sharedDepth]) {
      sharedDepth++
    }
    pathTape.push(sharedDepth, pathLen - sharedDepth)
    for (let i = sharedDepth; i < pathLen; i++) pathTape.push(path[i])
    pathTape.push(attrName ? attrNames.push(attrName) : 0)
    previous.length = pathLen
    for (let i = 0; i < pathLen; i++) previous[i] = path[i]
  }
  const walk = (node: Node) => {
    if (node.nodeType === 1) {
      const attrs = (node as Element).attributes
      for (let i = 0; i < attrs.length; i++) {
        const attr = attrs[i]
        if (attr.value === delimiterComment) pushPath(attr.name)
      }
    } else if (node.nodeType === 8) {
      pushPath()
    } else if (node.nodeType === 3 && node.nodeValue === delimiterComment) {
      pushPath()
    }
    const children = node.childNodes
    for (let i = 0; i < children.length; i++) {
      path.push(i)
      walk(children[i])
      path.pop()
    }
  }
  const children = dom.childNodes
  for (let i = 0; i < children.length; i++) {
    path.push(i)
    walk(children[i])
    path.pop()
  }
  return [pathTape, attrNames]
}

function countBindingPaths(pathTape: number[]) {
  let count = 0
  for (let i = 0; i < pathTape.length;) {
    const remaining = pathTape[i + 1] ?? 0
    i += remaining + 3
    count++
  }
  return count
}
