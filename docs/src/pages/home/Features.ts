import { html } from '@arrow-js/core'
import type { ArrowTemplate } from '@arrow-js/core'

interface Feature {
  icon: () => ArrowTemplate
  title: string
  description: string
}

const features: Feature[] = [
  {
    icon: () =>
      html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-6 h-6"><path d="M13 10V3L4 14h7v7l9-11h-7z" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    title: '< 3KB Runtime',
    description:
      "Smaller than most favicons. Arrow's entire core ships in under 3KB min+gzip. Your users will thank you.",
  },
  {
    icon: () =>
      html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-6 h-6"><path d="M20 12V8H6a2 2 0 01-2-2c0-1.1.9-2 2-2h12v4" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 12a2 2 0 000 4h4v-4h-4z" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    title: 'Zero Dependencies',
    description:
      'No runtime dependencies. No transitive risk. No supply chain surface area. Just Arrow.',
  },
  {
    icon: () =>
      html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-6 h-6"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    title: 'No Build Step',
    description:
      'Pull Arrow from a CDN and start building. Works with or without build tools. Your choice.',
  },
  {
    icon: () =>
      html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-6 h-6"><path d="M12 2L2 7l10 5 10-5-10-5z" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 17l10 5 10-5" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12l10 5 10-5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    title: 'Platform Native',
    description:
      'Template literals, ES modules, Proxies. Arrow leverages what JavaScript already gives you.',
  },
  {
    icon: () =>
      html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-6 h-6"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="8" y1="21" x2="16" y2="21" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="17" x2="12" y2="21" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    title: 'SSR & Hydration',
    description:
      'Server-render your UI and hydrate on the client. Async components, boundaries, and payload serialization included.',
  },
  {
    icon: () =>
      html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-6 h-6"><polyline points="4 17 10 11 4 5" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="19" x2="20" y2="19" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    title: 'Type Safe',
    description:
      'Full TypeScript definitions. Props, computed values, and SSR helpers all type-checked in your editor.',
  },
]

function FeatureCard(feature: Feature) {
  return html`
    <div
      class="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30"
    >
      <div
        class="w-10 h-10 rounded-lg bg-arrow-500/10 flex items-center justify-center text-arrow-600 dark:text-arrow-400 mb-4"
      >
        ${feature.icon()}
      </div>
      <h3 class="text-base font-semibold text-zinc-900 dark:text-white mb-2">
        ${feature.title}
      </h3>
      <p class="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
        ${feature.description}
      </p>
    </div>
  `
}

export function Features() {
  return html`
    <section class="py-20 md:py-28 px-6">
      <div class="max-w-7xl mx-auto">
        <div class="text-center mb-14">
          <h2
            class="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white"
          >
            Everything you need, nothing you don't
          </h2>
          <p
            class="mt-4 text-lg text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto"
          >
            Arrow does less so you can do more. Four exports. Entire reactive UI
            in the browser or on the server.
          </p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          ${features.map((f) => FeatureCard(f))}
        </div>
      </div>
    </section>
  `
}
