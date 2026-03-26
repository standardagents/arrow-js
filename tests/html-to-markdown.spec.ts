import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../docs/src/html-to-markdown'

describe('htmlToMarkdown', () => {
  it('preserves custom element names inside inline code spans', () => {
    const markdown = htmlToMarkdown(`
      <article>
        <section>
          <p>
            The sandbox renders through a stable
            <code>&lt;arrow-sandbox&gt;</code>
            custom element.
          </p>
        </section>
      </article>
    `)

    expect(markdown.replace(/\s+/g, ' ')).toContain(
      'The sandbox renders through a stable `<arrow-sandbox>` custom element.'
    )
  })
})
