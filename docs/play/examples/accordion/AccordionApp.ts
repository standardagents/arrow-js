import { component, html } from '@arrow-js/core'
import { AccordionItem } from './AccordionItem'

const items = [
  {
    id: 'what',
    question: 'What is Arrow?',
    answer:
      'Arrow is a tiny reactive UI library built on template literals, reactive proxies, and direct DOM updates. The core runtime is about 3 KB.',
  },
  {
    id: 'reactivity',
    question: 'How does reactivity work?',
    answer:
      'Wrap an object with reactive() to create a proxy. When you read properties inside template expressions or watch() callbacks, Arrow tracks those reads and re-runs the expression when the value changes.',
  },
  {
    id: 'components',
    question: 'Do components survive parent updates?',
    answer:
      'Yes. The factory function runs once per slot. On subsequent parent renders Arrow retargets props without re-running the factory, so local state stays intact.',
  },
  {
    id: 'build',
    question: 'Do I need a build step?',
    answer:
      'No. Arrow works with plain ES modules and a CDN import. A build tool like Vite is optional but adds TypeScript support and HMR.',
  },
  {
    id: 'ssr',
    question: 'Is server rendering supported?',
    answer:
      'The framework, ssr, and hydrate packages add server rendering with boundary-based recovery. The core package stays client-only and build-free.',
  },
]

export const AccordionApp = component(() =>
  html`<main class="acc">
    <header class="acc-header">
      <h1>Frequently Asked Questions</h1>
      <p class="acc-subtitle">
        Each item manages its own open/closed state. Expanding one does not
        affect the others.
      </p>
    </header>

    <section class="acc-list">
      ${items.map((item) =>
        AccordionItem({
          answer: item.answer,
          question: item.question,
        }).key(item.id)
      )}
    </section>
  </main>`
)
