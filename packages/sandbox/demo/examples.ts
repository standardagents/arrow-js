import type { SandboxProps } from '@arrow-js/sandbox'

export interface SandboxDemoExample {
  entryFile: string
  id: string
  label: string
  description: string
  source: SandboxProps['source']
}

export const sandboxExamples: SandboxDemoExample[] = [
  {
    id: 'counter',
    label: 'Counter',
    description:
      'Single-file sandbox code with implicit Arrow imports. Clicking the button updates reactive state inside QuickJS, then patches the host DOM.',
    entryFile: 'main.ts',
    source: {
      'main.ts': `const state = reactive({ count: 0 })

export default html\`
  <button class="demo-button" @click="\${() => state.count++}">
    Clicked \${() => state.count}
  </button>
\``,
    },
  },
  {
    id: 'split-files',
    label: 'Split Files',
    description:
      'A virtual module graph with explicit imports between files. Only @arrow-js/core is allowed as a bare import.',
    entryFile: 'main.ts',
    source: {
      'main.ts': `import App from './App.ts'

export default App`,
      'state.ts': `import { reactive } from '@arrow-js/core'

export const state = reactive({ count: 0 })`,
      'App.ts': `import { html } from '@arrow-js/core'
import { state } from './state.ts'

export default html\`
  <div class="stack">
    <button class="demo-button" @click="\${() => state.count++}">
      +
    </button>
    <span class="demo-count">\${() => state.count}</span>
  </div>
\``,
    },
  },
  {
    id: 'weather',
    label: 'Weather App',
    description:
      'A sandboxed component with a location dropdown that fetches current conditions from the public Open-Meteo API through the restricted fetch bridge.',
    entryFile: 'main.ts',
    source: {
      'main.ts': `const LOCATIONS = [
  { id: 'nyc', label: 'New York', latitude: 40.7128, longitude: -74.0060 },
  { id: 'sf', label: 'San Francisco', latitude: 37.7749, longitude: -122.4194 },
  { id: 'denver', label: 'Denver', latitude: 39.7392, longitude: -104.9903 },
  { id: 'miami', label: 'Miami', latitude: 25.7617, longitude: -80.1918 },
]

const WEATHER_CODES = {
  0: 'Clear sky',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  51: 'Light drizzle',
  61: 'Light rain',
  63: 'Rain',
  71: 'Snow',
  80: 'Rain showers',
  95: 'Thunderstorm',
}

const WeatherOption = component((props) => html\`
  <option
    value="\${props.id}"
    selected="\${() => props.active}"
  >
    \${props.label}
  </option>
\`)

const WeatherError = component((props) => html\`
  <p class="weather-error">\${() => props.message}</p>
\`)

const WeatherExplorer = component(() => {
  const state = reactive({
    selectedId: 'nyc',
    status: 'loading',
    summary: 'Fetching forecast...',
    temperature: '--',
    apparent: '--',
    wind: '--',
    fetchedAt: '',
    error: '',
  })

  const getLocation = () =>
    LOCATIONS.find((location) => location.id === state.selectedId) ?? LOCATIONS[0]

  const WeatherCard = component(() => html\`
    <article class="weather-card" data-state="\${() => state.status}">
      <p class="weather-kicker">\${() => getLocation().label}</p>
      <h3 class="weather-temp">\${() => state.temperature}</h3>
      <p class="weather-summary">\${() => state.summary}</p>
      <div class="weather-grid">
        <div class="weather-metric">
          <span>Feels like</span>
          <strong>\${() => state.apparent}</strong>
        </div>
        <div class="weather-metric">
          <span>Wind</span>
          <strong>\${() => state.wind}</strong>
        </div>
        <div class="weather-metric">
          <span>Updated</span>
          <strong>\${() => state.fetchedAt}</strong>
        </div>
      </div>
    </article>
  \`)

  const loadWeather = async () => {
    const location = getLocation()
    state.status = 'loading'
    state.summary = 'Fetching forecast...'
    state.error = ''

    const url =
      'https://api.open-meteo.com/v1/forecast' +
      '?latitude=' + location.latitude +
      '&longitude=' + location.longitude +
      '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m' +
      '&timezone=auto'

    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Weather request failed with status ' + response.status)
      }

      const payload = await response.json()
      const current = payload.current ?? {}

      state.temperature =
        current.temperature_2m == null ? '--' : current.temperature_2m + '°'
      state.apparent =
        current.apparent_temperature == null
          ? '--'
          : current.apparent_temperature + '°'
      state.wind =
        current.wind_speed_10m == null ? '--' : current.wind_speed_10m + ' km/h'
      state.summary =
        WEATHER_CODES[current.weather_code] ?? 'Forecast ready'
      state.fetchedAt = current.time ?? 'just now'
      state.status = 'ready'
    } catch (error) {
      state.status = 'error'
      state.error = error instanceof Error ? error.message : String(error)
    }
  }

  void loadWeather()

  return html\`
    <section class="weather-app">
      <div class="weather-toolbar">
        <label class="weather-label">
          Location
          <select
            class="weather-select"
            @change="\${(event) => {
              state.selectedId =
                event.target?.value ??
                event.currentTarget?.value ??
                state.selectedId
              void loadWeather()
            }}"
          >
            \${() =>
              LOCATIONS.map(
                (location) =>
                  WeatherOption({
                    active: state.selectedId === location.id,
                    id: location.id,
                    label: location.label,
                  })
              )}
          </select>
        </label>

        <button class="demo-button weather-refresh" @click="\${() => void loadWeather()}">
          Refresh
        </button>
      </div>

      \${() =>
        state.status === 'error'
          ? WeatherError({ message: state.error })
          : WeatherCard()
      }
    </section>
  \`
})

export default html\`\${WeatherExplorer()}\``,
    },
  },
  {
    id: 'async-module',
    label: 'Async Module',
    description:
      'Top-level await runs inside the async QuickJS VM. The host still only renders DOM and forwards sanitized events.',
    entryFile: 'main.ts',
    source: {
      'main.ts': `await Promise.resolve()

const state = reactive({
  armed: false,
  clicks: 0,
})

export default html\`
  <section class="stack">
    <button
      class="demo-button"
      data-state="\${() => (state.armed ? 'armed' : 'idle')}"
      @click="\${() => {
        state.armed = true
        state.clicks++
      }}"
    >
      \${() => (state.armed ? 'Sandbox Armed' : 'Arm Sandbox')}
    </button>
    <p>Clicks handled inside QuickJS: \${() => state.clicks}</p>
  </section>
\``,
    },
  },
]
