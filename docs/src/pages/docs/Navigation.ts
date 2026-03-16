import { html, reactive } from '@arrow-js/core'

interface NavItem {
  id: string
  label: string
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const navigation: NavGroup[] = [
  {
    title: 'Essentials',
    items: [
      { id: 'what-is-arrow', label: 'What is Arrow' },
      { id: 'quick-start', label: 'Quickstart' },
      { id: 'components', label: 'Components' },
    ],
  },
  {
    title: 'API',
    items: [
      { id: 'reactive-data', label: 'Reactive (r)' },
      { id: 'watching-data', label: 'Watch (w)' },
      { id: 'templates', label: 'HTML (t)' },
      { id: 'ssr', label: 'SSR' },
      { id: 'hydration', label: 'Hydration' },
      { id: 'ecosystem', label: 'Ecosystem' },
    ],
  },
  {
    title: 'Examples',
    items: [{ id: 'examples', label: 'Playground' }],
  },
]

const allIds = navigation.flatMap((g) => g.items.map((i) => i.id))
const spy = reactive({ active: '' })

function initScrollSpy() {
  if (typeof IntersectionObserver === 'undefined') return

  const visible = new Set<string>()

  const update = () => {
    const doc = document.documentElement
    const atBottom =
      doc.scrollTop + doc.clientHeight >= doc.scrollHeight - 10

    if (atBottom) {
      spy.active = allIds[allIds.length - 1]
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
    { rootMargin: '-80px 0px -60% 0px' }
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
      ${group.items.map(
        (item) =>
          html`<a
            href="${`#${item.id}`}"
            class="nav-link"
            data-active="${() => (spy.active === item.id ? '' : false)}"
            >${item.label}</a
          >`
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
