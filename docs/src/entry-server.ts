import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToString } from '@arrow-js/ssr'
import { createPage } from './app'
import { htmlToMarkdown } from './html-to-markdown'
import {
  playgroundExampleMeta,
  playgroundExampleHref,
} from '../play/example-meta.js'
import type { DocsPage } from './app'

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function renderHead(
  page: Pick<
    DocsPage,
    'title' | 'description' | 'canonicalUrl' | 'imageUrl' | 'imageAlt' | 'ogType'
  >,
) {
  return [
    `<title>${escapeHtml(page.title)}</title>`,
    `<meta name="description" content="${escapeHtml(page.description)}" />`,
    `<link rel="canonical" href="${escapeHtml(page.canonicalUrl)}" />`,
    `<meta property="og:type" content="${escapeHtml(page.ogType)}" />`,
    `<meta property="og:site_name" content="ArrowJS" />`,
    `<meta property="og:title" content="${escapeHtml(page.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(page.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(page.canonicalUrl)}" />`,
    `<meta property="og:image" content="${escapeHtml(page.imageUrl)}" />`,
    `<meta property="og:image:type" content="image/webp" />`,
    `<meta property="og:image:alt" content="${escapeHtml(page.imageAlt)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="628" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(page.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(page.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(page.imageUrl)}" />`,
    `<meta name="twitter:image:alt" content="${escapeHtml(page.imageAlt)}" />`,
  ].join('')
}

export async function renderPage(url: string) {
  const page = await createPage(url)
  const result = await renderToString(page.view)

  return {
    html: result.html,
    head: renderHead(page),
    payloadScript: '',
    status: 200,
  }
}

export async function renderMarkdown(url: string) {
  const page = await createPage(url, { highlightCode: false })
  const result = await renderToString(page.view)
  const markdown = htmlToMarkdown(result.html)
  const path = new URL(url, 'http://arrow.local').pathname

  if (path === '/') {
    return markdown.replace(/\n## Examples[\s\S]*$/m, '\n')
  }

  return markdown
}

const langFor: Record<string, string> = {
  '.ts': 'ts',
  '.css': 'css',
  '.html': 'html',
  '.js': 'js',
}

function decodeSnapshot(encoded: string): { active: string; files: [string, string][] } | null {
  try {
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '==='.slice((normalized.length + 3) % 4)
    const binary = Buffer.from(padded, 'base64').toString('binary')
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    const json = new TextDecoder().decode(bytes)
    const parsed = JSON.parse(json)
    if (!parsed || !Array.isArray(parsed.files)) return null
    const filePattern = /^[A-Za-z][A-Za-z0-9_-]*\.(ts|css)$/
    const files = parsed.files.filter(
      (e: unknown): e is [string, string] =>
        Array.isArray(e) &&
        typeof e[0] === 'string' &&
        typeof e[1] === 'string' &&
        filePattern.test(e[0]),
    )
    if (!files.length) return null
    return { active: parsed.active ?? files[0][0], files }
  } catch {
    return null
  }
}

export async function renderPlayground(snapshot?: string): Promise<string> {
  if (snapshot) {
    return renderSnapshotMarkdown(snapshot)
  }
  const docsRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../..',
  )
  const examplesDir = path.join(docsRoot, 'play/examples')
  const lines: string[] = [
    '# Arrow Playground Examples',
    '',
    'Interactive code examples for Arrow.js. Each example can be opened in the live playground editor.',
    '',
  ]

  for (const example of playgroundExampleMeta) {
    const dir = path.join(examplesDir, example.id)
    let files: string[]
    try {
      files = (await fs.readdir(dir)).filter(
        (f) => !f.startsWith('.') && f !== 'main.ts',
      )
    } catch {
      continue
    }

    // Sort: app/entry files first, then components, then styles
    files.sort((a, b) => {
      const rank = (f: string) =>
        f.toLowerCase().startsWith('app') || f.toLowerCase().includes('app')
          ? 0
          : f.endsWith('.css')
            ? 2
            : 1
      return rank(a) - rank(b)
    })

    const href = playgroundExampleHref(example.id)
    lines.push(`## ${example.title}`)
    lines.push('')
    lines.push(`${example.description}`)
    lines.push('')
    lines.push(`[Open in Playground](${href})`)
    lines.push('')

    for (const file of files) {
      const ext = path.extname(file)
      const lang = langFor[ext] ?? ''
      const content = await fs.readFile(path.join(dir, file), 'utf-8')
      lines.push(`### ${file}`)
      lines.push('')
      lines.push('```' + lang)
      lines.push(content.trimEnd())
      lines.push('```')
      lines.push('')
    }
  }

  return lines.join('\n')
}

function renderSnapshotMarkdown(encoded: string): string {
  const snapshot = decodeSnapshot(encoded)
  if (!snapshot) {
    return '# Arrow Playground\n\nCould not decode the provided snapshot.\n'
  }

  const lines: string[] = [
    '# Arrow Playground',
    '',
    'User-authored playground code.',
    '',
  ]

  for (const [name, code] of snapshot.files) {
    if (name === 'main.ts') continue
    const ext = path.extname(name)
    const lang = langFor[ext] ?? ''
    lines.push(`## ${name}`)
    lines.push('')
    lines.push('```' + lang)
    lines.push(code.trimEnd())
    lines.push('```')
    lines.push('')
  }

  return lines.join('\n')
}
