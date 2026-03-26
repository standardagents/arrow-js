/**
 * Converts rendered HTML from Arrow docs pages into clean markdown.
 * Extracts only <article> content — strips nav, header, footer, hero.
 */

const entities: Record<string, string> = {
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&',
  '&quot;': '"',
  '&#39;': "'",
  '&mdash;': '—',
  '&ndash;': '–',
  '&nbsp;': ' ',
}

function decodeEntities(text: string): string {
  return text.replace(/&[a-z0-9#]+;/gi, (m) => entities[m] ?? m)
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, '')).trim()
}

function collapseWhitespace(text: string): string {
  return text.replace(/[ \t]+/g, ' ').trim()
}

function stripBalancedDiv(html: string, className: string): string {
  const open = `<div class="${className}">`
  let idx = html.indexOf(open)
  while (idx !== -1) {
    let depth = 0
    let i = idx
    const divOpen = /<div[\s>]/g
    const divClose = /<\/div>/g
    const tag = /<\/?div[\s>]/g
    tag.lastIndex = idx
    let end = -1
    while (true) {
      const m = tag.exec(html)
      if (!m) break
      if (m[0].startsWith('</')) {
        depth--
        if (depth === 0) {
          end = m.index + '</div>'.length
          break
        }
      } else {
        depth++
      }
    }
    if (end === -1) break
    html = html.slice(0, idx) + html.slice(end)
    idx = html.indexOf(open)
  }
  return html
}

export function htmlToMarkdown(html: string): string {
  // Extract article content only
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/)
  if (!articleMatch) return ''
  let content = articleMatch[1]

  // Strip interactive UI components that shouldn't appear in markdown
  content = stripBalancedDiv(content, 'copy-menu')
  content = content.replace(/<a[^>]*class="playground-cta"[^>]*>[\s\S]*?<\/a>/g, '')

  // Convert example card grids into markdown-friendly lists
  content = content.replace(
    /<div class="grid[^"]*">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/g,
    (grid) => {
      const cards: string[] = []
      const cardPattern =
        /<h3[^>]*>([\s\S]*?)<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>[\s\S]*?<a\s+href="([^"]*)"[^>]*>\s*Open in Playground\s*<\/a>/g
      let m: RegExpExecArray | null
      while ((m = cardPattern.exec(grid)) !== null) {
        const title = stripTags(m[1]).trim()
        const desc = stripTags(m[2]).trim()
        cards.push(
          `<li><a href="${m[3]}">${title}</a> — ${desc}</li>`
        )
      }
      return cards.length
        ? `<ul>${cards.join('')}</ul>`
        : ''
    }
  )

  const lines: string[] = []

  // Process section by section
  const sections = content.split(/<section[^>]*>/)
  for (const section of sections) {
    if (!section.trim()) continue
    const sectionContent = section.replace(/<\/section>/, '')
    processBlock(sectionContent, lines)
    lines.push('') // blank line between sections
  }

  // Clean up excessive blank lines
  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    + '\n'
}

function processBlock(html: string, lines: string[]): void {
  // Split on major block elements and process sequentially
  const tokens = tokenize(html)

  for (const token of tokens) {
    switch (token.type) {
      case 'h2':
        lines.push(`## ${collapseWhitespace(stripTags(token.content))}`)
        lines.push('')
        break
      case 'h3':
        lines.push(`### ${collapseWhitespace(stripTags(token.content))}`)
        lines.push('')
        break
      case 'h4':
        lines.push(`#### ${collapseWhitespace(stripTags(token.content))}`)
        lines.push('')
        break
      case 'p':
        lines.push(inlineMarkdown(token.content))
        lines.push('')
        break
      case 'codeblock': {
        const langMatch = token.content.match(/class="language-(\w+)"/)
        const lang = langMatch ? langMatch[1] : ''
        const code = stripTags(token.content)
        lines.push('```' + lang)
        lines.push(code)
        lines.push('```')
        lines.push('')
        break
      }
      case 'ul':
        processListItems(token.content, lines, '-')
        lines.push('')
        break
      case 'ol':
        processListItems(token.content, lines, '1.')
        lines.push('')
        break
      case 'callout': {
        const labelMatch = token.content.match(
          /<div class="callout-label">([\s\S]*?)<\/div>/
        )
        const label = labelMatch ? stripTags(labelMatch[1]) : ''
        const body = token.content
          .replace(/<div class="callout-label">[\s\S]*?<\/div>/, '')
          .trim()

        if (label) {
          lines.push(`> **${label}**`)
        }

        // Process callout body — may contain <p>, <ul>, etc.
        const bodyTokens = tokenize(body)
        for (const bt of bodyTokens) {
          if (bt.type === 'p') {
            lines.push(`> ${inlineMarkdown(bt.content)}`)
          } else if (bt.type === 'ul') {
            const items = bt.content.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) ?? []
            for (const item of items) {
              lines.push(`> - ${inlineMarkdown(item.replace(/<\/?li[^>]*>/g, ''))}`)
            }
          } else if (bt.type === 'codeblock') {
            const langMatch = bt.content.match(/class="language-(\w+)"/)
            const lang = langMatch ? langMatch[1] : ''
            lines.push('> ```' + lang)
            for (const codeLine of stripTags(bt.content).split('\n')) {
              lines.push(`> ${codeLine}`)
            }
            lines.push('> ```')
          }
        }
        lines.push('')
        break
      }
      case 'text': {
        const text = collapseWhitespace(stripTags(token.content))
        if (text) {
          lines.push(text)
          lines.push('')
        }
        break
      }
    }
  }
}

interface Token {
  type: 'h2' | 'h3' | 'h4' | 'p' | 'codeblock' | 'ul' | 'ol' | 'callout' | 'text'
  content: string
}

function tokenize(html: string): Token[] {
  const tokens: Token[] = []
  const pattern =
    /(<h2[^>]*>[\s\S]*?<\/h2>)|(<h3[^>]*>[\s\S]*?<\/h3>)|(<h4[^>]*>[\s\S]*?<\/h4>)|(<div class="code-block"[^>]*>\s*<pre><code[^>]*>[\s\S]*?<\/code>\s*<\/pre>\s*<\/div>)|(<div class="callout[^"]*">[\s\S]*?<\/div>[\s\S]*?<\/div>)|(<ul[^>]*>[\s\S]*?<\/ul>)|(<ol[^>]*>[\s\S]*?<\/ol>)|(<p[^>]*>[\s\S]*?<\/p>)/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(html)) !== null) {
    // Capture any text between matched elements
    if (match.index > lastIndex) {
      const between = html.substring(lastIndex, match.index).trim()
      if (between) {
        tokens.push({ type: 'text', content: between })
      }
    }
    lastIndex = match.index + match[0].length

    const content = match[0]
    if (match[1]) tokens.push({ type: 'h2', content })
    else if (match[2]) tokens.push({ type: 'h3', content })
    else if (match[3]) tokens.push({ type: 'h4', content })
    else if (match[4]) tokens.push({ type: 'codeblock', content })
    else if (match[5]) tokens.push({ type: 'callout', content })
    else if (match[6]) tokens.push({ type: 'ul', content })
    else if (match[7]) tokens.push({ type: 'ol', content })
    else if (match[8]) tokens.push({ type: 'p', content })
  }

  // Trailing text
  if (lastIndex < html.length) {
    const trailing = html.substring(lastIndex).trim()
    if (trailing) {
      tokens.push({ type: 'text', content: trailing })
    }
  }

  return tokens
}

function processListItems(
  html: string,
  lines: string[],
  marker: string
): void {
  const items = html.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) ?? []
  for (const item of items) {
    const text = inlineMarkdown(item.replace(/<\/?li[^>]*>/g, ''))
    lines.push(`${marker} ${text}`)
  }
}

function inlineMarkdown(html: string): string {
  let text = html
  const codePlaceholders: string[] = []
  // Convert inline code
  text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/g, (_, inner) => {
    const placeholder = `__INLINE_CODE_${codePlaceholders.length}__`
    codePlaceholders.push('`' + decodeEntities(inner) + '`')
    return placeholder
  })
  // Convert links
  text = text.replace(
    /<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g,
    (_, href, inner) => `[${stripTags(inner)}](${href})`
  )
  // Convert strong/b
  text = text.replace(/<(?:strong|b)>([\s\S]*?)<\/(?:strong|b)>/g, '**$1**')
  // Convert em/i
  text = text.replace(/<(?:em|i)>([\s\S]*?)<\/(?:em|i)>/g, '*$1*')
  // Strip remaining tags
  text = decodeEntities(text.replace(/<[^>]+>/g, ''))
  for (const [index, code] of codePlaceholders.entries()) {
    text = text.replace(`__INLINE_CODE_${index}__`, code)
  }
  return collapseWhitespace(text)
}
