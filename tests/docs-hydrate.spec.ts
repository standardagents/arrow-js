import { describe, expect, it } from 'vitest'
import { nextTick } from '@arrow-js/core'
import { hydrate } from '@arrow-js/hydrate'
import { renderToString } from '@arrow-js/ssr'
import { createPage } from '../docs/src/app'
import { renderPage } from '../docs/src/entry-server'

describe('docs hydration', () => {
  it('renders canonical, Open Graph, and Twitter metadata for docs routes', async () => {
    const docs = await renderPage('/docs/?ref=test')
    const api = await renderPage('/api?ref=test')

    expect(docs.head).toContain('<link rel="canonical" href="https://arrow-js.com/" />')
    expect(docs.head).toContain('<meta property="og:url" content="https://arrow-js.com/" />')
    expect(docs.head).toContain('<meta property="og:title" content="Arrow')
    expect(docs.head).toContain(
      '<meta property="og:image" content="https://arrow-js.com/arrow-js-og-meta.webp" />'
    )
    expect(docs.head).toContain('<meta property="og:image:type" content="image/webp" />')
    expect(docs.head).toContain('<meta property="og:image:width" content="1200" />')
    expect(docs.head).toContain('<meta property="og:image:height" content="628" />')
    expect(docs.head).toContain('<meta name="twitter:card" content="summary_large_image" />')
    expect(docs.head).toContain(
      '<meta name="twitter:image" content="https://arrow-js.com/arrow-js-og-meta.webp" />'
    )
    expect(docs.head).toContain(
      '<meta name="twitter:description" content="A ~5KB runtime with zero dependencies. Observable data, declarative DOM, and SSR built on platform primitives." />'
    )

    expect(api.head).toContain('<link rel="canonical" href="https://arrow-js.com/api" />')
    expect(api.head).toContain('<meta property="og:url" content="https://arrow-js.com/api" />')
    expect(api.head).toContain('<meta property="og:title" content="API Reference')
    expect(api.head).toContain(
      '<meta property="og:image:alt" content="ArrowJS logo on a light grid background with the text: A tiny (~5KB), blazing-fast, type-safe reactive framework. Zero dependencies and no build step required." />'
    )
    expect(api.head).toContain(
      '<meta name="twitter:description" content="Comprehensive API reference for every ArrowJS export across @arrow-js/core, framework, ssr, and hydrate." />'
    )
  })

  it('renders the shared header controls in SSR output', async () => {
    const page = createPage('/docs/')
    const ssr = await renderToString(page.view)

    expect(ssr.html).toContain('aria-label="GitHub"')
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

  it('repairs a missing home counter without replacing intact siblings', async () => {
    const root = document.createElement('div')
    const serverPage = createPage('/')
    const ssr = await renderToString(serverPage.view)
    root.innerHTML = ssr.html

    const existingHero = root.querySelector('#hero')
    root.querySelector('#hero-counter')?.remove()

    const clientPage = createPage('/')
    const result = await hydrate(root, clientPage.view, ssr.payload)

    expect(result.adopted).toBe(true)
    expect(result.mismatches).toBeGreaterThan(0)
    expect(root.querySelector('#hero')).toBe(existingHero)
    expect(root.querySelector('#hero-counter')?.textContent).toContain('Clicked 0 times')

    ;(root.querySelector('#hero-counter') as HTMLButtonElement).click()
    await nextTick()

    expect(root.querySelector('#hero-counter')?.textContent).toContain('Clicked 1 times')
  })
})

async function hydratePage(path: string) {
  const root = document.createElement('div')
  const serverPage = createPage(path)
  const ssr = await renderToString(serverPage.view)
  root.innerHTML = ssr.html

  const existing = root.firstElementChild
  const clientPage = createPage(path)
  const result = await hydrate(root, clientPage.view, ssr.payload)

  return {
    root,
    existing,
    result,
  }
}
