import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const createArrowDir = path.resolve(repoRoot, 'packages/create-arrow-js')
const localArrowPackages = [
  '@arrow-js/core',
  '@arrow-js/framework',
  '@arrow-js/hydrate',
  '@arrow-js/ssr',
]

const options = parseArgs(process.argv.slice(2))
const workspaceDir = options.dir
  ? path.resolve(options.dir)
  : await fs.mkdtemp(path.resolve(os.tmpdir(), 'arrow-create-smoke-'))
const tarballDir = path.resolve(workspaceDir, '.tarballs')

await fs.mkdir(workspaceDir, { recursive: true })
await fs.mkdir(tarballDir, { recursive: true })

const packageJson = JSON.parse(
  await fs.readFile(path.resolve(createArrowDir, 'package.json'), 'utf8')
)
const tarballPath = path.resolve(
  tarballDir,
  `${packageJson.name}-${packageJson.version}.tgz`
)
const projectName = options.projectName
const projectDir = path.resolve(workspaceDir, projectName)

process.stdout.write(`\nPacking create-arrow-js into ${tarballDir}\n`)
await execa('pnpm', ['pack', '--pack-destination', tarballDir], {
  cwd: createArrowDir,
  stdio: 'inherit',
})

let localTarballs = null

if (!options.publishedDeps) {
  process.stdout.write('\nBuilding and packing local Arrow workspace packages\n')
  await buildWorkspacePackages(localArrowPackages)

  localTarballs = Object.fromEntries(
    await Promise.all(
      localArrowPackages.map(async (packageName) => [
        packageName,
        await packWorkspacePackage(packageName, tarballDir),
      ])
    )
  )
}

process.stdout.write(`\nScaffolding ${projectName} in ${workspaceDir}\n`)
await execa(
  'pnpm',
  [
    'dlx',
    tarballPath,
    projectName,
    '--skill-agent',
    'skip',
    ...(options.publishedDeps ? [] : ['--no-install']),
  ],
  {
    cwd: workspaceDir,
    stdio: 'inherit',
  }
)

if (localTarballs) {
  process.stdout.write('\nRewriting the starter to local workspace tarballs\n')
  await rewriteArrowDependencies(projectDir, localTarballs)

  process.stdout.write('\nInstalling local workspace packages into the starter\n')
  await execa('pnpm', ['install', '--prefer-offline'], {
    cwd: projectDir,
    stdio: 'inherit',
  })
}

process.stdout.write(`\nProject ready at ${projectDir}\n`)

if (options.noDev) {
  process.stdout.write('\nSkipping pnpm dev because --no-dev was provided.\n')
  process.exit(0)
}

process.stdout.write('\nStarting pnpm dev. Press Ctrl+C to stop.\n\n')

try {
  await execa('pnpm', ['dev'], {
    cwd: projectDir,
    stdio: 'inherit',
  })
} catch (error) {
  if (wasInterrupted(error)) {
    process.exit(0)
  }

  throw error
}

function parseArgs(args) {
  const options = {
    dir: '',
    noDev: false,
    publishedDeps: false,
    projectName: 'arrow-app',
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--') {
      continue
    }

    if (arg === '--dir') {
      options.dir = readOptionValue(args, index, '--dir')
      index += 1
      continue
    }

    if (arg === '--project') {
      options.projectName = readOptionValue(args, index, '--project')
      index += 1
      continue
    }

    if (arg === '--no-dev') {
      options.noDev = true
      continue
    }

    if (arg === '--published-deps') {
      options.publishedDeps = true
      continue
    }

    if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }

    throw new Error(`Unknown argument "${arg}".`)
  }

  return options
}

function printHelp() {
  process.stdout.write(
    [
      'Usage: pnpm smoke:create-arrow-js [-- --dir <path>] [-- --project <name>] [-- --no-dev] [-- --published-deps]',
      '',
      'Defaults:',
      '  --dir      a fresh temp directory',
      '  --project  arrow-app',
      '  package deps come from local workspace tarballs',
      '',
    ].join('\n')
  )
}

function wasInterrupted(error) {
  return !!error
    && typeof error === 'object'
    && 'signal' in error
    && (error.signal === 'SIGINT' || error.signal === 'SIGTERM')
}

function readOptionValue(args, index, flagName) {
  const value = args[index + 1]

  if (!value || value === '--' || value.startsWith('-')) {
    throw new Error(`Missing value for ${flagName}.`)
  }

  return value
}

async function packWorkspacePackage(packageName, tarballDir) {
  const packageDirectory = path.resolve(
    repoRoot,
    'packages',
    packageName.startsWith('@arrow-js/') ? packageName.split('/')[1] : packageName
  )
  const { stdout } = await execa(
    'pnpm',
    ['pack', '--json', '--pack-destination', tarballDir],
    {
      cwd: packageDirectory,
    }
  )

  return JSON.parse(stdout).filename
}

async function rewriteArrowDependencies(
  projectDir,
  tarballs
) {
  const packageJsonPath = path.resolve(projectDir, 'package.json')
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'))
  const overrides = packageJson.pnpm?.overrides ?? {}

  for (const packageName of localArrowPackages) {
    const tarball = `file:${normalizePath(tarballs[packageName])}`

    if (packageJson.dependencies?.[packageName]) {
      packageJson.dependencies[packageName] = tarball
    }
    if (packageJson.devDependencies?.[packageName]) {
      packageJson.devDependencies[packageName] = tarball
    }

    overrides[packageName] = tarball
  }

  packageJson.pnpm = {
    ...(packageJson.pnpm ?? {}),
    overrides,
  }

  await fs.writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)
}

function normalizePath(value) {
  return value.replace(/\\/g, '/')
}

async function buildWorkspacePackages(packageNames) {
  const buildOrder = [
    '@arrow-js/core',
    '@arrow-js/framework',
    '@arrow-js/ssr',
    '@arrow-js/hydrate',
  ]
  const buildScripts = {
    '@arrow-js/core': 'build:runtime',
    '@arrow-js/framework': 'build',
    '@arrow-js/ssr': 'build',
    '@arrow-js/hydrate': 'build',
  }

  for (const packageName of buildOrder) {
    if (!packageNames.includes(packageName)) {
      continue
    }

    await execa('pnpm', ['--filter', packageName, buildScripts[packageName]], {
      cwd: repoRoot,
      stdio: 'inherit',
    })
  }
}
