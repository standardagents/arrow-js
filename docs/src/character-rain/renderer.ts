import { FONT, TOKEN_COLORS, DPR_CAP } from './constants'
import type { RainEngine } from './engine'
import { despawnOutOfBounds, ageAndFade } from './engine'

export interface RainRenderer {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  rafId: number | null
}

function getTheme(): 'dark' | 'light' {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

export function createRenderer(heroEl: HTMLElement): RainRenderer {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:10;'
  heroEl.appendChild(canvas)

  const ctx = canvas.getContext('2d')!
  sizeCanvas(canvas, ctx, heroEl)

  return { canvas, ctx, rafId: null }
}

export function sizeCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  heroEl: HTMLElement
): void {
  const dpr = Math.min(devicePixelRatio, DPR_CAP)
  const w = heroEl.offsetWidth
  const h = heroEl.offsetHeight
  canvas.width = w * dpr
  canvas.height = h * dpr
  canvas.style.width = w + 'px'
  canvas.style.height = h + 'px'
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

export function startRenderLoop(renderer: RainRenderer, rain: RainEngine): void {
  const { ctx } = renderer
  const heroEl = rain.heroEl

  let lastTime = 0

  function frame(time: number) {
    renderer.rafId = requestAnimationFrame(frame)
    const dt = lastTime ? time - lastTime : 16
    lastTime = time

    const w = heroEl.offsetWidth
    const h = heroEl.offsetHeight
    ctx.clearRect(0, 0, w, h)

    const theme = getTheme()
    const palette = TOKEN_COLORS[theme]
    ctx.font = FONT
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'

    for (const cb of rain.characters) {
      const { body, char, role, opacity } = cb
      ctx.save()
      ctx.translate(body.position.x, body.position.y)
      ctx.rotate(body.angle)
      ctx.globalAlpha = opacity
      ctx.fillStyle = palette[role]
      ctx.fillText(char, 0, 0)
      ctx.restore()
    }

    ageAndFade(rain, dt)
    despawnOutOfBounds(rain)
  }

  renderer.rafId = requestAnimationFrame(frame as FrameRequestCallback)
}

export function stopRenderLoop(renderer: RainRenderer): void {
  if (renderer.rafId !== null) {
    cancelAnimationFrame(renderer.rafId)
    renderer.rafId = null
  }
}

export function destroyRenderer(renderer: RainRenderer): void {
  stopRenderLoop(renderer)
  renderer.canvas.remove()
}
