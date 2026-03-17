import { watch } from './reactive'
import { isChunk, isTpl, queue, swapCleanupCollector } from './common'
import { setAttr } from './dom'
import { createPool } from './pool'
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
  _e: number
  _k: ArrowTemplateKey
  _i?: ArrowTemplateId
}

type ArrowTemplateKey = string | number | undefined
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
  sqp?: Chunk
  sqn?: Chunk
  bkp?: Chunk
  bkn?: Chunk
  bp?: StaleBucket
  v?: Array<[Element, string, EventListener]> | null
  u?: Array<() => void> | null
  s?: ReturnType<typeof createPropsProxy>[1]
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

type Rendered = Chunk | Text
type RenderController = ((
  renderable: ArrowRenderable
) => DocumentFragment | Text | void) & {
  adopt: (map: NodeMap, visited: WeakSet<Chunk>) => void
}
type InternalTemplate = ArrowTemplate & {
  d?: () => void
  x?: () => void
  _a?: ArrowExpression[]
  _h?: Chunk
  _m?: boolean
  _p?: ChunkProto
  _s?: TemplateStringsArray | string[]
}

interface StaleBucket {
  head?: Chunk
  tail?: Chunk
}

let bindingStackPos = -1
const bindingStack: Array<Node | number> = []
const nodeStack: Node[] = []

const delimiter = '¤'
const delimiterComment = `<!--${delimiter}-->`
const initialChunkPoolSize = 1024
const staleChunkSoftCap = 8192

const chunkMemo: Record<string, ChunkProto> = {}
const chunkMemoByRef = new WeakMap<ReadonlyArray<string>, ChunkProto>()
const staleById = new Map<Exclude<ArrowTemplateId, undefined>, Chunk>()
const staleBySignature = new Map<string, StaleBucket>()
const chunkPool = createPool<Chunk, []>(
  initialChunkPoolSize,
  () => ({
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
    sqp: undefined,
    sqn: undefined,
    bkp: undefined,
    bkn: undefined,
    bp: undefined,
    next: undefined,
  }),
  function allocate() {
    return this.next()
  }
)
let staleHead: Chunk | undefined
let staleTail: Chunk | undefined
let staleChunkCount = 0

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

function getChunkProto(template: InternalTemplate): ChunkProto {
  const cached = template._p
  if (cached) return cached
  return (template._p = resolveChunkProto(template._s as string[]))
}

function resolveChunkProto(rawStrings: TemplateStringsArray | string[]): ChunkProto {
  const cachedByRef = chunkMemoByRef.get(rawStrings)
  if (cachedByRef) return cachedByRef

  const signature = rawStrings.join(delimiterComment)
  const cached = chunkMemo[signature]
  if (cached) {
    chunkMemoByRef.set(rawStrings, cached)
    return cached
  }

  const template = document.createElement('template')
  template.innerHTML = signature
  const created = {
    template,
    paths: createPaths(template.content),
    signature,
    expressions: rawStrings.length - 1,
  }
  chunkMemoByRef.set(rawStrings, created)
  chunkMemo[signature] = created
  return created
}

function syncTemplateToChunk(
  template: InternalTemplate,
  chunk: Chunk,
  mounted = false
) {
  if (chunk._t && chunk._t !== template) (chunk._t as InternalTemplate).d?.()
  chunk._t = template
  chunk.k = template._k
  chunk.i = template._i
  template._h = chunk
  template._m = mounted
  template._e = chunk.e
  writeExpressions(template._a!, chunk.e)
}

function takeChunkRecord(): Chunk {
  return chunkPool.allocate()
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
  chunk.bp = undefined
  chunk.bkp = undefined
  chunk.bkn = undefined
  chunk.sqp = undefined
  chunk.sqn = undefined
  syncTemplateToChunk(template, chunk)
}

function acquireChunk(template: InternalTemplate): Chunk {
  const proto = getChunkProto(template)
  const exact = template._i === undefined ? undefined : staleById.get(template._i)
  if (exact && exact.g !== proto.signature) {
    throw new Error(`Template id "${template._i}" was reused with a different static signature.`)
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
  let chunk = bucket?.head
  while (chunk && !chunk.st) chunk = chunk.bkn
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
  chunk.bp = bucket
  chunk.bkp = bucket.tail
  chunk.bkn = undefined
  if (bucket.tail) bucket.tail.bkn = chunk
  else bucket.head = chunk
  bucket.tail = chunk

  chunk.sqp = staleTail
  chunk.sqn = undefined
  if (staleTail) staleTail.sqn = chunk
  else staleHead = chunk
  staleTail = chunk

  if (chunk.i !== undefined) staleById.set(chunk.i, chunk)
  staleChunkCount++
  trimStaleChunks()
}

function removeStaleChunk(chunk: Chunk) {
  if (!chunk.st) return
  const bucket = chunk.bp
  if (bucket) {
    if (chunk.bkp) chunk.bkp.bkn = chunk.bkn
    else bucket.head = chunk.bkn
    if (chunk.bkn) chunk.bkn.bkp = chunk.bkp
    else bucket.tail = chunk.bkp
    if (!bucket.head) staleBySignature.delete(chunk.g)
  }
  if (chunk.sqp) chunk.sqp.sqn = chunk.sqn
  else staleHead = chunk.sqn
  if (chunk.sqn) chunk.sqn.sqp = chunk.sqp
  else staleTail = chunk.sqp
  if (chunk.i !== undefined && staleById.get(chunk.i) === chunk) {
    staleById.delete(chunk.i)
  }
  chunk.st = false
  chunk.bp = undefined
  chunk.bkp = undefined
  chunk.bkn = undefined
  chunk.sqp = undefined
  chunk.sqn = undefined
  staleChunkCount--
}

function trimStaleChunks() {
  while (staleChunkCount > staleChunkSoftCap && staleHead) {
    const chunk = staleHead
    removeStaleChunk(chunk)
    destroyChunk(chunk)
  }
}

function attachChunkEvents(chunk: Chunk) {
  const events = chunk.v
  if (!events) return
  for (let i = 0; i < events.length; i++) {
    const [target, event, listener] = events[i]
    target.addEventListener(event, listener)
  }
}

function detachChunkEvents(chunk: Chunk) {
  const events = chunk.v
  if (!events) return
  for (let i = 0; i < events.length; i++) {
    const [target, event, listener] = events[i]
    target.removeEventListener(event, listener)
  }
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
  template._e = -1
  template._m = false
  template._s = strings
  template.key = setTemplateKey
  template.id = setTemplateId
  template.x = releaseTemplateExpressions
  template.d = resetTemplate
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

function releaseTemplateExpressions(this: InternalTemplate) {
  this._e = -1
}

function resetTemplate(this: InternalTemplate) {
  this._m = false
  this._h = undefined
  this._e = -1
}

function renderTemplate(template: InternalTemplate, el?: ParentNode) {
  const chunk = template._c()
  if (!template._m) {
    template._m = true
    if (!chunk.b) {
      writeExpressions(template._a!, chunk.e)
      return createBindings(chunk, el)
    }
    return el ? el.appendChild(chunk.dom) && el : chunk.dom
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
    const listener = (evt: Event) => {
      if (parentChunk.st || !(parentChunk._t as InternalTemplate)._m) return
      ;(expressionPool[expressionPointer] as CallableFunction)?.(evt)
    }
    const record: [Element, string, EventListener] = [target, event, listener]
    target.addEventListener(event, listener)
    target.removeAttribute(attrName)
    ;(parentChunk.v ??= []).push(record)
    if (capture) {
      registerHydrationHook(parentChunk, (map) => {
        const adopted = map.get(target)
        if (!adopted) return
        target.removeEventListener(event, listener)
        target = adopted as Element
        record[0] = target
        target.addEventListener(event, listener)
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
        let anchor: ChildNode | undefined
        const renderedList: Rendered[] = []
        const previousToRemove = new Set(previous)
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
          previousToRemove.delete(used)
        }
        if (!renderableLength) {
          getNode(previous[0]).after(
            (renderedList[0] = document.createTextNode(''))
          )
        } else if (renderableLength > previousLength) {
          anchor?.after(updaterFrag!)
        }
        previousToRemove.forEach((stale) => {
          forgetChunk(stale)
          unmount(stale)
        })
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
    const [props, box] = createPropsProxy(renderable.p, renderable.h)
    const cleanups: Array<() => void> = []
    const previousCollector = swapCleanupCollector(cleanups)
    let template: InternalTemplate
    let fragment: DocumentFragment

    try {
      template = renderable.h(props) as InternalTemplate
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
  | Array<Chunk | Text | ChildNode>
> = []

function destroyChunk(chunk: Chunk) {
  if (chunk.st) removeStaleChunk(chunk)
  ;(chunk._t as InternalTemplate).d?.()
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
  if (node) {
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
  chunkPool.free(chunk)
}

function recycleChunk(chunk: Chunk) {
  moveDOMRef(chunk.ref, chunk.dom)
  ;(chunk._t as InternalTemplate).d?.()
  addStaleChunk(chunk)
}

const queueUnmount = queue(() => {
  const removeItems = (
    chunk:
      | Chunk
      | Text
      | ChildNode
      | Array<Chunk | Text | ChildNode>
  ) => {
    if (isChunk(chunk)) {
      if (chunk.r) recycleChunk(chunk)
      else destroyChunk(chunk)
    } else if (Array.isArray(chunk)) {
      for (let i = 0; i < chunk.length; i++) removeItems(chunk[i])
    } else {
      chunk.remove()
    }
  }
  const stack = unmountStack
  unmountStack = []
  for (let i = 0; i < stack.length; i++) removeItems(stack[i])
})

function unmount(
  chunk:
    | Chunk
    | Text
    | ChildNode
    | Array<Chunk | Text | ChildNode>
    | undefined
) {
  if (!chunk) return
  unmountStack.push(chunk)
  queueUnmount()
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
    return value.map((item) =>
      adoptRenderedValue(item, capture, map, visited)
    ) as Rendered[]
  }
  return (map.get(value) as Text | undefined) ?? value
}

export function createChunk(
  rawStrings: TemplateStringsArray | string[]
): Omit<Chunk, 'ref'> & { ref: DOMRef } {
  const proto = resolveChunkProto(rawStrings)
  const chunk = takeChunkRecord()
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
  chunk.k = undefined
  chunk.i = undefined
  chunk._t = null as unknown as ArrowTemplate
  return chunk as Omit<Chunk, 'ref'> & { ref: DOMRef }
}

export function createPaths(dom: DocumentFragment): Chunk['paths'] {
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

export function getPath(node: Node): number[] {
  const path: number[] = []
  while (node.parentNode) {
    const children = node.parentNode.childNodes
    for (let i = 0; i < children.length; i++) {
      if (children[i] === node) {
        path.unshift(i)
        break
      }
    }
    node = node.parentNode
  }
  return path
}
