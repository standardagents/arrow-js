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
    return `import { html } from './arrow.js'

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
let labelNodes = []
let refsDirty = false

const rowHead = '<tr><td class="col-md-1">'
const rowHeadMid = '</td><td class="col-md-4"><a>'
const rowTail =
  '</a></td><td class="col-md-1"><a><span class="glyphicon glyphicon-remove" aria-hidden="true"></span></a></td><td class="col-md-6"></td></tr>'

function createLabel() {
  return (
    adjectives[(Math.random() * adjectives.length) | 0] +
    ' ' +
    colours[(Math.random() * colours.length) | 0] +
    ' ' +
    nouns[(Math.random() * nouns.length) | 0]
  )
}

function clearSelection() {
  if (selectedRow && selectedRow.isConnected) selectedRow.className = ''
  selectedRow = undefined
}

function clearRows() {
  labelNodes = []
  refsDirty = false
  tbody.textContent = ''
}

function buildRowsHtml(count) {
  let rows = ''
  for (let i = 0; i < count; i++) {
    const id = rowId++
    const label = createLabel()
    rows += rowHead + id + rowHeadMid + label + rowTail
  }
  return rows
}

function appendRows(count) {
  table.hidden = true
  tbody.insertAdjacentHTML('beforeend', buildRowsHtml(count))
  table.hidden = false
  refsDirty = true
}

function setRows(count) {
  labelNodes = []
  refsDirty = true
  const detach = count > 1000 || !tbody.firstChild
  if (detach) table.removeChild(tbody)
  tbody.innerHTML = buildRowsHtml(count)
  if (detach) table.appendChild(tbody)
}

function ensureLabelNodes() {
  if (!refsDirty) return
  const len = tbody.childElementCount
  labelNodes = new Array(len)
  let row = tbody.firstElementChild
  for (let i = 0; i < len; i++) {
    labelNodes[i] = row.children[1].firstChild.firstChild
    row = row.nextElementSibling
  }
  refsDirty = false
}

function select(row) {
  if (selectedRow === row) return
  clearSelection()
  selectedRow = row
  row.className = 'danger'
}

function handleTableClick(evt) {
  if (!(evt.target instanceof Element)) return
  const actionNode = evt.target.closest('a')
  if (!actionNode) return
  const cell = actionNode.parentElement
  const row = cell?.parentElement
  if (!row) return
  evt.preventDefault()
  if (cell.cellIndex === 1) {
    select(row)
  } else if (cell.cellIndex === 2) {
    remove(row)
  }
}

function add() {
  appendRows(1000)
}

function clear() {
  clearSelection()
  clearRows()
}

function partialUpdate() {
  ensureLabelNodes()
  for (let i = 0; i < labelNodes.length; i += 10) {
    labelNodes[i].data += ' !!!'
  }
}

function remove(row) {
  if (selectedRow === row) selectedRow = undefined
  row.remove()
  labelNodes = []
  refsDirty = true
}

function run() {
  clearSelection()
  setRows(1000)
}

function runLots() {
  clearSelection()
  setRows(10000)
}

function swapRows() {
  const rows = tbody.children
  if (rows.length <= 998) return
  const left = rows[1]
  const right = rows[998]
  const afterLeft = left.nextSibling
  const afterRight = right.nextSibling
  tbody.insertBefore(right, afterLeft)
  tbody.insertBefore(left, afterRight)
  refsDirty = true
}

const root = document.getElementById('arrow')

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
    <tbody id="rows" @click="\${handleTableClick}"></tbody>
  </table>
</div>\`(root)

const tbody = root.querySelector('#rows')
const table = tbody.parentNode
`
  }
  return `import { html } from './arrow.js'

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
let rows = []
let selected
const views = []
const freeViews = []
const slotIds = []
const slotLabels = []
const slotSelected = []

function createLabel() {
  return (
    adjectives[(Math.random() * adjectives.length) | 0] +
    ' ' +
    colours[(Math.random() * colours.length) | 0] +
    ' ' +
    nouns[(Math.random() * nouns.length) | 0]
  )
}

function buildData(count = 1000) {
  const nextRows = new Array(count)
  for (let i = 0; i < count; i++) {
    nextRows[i] = {
      id: rowId++,
      label: createLabel(),
    }
  }
  return nextRows
}

function findIndexById(id) {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].id === id) return i
  }
  return -1
}

function eventRowId(evt) {
  const row = evt.currentTarget.closest('tr')
  return row ? +row.firstChild.textContent : -1
}

function handleSelect(evt) {
  select(eventRowId(evt))
}

function handleRemove(evt) {
  remove(eventRowId(evt))
}

function createView(row, index) {
  const isSelected = row.id === selected
  const view = freeViews.pop()
  if (!view) {
    slotIds[index] = row.id
    slotLabels[index] = row.label
    slotSelected[index] = isSelected
    return html(
      'row',
      isSelected ? 'danger' : false,
      row.id,
      handleSelect,
      row.label,
      handleRemove
    )
  }
  patchView(view, row, index)
  return view
}

function patchView(view, row, index) {
  const isSelected = row.id === selected
  if (
    slotIds[index] === row.id &&
    slotLabels[index] === row.label &&
    slotSelected[index] === isSelected
  ) {
    return
  }
  slotIds[index] = row.id
  slotLabels[index] = row.label
  slotSelected[index] = isSelected
  view.update(
    isSelected ? 'danger' : false,
    row.id,
    handleSelect,
    row.label,
    handleRemove
  )
}

function syncViews(start = 0) {
  for (let i = start; i < rows.length; i++) {
    const row = rows[i]
    const view = views[i] ?? (views[i] = createView(row, i))
    patchView(view, row, i)
  }
}

function replaceRows(nextRows) {
  const previousLength = views.length
  rows = nextRows
  syncViews(0)
  if (rows.length > previousLength) {
    previousLength ? mountViews(previousLength) : batchDOM(() => mountViews(0))
    return
  }
  if (rows.length < previousLength) trimViews(rows.length)
}

function add() {
  const start = rows.length
  const nextRows = buildData(1000)
  for (let i = 0; i < nextRows.length; i++) rows.push(nextRows[i])
  syncViews(start)
  mountViews(start)
}

function clear() {
  if (views.length) {
    rows = []
    selected = undefined
    slotIds.length = 0
    slotLabels.length = 0
    slotSelected.length = 0
    while (views.length) freeViews.push(views.pop())
    tbody.textContent = ''
  }
}

function partialUpdate() {
  for (let i = 0; i < rows.length; i += 10) {
    rows[i].label += ' !!!'
    patchView(views[i], rows[i], i)
  }
}

function remove(id) {
  const index = findIndexById(id)
  if (index < 0) return
  rows.splice(index, 1)
  if (selected === id) selected = undefined
  for (let i = index; i < rows.length; i++) {
    patchView(views[i], rows[i], i)
  }
  trimViews(rows.length)
}

function run() {
  selected = undefined
  replaceRows(buildData(1000))
}

function runLots() {
  selected = undefined
  replaceRows(buildData(10000))
}

function swapRows() {
  if (rows.length > 998) {
    const left = rows[1]
    rows[1] = rows[998]
    rows[998] = left
    patchView(views[1], rows[1], 1)
    patchView(views[998], rows[998], 998)
  }
}

function select(id) {
  if (selected === id) return
  const previous = findIndexById(selected)
  selected = id
  if (previous > -1) patchView(views[previous], rows[previous], previous)
  const next = findIndexById(id)
  if (next > -1) patchView(views[next], rows[next], next)
}

html\`<tr class="\${null}"><td class="col-md-1">\${null}</td><td class="col-md-4"><a @click="\${null}">\${null}</a></td><td class="col-md-1"><a @click="\${null}"><span class="glyphicon glyphicon-remove" aria-hidden="true"></span></a></td><td class="col-md-6"></td></tr>\`.id('row')()

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
    <tbody id="rows"></tbody>
  </table>
</div>\`(document.getElementById('arrow'))

const tbody = document.getElementById('rows')

function batchDOM(work) {
  const parent = tbody.parentNode
  if (!parent) {
    work()
    return
  }
  const next = tbody.nextSibling
  parent.removeChild(tbody)
  work()
  next ? parent.insertBefore(tbody, next) : parent.appendChild(tbody)
}

function mountViews(start) {
  const fragment = document.createDocumentFragment()
  for (let i = start; i < views.length; i++) {
    fragment.appendChild(views[i]())
  }
  tbody.appendChild(fragment)
}

function trimViews(length) {
  slotIds.length = length
  slotLabels.length = length
  slotSelected.length = length
  while (views.length > length) {
    freeViews.push(views.pop())
    tbody.lastElementChild.remove()
  }
}
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
