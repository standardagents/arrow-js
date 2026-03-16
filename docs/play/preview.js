const app = document.getElementById('app')
const runtimeError = document.getElementById('runtime-error')

let activeScript = null
let activeUrls = []
let activeStyles = []
let runId = 0

const post = (type, payload = {}) => {
  parent.postMessage({ source: 'arrow-play-preview', type, ...payload }, '*')
}

const reset = () => {
  app.replaceChildren()
  runtimeError.dataset.active = 'false'
  runtimeError.textContent = ''
  if (activeScript) {
    activeScript.remove()
    activeScript = null
  }
  activeStyles.forEach((style) => style.remove())
  activeStyles = []
  for (const url of activeUrls) URL.revokeObjectURL(url)
  activeUrls = []
}

const formatError = (error) => {
  if (!error) return 'Unknown runtime error'
  if (typeof error === 'string') return error
  return [error.message || String(error), error.stack].filter(Boolean).join('\n')
}

const reportError = (error) => {
  const message = formatError(error)
  runtimeError.dataset.active = 'true'
  runtimeError.textContent = message
  post('runtime-error', { message })
}

const normalizePath = (value) => value.replace(/^\//, '')

const resolveModulePath = (from, specifier, modules) => {
  if (!specifier.startsWith('.')) return null
  const resolved = normalizePath(
    new URL(specifier, `https://arrow-play.local/${from}`).pathname
  )

  if (modules[resolved]) return resolved
  if (resolved.endsWith('.js') && modules[`${resolved.slice(0, -3)}.ts`]) {
    return `${resolved.slice(0, -3)}.ts`
  }
  if (!resolved.endsWith('.ts') && modules[`${resolved}.ts`]) {
    return `${resolved}.ts`
  }

  return null
}

const rewriteImports = (code, from, modules, ensureUrl) => {
  const replaceSpecifier = (specifier) => {
    const resolved = resolveModulePath(from, specifier, modules)
    return resolved ? ensureUrl(resolved) : specifier
  }

  return code
    .replace(
      /(\b(?:import|export)\s+(?:[^'"`]*?\s+from\s*)?)(['"])([^'"]+)\2/g,
      (_, prefix, quote, specifier) =>
        `${prefix}${quote}${replaceSpecifier(specifier)}${quote}`
    )
    .replace(
      /(import\s*\(\s*)(['"])([^'"]+)\2(\s*\))/g,
      (_, prefix, quote, specifier, suffix) =>
        `${prefix}${quote}${replaceSpecifier(specifier)}${quote}${suffix}`
    )
}

const buildEntryUrl = (modules, entry) => {
  const cache = new Map()

  const ensureUrl = (path) => {
    if (cache.has(path)) return cache.get(path)
    const transformed = rewriteImports(modules[path] || '', path, modules, ensureUrl)
    const url = URL.createObjectURL(
      new Blob([`${transformed}\n//# sourceURL=${path}`], {
        type: 'text/javascript',
      })
    )
    cache.set(path, url)
    activeUrls.push(url)
    return url
  }

  return ensureUrl(entry)
}

const injectStyles = (styles) => {
  for (const styleEntry of styles || []) {
    const style = document.createElement('style')
    style.dataset.playStyle = styleEntry.name || 'style'
    style.textContent = styleEntry.content || ''
    document.head.append(style)
    activeStyles.push(style)
  }
}

window.addEventListener('error', (event) => {
  reportError(event.error || event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  reportError(event.reason)
})

window.addEventListener('message', (event) => {
  const data = event.data
  if (!data || data.source !== 'arrow-play-host') return

  if (data.type === 'theme') {
    document.documentElement.dataset.theme = data.theme || 'light'
    return
  }

  if (data.type !== 'run') return

  const currentRun = ++runId
  reset()

  try {
    injectStyles(data.styles)
    const entryUrl = buildEntryUrl(data.modules || {}, data.entry)
    activeScript = document.createElement('script')
    activeScript.type = 'module'
    activeScript.textContent = `import ${JSON.stringify(entryUrl)}`
    activeScript.onerror = () => {
      if (currentRun === runId) {
        reportError(new Error(`Failed to load playground entry "${data.entry}"`))
      }
    }
    document.body.append(activeScript)
  } catch (error) {
    if (currentRun === runId) reportError(error)
  }
})

post('frame-ready')
