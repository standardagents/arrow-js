import { html, reactive } from '@arrow-js/core'
import {
  docsExampleMeta,
  playgroundExampleHref,
  showcaseMeta,
} from '../../../play/example-meta.js'

type NavItem =
  | {
      label: string
      id: string
      href?: never
    }
  | {
      label: string
      href: string
      id?: never
    }

interface NavGroup {
  title: string
  items: NavItem[]
}

function isIdItem(item: NavItem): item is Extract<NavItem, { id: string }> {
  return typeof item.id === 'string'
}

function isHrefItem(item: NavItem): item is Extract<NavItem, { href: string }> {
  return typeof item.href === 'string'
}

const navigation: NavGroup[] = [
  {
    title: 'Getting Started',
    items: [
      { id: 'why-arrow', label: 'Why Arrow' },
      { id: 'quick-start', label: 'Quickstart' },
      { id: 'community', label: 'Community' },
    ],
  },
  {
    title: 'Essentials',
    items: [
      { id: 'components', label: 'Components' },
      { id: 'reactive-data', label: 'Reactive Data' },
      { id: 'watching-data', label: 'Watching Data' },
      { id: 'templates', label: 'Templates' },
      { id: 'sandbox', label: 'Sandbox' },
      { id: 'routing', label: 'Routing' },
    ],
  },
  {
    title: 'Examples',
    items: [
      { id: 'examples', label: 'Overview' },
      ...docsExampleMeta.map((example) => ({
        label: example.title,
        href: playgroundExampleHref(example.id),
      })),
    ],
  },
  {
    title: 'Made with Arrow',
    items: showcaseMeta.map((entry) => ({
      label: entry.title,
      href: entry.href,
    })),
  },
]

const allIds = navigation.flatMap((group) =>
  group.items.filter(isIdItem).map((item) => item.id),
)
const spy = reactive({ active: '' })

function initScrollSpy() {
  if (typeof IntersectionObserver === 'undefined') return

  const visible = new Set<string>()

  const update = () => {
    const doc = document.documentElement
    const atBottom = doc.scrollTop + doc.clientHeight >= doc.scrollHeight - 10

    if (atBottom) {
      const lastId = allIds.at(-1)
      if (lastId) {
        spy.active = lastId
      }
      return
    }

    for (const id of allIds) {
      if (visible.has(id)) {
        spy.active = id
        return
      }
    }
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          visible.add(entry.target.id)
        } else {
          visible.delete(entry.target.id)
        }
      }
      update()
    },
    { rootMargin: '-80px 0px -60% 0px' },
  )

  window.addEventListener('scroll', update, { passive: true })

  for (const id of allIds) {
    const el = document.getElementById(id)
    if (el) observer.observe(el)
  }
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScrollSpy)
  } else {
    initScrollSpy()
  }
}

function NavGroupView(group: NavGroup) {
  return html`
    <div class="mb-6">
      <div class="nav-group-title">${group.title}</div>
      ${group.items.map((item) =>
        isHrefItem(item)
          ? html`<a href="${item.href}" class="nav-link nav-link-external"
              >${item.label}</a
            >`
          : html`<a
              href="${`#${item.id}`}"
              class="nav-link"
              data-active="${() => (spy.active === item.id ? '' : false)}"
              >${item.label}</a
            >`,
      )}
    </div>
  `
}

export function Navigation() {
  return html`
    <nav
      class="hidden lg:block w-56 shrink-0 sticky top-24 self-start max-h-[calc(100vh-8rem)] overflow-y-auto"
    >
      ${navigation.map((group) => NavGroupView(group))}
    </nav>
  `
}
