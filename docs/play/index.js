import { html, reactive } from '@arrow-js/core'
import {
  applyArrowHtmlPreset,
  arrowHtmlTokenClassName,
  tokenizeArrowHtmlTemplates,
} from '@arrow-js/highlight'
import { ThemeToggle } from '../src/components/ThemeToggle'
import arrowTypes from './arrow-types.d.ts?raw'
import {
  ENTRY_FILE,
  cloneExampleFiles,
  getPlaygroundExample,
} from './example-registry'
import { playgroundExampleHref, starterExampleId } from './example-meta'

const MONACO_BASE = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min'
const MONACO_URL = `${MONACO_BASE}/vs`
const DESKTOP_SPLIT_BREAKPOINT = 1080
const MIN_SPLIT_PANE = 320
const SPLITTER_SIZE = 7
const PLAYGROUND_DEFAULT_EXAMPLE = starterExampleId
const FILE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*\.(ts|css)$/

const state = reactive({
  activeFile: ENTRY_FILE,
  canResize:
    typeof window !== 'undefined'
      ? window.innerWidth > DESKTOP_SPLIT_BREAKPOINT
      : true,
  copied: false,
  copyMenuOpen: false,
  sharing: false,
  editorWidth: 0,
  exampleId:
    typeof window !== 'undefined'
      ? getExampleIdFromLocation()
      : PLAYGROUND_DEFAULT_EXAMPLE,
  menuFile: '',
  menuX: 0,
  menuY: 0,
  renaming: '',
  resizing: false,
  files: cloneExampleFiles(
    getPlaygroundExample(
      typeof window !== 'undefined'
        ? getExampleIdFromLocation()
        : PLAYGROUND_DEFAULT_EXAMPLE
    ).files
  ).map(([name]) => ({
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

applyArrowHtmlPreset(document.documentElement)

function defineEditorThemes() {
  if (!monaco) return

  monaco.editor.defineTheme('arrow-one-light', {
    base: 'vs',
    inherit: true,
    colors: {
      'editor.background': '#FAFAFA',
      'editor.foreground': '#383A42',
      'editor.lineHighlightBackground': '#383A420C',
      'editor.selectionBackground': '#E5E5E6',
      'editorCursor.foreground': '#526FFF',
      'editorLineNumber.foreground': '#9D9D9F',
      'editorLineNumber.activeForeground': '#383A42',
      'editorIndentGuide.background1': '#383A4233',
      'editorIndentGuide.activeBackground1': '#626772',
    },
    rules: [
      { token: 'comment', foreground: 'A0A1A7', fontStyle: 'italic' },
      { token: 'string', foreground: '50A14F' },
      { token: 'number', foreground: '986801' },
      { token: 'keyword', foreground: 'A626A4' },
      { token: 'delimiter', foreground: '383A42' },
      { token: 'operator', foreground: '0184BC' },
      { token: 'type', foreground: 'C18401' },
      { token: 'type.identifier', foreground: 'C18401' },
      { token: 'identifier', foreground: '383A42' },
      { token: 'variable', foreground: 'E45649' },
      { token: 'variable.predefined', foreground: 'E45649' },
      { token: 'function', foreground: '4078F2' },
      { token: 'tag', foreground: 'E45649' },
      { token: 'attribute.name', foreground: '986801' },
      { token: 'attribute.value', foreground: '50A14F' },
    ],
  })
}

const encodeText = (text) => {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  bytes.forEach((value) => {
    binary += String.fromCharCode(value)
  })
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

const decodeText = (value) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '==='.slice((normalized.length + 3) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function getExampleIdFromLocation() {
  const params = new URLSearchParams(window.location.search)
  const exampleId = params.get('example')

  return getPlaygroundExample(exampleId).id
}

const isSupportedFileName = (value) => FILE_NAME_PATTERN.test(value)
const isTsFileName = (value) => value.endsWith('.ts')
const isCssFileName = (value) => value.endsWith('.css')

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
          isSupportedFileName(entry[0])
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

const createExampleSnapshot = (exampleId) => {
  const example = getPlaygroundExample(exampleId)

  return {
    active: example.activeFile || example.files[1]?.[0] || example.entry,
    files: cloneExampleFiles(example.files),
  }
}

const snapshotsEqual = (left, right) =>
  left.active === right.active &&
  left.files.length === right.files.length &&
  left.files.every(
    ([name, code], index) =>
      right.files[index]?.[0] === name && right.files[index]?.[1] === code
  )

const readInitialSnapshot = async () => {
  const params = new URLSearchParams(window.location.search)
  const shareId = params.get('id')

  if (shareId) {
    try {
      const res = await fetch(`/api/play/${shareId}`)
      if (res.ok) {
        const { snapshot } = await res.json()
        const parsed = parseSnapshot(snapshot)
        if (parsed) return parsed
      }
    } catch {}
  }

  state.exampleId = getExampleIdFromLocation()

  const parsed = parseSnapshot(window.location.hash.slice(1))
  if (parsed) {
    lastHash = window.location.hash.slice(1)
    return parsed
  }

  return {
    ...createExampleSnapshot(state.exampleId),
  }
}

const modelUri = (name) => monaco.Uri.parse(`file:///playground/${name}`)

const getFileState = (name) => state.files.find((file) => file.name === name)
const isLockedFile = (name) => name === ENTRY_FILE
const fileLanguage = (name) => (isCssFileName(name) ? 'css' : 'typescript')
const fileIconLabel = (name) => (isCssFileName(name) ? 'CSS' : 'TS')

const closeFileMenu = () => {
  state.menuFile = ''
}

const buildPlaygroundUrl = (hash = lastHash, exampleId = state.exampleId) => {
  const base = exampleId && exampleId !== starterExampleId
    ? playgroundExampleHref(exampleId)
    : window.location.pathname

  return hash ? `${base}#${hash}` : base
}

const getSplitBounds = () => {
  const split = document.getElementById('play-split')
  if (!split) return null
  const rect = split.getBoundingClientRect()
  return {
    left: rect.left,
    max: Math.max(MIN_SPLIT_PANE, rect.width - SPLITTER_SIZE - MIN_SPLIT_PANE),
  }
}

const syncResizeMode = () => {
  state.canResize = window.innerWidth > DESKTOP_SPLIT_BREAKPOINT

  if (!state.canResize) {
    state.resizing = false
    document.documentElement.style.cursor = ''
    document.body.style.userSelect = ''
    return
  }

  if (!state.editorWidth) return
  const bounds = getSplitBounds()
  if (!bounds) return
  if (state.editorWidth > bounds.max) {
    state.editorWidth = bounds.max
    editor?.layout()
  }
}

const splitStyle = () =>
  state.canResize && state.editorWidth
    ? `grid-template-columns:minmax(${MIN_SPLIT_PANE}px, ${state.editorWidth}px) ${SPLITTER_SIZE}px minmax(${MIN_SPLIT_PANE}px, 1fr)`
    : ''

const startResize = (event) => {
  if (!state.canResize) return
  const bounds = getSplitBounds()
  if (!bounds) return

  event.preventDefault()
  closeFileMenu()
  state.resizing = true
  document.documentElement.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  if (event.currentTarget instanceof Element && 'setPointerCapture' in event.currentTarget) {
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const move = (moveEvent) => {
    state.editorWidth = Math.max(
      MIN_SPLIT_PANE,
      Math.min(moveEvent.clientX - bounds.left, bounds.max)
    )
    editor?.layout()
  }

  const stop = () => {
    state.resizing = false
    document.documentElement.style.cursor = ''
    document.body.style.userSelect = ''
    if (
      event.currentTarget instanceof Element &&
      'releasePointerCapture' in event.currentTarget
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', stop)
    window.removeEventListener('pointercancel', stop)
  }

  move(event)
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', stop)
  window.addEventListener('pointercancel', stop)
}

const writeHash = () => {
  const snapshot = createSnapshot()
  const baseSnapshot = createExampleSnapshot(state.exampleId)
  const encoded = snapshotsEqual(snapshot, baseSnapshot) ? '' : encodeText(JSON.stringify(snapshot))
  if (encoded !== lastHash) {
    history.replaceState(null, '', buildPlaygroundUrl(encoded))
    lastHash = encoded
  }
}

const scheduleHashSync = () => {
  clearTimeout(hashTimer)
  hashTimer = window.setTimeout(writeHash, 420)
}

const sendThemeToPreview = () => {
  if (!previewFrame?.contentWindow) return
  previewFrame.contentWindow.postMessage(
    { source: 'arrow-play-host', type: 'theme', theme: document.documentElement.dataset.theme || 'light' },
    '*'
  )
}

const updateEditorTheme = () => {
  if (!monaco) return
  monaco.editor.setTheme(
    document.documentElement.dataset.theme === 'dark' ? 'vs-dark' : 'arrow-one-light'
  )
  scheduleHtmlHighlight()
  sendThemeToPreview()
}



const flattenMessage = (message) => {
  if (typeof message === 'string') return message
  return [
    message.messageText,
    ...(message.next || []).map(flattenMessage),
  ].join('\n')
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
  const styles = []

  for (const file of state.files) {
    const model = models.get(file.name)
    if (!model) continue

    if (isCssFileName(file.name)) {
      monaco.editor.setModelMarkers(model, 'arrow-play', [])
      file.errors = 0
      styles.push({
        name: file.name,
        content: model.getValue(),
      })
      continue
    }

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

  return { modules, styles }
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
  const payload = await buildModulePayload()
  if (currentCompile !== compileId) return
  if (!payload.modules[ENTRY_FILE]) return
  runPreview({ entry: ENTRY_FILE, ...payload })
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

const buildHtmlDecorations = (model) => {
  const source = model.getValue()
  return tokenizeArrowHtmlTemplates(source).map(({ start, end, type }) => ({
    options: {
      inlineClassName: arrowHtmlTokenClassName(type),
    },
    range: new monaco.Range(
      model.getPositionAt(start).lineNumber,
      model.getPositionAt(start).column,
      model.getPositionAt(end).lineNumber,
      model.getPositionAt(end).column
    ),
  }))
}

const applyHtmlHighlight = () => {
  if (!editor || !monaco || !htmlDecorations) return
  const model = editor.getModel()
  if (!model) return
  if (isCssFileName(state.activeFile)) {
    htmlDecorations.clear()
    return
  }
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
      model = monaco.editor.createModel(code, fileLanguage(name), modelUri(name))
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

const copyMarkdown = async () => {
  const encoded = encodeSnapshot()
  const url = `/play.md?s=${encoded}`
  try {
    const res = await fetch(url)
    const text = await res.text()
    await navigator.clipboard.writeText(text)
  } catch {
    return
  }
  state.copied = true
  state.copyMenuOpen = false
  window.setTimeout(() => {
    state.copied = false
  }, 2000)
}

const getShareUrl = async () => {
  const snapshot = encodeSnapshot()
  try {
    const res = await fetch('/api/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot }),
    })
    if (res.ok) {
      const { id } = await res.json()
      return `${window.location.origin}/play/?id=${id}`
    }
  } catch {}
  // Fallback: hash-based URL
  writeHash()
  return window.location.href
}

const sharePlayground = async () => {
  state.sharing = true
  try {
    const url = await getShareUrl()
    await navigator.clipboard.writeText(url)
    state.copied = true
    state.copyMenuOpen = false
    window.setTimeout(() => { state.copied = false }, 2000)
  } finally {
    state.sharing = false
  }
}

const openGitHubIssue = async () => {
  state.sharing = true
  try {
    const playUrl = await getShareUrl()
    const issueUrl = `https://github.com/standardagents/arrow-js/issues/new?labels=playground&body=${encodeURIComponent(`Describe the issue…\n\nPlayground: ${playUrl}`)}`
    window.open(issueUrl, '_blank')
    closeCopyMenu()
  } finally {
    state.sharing = false
  }
}

const markdownUrl = '/play.md'


const toggleCopyMenu = (e) => {
  e.stopPropagation()
  state.copyMenuOpen = !state.copyMenuOpen
}

const closeCopyMenu = () => {
  state.copyMenuOpen = false
}

const createFileTemplate = (name) => {
  if (isCssFileName(name)) {
    return `#app {\n  padding: 24px;\n}\n`
  }

  const base = name.replace(/\.ts$/, '')
  const exportName =
    base
      .replace(/(^|[-_])(\w)/g, (_, __, char) => char.toUpperCase())
      .replace(/[^A-Za-z0-9_$]/g, '') || 'Example'

  return `import { component, html } from '@arrow-js/core'

export const ${exportName} = component(() =>
  html\`<section>${exportName}</section>\`
)`
}

const createDuplicateName = (name) => {
  const dot = name.lastIndexOf('.')
  const stem = dot === -1 ? name : name.slice(0, dot)
  const ext = dot === -1 ? '' : name.slice(dot)
  let copyName = `${stem}-copy${ext}`
  let index = 2

  while (models.has(copyName)) {
    copyName = `${stem}-copy-${index}${ext}`
    index++
  }

  return copyName
}

const commitRename = (file, newName) => {
  newName = newName.trim()
  if (!/\.[A-Za-z]+$/.test(newName)) newName += '.ts'
  state.renaming = ''

  const isNew = !models.has(file.name)

  if (!isSupportedFileName(newName)) return isNew ? removeFile(file.name) : undefined
  if (newName !== file.name && models.has(newName))
    return isNew ? removeFile(file.name) : undefined

  if (isNew) {
    const model = monaco.editor.createModel(
      createFileTemplate(newName),
      fileLanguage(newName),
      modelUri(newName)
    )
    models.set(newName, model)
    file.name = newName
    switchFile(newName)
    scheduleHashSync()
    scheduleCompile()
    return
  }

  if (isLockedFile(file.name)) return
  if (newName === file.name) return

  const oldName = file.name
  const code = models.get(oldName)?.getValue() ?? ''
  const oldModel = models.get(oldName)
  if (oldModel) oldModel.dispose()
  models.delete(oldName)
  viewStates.delete(oldName)

  const newModel = monaco.editor.createModel(
    code,
    fileLanguage(newName),
    modelUri(newName)
  )
  models.set(newName, newModel)
  file.name = newName

  if (state.activeFile === oldName) {
    state.activeFile = newName
    editor.setModel(newModel)
  }
  scheduleHashSync()
  scheduleCompile()
}

const removeFile = (name) => {
  if (isLockedFile(name)) return
  const idx = state.files.findIndex((f) => f.name === name)
  if (idx === -1) return
  const nextActive =
    state.activeFile === name
      ? state.files[idx + 1]?.name || state.files[idx - 1]?.name || ENTRY_FILE
      : state.activeFile
  state.files.splice(idx, 1)
  const model = models.get(name)
  if (model) model.dispose()
  models.delete(name)
  viewStates.delete(name)
  if (state.menuFile === name) closeFileMenu()

  if (state.activeFile === name) {
    state.activeFile = nextActive
    if (editor && models.has(nextActive)) editor.setModel(models.get(nextActive))
  }

  scheduleHashSync()
  scheduleCompile()
}

const focusRenameInput = () => {
  requestAnimationFrame(() => {
    const el = document.querySelector('.play-rename-input')
    if (!el) return
    el.focus()
    const dot = el.value.lastIndexOf('.')
    if (dot > 0) el.setSelectionRange(0, dot)
  })
}

const startRename = (name) => {
  if (isLockedFile(name)) return
  closeFileMenu()
  state.renaming = name
  focusRenameInput()
}

const duplicateFile = (name) => {
  if (!monaco) return
  const source = models.get(name)
  if (!source) return

  const copyName = createDuplicateName(name)
  const copyModel = monaco.editor.createModel(
    source.getValue(),
    fileLanguage(copyName),
    modelUri(copyName)
  )
  const index = state.files.findIndex((file) => file.name === name)

  models.set(copyName, copyModel)
  state.files.splice(index + 1, 0, {
    errors: 0,
    name: copyName,
  })
  closeFileMenu()
  switchFile(copyName)
  scheduleHashSync()
  scheduleCompile()
}

const addFile = () => {
  if (!monaco) return
  closeFileMenu()
  const placeholder = 'Untitled.ts'
  state.files.push({ errors: 0, name: placeholder })
  state.renaming = placeholder
  focusRenameInput()
}

const openFileMenu = (event, name) => {
  event.preventDefault()
  state.renaming = ''
  state.menuFile = name
  state.menuX = Math.max(8, Math.min(event.clientX, window.innerWidth - 168))
  state.menuY = Math.max(8, Math.min(event.clientY, window.innerHeight - 120))
}

const onFrameMessage = (event) => {
  const data = event.data
  if (!data || data.source !== 'arrow-play-preview') return
  if (data.type === 'frame-ready') {
    previewReady = true
    sendThemeToPreview()
    if (pendingModules) runPreview(pendingModules)
  }
}

const syncFromLocation = () => {
  if (!monaco) return

  const nextExampleId = getExampleIdFromLocation()
  const incomingHash = window.location.hash.slice(1)
  const snapshot = parseSnapshot(incomingHash) ?? createExampleSnapshot(nextExampleId)

  state.exampleId = nextExampleId
  applyingHash = true
  restoreSnapshot(snapshot)
  applyingHash = false
  lastHash = parseSnapshot(incomingHash) ? incomingHash : ''
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
      window.require(
        ['vs/editor/editor.main'],
        () => resolve(window.monaco),
        reject
      )
    }
    script.onerror = () => reject(new Error('Failed to load Monaco'))
    document.head.append(script)
  })

  return monacoLoader
}

const initMonaco = async () => {
  monaco = await loadMonaco()
  defineEditorThemes()
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

  restoreSnapshot(await readInitialSnapshot())

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
      <a class="play-brand" href="/" aria-label="ArrowJS home" style="color:var(--play-text)">
        <svg viewBox="0 0 535.37 83.47" style="height:20px;width:auto" aria-label="ArrowJS"><path fill="currentColor" d="M451,40.65c-.14,17.63-9.85,32.23-25.39,38.39-15.74,6.24-33.2,2.32-45.41-10.22-.69-.7-1.18-1.6-2.01-2.74-1.77,1.68-3.05,2.89-4.33,4.1-21.89,20.87-58.05,12.58-67.46-15.6-1.35-4.05-2.07-8.47-2.17-12.74-.29-12.66-.12-25.34-.11-38.01,0-.8,0,0,0-2.38,8.63-.49,16.36,6.16,16.82,15.24,.38,7.65,.15,15.33,.19,23,.03,6.7,1.53,12.91,6.25,17.96,7.03,7.51,15.46,10.05,25.4,6.89,8.61-2.73,15.62-11.15,15.97-20.42,.46-12.15,.24-24.33,.3-36.5,.01-1.97,.01-3.95,.01-5.86,8.22-1.36,16.19,5.62,16.83,14.66,.36,5.14,.09,10.33,.18,15.49,.08,4.33-.06,8.69,.46,12.97,1.47,12.15,12.04,21.26,24.05,21.03,12.22-.24,22.54-10,23.2-22.46,.44-8.31,.07-16.66,.28-24.99,.22-8.67,5.49-15.17,13.37-17.14,.93-.23,2.22-.21,3.57-.26,0,4.51,.01,3.13,.01,4.58,.02,11.67,.09,23.34-.01,35.01Z"/><path fill="currentColor" d="M82.66,82.31c-16.44-.39-32.52,.46-48.27-1.43C7.64,77.67-7.29,46.65,5.42,22.82,13.54,7.6,30.82-1.25,47.6,1.21c17.34,2.54,31.22,15.66,34.7,32.8,.13,.65,.34,1.31,.34,1.96,.02,15.11,.02,30.23,.02,46.33Zm-17.4-15.92c0-10.59,.86-20.28-.22-29.76-1.31-11.54-12.27-19.89-23.6-19.6-11.93,.3-21.72,9.35-23.18,21.43-1.47,12.17,5.62,24.09,17.28,26.18,9.67,1.73,19.74,1.25,29.71,1.75Z"/><path fill="currentColor" d="M215.42,41.42c.06-22.65,18.33-40.54,41.32-40.45,22.46,.1,40.61,18.39,40.47,40.79-.13,22.39-18.37,40.23-41.06,40.17-22.64-.06-40.78-18.11-40.73-40.5Zm17.08-.61c-.42,13.43,10,24.72,23.16,25.1,13.11,.37,24.17-10.34,24.54-23.77,.37-13.44-9.93-24.57-23.21-25.1-13.02-.51-24.07,10.2-24.49,23.77Z"/><path fill="currentColor" d="M226.47,.95c-.2,8.84-6.03,15.18-14.18,15.88-2.82,.24-5.66,.06-8.5,.14-14.51,.41-24.4,10.08-24.85,24.61-.25,8,.11,16.01-.17,24-.32,9.29-7.2,15.81-16.66,15.94-.07-1.46-.21-2.93-.22-4.39-.02-11.5-.07-23.01,0-34.51,.17-24.15,17.6-41.52,41.76-41.66,7.48-.04,14.96,0,22.8,0Z"/><path fill="currentColor" d="M93.16,81.58c-.16-.44-.46-.9-.46-1.36,.02-14.49-.52-29.01,.28-43.46,1-18.14,17.57-34.24,36.12-35.56,9.23-.66,18.55-.11,27.83-.11-.05,8.85-5.94,15.17-14.41,15.78-2.82,.2-5.66,.02-8.49,.12-14.33,.51-24.01,10.15-24.34,24.42-.18,7.66,.12,15.33-.11,22.99-.3,10.08-6.75,16.7-16.41,17.18Z"/><path fill="currentColor" d="M501.11,31.13h6.35c3.98,6.69,8.72,8.73,15.5,6.73,2.49-.74,4.12-2.23,4.3-4.89,.18-2.61-.97-4.66-3.49-5.44-3.64-1.13-7.54-1.56-11.03-3.01-3.11-1.29-6.51-3-8.55-5.52-3.71-4.59-1.71-12,3.36-15.3,5.71-3.72,15.33-3.63,20.89,.26,3.3,2.31,5.43,5.3,5.25,9.9h-6.6c-1.37-6.24-6.4-6.69-11.9-6.03-2.65,.32-4.88,1.44-5.25,4.44-.38,3.06,1.57,4.62,4.14,5.43,2.37,.74,4.87,1.1,7.26,1.79,2.39,.68,4.83,1.34,7.05,2.41,4.5,2.18,6.61,6,6.37,10.96-.23,4.72-2.47,8.23-6.91,10.13-5.94,2.54-12.04,2.65-18.03,.47-5.33-1.94-8.2-6-8.7-12.34Z"/><path fill="currentColor" d="M467.9,32.2h5.93c1.1,1.61,1.93,3.81,3.52,4.94,4.16,2.96,9.39,.24,9.6-5.07,.31-7.81,.14-15.64,.17-23.47,0-2.13,0-4.25,0-6.71h7.3c0,6.52,.06,12.81-.02,19.1-.06,4.65,.14,9.37-.56,13.94-1.07,6.98-7.06,10.65-14.98,9.84-6.88-.7-10.82-5.13-10.95-12.58Z"/></svg>
      </a>
      <div class="play-actions">
        <div class="play-copy-menu">
          <div class="play-copy-trigger">
            <button class="play-copy-btn" @click="${sharePlayground}">
              <span class="play-copy-icon play-copy-icon--link"></span>
              ${() => (state.sharing ? 'Sharing…' : state.copied ? 'Copied!' : 'Copy URL')}
            </button>
            <button class="play-copy-toggle" @click="${toggleCopyMenu}">
              <span class="play-copy-icon play-copy-icon--chevron"></span>
            </button>
          </div>
          <div class="play-copy-dropdown" data-open="${() => (state.copyMenuOpen ? '' : false)}">
            <button class="play-copy-item" data-busy="${() => state.sharing ? 'true' : false}" @click="${sharePlayground}">
              <span class="play-copy-icon play-copy-icon--link"></span>
              <div>
                <div class="play-copy-item-title">${() => state.sharing ? 'Sharing…' : 'Copy URL'}</div>
                <div class="play-copy-item-desc">Copy shareable playground link</div>
              </div>
            </button>
            <button class="play-copy-item" @click="${copyMarkdown}">
              <span class="play-copy-icon play-copy-icon--copy"></span>
              <div>
                <div class="play-copy-item-title">Copy code</div>
                <div class="play-copy-item-desc">Copy all files as Markdown for LLMs</div>
              </div>
            </button>
            <button class="play-copy-item" @click="${() => {
              const encoded = encodeSnapshot()
              window.open(`/play.md?s=${encoded}`, '_blank')
              closeCopyMenu()
            }}">
              <span class="play-copy-icon play-copy-icon--markdown"></span>
              <div>
                <div class="play-copy-item-title">View as Markdown <span class="play-copy-external">&nearr;</span></div>
                <div class="play-copy-item-desc">View code as plain text</div>
              </div>
            </button>
            <button class="play-copy-item" data-busy="${() => state.sharing ? 'true' : false}" @click="${openGitHubIssue}">
              <span class="play-copy-icon play-copy-icon--github"></span>
              <div>
                <div class="play-copy-item-title">${() => state.sharing ? 'Sharing…' : 'Open GitHub Issue'} <span class="play-copy-external">&nearr;</span></div>
                <div class="play-copy-item-desc">Create a draft issue linked to this playground</div>
              </div>
            </button>
          </div>
        </div>
        <a class="play-link" href="/#why-arrow">Docs</a>
        ${ThemeToggle('play-icon-button play-theme-toggle')}
      </div>
    </header>
    <main class="play-workspace">
      <aside class="play-explorer">
        <div class="play-explorer-header">
          <span class="play-explorer-title">Files</span>
          <button
            class="play-icon-button"
            @click="${addFile}"
            aria-label="New file"
          >
            +
          </button>
        </div>
        <div class="play-explorer-list">
          ${() =>
            state.files.map(
              (file) => html`<div
                class="play-file"
                data-active="${() => String(file.name === state.activeFile)}"
                @click="${() => {
                  closeFileMenu()
                  if (state.renaming !== file.name) switchFile(file.name)
                }}"
                @contextmenu="${(event) => openFileMenu(event, file.name)}"
                @dblclick="${(e) => {
                  e.preventDefault()
                  startRename(file.name)
                }}"
              >
                <span class="play-file-main">
                  <span class="play-file-icon">${fileIconLabel(file.name)}</span>
                  ${() =>
                    state.renaming === file.name
                      ? html`<input
                          class="play-rename-input"
                          value="${file.name}"
                          @blur="${(e) => commitRename(file, e.target.value)}"
                          @keydown="${(e) => {
                            if (e.key === 'Enter') e.target.blur()
                            if (e.key === 'Escape') {
                              state.renaming = ''
                              if (!models.has(file.name)) removeFile(file.name)
                            }
                          }}"
                        />`
                      : html`<span class="play-file-name">${file.name}</span>`}
                </span>
                ${() =>
                  file.errors && state.renaming !== file.name
                    ? html`<span class="play-file-badge"
                        >${() => file.errors}</span
                      >`
                    : ''}
          </div>`
            )}
        </div>
      </aside>
      <div id="play-split" class="play-split" style="${splitStyle}">
        <section class="play-editor-pane">
          <div class="play-pane-header">
            <span class="play-pane-tab">
              <span class="play-file-icon">${() => fileIconLabel(state.activeFile)}</span>
              ${() => state.activeFile}
            </span>
          </div>
          <div id="play-editor" class="play-editor"></div>
        </section>
        <div
          class="play-splitter"
          data-active="${() => String(state.resizing)}"
          @pointerdown="${startResize}"
          aria-label="Resize editor and preview panels"
          role="separator"
        ></div>
        <section class="play-preview-pane">
          <div class="play-pane-header">
            <span class="play-pane-label">Preview</span>
          </div>
          <iframe
            id="play-preview"
            class="play-preview"
            title="Arrow Playground Preview"
            src="${new URL('./preview.html', window.location.href).pathname}"
          ></iframe>
        </section>
        ${() =>
          state.resizing
            ? html`<div class="play-resize-capture"></div>`
            : ''}
      </div>
    </main>
    ${() =>
      state.menuFile
        ? html`<div
            class="play-context-menu"
            style="${() => `left:${state.menuX}px; top:${state.menuY}px`}"
            @contextmenu="${(event) => event.preventDefault()}"
          >
            <button
              class="play-context-item"
              data-disabled="${() => String(isLockedFile(state.menuFile))}"
              @click="${() => {
                if (isLockedFile(state.menuFile)) return
                startRename(state.menuFile)
              }}"
            >
              Rename
            </button>
            <button
              class="play-context-item"
              @click="${() => duplicateFile(state.menuFile)}"
            >
              Duplicate
            </button>
            <button
              class="play-context-item"
              data-danger="true"
              data-disabled="${() => String(isLockedFile(state.menuFile))}"
              @click="${() => {
                if (isLockedFile(state.menuFile)) return
                const name = state.menuFile
                closeFileMenu()
                removeFile(name)
              }}"
            >
              Delete
            </button>
          </div>`
        : ''}
  </div>
`

shell(document.getElementById('app'))

previewFrame = document.getElementById('play-preview')

window.addEventListener('message', onFrameMessage)
window.addEventListener('hashchange', syncFromLocation)
window.addEventListener('popstate', syncFromLocation)
window.addEventListener('mousedown', (event) => {
  if (state.menuFile) {
    if (!(event.target instanceof Element && event.target.closest('.play-context-menu')))
      closeFileMenu()
  }
  if (state.copyMenuOpen) {
    if (!(event.target instanceof Element && event.target.closest('.play-copy-menu')))
      closeCopyMenu()
  }
})
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeFileMenu()
    closeCopyMenu()
  }
})
window.addEventListener('resize', () => {
  syncResizeMode()
  editor?.layout()
})
new MutationObserver(updateEditorTheme).observe(document.documentElement, {
  attributeFilter: ['data-theme'],
  attributes: true,
})

syncResizeMode()
initMonaco().catch((error) => {
  window.alert(error.message || String(error))
})
