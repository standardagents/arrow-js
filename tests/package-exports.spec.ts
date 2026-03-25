import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'
import { afterEach, describe, expect, it } from 'vitest'
import { getPackedWorkspacePackages } from './helpers/packed-workspace-packages.js'

const packagedArrowLibraries = [
  '@arrow-js/core',
  '@arrow-js/framework',
  '@arrow-js/ssr',
  '@arrow-js/hydrate',
  '@arrow-js/highlight',
] as const
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((directory) =>
      fs.rm(directory, { force: true, recursive: true })
    )
  )
})

describe('packaged Arrow exports', () => {
  it(
    'imports the packaged runtime libraries in plain Node without loading TypeScript from node_modules',
    async () => {
      const workspace = await createTempDir()
      const packDir = path.resolve(workspace, 'packs')
      const consumerDir = path.resolve(workspace, 'consumer')
      const nodeModulesDir = path.resolve(consumerDir, 'node_modules')

      await fs.mkdir(packDir, { recursive: true })
      await fs.mkdir(nodeModulesDir, { recursive: true })
      const tarballs = await getPackedWorkspacePackages(
        packagedArrowLibraries,
        packDir
      )

      for (const packageName of packagedArrowLibraries) {
        await unpackWorkspaceTarball(
          tarballs[packageName],
          path.resolve(nodeModulesDir, ...packageName.split('/'))
        )
      }

      await linkDependency(
        path.resolve(repoRoot, 'node_modules', 'jsdom'),
        path.resolve(nodeModulesDir, 'jsdom')
      )

      const verifyScriptPath = path.resolve(consumerDir, 'verify.mjs')
      await fs.writeFile(
        verifyScriptPath,
        [
          "const [{ component, html }] = await Promise.all([",
          "  import('@arrow-js/core'),",
          "  import('@arrow-js/core/internal'),",
          "  import('@arrow-js/framework'),",
          "  import('@arrow-js/framework/internal'),",
          "  import('@arrow-js/framework/ssr'),",
          "  import('@arrow-js/ssr'),",
          "  import('@arrow-js/hydrate'),",
          "  import('@arrow-js/highlight'),",
          '])',
          'component(async () => html`<p>ok</p>`)',
          "console.log('imports ok')",
          '',
        ].join('\n')
      )

      const { stdout } = await execa('node', [verifyScriptPath], {
        cwd: consumerDir,
      })

      const frameworkPackage = JSON.parse(
        await fs.readFile(
          path.resolve(consumerDir, 'node_modules/@arrow-js/framework/package.json'),
          'utf8'
        )
      )
      const corePackage = JSON.parse(
        await fs.readFile(
          path.resolve(consumerDir, 'node_modules/@arrow-js/core/package.json'),
          'utf8'
        )
      )
      const ssrPackage = JSON.parse(
        await fs.readFile(
          path.resolve(consumerDir, 'node_modules/@arrow-js/ssr/package.json'),
          'utf8'
        )
      )
      const hydratePackage = JSON.parse(
        await fs.readFile(
          path.resolve(consumerDir, 'node_modules/@arrow-js/hydrate/package.json'),
          'utf8'
        )
      )
      const highlightPackage = JSON.parse(
        await fs.readFile(
          path.resolve(consumerDir, 'node_modules/@arrow-js/highlight/package.json'),
          'utf8'
        )
      )
      const frameworkIndexSource = await fs.readFile(
        path.resolve(consumerDir, 'node_modules/@arrow-js/framework/dist/index.mjs'),
        'utf8'
      )

      expect(stdout).toContain('imports ok')
      expect(corePackage.exports['./internal'].import).toBe('./dist/internal.mjs')
      expect(frameworkPackage.exports['.'].import).toBe('./dist/index.mjs')
      expect(frameworkPackage.exports['./internal'].import).toBe('./dist/internal.mjs')
      expect(frameworkPackage.exports['./ssr'].import).toBe('./dist/ssr.mjs')
      expect(ssrPackage.exports['.'].import).toBe('./dist/index.mjs')
      expect(hydratePackage.exports['.'].import).toBe('./dist/index.mjs')
      expect(highlightPackage.exports['.'].import).toBe('./dist/index.mjs')
      expect(frameworkIndexSource).not.toContain('./ssr.mjs')
      expect(frameworkIndexSource).not.toContain('jsdom')
    },
    90_000
  )
})

async function unpackWorkspaceTarball(tarballPath: string, destinationPath: string) {
  const extractDir = await createTempDir()

  await execa('tar', ['-xzf', tarballPath, '-C', extractDir])
  await fs.mkdir(path.dirname(destinationPath), { recursive: true })
  await fs.cp(path.resolve(extractDir, 'package'), destinationPath, {
    recursive: true,
  })
}

async function linkDependency(sourcePath: string, destinationPath: string) {
  await fs.mkdir(path.dirname(destinationPath), { recursive: true })
  await fs.symlink(sourcePath, destinationPath, 'dir')
}

async function createTempDir() {
  const directory = await fs.mkdtemp(path.resolve(os.tmpdir(), 'arrow-package-'))
  tempDirs.push(directory)
  return directory
}
