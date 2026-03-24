import http from 'node:http'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'
import { afterEach, describe, expect, it } from 'vitest'
import {
  detectPackageManager,
  scaffoldArrowApp,
} from '../packages/create-arrow-js/scaffold.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arrowPackages = [
  '@arrow-js/core',
  '@arrow-js/framework',
  '@arrow-js/hydrate',
  '@arrow-js/ssr',
  '@arrow-js/skill',
] as const

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((directory) =>
      fs.rm(directory, { force: true, recursive: true })
    )
  )
})

describe('create-arrow-js', () => {
  it('detects the invoking package manager from environment metadata', () => {
    expect(
      detectPackageManager({
        npm_config_user_agent: 'pnpm/10.14.0 npm/? node/v22.12.0 darwin arm64',
      } as NodeJS.ProcessEnv)
    ).toBe('pnpm')
    expect(
      detectPackageManager({
        npm_execpath: '/opt/homebrew/bin/npm-cli.js',
      } as NodeJS.ProcessEnv)
    ).toBe('npm')
  })

  it('scaffolds a Vite 8 Arrow starter', async () => {
    const workspace = await createTempDir()
    const projectDir = path.resolve(workspace, 'arrow-app')
    const versions = await readCreateArrowVersions()

    const result = await scaffoldArrowApp(projectDir)

    const packageJson = JSON.parse(
      await fs.readFile(path.resolve(projectDir, 'package.json'), 'utf8')
    )

    expect(result.projectName).toBe('arrow-app')
    expect(packageJson.dependencies['@arrow-js/core']).toBe(`^${versions['@arrow-js/core']}`)
    expect(packageJson.scripts.dev).toBe('node server.mjs')
    await expectFile(projectDir, '.gitignore')
    await expectFile(projectDir, 'src/App.ts')
    await expectFile(projectDir, 'src/components/WelcomeCard.ts')
    await expectFile(projectDir, 'src/entry-server.ts')
    await expectFile(projectDir, 'src/entry-client.ts')
  })

  it('runs the package-manager install step in the CLI flow', async () => {
    const workspace = await createTempDir()
    const projectDir = path.resolve(workspace, 'arrow-app')
    const binDir = path.resolve(workspace, 'bin')
    const installLogPath = path.resolve(workspace, 'install-log.json')

    await fs.mkdir(binDir, { recursive: true })
    await writePackageManagerStub(binDir, 'pnpm', installLogPath)

    const { stdout } = await execa(
      'node',
      [path.resolve(repoRoot, 'packages/create-arrow-js/index.js'), 'arrow-app', '--skill-agent', 'skip'],
      {
        cwd: workspace,
        env: {
          ...process.env,
          INSTALL_LOG_PATH: installLogPath,
          PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}`,
          npm_config_user_agent: 'pnpm/10.14.0 npm/? node/v22.12.0 darwin arm64',
        },
      }
    )

    const installLog = JSON.parse(await fs.readFile(installLogPath, 'utf8')) as {
      args: string[]
      cwd: string
    }

    expect(await fs.realpath(installLog.cwd)).toBe(await fs.realpath(projectDir))
    expect(installLog.args).toEqual(['install'])
    expect(stdout).toContain('Installing dependencies with pnpm...')
    expect(stdout).toContain('  cd arrow-app')
    expect(stdout).toContain('  pnpm dev')
    expect(stdout).not.toContain('  pnpm install')
  })

  it('falls back to the next free port when the default dev port is busy', async () => {
    const workspace = await createTempDir()
    const projectDir = path.resolve(workspace, 'arrow-app')
    const blocker = http.createServer()
    const blockedPort = await getAvailablePort()

    await scaffoldArrowApp(projectDir, {
      skillAgent: 'skip',
    })
    await writeViteStub(projectDir)
    await listen(blocker, blockedPort)

    const server = execa('node', ['server.mjs'], {
      all: true,
      cwd: projectDir,
      env: {
        ...process.env,
        PORT: String(blockedPort),
      },
      reject: false,
    })

    try {
      const output = await waitForStreamMatch(
        server.all!,
        /Arrow app running at http:\/\/127\.0\.0\.1:(\d+)/
      )
      const port = Number(
        /Arrow app running at http:\/\/127\.0\.0\.1:(\d+)/.exec(output)?.[1]
      )

      expect(port).toBeGreaterThan(blockedPort)
      expect(output).toContain(`Port ${blockedPort} is in use, using`)
    } finally {
      server.kill('SIGTERM')
      await server.catch(() => undefined)
      await closeServer(blocker)
    }
  })

  it(
    'renders the scaffolded app in dev mode with packed workspace packages',
    async () => {
      const workspace = await createTempDir()
      const projectDir = path.resolve(workspace, 'arrow-app')
      const packDir = path.resolve(workspace, 'packs')

      await scaffoldArrowApp(projectDir, {
        skillAgent: 'skip',
      })
      await fs.mkdir(packDir, { recursive: true })

      await buildPackableWorkspacePackages()

      const tarballs = Object.fromEntries(
        await Promise.all(
          arrowPackages.map(async (packageName) => [
            packageName,
            await packWorkspacePackage(packageName, packDir),
          ])
        )
      )

      await rewriteArrowDependencies(projectDir, tarballs)

      await execa('pnpm', ['install', '--prefer-offline'], {
        cwd: projectDir,
      })

      const server = execa('pnpm', ['dev'], {
        all: true,
        cwd: projectDir,
        env: {
          ...process.env,
          PORT: '0',
        },
        reject: false,
      })

      try {
        const output = await waitForStreamMatch(
          server.all!,
          /Arrow app running at http:\/\/127\.0\.0\.1:(\d+)/
        )
        const port = Number(
          /Arrow app running at http:\/\/127\.0\.0\.1:(\d+)/.exec(output)?.[1]
        )
        const response = await fetch(`http://127.0.0.1:${port}/`)
        const html = await response.text()

        expect(response.status).toBe(200)
        expect(html).toContain('<link rel="stylesheet" href="/src/style.css" />')
        expect(html).toContain('pnpm create arrow-js@latest')
        expect(html).toContain('SSR + Hydration')
      } finally {
        server.kill('SIGTERM')
        await server.catch(() => undefined)
      }
    },
    300_000
  )

  it(
    'installs and builds against packed workspace packages',
    async () => {
      const workspace = await createTempDir()
      const projectDir = path.resolve(workspace, 'arrow-app')
      const packDir = path.resolve(workspace, 'packs')

      await scaffoldArrowApp(projectDir)
      await fs.mkdir(packDir, { recursive: true })

      await buildPackableWorkspacePackages()

      const tarballs = Object.fromEntries(
        await Promise.all(
          arrowPackages.map(async (packageName) => [
            packageName,
            await packWorkspacePackage(packageName, packDir),
          ])
        )
      )

      await rewriteArrowDependencies(projectDir, tarballs)

      await execa('pnpm', ['install', '--prefer-offline'], {
        cwd: projectDir,
      })
      await execa('pnpm', ['typecheck'], {
        cwd: projectDir,
      })
      await execa('pnpm', ['build'], {
        cwd: projectDir,
      })
    },
    300_000
  )
})

async function createTempDir() {
  const directory = await fs.mkdtemp(path.resolve(os.tmpdir(), 'arrow-create-'))
  tempDirs.push(directory)
  return directory
}

async function readCreateArrowVersions() {
  return JSON.parse(
    await fs.readFile(
      path.resolve(repoRoot, 'packages/create-arrow-js/versions.json'),
      'utf8'
    )
  ) as Record<(typeof arrowPackages)[number], string>
}

async function expectFile(rootDir: string, relativePath: string) {
  await fs.access(path.resolve(rootDir, relativePath))
}

async function packWorkspacePackage(packageName: string, packDir: string) {
  const packageDirectory = path.resolve(
    repoRoot,
    'packages',
    packageName.startsWith('@arrow-js/') ? packageName.split('/')[1] : packageName
  )
  const { stdout } = await execa(
    'pnpm',
    ['pack', '--json', '--pack-destination', packDir],
    {
      cwd: packageDirectory,
    }
  )
  const details = JSON.parse(stdout) as { filename: string }
  return details.filename
}

async function buildPackableWorkspacePackages() {
  const buildOrder = [
    '@arrow-js/core',
    '@arrow-js/framework',
    '@arrow-js/ssr',
    '@arrow-js/hydrate',
  ] as const
  const buildScripts: Record<(typeof buildOrder)[number], string> = {
    '@arrow-js/core': 'build:runtime',
    '@arrow-js/framework': 'build',
    '@arrow-js/ssr': 'build',
    '@arrow-js/hydrate': 'build',
  }

  for (const packageName of buildOrder) {
    await execa('pnpm', ['--filter', packageName, buildScripts[packageName]], {
      cwd: repoRoot,
    })
  }
}

async function rewriteArrowDependencies(
  projectDir: string,
  tarballs: Record<string, string>
) {
  const packageJsonPath = path.resolve(projectDir, 'package.json')
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'))
  const overrides: Record<string, string> = packageJson.pnpm?.overrides ?? {}

  for (const packageName of arrowPackages) {
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

function normalizePath(value: string) {
  return value.replace(/\\/g, '/')
}

async function writePackageManagerStub(
  binDir: string,
  command: string,
  installLogPath: string
) {
  const stubPath = path.resolve(binDir, command)
  const stubSource = [
    '#!/usr/bin/env node',
    "import fs from 'node:fs'",
    "const payload = JSON.stringify({ cwd: process.cwd(), args: process.argv.slice(2) })",
    "fs.writeFileSync(process.env.INSTALL_LOG_PATH, payload)",
    '',
  ].join('\n')

  await fs.writeFile(stubPath, stubSource, { mode: 0o755 })
}

async function writeViteStub(projectDir: string) {
  const viteDir = path.resolve(projectDir, 'node_modules/vite')

  await fs.mkdir(viteDir, { recursive: true })
  await fs.writeFile(
    path.resolve(viteDir, 'package.json'),
    `${JSON.stringify({
      name: 'vite',
      type: 'module',
      exports: './index.js',
    }, null, 2)}\n`
  )
  await fs.writeFile(
    path.resolve(viteDir, 'index.js'),
    [
      'export async function createServer() {',
      '  return {',
      '    middlewares(_request, _response, next) {',
      '      next()',
      '    },',
      '    async transformIndexHtml(_url, template) {',
      '      return template',
      '    },',
      '    async ssrLoadModule() {',
      '      return {',
      '        async renderPage() {',
      "          return { status: 200, html: '<div></div>' }",
      '        },',
      '      }',
      '    },',
      '    ssrFixStacktrace() {},',
      '  }',
      '}',
      '',
    ].join('\n')
  )
}

function listen(server: http.Server, port: number) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      server.off('error', onError)
      server.off('listening', onListening)
    }

    const onError = (error: Error) => {
      cleanup()
      reject(error)
    }

    const onListening = () => {
      cleanup()
      resolve()
    }

    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port, '127.0.0.1')
  })
}

function closeServer(server: http.Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

function waitForStreamMatch(
  stream: NodeJS.ReadableStream,
  pattern: RegExp,
  timeoutMs = 10_000
) {
  return new Promise<string>((resolve, reject) => {
    let output = ''

    const cleanup = () => {
      clearTimeout(timer)
      stream.off('data', onData)
      stream.off('end', onEnd)
      stream.off('error', onError)
    }

    const onData = (chunk: Buffer | string) => {
      output += chunk.toString()

      if (pattern.test(output)) {
        cleanup()
        resolve(output)
      }
    }

    const onEnd = () => {
      cleanup()
      reject(new Error(`Process exited before matching ${pattern}.\n${output}`))
    }

    const onError = (error: Error) => {
      cleanup()
      reject(error)
    }

    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`Timed out waiting for output matching ${pattern}.\n${output}`))
    }, timeoutMs)

    stream.on('data', onData)
    stream.on('end', onEnd)
    stream.on('error', onError)
  })
}

async function getAvailablePort() {
  const server = http.createServer()

  try {
    await listen(server, 0)
    const address = server.address()

    if (!address || typeof address === 'string') {
      throw new Error('Unable to determine an available port for testing.')
    }

    return address.port
  } finally {
    await closeServer(server)
  }
}
