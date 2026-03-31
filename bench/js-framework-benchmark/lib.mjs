import { execFileSync, spawnSync } from 'node:child_process'
import {
  cpSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
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
export const benchmarkBuildZipUrl =
  process.env.JS_FRAMEWORK_BENCHMARK_BUILD_URL ??
  `https://github.com/krausest/js-framework-benchmark/releases/download/${benchmarkTag}/build.zip`
export const benchmarkArrowMode =
  process.env.JS_FRAMEWORK_BENCHMARK_ARROW_MODE ?? 'published'

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

function getCorePackage() {
  return JSON.parse(
    readFileSync(join(rootDir, 'packages', 'core', 'package.json'), 'utf8')
  )
}

export function getPublishedCoreVersion() {
  return getCorePackage().version
}

export function getVersionLabel() {
  const sha = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: rootDir,
    encoding: 'utf8',
  })
  const suffix = sha.status === 0 ? `+${sha.stdout.trim()}` : ''
  return `${getPublishedCoreVersion()}${suffix}`
}

function assertBenchmarkArrowMode(mode) {
  if (mode === 'published' || mode === 'local') {
    return
  }

  throw new Error(
    `Unknown JS framework benchmark Arrow mode: ${mode}. Expected "published" or "local".`
  )
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
  return join(benchmarkRepoDir, 'frameworks', keyed ? 'keyed' : 'non-keyed', 'arrowjs')
}

function createArrowMainSource(keyed, mode) {
  const title = keyed ? 'ArrowJS (keyed)' : 'ArrowJS (non-keyed)'
  const importPath = mode === 'local' ? './arrow.js' : '@arrow-js/core'
  const rows = `() => (data.version, views)`
  return `import { reactive, html } from '${importPath}';
let data = reactive({
  version: 0,
});
let ids = [];
let labels = [];
let views = [];

let rowId = 1;
let selectedIndex = -1;
const adjectives = ["pretty", "large", "big", "small", "tall", "short", "long", "handsome", "plain", "quaint", "clean", "elegant", "easy", "angry", "crazy", "helpful", "mushy", "odd", "unsightly", "adorable", "important", "inexpensive", "cheap", "expensive", "fancy"];
const colours = ["red", "yellow", "blue", "green", "pink", "brown", "purple", "brown", "white", "black", "orange"];
const nouns = ["table", "chair", "house", "bbq", "desk", "car", "pony", "cookie", "sandwich", "burger", "pizza", "mouse", "keyboard"];
const labelPool = [];
for (let i = 0; i < adjectives.length; i++) {
  const prefix = adjectives[i] + " ";
  for (let j = 0; j < colours.length; j++) {
    const stem = prefix + colours[j] + " ";
    for (let k = 0; k < nouns.length; k++) {
      labelPool.push(stem + nouns[k]);
    }
  }
}
const labelPoolSize = labelPool.length;
const add = () => {
    appendData(1000);
    data.version++;
  },
  clear = () => {
    selectedIndex = -1;
    ids.length = 0;
    labels.length = 0;
    views.length = 0;
    data.version++;
  },
  partialUpdate = () => {
    for (let i = 0; i < ids.length; i += 10) {
      labels[i] += ' !!!';
      views[i] = createRowView(ids[i], labels[i]);
    }
    data.version++;
  },
  run = () => {
    selectedIndex = -1;
    buildData(1000, ids, labels, views);
    data.version++;
  },
  runLots = () => {
    selectedIndex = -1;
    buildData(10000, ids, labels, views);
    data.version++;
  },
  swapRows = () => {
    if (ids.length > 998) {
      const id = ids[1];
      ids[1] = ids[998];
      ids[998] = id;
      const label = labels[1];
      labels[1] = labels[998];
      labels[998] = label;
      const view = views[1];
      views[1] = views[998];
      views[998] = view;
      if (selectedIndex === 1) selectedIndex = 998;
      else if (selectedIndex === 998) selectedIndex = 1;
      data.version++;
    }
  };

function createRowView(id, label, selected) {
  return html\`<tr class="\${selected ? 'danger' : false}"><td class="col-md-1">\${id}</td><td class="col-md-4"><a>\${label}</a></td><td class="col-md-1"><a><span class="glyphicon glyphicon-remove" aria-hidden="true"></span></a></td><td class="col-md-6"></td></tr>\`${keyed ? `.key(id)` : ''};
}

function handleRowClick(event) {
  const cell = event.target instanceof Element
    ? event.target.closest('td')
    : null;
  if (!cell) return;
  const index = cell.cellIndex;
  if (index !== 1 && index !== 2) return;
  const row = cell.parentElement;
  if (!(row instanceof HTMLTableRowElement)) return;
  const idx = row.sectionRowIndex;
  if (idx < 0 || idx >= ids.length) return;
  if (index === 1) {
    if (selectedIndex === idx) return;
    const previousIndex = selectedIndex;
    selectedIndex = idx;
    if (previousIndex > -1) {
      views[previousIndex] = createRowView(ids[previousIndex], labels[previousIndex], false);
    }
    views[idx] = createRowView(ids[idx], labels[idx], true);
    data.version++;
    return;
  }
  if (index === 2) {
    if (idx === selectedIndex) {
      selectedIndex = -1;
    } else if (selectedIndex > idx) selectedIndex--;
    ids.splice(idx, 1);
    labels.splice(idx, 1);
    views.splice(idx, 1);
    data.version++;
  }
}

function buildData(count, ids, labels, views, start = 0) {
  const pool = labelPool;
  const size = labelPoolSize;
  const createView = createRowView;
  const end = start + count;
  let nextId = rowId;
  ids.length = end;
  labels.length = end;
  views.length = end;
  for (var i = start; i < end; i++) {
    const id = nextId++;
    const label = pool[(Math.random() * size) | 0];
    ids[i] = id;
    labels[i] = label;
    views[i] = createView(id, label, false);
  }
  rowId = nextId;
}

function appendData(count) {
  const pool = labelPool;
  const size = labelPoolSize;
  const createView = createRowView;
  let nextId = rowId;
  for (let i = 0; i < count; i++) {
    const id = nextId++;
    const label = pool[(Math.random() * size) | 0];
    ids.push(id);
    labels.push(label);
    views.push(createView(id, label, false));
  }
  rowId = nextId;
}
html\`<div class="container">
  <div class="jumbotron">
  <div class="row">
    <div class="col-md-6">
      <h1>${title}</h1>
    </div>
    <div class="col-md-6">
      <div class="row">
        <div class="col-sm-6 smallpad">
          <button type="button" class="btn btn-primary btn-block" id="run" @click="\${run}">Create 1,000 rows</button>
        </div>
        <div class="col-sm-6 smallpad">
          <button type="button" class="btn btn-primary btn-block" id="runlots" @click="\${runLots}">Create 10,000
            rows</button>
        </div>
        <div class="col-sm-6 smallpad">
          <button type="button" class="btn btn-primary btn-block" id="add" @click="\${add}">Append 1,000 rows</button>
        </div>
        <div class="col-sm-6 smallpad">
          <button type="button" class="btn btn-primary btn-block" id="update" @click="\${partialUpdate}">Update every
            10th row</button>
        </div>
        <div class="col-sm-6 smallpad">
          <button type="button" class="btn btn-primary btn-block" id="clear" @click="\${clear}">Clear</button>
        </div>
        <div class="col-sm-6 smallpad">
          <button type="button" class="btn btn-primary btn-block" id="swaprows" @click="\${swapRows}">Swap Rows</button>
        </div>
      </div>
    </div>
  </div>
  </div>
  <table class="table table-hover table-striped test-data">
    <tbody @click="\${handleRowClick}">
      \${${rows}}
    </tbody>
  </table>
  <span class="preloadicon glyphicon glyphicon-remove" aria-hidden="true"></span>
</div>
\`(document.getElementById('main'))
`
}

function createArrowIndexHtml(keyed, mode) {
  const title = keyed ? 'ArrowJS • Keyed' : 'ArrowJS • Non-keyed'
  const entryPoint = mode === 'local' ? 'src/Main.js' : 'dist/main.js'
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <link href="/css/currentStyle.css" rel="stylesheet" />
</head>
<body>
  <div id="main"></div>
  <script type="module" src="${entryPoint}"></script>
</body>
</html>
`
}

function syncLocalArrowRuntime(srcDir) {
  const distFile = join(rootDir, 'packages', 'core', 'dist', 'index.mjs')
  const distChunksDir = join(rootDir, 'packages', 'core', 'dist', 'chunks')
  if (!existsSync(distFile)) {
    throw new Error('Missing packages/core/dist/index.mjs. Run `pnpm build:runtime` first.')
  }
  if (!existsSync(distChunksDir)) {
    throw new Error('Missing packages/core/dist/chunks. Run `pnpm build:runtime` first.')
  }

  const chunkTargetDir = join(srcDir, 'chunks')

  copyFileSync(distFile, join(srcDir, 'arrow.js'))
  rmSync(chunkTargetDir, { recursive: true, force: true })
  cpSync(distChunksDir, chunkTargetDir, { recursive: true })
}

function syncArrowPackageJson(packagePath, mode) {
  const pkg = existsSync(packagePath)
    ? JSON.parse(readFileSync(packagePath, 'utf8'))
    : {}
  pkg.name = 'js-framework-benchmark-arrowjs'
  pkg.version = '1.0.0'
  pkg.description = 'ArrowJS demo'
  pkg['js-framework-benchmark'] ??= {}
  pkg['js-framework-benchmark'].frameworkHomeURL = 'https://www.arrow-js.com/'

  if (mode === 'local') {
    pkg['js-framework-benchmark'].frameworkVersion = getVersionLabel()
    delete pkg['js-framework-benchmark'].frameworkVersionFromPackage
    delete pkg.scripts
    delete pkg.dependencies
    delete pkg.devDependencies
  } else {
    delete pkg['js-framework-benchmark'].frameworkVersion
    pkg['js-framework-benchmark'].frameworkVersionFromPackage = '@arrow-js/core'
    pkg.scripts = {
      dev: 'esbuild src/Main.js --bundle --format=esm --target=es2020 --outfile=dist/main.js --watch',
      'build-prod':
        'esbuild src/Main.js --bundle --format=esm --minify --target=es2020 --outfile=dist/main.js',
    }
    pkg.dependencies = {
      '@arrow-js/core': getPublishedCoreVersion(),
    }
    pkg.devDependencies = {
      esbuild: '0.27.4',
    }
  }

  writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`)
}

export function syncArrowBenchmark({ mode = benchmarkArrowMode } = {}) {
  assertBenchmarkArrowMode(mode)

  for (const keyed of [true, false]) {
    const targetDir = frameworkDir(keyed)
    const srcDir = join(targetDir, 'src')
    const packagePath = join(targetDir, 'package.json')
    const indexPath = join(targetDir, 'index.html')
    const mainPath = join(srcDir, 'Main.js')

    mkdirSync(srcDir, { recursive: true })

    if (mode === 'local') {
      syncLocalArrowRuntime(srcDir)
      rmSync(join(targetDir, 'dist'), { recursive: true, force: true })
    } else {
      rmSync(join(srcDir, 'arrow.js'), { force: true })
      rmSync(join(srcDir, 'chunks'), { recursive: true, force: true })
    }

    writeFileSync(mainPath, createArrowMainSource(keyed, mode))
    writeFileSync(indexPath, createArrowIndexHtml(keyed, mode))
    syncArrowPackageJson(packagePath, mode)
  }
}

export function buildArrowBenchmark({ mode = benchmarkArrowMode } = {}) {
  assertBenchmarkArrowMode(mode)

  if (mode === 'local') {
    return
  }

  for (const keyed of [true, false]) {
    const targetDir = frameworkDir(keyed)
    run('npm', ['install'], { cwd: targetDir })
    run('npm', ['run', 'build-prod'], { cwd: targetDir })
  }
}
