import { layout } from './layout'

const siteUrl = 'https://arrow-js.com'

export interface DocsPage {
  title: string
  description: string
  canonicalUrl: string
  imageUrl: string
  imageAlt: string
  ogType: 'website'
  view: ReturnType<typeof layout>
}

function normalizePath(url: string) {
  return new URL(url, siteUrl).pathname.replace(/\/+$/, '') || '/'
}

const defaultImageUrl = `${siteUrl}/arrow-js-og-meta.webp`
const defaultImageAlt =
  'ArrowJS logo on a light grid background with the text: A tiny (~5KB), blazing-fast, type-safe reactive framework. Zero dependencies and no build step required.'

async function createApiPage(
  url: string,
  options: { highlightCode?: boolean } = {}
): Promise<DocsPage> {
  const { ApiPage } = await import('./pages/api/index')

  return {
    title: 'API Reference — Arrow',
    description:
      'Comprehensive API reference for every ArrowJS export across @arrow-js/core, framework, ssr, and hydrate.',
    canonicalUrl: `${siteUrl}/api`,
    imageUrl: defaultImageUrl,
    imageAlt: defaultImageAlt,
    ogType: 'website' as const,
    view: layout(ApiPage(options), url),
  }
}

async function createHomePageWithOptions(
  url: string,
  options: { highlightCode?: boolean } = {}
): Promise<DocsPage> {
  const { HomePage } = await import('./pages/home/index')

  return {
    title: 'ArrowJS — Reactive interfaces in pure JavaScript',
    description:
      'A ~5KB runtime with zero dependencies. Observable data, declarative DOM, and SSR built on platform primitives.',
    canonicalUrl: `${siteUrl}/`,
    imageUrl: defaultImageUrl,
    imageAlt: defaultImageAlt,
    ogType: 'website' as const,
    view: layout(HomePage(options), url),
  }
}

export async function createPage(
  url: string,
  options: { highlightCode?: boolean } = {}
): Promise<DocsPage> {
  const path = normalizePath(url)
  if (path === '/api') return createApiPage(url, options)
  return createHomePageWithOptions(url, options)
}

export const routeToPage = createPage
