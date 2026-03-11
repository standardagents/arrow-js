import { execFileSync, spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export const rootDir = resolve(__dirname, '../..')
export const benchmarkTag = process.env.JS_FRAMEWORK_BENCHMARK_TAG ?? 'chrome142'
export const benchmarkRepoDir =
  process.env.JS_FRAMEWORK_BENCHMARK_DIR ??
  resolve(rootDir, `.cache/js-framework-benchmark-${benchmarkTag}`)
export const benchmarkRepoUrl =
  'https://github.com/krausest/js-framework-benchmark.git'
export const benchmarkFrameworkName = 'arrowjs-local'
export const benchmarkBuildZipUrl =
  process.env.JS_FRAMEWORK_BENCHMARK_BUILD_URL ??
  `https://github.com/krausest/js-framework-benchmark/releases/download/${benchmarkTag}/build.zip`
const benchmarkBuildZipPath = join(benchmarkRepoDir, 'build.zip')
const benchmarkBuildMarker = join(
  benchmarkRepoDir,
  'frameworks',
  'keyed',
  'lit',
  'dist',
  'main.js'
)

export function run(command, args, options = {}) {
  execFileSync(command, args, {
    stdio: 'inherit',
    ...options,
  })
}

export function getVersionLabel() {
  const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'))
  const sha = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: rootDir,
    encoding: 'utf8',
  })
  const suffix = sha.status === 0 ? `+${sha.stdout.trim()}` : ''
  return `${pkg.version}${suffix}`
}

export function ensureBenchmarkRepo({ install = false } = {}) {
  if (!existsSync(benchmarkRepoDir)) {
    mkdirSync(dirname(benchmarkRepoDir), { recursive: true })
    run('git', [
      'clone',
      '--depth',
      '1',
      '--branch',
      benchmarkTag,
      benchmarkRepoUrl,
      benchmarkRepoDir,
    ])
  }

  if (
    install &&
    !existsSync(join(benchmarkRepoDir, 'webdriver-ts', 'dist', 'benchmarkRunner.js'))
  ) {
    run('npm', ['ci'], { cwd: benchmarkRepoDir })
    run('npm', ['run', 'install-local'], { cwd: benchmarkRepoDir })
  }

  if (
    install &&
    (!existsSync(benchmarkBuildMarker) ||
      (existsSync(benchmarkBuildZipPath) && statSync(benchmarkBuildZipPath).size === 0))
  ) {
    if (!existsSync(benchmarkBuildZipPath) || statSync(benchmarkBuildZipPath).size === 0) {
      run('curl', ['-L', benchmarkBuildZipUrl, '-o', benchmarkBuildZipPath])
    }
    run('unzip', ['-oq', benchmarkBuildZipPath], { cwd: benchmarkRepoDir })
  }
}

function frameworkDir(keyed) {
  return join(
    benchmarkRepoDir,
    'frameworks',
    keyed ? 'keyed' : 'non-keyed',
    benchmarkFrameworkName
  )
}

function packageJson(version) {
  return JSON.stringify(
    {
      name: `js-framework-benchmark-${benchmarkFrameworkName}`,
      version: '1.0.0',
      description: 'ArrowJS local benchmark adapter',
      'js-framework-benchmark': {
        frameworkVersion: version,
        frameworkHomeURL: 'https://www.arrow-js.com/',
      },
      scripts: {
        dev: 'exit 0',
        'build-prod': 'exit 0',
      },
      keywords: ['arrowjs'],
      author: 'Arrow local benchmark adapter',
      license: 'MIT',
      homepage: 'https://github.com/justin-schroeder/arrow',
      repository: {
        type: 'git',
        url: 'https://github.com/justin-schroeder/arrow.git',
      },
    },
    null,
    2
  )
}

function packageLockJson() {
  return JSON.stringify(
    {
      name: `js-framework-benchmark-${benchmarkFrameworkName}`,
      version: '1.0.0',
      lockfileVersion: 3,
      requires: true,
      packages: {
        '': {
          name: `js-framework-benchmark-${benchmarkFrameworkName}`,
          version: '1.0.0',
          license: 'MIT',
        },
      },
    },
    null,
    2
  )
}

function indexHtml(keyed) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>ArrowJS Local ${keyed ? 'Keyed' : 'Non-Keyed'}</title>
    <link href="/css/currentStyle.css" rel="stylesheet" />
    <span class="preloadicon glyphicon glyphicon-remove" aria-hidden="true"></span>
  </head>
  <body>
    <div id="arrow"></div>
    <script type="module" src="src/Main.js"></script>
  </body>
</html>
`
}

function mainJs(keyed) {
  const labelSuffix = keyed ? 'Keyed' : 'Non-Keyed'
  if (keyed) {
    return `import { reactive, html } from './arrow.js'

const data = reactive({
  items: [],
})

const adjectives = [
  'pretty',
  'large',
  'big',
  'small',
  'tall',
  'short',
  'long',
  'handsome',
  'plain',
  'quaint',
  'clean',
  'elegant',
  'easy',
  'angry',
  'crazy',
  'helpful',
  'mushy',
  'odd',
  'unsightly',
  'adorable',
  'important',
  'inexpensive',
  'cheap',
  'expensive',
  'fancy',
]
const colours = [
  'red',
  'yellow',
  'blue',
  'green',
  'pink',
  'brown',
  'purple',
  'brown',
  'white',
  'black',
  'orange',
]
const nouns = [
  'table',
  'chair',
  'house',
  'bbq',
  'desk',
  'car',
  'pony',
  'cookie',
  'sandwich',
  'burger',
  'pizza',
  'mouse',
  'keyboard',
]

let rowId = 1
let selectedRow
let ids = []
let labels = reactive({})
let staticLabels = {}
let reactiveMode = true
const rowViews = new Map()

const ensureReactiveViews = () => {
  if (reactiveMode) return
  labels = reactive(staticLabels)
  staticLabels = {}
  reactiveMode = true
  const items = new Array(ids.length)
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    items[i] = rowViews.get(id) || createReactiveRowView(id)
  }
  data.items = items
}

const add = () => {
  ensureReactiveViews()
  const next = createRows(1000, reactiveMode)
  ids.push(...next[0])
  data.items.push(...next[1])
}
const clearSelection = () => {
  if (selectedRow && selectedRow.isConnected) selectedRow.className = ''
  selectedRow = undefined
}
const clearRows = () => {
  rowViews.clear()
  ids = []
  labels = reactive({})
  staticLabels = {}
  reactiveMode = true
}
const clear = () => {
  clearRows()
  data.items = []
  clearSelection()
}
const findIndexById = (id) => {
  for (let i = 0; i < ids.length; i++) {
    if (ids[i] === id) return i
  }
  return -1
}
const select = (row) => {
  if (selectedRow === row) return
  clearSelection()
  selectedRow = row
  row.className = 'danger'
}
const handleTableClick = (evt) => {
  if (!(evt.target instanceof Element)) return
  const actionNode = evt.target.closest('[data-action]')
  if (!actionNode) return
  const row = actionNode.closest('tr')
  if (!row) return
  const id = Number(row.firstElementChild && row.firstElementChild.textContent)
  if (!id) return
  evt.preventDefault()
  if (actionNode.getAttribute('data-action') === 'select') {
    select(row)
  } else {
    if (selectedRow === row) selectedRow = undefined
    remove(id)
  }
}
const partialUpdate = () => {
  ensureReactiveViews()
  for (let i = 0; i < ids.length; i += 10) {
    const id = ids[i]
    labels[id] += ' !!!'
  }
}
const remove = (id) => {
  ensureReactiveViews()
  const index = findIndexById(id)
  if (index < 0) return
  rowViews.delete(ids[index])
  ids.splice(index, 1)
  labels[id] = ''
  if (selectedRow && !selectedRow.isConnected) selectedRow = undefined
  data.items.splice(index, 1)
}
const run = () => {
  clearRows()
  reactiveMode = true
  const next = createRows(1000, true)
  ids = next[0]
  data.items = next[1]
  clearSelection()
}
const runLots = () => {
  clearRows()
  reactiveMode = false
  const next = createStaticTable(10000)
  ids = next[0]
  data.items = next[1]
  clearSelection()
}
const swapRows = () => {
  ensureReactiveViews()
  if (ids.length > 998) {
    ids = [
      ids[0],
      ids[998],
      ...ids.slice(2, 998),
      ids[1],
      ids[999],
    ]
    data.items = [
      data.items[0],
      data.items[998],
      ...data.items.slice(2, 998),
      data.items[1],
      data.items[999],
    ]
  }
}

function random(max) {
  return Math.round(Math.random() * 1000) % max
}

function createLabel() {
  return (
    adjectives[random(adjectives.length)] +
    ' ' +
    colours[random(colours.length)] +
    ' ' +
    nouns[random(nouns.length)]
  )
}

function createRowView(id) {
  rowViews.set(
    id,
    html\`<tr>
              <td class="col-md-1">\${id}</td>
              <td class="col-md-4">
                <a data-action="select">\${() => labels[id]}</a>
              </td>
              <td class="col-md-1">
                <a data-action="remove">
                  <span class="glyphicon glyphicon-remove" aria-hidden="true"></span>
                </a>
              </td>
              <td class="col-md-6"></td>
            </tr>\`.key(id)
  )
  return rowViews.get(id)
}

function createReactiveRowView(id) {
  return rowViews.get(id) || createRowView(id)
}

function createStaticRowView(id, label) {
  return html\`<tr>
              <td class="col-md-1">\${id}</td>
              <td class="col-md-4">
                <a data-action="select">\${label}</a>
              </td>
              <td class="col-md-1">
                <a data-action="remove">
                  <span class="glyphicon glyphicon-remove" aria-hidden="true"></span>
                </a>
              </td>
              <td class="col-md-6"></td>
            </tr>\`.key(id).memo(label)
}

function createRows(count = 1000, reactiveViews = true) {
  const nextIds = new Array(count)
  const nextViews = new Array(count)
  for (let i = 0; i < count; i++) {
    const id = rowId++
    const label = createLabel()
    labels[id] = label
    nextIds[i] = id
    nextViews[i] = reactiveViews
      ? createReactiveRowView(id)
      : createStaticRowView(id, label)
  }
  return [nextIds, nextViews]
}

function createStaticTable(count = 1000) {
  const nextIds = new Array(count)
  let rows = ''
  for (let i = 0; i < count; i++) {
    const id = rowId++
    const label = createLabel()
    staticLabels[id] = label
    nextIds[i] = id
    rows +=
      '<tr><td class="col-md-1">' +
      id +
      '</td><td class="col-md-4"><a data-action="select">' +
      label +
      '</a></td><td class="col-md-1"><a data-action="remove"><span class="glyphicon glyphicon-remove" aria-hidden="true"></span></a></td><td class="col-md-6"></td></tr>'
  }
  return [nextIds, html([rows])]
}

html\`<div class="container">
  <div class="jumbotron">
    <div class="row">
      <div class="col-md-6">
        <h1>ArrowJS Local (${labelSuffix})</h1>
      </div>
      <div class="col-md-6">
        <div class="row">
          <div class="col-sm-6 smallpad">
            <button type="button" class="btn btn-primary btn-block" id="run" @click="\${run}">
              Create 1,000 rows
            </button>
          </div>
          <div class="col-sm-6 smallpad">
            <button type="button" class="btn btn-primary btn-block" id="runlots" @click="\${runLots}">
              Create 10,000 rows
            </button>
          </div>
          <div class="col-sm-6 smallpad">
            <button type="button" class="btn btn-primary btn-block" id="add" @click="\${add}">
              Append 1,000 rows
            </button>
          </div>
          <div class="col-sm-6 smallpad">
            <button type="button" class="btn btn-primary btn-block" id="update" @click="\${partialUpdate}">
              Update every 10th row
            </button>
          </div>
          <div class="col-sm-6 smallpad">
            <button type="button" class="btn btn-primary btn-block" id="clear" @click="\${clear}">
              Clear
            </button>
          </div>
          <div class="col-sm-6 smallpad">
            <button type="button" class="btn btn-primary btn-block" id="swaprows" @click="\${swapRows}">
              Swap Rows
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  <table class="table table-hover table-striped test-data">
    <tbody @click="\${handleTableClick}">
      \${() => data.items}
    </tbody>
  </table>
</div>\`(document.getElementById('arrow'))
`
  }
  return `import { reactive, html } from './arrow.js'

const data = reactive({
  items: [],
})

const adjectives = [
  'pretty',
  'large',
  'big',
  'small',
  'tall',
  'short',
  'long',
  'handsome',
  'plain',
  'quaint',
  'clean',
  'elegant',
  'easy',
  'angry',
  'crazy',
  'helpful',
  'mushy',
  'odd',
  'unsightly',
  'adorable',
  'important',
  'inexpensive',
  'cheap',
  'expensive',
  'fancy',
]
const colours = [
  'red',
  'yellow',
  'blue',
  'green',
  'pink',
  'brown',
  'purple',
  'brown',
  'white',
  'black',
  'orange',
]
const nouns = [
  'table',
  'chair',
  'house',
  'bbq',
  'desk',
  'car',
  'pony',
  'cookie',
  'sandwich',
  'burger',
  'pizza',
  'mouse',
  'keyboard',
]

let rowId = 1
let selectedRow
const renderRow = (row) =>
  html\`<tr>
              <td class="col-md-1">\${row.id}</td>
              <td class="col-md-4">
                <a data-action="select">\${() => row.label}</a>
              </td>
              <td class="col-md-1">
                <a data-action="remove">
                  <span class="glyphicon glyphicon-remove" aria-hidden="true"></span>
                </a>
              </td>
              <td class="col-md-6"></td>
            </tr>\`

const add = () => {
  data.items.push(...buildData(1000))
}
const clearSelection = () => {
  if (selectedRow && selectedRow.isConnected) selectedRow.className = ''
  selectedRow = undefined
}
const clear = () => {
  data.items = []
  clearSelection()
}
const findIndexById = (id) => {
  for (let i = 0; i < data.items.length; i++) {
    if (data.items[i].id === id) return i
  }
  return -1
}
const select = (row) => {
  if (selectedRow === row) return
  clearSelection()
  selectedRow = row
  row.className = 'danger'
}
const handleTableClick = (evt) => {
  if (!(evt.target instanceof Element)) return
  const actionNode = evt.target.closest('[data-action]')
  if (!actionNode) return
  const row = actionNode.closest('tr')
  if (!row) return
  const id = Number(row.firstElementChild && row.firstElementChild.textContent)
  if (!id) return
  evt.preventDefault()
  if (actionNode.getAttribute('data-action') === 'select') {
    select(row)
  } else {
    if (selectedRow === row) selectedRow = undefined
    remove(id)
  }
}
const partialUpdate = () => {
  for (let i = 0; i < data.items.length; i += 10) {
    data.items[i].label += ' !!!'
  }
}
const remove = (id) => {
  const index = findIndexById(id)
  if (index < 0) return
  if (selectedRow && !selectedRow.isConnected) selectedRow = undefined
  data.items.splice(index, 1)
}
const run = () => {
  data.items = buildData(1000)
  clearSelection()
}
const runLots = () => {
  data.items = buildData(10000)
  clearSelection()
}
const swapRows = () => {
  if (data.items.length > 998) {
    data.items = [
      data.items[0],
      data.items[998],
      ...data.items.slice(2, 998),
      data.items[1],
      data.items[999],
    ]
  }
}

function random(max) {
  return Math.round(Math.random() * 1000) % max
}

function buildData(count = 1000) {
  const rows = new Array(count)
  for (let i = 0; i < count; i++) {
    rows[i] = {
      id: rowId++,
      label:
        adjectives[random(adjectives.length)] +
        ' ' +
        colours[random(colours.length)] +
        ' ' +
        nouns[random(nouns.length)],
    }
  }
  return rows
}

html\`<div class="container">
  <div class="jumbotron">
    <div class="row">
      <div class="col-md-6">
        <h1>ArrowJS Local (${labelSuffix})</h1>
      </div>
      <div class="col-md-6">
        <div class="row">
          <div class="col-sm-6 smallpad">
            <button type="button" class="btn btn-primary btn-block" id="run" @click="\${run}">
              Create 1,000 rows
            </button>
          </div>
          <div class="col-sm-6 smallpad">
            <button type="button" class="btn btn-primary btn-block" id="runlots" @click="\${runLots}">
              Create 10,000 rows
            </button>
          </div>
          <div class="col-sm-6 smallpad">
            <button type="button" class="btn btn-primary btn-block" id="add" @click="\${add}">
              Append 1,000 rows
            </button>
          </div>
          <div class="col-sm-6 smallpad">
            <button type="button" class="btn btn-primary btn-block" id="update" @click="\${partialUpdate}">
              Update every 10th row
            </button>
          </div>
          <div class="col-sm-6 smallpad">
            <button type="button" class="btn btn-primary btn-block" id="clear" @click="\${clear}">
              Clear
            </button>
          </div>
          <div class="col-sm-6 smallpad">
            <button type="button" class="btn btn-primary btn-block" id="swaprows" @click="\${swapRows}">
              Swap Rows
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  <table class="table table-hover table-striped test-data">
    <tbody @click="\${handleTableClick}">
      \${() =>
        data.items.map(renderRow)}
    </tbody>
  </table>
</div>\`(document.getElementById('arrow'))
`
}

export function syncArrowLocal() {
  const distFile = join(rootDir, 'dist', 'index.min.mjs')
  if (!existsSync(distFile)) {
    throw new Error('Missing dist/index.min.mjs. Run `pnpm build` first.')
  }

  const version = getVersionLabel()
  for (const keyed of [true, false]) {
    const targetDir = frameworkDir(keyed)
    const srcDir = join(targetDir, 'src')
    mkdirSync(srcDir, { recursive: true })
    copyFileSync(distFile, join(srcDir, 'arrow.js'))
    writeFileSync(join(targetDir, 'index.html'), indexHtml(keyed))
    writeFileSync(join(targetDir, 'package.json'), `${packageJson(version)}\n`)
    writeFileSync(join(targetDir, 'package-lock.json'), `${packageLockJson()}\n`)
    writeFileSync(join(srcDir, 'Main.js'), mainJs(keyed))
  }
}
