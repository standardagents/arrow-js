import { renderToString, serializePayload } from '@arrow-js/ssr'
import { createPage } from './app'
import { htmlToMarkdown } from './html-to-markdown'

function renderHead(page: { title: string; description: string }) {
  return [
    `<title>${page.title}</title>`,
    `<meta name="description" content="${page.description}" />`,
  ].join('')
}

export async function renderPage(url: string) {
  const page = createPage(url)
  const result = await renderToString(page.view)

  return {
    html: result.html,
    head: renderHead(page),
    payloadScript: serializePayload({
      ...result.payload,
      path: url,
    }),
    status: 200,
  }
}

export async function renderMarkdown(url: string) {
  const page = createPage(url)
  const result = await renderToString(page.view)
  return htmlToMarkdown(result.html)
}
