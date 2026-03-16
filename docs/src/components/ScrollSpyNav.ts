import { html, reactive, watch } from '@arrow-js/core'

export interface NavItem {
  id: string
  label: string
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

export function ScrollSpyNav(groups: NavGroup[]) {
  const allIds = groups.flatMap((g) => g.items.map((i) => i.id))
  const allItems = groups.flatMap((g) => g.items)
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

  function mobile() {
    if (typeof window !== 'undefined') {
      watch(
        () => spy.active,
        (activeId) => {
          if (!activeId) return
          const link = document.querySelector(
            `.mobile-nav a[href="#${activeId}"]`
          ) as HTMLElement | null
          if (!link) return
          const nav = link.closest('.mobile-nav') as HTMLElement | null
          if (!nav) return
          const navRect = nav.getBoundingClientRect()
          const linkRect = link.getBoundingClientRect()
          const offset =
            linkRect.left - navRect.left - navRect.width / 2 + linkRect.width / 2
          nav.scrollBy({ left: offset, behavior: 'smooth' })
        }
      )
    }

    return html`
      <nav
        class="mobile-nav lg:hidden sticky top-16 z-40 border-b border-zinc-200/60 dark:border-zinc-800/60 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl overflow-x-auto"
      >
        <div class="flex items-center gap-1 py-2 px-6 min-w-max">
          ${allItems.map(
            (item) =>
              html`<a
                href="${`#${item.id}`}"
                class="mobile-nav-link"
                data-active="${() => (spy.active === item.id ? '' : false)}"
                >${item.label}</a
              >`
          )}
        </div>
      </nav>
    `
  }

  function sidebar() {
    return html`
      <nav
        class="hidden lg:block w-56 shrink-0 sticky top-24 self-start max-h-[calc(100vh-8rem)] overflow-y-auto"
      >
        ${groups.map(
          (group) => html`
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
        )}
      </nav>
    `
  }

  return { mobile, sidebar }
}
