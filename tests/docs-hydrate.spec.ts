import { describe, expect, it } from 'vitest'
import { hydrate } from '@arrow-js/hydrate'
import { renderToString } from '@arrow-js/ssr'
import { routeToPage } from '../docs/src/app'
import { renderPage } from '../docs/src/entry-server'

describe('docs hydration', () => {
  it('renders canonical, Open Graph, and Twitter metadata for site routes', async () => {
    const docs = await renderPage('/?ref=test')
    const api = await renderPage('/api?ref=test')

    expect(docs.head).toContain('<link rel="canonical" href="https://arrow-js.com/" />')
    expect(docs.head).toContain('<meta property="og:url" content="https://arrow-js.com/" />')
    expect(docs.head).toContain(
      '<meta property="og:title" content="ArrowJS — The first UI framework for the agentic era" />'
    )
    expect(docs.head).toContain(
      '<meta property="og:image" content="https://assets.arrow-js.com/og.webp?2" />'
    )
    expect(docs.head).toContain('<meta property="og:image:type" content="image/webp" />')
    expect(docs.head).toContain('<meta property="og:image:width" content="1200" />')
    expect(docs.head).toContain('<meta property="og:image:height" content="628" />')
    expect(docs.head).toContain('<meta name="twitter:card" content="summary_large_image" />')
    expect(docs.head).toContain(
      '<meta name="twitter:image" content="https://assets.arrow-js.com/og.webp?2" />'
    )
    expect(docs.head).toContain(
      '<meta name="twitter:description" content="A tiny, blazing-fast, zero-dependency, type-safe framework. No build step required. Isolate agent-generated UI inside WebAssembly sandboxes while rendering full inline DOM directly in your app — no iframes, no pre-defined components." />'
    )

    expect(api.head).toContain('<link rel="canonical" href="https://arrow-js.com/api" />')
    expect(api.head).toContain('<meta property="og:url" content="https://arrow-js.com/api" />')
    expect(api.head).toContain('<meta property="og:title" content="API Reference — ArrowJS"')
    expect(api.head).toContain(
      '<meta property="og:image:alt" content="ArrowJS logo on a light grid background with the text: A tiny, blazing-fast, type-safe reactive framework with WASM sandboxing for safe AI-generated UIs." />'
    )
    expect(api.head).toContain(
      '<meta name="twitter:description" content="Comprehensive API reference for every ArrowJS export across @arrow-js/core, framework, ssr, hydrate, and sandbox." />'
    )
  })

  it('renders the shared header controls in SSR output', async () => {
    const page = await routeToPage('/')
    const ssr = await renderToString(page.view)

    expect(ssr.html).toMatch(/aria-label="GitHub[^"]*"/)
    expect(ssr.html).toContain('aria-label="Follow on X"')
    expect(ssr.html).toContain('aria-label="Toggle theme"')
    expect(ssr.html).toContain('class="header-nav-link"')
  })

  it('adopts the home page without replacing the root', async () => {
    const { result, existing, root } = await hydratePage('/')

    expect(result.adopted).toBe(true)
    expect(root.firstElementChild).toBe(existing)
  })

  it('adopts the api page without replacing the root', async () => {
    const { result, existing, root } = await hydratePage('/api')

    expect(result.adopted).toBe(true)
    expect(root.firstElementChild).toBe(existing)
  })

  it('repairs a missing home cli command without replacing intact siblings', async () => {
    const root = document.createElement('div')
    const serverPage = await routeToPage('/')
    const ssr = await renderToString(serverPage.view)
    root.innerHTML = ssr.html

    const existingHero = root.querySelector('#hero')
    root.querySelector('.cli-command')?.remove()

    const clientPage = await routeToPage('/')
    const result = await hydrate(root, clientPage.view, ssr.payload)

    expect(result.adopted).toBe(true)
    expect(result.mismatches).toBeGreaterThan(0)
    expect(root.querySelector('#hero')).toBe(existingHero)
    expect(root.querySelector('.cli-command')?.textContent).toContain('pnpm')
    expect(root.querySelector('.cli-command code')?.textContent).toContain('arrow-js@latest')
  })
})

async function hydratePage(path: string) {
  const root = document.createElement('div')
  const serverPage = await routeToPage(path)
  const ssr = await renderToString(serverPage.view)
  root.innerHTML = ssr.html

  const existing = root.firstElementChild
  const clientPage = await routeToPage(path)
  const result = await hydrate(root, clientPage.view, ssr.payload)

  return {
    root,
    existing,
    result,
  }
}
