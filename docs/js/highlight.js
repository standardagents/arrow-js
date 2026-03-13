const SHIKI_URL = 'https://cdn.jsdelivr.net/npm/shiki@0.14.7/dist/index.unpkg.iife.js'
const SHIKI_CDN = 'https://cdn.jsdelivr.net/npm/shiki@0.14.7/'
const TEMPLATE_COLOR = 'var(--shiki-token-string-expression)'
const TEMPLATE_EXPR_COLOR = 'var(--shiki-token-keyword)'

let shikiLoader

function loadShiki() {
  if (globalThis.shiki) return Promise.resolve(globalThis.shiki)
  if (shikiLoader) return shikiLoader
  shikiLoader = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SHIKI_URL
    script.onload = () => {
      if (globalThis.shiki) {
        globalThis.shiki.setCDN(SHIKI_CDN)
        resolve(globalThis.shiki)
      } else {
        reject(new Error('Shiki failed to initialize'))
      }
    }
    script.onerror = () => reject(new Error('Failed to load Shiki'))
    document.head.append(script)
  })
  return shikiLoader
}

function appendLineTokens(target, lines) {
  if (!lines.length) return
  target[target.length - 1].push(...lines[0])
  for (let i = 1; i < lines.length; i++) target.push(lines[i].slice())
}

function appendPlain(target, text, color) {
  const lines = String(text).split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]) {
      target[target.length - 1].push({
        content: lines[i],
        color,
        fontStyle: 0,
      })
    }
    if (i < lines.length - 1) target.push([])
  }
}

function skipString(source, index, quote) {
  for (let i = index + 1; i < source.length; i++) {
    if (source[i] === '\\') {
      i++
      continue
    }
    if (source[i] === quote) return i + 1
  }
  return source.length
}

function skipLineComment(source, index) {
  const next = source.indexOf('\n', index + 2)
  return next === -1 ? source.length : next
}

function skipBlockComment(source, index) {
  const next = source.indexOf('*/', index + 2)
  return next === -1 ? source.length : next + 2
}

function skipTemplateLiteral(source, index) {
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

function skipJsExpression(source, index) {
  let depth = 0
  for (let i = index; i < source.length; i++) {
    const char = source[i]
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

function isTemplateTagStart(source, index) {
  if (!source.startsWith('html`', index) && !source.startsWith('t`', index)) {
    return 0
  }
  const prev = source[index - 1]
  if (prev && /[\w$.]/.test(prev)) return 0
  return source[index] === 'h' ? 5 : 2
}

function createArrowHighlighter(highlighter, shiki, langs) {
  const tokenCache = new Map()
  const langMap = langs
  const fg = highlighter.getForegroundColor('css-variables')
  const bg = highlighter.getBackgroundColor('css-variables')

  const tokenize = (code, lang) => {
    const key = `${lang}\0${code}`
    const cached = tokenCache.get(key)
    if (cached) return cached
    const lines = highlighter.codeToThemedTokens(code, langMap[lang] || lang)
    tokenCache.set(key, lines)
    return lines
  }

  const appendHighlighted = (target, code, lang) => {
    if (!code) return
    appendLineTokens(target, tokenize(code, lang))
  }

  const appendJs = (target, source, index, untilBrace = false) => {
    let start = index
    let depth = 0
    let i = index

    while (i < source.length) {
      const char = source[i]
      const tagLength = isTemplateTagStart(source, i)

      if (tagLength) {
        appendHighlighted(target, source.slice(start, i + tagLength - 1), 'js')
        appendPlain(target, '`', TEMPLATE_COLOR)
        i += tagLength
        start = appendTemplate(target, source, i)
        i = start
        continue
      }

      if (char === "'" || char === '"') {
        i = skipString(source, i, char)
        continue
      }
      if (char === '`') {
        i = skipTemplateLiteral(source, i)
        continue
      }
      if (char === '/' && source[i + 1] === '/') {
        i = skipLineComment(source, i)
        continue
      }
      if (char === '/' && source[i + 1] === '*') {
        i = skipBlockComment(source, i)
        continue
      }
      if (untilBrace) {
        if (char === '{') {
          depth++
        } else if (char === '}') {
          if (!depth) {
            appendHighlighted(target, source.slice(start, i), 'js')
            return i + 1
          }
          depth--
        }
      }
      i++
    }

    appendHighlighted(target, source.slice(start), 'js')
    return source.length
  }

  const appendTemplate = (target, source, index) => {
    let start = index
    let i = index

    while (i < source.length) {
      if (source[i] === '$' && source[i + 1] === '{') {
        appendHighlighted(target, source.slice(start, i), 'html')
        appendPlain(target, '${', TEMPLATE_EXPR_COLOR)
        i = appendJs(target, source, i + 2, true)
        appendPlain(target, '}', TEMPLATE_EXPR_COLOR)
        start = i
        continue
      }
      if (source[i] === '`') {
        appendHighlighted(target, source.slice(start, i), 'html')
        appendPlain(target, '`', TEMPLATE_COLOR)
        return i + 1
      }
      i++
    }

    appendHighlighted(target, source.slice(start), 'html')
    return source.length
  }

  return (code) => {
    const lines = [[]]
    appendJs(lines, code, 0)
    return shiki.renderToHtml(lines, {
      fg,
      bg,
      themeName: 'css-variables',
    })
  }
}

export default async function () {
  const langs = {
    javascript: 'js',
    js: 'js',
    html: 'html',
  }

  const shiki = await loadShiki()
  const highlighter = await shiki.getHighlighter({
    theme: 'css-variables',
    langs: ['js', 'html', 'shell'],
  })
  const highlightArrow = createArrowHighlighter(highlighter, shiki, langs)
  const codeBlocks = document.querySelectorAll('pre code[class*="language-"]')

  codeBlocks.forEach((block) => {
    const lang = block.className.replace('language-', '')
    const code = block.textContent || ''
    const html =
      (lang === 'javascript' || lang === 'js') &&
      (code.includes('html`') || code.includes('t`'))
        ? highlightArrow(code)
        : highlighter.codeToHtml(code, {
            lang: langs[lang] || lang,
          })
    block.parentElement?.replaceWith(
      Object.assign(document.createElement('template'), {
        innerHTML: html,
      }).content.firstElementChild
    )
  })
}
