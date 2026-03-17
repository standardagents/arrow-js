import '@shikijs/twoslash/style-rich.css'
import arrowTypes from '../play/arrow-types.d.ts?raw'
import FrameworkExamples from './framework-examples'

const TWOSLASH_TYPES_PATH = '/arrow-docs.d.ts'
const TWOSLASH_REFERENCE = `/// <reference path="${TWOSLASH_TYPES_PATH}" />\n`
const TYPESCRIPT_CDN_PREFIX = 'https://playgroundcdn.typescriptlang.org/cdn/'
const TYPESCRIPT_OPTIONAL_LIBS = new Set([
  'lib.core.d.ts',
  'lib.core.es6.d.ts',
  'lib.core.es7.d.ts',
  'lib.es7.d.ts',
  'lib.es2022.sharedmemory.d.ts',
])
const TWOSLASH_COMPILER_OPTIONS = {
  lib: ['es2022', 'dom', 'dom.iterable'],
  strict: false,
  noImplicitAny: false,
  skipLibCheck: true,
}

let highlighterLoader: ReturnType<typeof initHighlighter> | undefined

function getRequestUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

function createCodeWrapper(html: string) {
  const template = document.createElement('template')
  template.innerHTML = html.trim()
  const wrapper = template.content.firstElementChild

  if (wrapper instanceof HTMLElement) {
    trimCodeWhitespace(wrapper)
  }

  return wrapper
}

function trimCodeWhitespace(wrapper: HTMLElement) {
  const code = wrapper.querySelector('code')

  if (!(code instanceof HTMLElement)) {
    return
  }

  while (
    code.firstChild?.nodeType === Node.TEXT_NODE &&
    !(code.firstChild.textContent || '').trim()
  ) {
    code.removeChild(code.firstChild)
  }

  while (
    code.lastChild?.nodeType === Node.TEXT_NODE &&
    !(code.lastChild.textContent || '').trim()
  ) {
    code.removeChild(code.lastChild)
  }
}

function stripTwoslashReferenceLine(html: string) {
  const wrapper = createCodeWrapper(html)

  if (!(wrapper instanceof HTMLElement)) {
    return html
  }

  const firstLine = wrapper.querySelector('.line')
  if (firstLine?.textContent?.includes(TWOSLASH_TYPES_PATH)) {
    firstLine.remove()
  }

  return wrapper.outerHTML
}

function normalizeLanguage(language: string) {
  const lang = language.replace('language-', '')

  switch (lang) {
    case 'javascript':
      return 'js'
    case 'typescript':
      return 'ts'
    case 'shell':
    case 'bash':
      return 'shell'
    default:
      return lang
  }
}

async function initHighlighter() {
  const [
    { createCssVariablesTheme, createHighlighter },
    { createTransformerFactory, rendererRich },
    { createTwoslashFromCDN },
  ] = await Promise.all([
    import('shiki'),
    import('@shikijs/twoslash'),
    import('twoslash-cdn'),
  ])

  const theme = createCssVariablesTheme()
  const highlighter = await createHighlighter({
    themes: [theme],
    langs: ['js', 'ts', 'html', 'shell'],
  })

  const twoslashFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = getRequestUrl(input)
    const fileName = url.slice(url.lastIndexOf('/') + 1)

    if (
      url.startsWith(TYPESCRIPT_CDN_PREFIX) &&
      TYPESCRIPT_OPTIONAL_LIBS.has(fileName)
    ) {
      return new Response('', {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    }

    const response = await fetch(input, init)

    if (response.ok || !url.startsWith(TYPESCRIPT_CDN_PREFIX) || response.status !== 404) {
      return response
    }

    return new Response('', {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  const twoslash = createTwoslashFromCDN({
    compilerOptions: TWOSLASH_COMPILER_OPTIONS,
    twoSlashOptionsOverrides: {
      compilerOptions: TWOSLASH_COMPILER_OPTIONS,
    },
    fetcher: twoslashFetch,
    fsMap: new Map([
      [TWOSLASH_TYPES_PATH, arrowTypes],
      ['/App.ts', FrameworkExamples.app],
      ['/app.ts', FrameworkExamples.app],
      ['/entry-server.ts', FrameworkExamples.server],
      ['/entry-client.ts', FrameworkExamples.client],
    ]),
  })

  await twoslash.init()

  return {
    highlighter,
    twoslashTransformer: createTransformerFactory(twoslash.runSync, rendererRich()),
  }
}

async function loadHighlighter() {
  if (!highlighterLoader) {
    highlighterLoader = initHighlighter()
  }
  return highlighterLoader
}

function renderCodeBlock(
  highlighter: Awaited<ReturnType<typeof initHighlighter>>['highlighter'],
  twoslashTransformer: Awaited<ReturnType<typeof initHighlighter>>['twoslashTransformer'],
  code: string,
  lang: string,
  enableTwoslash: boolean
) {
  const options = {
    lang,
    theme: 'css-variables',
  }

  if (lang !== 'ts' || !enableTwoslash) {
    return highlighter.codeToHtml(code, options)
  }

  try {
    const html = highlighter.codeToHtml(`${TWOSLASH_REFERENCE}${code}`, {
      ...options,
      transformers: [
        twoslashTransformer({
          throws: true,
        }),
      ],
    })

    return stripTwoslashReferenceLine(html)
  } catch (error) {
    console.error('Arrow docs Twoslash render failed.', error)
    return highlighter.codeToHtml(code, options)
  }
}

export default async function highlight() {
  const { highlighter, twoslashTransformer } = await loadHighlighter()
  const codeBlocks = document.querySelectorAll('pre code[class*="language-"]')

  codeBlocks.forEach((block) => {
    const lang = normalizeLanguage(block.className)
    const code = block.textContent || ''
    const pre = block.parentElement
    const codeBlock = pre?.closest('.code-block')
    const enableTwoslash =
      !block.closest('[data-disable-twoslash="true"]')
    const html = renderCodeBlock(
      highlighter,
      twoslashTransformer,
      code,
      lang,
      enableTwoslash
    )
    const wrapper = createCodeWrapper(html)

    if (wrapper) {
      pre?.replaceWith(wrapper)
    }

    if (codeBlock instanceof HTMLElement && wrapper?.classList.contains('twoslash')) {
      codeBlock.dataset.hasTwoslash = 'true'
    }
  })
}
