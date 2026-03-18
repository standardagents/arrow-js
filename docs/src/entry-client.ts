import '@shikijs/twoslash/style-rich.css'
import { Header } from './components/Header'
import { CliCommand } from './components/CliCommand'
import { hydrateEachIsland, hydrateIntoRoot } from './islands'

type NavigatorWithConnection = Navigator & {
  connection?: {
    saveData?: boolean
  }
}

type IdleWindow = Window & typeof globalThis & {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions
  ) => number
}

await hydrateIntoRoot('header-root', Header(window.location.pathname))
await hydrateEachIsland('[data-island="cli-command"]', () => CliCommand())

if (window.location.pathname.replace(/\/+$/, '') === '/api') {
  const { hydrateApiIslands } = await import('./pages/api/islands')
  await hydrateApiIslands()
} else {
  const { hydrateHomeIslands } = await import('./pages/home/islands')
  await hydrateHomeIslands()
}

// Fix twoslash popups: use position:fixed so they escape overflow:auto parents
document.addEventListener('mouseenter', (e) => {
  const hover = (e.target as Element).closest?.('.twoslash-hover')
  if (!hover) return
  const popup = hover.querySelector('.twoslash-popup-container') as HTMLElement
  if (!popup) return
  const rect = hover.getBoundingClientRect()
  const maxLeft = window.innerWidth - Math.min(popup.offsetWidth, 540) - 16
  popup.style.position = 'fixed'
  popup.style.left = `${Math.max(8, Math.min(rect.left, maxLeft))}px`
  popup.style.top = `${rect.bottom + 4}px`
  popup.style.transform = 'none'
}, true)

const hero = document.getElementById('hero')
if (hero) {
  const browserNavigator = navigator as NavigatorWithConnection
  const idleWindow = window as IdleWindow
  const canLoadCharacterRain =
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
    browserNavigator.connection?.saveData !== true

  if (canLoadCharacterRain) {
    const loadCharacterRain = async () => {
      const { initCharacterRain } = await import('./character-rain')
      initCharacterRain(hero)
    }

    const scheduleCharacterRain = () => {
      if (typeof idleWindow.requestIdleCallback === 'function') {
        idleWindow.requestIdleCallback(() => {
          void loadCharacterRain()
        }, { timeout: 1500 })
        return
      }

      setTimeout(() => {
        void loadCharacterRain()
      }, 500)
    }

    if (document.readyState === 'complete') {
      scheduleCharacterRain()
    } else {
      window.addEventListener('load', scheduleCharacterRain, { once: true })
    }
  }
}
