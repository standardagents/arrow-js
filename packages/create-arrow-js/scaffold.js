import fs from 'node:fs/promises'
import path from 'node:path'
import readline from 'node:readline/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const templateRoot = path.resolve(packageRoot, 'template')
const versionsPath = path.resolve(packageRoot, 'versions.json')

const arrowPackages = [
  '@arrow-js/core',
  '@arrow-js/framework',
  '@arrow-js/hydrate',
  '@arrow-js/ssr',
]

const toolVersions = {
  nodeTypes: '^22.16.5',
  typescript: '^5.9.3',
  vite: '^8.0.0',
}

export async function scaffoldArrowApp(
  targetDir,
  options = {}
) {
  const projectName = sanitizeProjectName(path.basename(path.resolve(targetDir)))
  const resolvedTargetDir = path.resolve(targetDir)
  const relativeTargetDir = normalizePath(
    path.relative(process.cwd(), resolvedTargetDir) || '.'
  )
  const versions = options.versions ?? await readPackageVersions()
  const skillAgent = await resolveSkillAgent(options)

  await ensureTargetDir(resolvedTargetDir)

  const dependencyVersions = createArrowDependencyVersions(versions)

  const replacements = {
    __PACKAGE_NAME__: projectName,
    __ARROW_CORE__: dependencyVersions['@arrow-js/core'],
    __ARROW_FRAMEWORK__: dependencyVersions['@arrow-js/framework'],
    __ARROW_HYDRATE__: dependencyVersions['@arrow-js/hydrate'],
    __ARROW_SSR__: dependencyVersions['@arrow-js/ssr'],
    __TYPES_NODE_VERSION__: toolVersions.nodeTypes,
    __TYPESCRIPT_VERSION__: toolVersions.typescript,
    __VITE_VERSION__: toolVersions.vite,
  }

  await copyTemplate(templateRoot, resolvedTargetDir, replacements)
  await configureSkillPackage(resolvedTargetDir, versions['@arrow-js/skill'], skillAgent)

  return {
    projectName,
    relativeTargetDir,
    skillAgent,
    targetDir: resolvedTargetDir,
  }
}

async function ensureTargetDir(targetDir) {
  try {
    const entries = await fs.readdir(targetDir)
    if (entries.length > 0) {
      throw new Error(`Target directory "${targetDir}" is not empty.`)
    }
  } catch (error) {
    if (isMissingPathError(error)) {
      await fs.mkdir(targetDir, { recursive: true })
      return
    }

    throw error
  }
}

async function readPackageVersions() {
  return JSON.parse(await fs.readFile(versionsPath, 'utf8'))
}

function createArrowDependencyVersions(versions) {
  return Object.fromEntries(
    arrowPackages.map((packageName) => [packageName, `^${versions[packageName]}`])
  )
}

async function configureSkillPackage(targetDir, arrowVersion, skillAgent) {
  if (skillAgent === 'skip') {
    return
  }

  const packageJsonPath = path.resolve(targetDir, 'package.json')
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'))

  packageJson.devDependencies = {
    ...packageJson.devDependencies,
    '@arrow-js/skill': `^${arrowVersion}`,
  }

  packageJson.scripts = {
    ...packageJson.scripts,
    postinstall: `arrow-js-skill install --agent ${skillAgent} --project . --yes`,
  }

  await fs.writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)
}

async function copyTemplate(sourceDir, targetDir, replacements) {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true })

  for (const entry of entries) {
    const sourcePath = path.resolve(sourceDir, entry.name)
    const targetName = entry.name === '_gitignore' ? '.gitignore' : entry.name
    const targetPath = path.resolve(targetDir, targetName)

    if (entry.isDirectory()) {
      await fs.mkdir(targetPath, { recursive: true })
      await copyTemplate(sourcePath, targetPath, replacements)
      continue
    }

    const source = await fs.readFile(sourcePath, 'utf8')
    await fs.writeFile(targetPath, applyReplacements(source, replacements))
  }
}

function applyReplacements(source, replacements) {
  return Object.entries(replacements).reduce(
    (value, [token, replacement]) => value.replaceAll(token, replacement),
    source
  )
}

function sanitizeProjectName(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'arrow-app'
}

function isMissingPathError(error) {
  return !!error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'
}

function normalizePath(value) {
  return value.replace(/\\/g, '/')
}

async function resolveSkillAgent(options) {
  const value = options.skillAgent

  if (isValidSkillAgent(value)) {
    return value
  }

  if (value) {
    throw new Error(`Unknown skill agent "${value}". Use codex, claude, both, or skip.`)
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return 'codex'
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    process.stdout.write(
      [
        '',
        'Install the Arrow AI skill for:',
        '  1. Codex (Recommended)',
        '  2. Claude Code',
        '  3. Both',
        '  4. Skip',
        '',
      ].join('\n')
    )

    const answer = (await rl.question('Select 1-4: ')).trim() || '1'
    return mapSkillChoice(answer)
  } finally {
    rl.close()
  }
}

function isValidSkillAgent(value) {
  return value === 'codex' || value === 'claude' || value === 'both' || value === 'skip'
}

function mapSkillChoice(value) {
  if (value === '1') {
    return 'codex'
  }

  if (value === '2') {
    return 'claude'
  }

  if (value === '3') {
    return 'both'
  }

  if (value === '4') {
    return 'skip'
  }

  throw new Error(`Unknown selection "${value}".`)
}
