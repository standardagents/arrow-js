// In a real-world application this source code would be generated
// by your AI agent.

export const widgetSource: Record<string, string> = {
  'main.ts': `const state = reactive({
  count: 0,
  query: '',
  temp: '\u2026',
  place: '',
  condition: '',
})

// ---- Isolation probes ----
const probes = []
function probe(api, fn) {
  try { fn(); probes.push({ api, blocked: false }) }
  catch (e) { probes.push({ api, blocked: true }) }
}
probe('document.cookie', () => document.cookie)
probe('window.location', () => window.location)
probe('localStorage', () => localStorage.getItem('x'))

const ProbeRow = component((props) => html\`
  <div class="crow">
    <span class="\${() => props.blocked ? 'cdot cdot--pass' : 'cdot cdot--fail'}"></span>
    <code class="capi">\${() => props.api}</code>
    <span class="\${() => props.blocked ? 'cstat cstat--blocked' : 'cstat cstat--exposed'}">\${() => props.blocked ? 'BLOCKED' : 'EXPOSED'}</span>
  </div>
\`)

// ---- Fetch bridge ----
const codes = {0:'Clear',1:'Clear',2:'Cloudy',3:'Overcast',45:'Fog',51:'Drizzle',61:'Rain',63:'Rain',71:'Snow',80:'Showers',95:'Thunder'}

async function loadWeather(lat, lon, name) {
  state.temp = '\u2026'
  state.condition = ''
  state.place = ''
  try {
    const res = await fetch(
      'https://api.open-meteo.com/v1/forecast'
      + '?latitude=' + lat + '&longitude=' + lon
      + '&current=temperature_2m,weather_code'
      + '&temperature_unit=fahrenheit'
    )
    const json = await res.json()
    state.temp = (json.current?.temperature_2m ?? '--') + '\u00B0F'
    state.place = name
    state.condition = codes[json.current?.weather_code] ?? 'Forecast ready'
  } catch (e) {
    state.temp = '--'
    state.place = 'Could not reach API'
  }
}

async function search() {
  const q = state.query.trim()
  if (!q) return
  state.temp = '\u2026'
  state.condition = ''
  state.place = 'Searching\u2026'
  try {
    const res = await fetch(
      'https://geocoding-api.open-meteo.com/v1/search?count=1&name='
      + encodeURIComponent(q)
    )
    const json = await res.json()
    const loc = json.results?.[0]
    if (loc) {
      void loadWeather(loc.latitude, loc.longitude, loc.name + (loc.admin1 ? ', ' + loc.admin1 : ''))
    } else {
      state.temp = '--'
      state.place = 'Location not found'
      state.condition = ''
    }
  } catch (e) {
    state.temp = '--'
    state.place = 'Geocoding failed'
    state.condition = ''
  }
}

void loadWeather(40.71, -74.01, 'New York, New York')

// ---- Template ----
export default html\`
<div class="w">

  <section class="sec">
    <span class="tag">Reactivity</span>
    <div class="counter">
      <button class="cbtn" @click="\${() => state.count--}">\u2212</button>
      <span class="cval">\${() => state.count}</span>
      <button class="cbtn" @click="\${() => state.count++}">+</button>
    </div>
    <p class="hint">State lives in the VM \u2014 updates patch the host DOM</p>
  </section>

  <div class="rule"></div>

  <section class="sec">
    <span class="tag">Isolation</span>
    <div class="checks">
      \${probes.map(p => ProbeRow(p))}
    </div>
    <p class="hint">All access denied \u2014 the sandbox has no browser globals</p>
  </section>

  <div class="rule"></div>

  <section class="sec">
    <span class="tag">Fetch Bridge</span>
    <div class="wx-search">
      <input class="wx-input" placeholder="City or zip code"
        value="\${() => state.query}"
        @input="\${(e) => { state.query = e.target?.value ?? '' }}"
        @keydown="\${(e) => { if (e.key === 'Enter') search() }}"
      />
      <button class="cbtn wx-go" @click="\${() => search()}">Go</button>
    </div>
    <div class="wx">
      <span class="wx-temp">\${() => state.temp}</span>
      <span class="wx-cond">\${() => state.condition}</span>
      <span class="wx-place">\${() => state.place}</span>
    </div>
    <p class="hint">Proxied through the host \u2014 only absolute HTTPS URLs allowed</p>
  </section>

</div>
\``,

  'main.css': `
.w, .w *, .w *::before, .w *::after { box-sizing: border-box; margin: 0; }

.w {
  --text: #1a1a1a;
  --text-2: #555;
  --text-3: #999;
  --muted: #c0c0c0;
  --rule: #eaeaea;
  --btn-border: #d4d4d4;
  --btn-hover: #f0f0f0;
  --btn-active: #e5e5e5;
  --blocked: #ef4444;
  --ok: #22c55e;
  --mono: ui-monospace, 'SF Mono', 'Cascadia Code', monospace;
  font: 14px/1.6 -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif;
  color: var(--text);
}

html[data-theme='dark'] .w {
  --text: #e8e8e8;
  --text-2: #aaa;
  --text-3: #777;
  --muted: #555;
  --rule: #2a2a2a;
  --btn-border: #444;
  --btn-hover: #333;
  --btn-active: #3a3a3a;
  --blocked: #f87171;
  --ok: #4ade80;
}

.sec { padding: 1.5rem 1.75rem; }

.tag {
  display: block;
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-3);
  margin-bottom: 1rem;
}

.rule { height: 1px; background: var(--rule); }

.hint {
  font-size: 0.6875rem;
  color: var(--muted);
  margin-top: 1rem;
  text-align: center;
}

/* ---- Counter ---- */
.counter {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
}

.cval {
  font-size: 3rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  min-width: 4rem;
  text-align: center;
  line-height: 1;
}

.cbtn {
  all: unset;
  width: 2.75rem;
  height: 2.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid var(--btn-border);
  border-radius: 50%;
  font-size: 1.25rem;
  cursor: pointer;
  transition: all 100ms;
  user-select: none;
}
.cbtn:hover { border-color: var(--text-3); background: var(--btn-hover); }
.cbtn:active { background: var(--btn-active); transform: scale(0.93); }

/* ---- Checks ---- */
.checks { display: flex; flex-direction: column; gap: 0.625rem; }

.crow {
  display: grid;
  grid-template-columns: 0.625rem auto 1fr;
  align-items: center;
  gap: 0.625rem;
}

.cdot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
}
.cdot--pass { background: var(--ok); box-shadow: 0 0 5px var(--ok); }
.cdot--fail { background: var(--blocked); box-shadow: 0 0 5px var(--blocked); }

.capi {
  font-family: var(--mono);
  font-size: 0.8125rem;
  color: var(--text);
}

.cstat {
  font-size: 0.6875rem;
  font-weight: 600;
  text-align: right;
}
.cstat--blocked { color: var(--blocked); }
.cstat--exposed { color: var(--ok); }

/* ---- Weather ---- */
.wx-search {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.wx-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  font: inherit;
  font-size: 0.8125rem;
  border: 1.5px solid var(--btn-border);
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  outline: none;
}
.wx-input:focus { border-color: var(--text-3); }
.wx-input::placeholder { color: var(--muted); }

.wx-go {
  width: auto;
  padding: 0 1rem;
  font-size: 0.8125rem;
  border-radius: 8px;
}

.wx { text-align: center; padding: 0.25rem 0; }

.wx-temp {
  display: block;
  font-size: 2.5rem;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.02em;
}

.wx-cond {
  display: block;
  font-size: 0.875rem;
  color: var(--text-2);
  margin-top: 0.25rem;
}

.wx-place {
  display: block;
  font-size: 0.75rem;
  color: var(--text-3);
  margin-top: 0.125rem;
}
`,
}
