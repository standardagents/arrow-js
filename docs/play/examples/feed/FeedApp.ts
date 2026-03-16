import { component, html, reactive } from '@arrow-js/core'
import { FeedCard } from './FeedCard'

type FeedEntry = {
  id: number
  type: 'info' | 'success' | 'warning' | 'error'
  message: string
  time: string
}

const MESSAGES: Array<{ type: FeedEntry['type']; message: string }> = [
  { type: 'info', message: 'New user signed up from Berlin' },
  { type: 'success', message: 'Deployment v2.4.1 completed' },
  { type: 'warning', message: 'API response time above 200 ms' },
  { type: 'info', message: 'Database backup finished' },
  { type: 'error', message: 'Payment webhook returned 500' },
  { type: 'success', message: 'SSL certificate renewed' },
  { type: 'info', message: 'Cache cleared for /api/products' },
  { type: 'warning', message: 'Memory usage at 82%' },
  { type: 'success', message: 'User export job completed' },
  { type: 'error', message: 'Email delivery failed for 3 recipients' },
  { type: 'info', message: 'New comment on issue #847' },
  { type: 'success', message: 'Image optimization saved 1.2 MB' },
]

function pickRandom(): { type: FeedEntry['type']; message: string } {
  return MESSAGES[Math.floor(Math.random() * MESSAGES.length)]
}

function timestamp(): string {
  const now = new Date()
  return now.toLocaleTimeString('en-US', { hour12: false })
}

export const FeedApp = component(() => {
  const state = reactive({
    entries: [] as FeedEntry[],
    running: true,
    nextId: 1,
  })

  let timer = 0

  const addEntry = () => {
    const msg = pickRandom()
    state.entries = [
      { id: state.nextId, type: msg.type, message: msg.message, time: timestamp() },
      ...state.entries,
    ].slice(0, 30)
    state.nextId++
  }

  const tick = () => {
    if (!state.running) return
    addEntry()
    timer = window.setTimeout(tick, 1400 + Math.random() * 1200)
  }

  const start = () => {
    if (state.running) return
    state.running = true
    tick()
  }

  const stop = () => {
    state.running = false
    window.clearTimeout(timer)
  }

  const clear = () => {
    stop()
    state.entries = []
  }

  tick()

  return html`<main class="feed">
    <header class="feed-bar">
      <div class="feed-status">
        <span class="${() => state.running ? 'feed-dot feed-dot--live' : 'feed-dot'}"></span>
        <span class="feed-status-text">${() => (state.running ? 'Live' : 'Paused')}</span>
        <span class="feed-count">${() => state.entries.length} events</span>
      </div>
      <div class="feed-actions">
        <button class="feed-btn" @click="${() => (state.running ? stop() : start())}">
          ${() => (state.running ? 'Pause' : 'Resume')}
        </button>
        <button class="feed-btn feed-btn--ghost" @click="${clear}">Clear</button>
      </div>
    </header>

    <section class="feed-list">
      ${() =>
        state.entries.map((entry) =>
          FeedCard({
            message: entry.message,
            time: entry.time,
            type: entry.type,
          }).key(entry.id)
        )}
    </section>
  </main>`
})
