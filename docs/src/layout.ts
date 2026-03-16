import { html } from '@arrow-js/core'
import { Header } from './components/Header'
import { Footer } from './components/Footer'

export function layout(content: unknown, url: string = '/') {
  return html`
    <div class="min-h-screen flex flex-col">
      ${Header(url)}
      <main class="flex-1 pt-16">${content}</main>
      ${Footer()}
    </div>
  `
}
