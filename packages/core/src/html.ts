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
  readonly g: string
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
  _p?: ChunkProto
  _s?: TemplateStringsArray | string[]
}

interface StaleBucket {
  h?: Chunk
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
  while (true) {
    const next: ChildNode | null =
      node === last ? null : (node.nextSibling as ChildNode | null)
    parent.insertBefore(node, before || null)
    if (!next) return
    node = next
  }
}

function canSyncTemplateChunk(template: InternalTemplate, chunk: Chunk) {
  return chunk.g === getChunkProto(template).g
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
  normalizeNodePlaceholders(template.content)
  const expressions = rawStrings.length - 1
  let count = 0
  for (let i = 0; i < paths[0].length;) {
    i += (paths[0][i + 1] ?? 0) + 3
    count++
  }
  if (count !== expressions) {
    throw Error('Invalid HTML position')
  }
  const created = {
    template,
    paths,
    g: signature,
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
  writeExpressions(template._a!, chunk.e)
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
  chunk.g = proto.g
  chunk.dom = proto.template.content.cloneNode(true) as DocumentFragment
  chunk.ref.f = chunk.dom.firstChild as ChildNode | null
  chunk.ref.l = chunk.dom.lastChild as ChildNode | null
  chunk.e = createExpressionBlock(proto.expressions)
  chunk.b = chunk.st = false
  chunk.r = true
  chunk.u = chunk.v = null
  chunk.s = chunk.bkn = undefined
  syncTemplateToChunk(template, chunk)
}

function acquireChunk(template: InternalTemplate): Chunk {
  const proto = getChunkProto(template)
  const exact = staleById.get(template._i as Exclude<ArrowTemplateId, undefined>)
  if (exact) {
    if (exact.g !== proto.g) throw Error('shape mismatch')
    if (exact.r) {
      removeStaleChunk(exact)
      syncTemplateToChunk(template, exact)
      return exact
    }
  }

  const bucket = staleBySignature.get(proto.g)
  const reused = bucket?.h
  if (reused) {
    removeStaleChunk(reused)
    syncTemplateToChunk(template, reused)
    return reused
  }

  if (!chunkPoolHead) growChunkPool(initialChunkPoolSize)
  const chunk = chunkPoolHead!
  chunkPoolHead = chunk.next
  chunk.next = undefined
  configureChunk(chunk, proto, template)
  return chunk
}

function removeStaleChunk(chunk: Chunk) {
  if (!chunk.st) return
  const bucket = staleBySignature.get(chunk.g)
  if (bucket) {
    let previous: Chunk | undefined
    let current = bucket.h
    while (current && current !== chunk) {
      previous = current
      current = current.bkn
    }
    if (current) {
      if (previous) previous.bkn = current.bkn
      else bucket.h = current.bkn
      if (!bucket.h) staleBySignature.delete(chunk.g)
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
  if (!(chunk._t as InternalTemplate)._m) return
  ;(expressionPool[binding.p] as CallableFunction | undefined)?.(evt)
}

function getRenderableKey(
  renderable: ComponentCall | ArrowTemplate
): Exclude<ArrowTemplateKey, undefined> | undefined {
  return (isCmp(renderable)
    ? renderable.k
    : (renderable as InternalTemplate)._k) as
    | Exclude<ArrowTemplateKey, undefined>
    | undefined
}

export function html(
  strings: TemplateStringsArray | string[],
  ...expSlots: ArrowExpression[]
): ArrowTemplate
export function html(
  strings: TemplateStringsArray | string[],
  ...expSlots: ArrowExpression[]
): ArrowTemplate {
  const template = ((el?: ParentNode) =>
    renderTemplate(template as InternalTemplate, el)) as InternalTemplate
  template.isT = true
  template._a = expSlots
  template._c = ensureChunk
  template._m = false
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
  const textNode = node.nodeType === 3 ? (node as Text) : null

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
    let target: Text | null = textNode
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
        if (!target) target = document.createTextNode('')
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
    let target = textNode ?? document.createTextNode('')
    target.data = renderText(expression)
    fragment = target
    if (capture) {
      onExpressionUpdate(
        expressionPointer,
        (value: string) => (target.data = renderText(value))
      )
      registerHydrationHook(parentChunk, (map) => {
        const adopted = map.get(target)
        if (adopted) target = adopted as Text
      })
    } else {
      onExpressionUpdate(expressionPointer, target)
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

  if (fragment !== node) node.parentNode?.replaceChild(fragment, node)
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
    if (capture) {
      onExpressionUpdate(expressionPointer, (value: string) =>
        setAttr(target, attrName, value)
      )
    } else {
      onExpressionUpdate(expressionPointer, target, attrName)
    }
  }
}

function createRenderFn(capture: HydrationCapture | null): RenderController {
  let previous: Chunk | Text | Rendered[]
  let keyedChunks = Object.create(null) as Record<
    Exclude<ArrowTemplateKey, undefined>,
    Chunk
  >

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
        if (
          renderableLength &&
          previousLength === 1 &&
          !isChunk(previous[0]) &&
          !(previous[0] as Text).data
        ) {
          const [fragment, rendered] = renderList(renderable)
          ;(previous[0] as Text).replaceWith(fragment)
          previous = rendered
          return
        }
        if (renderableLength === previousLength) {
          const renderedList = new Array(renderableLength) as Rendered[]
          for (; i < renderableLength; i++) {
            const item = renderable[i] as
              | string
              | number
              | boolean
              | ComponentCall
              | ArrowTemplate
            if ((isCmp(item) && item.k !== undefined) || (isTpl(item) && item._k !== undefined)) {
              i = -1
              break
            }
            const prev = previous[i]
            if (
              isTpl(item) &&
              isChunk(prev) &&
              prev._t === item &&
              (item as InternalTemplate)._h === prev &&
              (item as InternalTemplate)._m
            ) {
              renderedList[i] = prev
              continue
            }
            if (isTpl(item) && isChunk(prev)) {
              const proto = item._p ?? getChunkProto(item as InternalTemplate)
              if (prev.g === proto.g) {
                syncTemplateToChunk(item as InternalTemplate, prev, true)
                renderedList[i] = prev
                continue
              }
            }
            renderedList[i] = patch(item, prev) as Rendered
          }
          if (i === renderableLength) {
            previous = renderedList
            return
          }
          i = 0
        }
        const keyedList = patchKeyedList(renderable, previous)
        if (keyedList) {
          previous = keyedList
          return
        }
        if (renderableLength > previousLength && previousLength) {
          for (; i < previousLength; i++) {
            const item = renderable[i] as ArrowTemplate
            const prev = previous[i]
            if (
              isTpl(item) &&
              isChunk(prev) &&
              prev._t === item &&
              (item as InternalTemplate)._h === prev &&
              (item as InternalTemplate)._m
            ) {
              continue
            }
            i = -1
            break
          }
          if (i === previousLength) {
            const fragment = document.createDocumentFragment()
            const renderedList = previous.slice() as Rendered[]
            for (i = previousLength; i < renderableLength; i++) {
              renderedList[i] = mountItem(renderable[i], fragment)
            }
            getNode(previous[previousLength - 1]).after(fragment)
            previous = renderedList
            return
          }
          i = 0
        }
        let anchor: ChildNode | undefined
        const renderedList: Rendered[] = []
        const mark = ++renderedMark
        const updaterFrag =
          renderableLength > previousLength
            ? document.createDocumentFragment()
            : null
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
            if (canSyncTemplateChunk(item as InternalTemplate, keyedChunk)) {
              syncTemplateToChunk(item as InternalTemplate, keyedChunk, true)
              item = keyedChunk._t
            }
          }
          if (i > previousLength - 1) {
            renderedList[i] = mountItem(item, updaterFrag!)
            continue
          }
          if (
            isTpl(item) &&
            isChunk(prev) &&
            prev._t === item &&
            (item as InternalTemplate)._h === prev &&
            (item as InternalTemplate)._m
          ) {
            anchor = getNode(prev)
            renderedList[i] = prev
            ;(prev as Rendered & { mk?: number }).mk = mark
            continue
          }
          const used = patch(item, prev, anchor) as Rendered
          anchor = getNode(used)
          renderedList[i] = used
          ;(used as Rendered & { mk?: number }).mk = mark
        }
        if (!renderableLength) {
          const placeholder = (renderedList[0] = document.createTextNode(''))
          const sync = canSyncUnmount(previous)
          const detached = sync && replaceListWithPlaceholder(previous, placeholder)
          if (!detached) getNode(previous).after(placeholder)
          keyedChunks = Object.create(null)
          if (sync) removeUnmounted(previous, detached)
          else unmount(previous)
          previous = renderedList
          return
        } else if (renderableLength > previousLength) {
          anchor?.after(updaterFrag!)
        }
        for (i = 0; i < previousLength; i++) {
          const stale = previous[i]
          if ((stale as Rendered & { mk?: number }).mk === mark) continue
          forgetChunk(stale)
          unmount(stale)
        }
        previous = renderedList
      }
    } else {
      if (Array.isArray(previous)) keyedChunks = Object.create(null)
      previous = patch(renderable, previous)
    }
  } as RenderController

  render.adopt = capture
    ? (map: NodeMap, visited: WeakSet<Chunk>) => {
        previous = adoptRenderedValue(previous, capture, map, visited) as
          | Chunk
          | Text
          | Rendered[]
      }
    : () => {}

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

  function syncComponentChunk(renderable: ComponentCall, chunk: Chunk) {
    if (chunk.s?.[1] !== renderable.h) return false
    if (chunk.s[0] !== renderable.p) chunk.s[0] = renderable.p
    if (chunk.s[2] !== renderable.e) chunk.s[2] = renderable.e
    return true
  }

  function syncKeyedRenderable(
    renderable: ComponentCall | ArrowTemplate,
    chunk: Chunk
  ) {
    if (isCmp(renderable)) return syncComponentChunk(renderable, chunk)
    if (!canSyncTemplateChunk(renderable as InternalTemplate, chunk)) return false
    syncTemplateToChunk(renderable as InternalTemplate, chunk, true)
    return true
  }

  function moveChunkIntoPlace(
    chunk: Chunk,
    prev: Chunk | Text | Rendered[],
    anchor?: ChildNode
  ) {
    if (anchor) {
      moveDOMRef(chunk.ref, anchor.parentNode, anchor.nextSibling)
      return
    }
    const target = getNode(prev, undefined, true)
    moveDOMRef(chunk.ref, target.parentNode, target)
  }

  function patchKeyedList(
    renderable: Array<string | number | boolean | ComponentCall | ArrowTemplate>,
    previousList: Rendered[]
  ): Rendered[] | null {
    const renderableLength = renderable.length
    const previousLength = previousList.length
    if (!renderableLength) {
      const placeholder = document.createTextNode('')
      const sync = canSyncUnmount(previousList)
      const detached =
        sync && replaceListWithPlaceholder(previousList, placeholder)
      if (!detached) getNode(previousList).after(placeholder)
      keyedChunks = Object.create(null)
      if (sync) removeUnmounted(previousList, detached)
      else unmount(previousList)
      return [placeholder]
    }

    const renderedList = new Array(renderableLength) as Rendered[]
    const parent = getNode(previousList[0]).parentNode
    if (!parent) return null

    let sharedPrefix = 0
    const sharedPrefixKeys = Object.create(null) as Record<
      Exclude<ArrowTemplateKey, undefined>,
      1
    >
    for (; sharedPrefix < previousLength && sharedPrefix < renderableLength; sharedPrefix++) {
      const rendered = previousList[sharedPrefix]
      if (!isChunk(rendered) || rendered.k === undefined) return null
      const item = renderable[sharedPrefix]
      if (!isCmp(item) && !isTpl(item)) return null
      const key = getRenderableKey(item)
      if (key === undefined || key !== rendered.k) break
      sharedPrefixKeys[key] = 1
      if (
        !(
          isTpl(item) &&
          rendered._t === item &&
          (item as InternalTemplate)._h === rendered &&
          (item as InternalTemplate)._m
        ) &&
        !syncKeyedRenderable(item, rendered)
      ) {
        return null
      }
      renderedList[sharedPrefix] = rendered
    }
    if (sharedPrefix === previousLength) {
      if (sharedPrefix === renderableLength) return renderedList
      const fragment = document.createDocumentFragment()
      for (let i = sharedPrefix; i < renderableLength; i++) {
        const item = renderable[i]
        if (!isCmp(item) && !isTpl(item)) return null
        const key = getRenderableKey(item)
        if (key === undefined || key in sharedPrefixKeys) return null
        sharedPrefixKeys[key] = 1
        renderedList[i] = mountItem(item, fragment)
      }
      parent.insertBefore(
        fragment,
        previousLength
          ? (getNode(previousList[previousLength - 1]).nextSibling as ChildNode | null)
          : null
      )
      return renderedList
    }
    if (sharedPrefix === renderableLength) {
      for (let i = sharedPrefix; i < previousLength; i++) {
        const stale = previousList[i]
        forgetChunk(stale)
        unmount(stale)
      }
      return renderedList
    }

    let oldStart = sharedPrefix
    let newStart = sharedPrefix
    let oldEnd = previousLength - 1
    let newEnd = renderableLength - 1

    while (oldStart <= oldEnd && newStart <= newEnd) {
      const startChunk = previousList[oldStart] as Chunk
      const endChunk = previousList[oldEnd] as Chunk
      const startKey = startChunk.k as Exclude<ArrowTemplateKey, undefined>
      const endKey = endChunk.k as Exclude<ArrowTemplateKey, undefined>
      const nextStart = renderable[newStart]
      const nextEnd = renderable[newEnd]
      const nextStartKey =
        isCmp(nextStart) || isTpl(nextStart)
          ? getRenderableKey(nextStart)
          : undefined
      const nextEndKey =
        isCmp(nextEnd) || isTpl(nextEnd) ? getRenderableKey(nextEnd) : undefined
      if (nextStartKey === undefined || nextEndKey === undefined) return null

      if (startKey === nextStartKey) {
        if (
          !(
            isTpl(nextStart) &&
            startChunk._t === nextStart &&
            (nextStart as InternalTemplate)._h === startChunk &&
            (nextStart as InternalTemplate)._m
          ) &&
          !syncKeyedRenderable(nextStart as ComponentCall | ArrowTemplate, startChunk)
        ) {
          return null
        }
        renderedList[newStart++] = startChunk
        oldStart++
        continue
      }
      if (endKey === nextEndKey) {
        if (
          !(
            isTpl(nextEnd) &&
            endChunk._t === nextEnd &&
            (nextEnd as InternalTemplate)._h === endChunk &&
            (nextEnd as InternalTemplate)._m
          ) &&
          !syncKeyedRenderable(nextEnd as ComponentCall | ArrowTemplate, endChunk)
        ) {
          return null
        }
        renderedList[newEnd--] = endChunk
        oldEnd--
        continue
      }
      if (startKey === nextEndKey) {
        if (
          !(
            isTpl(nextEnd) &&
            startChunk._t === nextEnd &&
            (nextEnd as InternalTemplate)._h === startChunk &&
            (nextEnd as InternalTemplate)._m
          ) &&
          !syncKeyedRenderable(nextEnd as ComponentCall | ArrowTemplate, startChunk)
        ) {
          return null
        }
        moveDOMRef(
          startChunk.ref,
          parent,
          getNode(endChunk).nextSibling as ChildNode | null
        )
        renderedList[newEnd--] = startChunk
        oldStart++
        continue
      }
      if (endKey === nextStartKey) {
        if (
          !(
            isTpl(nextStart) &&
            endChunk._t === nextStart &&
            (nextStart as InternalTemplate)._h === endChunk &&
            (nextStart as InternalTemplate)._m
          ) &&
          !syncKeyedRenderable(nextStart as ComponentCall | ArrowTemplate, endChunk)
        ) {
          return null
        }
        moveDOMRef(endChunk.ref, parent, getNode(startChunk, undefined, true))
        renderedList[newStart++] = endChunk
        oldEnd--
        continue
      }
      break
    }

    if (newStart > newEnd) {
      for (let i = oldStart; i <= oldEnd; i++) {
        const stale = previousList[i]
        forgetChunk(stale)
        unmount(stale)
      }
      return renderedList
    }

    if (oldStart > oldEnd) {
      const fragment = document.createDocumentFragment()
      for (let i = newStart; i <= newEnd; i++) {
        const item = renderable[i]
        if (!isCmp(item) && !isTpl(item)) return null
        renderedList[i] = mountItem(item, fragment)
      }
      parent.insertBefore(
        fragment,
        newEnd + 1 < renderableLength
          ? getNode(renderedList[newEnd + 1], undefined, true)
          : null
      )
      return renderedList
    }

    const previousIndexByKey = Object.create(null) as Record<
      Exclude<ArrowTemplateKey, undefined>,
      number
    >
    for (let i = oldStart; i <= oldEnd; i++) {
      const rendered = previousList[i]
      if (!isChunk(rendered) || rendered.k === undefined) return null
      const key = rendered.k as Exclude<ArrowTemplateKey, undefined>
      if (key in previousIndexByKey) return null
      previousIndexByKey[key] = i + 1
    }

    const middleIndexByKey = Object.create(null) as Record<
      Exclude<ArrowTemplateKey, undefined>,
      number
    >
    let overlaps = 0
    for (let i = newStart; i <= newEnd; i++) {
      const item = renderable[i]
      const key =
        isCmp(item) || isTpl(item) ? getRenderableKey(item) : undefined
      if (key === undefined || key in middleIndexByKey) return null
      middleIndexByKey[key] = i + 1
      if (key in previousIndexByKey) overlaps++
    }
    if (!overlaps) return null

    for (let i = oldStart; i <= oldEnd; i++) {
      const stale = previousList[i] as Chunk
      const nextIndex = middleIndexByKey[stale.k as Exclude<ArrowTemplateKey, undefined>]
      if (nextIndex === undefined) {
        forgetChunk(stale)
        unmount(stale)
        continue
      }
      const item = renderable[nextIndex - 1] as ComponentCall | ArrowTemplate
      if (!syncKeyedRenderable(item, stale)) return null
      renderedList[nextIndex - 1] = stale
    }

    let before =
      newEnd + 1 < renderableLength
        ? getNode(renderedList[newEnd + 1], undefined, true)
        : (getNode(previousList[previousLength - 1]).nextSibling as
            | ChildNode
            | null)
    for (let i = newEnd; i >= newStart; i--) {
      const existing = renderedList[i]
      if (!existing) {
        const item = renderable[i]
        if (!isCmp(item) && !isTpl(item)) return null
        const fragment = document.createDocumentFragment()
        const mounted = mountItem(item, fragment)
        renderedList[i] = mounted
        parent.insertBefore(fragment, before)
        before = getNode(mounted, undefined, true)
        continue
      }
      const start = getNode(existing, undefined, true)
      if (start.parentNode !== parent || start.nextSibling !== before) {
        moveDOMRef((existing as Chunk).ref, parent, before)
      }
      before = start
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
        if (syncComponentChunk(renderable, keyedChunk)) {
          if (keyedChunk === prev) return prev
          moveChunkIntoPlace(keyedChunk, prev, anchor)
          return keyedChunk
        }
      } else if (isChunk(prev) && syncComponentChunk(renderable, prev)) {
        if (prev.k !== renderable.k) {
          forgetChunk(prev)
          prev.k = renderable.k
          rememberKeyedChunk(prev)
        }
        return prev
      }
      const [fragment, chunk] = renderComponent(renderable)
      const mounted = mountChunkFragment(fragment, chunk)
      getNode(prev, anchor).after(fragment)
      forgetChunk(prev)
      unmount(prev)
      rememberKeyedChunk(chunk)
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
        if (canSyncTemplateChunk(template, keyedChunk)) {
          syncTemplateToChunk(template, keyedChunk, true)
          if (keyedChunk === prev) return prev
          moveChunkIntoPlace(keyedChunk, prev, anchor)
          return keyedChunk
        }
      }
      const proto = getChunkProto(template)
      if (isChunk(prev) && prev.g === proto.g) {
        syncTemplateToChunk(template, prev, true)
        return prev
      }
      const chunk = template._c()
      const fragment = renderable()
      const mounted = mountChunkFragment(fragment, chunk)
      getNode(prev, anchor).after(fragment)
      forgetChunk(prev)
      unmount(prev)
      rememberKeyedChunk(chunk)
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
      rememberKeyedChunk(chunk)
      return mountChunkFragment(fragment, chunk)
    }
    if (isTpl(item)) {
      item(fragment)
      const chunk = item._c()
      rememberKeyedChunk(chunk)
      return mountChunkFragment(fragment, chunk)
    }
    const node = document.createTextNode(renderText(item))
    fragment.appendChild(node)
    return node
  }

  function mountChunkFragment(fragment: DocumentFragment, chunk: Chunk): Rendered {
    if (chunk.ref.f) return chunk
    const placeholder = document.createTextNode('')
    fragment.appendChild(placeholder)
    return placeholder
  }

  function rememberKeyedChunk(chunk: Chunk) {
    if (chunk.k !== undefined) keyedChunks[chunk.k] = chunk
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
  if (chunk.v) {
    for (let i = 0; i < chunk.v.length; i++) {
      const [target, event] = chunk.v[i]
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
  chunk.ref.f = chunk.ref.l = null
  chunk.k = chunk.i = chunk.s = undefined
  chunk.u = chunk.v = null
  chunk.b = chunk.st = false
  chunk.r = true
  chunk.g = ''
  freeChunk(chunk)
}

function recycleChunk(chunk: Chunk, detached = false) {
  if (!detached) moveDOMRef(chunk.ref, chunk.dom)
  ;(chunk._t as InternalTemplate)._m = false
  ;(chunk._t as InternalTemplate)._h = undefined
  if (chunk.st || !chunk.r) return
  chunk.st = true
  let bucket = staleBySignature.get(chunk.g)
  if (!bucket) {
    bucket = {}
    staleBySignature.set(chunk.g, bucket)
  }
  chunk.bkn = bucket.h
  bucket.h = chunk
  if (chunk.i !== undefined) staleById.set(chunk.i, chunk)
}

let unmountQueued = false

function canSyncUnmount(chunk: Array<Chunk | Text>) {
  for (let i = 0; i < chunk.length; i++) {
    const item = chunk[i]
    if (isChunk(item) && !item.r) return false
  }
  return true
}

function replaceListWithPlaceholder(
  chunk: Array<Chunk | Text>,
  placeholder: Text
) {
  if (!chunk.length) return false
  const first = getNode(chunk[0], undefined, true)
  const last = getNode(chunk[chunk.length - 1])
  const parent = first.parentNode
  if (!parent || first !== parent.firstChild || last !== parent.lastChild) {
    return false
  }
  parent.replaceChildren(placeholder)
  return true
}

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
        if (first === parent.firstChild && last === parent.lastChild) {
          parent.textContent = ''
        } else {
          const range = document.createRange()
          range.setStartBefore(first)
          range.setEndAfter(last)
          range.deleteContents()
        }
        detached = true
      }
    }
    let bucket: StaleBucket | undefined
    let signature = ''
    for (let i = 0; i < chunk.length; i++) {
      const item = chunk[i]
      if (isChunk(item)) {
        if (!item.r) {
          destroyChunk(item, detached)
          continue
        }
        if (!detached) moveDOMRef(item.ref, item.dom)
        ;(item._t as InternalTemplate)._m = false
        ;(item._t as InternalTemplate)._h = undefined
        if (item.st) continue
        item.st = true
        if (signature !== item.g) {
          signature = item.g
          bucket = staleBySignature.get(signature)
          if (!bucket) {
            bucket = {}
            staleBySignature.set(signature, bucket)
          }
        }
        item.bkn = bucket!.h
        bucket!.h = item
        if (item.i !== undefined) staleById.set(item.i, item)
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

function renderText(value: unknown) {
  return value || value === 0 ? (value as string) : ''
}

function getNode(
  chunk: Chunk | Text | Array<Chunk | Text>,
  anchor?: ChildNode,
  first?: boolean
): ChildNode {
  if (isChunk(chunk)) {
    return first ? chunk.ref.f! : chunk.ref.l!
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

function normalizeNodePlaceholders(dom: DocumentFragment) {
  const walk = (node: Node) => {
    const children = node.childNodes
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      if (child.nodeType === 8 && (child as Comment).data === delimiter) {
        node.replaceChild(document.createTextNode(''), child)
        continue
      }
      if (child.nodeType === 3 && child.nodeValue === delimiterComment) {
        child.nodeValue = ''
      }
      if (child.firstChild) walk(child)
    }
  }
  walk(dom)
}
