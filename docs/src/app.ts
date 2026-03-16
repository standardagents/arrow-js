import { layout } from './layout'
import { HomePage } from './pages/home/index'
import { ApiPage } from './pages/api/index'

function createHomePage(url: string) {
  return {
    title: 'Arrow — Reactive UI in Pure JavaScript',
    description:
      'A < 3KB runtime with zero dependencies. Observable data, declarative DOM, and SSR built on platform primitives.',
    view: layout(HomePage(), url),
  }
}

function createApiPage(url: string) {
  return {
    title: 'API Reference — Arrow',
    description:
      'Comprehensive API reference for every ArrowJS export across @arrow-js/core, framework, ssr, and hydrate.',
    view: layout(ApiPage(), url),
  }
}

export function createPage(url: string) {
  const path = url.replace(/\/+$/, '') || '/'
  if (path === '/api') return createApiPage(url)
  return createHomePage(url)
}
