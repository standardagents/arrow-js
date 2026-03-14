import { html, reactive } from '@src/index'
import logoUrl from '../img/logo.png'
import arrowTypes from './arrow-types.d.ts?raw'

const MONACO_BASE = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min'
const MONACO_URL = `${MONACO_BASE}/vs`
const ENTRY_FILE = 'main.ts'
const DEFAULT_FILES = [
  [
    'main.ts',
    `import { html, reactive } from '@arrow-js/core'
import { Counter } from './Component'

const state = reactive({
  count: 1,
  items: [
    { id: 1, label: 'Arrow is tiny' },
    { id: 2, label: 'Arrow is native-first' },
  ],
})

html\`
  <main style="padding: 24px; font: 16px/1.5 system-ui, sans-serif">
    <h1>Arrow Playground</h1>
    <p>Count: \${() => state.count}</p>
    <button @click="\${() => state.count++}">Increment</button>
    \${Counter()}
    <ul>
      \${() => state.items.map((item) => html\`<li>\${item.label}</li>\`.key(item.id))}
    </ul>
  </main>
\`(document.getElementById('app')!)`,
  ],
  [
    'Component.ts',
    `import { component, html, reactive } from '@arrow-js/core'

export const Counter = component(() => {
  const local = reactive({
    clicks: 0,
  })

  return html\`<button @click="\${() => local.clicks++}">
    Local clicks: \${() => local.clicks}
  </button>\`
})`,
  ],
]

const state = reactive({
  activeFile: ENTRY_FILE,
  copied: false,
  files: DEFAULT_FILES.map(([name]) => ({
    errors: 0,
    name,
  })),
})

let monacoLoader
let monaco
let editor
let updateTimer = 0
let hashTimer = 0
let highlightTimer = 0
let previewFrame
let pendingModules = null
let applyingHash = false
let lastHash = ''
let compileId = 0
let previewReady = false
let htmlDecorations

const models = new Map()
const viewStates = new Map()

const encodeText = (text) => {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  bytes.forEach((value) => {
    binary += String.fromCharCode(value)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const decodeText = (value) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '==='.slice((normalized.length + 3) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

const isTsFileName = (value) => /^[A-Za-z][A-Za-z0-9_-]*\.ts$/.test(value)

const createSnapshot = () => ({
  active: state.activeFile,
  files: state.files.map((file) => [
    file.name,
    models.get(file.name)?.getValue() ?? '',
  ]),
})

const encodeSnapshot = () => encodeText(JSON.stringify(createSnapshot()))

const parseSnapshot = (hash) => {
  if (!hash) return null

  try {
    const parsed = JSON.parse(decodeText(hash))
    if (!parsed || !Array.isArray(parsed.files)) return null

    const files = parsed.files
      .filter(
        (entry) =>
          Array.isArray(entry) &&
          typeof entry[0] === 'string' &&
          typeof entry[1] === 'string' &&
          isTsFileName(entry[0])
      )
      .map(([name, code]) => [name, code])

    if (!files.length) return null
    if (!files.some(([name]) => name === ENTRY_FILE)) return null

    const deduped = []
    const seen = new Set()
    for (const [name, code] of files) {
      if (seen.has(name)) continue
      seen.add(name)
      deduped.push([name, code])
    }

    return {
      active:
        typeof parsed.active === 'string' &&
        deduped.some(([name]) => name === parsed.active)
          ? parsed.active
          : ENTRY_FILE,
      files: deduped,
    }
  } catch {
    return null
  }
}

const readInitialSnapshot = () => {
  const parsed = parseSnapshot(window.location.hash.slice(1))
  if (parsed) {
    lastHash = window.location.hash.slice(1)
    return parsed
  }

  return {
    active: ENTRY_FILE,
    files: DEFAULT_FILES,
  }
}

const modelUri = (name) => monaco.Uri.parse(`file:///playground/${name}`)

const getFileState = (name) => state.files.find((file) => file.name === name)

const writeHash = () => {
  const encoded = encodeSnapshot()
  if (encoded !== lastHash) {
    history.replaceState(null, '', encoded ? `#${encoded}` : location.pathname)
    lastHash = encoded
  }
}

const scheduleHashSync = () => {
  clearTimeout(hashTimer)
  hashTimer = window.setTimeout(writeHash, 420)
}

const updateEditorTheme = () => {
  if (!monaco) return
  monaco.editor.setTheme(
    document.documentElement.dataset.theme === 'dark' ? 'vs-dark' : 'vs'
  )
  scheduleHtmlHighlight()
}

const flattenMessage = (message) => {
  if (typeof message === 'string') return message
  return [message.messageText, ...(message.next || []).map(flattenMessage)].join(
    '\n'
  )
}

const createMarker = (model, diagnostic) => {
  const start = model.getPositionAt(diagnostic.start || 0)
  const end = model.getPositionAt(
    (diagnostic.start || 0) + (diagnostic.length || 0)
  )
  return {
    code: String(diagnostic.code),
    endColumn: end.column,
    endLineNumber: end.lineNumber,
    message: flattenMessage(diagnostic.messageText),
    severity: monaco.MarkerSeverity.Error,
    startColumn: start.column,
    startLineNumber: start.lineNumber,
  }
}

const buildModulePayload = async () => {
  const workerFactory = await monaco.languages.typescript.getTypeScriptWorker()
  const modules = {}

  for (const file of state.files) {
    const model = models.get(file.name)
    if (!model) continue
    const worker = await workerFactory(model.uri)
    const [syntactic, semantic, emit] = await Promise.all([
      worker.getSyntacticDiagnostics(model.uri.toString()),
      worker.getSemanticDiagnostics(model.uri.toString()),
      worker.getEmitOutput(model.uri.toString()),
    ])

    const markers = [...syntactic, ...semantic].map((diagnostic) =>
      createMarker(model, diagnostic)
    )
    monaco.editor.setModelMarkers(model, 'arrow-play', markers)
    file.errors = markers.length

    const output = emit.outputFiles.find((entry) => entry.name.endsWith('.js'))
    if (output) modules[file.name] = output.text
  }

  return modules
}

const runPreview = (payload) => {
  pendingModules = payload
  if (!previewReady || !previewFrame?.contentWindow) return
  previewFrame.contentWindow.postMessage(
    { source: 'arrow-play-host', type: 'run', ...payload },
    '*'
  )
}

const compileAndRun = async () => {
  if (!editor || !monaco) return
  const currentCompile = ++compileId
  const modules = await buildModulePayload()
  if (currentCompile !== compileId) return
  if (!modules[ENTRY_FILE]) return
  runPreview({ entry: ENTRY_FILE, modules })
}

const scheduleCompile = () => {
  clearTimeout(updateTimer)
  updateTimer = window.setTimeout(() => {
    compileAndRun().catch((error) => {
      const active = getFileState(state.activeFile)
      if (active) active.errors = 1
      if (editor?.getModel()) {
        monaco.editor.setModelMarkers(editor.getModel(), 'arrow-play', [
          {
            code: 'PLAY',
            endColumn: 1,
            endLineNumber: 1,
            message: error.message || String(error),
            severity: monaco.MarkerSeverity.Error,
            startColumn: 1,
            startLineNumber: 1,
          },
        ])
      }
    })
  }, 140)
}

const skipString = (source, index, quote) => {
  for (let i = index + 1; i < source.length; i++) {
    if (source[i] === '\\') {
      i++
      continue
    }
    if (source[i] === quote) return i + 1
  }
  return source.length
}

const skipLineComment = (source, index) => {
  const next = source.indexOf('\n', index + 2)
  return next === -1 ? source.length : next
}

const skipBlockComment = (source, index) => {
  const next = source.indexOf('*/', index + 2)
  return next === -1 ? source.length : next + 2
}

const skipTemplateLiteral = (source, index) => {
  for (let i = index + 1; i < source.length; i++) {
    if (source[i] === '\\') {
      i++
      continue
    }
    if (source[i] === '`') return i + 1
    if (source[i] === '$' && source[i + 1] === '{') {
      i = skipJsExpression(source, i + 2) - 1
    }
  }
  return source.length
}

const skipJsExpression = (source, index, regions) => {
  let depth = 0
  for (let i = index; i < source.length; i++) {
    const char = source[i]
    const tagLength = templateTagLength(source, i)

    if (tagLength) {
      i = scanTaggedTemplate(source, i + tagLength, regions) - 1
      continue
    }
    if (char === "'" || char === '"') {
      i = skipString(source, i, char) - 1
      continue
    }
    if (char === '`') {
      i = skipTemplateLiteral(source, i) - 1
      continue
    }
    if (char === '/' && source[i + 1] === '/') {
      i = skipLineComment(source, i) - 1
      continue
    }
    if (char === '/' && source[i + 1] === '*') {
      i = skipBlockComment(source, i) - 1
      continue
    }
    if (char === '{') {
      depth++
      continue
    }
    if (char === '}') {
      if (!depth) return i + 1
      depth--
    }
  }
  return source.length
}

const templateTagLength = (source, index) => {
  if (!source.startsWith('html`', index) && !source.startsWith('t`', index)) {
    return 0
  }
  const prev = source[index - 1]
  return prev && /[\w$.]/.test(prev) ? 0 : source[index] === 'h' ? 5 : 2
}

const scanTaggedTemplate = (source, index, regions) => {
  let segmentStart = index
  for (let i = index; i < source.length; i++) {
    if (source[i] === '$' && source[i + 1] === '{') {
      if (segmentStart < i) regions.push([segmentStart, i])
      i = skipJsExpression(source, i + 2, regions) - 1
      segmentStart = i + 1
      continue
    }
    if (source[i] === '`') {
      if (segmentStart < i) regions.push([segmentStart, i])
      return i + 1
    }
  }
  if (segmentStart < source.length) regions.push([segmentStart, source.length])
  return source.length
}

const collectHtmlTemplateRegions = (source) => {
  const regions = []
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    const tagLength = templateTagLength(source, i)
    if (tagLength) {
      i = scanTaggedTemplate(source, i + tagLength, regions) - 1
      continue
    }
    if (char === "'" || char === '"') {
      i = skipString(source, i, char) - 1
      continue
    }
    if (char === '`') {
      i = skipTemplateLiteral(source, i) - 1
      continue
    }
    if (char === '/' && source[i + 1] === '/') {
      i = skipLineComment(source, i) - 1
      continue
    }
    if (char === '/' && source[i + 1] === '*') {
      i = skipBlockComment(source, i) - 1
    }
  }
  return regions
}

const tokenizeHtmlSegment = (segment) => {
  const tokens = []
  const push = (start, end, className) => {
    if (end > start) tokens.push([start, end, className])
  }

  let i = 0
  while (i < segment.length) {
    if (segment.startsWith('<!--', i)) {
      const end = segment.indexOf('-->', i + 4)
      const next = end === -1 ? segment.length : end + 3
      push(i, next, 'play-html-comment')
      i = next
      continue
    }

    if (segment[i] !== '<') {
      i++
      continue
    }

    const next = segment[i + 1]
    if (!next || /[\s=]/.test(next)) {
      i++
      continue
    }

    let cursor = i
    if (segment.startsWith('</', cursor)) {
      push(cursor, cursor + 2, 'play-html-delimiter')
      cursor += 2
    } else {
      push(cursor, cursor + 1, 'play-html-delimiter')
      cursor++
    }

    const nameStart = cursor
    while (cursor < segment.length && /[A-Za-z0-9:_-]/.test(segment[cursor])) cursor++
    push(nameStart, cursor, 'play-html-tag')

    while (cursor < segment.length) {
      while (cursor < segment.length && /\s/.test(segment[cursor])) cursor++

      if (segment.startsWith('/>', cursor)) {
        push(cursor, cursor + 2, 'play-html-delimiter')
        cursor += 2
        break
      }
      if (segment[cursor] === '>') {
        push(cursor, cursor + 1, 'play-html-delimiter')
        cursor++
        break
      }

      const attrStart = cursor
      while (
        cursor < segment.length &&
        !/[\s=>/]/.test(segment[cursor])
      ) {
        cursor++
      }
      push(attrStart, cursor, 'play-html-attr-name')

      while (cursor < segment.length && /\s/.test(segment[cursor])) cursor++
      if (segment[cursor] !== '=') continue

      cursor++
      while (cursor < segment.length && /\s/.test(segment[cursor])) cursor++
      const valueStart = cursor
      const quote = segment[cursor]

      if (quote === '"' || quote === "'") {
        cursor++
        while (cursor < segment.length) {
          if (segment[cursor] === '\\') {
            cursor += 2
            continue
          }
          if (segment[cursor] === quote) {
            cursor++
            break
          }
          cursor++
        }
      } else {
        while (cursor < segment.length && !/[\s>]/.test(segment[cursor])) cursor++
      }
      push(valueStart, cursor, 'play-html-attr-value')
    }

    i = cursor
  }

  return tokens
}

const buildHtmlDecorations = (model) => {
  const source = model.getValue()
  const regions = collectHtmlTemplateRegions(source)
  const decorations = []

  for (const [startOffset, endOffset] of regions) {
    const segment = source.slice(startOffset, endOffset)
    for (const [localStart, localEnd, className] of tokenizeHtmlSegment(segment)) {
      const start = startOffset + localStart
      const end = startOffset + localEnd
      decorations.push({
        options: {
          inlineClassName: className,
        },
        range: new monaco.Range(
          model.getPositionAt(start).lineNumber,
          model.getPositionAt(start).column,
          model.getPositionAt(end).lineNumber,
          model.getPositionAt(end).column
        ),
      })
    }
  }

  return decorations
}

const applyHtmlHighlight = () => {
  if (!editor || !monaco || !htmlDecorations) return
  const model = editor.getModel()
  if (!model) return
  htmlDecorations.set(buildHtmlDecorations(model))
}

const scheduleHtmlHighlight = () => {
  clearTimeout(highlightTimer)
  highlightTimer = window.setTimeout(applyHtmlHighlight, 30)
}

const switchFile = (name) => {
  if (!editor || name === state.activeFile) return

  viewStates.set(state.activeFile, editor.saveViewState())
  state.activeFile = name
  editor.setModel(models.get(name))
  const viewState = viewStates.get(name)
  if (viewState) editor.restoreViewState(viewState)
  editor.focus()
  scheduleHtmlHighlight()
  scheduleHashSync()
}

const restoreSnapshot = (snapshot) => {
  const nextNames = new Set(snapshot.files.map(([name]) => name))

  for (const [name, model] of models) {
    if (!nextNames.has(name)) {
      model.dispose()
      models.delete(name)
      viewStates.delete(name)
    }
  }

  const nextFiles = snapshot.files.map(([name, code]) => {
    let model = models.get(name)
    if (!model) {
      model = monaco.editor.createModel(code, 'typescript', modelUri(name))
      models.set(name, model)
    } else if (model.getValue() !== code) {
      model.setValue(code)
    }
    return {
      errors: 0,
      name,
    }
  })

  state.files.splice(0, state.files.length, ...nextFiles)
  state.activeFile = nextFiles.some((file) => file.name === snapshot.active)
    ? snapshot.active
    : ENTRY_FILE

  if (editor) {
    editor.setModel(models.get(state.activeFile))
    const viewState = viewStates.get(state.activeFile)
    if (viewState) editor.restoreViewState(viewState)
    scheduleHtmlHighlight()
  }
}

const copyUrl = async () => {
  writeHash()
  await navigator.clipboard.writeText(window.location.href)
  state.copied = true
  window.setTimeout(() => {
    state.copied = false
  }, 1200)
}

const createFileTemplate = (name) => {
  const base = name.replace(/\.ts$/, '')
  const exportName = base
    .replace(/(^|[-_])(\w)/g, (_, __, char) => char.toUpperCase())
    .replace(/[^A-Za-z0-9_$]/g, '') || 'Example'

  return `import { component, html } from '@arrow-js/core'

export const ${exportName} = component(() =>
  html\`<section>${exportName}</section>\`
)`
}

const addFile = () => {
  const name = window.prompt('New TypeScript file name', 'Component.ts')?.trim()
  if (!name) return
  if (!isTsFileName(name)) {
    window.alert('File names must be plain .ts files like Component.ts')
    return
  }
  if (models.has(name)) {
    window.alert('That file already exists.')
    return
  }

  const model = monaco.editor.createModel(
    createFileTemplate(name),
    'typescript',
    modelUri(name)
  )
  models.set(name, model)
  state.files.push({
    errors: 0,
    name,
  })
  switchFile(name)
  scheduleHashSync()
  scheduleCompile()
}

const onFrameMessage = (event) => {
  const data = event.data
  if (!data || data.source !== 'arrow-play-preview') return
  if (data.type === 'frame-ready') {
    previewReady = true
    if (pendingModules) runPreview(pendingModules)
  }
}

const applyHashChange = () => {
  if (!monaco) return
  const incoming = window.location.hash.slice(1)
  if (incoming === lastHash) return
  const snapshot = parseSnapshot(incoming)
  if (!snapshot) return
  applyingHash = true
  restoreSnapshot(snapshot)
  applyingHash = false
  lastHash = incoming
  scheduleCompile()
}

const loadMonaco = () => {
  if (window.monaco?.editor) return Promise.resolve(window.monaco)
  if (monacoLoader) return monacoLoader

  monacoLoader = new Promise((resolve, reject) => {
    window.MonacoEnvironment = {
      getWorkerUrl() {
        return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
          self.MonacoEnvironment = { baseUrl: '${MONACO_BASE}/' };
          importScripts('${MONACO_URL}/base/worker/workerMain.js');
        `)}`
      },
    }

    const script = document.createElement('script')
    script.src = `${MONACO_URL}/loader.js`
    script.onload = () => {
      window.require.config({ paths: { vs: MONACO_URL } })
      window.require(['vs/editor/editor.main'], () => resolve(window.monaco), reject)
    }
    script.onerror = () => reject(new Error('Failed to load Monaco'))
    document.head.append(script)
  })

  return monacoLoader
}

const initMonaco = async () => {
  monaco = await loadMonaco()
  updateEditorTheme()

  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    allowImportingTsExtensions: true,
    allowNonTsExtensions: true,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    noEmitOnError: false,
    strict: true,
    target: monaco.languages.typescript.ScriptTarget.ES2022,
    lib: ['dom', 'dom.iterable', 'es2022'],
  })
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  })
  monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true)
  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    arrowTypes,
    'file:///node_modules/@arrow-js/core/index.d.ts'
  )

  restoreSnapshot(readInitialSnapshot())

  editor = monaco.editor.create(document.getElementById('play-editor'), {
    automaticLayout: true,
    model: models.get(state.activeFile),
    minimap: { enabled: false },
    padding: { bottom: 12, top: 12 },
    fontSize: 14,
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    tabSize: 2,
  })
  htmlDecorations = editor.createDecorationsCollection([])

  editor.onDidChangeModelContent(() => {
    if (applyingHash) return
    scheduleHtmlHighlight()
    scheduleHashSync()
    scheduleCompile()
  })

  scheduleHtmlHighlight()
  scheduleCompile()
}

const shell = html`
  <div class="play-shell">
    <header class="play-topbar">
      <a class="play-brand" href="/" aria-label="ArrowJS home">
        <img src="${logoUrl}" alt="ArrowJS" />
      </a>
      <div class="play-actions">
        <button data-tone="primary" @click="${copyUrl}">
          ${() => (state.copied ? 'Copied' : 'Copy URL')}
        </button>
        <a class="play-link" href="/docs/">Docs</a>
      </div>
    </header>
    <main class="play-workspace">
      <aside class="play-explorer">
        <div class="play-explorer-header">
          <span class="play-explorer-title">Explorer</span>
          <button class="play-icon-button" @click="${addFile}" aria-label="New file">
            +
          </button>
        </div>
        <div class="play-explorer-list">
          <div class="play-tree">
            <div class="play-folder">
              <span class="play-caret">▾</span>
              <span class="play-folder-name">src</span>
            </div>
            <div class="play-tree-children">
              ${() =>
                state.files.map(
                  (file) => html`<button
                    class="play-file"
                    data-active="${() => String(file.name === state.activeFile)}"
                    @click="${() => switchFile(file.name)}"
                  >
                    <span class="play-file-main">
                      <span class="play-file-icon">TS</span>
                      <span class="play-file-name">${file.name}</span>
                    </span>
                    ${() =>
                      file.errors
                        ? html`<span class="play-file-badge">${() => file.errors}</span>`
                        : ''}
                  </button>`
                )}
            </div>
          </div>
        </div>
      </aside>
      <section class="play-editor-pane">
        <div id="play-editor" class="play-editor"></div>
      </section>
      <section class="play-preview-pane">
        <iframe
          id="play-preview"
          class="play-preview"
          title="Arrow Playground Preview"
          src="${new URL('./preview.html', window.location.href).pathname}"
        ></iframe>
      </section>
    </main>
  </div>
`

shell(document.getElementById('app'))

previewFrame = document.getElementById('play-preview')

window.addEventListener('message', onFrameMessage)
window.addEventListener('hashchange', applyHashChange)
new MutationObserver(updateEditorTheme).observe(document.documentElement, {
  attributeFilter: ['data-theme'],
  attributes: true,
})

initMonaco().catch((error) => {
  window.alert(error.message || String(error))
})
