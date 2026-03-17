import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createServer as createViteServer } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isProduction = process.env.NODE_ENV === 'production'
const port = Number(process.env.PORT ?? 4174)

const templatePath = path.resolve(__dirname, 'index.html')
const clientDistPath = path.resolve(__dirname, 'dist/client')
const serverEntryPath = path.resolve(__dirname, 'dist/server/entry-server.js')
const playgroundRuntimePath = path.resolve(
  __dirname,
  '../packages/core/dist/index.mjs'
)

const htmlEntryRedirects = new Map([
  ['/play', '/play/'],
  ['/play/preview', '/play/preview.html'],
  ['/play/preview/', '/play/preview.html'],
])

/** Routes that serve dynamically-generated plain text / markdown. */
const textRoutes = new Map([
  ['/docs.md', { render: 'markdown', url: '/' }],
  ['/api.md', { render: 'markdown', url: '/api' }],
  ['/play.md', { render: 'playground' }],
  ['/llms.txt', { render: 'llms' }],
])

const devHtmlEntries = new Map([
  ['/play/', path.resolve(__dirname, 'play/index.html')],
  ['/play/index.html', path.resolve(__dirname, 'play/index.html')],
  ['/play/preview.html', path.resolve(__dirname, 'play/preview.html')],
])

let vite = null

const server = http.createServer(async (request, response) => {
  const url = request.url ?? '/'

  try {
    const redirectTarget = redirectHtmlEntryUrl(request)

    if (redirectTarget) {
      response.writeHead(302, { Location: redirectTarget })
      response.end()
      return
    }

    const playApiResult = await handlePlayApi(url, request, response)
    if (playApiResult) return

    const textRoute = resolveTextRoute(url)
    if (textRoute) {
      await serveTextRoute(textRoute, request, response)
      return
    }

    if (vite) {
      await new Promise((resolve, reject) => {
        vite.middlewares(request, response, (error) => {
          if (error) reject(error)
          else resolve(undefined)
        })
      })

      if (response.writableEnded || response.headersSent) {
        return
      }
    }

    const devHtmlEntry = !isProduction ? resolveDevHtmlEntry(url) : null

    if (devHtmlEntry) {
      const template = await fs.readFile(devHtmlEntry.filePath, 'utf8')
      const html = await vite.transformIndexHtml(devHtmlEntry.url, template)

      response.writeHead(200, {
        'Content-Type': 'text/html',
      })
      response.end(html)
      return
    }

    const staticFile = await resolveStaticFile(url)
    if (staticFile) {
      await serveStaticAsset(staticFile, response)
      return
    }

    if (!isDocumentRequest(request)) {
      response.writeHead(404, { 'Content-Type': 'text/plain' })
      response.end('Not found')
      return
    }

    let template
    let renderPage

    if (isProduction) {
      template = await fs.readFile(path.resolve(clientDistPath, 'index.html'), 'utf8')
      ;({ renderPage } = await import(pathToFileURL(serverEntryPath).href))
    } else {
      template = await fs.readFile(templatePath, 'utf8')
      template = await vite.transformIndexHtml(url, template)
      ;({ renderPage } = await vite.environments.ssr.runner.import(
        '/src/entry-server.ts'
      ))
    }

    const page = await renderPage(url)
    const html = template
      .replace('<!--app-head-->', page.head ?? '')
      .replace('<!--app-html-->', page.html)
      .replace('<!--app-payload-->', page.payloadScript ?? '')

    response.writeHead(page.status ?? 200, {
      'Content-Type': 'text/html',
    })
    response.end(html)
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain' })
    response.end(error instanceof Error ? error.stack ?? error.message : String(error))
  }
})

if (!isProduction) {
  vite = await createViteServer({
    root: __dirname,
    configFile: path.resolve(__dirname, 'vite.config.ts'),
    appType: 'custom',
    server: {
      middlewareMode: true,
      hmr: {
        server,
        clientPort: port,
      },
    },
  })

  await vite.environments.ssr.init()
}

server.listen(port, '127.0.0.1', () => {
  console.log(`Arrow docs meta server running at http://127.0.0.1:${port}`)
})

/* ── Play API (dev-mode in-memory store, mirrors Cloudflare Worker) ── */

const HASH_LENGTH = 32
const playStore = new Map()
const playStorePath = path.resolve(__dirname, '.play-store.json')

async function loadPlayStore() {
  try {
    const data = await fs.readFile(playStorePath, 'utf8')
    for (const [k, v] of Object.entries(JSON.parse(data))) {
      playStore.set(k, v)
    }
  } catch {}
}

async function persistPlayStore() {
  await fs.writeFile(
    playStorePath,
    JSON.stringify(Object.fromEntries(playStore), null, 2),
  )
}

function contentHash(data) {
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, HASH_LENGTH)
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}

async function handlePlayApi(url, request, response) {
  const target = new URL(url, 'http://arrow.local')

  if (request.method === 'OPTIONS' && target.pathname.startsWith('/api/play')) {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    response.end()
    return true
  }

  if (request.method === 'POST' && target.pathname === '/api/play') {
    const body = JSON.parse(await readBody(request))
    if (!body?.snapshot || typeof body.snapshot !== 'string') {
      response.writeHead(400, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ error: 'Missing snapshot field' }))
      return true
    }

    const id = contentHash(body.snapshot)
    if (!playStore.has(id)) {
      playStore.set(id, body.snapshot)
      persistPlayStore().catch(() => {})
    }

    response.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    })
    response.end(JSON.stringify({ id }))
    return true
  }

  const loadMatch = target.pathname.match(/^\/api\/play\/([a-f0-9]+)$/)
  if (request.method === 'GET' && loadMatch) {
    const snapshot = playStore.get(loadMatch[1])
    if (!snapshot) {
      response.writeHead(404, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ error: 'Not found' }))
      return true
    }

    response.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    })
    response.end(JSON.stringify({ snapshot }))
    return true
  }

  return false
}

loadPlayStore()

async function resolveStaticFile(url) {
  const pathname = new URL(url, 'http://arrow.local').pathname

  if (pathname === '/play/arrow-runtime.js') {
    return playgroundRuntimePath
  }

  if (pathname === '/') {
    return null
  }

  const builtHtmlEntries = new Map([
    ['/play/', path.resolve(clientDistPath, 'play/index.html')],
    ['/play/index.html', path.resolve(clientDistPath, 'play/index.html')],
    ['/play/preview.html', path.resolve(clientDistPath, 'play/preview.html')],
  ])
  const builtHtmlEntry = builtHtmlEntries.get(pathname)

  if (builtHtmlEntry) {
    try {
      const stats = await fs.stat(builtHtmlEntry)
      if (stats.isFile()) return builtHtmlEntry
    } catch {}
  }

  const candidates = [
    path.resolve(clientDistPath, `.${pathname}`),
    path.resolve(clientDistPath, `.${pathname}/index.html`),
  ]

  for (const candidate of candidates) {
    try {
      const stats = await fs.stat(candidate)
      if (stats.isFile()) return candidate
    } catch {}
  }

  return null
}

async function serveStaticAsset(filePath, response) {
  const body = await fs.readFile(filePath)

  response.writeHead(200, {
    'Content-Type': contentTypeFor(filePath),
  })
  response.end(body)
}

function contentTypeFor(filePath) {
  if (filePath.endsWith('.css')) return 'text/css'
  if (filePath.endsWith('.js')) return 'application/javascript'
  if (filePath.endsWith('.mjs')) return 'application/javascript'
  if (filePath.endsWith('.html')) return 'text/html'
  if (filePath.endsWith('.svg')) return 'image/svg+xml'
  if (filePath.endsWith('.png')) return 'image/png'
  if (filePath.endsWith('.ico')) return 'image/x-icon'
  return 'application/octet-stream'
}

function isDocumentRequest(request) {
  const method = request.method ?? 'GET'
  if (method !== 'GET' && method !== 'HEAD') {
    return false
  }

  const pathname = new URL(request.url ?? '/', 'http://arrow.local').pathname
  if (
    pathname.startsWith('/@') ||
    pathname.startsWith('/src/') ||
    pathname.startsWith('/node_modules/') ||
    /\.[a-z0-9]+$/i.test(pathname)
  ) {
    return false
  }

  const destination = request.headers['sec-fetch-dest']
  if (destination && destination !== 'document' && destination !== 'empty') {
    return false
  }

  const accept = request.headers.accept ?? ''
  return !accept || accept.includes('text/html') || accept.includes('*/*')
}

function redirectHtmlEntryUrl(request) {
  if (!isDocumentRequest(request)) {
    return null
  }

  const target = new URL(request.url ?? '/', 'http://arrow.local')
  const redirectPath = htmlEntryRedirects.get(target.pathname)

  if (!redirectPath) {
    return null
  }

  return `${redirectPath}${target.search}`
}

function resolveDevHtmlEntry(url) {
  const target = new URL(url, 'http://arrow.local')
  const filePath = devHtmlEntries.get(target.pathname)

  if (!filePath) {
    return null
  }

  return {
    filePath,
    url: `${target.pathname}${target.search}`,
  }
}

function resolveTextRoute(url) {
  const pathname = new URL(url, 'http://arrow.local').pathname
  return textRoutes.get(pathname) ?? null
}

async function serveTextRoute(route, request, response) {
  let renderMarkdown, renderPlayground

  if (isProduction) {
    ;({ renderMarkdown, renderPlayground } = await import(pathToFileURL(serverEntryPath).href))
  } else {
    ;({ renderMarkdown, renderPlayground } = await vite.environments.ssr.runner.import(
      '/src/entry-server.ts'
    ))
  }

  let body

  if (route.render === 'llms') {
    const docsMarkdown = await renderMarkdown('/')
    const apiMarkdown = await renderMarkdown('/api')
    body = [
      '# ArrowJS',
      '',
      '> A < 3KB reactive UI runtime with zero dependencies. Observable data, declarative DOM, and SSR built on platform primitives.',
      '',
      '## Documentation',
      '',
      '- [Docs](/docs.md): Guide-style essentials — what Arrow is, quickstart, components, reactive data, templates, and SSR.',
      '- [API Reference](/api.md): Signature-focused reference for every export across @arrow-js/core, @arrow-js/framework, @arrow-js/ssr, and @arrow-js/hydrate.',
      '- [Playground Examples](/play.md): Source code for all interactive playground examples.',
      '',
      '---',
      '',
      '# Docs',
      '',
      docsMarkdown,
      '---',
      '',
      '# API Reference',
      '',
      apiMarkdown,
    ].join('\n')
  } else if (route.render === 'playground') {
    const reqUrl = new URL(request.url ?? '/', 'http://arrow.local')
    const snapshot = reqUrl.searchParams.get('s') ?? undefined
    body = await renderPlayground(snapshot)
  } else {
    body = await renderMarkdown(route.url)
  }

  response.writeHead(200, {
    'Content-Type': route.render === 'llms' ? 'text/plain; charset=utf-8' : 'text/markdown; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
  })
  response.end(body)
}
