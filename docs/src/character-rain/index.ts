import { RESIZE_DEBOUNCE } from './constants'
import {
  createEngine,
  resumeEngine,
  pauseEngine,
  destroyEngine,
  updateCursor,
  hideCursor,
  updateColliders,
  updateWalls,
  type RainEngine,
} from './engine'
import {
  createRenderer,
  startRenderLoop,
  stopRenderLoop,
  sizeCanvas,
  destroyRenderer,
  type RainRenderer,
} from './renderer'

export function initCharacterRain(heroEl: HTMLElement): () => void {
  // Respect reduced motion
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return () => {}
  }

  // Wait for fonts before measuring character widths
  document.fonts.ready.then(() => {
    boot(heroEl)
  })

  let cleanup: (() => void) | null = null

  function boot(el: HTMLElement) {
    const rain = createEngine(el)
    const renderer = createRenderer(el)

    // --- Intersection Observer: pause when hero is off-screen ---
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          resumeEngine(rain)
          startRenderLoop(renderer, rain)
        } else {
          pauseEngine(rain)
          stopRenderLoop(renderer)
        }
      },
      { threshold: 0 }
    )
    io.observe(el)

    // --- Visibility change: pause when tab is backgrounded ---
    function onVisibility() {
      if (document.hidden) {
        pauseEngine(rain)
        stopRenderLoop(renderer)
      } else {
        // Only resume if hero is actually visible
        const rect = el.getBoundingClientRect()
        const visible = rect.bottom > 0 && rect.top < window.innerHeight
        if (visible) {
          resumeEngine(rain)
          startRenderLoop(renderer, rain)
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    // --- Mouse interaction ---
    function onMouseMove(e: MouseEvent) {
      const rect = el.getBoundingClientRect()
      updateCursor(rain, e.clientX - rect.left, e.clientY - rect.top)
    }
    function onMouseLeave() {
      hideCursor(rain)
    }
    el.addEventListener('mousemove', onMouseMove)
    el.addEventListener('mouseleave', onMouseLeave)

    // --- Resize handling ---
    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    function onResize() {
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        sizeCanvas(renderer.canvas, renderer.ctx, el)
        updateWalls(rain)
        updateColliders(rain)
      }, RESIZE_DEBOUNCE)
    }
    window.addEventListener('resize', onResize)

    // --- Cleanup function ---
    cleanup = () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      el.removeEventListener('mousemove', onMouseMove)
      el.removeEventListener('mouseleave', onMouseLeave)
      window.removeEventListener('resize', onResize)
      if (resizeTimer) clearTimeout(resizeTimer)
      destroyEngine(rain)
      destroyRenderer(renderer)
    }
  }

  return () => {
    if (cleanup) cleanup()
  }
}
