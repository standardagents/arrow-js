import { layout } from './layout'

const defaultSiteUrl = 'https://arrow-js.com'
const defaultOgImageUrl = 'https://assets.arrow-js.com/og.webp?2'

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
  return new URL(url, defaultSiteUrl).pathname.replace(/\/+$/, '') || '/'
}

const defaultImageAlt =
  'ArrowJS logo on a light grid background with the text: A tiny, blazing-fast, type-safe reactive framework with WASM sandboxing for safe AI-generated UIs.'

interface CreatePageOptions {
  highlightCode?: boolean
  baseUrl?: string
}

async function createApiPage(
  url: string,
  options: CreatePageOptions = {}
): Promise<DocsPage> {
  const { ApiPage } = await import('./pages/api/index')
  const siteUrl = options.baseUrl || defaultSiteUrl

  return {
    title: 'API Reference — ArrowJS',
    description:
      'Comprehensive API reference for every ArrowJS export across @arrow-js/core, framework, ssr, hydrate, and sandbox.',
    canonicalUrl: `${siteUrl}/api`,
    imageUrl: defaultOgImageUrl,
    imageAlt: defaultImageAlt,
    ogType: 'website' as const,
    view: layout(ApiPage(options), url),
  }
}

async function createHomePageWithOptions(
  url: string,
  options: CreatePageOptions = {}
): Promise<DocsPage> {
  const { HomePage } = await import('./pages/home/index')
  const siteUrl = options.baseUrl || defaultSiteUrl

  return {
    title: 'ArrowJS — The first UI framework for the agentic era',
    description:
      'A tiny, blazing-fast, zero-dependency, type-safe framework. No build step required. Isolate agent-generated UI inside WebAssembly sandboxes while rendering full inline DOM directly in your app — no iframes, no pre-defined components.',
    canonicalUrl: `${siteUrl}/`,
    imageUrl: defaultOgImageUrl,
    imageAlt: defaultImageAlt,
    ogType: 'website' as const,
    view: layout(HomePage(options), url),
  }
}

export async function createPage(
  url: string,
  options: CreatePageOptions = {}
): Promise<DocsPage> {
  const path = normalizePath(url)
  if (path === '/api') return createApiPage(url, options)
  return createHomePageWithOptions(url, options)
}

export const routeToPage = createPage
