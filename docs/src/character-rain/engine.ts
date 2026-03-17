import Matter from 'matter-js'
import {
  ALL_TOKENS,
  FONT,
  OPACITY,
  PHYSICS,
  SPAWN,
  MOBILE_BREAKPOINT,
  MOBILE_SPAWN,
  type TokenRole,
} from './constants'

export interface CharacterBody {
  body: Matter.Body
  char: string
  role: TokenRole
  opacity: number
  maxOpacity: number
  age: number
  lifetime: number
  width: number
  height: number
}

export interface RainEngine {
  engine: Matter.Engine
  runner: Matter.Runner
  characters: CharacterBody[]
  walls: Matter.Body[]
  colliders: Matter.Body[]
  cursor: Matter.Body
  spawnTimer: ReturnType<typeof setInterval> | null
  heroEl: HTMLElement
  measureCtx: CanvasRenderingContext2D
  charSizes: Map<string, { width: number; height: number }>
  paused: boolean
}

function getSpawnConfig() {
  if (window.innerWidth < MOBILE_BREAKPOINT) return { ...SPAWN, ...MOBILE_SPAWN }
  return SPAWN
}

function measureCharacters(ctx: CanvasRenderingContext2D): Map<string, { width: number; height: number }> {
  ctx.font = FONT
  const sizes = new Map<string, { width: number; height: number }>()
  for (const { char } of ALL_TOKENS) {
    if (sizes.has(char)) continue
    const metrics = ctx.measureText(char)
    sizes.set(char, {
      width: metrics.width + 4,
      height: 20,
    })
  }
  return sizes
}

export function createEngine(heroEl: HTMLElement): RainEngine {
  const engine = Matter.Engine.create({
    gravity: PHYSICS.gravity,
    enableSleeping: true,
  })

  const runner = Matter.Runner.create({
    delta: 1000 / 60,
  })

  const measureCanvas = document.createElement('canvas')
  const measureCtx = measureCanvas.getContext('2d')!
  const charSizes = measureCharacters(measureCtx)

  const rect = heroEl.getBoundingClientRect()
  const walls = createWalls(rect.width, rect.height)
  Matter.Composite.add(engine.world, walls)

  const colliders = createColliders(heroEl)
  Matter.Composite.add(engine.world, colliders)

  const cursor = Matter.Bodies.circle(-200, -200, PHYSICS.cursorRadius, {
    isStatic: true,
    label: 'cursor',
  })
  Matter.Composite.add(engine.world, [cursor])

  return {
    engine,
    runner,
    characters: [],
    walls,
    colliders,
    cursor,
    spawnTimer: null,
    heroEl,
    measureCtx,
    charSizes,
    paused: true,
  }
}

function createWalls(width: number, height: number): Matter.Body[] {
  const thickness = 60
  return [
    Matter.Bodies.rectangle(-thickness / 2, height / 2, thickness, height * 2, {
      isStatic: true,
      label: 'wall-left',
    }),
    Matter.Bodies.rectangle(width + thickness / 2, height / 2, thickness, height * 2, {
      isStatic: true,
      label: 'wall-right',
    }),
  ]
}

interface InkRect {
  x: number
  y: number
  width: number
  height: number
}

function getTextInkRects(el: HTMLElement): InkRect[] {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const rects: InkRect[] = []

  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let node: Text | null
  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent || ''
    const parentEl = node.parentElement!
    const style = getComputedStyle(parentEl)
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`

    for (let i = 0; i < text.length; i++) {
      if (/\s/.test(text[i])) continue

      const range = document.createRange()
      range.setStart(node, i)
      range.setEnd(node, i + 1)
      const domRect = range.getBoundingClientRect()
      if (domRect.width < 1 || domRect.height < 1) continue

      const metrics = ctx.measureText(text[i])
      const inkW = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight
      const inkH = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent

      const fontAsc = metrics.fontBoundingBoxAscent
      const fontDesc = metrics.fontBoundingBoxDescent
      const contentH = fontAsc + fontDesc
      const halfLeading = (domRect.height - contentH) / 2
      const baseline = domRect.top + halfLeading + fontAsc

      const inkTop = baseline - metrics.actualBoundingBoxAscent
      const cx = domRect.left + domRect.width / 2
      const cy = inkTop + inkH / 2

      rects.push({ x: cx, y: cy, width: inkW, height: inkH })
    }
  }
  return rects
}

function createColliders(heroEl: HTMLElement): Matter.Body[] {
  const elements = heroEl.querySelectorAll('[data-rain-collider]')
  const heroRect = heroEl.getBoundingClientRect()
  const bodies: Matter.Body[] = []

  elements.forEach((el) => {
    const htmlEl = el as HTMLElement
    const mode = htmlEl.dataset.rainCollider

    if (mode === 'text') {
      for (const ir of getTextInkRects(htmlEl)) {
        if (ir.width < 2 || ir.height < 2) continue
        bodies.push(
          Matter.Bodies.rectangle(ir.x - heroRect.left, ir.y - heroRect.top, ir.width, ir.height, {
            isStatic: true,
            friction: PHYSICS.colliderFriction,
            restitution: PHYSICS.colliderRestitution,
            label: 'collider',
          })
        )
      }
    } else {
      const rect = htmlEl.getBoundingClientRect()
      if (rect.width >= 2 && rect.height >= 2) {
        bodies.push(
          Matter.Bodies.rectangle(
            rect.left - heroRect.left + rect.width / 2,
            rect.top - heroRect.top + rect.height / 2,
            rect.width,
            rect.height,
            {
              isStatic: true,
              friction: PHYSICS.colliderFriction,
              restitution: PHYSICS.colliderRestitution,
              label: 'collider',
            }
          )
        )
      }
    }
  })

  return bodies
}

function randomToken(): { char: string; role: TokenRole } {
  return ALL_TOKENS[Math.floor(Math.random() * ALL_TOKENS.length)]
}

function getTheme(): 'dark' | 'light' {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

function randomOpacity(): number {
  const theme = getTheme()
  const range = OPACITY[theme]
  return range.min + Math.random() * (range.max - range.min)
}

export function spawnCharacter(rain: RainEngine): void {
  const config = getSpawnConfig()
  const token = randomToken()
  const size = rain.charSizes.get(token.char) || { width: 20, height: 22 }
  const rect = rain.heroEl.getBoundingClientRect()
  const margin = rect.width * config.spawnMargin
  const x = margin + Math.random() * (rect.width - margin * 2)

  const body = Matter.Bodies.rectangle(x, config.spawnY, size.width, size.height, {
    friction: PHYSICS.characterFriction,
    restitution: PHYSICS.characterRestitution,
    density: PHYSICS.characterDensity,
    frictionAir: PHYSICS.characterFrictionAir,
    angle: (Math.random() - 0.5) * 0.5,
    label: 'character',
  })

  const spin = (Math.random() - 0.5) * 2 * PHYSICS.spawnAngularVelocity
  Matter.Body.setAngularVelocity(body, spin)

  Matter.Composite.add(rain.engine.world, [body])

  const maxOpacity = randomOpacity()
  rain.characters.push({
    body,
    char: token.char,
    role: token.role,
    opacity: maxOpacity,
    maxOpacity,
    age: 0,
    lifetime: SPAWN.lifetimeMin + Math.random() * (SPAWN.lifetimeMax - SPAWN.lifetimeMin),
    width: size.width,
    height: size.height,
  })
}

export function ageAndFade(rain: RainEngine, dt: number): void {
  const toRemove: CharacterBody[] = []

  for (const cb of rain.characters) {
    cb.age += dt
    if (cb.age <= cb.lifetime) {
      cb.opacity = cb.maxOpacity
    } else {
      const fadeProgress = (cb.age - cb.lifetime) / SPAWN.fadeDuration
      if (fadeProgress >= 1) {
        toRemove.push(cb)
      } else {
        cb.opacity = cb.maxOpacity * (1 - fadeProgress)
      }
    }
  }

  for (const cb of toRemove) {
    wakeNearby(rain, cb.body)
    Matter.Composite.remove(rain.engine.world, cb.body)
  }
  if (toRemove.length > 0) {
    const removeSet = new Set(toRemove)
    rain.characters = rain.characters.filter(cb => !removeSet.has(cb))
  }
}

function wakeNearby(rain: RainEngine, removed: Matter.Body): void {
  const radius = 50
  const rx = removed.position.x
  const ry = removed.position.y
  for (const cb of rain.characters) {
    if (cb.body === removed || !cb.body.isSleeping) continue
    const dx = cb.body.position.x - rx
    const dy = cb.body.position.y - ry
    if (dx * dx + dy * dy < radius * radius) {
      Matter.Sleeping.set(cb.body, false)
    }
  }
}

export function despawnOutOfBounds(rain: RainEngine): void {
  const heroHeight = rain.heroEl.offsetHeight
  const threshold = heroHeight + SPAWN.despawnMargin

  const toRemove: CharacterBody[] = []
  for (const cb of rain.characters) {
    if (cb.body.position.y > threshold) {
      toRemove.push(cb)
    }
  }

  for (const cb of toRemove) {
    Matter.Composite.remove(rain.engine.world, cb.body)
  }

  if (toRemove.length > 0) {
    const removeSet = new Set(toRemove)
    rain.characters = rain.characters.filter(cb => !removeSet.has(cb))
  }
}

export function startSpawning(rain: RainEngine): void {
  if (rain.spawnTimer) return
  const config = getSpawnConfig()
  rain.spawnTimer = setInterval(() => {
    if (!rain.paused) spawnCharacter(rain)
  }, config.interval)
}

export function stopSpawning(rain: RainEngine): void {
  if (rain.spawnTimer) {
    clearInterval(rain.spawnTimer)
    rain.spawnTimer = null
  }
}

export function updateCursor(rain: RainEngine, x: number, y: number): void {
  Matter.Body.setPosition(rain.cursor, { x, y })
  applyCursorRepulsion(rain, x, y)
}

function applyCursorRepulsion(rain: RainEngine, cx: number, cy: number): void {
  const { cursorRepelRadius, cursorRepelStrength } = PHYSICS
  const r2 = cursorRepelRadius * cursorRepelRadius

  for (const cb of rain.characters) {
    const { body } = cb
    const dx = body.position.x - cx
    const dy = body.position.y - cy
    const dist2 = dx * dx + dy * dy
    if (dist2 > r2 || dist2 < 1) continue

    const dist = Math.sqrt(dist2)
    const force = cursorRepelStrength * (1 - dist / cursorRepelRadius)
    const fx = (dx / dist) * force
    const fy = (dy / dist) * force

    // Wake sleeping bodies near cursor
    if (body.isSleeping) Matter.Sleeping.set(body, false)
    Matter.Body.applyForce(body, body.position, { x: fx, y: fy })
  }
}

export function hideCursor(rain: RainEngine): void {
  Matter.Body.setPosition(rain.cursor, { x: -200, y: -200 })
}

export function updateColliders(rain: RainEngine): void {
  for (const body of rain.colliders) {
    Matter.Composite.remove(rain.engine.world, body)
  }
  rain.colliders = createColliders(rain.heroEl)
  Matter.Composite.add(rain.engine.world, rain.colliders)
}

export function updateWalls(rain: RainEngine): void {
  for (const wall of rain.walls) {
    Matter.Composite.remove(rain.engine.world, wall)
  }
  const rect = rain.heroEl.getBoundingClientRect()
  rain.walls = createWalls(rect.width, rect.height)
  Matter.Composite.add(rain.engine.world, rain.walls)
}

export function resumeEngine(rain: RainEngine): void {
  rain.paused = false
  Matter.Runner.run(rain.runner, rain.engine)
  startSpawning(rain)
}

export function pauseEngine(rain: RainEngine): void {
  rain.paused = true
  Matter.Runner.stop(rain.runner)
  stopSpawning(rain)
}

export function destroyEngine(rain: RainEngine): void {
  stopSpawning(rain)
  Matter.Runner.stop(rain.runner)
  Matter.Engine.clear(rain.engine)
}
