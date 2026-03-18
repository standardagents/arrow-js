import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const skillTemplateRoot = path.resolve(packageRoot, 'resources', 'skill')
const projectReferenceRoot = path.resolve(skillTemplateRoot, 'references')

export async function installArrowSkill(options = {}) {
  const agent = options.agent ?? 'codex'
  const targets = normalizeAgents(agent)
  const projectDir = path.resolve(options.projectDir ?? process.cwd())
  const enableProject = options.enableProject ?? true
  const messages = []

  for (const target of targets) {
    if (target === 'codex') {
      const codexHome = path.resolve(options.codexHome ?? resolveCodexHome())
      await installCodexSkill(codexHome)
      messages.push(`- Codex skill installed to ${path.join(codexHome, 'skills', 'arrow-js')}`)
      if (enableProject) {
        await enableCodexProject(projectDir)
        messages.push(`- Project instructions updated at ${path.join(projectDir, 'AGENTS.md')}`)
      }
      continue
    }

    if (target === 'claude') {
      await installClaudeProject(projectDir)
      messages.push(`- Claude project instructions updated at ${path.join(projectDir, 'CLAUDE.md')}`)
      messages.push(`- Arrow references copied to ${path.join(projectDir, '.arrow-js', 'skill')}`)
    }
  }

  return { messages }
}

export function parseCliArgs(args) {
  const defaults = {
    agent: process.env.CODEX_HOME ? 'codex' : 'codex',
    projectDir: process.cwd(),
    enableProject: true,
  }
  let interactive = args.length === 0

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === 'install') {
      interactive = false
      continue
    }

    if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }

    if (arg === '--yes' || arg === '-y') {
      interactive = false
      continue
    }

    if (arg === '--agent') {
      defaults.agent = args[index + 1] ?? ''
      index += 1
      interactive = false
      continue
    }

    if (arg === '--project') {
      defaults.projectDir = args[index + 1] ?? ''
      index += 1
      interactive = false
      continue
    }

    if (arg === '--no-project') {
      defaults.enableProject = false
      interactive = false
      continue
    }

    throw new Error(`Unknown argument "${arg}".`)
  }

  if (!defaults.projectDir) {
    throw new Error('Missing value for --project.')
  }

  if (!isValidAgent(defaults.agent)) {
    throw new Error(`Unknown agent "${defaults.agent}". Use codex, claude, both, or skip.`)
  }

  return { interactive, defaults }
}

export async function promptForInstallOptions(defaults = {}) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    process.stdout.write(
      [
        '',
        'Install Arrow skill for:',
        '  1. Codex (Recommended)',
        '  2. Claude Code',
        '  3. Both',
        '  4. Skip',
        '',
      ].join('\n')
    )

    const choice = (await rl.question('Select 1-4: ')).trim() || '1'
    const agent = mapPromptChoice(choice)

    if (agent === 'skip') {
      return {
        agent,
        projectDir: defaults.projectDir ?? process.cwd(),
        enableProject: false,
      }
    }

    const enable = await rl.question('Enable the skill for this project? [Y/n] ')
    return {
      agent,
      projectDir: defaults.projectDir ?? process.cwd(),
      enableProject: !/^n/i.test(enable.trim()),
    }
  } finally {
    rl.close()
  }
}

async function installCodexSkill(codexHome) {
  const targetDir = path.join(codexHome, 'skills', 'arrow-js')
  await fs.mkdir(path.dirname(targetDir), { recursive: true })
  await copyDir(skillTemplateRoot, targetDir)
}

async function installClaudeProject(projectDir) {
  const targetRoot = path.join(projectDir, '.arrow-js', 'skill')
  await copyDir(projectReferenceRoot, targetRoot)
  await upsertManagedBlock(
    path.join(projectDir, 'CLAUDE.md'),
    'arrow-js-skill',
    [
      '# Arrow',
      '',
      'Use the local Arrow references before making framework changes:',
      '',
      '- `.arrow-js/skill/getting-started.md`',
      '- `.arrow-js/skill/api.md`',
      '- `.arrow-js/skill/examples.md`',
      '',
      'Prefer idiomatic Arrow patterns:',
      '- `reactive()` for live state',
      '- `html` tagged templates for DOM',
      '- `component()` for reusable view units',
      '- `routeToPage(url)` in scaffolded SSR apps',
      '',
      'Keep no-build core usage simple. If SSR or hydration is involved, preserve payload and boundary behavior.',
    ].join('\n')
  )
}

async function enableCodexProject(projectDir) {
  await upsertManagedBlock(
    path.join(projectDir, 'AGENTS.md'),
    'arrow-js-skill',
    [
      '# Arrow',
      '',
      'Use the installed `arrow-js` Codex skill when working in this repo.',
      '',
      'Focus areas:',
      '- `reactive()`, `html`, `component()`, and `watch()`',
      '- SSR + hydration flow with `routeToPage(url)`',
      '- `@arrow-js/framework`, `@arrow-js/ssr`, and `@arrow-js/hydrate`',
      '- idiomatic template composition and route-based page modules',
    ].join('\n')
  )
}

function normalizeAgents(agent) {
  if (agent === 'both') {
    return ['codex', 'claude']
  }

  return [agent]
}

function mapPromptChoice(choice) {
  if (choice === '1') {
    return 'codex'
  }

  if (choice === '2') {
    return 'claude'
  }

  if (choice === '3') {
    return 'both'
  }

  if (choice === '4') {
    return 'skip'
  }

  throw new Error(`Unknown selection "${choice}".`)
}

function printHelp() {
  process.stdout.write(
    [
      'Usage: arrow-js-skill [install] [--agent codex|claude|both|skip] [--project <dir>] [--no-project] [--yes]',
      '',
      'Examples:',
      '  npx @arrow-js/skill@latest',
      '  npx @arrow-js/skill@latest install --agent codex --project . --yes',
      '',
    ].join('\n')
  )
}

function resolveCodexHome() {
  return process.env.CODEX_HOME || path.join(os.homedir(), '.codex')
}

function isValidAgent(value) {
  return value === 'codex' || value === 'claude' || value === 'both' || value === 'skip'
}

async function copyDir(sourceDir, targetDir) {
  await fs.mkdir(targetDir, { recursive: true })
  const entries = await fs.readdir(sourceDir, { withFileTypes: true })

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]
    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)

    if (entry.isDirectory()) {
      await copyDir(sourcePath, targetPath)
      continue
    }

    await fs.copyFile(sourcePath, targetPath)
  }
}

async function upsertManagedBlock(filePath, blockId, body) {
  const start = `<!-- ${blockId}:start -->`
  const end = `<!-- ${blockId}:end -->`
  const block = `${start}\n${body}\n${end}\n`
  let source = ''

  try {
    source = await fs.readFile(filePath, 'utf8')
  } catch (error) {
    if (!isMissingPathError(error)) {
      throw error
    }
  }

  if (source.includes(start) && source.includes(end)) {
    const next = source.replace(new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}\\n?`), block)
    await fs.writeFile(filePath, next)
    return
  }

  const prefix = source.length > 0 && !source.endsWith('\n') ? '\n\n' : source.length > 0 ? '\n' : ''
  await fs.writeFile(filePath, `${source}${prefix}${block}`)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isMissingPathError(error) {
  return !!error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'
}
